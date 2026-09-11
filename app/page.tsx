'use client';
import Script from 'next/script';
import { useEffect, useRef, useState } from 'react';
import { useGoogleToken } from '@/src/hooks/useGoogleToken';
import { downloadEpub, loadRemoteProgress, saveRemoteProgress, type DriveFileMetadata } from '@/src/lib/drive';
import { parseDriveLaunchState, type DriveLaunchState } from '@/src/lib/driveLaunch';
import { loadSettings, saveSettings } from '@/src/lib/settings';
import { loadAllLocalProgress, saveAllLocalProgress, mergeProgress, type Progress } from '@/src/lib/progress';
import type { Settings } from '@/src/lib/settings';
import Reader from '@/src/components/Reader';

const isDebug = typeof window !== 'undefined' && window.location.search.includes('debug=true');

type Controls = { goTo: (t: string) => Promise<void>; next: () => Promise<void>; prev: () => Promise<void> };

export default function Home() {
  const { token, ready, request } = useGoogleToken();
  const [bytes, setBytes] = useState<ArrayBuffer | null>(null);
  const [fileId, setFileId] = useState<string | null>(null);
  const [cfi, setCfi] = useState<string | undefined>();
  const [currentHref, setCurrentHref] = useState<string | null>(null);
  const [toc, setToc] = useState<Array<{ href: string; label: string }>>([]);
  const [settings, setSettings] = useState<Settings>({ theme: 'light', fontScale: 1.0, lineHeight: 1.5, fontFamily: 'os' });
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState<number | null>(null);
  const [total, setTotal] = useState<number | null>(null);
  const [percent, setPercent] = useState<number | null>(null);
  const [focusMode, setFocusMode] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState<Progress>({});
  const [launch, setLaunch] = useState<DriveLaunchState>({ status: 'missing' });
  const [pendingDriveFileId, setPendingDriveFileId] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<DriveFileMetadata | null>(null);

  const saveTimer = useRef<number | null>(null);
  const controlsRef = useRef<Controls | null>(null);
  const settingsMenuRef = useRef<HTMLDivElement>(null);

  function goToPrevChapter() {
    if (!currentHref || toc.length === 0) return;
    const base = (h: string) => h.split('#')[0];
    const idx = toc.findIndex(i => base(i.href) === base(currentHref));
    if (idx > 0) {
      controlsRef.current?.goTo(toc[idx - 1].href);
    }
  }

  function goToNextChapter() {
    if (!currentHref || toc.length === 0) return;
    const base = (h: string) => h.split('#')[0];
    const idx = toc.findIndex(i => base(i.href) === base(currentHref));
    if (idx !== -1 && idx + 1 < toc.length) {
      controlsRef.current?.goTo(toc[idx + 1].href);
    }
  }

  function debouncedSave(fid: string, newCfi: string) {
    if (saveTimer.current) window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(() => {
      const newProgress = { ...progress, [fid]: { cfi: newCfi, updated: Date.now() } };
      setProgress(newProgress);
      saveAllLocalProgress(newProgress);
      if (token) {
        saveRemoteProgress(token, newProgress).catch(e => console.error("Failed to save remote progress", e));
      }
    }, 1000);
  }

  // Handle files launched from Google Drive via "Open with DriveRead".
  useEffect(() => {
    const parsed = parseDriveLaunchState(new URLSearchParams(window.location.search).get('state'));
    setLaunch(parsed);
    if (parsed.status === 'valid') {
      setPendingDriveFileId(parsed.fileId);
    }
  }, []);

  // Automatically sign in when launched from Google Drive
useEffect(() => {
  if (
    pendingDriveFileId &&
    !token &&
    ready
  ) {
    request();
  }
}, [pendingDriveFileId, token, ready, request]);


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

    async function syncProgress(token: string) {
      try {
        const local = loadAllLocalProgress();
        const remote = await loadRemoteProgress(token);
        if (remote) {
          const merged = mergeProgress(local, remote);
          setProgress(merged);
          // Save merged back to local and remote to keep them in sync
          saveAllLocalProgress(merged);
          await saveRemoteProgress(token, merged);
        } else {
          setProgress(local);
          // if remote doesn't exist, upload local
          if (Object.keys(local).length > 0) {
            await saveRemoteProgress(token, local);
          }
        }
      } catch (e) {
        console.error("Failed to sync progress", e);
        setProgress(loadAllLocalProgress());
      }
    }

    if (isDebug) console.log('page.tsx: Calling syncProgress with token.');
    syncProgress(token);
  }, [token]);

  useEffect(() => {
    // Load settings from localStorage on the client side only to avoid hydration mismatch
    setSettings(loadSettings());
  }, []);
  
  async function openFile(id: string) {
    if (!token) return;
    if (isDebug) console.log(`page.tsx: Opening file with id: ${id}`);
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
      const { metadata, buffer } = await downloadEpub(token, id, setSelectedFile);
      setSelectedFile(metadata);
      if (isDebug) console.log(`page.tsx: File ${id} downloaded, buffer size: ${buffer.byteLength}`);
      setFileId(id);
      setBytes(buffer);
      setCfi(progress[id]?.cfi);
    } catch (e: any) {
      if (isDebug) console.error(`page.tsx: Error opening file ${id}:`, e);
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      if (isDebug) console.log(`page.tsx: Finished opening file ${id}`);
      setLoading(false);
    }
  }

