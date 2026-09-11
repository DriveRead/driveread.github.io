import test from 'node:test';
import assert from 'node:assert/strict';
import { addBookmark, dedupeBookmarks, mergeProgress, migrateProgress, READING_RECORD_VERSION } from '../src/lib/progress.ts';

const record = (cfi: string, updated: number) => ({ version: READING_RECORD_VERSION, cfi, updated, bookmarks: [] });

test('migrates legacy reading records without losing their location', () => {
  assert.deepEqual(migrateProgress({ book: { cfi: 'epubcfi(old)', updated: 10 } }).book, { version: 2, cfi: 'epubcfi(old)', updated: 10, bookmarks: [] });
});

test('merge uses the newer location and combines bookmarks', () => {
  const local = { book: { ...record('local', 20), bookmarks: [{ cfi: 'a', created: 1 }] } };
  const remote = { book: { ...record('remote', 10), bookmarks: [{ cfi: 'b', created: 2 }] } };
  assert.equal(mergeProgress(local, remote).book.cfi, 'local');
  assert.deepEqual(mergeProgress(local, remote).book.bookmarks.map(b => b.cfi), ['a', 'b']);
});

test('newer remote location wins over stale local location', () => {
  assert.equal(mergeProgress({ book: record('stale', 1) }, { book: record('new', 2) }).book.cfi, 'new');
});

test('bookmarks are deduplicated by CFI and newest annotation wins', () => {
  const result = dedupeBookmarks([{ cfi: 'same', created: 1, label: 'old' }, { cfi: 'same', created: 2, label: 'new' }]);
  assert.deepEqual(result, [{ cfi: 'same', created: 2, label: 'new' }]);
  assert.equal(addBookmark(record('here', 1), { cfi: 'mark', created: 3 }).bookmarks.length, 1);
});
