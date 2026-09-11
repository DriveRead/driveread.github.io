import { RefObject } from 'react';
import ReadingProgress from './ReadingProgress';

type Props = { bookTitle?: string; chapterTitle?: string; hasBook: boolean; paginated: boolean; page: number | null; total: number | null; percent: number | null; tocOpen: boolean; settingsOpen: boolean; onContents: () => void; onSettings: () => void; onPrev: () => void; onNext: () => void; onFocus: () => void; settingsButtonRef: RefObject<HTMLButtonElement>; contentsButtonRef: RefObject<HTMLButtonElement> };
export default function ReaderToolbar(p: Props) {
  return <header className="reader-toolbar">
    <div className="book-identity"><span className="toolbar-brand">DriveRead</span>{p.bookTitle && <><strong title={p.bookTitle}>{p.bookTitle}</strong>{p.chapterTitle && <span title={p.chapterTitle}>{p.chapterTitle}</span>}</>}</div>
    <div className="reader-actions" role="toolbar" aria-label="Reader controls">
      <button ref={p.contentsButtonRef} className="toolbar-button" onClick={p.onContents} aria-haspopup="dialog" aria-expanded={p.tocOpen} disabled={!p.hasBook}><span aria-hidden="true">☰</span><span className="button-label">Contents</span></button>
      <button className="toolbar-button" onClick={p.onPrev} disabled={!p.hasBook || !p.paginated} aria-label="Previous page" title="Previous page (Left arrow)"><span aria-hidden="true">←</span><span className="button-label">Previous</span></button>
      <button className="toolbar-button" onClick={p.onNext} disabled={!p.hasBook || !p.paginated} aria-label="Next page" title="Next page (Right arrow)"><span className="button-label">Next</span><span aria-hidden="true">→</span></button>
      <button className="toolbar-button focus-action" onClick={p.onFocus} disabled={!p.hasBook} aria-label="Enter distraction-free reading" title="Enter distraction-free reading"><span aria-hidden="true">⛶</span><span className="button-label">Focus</span></button>
      <button ref={p.settingsButtonRef} className="toolbar-button" onClick={p.onSettings} aria-haspopup="dialog" aria-expanded={p.settingsOpen}><span aria-hidden="true">Aa</span><span className="button-label">Settings</span></button>
    </div>
    <ReadingProgress page={p.page} total={p.total} percent={p.percent} paginated={p.paginated} />
  </header>;
}
