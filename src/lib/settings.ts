export const SETTINGS_KEY = 'driveread.settings.v1';
export const SETTINGS_VERSION = 3 as const;
export const CONTEXTUAL_PANELS = ['settings', 'contents', 'find', 'bookmarks', 'book-info'] as const;
export type ContextualPanelId = typeof CONTEXTUAL_PANELS[number];

export const THEMES = ['system', 'light', 'sepia', 'dark'] as const;
export const FONT_FAMILIES = ['os', 'serif', 'sans', 'opendyslexic', 'atkinson', 'roboto', 'robotomono'] as const;
export const TEXT_ALIGNMENTS = ['start', 'justify'] as const;
export const FLOWS = ['paginated', 'scrolled-doc'] as const;
export const SPREAD_MODES = ['auto', 'none', 'both'] as const;

export type Theme = typeof THEMES[number];
export type FontFamily = typeof FONT_FAMILIES[number];
export type TextAlignment = typeof TEXT_ALIGNMENTS[number];
export type Flow = typeof FLOWS[number];
export type SpreadMode = typeof SPREAD_MODES[number];

export interface Settings {
  version: typeof SETTINGS_VERSION;
  theme: Theme;
  fontFamily: FontFamily;
  fontSize: number;
  lineHeight: number;
  contentWidth: number;
  pageMargins: number;
  paragraphSpacing: number;
  textAlignment: TextAlignment;
  hyphenation: boolean;
  flow: Flow;
  spread: SpreadMode;
  reducedMotion: boolean | null;
  /** Desktop panel preference. Closing clears these; unpinning only sets panelPinned false. */
  panelPinned: boolean;
  lastPinnedPanel: ContextualPanelId | null;
}

export const DEFAULT_SETTINGS: Readonly<Settings> = Object.freeze({
  version: SETTINGS_VERSION,
  theme: 'system',
  fontFamily: 'os',
  fontSize: 100,
  lineHeight: 1.5,
  contentWidth: 760,
  pageMargins: 32,
  paragraphSpacing: 0.75,
  textAlignment: 'start',
  hyphenation: true,
  flow: 'paginated',
  spread: 'auto',
  reducedMotion: null,
  panelPinned: false,
  lastPinnedPanel: null,
});

export type SettingsSection = 'appearance' | 'typography' | 'layout' | 'navigation';
const sectionKeys: Record<SettingsSection, readonly (keyof Settings)[]> = {
  appearance: ['theme', 'reducedMotion'],
  typography: ['fontFamily', 'fontSize', 'lineHeight', 'paragraphSpacing', 'textAlignment', 'hyphenation'],
  layout: ['contentWidth', 'pageMargins'],
  navigation: ['flow', 'spread'],
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
const enumValue = <T extends string>(value: unknown, choices: readonly T[], fallback: T): T =>
  typeof value === 'string' && choices.includes(value as T) ? value as T : fallback;
const clamp = (value: unknown, fallback: number, min: number, max: number): number =>
  typeof value === 'number' && Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : fallback;

/** Accepts current data and the original v1 shape, returning a complete safe model. */
export function normalizeSettings(value: unknown): Settings {
  const source = isRecord(value) ? value : {};
  const oldScale = typeof source.fontScale === 'number' ? source.fontScale * 100 : undefined;
  return {
    version: SETTINGS_VERSION,
    theme: enumValue(source.theme, THEMES, DEFAULT_SETTINGS.theme),
    fontFamily: enumValue(source.fontFamily, FONT_FAMILIES, DEFAULT_SETTINGS.fontFamily),
    fontSize: clamp(source.fontSize ?? oldScale, DEFAULT_SETTINGS.fontSize, 75, 200),
    lineHeight: clamp(source.lineHeight, DEFAULT_SETTINGS.lineHeight, 1.1, 2.4),
    contentWidth: clamp(source.contentWidth, DEFAULT_SETTINGS.contentWidth, 480, 1200),
    pageMargins: clamp(source.pageMargins, DEFAULT_SETTINGS.pageMargins, 0, 96),
    paragraphSpacing: clamp(source.paragraphSpacing, DEFAULT_SETTINGS.paragraphSpacing, 0, 2.5),
    textAlignment: enumValue(source.textAlignment, TEXT_ALIGNMENTS, DEFAULT_SETTINGS.textAlignment),
    hyphenation: typeof source.hyphenation === 'boolean' ? source.hyphenation : DEFAULT_SETTINGS.hyphenation,
    flow: enumValue(source.flow, FLOWS, DEFAULT_SETTINGS.flow),
    spread: enumValue(source.spread, SPREAD_MODES, DEFAULT_SETTINGS.spread),
    reducedMotion: typeof source.reducedMotion === 'boolean' || source.reducedMotion === null
      ? source.reducedMotion : DEFAULT_SETTINGS.reducedMotion,
    panelPinned: typeof source.panelPinned === 'boolean' ? source.panelPinned : DEFAULT_SETTINGS.panelPinned,
    lastPinnedPanel: source.lastPinnedPanel === null ? null
      : enumValue(source.lastPinnedPanel, CONTEXTUAL_PANELS, DEFAULT_SETTINGS.lastPinnedPanel as ContextualPanelId) || null,
  };
}

export function deserializeSettings(raw: string | null): Settings {
  if (!raw) return { ...DEFAULT_SETTINGS };
  try { return normalizeSettings(JSON.parse(raw) as unknown); } catch { return { ...DEFAULT_SETTINGS }; }
}

export function serializeSettings(settings: Settings): string {
  return JSON.stringify(normalizeSettings(settings));
}

type StorageLike = Pick<Storage, 'getItem' | 'setItem'>;
export function loadSettings(storage?: StorageLike): Settings {
  try { return deserializeSettings((storage ?? localStorage).getItem(SETTINGS_KEY)); }
  catch { return { ...DEFAULT_SETTINGS }; }
}
export function saveSettings(settings: Settings, storage?: StorageLike): void {
  try { (storage ?? localStorage).setItem(SETTINGS_KEY, serializeSettings(settings)); } catch { /* Storage may be unavailable. */ }
}

export function updateSetting<K extends keyof Settings>(settings: Settings, key: K, value: Settings[K]): Settings {
  return normalizeSettings({ ...settings, [key]: value });
}
export function resetSection(settings: Settings, section: SettingsSection): Settings {
  const reset = { ...settings } as Settings;
  for (const key of sectionKeys[section]) Object.assign(reset, { [key]: DEFAULT_SETTINGS[key] });
  return reset;
}
export function resetSettings(): Settings { return { ...DEFAULT_SETTINGS }; }
