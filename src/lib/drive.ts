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

export async function getFileMetadata(token: string, id: string): Promise<DriveFileMetadata> {
  const fields = 'id,name,mimeType,fileExtension,size,modifiedTime';
  const res = await fetch(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(id)}?fields=${fields}`, {
    headers: { 'Authorization': `Bearer ${token}` },
  });
  if (!res.ok) throw new Error('DriveRead could not access the selected Google Drive file.');
  return res.json();
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
    throw new Error(`“${metadata.name}” is not an EPUB file. Choose an .epub book in Google Drive.`);
  }
  if (isDebug) console.log(`downloadEpub: downloading file ${id}`);
  const res = await fetch(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(id)}?alt=media`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  if (!res.ok) {
    const errorText = await res.text();
    if (isDebug) console.error(`downloadEpub: failed to download file ${id}`, errorText);
    throw new Error(errorText);
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
