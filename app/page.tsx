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
import AppShell from '@/src/components/AppShell';
import LaunchScreen from '@/src/components/LaunchScreen';
import ReaderToolbar from '@/src/components/ReaderToolbar';
import ContentsPanel from '@/src/components/ContentsPanel';

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
  const [tocOpen, setTocOpen] = useState(false);
  const [progress, setProgress] = useState<Progress>({});
  const [launch, setLaunch] = useState<DriveLaunchState>({ status: 'missing' });
  const [lifecycle, dispatchLifecycle] = useReducer(launchLifecycleReducer, { status: 'no-launch' } as LaunchLifecycle);
  const [selectedFile, setSelectedFile] = useState<DriveFileMetadata | null>(null);

  const saveTimer = useRef<number | null>(null);
  const controlsRef = useRef<Controls | null>(null);
  const settingsButtonRef = useRef<HTMLButtonElement>(null);
  const contentsButtonRef = useRef<HTMLButtonElement>(null);
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

  const currentChapter = currentHref ? toc.find(item => item.href.split('#')[0] === currentHref.split('#')[0])?.label : undefined;
  const loading = ['requesting-access', 'fetching-metadata', 'downloading'].includes(lifecycle.status);

  return (
    <AppShell theme={settings.theme}>
      <Script src="https://accounts.google.com/gsi/client" strategy="afterInteractive" onLoad={auth.scriptLoaded} onError={auth.scriptFailed} />
      {!focusMode && (
        <ReaderToolbar bookTitle={selectedFile?.name} chapterTitle={currentChapter} hasBook={Boolean(bytes)} paginated={settings.flow === 'paginated'} page={page} total={total} percent={percent} tocOpen={tocOpen} settingsOpen={settingsOpen} onContents={() => setTocOpen(true)} onSettings={() => setSettingsOpen(true)} onPrev={() => controlsRef.current?.prev()} onNext={() => controlsRef.current?.next()} onFocus={() => setFocusMode(true)} settingsButtonRef={settingsButtonRef} contentsButtonRef={contentsButtonRef} />
      )}
      <div className={`reader-workspace${focusMode ? ' is-focus-mode' : ''}`}>
        <main className="reader-surface">
          {loading ? (
            <div role="status" aria-live="polite" className="loading-state"><div><strong>{lifecycle.status === 'requesting-access' ? 'Requesting Google Drive access…' : lifecycle.status === 'fetching-metadata' ? 'Checking the selected book…' : `Downloading ${selectedFile?.name || 'your selected book'}…`}</strong><span>Please keep this page open.</span></div></div>
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
              {focusMode && <nav className="focus-controls" aria-label="Distraction-free reading controls"><button onClick={goToPrevChapter} disabled={!currentHref} aria-label="Previous chapter">← <span>Chapter</span></button><div className="focus-progress"><strong>{currentChapter || selectedFile?.name}</strong><span>{percent !== null ? `${percent}%` : ''}</span></div><button onClick={goToNextChapter} disabled={!currentHref} aria-label="Next chapter"><span>Chapter</span> →</button><button className="exit-focus" onClick={() => setFocusMode(false)} title="Exit distraction-free mode (Escape)">Exit focus <span aria-hidden="true">×</span></button></nav>}
            </>
          ) : (
            <LaunchScreen launch={launch} lifecycle={lifecycle} onRetry={retryLaunch} />
          )}
        </main>
      </div>
      <ContentsPanel open={tocOpen} items={toc} currentHref={currentHref} onSelect={href => controlsRef.current?.goTo(href)} onClose={() => setTocOpen(false)} returnFocusRef={contentsButtonRef} />
      <SettingsPanel open={settingsOpen} settings={settings} onChange={setSettings} onClose={() => setSettingsOpen(false)} canFocus={Boolean(bytes)} onFocusMode={() => { setFocusMode(true); setSettingsOpen(false); }} returnFocusRef={settingsButtonRef} />
    </AppShell>
  );
}
