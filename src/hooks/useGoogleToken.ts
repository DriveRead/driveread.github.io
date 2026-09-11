import { useCallback, useEffect, useReducer } from 'react';

declare global { interface Window { google: any } }

export type GoogleAuthError = {
  kind: 'configuration' | 'script' | 'permission-denied' | 'oauth';
  message: string;
};

export type GoogleTokenState =
  | { status: 'loading-script'; token: null; error: null }
  | { status: 'ready'; token: null; error: null }
  | { status: 'requesting'; token: null; error: null }
  | { status: 'authenticated'; token: string; error: null }
  | { status: 'error'; token: null; error: GoogleAuthError };

export type GoogleTokenAction =
  | { type: 'SCRIPT_LOADED' }
  | { type: 'SCRIPT_FAILED' }
  | { type: 'REQUEST' }
  | { type: 'TOKEN'; token: string }
  | { type: 'OAUTH_ERROR'; denied?: boolean }
  | { type: 'CONFIGURATION_ERROR' }
  | { type: 'CLEAR_TOKEN' };

export const initialGoogleTokenState: GoogleTokenState = { status: 'loading-script', token: null, error: null };

export function googleTokenReducer(state: GoogleTokenState, action: GoogleTokenAction): GoogleTokenState {
  switch (action.type) {
    case 'SCRIPT_LOADED': return { status: 'ready', token: null, error: null };
    case 'SCRIPT_FAILED': return { status: 'error', token: null, error: { kind: 'script', message: 'Google authentication could not be loaded. Check your connection and try again.' } };
    case 'REQUEST': return { status: 'requesting', token: null, error: null };
    case 'TOKEN': return { status: 'authenticated', token: action.token, error: null };
    case 'OAUTH_ERROR': return { status: 'error', token: null, error: action.denied
      ? { kind: 'permission-denied', message: 'Access was not granted. DriveRead needs permission to open the selected book.' }
      : { kind: 'oauth', message: 'Google could not complete authentication. Please try again.' } };
    case 'CONFIGURATION_ERROR': return { status: 'error', token: null, error: { kind: 'configuration', message: 'DriveRead is not configured with a valid Google client ID.' } };
    case 'CLEAR_TOKEN': return { status: 'ready', token: null, error: null };
    default: return state;
  }
}

export function useGoogleToken(
  scope: string = 'https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/drive.appdata'
) {
  const [state, dispatch] = useReducer(googleTokenReducer, initialGoogleTokenState);
  const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;

  // A missed Script callback must not leave authentication disabled forever.
  useEffect(() => {
    if (window.google?.accounts?.oauth2) dispatch({ type: 'SCRIPT_LOADED' });
    const timeout = window.setTimeout(() => {
      if (!window.google?.accounts?.oauth2) dispatch({ type: 'SCRIPT_FAILED' });
    }, 10_000);
    return () => window.clearTimeout(timeout);
  }, []);

  const scriptLoaded = useCallback(() => dispatch(clientId ? { type: 'SCRIPT_LOADED' } : { type: 'CONFIGURATION_ERROR' }), [clientId]);
  const scriptFailed = useCallback(() => dispatch({ type: 'SCRIPT_FAILED' }), []);

  const request = useCallback(() => {
    if (!clientId) {
      dispatch({ type: 'CONFIGURATION_ERROR' });
      return;
    }
    const initialize = window.google?.accounts?.oauth2?.initTokenClient;
    if (!initialize) {
      dispatch({ type: 'SCRIPT_FAILED' });
      return;
    }
    dispatch({ type: 'REQUEST' });
    try {
      const client = initialize({
        client_id: clientId,
        scope,
        prompt: '',
        callback: (response: { access_token?: string; error?: string }) => {
          if (response.error || !response.access_token) {
            dispatch({ type: 'OAUTH_ERROR', denied: response.error === 'access_denied' });
          } else {
            dispatch({ type: 'TOKEN', token: response.access_token });
          }
        },
        error_callback: () => dispatch({ type: 'OAUTH_ERROR' }),
      });
      client.requestAccessToken();
    } catch {
      dispatch({ type: 'OAUTH_ERROR' });
    }
  }, [clientId, scope]);

  return {
    ...state,
    request,
    retry: request,
    clearToken: useCallback(() => dispatch({ type: 'CLEAR_TOKEN' }), []),
    scriptLoaded,
    scriptFailed,
  };
}
