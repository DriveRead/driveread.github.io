// src/lib/progress.ts
type Saved = { cfi: string; ts: number };

const KEY = 'driveread.progress.v1';

function readAll(): Record<string, Saved> {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function writeAll(map: Record<string, Saved>) {
  try {
    localStorage.setItem(KEY, JSON.stringify(map));
  } catch { /* storage full or blocked; ignore */ }
}

export function loadProgress(fileId: string): string | undefined {
  const all = readAll();
  return all[fileId]?.cfi;
}

export function saveProgress(fileId: string, cfi: string) {
  if (!fileId || !cfi) return;
  const all = readAll();
  all[fileId] = { cfi, ts: Date.now() };
  writeAll(all);
}
