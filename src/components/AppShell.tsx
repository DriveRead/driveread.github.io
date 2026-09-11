import type { ReactNode } from 'react';
import type { Theme } from '@/src/lib/settings';

export default function AppShell({ theme, children }: { theme: Theme; children: ReactNode }) {
  return <div className={`app-shell theme-${theme}`} data-theme={theme}>{children}</div>;
}
