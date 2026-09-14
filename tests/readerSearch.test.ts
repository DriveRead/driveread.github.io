import test from 'node:test';
import assert from 'node:assert/strict';
import { escapeExcerpt, isFindShortcut, normalizeSearchResult, wrappedResultIndex } from '../src/lib/readerSearch.ts';

test('search results are normalized and excerpts are compact, escaped, and short', () => {
  assert.deepEqual(normalizeSearchResult({ cfi: 'epubcfi(/6/2)', excerpt: '  <match> & "text"  ' }, 'Chapter 1'), { cfi: 'epubcfi(/6/2)', chapter: 'Chapter 1', excerpt: '&lt;match&gt; &amp; &quot;text&quot;' });
  assert.ok(escapeExcerpt('x'.repeat(300)).length <= 180);
  assert.equal(normalizeSearchResult({ excerpt: 'missing CFI' }, 'Chapter'), null);
});

test('result navigation wraps in both directions and handles empty results', () => {
  assert.equal(wrappedResultIndex(2, 3, 1), 0);
  assert.equal(wrappedResultIndex(0, 3, -1), 2);
  assert.equal(wrappedResultIndex(-1, 0, 1), -1);
});

test('find shortcuts require Ctrl or Command', () => {
  assert.equal(isFindShortcut({ key: 'f', ctrlKey: true, metaKey: false }), true);
  assert.equal(isFindShortcut({ key: 'F', ctrlKey: false, metaKey: true }), true);
  assert.equal(isFindShortcut({ key: 'f', ctrlKey: false, metaKey: false }), false);
});
