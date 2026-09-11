'use client';
import Script from 'next/script';
import { useEffect, useReducer, useRef, useState } from 'react';
import { useGoogleToken } from '@/src/hooks/useGoogleToken';
import { downloadEpub, DriveError, loadRemoteProgress, saveRemoteProgress, type DriveFileMetadata } from '@/src/lib/drive';
import { parseDriveLaunchState, type DriveLaunchState } from '@/src/lib/driveLaunch';
import { launchLifecycleReducer, type LaunchErrorKind, type LaunchLifecycle } from '@/src/lib/launchLifecycle';
import { DEFAULT_SETTINGS, loadSettings, saveSettings } from '@/src/lib/settings';
import { loadAllLocalProgress, saveAllLocalProgress, mergeProgress, type Progress } from '@/src/lib/progress';
import type { Settings } from '@/src/lib/settings';
import Reader from '@/src/components/Reader';
import SettingsPanel from '@/src/components/settings/SettingsPanel';

const isDebug = typeof window !== 'undefined' && window.location.search.includes('debug=true');

type Controls = { goTo: (t: string) => Promise<void>; next: () => Promise<void>; prev: () => Promise<void> };

export default function Home() {
  const auth = useGoogleToken();
  const { token } = auth;
  const [bytes, setBytes] = useState<ArrayBuffer | null>(null);
  const [fileId, setFileId] = useState<string | null>(null);
  const [cfi, setCfi] = useState<string | undefined>();
  const [currentHref, setCurrentHref] = useState<string | null>(null);
  const [toc, setToc] = useState<Array<{ href: string; label: string }>>([]);
  const [settings, setSettings] = useState<Settings>(() => ({ ...DEFAULT_SETTINGS }));
  const [page, setPage] = useState<number | null>(null);
  const [total, setTotal] = useState<number | null>(null);
  const [percent, setPercent] = useState<number | null>(null);
  const [focusMode, setFocusMode] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [progress, setProgress] = useState<Progress>({});
  const [launch, setLaunch] = useState<DriveLaunchState>({ status: 'missing' });
  const [lifecycle, dispatchLifecycle] = useReducer(launchLifecycleReducer, { status: 'no-launch' } as LaunchLifecycle);
  const [selectedFile, setSelectedFile] = useState<DriveFileMetadata | null>(null);

  const saveTimer = useRef<number | null>(null);
  const controlsRef = useRef<Controls | null>(null);
  const settingsMenuRef = useRef<HTMLDivElement>(null);
  const [settingsHydrated, setSettingsHydrated] = useState(false);

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
      dispatchLifecycle({ type: 'VALID_LAUNCH', fileId: parsed.fileId });
    } else if (parsed.status === 'invalid') {
      dispatchLifecycle({ type: 'INVALID_LAUNCH', message: parsed.message });
    } else {
      dispatchLifecycle({ type: 'DIRECT_VISIT' });
    }
  }, []);

  // Automatically sign in when launched from Google Drive
useEffect(() => {
  if (
    lifecycle.status === 'awaiting-authentication' && auth.status === 'ready'
  ) {
    dispatchLifecycle({ type: 'REQUEST_ACCESS' });
    auth.request();
  }
// The hook exposes stable callbacks; depending on the whole discriminated object would retrigger requests.
// eslint-disable-next-line react-hooks/exhaustive-deps
}, [lifecycle.status, auth.status, auth.request]);

  useEffect(() => {
    if (auth.status !== 'error' || lifecycle.status === 'recoverable-error' || !('fileId' in lifecycle)) return;
    const kind: LaunchErrorKind = auth.error.kind === 'configuration' ? 'configuration' : auth.error.kind === 'permission-denied' ? 'permission-denied' : 'authentication';
    dispatchLifecycle({ type: 'ERROR', kind, message: auth.error.message, retry: 'authenticate' });
  }, [auth.status, auth.error, lifecycle]);


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
    setSettingsHydrated(true);
  }, []);
  
  async function openFile(id: string) {
    if (!token) return;
    if (isDebug) console.log(`page.tsx: Opening file with id: ${id}`);
    dispatchLifecycle({ type: 'AUTHENTICATED' });
    setBytes(null);
    setFileId(null);
    setCfi(undefined);
    setToc([]);
    setPage(null);
    setTotal(null);
    setPercent(null);
    try {
      const { metadata, buffer } = await downloadEpub(token, id, metadata => {
        setSelectedFile(metadata);
        dispatchLifecycle({ type: 'METADATA_LOADED' });
      });
      setSelectedFile(metadata);
      if (isDebug) console.log(`page.tsx: File ${id} downloaded, buffer size: ${buffer.byteLength}`);
      setFileId(id);
      setBytes(buffer);
      setCfi(progress[id]?.cfi);
      dispatchLifecycle({ type: 'OPENED' });
    } catch (e: unknown) {
      if (isDebug) console.error(`page.tsx: Error opening file ${id}:`, e);
      const driveError = e instanceof DriveError ? e : null;
      const kind: LaunchErrorKind = driveError?.code === 'unauthorized' ? 'authentication'
        : driveError?.code === 'permission-denied' ? 'permission-denied'
        : driveError?.code === 'missing-file' ? 'missing-file'
        : driveError?.code === 'invalid-response' ? 'invalid-file' : 'network';
      dispatchLifecycle({ type: 'ERROR', kind, message: driveError?.message || 'The book could not be opened. Please try the download again.', retry: driveError?.code === 'unauthorized' ? 'authenticate' : 'download' });
      if (driveError?.code === 'unauthorized') auth.clearToken();
    }
  }

