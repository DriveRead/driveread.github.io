// src/lib/progress.ts

const KEY = 'driveread.progress.v1';

export type ProgressItem = { cfi: string; updated: number };
export type Progress = { [key: string]: ProgressItem };

export function loadAllLocalProgress(): Progress {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return {};
}

export function saveAllLocalProgress(p: Progress) {
  try { localStorage.setItem(KEY, JSON.stringify(p)); } catch {}
}

export function mergeProgress(local: Progress, remote: Progress): Progress {
  const merged = { ...local };
  for (const fileId in remote) {
    if (!local[fileId] || local[fileId].updated < remote[fileId].updated) {
      merged[fileId] = remote[fileId];
    }
  }
  return merged;
}

