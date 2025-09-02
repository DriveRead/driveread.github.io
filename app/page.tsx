'use client';

import Script from 'next/script';
import { useEffect, useState } from 'react';
import { useGoogleToken } from '@/src/hooks/useGoogleToken';
import { listEpubs, downloadArrayBuffer } from '@/src/lib/drive';
import Reader from '@/src/components/Reader';

type DriveFile = { id: string; name: string };

export default function Home() {
  const { token, ready, request } = useGoogleToken();
  const [files, setFiles] = useState<DriveFile[]>([]);
  const [bytes, setBytes] = useState<ArrayBuffer | null>(null);
  const [cfi, setCfi] = useState<string | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    listEpubs(token).then(d => setFiles(d.files)).catch(e => setError(String(e)));
  }, [token]);

  async function openFile(id: string) {
    if (!token) return;
    try {
      const buf = await downloadArrayBuffer(token, id);
      setBytes(buf);
      // TODO: load saved CFI from IndexedDB by fileId
    } catch (e:any) {
      setError(String(e));
    }
  }

  return (
    <>
      <Script src="https://accounts.google.com/gsi/client" async defer />
      <header style={{ display:'flex', gap:12, alignItems:'center', padding:12, borderBottom:'1px solid #e5e5e5' }}>
        <h1 style={{ margin:0, fontSize:18 }}>DriveRead</h1>
        {!token && (
          <button onClick={request} disabled={!ready} style={{ marginLeft:'auto', padding:'6px 10px' }}>
            Sign in with Google
          </button>
        )}
      </header>

      <div style={{ display:'grid', gridTemplateColumns:'320px 1fr', gap:16, padding:16, height:'calc(100vh - 58px)' }}>
        <aside style={{ overflow:'auto', border:'1px solid #ddd', borderRadius:8, padding:8 }}>
          <h3 style={{ marginTop:0 }}>Your Drive EPUBs</h3>
          {!token && <p>Sign in to list files.</p>}
          {error && <p style={{ color:'#b00' }}>{error}</p>}
          {files.map(f => (
            <button key={f.id} onClick={() => openFile(f.id)}
              style={{ display:'block', width:'100%', textAlign:'left', padding:'6px 8px', borderRadius:6, border:'1px solid #eee', marginBottom:6 }}>
              {f.name}
            </button>
          ))}
        </aside>
        <main style={{ border:'1px solid #ddd', borderRadius:8, height:'100%', overflow:'hidden' }}>
          {bytes
            ? <Reader bytes={bytes} startCfi={cfi} onRelocate={setCfi} />
            : <div style={{ height:'100%', display:'grid', placeItems:'center', color:'#888' }}>Pick a book…</div>}
        </main>
      </div>
    </>
  );
}
