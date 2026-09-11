'use client';
import { RefObject, useRef } from 'react';
import { useDialogFocus } from './useDialogFocus';

export type TocItem = { href: string; label: string };
export default function ContentsPanel({ open, items, currentHref, onSelect, onClose, returnFocusRef }: { open: boolean; items: TocItem[]; currentHref: string | null; onSelect: (href: string) => void; onClose: () => void; returnFocusRef: RefObject<HTMLElement> }) {
  const ref = useRef<HTMLElement>(null); useDialogFocus(open, ref, onClose, returnFocusRef);
  if (!open) return null;
  const base = (href: string) => href.split('#')[0];
  return <><button className="sheet-backdrop" tabIndex={-1} aria-label="Close contents" onClick={onClose} /><aside ref={ref} className="side-sheet sheet-left" role="dialog" aria-modal="true" aria-labelledby="contents-title">
    <header className="sheet-heading"><h2 id="contents-title">Contents</h2><button onClick={onClose} aria-label="Close contents">×</button></header>
    <nav aria-label="Book chapters" className="contents-list">{items.length ? items.map(item => <button key={item.href} aria-current={currentHref && base(item.href) === base(currentHref) ? 'location' : undefined} onClick={() => { onSelect(item.href); onClose(); }}>{item.label}</button>) : <p className="empty-state">No table of contents is available.</p>}</nav>
  </aside></>;
}
