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

export async function listEpubs(token: string) {
  const epubRes = await fetch(`https://www.googleapis.com/drive/v3/files?q=mimeType='application/epub+zip' and trashed=false&fields=files(id,name,modifiedTime,parents,size,iconLink)&pageSize=1000&orderBy=modifiedTime desc`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  if (!epubRes.ok) throw new Error(await epubRes.text());
  const epubData: { files: DriveFileResource[] } = await epubRes.json();

  const folderRes = await fetch(`https://www.googleapis.com/drive/v3/files?q=mimeType='application/vnd.google-apps.folder' and trashed=false&fields=files(id,name,parents)&pageSize=1000`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  if (!folderRes.ok) throw new Error(await folderRes.text());
  const folderData: { files: DriveFolderResource[] } = await folderRes.json();
  const folders = new Map<string, FolderInfo>(
    folderData.files.map((f) => [f.id, { name: f.name, parent: f.parents?.[0] }]),
  );

  function getPath(folderId?: string): string {
    if (!folderId || !folders.has(folderId)) return '';
    const folder = folders.get(folderId)!;
    return getPath(folder.parent) + '/' + folder.name;
  }

  const filesWithPaths = epubData.files.map((f) => ({
    ...f,
    path: getPath(f.parents?.[0]),
  }));

  return { files: filesWithPaths };
}

export async function downloadArrayBuffer(token: string, id: string) {
  const res = await fetch(`https://www.googleapis.com/drive/v3/files/${id}?alt=media`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  if (!res.ok) throw new Error(await res.text());
  return res.arrayBuffer();
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
