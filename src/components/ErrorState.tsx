export default function ErrorState({ message, retryLabel, onRetry }: { message: string; retryLabel?: string; onRetry?: () => void }) {
  return <div className="error-state" role="alert" aria-live="assertive"><strong>We couldn’t open this book.</strong><p>{message}</p>{onRetry && <button type="button" onClick={onRetry}>{retryLabel || 'Try again'}</button>}</div>;
}
