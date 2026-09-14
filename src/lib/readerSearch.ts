export type SearchResult = { cfi: string; chapter: string; excerpt: string };

export function escapeExcerpt(value: string, limit = 180): string {
  const compact = value.replace(/\s+/g, ' ').trim();
  const shortened = compact.length > limit ? `${compact.slice(0, limit - 1).trimEnd()}…` : compact;
  return shortened.replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]!));
}

export function normalizeSearchResult(value: unknown, chapter: string): SearchResult | null {
  if (!value || typeof value !== 'object') return null;
  const match = value as { cfi?: unknown; excerpt?: unknown };
  if (typeof match.cfi !== 'string' || !match.cfi) return null;
  return { cfi: match.cfi, chapter, excerpt: escapeExcerpt(typeof match.excerpt === 'string' ? match.excerpt : '') };
}

export function wrappedResultIndex(current: number, length: number, direction: 1 | -1): number {
  if (length < 1) return -1;
  return (Math.max(-1, current) + direction + length) % length;
}

export function isFindShortcut(event: Pick<KeyboardEvent, 'key' | 'ctrlKey' | 'metaKey'>): boolean {
  return event.key.toLowerCase() === 'f' && (event.ctrlKey || event.metaKey);
}
