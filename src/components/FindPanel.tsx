'use client';
import type { SearchResult } from '@/src/lib/readerSearch';

export default function FindPanel({ query, results, current, searching, onQuery, onPrevious, onNext, onClear, onSelect }: { query: string; results: SearchResult[]; current: number; searching: boolean; onQuery: (query: string) => void; onPrevious: () => void; onNext: () => void; onClear: () => void; onSelect: (index: number) => void }) {
  const status = searching ? 'Searching…' : !query ? 'Enter text to search this book.' : results.length ? `${results.length} result${results.length === 1 ? '' : 's'}${current >= 0 ? `, result ${current + 1} selected` : ''}` : 'No results found.';
  return <div className="find-panel panel-body">
    <label className="find-field"><span>Find in book</span><input autoFocus type="search" value={query} onChange={event => onQuery(event.target.value)} /></label>
    <p className="find-status" role="status" aria-live="polite">{status}</p>
    <div className="find-actions"><button onClick={onPrevious} disabled={!results.length}>Previous result</button><button onClick={onNext} disabled={!results.length}>Next result</button><button onClick={onClear} disabled={!query && !results.length}>Clear</button></div>
    {results.length > 0 && <ol className="find-results">{results.map((result, index) => <li key={`${result.cfi}-${index}`}><button aria-current={index === current ? 'true' : undefined} onClick={() => onSelect(index)}><strong>{result.chapter}</strong><span dangerouslySetInnerHTML={{ __html: result.excerpt }} /></button></li>)}</ol>}
  </div>;
}
