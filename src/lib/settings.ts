// src/lib/settings.ts
export type Theme = 'light' | 'dark';
export type Settings = {
  theme: Theme;
  fontScale: number;   // 0.8–1.6 (multiplier)
  lineHeight: number;  // 1.2–2.0
};

const KEY = 'driveread.settings.v1';

export function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return { theme: 'light', fontScale: 1.0, lineHeight: 1.5 };
}

export function saveSettings(s: Settings) {
  try { localStorage.setItem(KEY, JSON.stringify(s)); } catch {}
}
