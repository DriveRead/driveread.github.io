# DriveRead

A static, client-only EPUB reader launched through Google Drive's **Open with** menu.

- Frontend: Next.js static export
- Authentication: Google Identity Services token client
- File access: Google Drive `drive.file` (only files explicitly opened with DriveRead)
- Progress sync: Google Drive `drive.appdata`
- Reader: epub.js

## Set up Google Cloud

Follow the complete [Google Cloud and Drive UI integration guide](docs/google-cloud-setup.md). It covers the OAuth client, the least-privilege scopes, and registering DriveRead as an EPUB **Open with** handler.

DriveRead deliberately does not request `drive.readonly` and does not list a user's files. The `drive.appdata` scope is included only because reading progress currently syncs to the app's private Drive data folder; remove the remote-progress feature and that scope together if roaming progress is not wanted.

## Run locally

```bash
npm ci
NEXT_PUBLIC_GOOGLE_CLIENT_ID="<id>.apps.googleusercontent.com" npm run dev

# Build and serve the static export
NEXT_PUBLIC_GOOGLE_CLIENT_ID="<id>.apps.googleusercontent.com" npm run build
npx serve out -p 3000
```

Tokens stay in memory; DriveRead has no server. When launched from Drive, it validates the launch payload, requests authentication, verifies the selected file is an EPUB, and downloads that single file. A direct visit does not authenticate or display a file browser—instead, the landing page explains how to open a book from Drive.

## Deploy

Set `NEXT_PUBLIC_GOOGLE_CLIENT_ID` in **GitHub repository → Settings → Secrets and variables → Actions**, then push to `main`; the GitHub Actions workflow builds and publishes the Pages site.
## Reader interactions and responsive layout

DriveRead uses a reader-first, single-column workspace. At narrow-phone (up to 600px), tablet (601–900px), laptop (901–1399px), and wide-desktop (1400px and above) widths, the reading surface remains the primary content. Toolbar labels collapse below 900px. Contents and reading settings open as full-height drawers on phones and dismissible side sheets on larger screens. Controls are at least 44px high, and the toolbar, sheets, and focus controls account for device safe areas.

Keyboard interactions:

- `Left Arrow` and `Right Arrow` move between pages in paginated flow, including while focus is inside the EPUB frame.
- `+`/`=` and `-` increase and decrease type size; `D` toggles the dark theme.
- `Tab` and `Shift+Tab` cycle within an open Contents or Settings sheet. `Escape` closes a sheet and restores focus to its trigger.
- “Enter focus mode” hides the main toolbar. Its persistent bottom controls remain available, and `Escape` always exits focus mode.

Touch interactions:

- Tap the left or right edge of a paginated book to turn pages, or use the Previous and Next toolbar controls.
- Tap Contents or Settings to open a drawer; tap the dimmed backdrop or the labelled close button to dismiss it.
- In distraction-free mode, the low-emphasis controls at the bottom become fully visible on interaction and always include an Exit focus button.
