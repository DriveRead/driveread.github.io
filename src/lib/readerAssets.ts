export const READER_FONT_ASSETS = [
  ['Open Dyslexic', 'fonts/OpenDyslexic-Regular.woff2', 400],
  ['Atkinson Hyperlegible', 'fonts/Atkinson-Hyperlegible-Regular.woff2', 400],
  ['Roboto', 'fonts/Roboto-Regular.woff2', 400],
  ['Roboto Mono', 'fonts/RobotoMono-Regular.woff2', 400],
] as const;

export function publicAssetUrl(path: string): string {
  const basePath = (process.env.NEXT_PUBLIC_BASE_PATH || '').replace(/\/$/, '');
  return `${basePath}/${path.replace(/^\//, '')}`;
}

/** CSS injected into each EPUB document by the rendition content hook. */
export function readerFontStylesheet(): string {
  return READER_FONT_ASSETS.map(([family, path, weight]) => `@font-face {
  font-family: "${family}";
  font-style: normal;
  font-weight: ${weight};
  font-display: swap;
  src: url("${publicAssetUrl(path)}") format("woff2");
}`).join('\n');
}
