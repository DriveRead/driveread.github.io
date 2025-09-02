// @ts-expect-error - epub.js types not bundled here
import ePub from 'epubjs';
import { useEffect, useRef } from 'react';

export default function Reader({
  bytes, startCfi, onRelocate,
}: { bytes: ArrayBuffer; startCfi?: string; onRelocate?: (cfi: string) => void; }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const book = ePub(bytes);
    const rendition = book.renderTo(ref.current!, { width: '100%', height: '100%' });
    rendition.display(startCfi || undefined);
    rendition.on('relocated', (loc: any) => onRelocate?.(loc?.start?.cfi));
    return () => {
      try { book?.destroy?.(); } catch {}
    };
  }, [bytes]);

  return <div ref={ref} style={{ width:'100%', height:'100%' }} />;
}
