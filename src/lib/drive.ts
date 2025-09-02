export async function listEpubs(token: string) {
  const q = encodeURIComponent("mimeType='application/epub+zip' and trashed=false");
  const fields = encodeURIComponent('files(id,name,modifiedTime,size,iconLink)');
  const res = await fetch(
    `https://www.googleapis.com/drive/v3/files?q=${q}&fields=${fields}&pageSize=100&orderBy=modifiedTime desc`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  if (!res.ok) throw new Error('Drive list failed');
  return res.json() as Promise<{ files: Array<{ id: string; name: string }> }>;
}

export async function downloadArrayBuffer(token: string, fileId: string) {
  const res = await fetch(
    `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  if (!res.ok) throw new Error('Drive download failed');
  return res.arrayBuffer();
}
