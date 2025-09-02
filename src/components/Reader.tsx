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
  onRelocate,
  onToc,
  onReady,
  theme = 'light',
  fontScale = 1.0,
  lineHeight = 1.5,
}: {
  bytes: ArrayBuffer;
  startCfi?: string;
  onRelocate?: (cfi: string) => void;
  onToc?: (items: Array<{ href: string; label: string }>) => void;
  onReady?: (controls: Controls) => void;
  theme?: Theme;
  fontScale?: number;
  lineHeight?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const renditionRef = useRef<any>(null);
  const bookRef = useRef<any>(null);

  // initial load
  useEffect(() => {
    const book = ePub(bytes);
    bookRef.current = book;

    const rendition = book.renderTo(ref.current!, { width: '100%', height: '100%' });
    renditionRef.current = rendition;

    // basic theme hook
    rendition.themes.register('light', {
      body: { background: '#ffffff', color: '#111' },
      'img, image': { filter: 'none' },
    });
    rendition.themes.register('dark', {
      body: { background: '#0b0f12', color: '#e7e7e7' },
      'img, image': { filter: 'brightness(0.85)' },
    });

    rendition.display(startCfi || undefined);
    rendition.on('relocated', (loc: any) => onRelocate?.(loc?.start?.cfi));

    // TOC
    book.loaded.navigation.then((nav: any) => {
      const items = (nav?.toc || []).map((i: any) => ({ href: i.href, label: i.label }));
      onToc?.(items);
    });

    // expose controls
    onReady?.({
      goTo: (tgt: string) => rendition.display(tgt),
      next: () => rendition.next(),
      prev: () => rendition.prev(),
    });

    return () => {
      try { book?.destroy?.(); } catch {}
    };
  }, [bytes]);

  // apply theme/typography on prop change
  useEffect(() => {
    const r = renditionRef.current;
    if (!r) return;
    r.themes.select(theme);
    r.themes.fontSize(`${Math.round(fontScale * 100)}%`);
    r.themes.override('line-height', String(lineHeight));
  }, [theme, fontScale, lineHeight]);

  return <div ref={ref} style={{ width: '100%', height: '100%' }} />;
}
