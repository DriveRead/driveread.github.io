'use client';
import { useEffect, useState } from 'react';

export type TocItem = { href: string; label: string; children?: TocItem[] };
const base = (href: string) => href.split('#')[0];

function containsCurrent(item: TocItem, href: string | null): boolean {
  return Boolean(href && (base(item.href) === base(href) || item.children?.some(child => containsCurrent(child, href))));
}

function TocBranch({ item, currentHref, query, onSelect }: { item: TocItem; currentHref: string | null; query: string; onSelect: (href: string) => void }) {
  const currentBranch = containsCurrent(item, currentHref);
  const [expanded, setExpanded] = useState(currentBranch);
  const children = item.children || [];
  const matches = item.label.toLocaleLowerCase().includes(query) || children.some(child => containsQuery(child, query));
  useEffect(() => { if (currentBranch || query) setExpanded(true); }, [currentBranch, query]);
  if (!matches) return null;
  return <li>
    <div className="contents-entry">
      {children.length > 0 && <button className="tree-toggle" aria-label={`${expanded ? 'Collapse' : 'Expand'} ${item.label}`} aria-expanded={expanded} onClick={() => setExpanded(value => !value)}>{expanded ? '▾' : '▸'}</button>}
      <button className="chapter-link" aria-current={currentHref && base(item.href) === base(currentHref) ? 'location' : undefined} onClick={() => onSelect(item.href)}>{item.label}</button>
    </div>
    {children.length > 0 && expanded && <ul>{children.map((child, index) => <TocBranch key={`${child.href}-${index}`} item={child} currentHref={currentHref} query={query} onSelect={onSelect} />)}</ul>}
  </li>;
}

function containsQuery(item: TocItem, query: string): boolean {
  return !query || item.label.toLocaleLowerCase().includes(query) || Boolean(item.children?.some(child => containsQuery(child, query)));
}

export default function ContentsPanel({ items, currentHref, onSelect }: { items: TocItem[]; currentHref: string | null; onSelect: (href: string) => void }) {
  const [query, setQuery] = useState('');
  const normalizedQuery = query.trim().toLocaleLowerCase();
  const hasMatches = items.some(item => containsQuery(item, normalizedQuery));
  return <>
    <label className="contents-search"><span className="sr-only">Search contents</span><input type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Search contents" /></label>
    <nav aria-label="Book chapters" className="contents-list">{items.length && hasMatches ? <ul className="contents-tree">{items.map((item, index) => <TocBranch key={`${item.href}-${index}`} item={item} currentHref={currentHref} query={normalizedQuery} onSelect={onSelect} />)}</ul> : <p className="empty-state">{items.length ? 'No matching chapters.' : 'No table of contents is available.'}</p>}</nav>
  </>;
}
