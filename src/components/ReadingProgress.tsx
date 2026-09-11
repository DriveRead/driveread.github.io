export default function ReadingProgress({ page, total, percent, paginated }: { page: number | null; total: number | null; percent: number | null; paginated: boolean }) {
  return <div className="reading-progress" aria-label="Reading progress">
    {paginated && <span className="page-count">{page && total ? `Page ${page} of ${total}` : 'Page —'}</span>}
    <span>{percent !== null ? `${percent}%` : '—'}</span>
  </div>;
}
