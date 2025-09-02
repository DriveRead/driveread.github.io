import ePub from 'epubjs';
import { useEffect, useRef } from 'react';
import type { Theme } from '@/src/lib/settings';

type Controls = {
  goTo: (hrefOrCfi: string) => Promise<void>;
  next: () => Promise<void>;
  prev: () => Promise<void>;
};

export default function Reader({
  bytes,
  startCfi,
  onRelocate,        // now sends the full 'loc' object
  onToc,
  onReady,
  theme = 'light',
  fontScale = 1.0,
  lineHeight = 1.5,
}: {
  bytes: ArrayBuffer;
  startCfi?: string;
  onRelocate?: (loc: any) => void;   // <— changed type
  onToc?: (items: Array<{ href: string; label: string }>) => void;
  onReady?: (controls: Controls) => void;
  theme?: Theme;
  fontScale?: number;
  lineHeight?: number;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const renditionRef = useRef<any>(null);
  const bookRef = useRef<any>(null);

  useEffect(() => {
    const book = ePub(bytes);
    bookRef.current = book;

    const rendition = book.renderTo(containerRef.current!, {
      width: '100%',
      height: '100%',
      flow: 'paginated',
      manager: 'default',
      spread: 'auto',
    });
    renditionRef.current = rendition;

    // Themes
    rendition.themes.register('light', {
      body: { background: '#ffffff', color: '#111' },
      'img, image': { filter: 'none' },
    });
    rendition.themes.register('dark', {
      body: { background: '#0b0f12', color: '#e7e7e7' },
      'img, image': { filter: 'brightness(0.85)' },
    });

    rendition.display(startCfi || undefined);

    // Emit full 'loc' so the page can compute page/percent & save CFI
    rendition.on('relocated', (loc: any) => onRelocate?.(loc));

    // TOC
    book.loaded.navigation.then((nav: any) => {
      const items = (nav?.toc || []).map((i: any) => ({ href: i.href, label: i.label }));
      onToc?.(items);
    });

    // Make arrows work inside the iframe too
    const onRendered = (section: any) => {
      const doc: Document | undefined = section.document;
      if (!doc) return;
      const handler = (e: KeyboardEvent) => {
        if (!renditionRef.current) return;
        if (e.key === 'ArrowRight') { e.preventDefault(); renditionRef.current.next(); }
        if (e.key === 'ArrowLeft')  { e.preventDefault(); renditionRef.current.prev(); }
      };
      doc.addEventListener('keydown', handler);
      section.on('unloaded', () => doc.removeEventListener('keydown', handler));
    };
    rendition.on('rendered', onRendered);

    // Controls
    onReady?.({
      goTo: (tgt: string) => rendition.display(tgt),
      next: () => rendition.next(),
      prev: () => rendition.prev(),
    });

    return () => {
      try { rendition.off?.('rendered', onRendered); } catch {}
      try { book?.destroy?.(); } catch {}
    };
  }, [bytes]);

  // Apply theme / typography
  useEffect(() => {
    const r = renditionRef.current;
    if (!r) return;
    r.themes.select(theme);
    r.themes.fontSize(`${Math.round(fontScale * 100)}%`);
    r.themes.override('line-height', String(lineHeight));
  }, [theme, fontScale, lineHeight]);

  return (
    <div ref={containerRef} style={{ width: '100%', height: '100%', position: 'relative' }}>
      {/* Click zones for paging */}
      <div
        onClick={() => renditionRef.current?.prev()}
        style={{ position:'absolute', inset:'0 80% 0 0', cursor:'w-resize' }}
        aria-hidden
        title="Previous page"
      />
      <div
        onClick={() => renditionRef.current?.next()}
        style={{ position:'absolute', inset:'0 0 0 80%', cursor:'e-resize' }}
        aria-hidden
        title="Next page"
      />
    </div>
  );
}
