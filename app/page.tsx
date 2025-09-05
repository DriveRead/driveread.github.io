'use client';
import Script from 'next/script';
import { useEffect, useRef, useState } from 'react';
import { useGoogleToken } from '@/src/hooks/useGoogleToken';
import { listEpubs, downloadArrayBuffer } from '@/src/lib/drive';
import { loadProgress, saveProgress } from '@/src/lib/progress';
import { loadSettings, saveSettings } from '@/src/lib/settings';
import type { Settings } from '@/src/lib/settings';
import Reader from '@/src/components/Reader';

type DriveFile = { id: string; name: string };
type Controls = { goTo: (t: string) => Promise<void>; next: () => Promise<void>; prev: () => Promise<void> };

export default function Home() {
  const { token, ready, request } = useGoogleToken();
  const [files, setFiles] = useState<DriveFile[]>([]);
  const [bytes, setBytes] = useState<ArrayBuffer | null>(null);
  const [fileId, setFileId] = useState<string | null>(null);
  const [cfi, setCfi] = useState<string | undefined>();
  const [toc, setToc] = useState<Array<{ href: string; label: string }>>([]);
  const [settings, setSettings] = useState<Settings>(() => loadSettings());
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState<number | null>(null);
  const [total, setTotal] = useState<number | null>(null);
  const [percent, setPercent] = useState<number | null>(null);
  const [focusMode, setFocusMode] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const saveTimer = useRef<number | null>(null);
  const controlsRef = useRef<Controls | null>(null);
  const settingsMenuRef = useRef<HTMLDivElement>(null);

  function debouncedSave(fid: string, newCfi: string) {
    if (saveTimer.current) window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(() => saveProgress(fid, newCfi), 400);
  }

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (settingsMenuRef.current && !settingsMenuRef.current.contains(event.target as Node)) {
        setSettingsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (!token) return;
    listEpubs(token).then(d => setFiles(d.files)).catch(e => setError(String(e)));
  }, [token]);
  
  async function openFile(id: string) {
    if (!token) return;
    setLoading(true);
    setBytes(null);
    setFileId(null);
    setCfi(undefined);
    setToc([]);
    setPage(null);
    setTotal(null);
    setPercent(null);
    setError(null);
    try {
      const buf = await downloadArrayBuffer(token, id);
      setFileId(id);
      setBytes(buf);
      setCfi(loadProgress(id));
    } catch (e: any) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }

  // persist settings when changed
  useEffect(() => { saveSettings(settings); }, [settings]);

  // save on tab close
  useEffect(() => {
    function onBeforeUnload() { if (fileId && cfi) saveProgress(fileId, cfi); }
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [fileId, cfi]);

  // keyboard shortcuts
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (!controlsRef.current) return;
      if (e.key === 'ArrowRight') { e.preventDefault(); controlsRef.current.next(); }
      if (e.key === 'ArrowLeft')  { e.preventDefault(); controlsRef.current.prev(); }
      if (e.key === '+' || e.key === '=') {
        e.preventDefault(); setSettings(s => ({ ...s, fontScale: Math.min(1.6, +(s.fontScale + 0.05).toFixed(2)) }));
      }
      if (e.key === '-') {
        e.preventDefault(); setSettings(s => ({ ...s, fontScale: Math.max(0.8, +(s.fontScale - 0.05).toFixed(2)) }));
      }
      if (e.key.toLowerCase() === 'd') { // toggle dark
        e.preventDefault(); setSettings(s => ({ ...s, theme: s.theme === 'dark' ? 'light' : 'dark' }));
      }
      if (e.key === 'Escape' && focusMode) {
        setFocusMode(false);
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [focusMode]);

  return (
    <>
      <Script src="https://accounts.google.com/gsi/client" async defer />

      {!focusMode && (
        <header style={{
            display:'flex', gap:12, alignItems:'center', padding:12,
            borderBottom:'1px solid #e5e5e5', position:'sticky', top:0,
            background:'#fff', zIndex:10
          }}>
          <h1 style={{ margin:0, fontSize:18 }}>DriveRead</h1>
          <nav role="menubar" style={{ marginLeft:'auto', display:'flex', gap:8, alignItems:'center' }}>
            {/* Page navigation buttons */}
            <button
              role="menuitem"
              type="button"
              aria-label="Previous page"
              onClick={() => controlsRef.current?.prev()}
              disabled={!bytes || (settings.flow || 'paginated') === 'scrolled-doc'}
              title="Previous (←)"
            >
              ◀ Prev
            </button>
            <button
              role="menuitem"
              type="button"
              aria-label="Next page"
              onClick={() => controlsRef.current?.next()}
              disabled={!bytes || (settings.flow || 'paginated') === 'scrolled-doc'}
              title="Next (→)"
            >
              Next ▶
            </button>

            {/* Settings Menu */}
            <div style={{ position: 'relative' }} ref={settingsMenuRef}>
              <button
                role="menuitem"
                type="button"
                aria-haspopup="dialog"
                aria-expanded={settingsOpen}
                onClick={() => setSettingsOpen(o => !o)}
              >
                Settings
              </button>
              {settingsOpen && (
                <div
                  role="dialog"
                  aria-label="View settings"
                  style={{
                    position: 'absolute', right: 0, top: 'calc(100% + 4px)',
                    background: '#fff', border: '1px solid #ddd', borderRadius: 8,
                    padding: 16, zIndex: 20, display: 'flex', flexDirection: 'column',
                    gap: 16, width: 280,
                  }}
                >
                  <div style={{ display:'flex', gap:8, alignItems:'center', justifyContent: 'space-between' }}>
                    <span>Theme</span>
                    <button onClick={() => setSettings(s => ({ ...s, theme: s.theme === 'dark' ? 'light' : 'dark' }))}>
                      {settings.theme === 'dark' ? 'Light' : 'Dark'}
                    </button>
                  </div>
                  <div style={{ display:'flex', gap:8, alignItems:'center', justifyContent: 'space-between' }}>
                    <span id="font-size-label">Font Size</span>
                    <div role="group" aria-labelledby="font-size-label" style={{ display:'flex', gap:4, alignItems:'center' }}>
                      <button onClick={() => setSettings(s => ({ ...s, fontScale: Math.max(0.8, +(s.fontScale - 0.05).toFixed(2)) }))}>−</button>
                      <span>{Math.round(settings.fontScale*100)}%</span>
                      <button onClick={() => setSettings(s => ({ ...s, fontScale: Math.min(1.6, +(s.fontScale + 0.05).toFixed(2)) }))}>+</button>
                    </div>
                  </div>
                  <div style={{ display:'flex', gap:8, alignItems:'center', justifyContent: 'space-between' }}>
                    <span id="line-height-label">Line Height</span>
                    <div role="group" aria-labelledby="line-height-label" style={{ display:'flex', gap:4, alignItems:'center' }}>
                      <button onClick={() => setSettings(s => ({ ...s, lineHeight: Math.max(1.2, +(s.lineHeight - 0.05).toFixed(2)) }))}>−</button>
                      <span>{settings.lineHeight.toFixed(2)}</span>
                      <button onClick={() => setSettings(s => ({ ...s, lineHeight: Math.min(2.0, +(s.lineHeight + 0.05).toFixed(2)) }))}>+</button>
                    </div>
                  </div>
                  <div style={{ display:'flex', gap:8, alignItems:'center', justifyContent: 'space-between' }}>
                    <label htmlFor="ff">Font Family</label>
                    <select id="ff" value={settings.fontFamily} onChange={(e) => setSettings(s => ({ ...s, fontFamily: e.target.value as any }))} style={{ padding:'6px 8px', border:'1px solid #e5e7eb', borderRadius:6 }}>
                      <option value="os">OS Default</option>
                      <option value="sans">Sans (system)</option>
                      <option value="serif">Serif</option>
                      <option disabled>────────</option>
                      <option value="opendyslexic">Open Dyslexic</option>
                      <option value="atkinson">Atkinson Hyperlegible</option>
                      <option value="roboto">Roboto</option>
                      <option value="robotomono">Roboto Mono</option>
                    </select>
                  </div>
                  <div style={{ display:'flex', gap:8, alignItems:'center', justifyContent: 'space-between' }}>
                    <label htmlFor="flow">Render Mode</label>
                    <select
                      id="flow"
                      value={settings.flow || 'paginated'}
                      onChange={(e) => setSettings(s => ({ ...s, flow: e.target.value as any }))}
                      style={{ padding:'6px 8px', border:'1px solid #e5e7eb', borderRadius:6 }}>
                      <option value="paginated">Paginated</option>
                      <option value="scrolled-doc">Scrolled</option>
                    </select>
                  </div>
                  <div style={{ display:'flex', gap:8, alignItems:'center', justifyContent: 'space-between' }}>
                    <span>Focus Mode</span>
                    <button type="button" onClick={() => { setFocusMode(true); setSettingsOpen(false); }} disabled={!bytes}>
                      Enable
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Sign in */}
            {!token && (
              <button role="menuitem" onClick={request} disabled={!ready} style={{ padding:'6px 10px' }}>
                Sign in with Google
              </button>
            )}
          </nav>


          <div style={{ display:'flex', gap:8, alignItems:'center', minWidth:140, justifyContent:'flex-end' }}>
            {(settings.flow || 'paginated') === 'paginated' && (
              <span style={{ color:'#6b7280' }}>
                {page && total ? `Page ${page} / ${total}` : '—'}
              </span>
            )}
            <span style={{ color:'#6b7280' }}>
              {percent !== null ? `${percent}%` : ''}
            </span>
          </div>
        </header>
      )}
      <div
        style={{
          display:'grid',
          gridTemplateColumns: focusMode ? '1fr' : '320px 280px 1fr',
          gap:16,
          padding:16,
          height:'calc(100vh - 58px)'
        }}
      >
        {/* Library */}
         {!focusMode && (
          <aside style={{ overflow:'auto', border:'1px solid #ddd', borderRadius:8, padding:8 }}>
            <h3 style={{ marginTop:0 }}>Your Drive EPUBs</h3>
            {!token && <p>Sign in to list files.</p>}
            {error && <p style={{ color:'#b00' }}>{error}</p>}
            {files.map(f => (
              <button
                key={f.id}
                onClick={() => openFile(f.id)}
                disabled={loading}
                style={{ display:'block', width:'100%', textAlign:'left', padding:'6px 8px', borderRadius:6, border:'1px solid #eee', marginBottom:6 }}>
                {f.name}
              </button>
            ))}
          </aside>
        )}
        {/* TOC */}
        {!focusMode && (
        <aside style={{ overflow:'auto', border:'1px solid #ddd', borderRadius:8, padding:8 }}>
          <h3 style={{ marginTop:0 }}>Contents</h3>
          {toc.length === 0 && <p style={{ color:'#888' }}>—</p>}
          {toc.map(item => (
            <button key={item.href}
              onClick={() => controlsRef.current?.goTo(item.href)}
              style={{ display:'block', width:'100%', textAlign:'left', padding:'6px 8px', borderRadius:6, border:'1px solid #eee', marginBottom:6 }}>
              {item.label}
            </button>
          ))}
        </aside>
        )}
        {/* Reader */}
        <main style={{ border:'1px solid #ddd', borderRadius:8, height:'100%', overflow:'hidden',
          position:'relative',
          background: settings.theme === 'dark' ? '#0b0f12' : '#fff' }}>
          {loading ? (
            <div style={{ height:'100%', display:'grid', placeItems:'center', color:'#888' }}>
              Loading book...
            </div>
          ) : bytes ? (
            <>
              <Reader
                bytes={bytes}
                startCfi={cfi}
                theme={settings.theme}
                fontScale={settings.fontScale}
                lineHeight={settings.lineHeight}
                fontFamily={settings.fontFamily}
                flow={settings.flow || 'paginated'}
                onRelocate={(loc: any) => {
                  const newCfi: string | undefined = loc?.start?.cfi;
                  if (newCfi) {
                    setCfi(newCfi);
                    if (fileId) debouncedSave(fileId, newCfi);
                  }
                  const p = loc?.start?.displayed?.page ?? null;
                  const t = loc?.start?.displayed?.total ?? null;
                  const pct = (typeof loc?.percentage === 'number')
                    ? Math.round(loc.percentage * 100)
                    : (p && t ? Math.round((p / t) * 100) : null);
                  setPage(p);
                  setTotal(t);
                  setPercent(pct);
                }}
                onToc={setToc}
                onReady={(c) => { controlsRef.current = c; }}
              />
              <div style={{ position:'absolute', bottom:10, right:10, display:'flex', gap:8 }}>
                {focusMode && (
                  <button onClick={() => setFocusMode(false)} title="Exit focus mode (Esc)">Exit Focus</button>
                )}
              </div>
            </>
          ) : (
            <div style={{ height:'100%', display:'grid', placeItems:'center', color:'#888' }}>
              Pick a book…
            </div>
          )}
        </main>
      </div>
    </>
  );
}
