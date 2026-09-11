import { RefObject } from 'react';
import ReadingProgress from './ReadingProgress';

type Props = { bookTitle?: string; chapterTitle?: string; hasBook: boolean; page: number | null; total: number | null; locations: number | null; percent: number | null; tocOpen: boolean; settingsOpen: boolean; bookmarked: boolean; syncLabel: string; onContents: () => void; onSettings: () => void; onPrev: () => void; onNext: () => void; onPrevChapter: () => void; onNextChapter: () => void; onBookmark: () => void; onBookmarks: () => void; onHelp: () => void; onSeek: (percentage: number) => void; onFocus: () => void; settingsButtonRef: RefObject<HTMLButtonElement>; contentsButtonRef: RefObject<HTMLButtonElement> };
export default function ReaderToolbar(p: Props) {
  return <header className="reader-toolbar">
    <div className="book-identity"><span className="toolbar-brand">DriveRead</span>{p.bookTitle && <><strong title={p.bookTitle}>{p.bookTitle}</strong>{p.chapterTitle && <span title={p.chapterTitle}>{p.chapterTitle}</span>}</>}</div>
    <div className="reader-actions" role="toolbar" aria-label="Reader controls">
      <button ref={p.contentsButtonRef} className="toolbar-button" onClick={p.onContents} aria-haspopup="dialog" aria-expanded={p.tocOpen} disabled={!p.hasBook}><span aria-hidden="true">☰</span><span className="button-label">Contents</span></button>
      <button className="toolbar-button" onClick={p.onPrev} disabled={!p.hasBook} aria-label="Previous page" title="Previous page (Left arrow)"><span aria-hidden="true">←</span><span className="button-label">Previous</span></button>
      <button className="toolbar-button" onClick={p.onNext} disabled={!p.hasBook} aria-label="Next page" title="Next page (Right arrow)"><span className="button-label">Next</span><span aria-hidden="true">→</span></button>
      <button className="toolbar-button" onClick={p.onPrevChapter} disabled={!p.hasBook} title="Previous chapter (Shift+Left)">⇤<span className="sr-only">Previous chapter</span></button>
      <button className="toolbar-button" onClick={p.onNextChapter} disabled={!p.hasBook} title="Next chapter (Shift+Right)">⇥<span className="sr-only">Next chapter</span></button>
      <button className="toolbar-button" onClick={p.onBookmark} disabled={!p.hasBook} aria-pressed={p.bookmarked} title="Toggle bookmark (B)">{p.bookmarked ? '★' : '☆'}<span className="sr-only">Toggle bookmark</span></button>
      <button className="toolbar-button" onClick={p.onBookmarks} disabled={!p.hasBook} title="Bookmarks">Bookmarks</button>
      <button className="toolbar-button focus-action" onClick={p.onFocus} disabled={!p.hasBook} aria-label="Enter distraction-free reading" title="Enter distraction-free reading"><span aria-hidden="true">⛶</span><span className="button-label">Focus</span></button>
      <button ref={p.settingsButtonRef} className="toolbar-button" onClick={p.onSettings} aria-haspopup="dialog" aria-expanded={p.settingsOpen}><span aria-hidden="true">Aa</span><span className="button-label">Settings</span></button>
      <button className="toolbar-button" onClick={p.onHelp} aria-label="Keyboard shortcuts" title="Keyboard shortcuts (?)">?</button>
    </div>
    <div className="toolbar-status"><ReadingProgress page={p.page} total={p.total} locations={p.locations} percent={p.percent} onSeek={p.onSeek} /><span className="sync-state" role="status">{p.syncLabel}</span></div>
  </header>;
}
