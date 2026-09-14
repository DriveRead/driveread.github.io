import { RefObject, useEffect, useId, useRef, useState } from 'react';
import ReadingProgress from './ReadingProgress';

/* eslint-disable jsx-a11y/role-supports-aria-props -- Preserve the button's aria-pressed API while also exposing menu checkbox semantics. */

type Props = { bookTitle?: string; chapterTitle?: string; hasBook: boolean; page: number | null; total: number | null; locations: number | null; percent: number | null; tocOpen: boolean; settingsOpen: boolean; bookmarked: boolean; syncLabel: string; canGoBack: boolean; canGoForward: boolean; onContents: () => void; onFind: () => void; onCopyLocation: () => void; onBack: () => void; onForward: () => void; onSettings: () => void; onPrev: () => void; onNext: () => void; onPrevChapter: () => void; onNextChapter: () => void; onBookmark: () => void; onBookmarks: () => void; onBookInfo: () => void; onHelp: () => void; onSeek: (percentage: number) => void; onFocus: () => void; settingsButtonRef: RefObject<HTMLButtonElement>; contentsButtonRef: RefObject<HTMLButtonElement>; findButtonRef: RefObject<HTMLButtonElement>; bookmarksButtonRef: RefObject<HTMLButtonElement>; infoButtonRef: RefObject<HTMLButtonElement> };

