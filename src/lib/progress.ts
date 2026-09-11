// Reading records are deliberately stored under the original key so existing
// DriveRead installations are migrated in place.
const KEY = 'driveread.progress.v1';

export const READING_RECORD_VERSION = 2 as const;

export type Bookmark = { cfi: string; created: number; label?: string };
export type BookMetadata = { title?: string; author?: string; fileName?: string };
export type LegacyProgressItem = { cfi: string; updated: number };
export type ProgressItem = {
  version: typeof READING_RECORD_VERSION;
  cfi: string;
  updated: number;
  percentage?: number;
  bookmarks: Bookmark[];
  metadata?: BookMetadata;
};
export type Progress = { [key: string]: ProgressItem };
export type ProgressInput = { [key: string]: ProgressItem | LegacyProgressItem };

export function dedupeBookmarks(bookmarks: Bookmark[]): Bookmark[] {
  const byCfi = new Map<string, Bookmark>();
  for (const bookmark of bookmarks) {
    const current = byCfi.get(bookmark.cfi);
    if (!current || bookmark.created > current.created) byCfi.set(bookmark.cfi, bookmark);
  }
  return [...byCfi.values()].sort((a, b) => a.created - b.created);
}

export function migrateProgress(input: unknown): Progress {
  if (!input || typeof input !== 'object') return {};
  const output: Progress = {};
  for (const [fileId, value] of Object.entries(input as Record<string, unknown>)) {
    if (!value || typeof value !== 'object') continue;
    const item = value as Partial<ProgressItem & LegacyProgressItem>;
    if (typeof item.cfi !== 'string' || typeof item.updated !== 'number') continue;
    output[fileId] = {
      version: READING_RECORD_VERSION,
      cfi: item.cfi,
      updated: item.updated,
      ...(typeof item.percentage === 'number' ? { percentage: item.percentage } : {}),
      bookmarks: dedupeBookmarks(Array.isArray(item.bookmarks) ? item.bookmarks.filter(
        (bookmark): bookmark is Bookmark => Boolean(bookmark) && typeof bookmark.cfi === 'string' && typeof bookmark.created === 'number',
      ) : []),
      ...(item.metadata && typeof item.metadata === 'object' ? { metadata: item.metadata } : {}),
    };
  }
  return output;
}

export function loadAllLocalProgress(): Progress {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return migrateProgress(JSON.parse(raw));
  } catch {}
  return {};
}

export function saveAllLocalProgress(progress: ProgressInput) {
  try { localStorage.setItem(KEY, JSON.stringify(migrateProgress(progress))); } catch {}
}

/** Newer location data wins, while bookmarks from both devices are retained. */
export function mergeProgress(localInput: ProgressInput, remoteInput: ProgressInput): Progress {
  const local = migrateProgress(localInput);
  const remote = migrateProgress(remoteInput);
  const merged: Progress = {};
  for (const fileId of new Set([...Object.keys(local), ...Object.keys(remote)])) {
    const left = local[fileId];
    const right = remote[fileId];
    if (!left) { merged[fileId] = right; continue; }
    if (!right) { merged[fileId] = left; continue; }
    const newest = right.updated > left.updated ? right : left;
    merged[fileId] = { ...newest, bookmarks: dedupeBookmarks([...left.bookmarks, ...right.bookmarks]) };
  }
  return merged;
}

export function addBookmark(record: ProgressItem, bookmark: Bookmark): ProgressItem {
  return { ...record, updated: Math.max(record.updated, bookmark.created), bookmarks: dedupeBookmarks([...record.bookmarks, bookmark]) };
}

export function removeBookmark(record: ProgressItem, cfi: string, updated = Date.now()): ProgressItem {
  return { ...record, updated, bookmarks: record.bookmarks.filter(bookmark => bookmark.cfi !== cfi) };
}
