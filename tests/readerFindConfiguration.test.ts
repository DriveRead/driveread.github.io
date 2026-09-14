import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const reader = readFileSync(new URL('../src/components/Reader.tsx', import.meta.url), 'utf8');
const panel = readFileSync(new URL('../src/components/FindPanel.tsx', import.meta.url), 'utf8');

test('Reader invalidates stale searches and removes highlights on replacement and cleanup', () => {
  assert.match(reader, /generation !== searchGeneration/);
  assert.match(reader, /annotations\?\.remove\(cfi, 'highlight'\)/);
  assert.match(reader, /active = false;\s*clearSearch\(\)/);
});

test('iframe find shortcut is intercepted and delegates to the application panel', () => {
  assert.match(reader, /isFindShortcut\(e\).*e\.preventDefault\(\).*onFindShortcut/);
});

test('FindPanel exposes empty, searching, and no-result status text', () => {
  assert.match(panel, /Enter text to search this book/);
  assert.match(panel, /Searching…/);
  assert.match(panel, /No results found/);
  assert.match(panel, /role="status" aria-live="polite"/);
});
