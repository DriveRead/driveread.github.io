import ePub from 'epubjs';
import { useEffect, useRef } from 'react';
import type { Theme, FontFamily, Flow } from '@/src/lib/settings';

type Controls = {
  goTo: (hrefOrCfi: string) => Promise<void>;
  next: () => Promise<void>;
  prev: () => Promise<void>;
};

export default function Reader({
  bytes,
  startCfi,
  onRelocate, // emits full 'loc' object
  onToc,
  onReady,
  theme = 'light',
  fontScale = 1.0,
  lineHeight = 1.5,
  fontFamily = 'os',
  flow = 'paginated',
}: {
  bytes: ArrayBuffer;
  startCfi?: string;
  onRelocate?: (loc: any) => void;
  onToc?: (items: Array<{ href: string; label: string }>) => void;
  onReady?: (controls: Controls) => void;
  theme?: Theme;
  fontScale?: number;
  lineHeight?: number;
  fontFamily?: FontFamily;
  flow?: Flow;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const renditionRef = useRef<any>(null);
  const bookRef = useRef<any>(null);
  const isFirstLayoutEffect = useRef(true);

  // Initialise book + rendition
  useEffect(() => {
    const book = ePub(bytes);
    bookRef.current = book;
    isFirstLayoutEffect.current = true; // Reset for new book

    const rendition = book.renderTo(containerRef.current!, {
      width: '100%',
      height: '100%',
      flow,
      spread: 'auto',
    });
    renditionRef.current = rendition;

    // Themes
    rendition.themes.register('light', { body: { background: '#fff', color: '#111' } });
    rendition.themes.register('dark', { body: { background: '#0b0f12', color: '#e7e7e7' } });

    // Optional font faces (served from /public/fonts)
    try {
      rendition.themes.registerFont('Open Dyslexic', '/fonts/OpenDyslexic-Regular.woff2');
      rendition.themes.registerFont('Atkinson Hyperlegible', '/fonts/Atkinson-Hyperlegible-Regular.woff2');
      rendition.themes.registerFont('Roboto', '/fonts/Roboto-Regular.woff2');
      rendition.themes.registerFont('Roboto Mono', '/fonts/RobotoMono-Regular.woff2');
    } catch {
      // Safe to ignore if files aren’t present
    }

    // Start location
    rendition.display(startCfi || undefined);

    // Relocation → bubble full 'loc'
    rendition.on('relocated', (loc: any) => onRelocate?.(loc));

    // TOC
    book.loaded.navigation.then((nav: any) => {
      const items = (nav?.toc || []).map((i: any) => ({ href: i.href, label: i.label }));
      onToc?.(items);
    });

    // Arrow keys inside iframe
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

    // Expose simple controls
    onReady?.({
      goTo: (tgt: string) => rendition.display(tgt),
      next: () => rendition.next(),
      prev: () => rendition.prev(),
    });

    return () => {
      try { rendition.off?.('rendered', onRendered); } catch {}
      try { book.destroy(); } catch {}
    };
  }, [bytes]);

  // Apply flow
  useEffect(() => {
    const r = renditionRef.current;
    if (!r) return;
    r.flow(flow);
  }, [flow]);

  // Apply theme
  useEffect(() => {
    const r = renditionRef.current;
    if (!r) return;
    r.themes.select(theme);
  }, [theme]);

  // Apply typography / font family and re-render if needed
  useEffect(() => {
    const r = renditionRef.current;
    if (!r) return;

    r.themes.fontSize(`${Math.round(fontScale * 100)}%`);
    r.themes.override('line-height', String(lineHeight));

    const cssFamily =
      fontFamily === 'os' ? 'inherit'
      : fontFamily === 'serif' ? 'serif'
      : fontFamily === 'sans' ? 'system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif'
      : fontFamily === 'opendyslexic' ? '"Open Dyslexic", OpenDyslexic, sans-serif'
      : fontFamily === 'atkinson' ? '"Atkinson Hyperlegible", Atkinson, sans-serif'
      : fontFamily === 'roboto' ? 'Roboto, system-ui, sans-serif'
      : 'Roboto Mono, ui-monospace, monospace'; // robotomono

    r.themes.override('font-family', cssFamily);

    if (isFirstLayoutEffect.current) {
      isFirstLayoutEffect.current = false;
    } else if (r.location) {
      r.display(r.location.start.cfi);
    }
  }, [fontScale, lineHeight, fontFamily]);

  return (
    <div ref={containerRef} style={{ width: '100%', height: '100%', position: 'relative' }}>
      {flow === 'paginated' && (
        <>
          {/* Click zones for paging */}
          <div
            onClick={() => renditionRef.current?.prev()}
            style={{ position: 'absolute', inset: '0 80% 0 0', cursor: 'w-resize' }}
            aria-hidden
            title="Previous page"
          />
          <div
            onClick={() => renditionRef.current?.next()}
            style={{ position: 'absolute', inset: '0 0 0 80%', cursor: 'e-resize' }}
            aria-hidden
            title="Next page"
          />
        </>
      )}
    </div>
  );
}
