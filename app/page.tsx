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

  const saveTimer = useRef<number | null>(null);
  const controlsRef = useRef<Controls | null>(null);

  function debouncedSave(fid: string, newCfi: string) {
    if (saveTimer.current) window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(() => saveProgress(fid, newCfi), 400);
  }

  useEffect(() => {
    if (!token) return;
    listEpubs(token).then(d => setFiles(d.files)).catch(e => setError(String(e)));
  }, [token]);

  async function openFile(id: string) {
    if (!token) return;
    try {
      const buf = await downloadArrayBuffer(token, id);
      setFileId(id);
      setBytes(buf);
      setCfi(loadProgress(id));
      setToc([]);
    } catch (e: any) {
      setError(String(e));
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
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <>
      <Script src="https://accounts.google.com/gsi/client" async defer />
      <header style={{
          display:'flex', gap:12, alignItems:'center', padding:12,
          borderBottom:'1px solid #e5e5e5', position:'sticky', top:0, background:'#fff', zIndex:10
        }}>
        <h1 style={{ margin:0, fontSize:18 }}>DriveRead</h1>
        <div style={{ marginLeft:'auto', display:'flex', gap:8, alignItems:'center' }}>
          <button onClick={() => setSettings(s => ({ ...s, theme: s.theme === 'dark' ? 'light' : 'dark' }))}>
            {settings.theme === 'dark' ? 'Light' : 'Dark'}
          </button>
          <div style={{ display:'flex', gap:4, alignItems:'center' }}>
            <span>Font</span>
            <button onClick={() => setSettings(s => ({ ...s, fontScale: Math.max(0.8, +(s.fontScale - 0.05).toFixed(2)) }))}>−</button>
            <span>{Math.round(settings.fontScale*100)}%</span>
            <button onClick={() => setSettings(s => ({ ...s, fontScale: Math.min(1.6, +(s.fontScale + 0.05).toFixed(2)) }))}>+</button>
          </div>
          <div style={{ display:'flex', gap:4, alignItems:'center' }}>
            <span>Line</span>
            <button onClick={() => setSettings(s => ({ ...s, lineHeight: Math.max(1.2, +(s.lineHeight - 0.05).toFixed(2)) }))}>−</button>
            <span>{settings.lineHeight.toFixed(2)}</span>
            <button onClick={() => setSettings(s => ({ ...s, lineHeight: Math.min(2.0, +(s.lineHeight + 0.05).toFixed(2)) }))}>+</button>
          </div>
          {!token && (
            <button onClick={request} disabled={!ready} style={{ padding:'6px 10px' }}>
              Sign in with Google
            </button>
          )}
        </div>
      </header>

      <div style={{ display:'grid', gridTemplateColumns:'320px 280px 1fr', gap:16, padding:16, height:'calc(100vh - 58px)' }}>
        {/* Library */}
        <aside style={{ overflow:'auto', border:'1px solid #ddd', borderRadius:8, padding:8 }}>
          <h3 style={{ marginTop:0 }}>Your Drive EPUBs</h3>
          {!token && <p>Sign in to list files.</p>}
          {error && <p style={{ color:'#b00' }}>{error}</p>}
          {files.map(f => (
            <button key={f.id} onClick={() => openFile(f.id)}
              style={{ display:'block', width:'100%', textAlign:'left', padding:'6px 8px', borderRadius:6, border:'1px solid #eee', marginBottom:6 }}>
              {f.name}
            </button>
          ))}
        </aside>

        {/* TOC */}
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

        {/* Reader */}
        <main style={{ border:'1px solid #ddd', borderRadius:8, height:'100%', overflow:'hidden',
          background: settings.theme === 'dark' ? '#0b0f12' : '#fff' }}>
          {bytes ? (
            <Reader
              bytes={bytes}
              startCfi={cfi}
              theme={settings.theme}
              fontScale={settings.fontScale}
              lineHeight={settings.lineHeight}
              onRelocate={(newCfi) => {
                setCfi(newCfi);
                if (fileId) debouncedSave(fileId, newCfi);
              }}
              onToc={setToc}
              onReady={(c) => { controlsRef.current = c; }}
            />
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
