// src/lib/drive.ts

import type { Progress } from './progress';

type FolderInfo = {
  name: string;
  parent?: string;
};

type DriveFileResource = {
  id: string;
  name: string;
  modifiedTime: string;
  parents?: string[];
  size: string;
  iconLink: string;
};

type DriveFolderResource = {
  id: string;
  name: string;
  parents?: string[];
};

const isDebug = typeof window !== 'undefined' && window.location.search.includes('debug=true');

export async function listEpubs(token: string) {
  if (isDebug) console.log('listEpubs: fetching epubs...');
  const epubRes = await fetch(`https://www.googleapis.com/drive/v3/files?q=mimeType='application/epub+zip' and trashed=false&fields=files(id,name,modifiedTime,parents,size,iconLink)&pageSize=1000&orderBy=modifiedTime desc`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  if (!epubRes.ok) throw new Error(await epubRes.text());
  const epubData: { files: DriveFileResource[] } = await epubRes.json();
  if (isDebug) console.log('listEpubs: received epub data', epubData);


  if (isDebug) console.log('listEpubs: fetching folders...');
  const folderRes = await fetch(`https://www.googleapis.com/drive/v3/files?q=mimeType='application/vnd.google-apps.folder' and trashed=false&fields=files(id,name,parents)&pageSize=1000`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  if (!folderRes.ok) throw new Error(await folderRes.text());
  const folderData: { files: DriveFolderResource[] } = await folderRes.json();
  if (isDebug) console.log('listEpubs: received folder data', folderData);

  const folders = new Map<string, FolderInfo>(
    folderData.files.map((f) => [f.id, { name: f.name, parent: f.parents?.[0] }]),
  );

  function getPath(folderId?: string): string {
    const pathParts: string[] = [];
    let currentFolderId = folderId;
    while (currentFolderId && folders.has(currentFolderId)) {
      const folder = folders.get(currentFolderId)!;
      pathParts.unshift(folder.name);
      currentFolderId = folder.parent;
    }
    return pathParts.length > 0 ? '/' + pathParts.join('/') : '';
  }

  const filesWithPaths = epubData.files.map((f) => ({
    ...f,
    path: getPath(f.parents?.[0]),
  }));

  if (isDebug) console.log('listEpubs: processed files with paths', filesWithPaths);

  return { files: filesWithPaths };
}

export async function downloadArrayBuffer(token: string, id: string) {
  if (isDebug) console.log(`downloadArrayBuffer: downloading file ${id}`);
  const res = await fetch(`https://www.googleapis.com/drive/v3/files/${id}?alt=media`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  if (!res.ok) {
    const errorText = await res.text();
    if (isDebug) console.error(`downloadArrayBuffer: failed to download file ${id}`, errorText);
    throw new Error(errorText);
  }
  const buffer = await res.arrayBuffer();
  if (isDebug) console.log(`downloadArrayBuffer: downloaded file ${id}, size: ${buffer.byteLength} bytes`);
  return buffer;
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
