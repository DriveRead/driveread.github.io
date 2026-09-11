'use client';
import { RefObject, useEffect, useRef } from 'react';

export function useDialogFocus(open: boolean, dialogRef: RefObject<HTMLElement>, onClose: () => void, returnFocusRef?: RefObject<HTMLElement>) {
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  useEffect(() => {
    if (!open || !dialogRef.current) return;
    const dialog = dialogRef.current;
    const previous = document.activeElement as HTMLElement | null;
    const returnTarget = returnFocusRef?.current;
    const selector = 'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';
    const elements = () => Array.from(dialog.querySelectorAll<HTMLElement>(selector));
    elements()[0]?.focus();
    const keydown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); onCloseRef.current(); return; }
      if (event.key !== 'Tab') return;
      const items = elements();
      if (!items.length) return;
      const first = items[0]; const last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', keydown);
    return () => { document.removeEventListener('keydown', keydown); (returnTarget || previous)?.focus(); };
  }, [open, dialogRef, returnFocusRef]);
}
