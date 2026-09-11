import test from 'node:test';
import assert from 'node:assert/strict';
import { panelReducer, restorePanel } from '../src/lib/contextualPanel.ts';

test('pins, unpins, and closes a contextual panel', () => {
  let state = panelReducer({ active: null, pinned: false }, { type: 'open', panel: 'settings', wide: true });
  state = panelReducer(state, { type: 'pin', wide: true });
  assert.deepEqual(state, { active: 'settings', pinned: true });
  assert.deepEqual(panelReducer(state, { type: 'unpin' }), { active: 'settings', pinned: false });
  assert.deepEqual(panelReducer(state, { type: 'close' }), { active: null, pinned: false });
});

test('opening another panel replaces the only pinned panel', () => {
  const state = panelReducer({ active: 'contents', pinned: true }, { type: 'open', panel: 'book-info', wide: true });
  assert.deepEqual(state, { active: 'book-info', pinned: true });
});

test('restores a preference only on wide viewports and preserves it for later', () => {
  assert.deepEqual(restorePanel(true, 'bookmarks', true), { active: 'bookmarks', pinned: true });
  assert.deepEqual(restorePanel(true, 'bookmarks', false), { active: null, pinned: false });
  assert.deepEqual(panelReducer({ active: 'settings', pinned: true }, { type: 'viewport', wide: false }), { active: 'settings', pinned: false });
});
