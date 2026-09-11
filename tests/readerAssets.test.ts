import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { readerFontStylesheet, READER_FONT_ASSETS } from '../src/lib/readerAssets.ts';

const expectedFamilies = ['Open Dyslexic', 'Atkinson Hyperlegible', 'Roboto', 'Roboto Mono'];

test('font stylesheet contains one complete face for every exact reader family', () => {
  const css = readerFontStylesheet();
  assert.equal((css.match(/@font-face\s*{/g) || []).length, expectedFamilies.length);
  assert.deepEqual(READER_FONT_ASSETS.map(([family]) => family), expectedFamilies);
  for (const family of expectedFamilies) {
    assert.match(css, new RegExp(`font-family: "${family}";`));
  }
  assert.equal((css.match(/font-style: normal;/g) || []).length, expectedFamilies.length);
  assert.equal((css.match(/font-weight: 400;/g) || []).length, expectedFamilies.length);
  assert.equal((css.match(/font-display: swap;/g) || []).length, expectedFamilies.length);
  assert.equal((css.match(/format\("woff2"\)/g) || []).length, expectedFamilies.length);
});

test('font stylesheet URLs honor NEXT_PUBLIC_BASE_PATH', () => {
  const previous = process.env.NEXT_PUBLIC_BASE_PATH;
  process.env.NEXT_PUBLIC_BASE_PATH = '/reader/';
  try {
    const css = readerFontStylesheet();
    for (const [, path] of READER_FONT_ASSETS) assert.match(css, new RegExp(`url\\("/reader/${path}"\\)`));
  } finally {
    if (previous === undefined) delete process.env.NEXT_PUBLIC_BASE_PATH;
    else process.env.NEXT_PUBLIC_BASE_PATH = previous;
  }
});

test('Reader uses supported font APIs and installs fonts for every rendered document', () => {
  const source = readFileSync(resolve('src/components/Reader.tsx'), 'utf8');
  assert.doesNotMatch(source, /\.registerFont\s*\(/);
  assert.match(source, /hooks\.content\.register\(injectReaderFonts\)/);
  assert.match(source, /addStylesheetCss\(fontCss, 'driveread-fonts'\)/);
  assert.match(source, /r\.themes\.font\(cssFamily\)/);
  assert.doesNotMatch(source, /themes\.override\('font-family'/);
  assert.match(source, /doc\.fonts\?\.ready/);
});
