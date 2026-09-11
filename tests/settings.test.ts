import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_SETTINGS, SETTINGS_KEY, deserializeSettings, loadSettings, normalizeSettings,
  resetSection, resetSettings, serializeSettings, updateSetting,
} from '../src/lib/settings.ts';

test('loads defaults when storage is empty', () => {
  assert.deepEqual(loadSettings({ getItem: () => null, setItem: () => {} }), DEFAULT_SETTINGS);
});
test('malformed JSON safely loads defaults', () => assert.deepEqual(deserializeSettings('{bad'), DEFAULT_SETTINGS));
test('migrates the original schema and fills new fields', () => {
  const migrated = deserializeSettings(JSON.stringify({ theme: 'dark', fontScale: 1.2, lineHeight: 1.8, fontFamily: 'serif', flow: 'scrolled-doc' }));
  assert.equal(migrated.version, 3); assert.equal(migrated.fontSize, 120); assert.equal(migrated.theme, 'dark');
  assert.equal(migrated.contentWidth, DEFAULT_SETTINGS.contentWidth);
});
test('validates contextual panel preferences', () => {
  const valid = normalizeSettings({ panelPinned: true, lastPinnedPanel: 'bookmarks' });
  assert.equal(valid.panelPinned, true); assert.equal(valid.lastPinnedPanel, 'bookmarks');
  const invalid = normalizeSettings({ panelPinned: 'yes', lastPinnedPanel: 'unknown' });
  assert.equal(invalid.panelPinned, false); assert.equal(invalid.lastPinnedPanel, null);
});
test('clamps all numeric settings', () => {
  const value = normalizeSettings({ fontSize: 999, lineHeight: -1, contentWidth: 1, pageMargins: 999, paragraphSpacing: -2 });
  assert.deepEqual([value.fontSize, value.lineHeight, value.contentWidth, value.pageMargins, value.paragraphSpacing], [200, 1.1, 480, 96, 0]);
});
test('rejects invalid enum values', () => {
  const value = normalizeSettings({ theme: 'neon', fontFamily: 'comic', flow: 'sideways', spread: 'triple', textAlignment: 'middle' });
  assert.equal(value.theme, DEFAULT_SETTINGS.theme); assert.equal(value.flow, DEFAULT_SETTINGS.flow); assert.equal(value.fontFamily, DEFAULT_SETTINGS.fontFamily);
});
test('resets a section without disturbing others and can reset all', () => {
  const changed = updateSetting(updateSetting(resetSettings(), 'theme', 'dark'), 'fontSize', 150);
  const reset = resetSection(changed, 'typography');
  assert.equal(reset.fontSize, DEFAULT_SETTINGS.fontSize); assert.equal(reset.theme, 'dark');
  assert.deepEqual(resetSettings(), DEFAULT_SETTINGS);
});
test('serialization round trips a normalized model', () => {
  const settings = updateSetting(resetSettings(), 'spread', 'both');
  assert.deepEqual(deserializeSettings(serializeSettings(settings)), settings);
  assert.equal(SETTINGS_KEY, 'driveread.settings.v1');
});
