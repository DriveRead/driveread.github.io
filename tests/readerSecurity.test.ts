import test from 'node:test';
import assert from 'node:assert/strict';
import { classifyEpubLink, openExternalEpubLink } from '../src/lib/readerSecurity.ts';

test('keeps ordinary EPUB chapter and fragment links inside the rendition', () => {
  for (const href of ['chapter-2.xhtml', '../text/chapter.xhtml#part', '#footnote']) {
    assert.deepEqual(classifyEpubLink(href), { kind: 'internal' });
  }
});

test('rejects executable and non-web external URL schemes', () => {
  for (const href of ['javascript:alert(1)', ' JAVASCRIPT:alert(1)', 'data:text/html,bad', 'file:///etc/passwd', 'mailto:test@example.com']) {
    assert.deepEqual(classifyEpubLink(href), { kind: 'unsafe' });
  }
});

test('opens a confirmed web link in a protected new browsing context', () => {
  const calls: unknown[][] = [];
  const child = { opener: {} };
  const host = {
    confirm: () => true,
    open: (...args: unknown[]) => { calls.push(args); return child; },
  } as unknown as Window;

  assert.equal(openExternalEpubLink('https://example.com/read', host), true);
  assert.deepEqual(calls, [['https://example.com/read', '_blank', 'noopener,noreferrer']]);
  assert.equal(child.opener, null);
});

test('does not open a rejected external link', () => {
  let opened = false;
  const host = { confirm: () => false, open: () => { opened = true; } } as unknown as Window;
  assert.equal(openExternalEpubLink('https://example.com/', host), false);
  assert.equal(opened, false);
});
