export type ReaderHistory = { entries: string[]; index: number };
export const emptyReaderHistory = (): ReaderHistory => ({ entries: [], index: -1 });
export function recordLocation(history: ReaderHistory, cfi: string): ReaderHistory {
  if (!cfi || history.entries[history.index] === cfi) return history;
  const entries = [...history.entries.slice(0, history.index + 1), cfi];
  return { entries, index: entries.length - 1 };
}
export function traverseHistory(history: ReaderHistory, direction: -1 | 1): { history: ReaderHistory; cfi: string | null } {
  const index = history.index + direction;
  if (index < 0 || index >= history.entries.length) return { history, cfi: null };
  return { history: { ...history, index }, cfi: history.entries[index] };
}
