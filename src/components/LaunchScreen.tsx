import type { DriveLaunchState } from '@/src/lib/driveLaunch';
import type { LaunchLifecycle } from '@/src/lib/launchLifecycle';
import ErrorState from './ErrorState';

export default function LaunchScreen({ launch, lifecycle, authReady, onAuthenticate, onRetry }: { launch: DriveLaunchState; lifecycle: LaunchLifecycle; authReady: boolean; onAuthenticate: () => void; onRetry: () => void }) {
  return <div className="launch-screen"><section className="launch-card" aria-labelledby="launch-title">
    <div className="brand-mark" aria-hidden="true">D</div><p className="eyebrow">DriveRead · your books, distraction-free</p>
    <h1 id="launch-title">Read an EPUB from Google Drive</h1>
    {lifecycle.status === 'recoverable-error' ? <ErrorState message={lifecycle.message} onRetry={lifecycle.fileId ? onRetry : undefined} retryLabel={lifecycle.retry === 'authenticate' ? 'Authenticate again' : 'Try download again'} />
      : lifecycle.status === 'awaiting-authentication' ? <div className="notice" role="status" aria-live="polite"><strong>Sign in to open this book</strong><p>Your browser requires you to start Google sign-in before DriveRead can access the selected book.</p><button type="button" onClick={onAuthenticate} disabled={!authReady}>{authReady ? 'Continue with Google' : 'Loading Google sign-in…'}</button></div>
      : lifecycle.status === 'requesting-access' ? <div className="notice" role="status" aria-live="polite"><strong>Waiting for Google authentication…</strong><p>Complete sign-in in the Google window to open the selected book.</p></div>
      : <p className="launch-intro">DriveRead opens only the EPUB you choose. Your book stays in your browser; reading position and preferences are saved so you can pick up where you left off.</p>}
    <div className="format-badge">Supported format: EPUB</div>
    <a className="primary-link" href="https://drive.google.com/drive/my-drive" target="_blank" rel="noreferrer">Open Google Drive <span aria-hidden="true">↗</span><span className="sr-only"> (opens in a new tab)</span></a>
    <ol className="drive-steps"><li>Find your EPUB in Google Drive.</li><li>Right-click and choose <strong>Open with</strong>.</li><li>Select <strong>DriveRead</strong>.</li></ol>
    {launch.status === 'missing' && <p className="direct-note">No file is selected yet. Choose one in Drive using the steps above.</p>}
  </section></div>;
}
