import ePub from 'epubjs';
import { useEffect, useRef } from 'react';
import type { Settings } from '@/src/lib/settings';

type Controls = {
  goTo: (hrefOrCfi: string) => Promise<void>;
  next: () => Promise<void>;
  prev: () => Promise<void>;
};
export type ReaderLocation = { start?: { cfi?: string; href?: string; displayed?: { page?: number; total?: number } }; percentage?: number };

export default function Reader({
  bytes,
  startCfi,
  onRelocate, // emits full 'loc' object
  onToc,
  onReady,
  settings,
}: {
  bytes: ArrayBuffer;
  startCfi?: string;
  onRelocate?: (loc: ReaderLocation) => void;
  onToc?: (items: Array<{ href: string; label: string }>) => void;
  onReady?: (controls: Controls) => void;
  settings: Settings;
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
      flow: settings.flow,
      spread: settings.spread,
      allowScriptedContent: true,
    });
    renditionRef.current = rendition;

    // Themes
    rendition.themes.register('light', { body: { background: '#fff', color: '#111' } });
    rendition.themes.register('sepia', { body: { background: '#f4ecd8', color: '#433422' } });
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
    const onRendered = (section: any, view: any) => {
      const doc: Document | undefined = section.document;
      if (!doc) return;
      const handler = (e: KeyboardEvent) => {
        if (!renditionRef.current) return;
        if (e.key === 'ArrowRight') { e.preventDefault(); renditionRef.current.next(); }
        if (e.key === 'ArrowLeft')  { e.preventDefault(); renditionRef.current.prev(); }
      };
      doc.addEventListener('keydown', handler);
      view.on('detached', () => doc.removeEventListener('keydown', handler));
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

  // Layout changes can cause epub.js to relocate; explicitly return to the old CFI.
  useEffect(() => {
    const r = renditionRef.current;
    if (!r) return;
    const cfi = r.location?.start?.cfi;
    r.flow(settings.flow);
    r.spread(settings.spread);
    if (cfi) r.display(cfi);
  }, [settings.flow, settings.spread]);

  // Apply theme
  useEffect(() => {
    const r = renditionRef.current;
    if (!r) return;
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const apply = () => r.themes.select(settings.theme === 'system' ? (media.matches ? 'dark' : 'light') : settings.theme);
    apply();
    media.addEventListener('change', apply);
    return () => media.removeEventListener('change', apply);
  }, [settings.theme]);

  // Apply typography / font family and re-render if needed
  useEffect(() => {
    const r = renditionRef.current;
    if (!r) return;

    const cfi = r.location?.start?.cfi;
    r.themes.fontSize(`${settings.fontSize}%`);
    r.themes.override('line-height', String(settings.lineHeight));

    const cssFamily =
      settings.fontFamily === 'os' ? 'inherit'
      : settings.fontFamily === 'serif' ? 'serif'
      : settings.fontFamily === 'sans' ? 'system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif'
      : settings.fontFamily === 'opendyslexic' ? '"Open Dyslexic", OpenDyslexic, sans-serif'
      : settings.fontFamily === 'atkinson' ? '"Atkinson Hyperlegible", Atkinson, sans-serif'
      : settings.fontFamily === 'roboto' ? 'Roboto, system-ui, sans-serif'
      : 'Roboto Mono, ui-monospace, monospace'; // robotomono

    r.themes.override('font-family', cssFamily);
    r.themes.override('max-width', `${settings.contentWidth}px`);
    r.themes.override('margin-left', `${settings.pageMargins}px`);
    r.themes.override('margin-right', `${settings.pageMargins}px`);
    r.themes.override('text-align', settings.textAlignment);
    r.themes.override('hyphens', settings.hyphenation ? 'auto' : 'none');
    r.themes.override('scroll-behavior', settings.reducedMotion === true ? 'auto' : 'smooth');
    r.themes.default({ p: { 'margin-bottom': `${settings.paragraphSpacing}em` } });

    if (isFirstLayoutEffect.current) {
      isFirstLayoutEffect.current = false;
    } else if (cfi) {
      r.display(cfi);
    }
  }, [settings.fontSize, settings.lineHeight, settings.fontFamily, settings.contentWidth, settings.pageMargins, settings.paragraphSpacing, settings.textAlignment, settings.hyphenation, settings.reducedMotion]);

  return (
    <div ref={containerRef} className="epub-reader">
      {settings.flow === 'paginated' && (
        <>
          {/* Click zones for paging */}
          <div
            onClick={() => renditionRef.current?.prev()}
            className="page-zone page-zone-previous"
            aria-hidden
            title="Previous page"
          />
          <div
            onClick={() => renditionRef.current?.next()}
            className="page-zone page-zone-next"
            aria-hidden
            title="Next page"
          />
        </>
      )}
    </div>
  );
}
