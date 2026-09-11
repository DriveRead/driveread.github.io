export type DriveLaunchState =
  | { status: 'missing' }
  | { status: 'valid'; fileId: string }
  | { status: 'invalid'; message: string };

/** Parse and validate the `state` query parameter sent by a Drive "Open with" launch. */
export function parseDriveLaunchState(state: string | null): DriveLaunchState {
  if (state === null) return { status: 'missing' };

  let value: unknown;
  try {
    value = JSON.parse(state);
  } catch {
    return {
      status: 'invalid',
      message: 'Google Drive sent launch information that DriveRead could not understand.',
    };
  }

  if (!value || typeof value !== 'object') {
    return { status: 'invalid', message: 'This Google Drive launch is missing its file information.' };
  }

  const launch = value as { action?: unknown; ids?: unknown };
  if (launch.action !== 'open') {
    return { status: 'invalid', message: 'DriveRead only supports Google Drive “Open with” launches.' };
  }
  if (!Array.isArray(launch.ids) || launch.ids.length !== 1) {
    return { status: 'invalid', message: 'Please open exactly one EPUB at a time from Google Drive.' };
  }

  const [id] = launch.ids;
  if (typeof id !== 'string' || id.trim().length === 0) {
    return { status: 'invalid', message: 'The Google Drive launch did not include a usable file ID.' };
  }

  return { status: 'valid', fileId: id.trim() };
}