// Open a file supplied by Google Drive once authentication is available
useEffect(() => {
  if (!token || lifecycle.status !== 'requesting-access') return;
  openFile(lifecycle.fileId);
// openFile intentionally runs once for each transition into requesting-access.
// eslint-disable-next-line react-hooks/exhaustive-deps
}, [token, lifecycle.status]);

  function retryLaunch() {
    if (lifecycle.status !== 'recoverable-error' || !lifecycle.fileId) return;
    if (lifecycle.retry === 'authenticate') {
      dispatchLifecycle({ type: 'REQUEST_ACCESS' });
      auth.retry();
    } else {
      openFile(lifecycle.fileId);
    }
  }
  
  // persist settings when changed
  useEffect(() => { if (settingsHydrated) saveSettings(settings); }, [settings, settingsHydrated]);

  // keyboard shortcuts
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (!controlsRef.current) return;
      if (e.key === 'ArrowRight') { e.preventDefault(); controlsRef.current.next(); }
      if (e.key === 'ArrowLeft')  { e.preventDefault(); controlsRef.current.prev(); }
      if (e.key === '+' || e.key === '=') {
        e.preventDefault(); setSettings(s => ({ ...s, fontSize: Math.min(200, s.fontSize + 5) }));
      }
      if (e.key === '-') {
        e.preventDefault(); setSettings(s => ({ ...s, fontSize: Math.max(75, s.fontSize - 5) }));
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
    <div className={`app-shell theme-${settings.theme}`} data-theme={settings.theme}>
      <Script src="https://accounts.google.com/gsi/client" strategy="afterInteractive" onLoad={auth.scriptLoaded} onError={auth.scriptFailed} />

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
              disabled={!bytes || settings.flow === 'scrolled-doc'}
              title="Previous (←)"
            >
              ◀ Prev
            </button>
            <button
              role="menuitem"
              type="button"
              aria-label="Next page"
              onClick={() => controlsRef.current?.next()}
              disabled={!bytes || settings.flow === 'scrolled-doc'}
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
              {settingsOpen && <SettingsPanel
                settings={settings}
                onChange={setSettings}
                onClose={() => setSettingsOpen(false)}
                canFocus={Boolean(bytes)}
                onFocusMode={() => { setFocusMode(true); setSettingsOpen(false); }}
              />}
            </div>

          </nav>


          <div style={{ display:'flex', gap:8, alignItems:'center', minWidth:140, justifyContent:'flex-end' }}>
            {settings.flow === 'paginated' && (
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
          background: settings.theme === 'dark' ? '#0b0f12' : settings.theme === 'sepia' ? '#f4ecd8' : '#fff' }}>
          {['requesting-access', 'fetching-metadata', 'downloading'].includes(lifecycle.status) ? (
            <div role="status" style={{ height:'100%', display:'grid', placeItems:'center', color:'#6b7280', padding:32, textAlign:'center' }}>
              <div><strong style={{ display:'block', color:'#111827', marginBottom:8 }}>{lifecycle.status === 'requesting-access' ? 'Requesting Google Drive access…' : lifecycle.status === 'fetching-metadata' ? 'Checking the selected book…' : `Downloading ${selectedFile?.name || 'your selected book'}…`}</strong>Please keep this page open.</div>
            </div>
          ) : bytes ? (
            <>
              <Reader
                bytes={bytes}
                startCfi={cfi}
                settings={settings}
                onRelocate={(loc) => {
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
                {lifecycle.status === 'recoverable-error' ? (
                  <div role="alert" style={{ margin:'20px 0', padding:16, borderRadius:10, background:'#fef2f2', color:'#991b1b' }}>
                    <strong>We couldn’t open this book.</strong><div style={{ marginTop:5 }}>{lifecycle.message}</div>
                    {lifecycle.fileId && <button type="button" onClick={retryLaunch} style={{ marginTop:12 }}>{lifecycle.retry === 'authenticate' ? 'Authenticate again' : 'Try download again'}</button>}
                  </div>
                ) : lifecycle.status === 'awaiting-authentication' || lifecycle.status === 'requesting-access' ? (
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
    </div>
  );
}
