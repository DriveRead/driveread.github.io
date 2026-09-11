import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { READER_FONT_ASSETS } from '../src/lib/readerAssets.ts';

const readerSource = readFileSync(resolve('src/components/Reader.tsx'), 'utf8');

test('EPUB scripted content is disabled while standard rendition features remain configured', () => {
  assert.match(readerSource, /allowScriptedContent:\s*false/);
  assert.doesNotMatch(readerSource, /allowScriptedContent:\s*true/);
  assert.match(readerSource, /rendition\.display\(/, 'rendition navigation remains enabled');
  assert.match(readerSource, /classifyEpubLink/, 'ordinary and external links are classified');
});

test('rendition listeners, document listeners, controls, and book resources are cleaned up', () => {
  for (const assertion of [
    /rendition\.off\?\.\('rendered'/,
    /rendition\.off\?\.\('relocated'/,
    /removeEventListener\('keydown'/,
    /removeEventListener\('click'/,
    /onReady\?\.\(null\)/,
    /book\.destroy\(\)/,
  ]) assert.match(readerSource, assertion);
});

test('every configured reader font exists at its deployed public path', () => {
  for (const [, assetPath] of READER_FONT_ASSETS) {
    assert.equal(existsSync(resolve('public', assetPath)), true, `missing public/${assetPath}`);
  }
});
