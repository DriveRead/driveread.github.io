export type LaunchErrorKind = 'permission-denied' | 'invalid-file' | 'missing-file' | 'network' | 'configuration' | 'authentication';
export type LaunchLifecycle =
  | { status: 'no-launch'; message?: string }
  | { status: 'awaiting-authentication'; fileId: string }
  | { status: 'requesting-access'; fileId: string }
  | { status: 'fetching-metadata'; fileId: string }
  | { status: 'downloading'; fileId: string }
  | { status: 'ready'; fileId: string }
  | { status: 'recoverable-error'; fileId?: string; kind: LaunchErrorKind; message: string; retry: 'authenticate' | 'download' | 'launch' };

export type LaunchAction =
  | { type: 'DIRECT_VISIT' }
  | { type: 'INVALID_LAUNCH'; message: string }
  | { type: 'VALID_LAUNCH'; fileId: string }
  | { type: 'REQUEST_ACCESS' }
  | { type: 'AUTHENTICATED' }
  | { type: 'METADATA_LOADED' }
  | { type: 'OPENED' }
  | { type: 'ERROR'; kind: LaunchErrorKind; message: string; retry: 'authenticate' | 'download' | 'launch' };

export function launchLifecycleReducer(state: LaunchLifecycle, action: LaunchAction): LaunchLifecycle {
  const fileId = 'fileId' in state ? state.fileId : undefined;
  switch (action.type) {
    case 'DIRECT_VISIT': return { status: 'no-launch' };
    case 'INVALID_LAUNCH': return { status: 'recoverable-error', kind: 'invalid-file', message: action.message, retry: 'launch' };
    case 'VALID_LAUNCH': return { status: 'awaiting-authentication', fileId: action.fileId };
    case 'REQUEST_ACCESS': return fileId ? { status: 'requesting-access', fileId } : state;
    case 'AUTHENTICATED': return fileId ? { status: 'fetching-metadata', fileId } : state;
    case 'METADATA_LOADED': return fileId ? { status: 'downloading', fileId } : state;
    case 'OPENED': return fileId ? { status: 'ready', fileId } : state;
    case 'ERROR': return { status: 'recoverable-error', ...(fileId ? { fileId } : {}), kind: action.kind, message: action.message, retry: action.retry };
    default: return state;
  }
}
