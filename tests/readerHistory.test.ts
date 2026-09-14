import test from 'node:test';
import assert from 'node:assert/strict';
import { emptyReaderHistory, recordLocation, traverseHistory } from '../src/lib/readerHistory.ts';

test('history records unique relocations and traverses without duplicates', () => {
  let history = recordLocation(emptyReaderHistory(), 'one');
  history = recordLocation(history, 'two');
  history = recordLocation(history, 'two');
  assert.deepEqual(history.entries, ['one', 'two']);
  const back = traverseHistory(history, -1);
  assert.equal(back.cfi, 'one');
  assert.deepEqual(recordLocation(back.history, 'one'), back.history);
  assert.equal(traverseHistory(back.history, 1).cfi, 'two');
});

test('recording after going back discards forward history', () => {
  let history = recordLocation(recordLocation(recordLocation(emptyReaderHistory(), 'a'), 'b'), 'c');
  history = traverseHistory(history, -1).history;
  assert.deepEqual(recordLocation(history, 'd').entries, ['a', 'b', 'd']);
});
