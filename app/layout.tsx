import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'DriveRead',
  description: 'Read your EPUBs straight from Google Drive',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body
        style={{
          fontFamily:
            'system-ui, -apple-system, Segoe UI, Roboto, Ubuntu, Cantarell, Noto Sans, Arial, sans-serif',
        }}
      >
        {children}
      </body>
    </html>
  );
}
