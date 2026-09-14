'use client';
import Script from 'next/script';
import { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import { useGoogleToken } from '@/src/hooks/useGoogleToken';
import { downloadEpub, DriveError, loadRemoteProgress, saveRemoteProgress, type DriveFileMetadata } from '@/src/lib/drive';
import { parseDriveLaunchState, type DriveLaunchState } from '@/src/lib/driveLaunch';
import { launchLifecycleReducer, type LaunchErrorKind, type LaunchLifecycle } from '@/src/lib/launchLifecycle';
import { DEFAULT_SETTINGS, loadSettings, saveSettings } from '@/src/lib/settings';
import { addBookmark, loadAllLocalProgress, saveAllLocalProgress, mergeProgress, removeBookmark, READING_RECORD_VERSION, type Progress } from '@/src/lib/progress';
import { adjacentChapter, flattenToc, isEditableTarget } from '@/src/lib/readerNavigation';
import type { Settings } from '@/src/lib/settings';
import type { ContextualPanelId } from '@/src/lib/settings';
import { panelReducer, restorePanel, PINNED_PANEL_MIN_WIDTH } from '@/src/lib/contextualPanel';
import ContextualPanel from '@/src/components/ContextualPanel';
import Reader, { type ReaderControls } from '@/src/components/Reader';
import SettingsPanel from '@/src/components/settings/SettingsPanel';
import AppShell from '@/src/components/AppShell';
import LaunchScreen from '@/src/components/LaunchScreen';
import ReaderToolbar from '@/src/components/ReaderToolbar';
import ContentsPanel from '@/src/components/ContentsPanel';
import type { TocItem } from '@/src/components/ContentsPanel';
import { ShortcutsDialog } from '@/src/components/ReaderDialogs';
import FindPanel from '@/src/components/FindPanel';
import type { SearchResult } from '@/src/lib/readerSearch';
import { isFindShortcut } from '@/src/lib/readerSearch';
import { emptyReaderHistory, recordLocation, traverseHistory, type ReaderHistory } from '@/src/lib/readerHistory';

const isDebug = typeof window !== 'undefined' && window.location.search.includes('debug=true');

type SyncState = 'local' | 'syncing' | 'synced' | 'failed';

export default function Home() {
  const auth = useGoogleToken();
  const { token } = auth;
  const [bytes, setBytes] = useState<ArrayBuffer | null>(null);
  const [fileId, setFileId] = useState<string | null>(null);
  const [cfi, setCfi] = useState<string | undefined>();
  const [currentHref, setCurrentHref] = useState<string | null>(null);
  const [toc, setToc] = useState<TocItem[]>([]);
  const [settings, setSettings] = useState<Settings>(() => ({ ...DEFAULT_SETTINGS }));
  const [page, setPage] = useState<number | null>(null);
  const [total, setTotal] = useState<number | null>(null);
  const [percent, setPercent] = useState<number | null>(null);
  const [locations, setLocations] = useState<number | null>(null);
  const [focusMode, setFocusMode] = useState(false);
  const [panel, dispatchPanel] = useReducer(panelReducer, { active: null, pinned: false });
  const [widePanelViewport, setWidePanelViewport] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [syncState, setSyncState] = useState<SyncState>('local');
  const [progress, setProgress] = useState<Progress>({});
  const [launch, setLaunch] = useState<DriveLaunchState>({ status: 'missing' });
  const [lifecycle, dispatchLifecycle] = useReducer(launchLifecycleReducer, { status: 'no-launch' } as LaunchLifecycle);
  const [selectedFile, setSelectedFile] = useState<DriveFileMetadata | null>(null);
  const [findQuery, setFindQuery] = useState('');
  const [findResults, setFindResults] = useState<SearchResult[]>([]);
  const [findCurrent, setFindCurrent] = useState(-1);
  const [findSearching, setFindSearching] = useState(false);
  const [history, setHistory] = useState<ReaderHistory>(emptyReaderHistory);
  const [copyAnnouncement, setCopyAnnouncement] = useState('');

  const saveTimer = useRef<number | null>(null);
  const controlsRef = useRef<ReaderControls | null>(null);
  const progressRef = useRef<Progress>({});
  const pendingSync = useRef(false);
  const settingsButtonRef = useRef<HTMLButtonElement>(null);
  const contentsButtonRef = useRef<HTMLButtonElement>(null);
  const bookmarksButtonRef = useRef<HTMLButtonElement>(null);
  const infoButtonRef = useRef<HTMLButtonElement>(null);
  const findButtonRef = useRef<HTMLButtonElement>(null);
  const helpButtonRef = useRef<HTMLButtonElement>(null);
  const findRequestRef = useRef(0);
  const [settingsHydrated, setSettingsHydrated] = useState(false);

  useEffect(() => {
    const local = loadAllLocalProgress();
    progressRef.current = local;
    setProgress(local);
  }, []);

  function goToPrevChapter() {
    const target = adjacentChapter(toc, currentHref, -1);
    if (target) controlsRef.current?.goTo(target.href);
  }

  function goToNextChapter() {
    const target = adjacentChapter(toc, currentHref, 1);
    if (target) controlsRef.current?.goTo(target.href);
  }

  const changeFindQuery = (query: string) => {
    setFindQuery(query); setFindCurrent(-1);
    const requestId = ++findRequestRef.current;
    controlsRef.current?.cancelSearch();
    if (!query.trim()) { setFindResults([]); setFindSearching(false); controlsRef.current?.clearSearch(); return; }
    setFindSearching(true);
    controlsRef.current?.search(query, requestId).then(response => {
      if (response.stale || response.requestId !== findRequestRef.current) return;
      setFindResults(response.results); setFindSearching(false);
    }).catch(() => { if (requestId === findRequestRef.current) { setFindResults([]); setFindSearching(false); } });
  };
  const showFindResult = async (index: number) => { const selected = await controlsRef.current?.showSearchResult(index); if (typeof selected === 'number') setFindCurrent(selected); };
  const moveFindResult = async (direction: -1 | 1) => { const selected = await (direction === 1 ? controlsRef.current?.nextSearchResult() : controlsRef.current?.previousSearchResult()); if (typeof selected === 'number') setFindCurrent(selected); };
  const clearFind = () => { findRequestRef.current += 1; controlsRef.current?.clearSearch(); setFindQuery(''); setFindResults([]); setFindCurrent(-1); setFindSearching(false); };
  const moveHistory = (direction: -1 | 1) => setHistory(value => { const moved = traverseHistory(value, direction); if (moved.cfi) void controlsRef.current?.goTo(moved.cfi); return moved.history; });
  const copyLocation = async () => {
    if (!cfi) return;
    try { if (!navigator.clipboard?.writeText) throw new Error('Clipboard unavailable'); await navigator.clipboard.writeText(cfi); setCopyAnnouncement('Location copied.'); }
    catch { setCopyAnnouncement('Could not copy the location. Copying is not supported by this browser.'); }
  };

  function persistProgress(next: Progress) {
    progressRef.current = next;
    setProgress(next);
    saveAllLocalProgress(next);
    pendingSync.current = true;
    setSyncState(token ? 'syncing' : 'local');
    if (token) saveRemoteProgress(token, next).then(() => { pendingSync.current = false; setSyncState('synced'); }).catch(() => setSyncState('failed'));
  }

  function debouncedSave(fid: string, newCfi: string, newPercentage: number | null) {
    if (saveTimer.current) window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(() => {
      const old = progressRef.current[fid];
      const newProgress: Progress = { ...progressRef.current, [fid]: { version: READING_RECORD_VERSION, cfi: newCfi, updated: Date.now(), ...(newPercentage !== null ? { percentage: newPercentage / 100 } : {}), bookmarks: old?.bookmarks || [], metadata: { ...old?.metadata, fileName: selectedFile?.name } } };
      persistProgress(newProgress);
    }, 1000);
  }

  function toggleBookmark() {
    if (!fileId || !cfi) return;
    const record = progressRef.current[fileId] || { version: READING_RECORD_VERSION, cfi, updated: Date.now(), bookmarks: [] };
    const exists = record.bookmarks.some(bookmark => bookmark.cfi === cfi);
    const nextRecord = exists ? removeBookmark(record, cfi) : addBookmark(record, { cfi, created: Date.now(), label: currentChapter || undefined });
    persistProgress({ ...progressRef.current, [fileId]: nextRecord });
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
          progressRef.current = merged;
          // Save merged back to local and remote to keep them in sync
          saveAllLocalProgress(merged);
          await saveRemoteProgress(token, merged);
          setSyncState('synced');
        } else {
          setProgress(local);
          progressRef.current = local;
          // if remote doesn't exist, upload local
          if (Object.keys(local).length > 0) {
            await saveRemoteProgress(token, local);
          }
        }
      } catch (e) {
        console.error("Failed to sync progress", e);
        const local = loadAllLocalProgress();
        setProgress(local); progressRef.current = local; pendingSync.current = true; setSyncState('failed');
      }
    }

    if (isDebug) console.log('page.tsx: Calling syncProgress with token.');
    syncProgress(token);
  }, [token]);

  useEffect(() => {
    if (!token) return;
    const retry = window.setInterval(() => {
      if (!pendingSync.current || document.visibilityState === 'hidden') return;
      setSyncState('syncing');
      saveRemoteProgress(token, progressRef.current).then(() => { pendingSync.current = false; setSyncState('synced'); }).catch(() => setSyncState('failed'));
    }, 15000);
    return () => window.clearInterval(retry);
  }, [token]);

  useEffect(() => {
    // Load settings from localStorage on the client side only to avoid hydration mismatch
    const loaded = loadSettings();
    setSettings(loaded);
    const wide = window.innerWidth >= PINNED_PANEL_MIN_WIDTH;
    setWidePanelViewport(wide);
    const restored = restorePanel(loaded.panelPinned, loaded.lastPinnedPanel, wide);
    if (restored.active) dispatchPanel({ type: 'open', panel: restored.active, wide, preferPinned: true });
    setSettingsHydrated(true);
  }, []);

  useEffect(() => {
    const media = window.matchMedia(`(min-width: ${PINNED_PANEL_MIN_WIDTH}px)`);
    const update = () => { setWidePanelViewport(media.matches); dispatchPanel({ type: 'viewport', wide: media.matches }); };
    media.addEventListener('change', update); return () => media.removeEventListener('change', update);
  }, []);
  
  async function openFile(id: string) {
    if (!token) return;
    if (isDebug) console.log(`page.tsx: Opening file with id: ${id}`);
    dispatchLifecycle({ type: 'AUTHENTICATED' });
    controlsRef.current = null;
    setBytes(null);
    setFileId(null);
    setCfi(undefined);
    setToc([]);
    setPage(null);
    setTotal(null);
    setPercent(null);
    setLocations(null);
    setHistory(emptyReaderHistory()); clearFind();
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

  const openPanel = (active: ContextualPanelId) => {
    dispatchPanel({ type: 'open', panel: active, wide: widePanelViewport });
    if (panel.pinned && widePanelViewport) setSettings(value => ({ ...value, panelPinned: true, lastPinnedPanel: active }));
  };
  const closePanel = useCallback(() => {
    dispatchPanel({ type: 'close' });
    if (panel.pinned) setSettings(value => ({ ...value, panelPinned: false, lastPinnedPanel: null }));
  }, [panel.pinned]);
  const pinPanel = () => {
    if (!panel.active || !widePanelViewport) return;
    dispatchPanel({ type: 'pin', wide: true });
    setSettings(value => ({ ...value, panelPinned: true, lastPinnedPanel: panel.active }));
  };
  const unpinPanel = () => {
    dispatchPanel({ type: 'unpin' });
    setSettings(value => ({ ...value, panelPinned: false }));
  };

  const currentChapter = currentHref ? flattenToc(toc).find(item => item.href.split('#')[0] === currentHref.split('#')[0])?.label : undefined;
  const currentBookmarks = fileId ? progress[fileId]?.bookmarks || [] : [];
  const bookmarked = Boolean(cfi && currentBookmarks.some(bookmark => bookmark.cfi === cfi));
  const syncLabel = syncState === 'local' ? 'Saved locally' : syncState === 'syncing' ? 'Syncing…' : syncState === 'synced' ? 'Synced' : 'Sync failed · saved locally';

  // keyboard shortcuts
  // Handler intentionally follows live reader state so chapter/bookmark shortcuts stay current.
  /* eslint-disable react-hooks/exhaustive-deps */
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (controlsRef.current && isFindShortcut(e)) { e.preventDefault(); openPanel('find'); return; }
      if (isEditableTarget(e.target)) return;
      if (e.key === 'Escape') { setHelpOpen(false); if (!panel.pinned) closePanel(); setFocusMode(false); return; }
      if (e.key === '?') { e.preventDefault(); setHelpOpen(true); return; }
      if (!controlsRef.current) return;
      if (e.key === 'ArrowRight') { e.preventDefault(); e.shiftKey ? goToNextChapter() : controlsRef.current.next(); }
      if (e.key === 'ArrowLeft')  { e.preventDefault(); e.shiftKey ? goToPrevChapter() : controlsRef.current.prev(); }
      if (e.key.toLowerCase() === 'c') { e.preventDefault(); openPanel('contents'); }
      if (e.key.toLowerCase() === 's') { e.preventDefault(); openPanel('settings'); }
      if (e.key.toLowerCase() === 'b') { e.preventDefault(); toggleBookmark(); }
      if (e.key.toLowerCase() === 'f') { e.preventDefault(); setFocusMode(value => !value); }
      if (e.key === '+' || e.key === '=') {
        e.preventDefault(); setSettings(s => ({ ...s, fontSize: Math.min(200, s.fontSize + 5) }));
      }
      if (e.key === '-') {
        e.preventDefault(); setSettings(s => ({ ...s, fontSize: Math.max(75, s.fontSize - 5) }));
      }
      if (e.key.toLowerCase() === 'd') { // toggle dark
        e.preventDefault(); setSettings(s => ({ ...s, theme: s.theme === 'dark' ? 'light' : 'dark' }));
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [focusMode, currentHref, toc, cfi, fileId, currentChapter, token, panel.pinned, widePanelViewport]);
  /* eslint-enable react-hooks/exhaustive-deps */
  const loading = ['requesting-access', 'fetching-metadata', 'downloading'].includes(lifecycle.status);

  return (
    <AppShell theme={settings.theme}>
      <Script src="https://accounts.google.com/gsi/client" strategy="afterInteractive" onLoad={auth.scriptLoaded} onError={auth.scriptFailed} />
      {!focusMode && (
        <ReaderToolbar bookTitle={selectedFile?.name} chapterTitle={currentChapter} hasBook={Boolean(bytes)} page={page} total={total} locations={locations} percent={percent} tocOpen={panel.active === 'contents'} settingsOpen={panel.active === 'settings'} bookmarked={bookmarked} syncLabel={syncLabel} canGoBack={history.index > 0} canGoForward={history.index >= 0 && history.index < history.entries.length - 1} onContents={() => openPanel('contents')} onFind={() => openPanel('find')} onCopyLocation={copyLocation} onBack={() => moveHistory(-1)} onForward={() => moveHistory(1)} onSettings={() => openPanel('settings')} onPrev={() => controlsRef.current?.prev()} onNext={() => controlsRef.current?.next()} onPrevChapter={goToPrevChapter} onNextChapter={goToNextChapter} onBookmark={toggleBookmark} onBookmarks={() => openPanel('bookmarks')} onBookInfo={() => openPanel('book-info')} onHelp={() => setHelpOpen(true)} onSeek={value => controlsRef.current?.goToPercentage(value / 100)} onFocus={() => setFocusMode(true)} settingsButtonRef={settingsButtonRef} contentsButtonRef={contentsButtonRef} findButtonRef={findButtonRef} bookmarksButtonRef={bookmarksButtonRef} infoButtonRef={infoButtonRef} helpButtonRef={helpButtonRef} />
      )}
      <div className={`reader-layout${panel.pinned ? ' has-pinned-panel' : ''}`}>
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
                onFindShortcut={() => openPanel('find')}
                onRelocate={(loc) => {
                  const newCfi: string | undefined = loc?.start?.cfi;
                  if (newCfi) {
                    setCfi(newCfi);
                    setHistory(value => recordLocation(value, newCfi));
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
                  setLocations(loc.totalLocations ?? null);
                  if (newCfi && fileId) debouncedSave(fileId, newCfi, pct);
                }}
                onToc={setToc}
                onReady={(controls) => {
                  controlsRef.current = controls;
                  if (controls) controls.generateLocations().then(setLocations);
                }}
              />
              {focusMode && <nav className="focus-controls" aria-label="Distraction-free reading controls"><button onClick={goToPrevChapter} disabled={!currentHref} aria-label="Previous chapter">← <span>Chapter</span></button><div className="focus-progress"><strong>{currentChapter || selectedFile?.name}</strong><span>{percent !== null ? `${percent}%` : ''}</span></div><button onClick={goToNextChapter} disabled={!currentHref} aria-label="Next chapter"><span>Chapter</span> →</button><button className="exit-focus" onClick={() => setFocusMode(false)} title="Exit distraction-free mode (Escape)">Exit focus <span aria-hidden="true">×</span></button></nav>}
            </>
          ) : (
            <LaunchScreen launch={launch} lifecycle={lifecycle} onRetry={retryLaunch} />
          )}
        </main>
      </div>
      <ContextualPanel open={Boolean(panel.active)} pinned={panel.pinned} title={panel.active === 'settings' ? 'Reading settings' : panel.active === 'contents' ? 'Contents' : panel.active === 'find' ? 'Find in book' : panel.active === 'bookmarks' ? 'Bookmarks' : 'Book information'} side="end" openerRef={panel.active === 'settings' ? settingsButtonRef : panel.active === 'contents' ? contentsButtonRef : panel.active === 'find' ? findButtonRef : panel.active === 'bookmarks' ? bookmarksButtonRef : infoButtonRef} onPin={pinPanel} onUnpin={unpinPanel} onClose={closePanel}>
        {panel.active === 'contents' && <ContentsPanel items={toc} currentHref={currentHref} onSelect={href => { controlsRef.current?.goTo(href); if (!panel.pinned) closePanel(); }} />}
        {panel.active === 'find' && <FindPanel query={findQuery} results={findResults} current={findCurrent} searching={findSearching} onQuery={changeFindQuery} onPrevious={() => moveFindResult(-1)} onNext={() => moveFindResult(1)} onClear={clearFind} onSelect={showFindResult} />}
        {panel.active === 'settings' && <SettingsPanel settings={settings} onChange={setSettings} canFocus={Boolean(bytes)} onFocusMode={() => { setFocusMode(true); closePanel(); }} />}
        {panel.active === 'bookmarks' && <div className="panel-body">{currentBookmarks.length ? <ul className="bookmark-list">{currentBookmarks.map(bookmark => <li key={bookmark.cfi}><button onClick={() => { controlsRef.current?.goTo(bookmark.cfi); if (!panel.pinned) closePanel(); }}>{bookmark.label || new Date(bookmark.created).toLocaleString()}</button><button aria-label={`Remove ${bookmark.label || 'bookmark'}`} onClick={() => { if (fileId && progressRef.current[fileId]) persistProgress({ ...progressRef.current, [fileId]: removeBookmark(progressRef.current[fileId], bookmark.cfi) }); }}>Remove</button></li>)}</ul> : <p className="empty-state">No bookmarks yet.</p>}</div>}
        {panel.active === 'book-info' && <dl className="book-information panel-body"><dt>Title</dt><dd>{selectedFile?.name || 'Unknown'}</dd><dt>Current chapter</dt><dd>{currentChapter || 'Unknown'}</dd><dt>Progress</dt><dd>{percent === null ? 'Not available' : `${percent}%`}</dd></dl>}
      </ContextualPanel>
      </div>
      <p className="sr-only" role="status" aria-live="polite">{copyAnnouncement}</p>
      <ShortcutsDialog open={helpOpen} onClose={() => setHelpOpen(false)} openerRef={helpButtonRef} />
    </AppShell>
  );
}
