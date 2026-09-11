import ePub from 'epubjs';
import { useEffect, useRef } from 'react';
import type { Settings } from '@/src/lib/settings';
import type { TocItem } from './ContentsPanel';
import { isEditableTarget } from '@/src/lib/readerNavigation';
import { openExternalEpubLink, classifyEpubLink } from '@/src/lib/readerSecurity';
import { publicAssetUrl, READER_FONT_ASSETS } from '@/src/lib/readerAssets';

export type ReaderControls = {
  goTo: (hrefOrCfi: string) => Promise<void>;
  goToPercentage: (percentage: number) => Promise<void>;
  generateLocations: () => Promise<number>;
  next: () => Promise<void>;
  prev: () => Promise<void>;
};
export type ReaderLocation = { start?: { cfi?: string; href?: string; displayed?: { page?: number; total?: number } }; percentage?: number; location?: number; totalLocations?: number };

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
  onToc?: (items: TocItem[]) => void;
  onReady?: (controls: ReaderControls | null) => void;
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
      // Book JavaScript is deliberately disabled. This does not affect EPUB CSS,
      // images, normal hyperlinks, or rendition-driven navigation.
      allowScriptedContent: false,
    });
    renditionRef.current = rendition;

    // Themes
    rendition.themes.register('light', { body: { background: '#fff', color: '#111' } });
    rendition.themes.register('sepia', { body: { background: '#f4ecd8', color: '#433422' } });
    rendition.themes.register('dark', { body: { background: '#0b0f12', color: '#e7e7e7' } });

    // Optional font faces (deployed from the root public/fonts directory)
    try {
      for (const [family, path] of READER_FONT_ASSETS) {
        rendition.themes.registerFont(family, publicAssetUrl(path));
      }
    } catch {
      // Safe to ignore if files aren’t present
    }

    // Start location
    rendition.display(startCfi || undefined);

    // Relocation → bubble full 'loc'
    const onRelocated = (loc: any) => {
      const cfi = loc?.start?.cfi;
      onRelocate?.({
        ...loc,
        percentage: typeof cfi === 'string' && book.locations?.length?.() ? book.locations.percentageFromCfi(cfi) : loc?.percentage,
        location: typeof cfi === 'string' && book.locations?.length?.() ? book.locations.locationFromCfi(cfi) : undefined,
        totalLocations: book.locations?.length?.() || undefined,
      });
    };
    rendition.on('relocated', onRelocated);

    // TOC
    let active = true;
    book.loaded.navigation.then((nav: any) => {
      if (!active) return;
      const mapItem = (i: any): TocItem => ({
        href: i.href,
        label: i.label,
        children: (i.subitems || i.children || []).map(mapItem),
      });
      const items = (nav?.toc || []).map(mapItem);
      onToc?.(items);
    });

    // Arrow keys inside iframe
    const renderedCleanups = new Set<() => void>();
    const onRendered = (section: any, view: any) => {
      const doc: Document | undefined = section.document;
      if (!doc) return;
      const handler = (e: KeyboardEvent) => {
        if (isEditableTarget(e.target)) return;
        if (!renditionRef.current) return;
        if (e.key === 'ArrowRight') { e.preventDefault(); renditionRef.current.next(); }
        if (e.key === 'ArrowLeft')  { e.preventDefault(); renditionRef.current.prev(); }
      };
      const onClick = (event: MouseEvent) => {
        // Elements belong to the iframe's realm, so avoid the parent window's
        // `instanceof Element` check here.
        const target = event.target as Element | null;
        const anchor = typeof target?.closest === 'function' ? target.closest('a[href]') : null;
        const href = anchor?.getAttribute('href');
        if (!href) return;
        const decision = classifyEpubLink(href);
        if (decision.kind === 'internal') return;
        event.preventDefault();
        event.stopPropagation();
        if (decision.kind === 'external') openExternalEpubLink(href, window);
      };
      doc.addEventListener('keydown', handler);
      doc.addEventListener('click', onClick);
      const cleanup = () => {
        doc.removeEventListener('keydown', handler);
        doc.removeEventListener('click', onClick);
        view.off?.('detached', cleanup);
        renderedCleanups.delete(cleanup);
      };
      renderedCleanups.add(cleanup);
      view.on('detached', cleanup);
    };
    rendition.on('rendered', onRendered);

    // Expose simple controls
    onReady?.({
      goTo: (tgt: string) => rendition.display(tgt),
      goToPercentage: (percentage: number) => {
        const cfi = book.locations.cfiFromPercentage(Math.max(0, Math.min(1, percentage)));
        return cfi ? rendition.display(cfi) : Promise.resolve();
      },
      generateLocations: async () => {
        if (!book.locations.length()) await book.locations.generate(1600);
        return book.locations.length();
      },
      next: () => rendition.next(),
      prev: () => rendition.prev(),
    });

    return () => {
      active = false;
      // Invalidate parent controls before destroying their underlying rendition.
      onReady?.(null);
      renditionRef.current = null;
      bookRef.current = null;
      try { rendition.off?.('rendered', onRendered); } catch {}
      try { rendition.off?.('relocated', onRelocated); } catch {}
      for (const cleanup of [...renderedCleanups]) cleanup();
      // book.destroy() destroys the rendition, archive/resources, iframe views,
      // and revokes the object URLs epub.js created for them.
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

  // A pinned panel changes the rendition's container width. Resize at the same
  // CFI so pagination reflows without moving the reader's logical location.
  useEffect(() => {
    const container = containerRef.current;
    if (!container || typeof ResizeObserver === 'undefined') return;
    let frame = 0;
    const observer = new ResizeObserver(() => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const rendition = renditionRef.current;
        const currentCfi = rendition?.location?.start?.cfi;
        rendition?.resize?.(container.clientWidth, container.clientHeight);
        if (currentCfi) rendition.display(currentCfi);
      });
    });
    observer.observe(container);
    return () => { cancelAnimationFrame(frame); observer.disconnect(); };
  }, [bytes]);

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
