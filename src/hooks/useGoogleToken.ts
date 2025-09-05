import { useEffect, useState } from 'react';

declare global { interface Window { google: any } }

export function useGoogleToken(
  scope: string = 'https://www.googleapis.com/auth/drive.appdata https://www.googleapis.com/auth/drive.readonly'
) {
  const [token, setToken] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const onLoad = () => setReady(true);
    if (window.google) setReady(true);
    else window.addEventListener('load', onLoad);
    return () => window.removeEventListener('load', onLoad);
  }, []);

  function request() {
    const client = window.google?.accounts?.oauth2?.initTokenClient?.({
      client_id: process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID,
      scope,
      prompt: '',
      callback: (resp: any) => setToken(resp.access_token),
    });
    client?.requestAccessToken();
  }

  return { token, ready, request };
}
