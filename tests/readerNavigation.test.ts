import test from 'node:test';
import assert from 'node:assert/strict';
import { adjacentChapter, flattenToc, initialReadingTarget, isEditableTarget } from '../src/lib/readerNavigation.ts';

const toc = [{ href: 'one', label: 'One', children: [{ href: 'two', label: 'Two' }] }, { href: 'three', label: 'Three' }];
test('chapter navigation respects nested order and boundaries', () => {
  assert.deepEqual(flattenToc(toc).map(i => i.href), ['one', 'two', 'three']);
  assert.equal(adjacentChapter(toc, 'one', -1), null);
  assert.equal(adjacentChapter(toc, 'one', 1)?.href, 'two');
  assert.equal(adjacentChapter(toc, 'three', 1), null);
});

test('reading shortcuts are suppressed in editable controls', () => {
  const editable = { closest: () => ({ tagName: 'INPUT' }) } as unknown as EventTarget;
  const page = { closest: () => null } as unknown as EventTarget;
  assert.equal(isEditableTarget(editable), true);
  assert.equal(isEditableTarget(page), false);
});

test('reader falls back when a book has no linear section', () => {
  const firstSection = { href: 'cover.xhtml' };
  const spine = {
    get: (target?: string) => target === 'epubcfi(/valid)' ? firstSection : null,
    spineItems: [firstSection],
  };

  assert.equal(initialReadingTarget(spine), 0);
  assert.equal(initialReadingTarget(spine, 'epubcfi(/missing)'), 0);
  assert.equal(initialReadingTarget(spine, 'epubcfi(/valid)'), 'epubcfi(/valid)');
});

test('reader keeps epub.js default selection when a linear section exists', () => {
  const firstSection = { href: 'chapter.xhtml' };
  const spine = { get: () => firstSection, spineItems: [firstSection] };

  assert.equal(initialReadingTarget(spine), undefined);
});
