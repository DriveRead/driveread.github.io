import test from 'node:test';
import assert from 'node:assert/strict';
import { downloadEpub, DriveError } from '../src/lib/drive.ts';

test('rejects a launched non-EPUB before attempting a media download', async (t) => {
  let requests = 0;
  t.mock.method(globalThis, 'fetch', async () => {
    requests += 1;
    return new Response(JSON.stringify({
      id: 'document-id',
      name: 'notes.pdf',
      mimeType: 'application/pdf',
      fileExtension: 'pdf',
      size: '1234',
      modifiedTime: '2026-09-11T00:00:00Z',
    }), { status: 200, headers: { 'content-type': 'application/json' } });
  });

  await assert.rejects(
    downloadEpub('token', 'document-id'),
    /“notes\.pdf” is not an EPUB file/,
  );
  assert.equal(requests, 1, 'only the metadata endpoint should be requested');
});

test('maps a 401 without exposing the Google response body', async (t) => {
  t.mock.method(globalThis, 'fetch', async () => new Response('secret raw Google body', { status: 401 }));
  await assert.rejects(downloadEpub('expired', 'book'), (error: unknown) => {
    assert.ok(error instanceof DriveError);
    assert.equal(error.code, 'unauthorized');
    assert.doesNotMatch(error.message, /secret raw Google body/);
    return true;
  });
});
