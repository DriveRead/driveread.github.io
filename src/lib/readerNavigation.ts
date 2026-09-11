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