export default function ReaderToolbar(p: Props) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuId = useId();
  const menuRef = useRef<HTMLDivElement>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);

  const menuItems = () => Array.from(menuRef.current?.querySelectorAll<HTMLButtonElement>('[role^="menuitem"]:not(:disabled)') || []);
  const closeMenu = (restoreFocus = true) => {
    setMenuOpen(false);
    if (restoreFocus) requestAnimationFrame(() => menuButtonRef.current?.focus());
  };
  const runMenuAction = (action: () => void) => {
    closeMenu(false);
    action();
  };

  const toggleMenu = () => {
    if (menuOpen) closeMenu();
    else {
      setMenuOpen(true);
      requestAnimationFrame(() => menuItems()[0]?.focus());
    }
  };

  useEffect(() => {
    if (!menuOpen) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!menuRef.current?.contains(event.target as Node) && !menuButtonRef.current?.contains(event.target as Node)) closeMenu(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [menuOpen]);

  const onMenuKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const items = menuItems();
    const index = items.indexOf(document.activeElement as HTMLButtonElement);
    if (event.key === 'Escape') { event.preventDefault(); closeMenu(); }
    else if (event.key === 'Tab') {
      if (!items.length) return;
      if ((!event.shiftKey && index === items.length - 1) || (event.shiftKey && index <= 0)) {
        event.preventDefault();
        items[event.shiftKey ? items.length - 1 : 0].focus();
      }
    } else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      const offset = event.key === 'ArrowDown' ? 1 : -1;
      items[(index + offset + items.length) % items.length]?.focus();
    } else if (event.key === 'Home') { event.preventDefault(); items[0]?.focus(); }
    else if (event.key === 'End') { event.preventDefault(); items.at(-1)?.focus(); }
  };

  const menuTabIndex = menuOpen ? 0 : -1;
  return <header className="reader-toolbar">
    <div className="book-identity"><span className="toolbar-brand">DriveRead</span>{p.bookTitle && <><strong title={p.bookTitle}>{p.bookTitle}</strong>{p.chapterTitle && <span title={p.chapterTitle}>{p.chapterTitle}</span>}</>}</div>
    <div className="reader-actions" role="toolbar" aria-label="Reader controls">
      <button ref={p.contentsButtonRef} className="toolbar-button" onClick={p.onContents} aria-haspopup="dialog" aria-expanded={p.tocOpen} disabled={!p.hasBook}><span aria-hidden="true">☰</span><span className="button-label">Contents</span></button>
      <button ref={p.findButtonRef} className="toolbar-button" onClick={p.onFind} disabled={!p.hasBook} title="Find in book (Ctrl+F or Command+F)"><span aria-hidden="true">⌕</span><span className="button-label">Find</span></button>
      <button className="toolbar-button" onClick={p.onPrev} disabled={!p.hasBook} aria-label="Previous page" title="Previous page (Left arrow)"><span aria-hidden="true">←</span><span className="button-label">Previous</span></button>
      <button className="toolbar-button" onClick={p.onNext} disabled={!p.hasBook} aria-label="Next page" title="Next page (Right arrow)"><span className="button-label">Next</span><span aria-hidden="true">→</span></button>
      <div className="reader-overflow">
        <button ref={menuButtonRef} className="toolbar-button overflow-trigger" onClick={toggleMenu} aria-label="More reader actions" aria-haspopup="menu" aria-expanded={menuOpen} aria-controls={menuId}><span aria-hidden="true">•••</span></button>
        <div ref={menuRef} id={menuId} className={`reader-overflow-menu${menuOpen ? ' is-open' : ''}`} role="menu" aria-label="More reader actions" aria-hidden={!menuOpen} onKeyDown={onMenuKeyDown}>
          <button role="menuitem" tabIndex={menuTabIndex} className="history-control" onClick={() => runMenuAction(p.onBack)} disabled={!p.canGoBack} title="Back to previous location">↶ <span>Back</span></button>
          <button role="menuitem" tabIndex={menuTabIndex} className="history-control" onClick={() => runMenuAction(p.onForward)} disabled={!p.canGoForward} title="Forward to next location">↷ <span>Forward</span></button>
          <button role="menuitem" tabIndex={menuTabIndex} onClick={() => runMenuAction(p.onPrevChapter)} disabled={!p.hasBook} title="Previous chapter (Shift+Left)">⇤ <span>Previous chapter</span></button>
          <button role="menuitem" tabIndex={menuTabIndex} onClick={() => runMenuAction(p.onNextChapter)} disabled={!p.hasBook} title="Next chapter (Shift+Right)">⇥ <span>Next chapter</span></button>
          <button role="menuitemcheckbox" tabIndex={menuTabIndex} onClick={() => runMenuAction(p.onBookmark)} disabled={!p.hasBook} aria-checked={p.bookmarked} aria-pressed={p.bookmarked} title="Toggle bookmark (B)">{p.bookmarked ? '★' : '☆'} <span>Toggle bookmark</span></button>
          <button ref={p.bookmarksButtonRef} role="menuitem" tabIndex={menuTabIndex} onFocus={() => setMenuOpen(true)} onClick={() => runMenuAction(p.onBookmarks)} disabled={!p.hasBook} title="Bookmarks">Bookmarks</button>
          <button ref={p.infoButtonRef} role="menuitem" tabIndex={menuTabIndex} onFocus={() => setMenuOpen(true)} onClick={() => runMenuAction(p.onBookInfo)} disabled={!p.hasBook} title="Book information">Book information</button>
          <button role="menuitem" tabIndex={menuTabIndex} onClick={() => runMenuAction(p.onCopyLocation)} disabled={!p.hasBook} title="Copy location">Copy location</button>
          <button role="menuitem" tabIndex={menuTabIndex} onClick={() => runMenuAction(p.onFocus)} disabled={!p.hasBook} title="Enter distraction-free reading">⛶ <span>Focus mode</span></button>
          <button ref={p.settingsButtonRef} role="menuitem" tabIndex={menuTabIndex} onFocus={() => setMenuOpen(true)} onClick={() => runMenuAction(p.onSettings)} aria-haspopup="dialog" aria-expanded={p.settingsOpen}>Aa <span>Settings</span></button>
          <button role="menuitem" tabIndex={menuTabIndex} onClick={() => runMenuAction(p.onHelp)} title="Keyboard shortcuts (?)">? <span>Keyboard shortcuts</span></button>
        </div>
      </div>
    </div>
    <div className="toolbar-status"><ReadingProgress page={p.page} total={p.total} locations={p.locations} percent={p.percent} onSeek={p.onSeek} /><span className="sync-state" role="status">{p.syncLabel}</span></div>
  </header>;
}
