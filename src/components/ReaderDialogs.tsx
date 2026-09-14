'use client';
import { type RefObject, useRef } from 'react';
import type { Bookmark } from '@/src/lib/progress';
import { useDialogFocus } from './useDialogFocus';

const shortcuts = [
  ['← / →', 'Previous / next page'], ['Shift + ← / →', 'Previous / next chapter'],
  ['C', 'Open contents'], ['S', 'Open settings'], ['B', 'Toggle bookmark'],
  ['Ctrl/Command + F', 'Find in book'], ['F', 'Toggle focus mode'], ['?', 'Show this help'], ['Escape', 'Close a dialog or exit focus mode'],
];

export function ShortcutsDialog({ open, onClose, openerRef }: { open: boolean; onClose: () => void; openerRef: RefObject<HTMLButtonElement> }) {
  const dialogRef = useRef<HTMLDivElement>(null);
  useDialogFocus(open, dialogRef, onClose, openerRef);

  if (!open) return null;
  return <><button className="sheet-backdrop" tabIndex={-1} aria-label="Close keyboard shortcuts" onClick={onClose} /><div ref={dialogRef} className="reader-dialog" role="dialog" aria-modal="true" aria-labelledby="shortcuts-title"><header className="sheet-heading"><h2 id="shortcuts-title">Keyboard shortcuts</h2><button onClick={onClose} aria-label="Close">×</button></header><dl className="shortcut-list">{shortcuts.map(([keys, action]) => <div key={keys}><dt><kbd>{keys}</kbd></dt><dd>{action}</dd></div>)}</dl></div></>;
}

export function BookmarksDialog({ open, bookmarks, onSelect, onRemove, onRestart, onClose }: { open: boolean; bookmarks: Bookmark[]; onSelect: (cfi: string) => void; onRemove: (cfi: string) => void; onRestart: () => void; onClose: () => void }) {
  if (!open) return null;
  return <><button className="sheet-backdrop" aria-label="Close bookmarks" onClick={onClose} /><div className="reader-dialog" role="dialog" aria-modal="true" aria-labelledby="bookmarks-title"><header className="sheet-heading"><h2 id="bookmarks-title">Bookmarks</h2><button onClick={onClose} aria-label="Close">×</button></header>{bookmarks.length ? <ul className="bookmark-list">{bookmarks.map(bookmark => <li key={bookmark.cfi}><button onClick={() => { onSelect(bookmark.cfi); onClose(); }}>{bookmark.label || new Date(bookmark.created).toLocaleString()}</button><button aria-label={`Remove ${bookmark.label || 'bookmark'}`} onClick={() => onRemove(bookmark.cfi)}>Remove</button></li>)}</ul> : <p className="empty-state">No bookmarks yet.</p>}<footer className="dialog-footer"><button className="danger-button" onClick={() => { if (window.confirm('Restart this book from the beginning? Your bookmarks will be kept.')) { onRestart(); onClose(); } }}>Restart book…</button></footer></div></>;
}
