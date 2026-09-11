export const READER_FONT_ASSETS = [
  ['Open Dyslexic', 'fonts/OpenDyslexic-Regular.woff2'],
  ['Atkinson Hyperlegible', 'fonts/Atkinson-Hyperlegible-Regular.woff2'],
  ['Roboto', 'fonts/Roboto-Regular.woff2'],
  ['Roboto Mono', 'fonts/RobotoMono-Regular.woff2'],
] as const;

export function publicAssetUrl(path: string): string {
  const basePath = (process.env.NEXT_PUBLIC_BASE_PATH || '').replace(/\/$/, '');
  return `${basePath}/${path.replace(/^\//, '')}`;
}
