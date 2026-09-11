export default function ReadingProgress({ page, total, locations, percent, onSeek }: { page: number | null; total: number | null; locations: number | null; percent: number | null; onSeek: (percentage: number) => void }) {
  const value = percent ?? 0;
  return <div className="reading-progress" aria-label="Reading progress">
    <label className="progress-slider"><span className="sr-only">Reading progress percentage</span><input type="range" min="0" max="100" step="1" value={value} disabled={percent === null} aria-valuetext={percent === null ? 'Progress unavailable' : `${percent} percent`} onChange={event => onSeek(Number(event.target.value))} /></label>
    <span className="progress-percent">{percent !== null ? `${percent}%` : '—'}</span>
    <span className="page-count">{page && total ? `About page ${page} of ${total}` : locations ? `About ${locations} locations` : 'Estimate unavailable'}</span>
  </div>;
}
