export type ExternalLinkDecision =
  | { kind: 'internal' }
  | { kind: 'external'; url: string }
  | { kind: 'unsafe' };

const UNSAFE_SCHEME = /^(?:javascript|data|vbscript|file):/i;
const WEB_SCHEME = /^https?:$/i;

/** Classify an EPUB anchor without resolving ordinary chapter and fragment links. */
export function classifyEpubLink(rawHref: string): ExternalLinkDecision {
  const href = rawHref.trim();
  if (!href || href.startsWith('#')) return { kind: 'internal' };
  if (UNSAFE_SCHEME.test(href)) return { kind: 'unsafe' };

  // A scheme or protocol-relative URL leaves the book. Relative paths stay under
  // epub.js control so chapter navigation, images and in-book links still work.
  if (!/^[a-z][a-z\d+.-]*:/i.test(href) && !href.startsWith('//')) {
    return { kind: 'internal' };
  }

  try {
    const url = new URL(href, 'https://epub.invalid/');
    return WEB_SCHEME.test(url.protocol)
      ? { kind: 'external', url: url.href }
      : { kind: 'unsafe' };
  } catch {
    return { kind: 'unsafe' };
  }
}

export function openExternalEpubLink(rawHref: string, hostWindow: Window = window): boolean {
  const decision = classifyEpubLink(rawHref);
  if (decision.kind !== 'external') return false;
  if (!hostWindow.confirm(`This link leaves the book and opens an external website:\n\n${decision.url}\n\nContinue?`)) return false;
  const opened = hostWindow.open(decision.url, '_blank', 'noopener,noreferrer');
  if (opened) opened.opener = null;
  return true;
}
