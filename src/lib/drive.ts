// src/lib/drive.ts

import type { Progress } from './progress';

export type DriveFileMetadata = {
  id: string;
  name: string;
  mimeType: string;
  fileExtension?: string;
  modifiedTime: string;
  size?: string;
};

const isDebug = typeof window !== 'undefined' && window.location.search.includes('debug=true');

export type DriveErrorCode = 'unauthorized' | 'permission-denied' | 'missing-file' | 'network' | 'invalid-response';
export class DriveError extends Error {
  readonly code: DriveErrorCode;
  constructor(code: DriveErrorCode, message: string) { super(message); this.code = code; this.name = 'DriveError'; }
}

function responseError(status: number): DriveError {
  if (status === 401) return new DriveError('unauthorized', 'Your Google session expired. Authenticate again to open this book.');
  if (status === 403) return new DriveError('permission-denied', 'Google Drive denied access to this book. Grant access and try again.');
  if (status === 404) return new DriveError('missing-file', 'This book is missing or was deleted from Google Drive.');
  return new DriveError('network', 'Google Drive could not be reached. Check your connection and try again.');
}

export async function getFileMetadata(token: string, id: string): Promise<DriveFileMetadata> {
  const fields = 'id,name,mimeType,fileExtension,size,modifiedTime';
  let res: Response;
  try { res = await fetch(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(id)}?fields=${fields}`, { headers: { 'Authorization': `Bearer ${token}` } }); }
  catch { throw new DriveError('network', 'Google Drive could not be reached. Check your connection and try again.'); }
  if (!res.ok) throw responseError(res.status);
  try { return await res.json(); } catch { throw new DriveError('invalid-response', 'Google Drive returned invalid file information. Try opening the book again.'); }
}

export async function downloadEpub(
  token: string,
  id: string,
  onMetadata?: (metadata: DriveFileMetadata) => void,
) {
  const metadata = await getFileMetadata(token, id);
  onMetadata?.(metadata);
  const hasEpubExtension = metadata.fileExtension?.toLowerCase() === 'epub' || metadata.name.toLowerCase().endsWith('.epub');
  if (metadata.mimeType !== 'application/epub+zip' && !hasEpubExtension) {
    throw new DriveError('invalid-response', `“${metadata.name}” is not an EPUB file. Choose an .epub book in Google Drive.`);
  }
  if (isDebug) console.log(`downloadEpub: downloading file ${id}`);
  let res: Response;
  try { res = await fetch(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(id)}?alt=media`, { headers: { 'Authorization': `Bearer ${token}` } }); }
  catch { throw new DriveError('network', 'The book download was interrupted. Check your connection and try again.'); }
  if (!res.ok) {
    if (isDebug) console.error(`downloadEpub: failed to download file ${id} (${res.status})`);
    throw responseError(res.status);
  }
  const buffer = await res.arrayBuffer();
  if (isDebug) console.log(`downloadEpub: downloaded file ${id}, size: ${buffer.byteLength} bytes`);
  return { metadata, buffer };
}

const PROGRESS_FILE_NAME = 'progress.json';

async function getProgressFileId(token: string): Promise<string | null> {
  const res = await fetch(`https://www.googleapis.com/drive/v3/files?spaces=appDataFolder&fields=files(id,name)`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  if (!res.ok) throw new Error(await res.text());
  const data = await res.json();
  const file = data.files.find((f: any) => f.name === PROGRESS_FILE_NAME);
  return file ? file.id : null;
}

export async function loadRemoteProgress(token: string): Promise<Progress | null> {
  const fileId = await getProgressFileId(token);
  if (!fileId) return null;

  const res = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  if (!res.ok) {
    if (res.status === 404) return null;
    throw new Error(await res.text());
  }
  return res.json();
}

export async function saveRemoteProgress(token: string, progress: Progress) {
  const fileId = await getProgressFileId(token);
  const metadata = { name: PROGRESS_FILE_NAME, mimeType: 'application/json', ...(fileId ? {} : { parents: ['appDataFolder'] }) };
  const form = new FormData();
  form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
  form.append('file', new Blob([JSON.stringify(progress)], { type: 'application/json' }));

  const res = await fetch(`https://www.googleapis.com/upload/drive/v3/files/${fileId || ''}?uploadType=multipart`, {
    method: fileId ? 'PATCH' : 'POST',
    headers: { 'Authorization': `Bearer ${token}` },
    body: form
  });
  if (!res.ok) throw new Error(await res.text());
}
