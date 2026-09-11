import test from 'node:test';
import assert from 'node:assert/strict';
import { parseDriveLaunchState } from '../src/lib/driveLaunch.ts';

test('accepts an open launch with exactly one usable ID', () => {
  assert.deepEqual(parseDriveLaunchState('{"action":"open","ids":[" book-id "]}'), {
    status: 'valid',
    fileId: 'book-id',
  });
});

test('reports a missing state parameter as a direct visit', () => {
  assert.deepEqual(parseDriveLaunchState(null), { status: 'missing' });
});

test('rejects malformed JSON', () => {
  assert.equal(parseDriveLaunchState('{oops').status, 'invalid');
});

test('rejects an empty ID', () => {
  assert.equal(parseDriveLaunchState('{"action":"open","ids":["  "]}').status, 'invalid');
});

test('rejects multiple IDs', () => {
  assert.equal(parseDriveLaunchState('{"action":"open","ids":["one","two"]}').status, 'invalid');
});
