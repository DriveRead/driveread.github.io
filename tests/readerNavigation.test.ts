import test from 'node:test';
import assert from 'node:assert/strict';
import { adjacentChapter, flattenToc, isEditableTarget } from '../src/lib/readerNavigation.ts';

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
