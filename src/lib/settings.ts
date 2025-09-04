// src/lib/settings.ts
export type Theme = 'light' | 'dark';
export type FontFamily =
  | 'os'              // inherits from browser/OS
  | 'serif'
  | 'sans'
  | 'opendyslexic'
  | 'atkinson'
  | 'roboto'
  | 'robotomono';

export type Settings = {
  theme: Theme;
  fontScale: number;
  lineHeight: number;
  fontFamily: FontFamily;     // NEW
};

const KEY = 'driveread.settings.v1';

export function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return { theme: 'light', fontScale: 1.0, lineHeight: 1.5, fontFamily: 'os' };
}

export function saveSettings(s: Settings) {
  try { localStorage.setItem(KEY, JSON.stringify(s)); } catch {}
}
