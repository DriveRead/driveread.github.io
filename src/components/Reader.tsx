import ePub from 'epubjs';
import { useEffect, useRef } from 'react';
import type { Settings } from '@/src/lib/settings';
import type { TocItem } from './ContentsPanel';
import { initialReadingTarget, isEditableTarget } from '@/src/lib/readerNavigation';
import { openExternalEpubLink, classifyEpubLink } from '@/src/lib/readerSecurity';
import { publicAssetUrl, readerFontStylesheet, READER_FONT_ASSETS } from '@/src/lib/readerAssets';
import { isFindShortcut, normalizeSearchResult, wrappedResultIndex, type SearchResult } from '@/src/lib/readerSearch';

export type ReaderControls = {
  goTo: (hrefOrCfi: string) => Promise<void>;
  goToPercentage: (percentage: number) => Promise<void>;
  generateLocations: () => Promise<number>;
  next: () => Promise<void>;
  prev: () => Promise<void>;
  search: (query: string, requestId?: number) => Promise<{ requestId: number; results: SearchResult[]; stale: boolean }>;
  cancelSearch: () => void;
  showSearchResult: (index: number) => Promise<number>;
  nextSearchResult: () => Promise<number>;
  previousSearchResult: () => Promise<number>;
  clearSearch: () => void;
};
export type ReaderLocation = { start?: { cfi?: string; href?: string; displayed?: { page?: number; total?: number } }; percentage?: number; location?: number; totalLocations?: number };

export default function Reader({
  bytes,
  startCfi,
  onRelocate, // emits full 'loc' object
  onToc,
  onReady,
  settings,
  onFindShortcut,
}: {
  bytes: ArrayBuffer;
  startCfi?: string;
  onRelocate?: (loc: ReaderLocation) => void;
  onToc?: (items: TocItem[]) => void;
  onReady?: (controls: ReaderControls | null) => void;
  settings: Settings;
  onFindShortcut?: () => void;
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

    // A rendition content hook runs for every chapter, including views created
    // after initialization. epub.js 0.3 supports addStylesheetCss, but does not
    // provide the registerFont API found in some wrappers around the library.
    const fontCss = readerFontStylesheet();
    const injectReaderFonts = async (contents: any) => {
      const warn = (family: string, url: string, error?: unknown) => {
        const debug = process.env.NODE_ENV !== 'production' || window.location.search.includes('debug=true');
        if (debug) console.warn(`Reader font could not be loaded: ${family} (${url})`, error);
      };

      try {
        if (!contents.addStylesheetCss(fontCss, 'driveread-fonts')) {
          for (const [family, path] of READER_FONT_ASSETS) warn(family, publicAssetUrl(path));
          return;
        }
      } catch (error) {
        for (const [family, path] of READER_FONT_ASSETS) warn(family, publicAssetUrl(path), error);
        return;
      }

      const fonts: FontFaceSet | undefined = contents.document?.fonts;
      if (!fonts?.load) return;
      await Promise.all(READER_FONT_ASSETS.map(async ([family, path, weight]) => {
        const url = publicAssetUrl(path);
        try {
          const loaded = await fonts.load(`${weight} 16px "${family}"`);
          if (loaded.length === 0 || !fonts.check(`16px "${family}"`)) warn(family, url);
        } catch (error) {
          warn(family, url, error);
        }
      }));
    };
    rendition.hooks.content.register(injectReaderFonts);

    let active = true;

    // Wait for the spine before choosing a start location. A missing/obsolete
    // saved CFI and books whose spine has no linear items otherwise cause
    // epub.js to reject display() with an unhandled "No Section Found" error.
    void book.ready.then(() => {
      if (!active) return;
      return rendition.display(initialReadingTarget(book.spine, startCfi));
    }).catch((error: unknown) => {
      if (active) console.error('The EPUB does not contain readable content.', error);
    });

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
        if (isFindShortcut(e)) { e.preventDefault(); onFindShortcut?.(); return; }
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

    let searchGeneration = 0;
    let searchResults: SearchResult[] = [];
    let searchIndex = -1;
    const searchHighlights = new Set<string>();
    const clearSearch = () => {
      searchGeneration += 1;
      for (const cfi of searchHighlights) rendition.annotations?.remove(cfi, 'highlight');
      searchHighlights.clear(); searchResults = []; searchIndex = -1;
    };
    const showSearchResult = async (index: number) => {
      if (!searchResults.length) return -1;
      searchIndex = ((index % searchResults.length) + searchResults.length) % searchResults.length;
      await rendition.display(searchResults[searchIndex].cfi);
      return searchIndex;
    };

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
      search: async (rawQuery: string, requestId = Date.now()) => {
        const generation = ++searchGeneration;
        for (const cfi of searchHighlights) rendition.annotations?.remove(cfi, 'highlight');
        searchHighlights.clear(); searchResults = []; searchIndex = -1;
        const query = rawQuery.trim();
        if (!query) return { requestId, results: [], stale: false };
        const navigation = await book.loaded.navigation;
        const tocEntries: any[] = [];
        const flatten = (items: any[]) => items.forEach(item => { tocEntries.push(item); flatten(item.subitems || item.children || []); });
        flatten(navigation?.toc || []);
        const found: SearchResult[] = [];
        for (const section of book.spine.spineItems || []) {
          if (generation !== searchGeneration) return { requestId, results: [], stale: true };
          await section.load(book.load.bind(book));
          const href = section.href || section.url || 'Chapter';
          const label = tocEntries.find(item => String(item.href || '').split('#')[0] === String(href).split('#')[0])?.label || href;
          for (const match of section.find(query) || []) {
            const result = normalizeSearchResult(match, label);
            if (result) found.push(result);
          }
          section.unload?.();
        }
        if (generation !== searchGeneration) return { requestId, results: [], stale: true };
        searchResults = found;
        for (const result of found) { rendition.annotations?.highlight(result.cfi, {}, undefined, 'driveread-search-highlight'); searchHighlights.add(result.cfi); }
        return { requestId, results: found, stale: false };
      },
      cancelSearch: () => { searchGeneration += 1; },
      showSearchResult,
      nextSearchResult: () => showSearchResult(wrappedResultIndex(searchIndex, searchResults.length, 1)),
      previousSearchResult: () => showSearchResult(wrappedResultIndex(searchIndex, searchResults.length, -1)),
      clearSearch,
    });

    return () => {
      active = false;
      clearSearch();
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

    r.themes.font(cssFamily);
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
      // Font loading changes pagination. Restore the logical position only
      // after all currently rendered EPUB documents have finished reflowing.
      let cancelled = false;
      const restoreAfterFontsLoad = async () => {
        const documents = (r.getContents?.() || []).map((content: any) => content.document as Document);
        await Promise.all(documents.map((doc: Document) => doc.fonts?.ready ?? Promise.resolve()));
        if (!cancelled && renditionRef.current === r) await r.display(cfi);
      };
      void restoreAfterFontsLoad();
      return () => { cancelled = true; };
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
        // ResizeObserver can run before epub.js has created and attached its
        // view manager. Rendition.resize() does not guard that internal state,
        // so calling it during startup throws while trying to access the
        // manager's resize method.
        if (!rendition?.manager?.isRendered?.()) return;
        const currentCfi = rendition?.location?.start?.cfi;
        rendition.resize(container.clientWidth, container.clientHeight);
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
