import test from 'node:test';
import assert from 'node:assert/strict';
import { googleTokenReducer, initialGoogleTokenState } from '../src/hooks/useGoogleToken.ts';
import { launchLifecycleReducer, type LaunchLifecycle } from '../src/lib/launchLifecycle.ts';

test('successful Drive launch follows every explicit lifecycle state', () => {
  let state: LaunchLifecycle = { status: 'no-launch' };
  state = launchLifecycleReducer(state, { type: 'VALID_LAUNCH', fileId: 'book' });
  assert.equal(state.status, 'awaiting-authentication');
  state = launchLifecycleReducer(state, { type: 'REQUEST_ACCESS' });
  assert.equal(state.status, 'requesting-access');
  state = launchLifecycleReducer(state, { type: 'AUTHENTICATED' });
  assert.equal(state.status, 'fetching-metadata');
  state = launchLifecycleReducer(state, { type: 'METADATA_LOADED' });
  assert.equal(state.status, 'downloading');
  state = launchLifecycleReducer(state, { type: 'OPENED' });
  assert.deepEqual(state, { status: 'ready', fileId: 'book' });
});

test('denied consent is a structured permission error', () => {
  const state = googleTokenReducer({ status: 'requesting', token: null, error: null }, { type: 'OAUTH_ERROR', denied: true });
  assert.equal(state.status, 'error');
  assert.equal(state.error?.kind, 'permission-denied');
  assert.equal(state.token, null);
});

test('script failure and invalid client ID have distinct errors', () => {
  const script = googleTokenReducer(initialGoogleTokenState, { type: 'SCRIPT_FAILED' });
  const config = googleTokenReducer(initialGoogleTokenState, { type: 'CONFIGURATION_ERROR' });
  assert.equal(script.error?.kind, 'script');
  assert.equal(config.error?.kind, 'configuration');
});

test('expired token preserves the selected file for authentication retry', () => {
  const state = launchLifecycleReducer(
    { status: 'downloading', fileId: 'selected-book' },
    { type: 'ERROR', kind: 'authentication', message: 'Expired', retry: 'authenticate' },
  );
  assert.deepEqual(state, { status: 'recoverable-error', fileId: 'selected-book', kind: 'authentication', message: 'Expired', retry: 'authenticate' });
  assert.equal(launchLifecycleReducer(state, { type: 'REQUEST_ACCESS' }).status, 'requesting-access');
});

test('download failure preserves the selected file for download retry', () => {
  const failed = launchLifecycleReducer(
    { status: 'downloading', fileId: 'selected-book' },
    { type: 'ERROR', kind: 'network', message: 'Offline', retry: 'download' },
  );
  assert.equal(failed.status, 'recoverable-error');
  assert.equal('fileId' in failed && failed.fileId, 'selected-book');
  assert.equal(launchLifecycleReducer(failed, { type: 'AUTHENTICATED' }).status, 'fetching-metadata');
});