// Open a file supplied by Google Drive once authentication is available
useEffect(() => {
  if (!token || !pendingDriveFileId) return;

  const id = pendingDriveFileId;
  setPendingDriveFileId(null);

  openFile(id);
}, [token, pendingDriveFileId]);
  
  // persist settings when changed
  useEffect(() => { saveSettings(settings); }, [settings]);

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
          <div style={{ minWidth: 0 }}><h1 style={{ margin:0, fontSize:18 }}>DriveRead</h1>{selectedFile && <div title={selectedFile.name} style={{ color:'#6b7280', fontSize:12, maxWidth:300, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{selectedFile.name}</div>}</div>
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

            {/* Chapter navigation buttons (work in all modes) */}
            <button
              role="menuitem"
              type="button"
              aria-label="Previous chapter"
              onClick={goToPrevChapter}
              disabled={!bytes || toc.length === 0 || !currentHref}
              title="Previous chapter"
            >
              Prev Chapter
            </button>
            <button
              role="menuitem"
              type="button"
              aria-label="Next chapter"
              onClick={goToNextChapter}
              disabled={!bytes || toc.length === 0 || !currentHref}
              title="Next chapter"
            >
              Next Chapter
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
          gridTemplateColumns: focusMode ? '1fr' : '280px minmax(0, 1fr)',
          gap:16,
          padding:16,
          height:'calc(100vh - 58px)'
        }}
      >
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
            <div role="status" style={{ height:'100%', display:'grid', placeItems:'center', color:'#6b7280', padding:32, textAlign:'center' }}>
              <div><strong style={{ display:'block', color:'#111827', marginBottom:8 }}>Downloading {selectedFile?.name || 'your selected book'}…</strong>DriveRead is securely fetching it from Google Drive.</div>
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
                  const newHref: string | undefined = loc?.start?.href;
                  setCurrentHref(newHref || null);
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
                  <>
                    <button onClick={goToPrevChapter} disabled={!bytes || toc.length === 0 || !currentHref} title="Previous chapter">Prev Chapter</button>
                    <button onClick={goToNextChapter} disabled={!bytes || toc.length === 0 || !currentHref} title="Next chapter">Next Chapter</button>
                    <button onClick={() => setFocusMode(false)} title="Exit focus mode (Esc)">Exit Focus</button>
                  </>
                )}
              </div>
            </>
          ) : (
            <div style={{ height:'100%', overflow:'auto', display:'grid', placeItems:'center', padding:'48px 24px', background:'linear-gradient(145deg, #f8fafc, #eef2ff)' }}>
              <section style={{ width:'min(620px, 100%)', background:'#fff', border:'1px solid #e2e8f0', borderRadius:20, padding:'clamp(24px, 5vw, 48px)', boxShadow:'0 18px 50px rgba(30, 41, 59, .10)' }}>
                <div style={{ color:'#4f46e5', fontWeight:700, letterSpacing:'.08em', fontSize:12, textTransform:'uppercase' }}>Your books, distraction-free</div>
                <h2 style={{ margin:'10px 0 12px', fontSize:'clamp(28px, 5vw, 40px)', lineHeight:1.1 }}>Read an EPUB from Google Drive</h2>
                {error || launch.status === 'invalid' ? (
                  <div role="alert" style={{ margin:'20px 0', padding:16, borderRadius:10, background:'#fef2f2', color:'#991b1b' }}>
                    <strong>We couldn’t open this book.</strong><div style={{ marginTop:5 }}>{error || (launch.status === 'invalid' && launch.message)}</div>
                  </div>
                ) : launch.status === 'valid' && !token ? (
                  <div role="status" style={{ margin:'20px 0', padding:16, borderRadius:10, background:'#eef2ff', color:'#3730a3' }}>
                    <strong>Waiting for Google authentication…</strong><div style={{ marginTop:5 }}>Sign in when prompted so DriveRead can access the selected book.</div>
                  </div>
                ) : (
                  <p style={{ color:'#475569', fontSize:17, lineHeight:1.6 }}>DriveRead opens only the book you choose. Start in Drive, then send one EPUB here with <strong>Open with</strong>.</p>
                )}
                <a href="https://drive.google.com/drive/my-drive" target="_blank" rel="noreferrer" style={{ display:'inline-block', margin:'12px 0 28px', padding:'12px 18px', borderRadius:9, background:'#4f46e5', color:'#fff', textDecoration:'none', fontWeight:700 }}>Open Google Drive ↗</a>
                <ol style={{ margin:0, paddingLeft:22, color:'#334155', lineHeight:1.8 }}>
                  <li>Find the EPUB you want to read in Google Drive.</li>
                  <li>Right-click it and choose <strong>Open with</strong>.</li>
                  <li>Select <strong>DriveRead</strong>; the book will open here.</li>
                </ol>
                {launch.status === 'missing' && <p style={{ margin:'24px 0 0', paddingTop:18, borderTop:'1px solid #e2e8f0', color:'#64748b', fontSize:14 }}>You visited DriveRead directly, so no file was selected. Choose one in Google Drive using the steps above.</p>}
              </section>
            </div>
          )}
        </main>
      </div>
    </>
  );
}
