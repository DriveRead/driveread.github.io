export type TocItem = { href: string; label: string; children?: TocItem[] };

export function flattenToc(items: TocItem[]): TocItem[] {
  return items.flatMap(item => [item, ...flattenToc(item.children || [])]);
}

const base = (href: string) => href.split('#')[0];

export function adjacentChapter(items: TocItem[], currentHref: string | null, direction: -1 | 1): TocItem | null {
  if (!currentHref) return null;
  const flat = flattenToc(items);
  const index = flat.findIndex(item => base(item.href) === base(currentHref));
  const target = index + direction;
  return index >= 0 && target >= 0 && target < flat.length ? flat[target] : null;
}

export function isEditableTarget(target: EventTarget | null): boolean {
  const candidate = target as { closest?: (selector: string) => unknown } | null;
  return Boolean(candidate?.closest?.('input, textarea, select, [contenteditable]:not([contenteditable="false"]), [role="textbox"]'));
}

type EpubSpine = {
  get: (target?: string) => unknown;
  spineItems?: unknown[];
};

/**
 * Pick a display target after epub.js has finished unpacking the book.
 *
 * epub.js' default target is the first linear spine item. Some otherwise
 * readable EPUBs mark every spine item as non-linear, while a saved CFI can
 * also become invalid when a Drive file is replaced. In either case
 * Rendition.display rejects with "No Section Found". Falling back to spine
 * index zero lets those books open without requiring a navigation document.
 */
export function initialReadingTarget(spine: EpubSpine, savedCfi?: string): string | number | undefined {
  if (savedCfi && spine.get(savedCfi)) return savedCfi;
  if (spine.get()) return undefined;
  if (spine.spineItems?.length) return 0;
  return undefined;
}
