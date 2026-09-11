'use client';
import { type ReactNode, type RefObject, useEffect, useRef } from 'react';

export default function ContextualPanel({ open, pinned, title, side = 'end', openerRef, onPin, onUnpin, onClose, children }: {
  open: boolean; pinned: boolean; title: string; side?: 'start' | 'end'; openerRef?: RefObject<HTMLElement>;
  onPin: () => void; onUnpin: () => void; onClose: () => void; children: ReactNode;
}) {
  const panelRef = useRef<HTMLElement>(null);
  const wasOpenRef = useRef(false);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const titleId = `contextual-${title.toLowerCase().replaceAll(' ', '-')}`;
  useEffect(() => {
    if (!open || !panelRef.current) return;
    const panel = panelRef.current;
    if (!wasOpenRef.current) previousFocusRef.current = document.activeElement as HTMLElement | null;
    const focusables = () => Array.from(panel.querySelectorAll<HTMLElement>('button:not([disabled]),a[href],input:not([disabled]),select:not([disabled]),[tabindex]:not([tabindex="-1"])'));
    if (!pinned) focusables()[0]?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !pinned) { event.preventDefault(); onClose(); return; }
      if (event.key !== 'Tab' || pinned || !matchMedia('(max-width: 1099px)').matches) return;
      const items = focusables(); if (!items.length) return;
      const first = items[0], last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, pinned, onClose, openerRef]);
  useEffect(() => {
    if (wasOpenRef.current && !open) (openerRef?.current || previousFocusRef.current)?.focus();
    wasOpenRef.current = open;
  }, [open, openerRef]);
  if (!open) return null;
  return <>
    {!pinned && <button className="sheet-backdrop" tabIndex={-1} aria-label={`Close ${title}`} onClick={onClose} />}
    <aside ref={panelRef} className={`contextual-panel side-sheet sheet-${side} ${pinned ? 'is-pinned' : 'is-temporary'}`} role={pinned ? 'complementary' : 'dialog'} aria-modal={pinned ? undefined : true} aria-labelledby={titleId}>
      <header className="sheet-heading"><h2 id={titleId}>{title}</h2><div className="panel-header-actions">
        <button className="pin-button" aria-pressed={pinned} title={pinned ? 'Unpin panel' : 'Keep panel open'} onClick={pinned ? onUnpin : onPin}><span aria-hidden="true">{pinned ? '◆' : '◇'}</span><span>{pinned ? 'Unpin' : 'Pin'}</span></button>
        <button onClick={onClose} aria-label={`Close ${title}`} title={`Close ${title}`}>× <span>Close</span></button>
      </div></header>{children}
    </aside>
  </>;
}
