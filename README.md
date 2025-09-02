# DriveRead (Starter)

A static, client‑only EPUB reader for Google Drive.

- Frontend: Next.js (static export)
- Auth: Google Identity Services token client
- Storage: Google Drive (`drive.readonly`)
- Reader: epub.js
- Hosting: GitHub Pages (Org/User site)

## Quick start

1) **Google Cloud** (project: your `online-epub-reader`):
   - Enable **Google Drive API**.
   - OAuth consent screen: add `github.io` to authorised domains, add yourself as a test user.
   - Create **OAuth Client ID (Web)** with **Authorised JavaScript origin** `https://driveread.github.io`.
   - Copy the **Client ID**.

2) **Repo secret**
   - In GitHub repo: Settings → Secrets and variables → Actions → New secret  
     `NEXT_PUBLIC_GOOGLE_CLIENT_ID = <your client id>`

3) **Run locally**
```bash
npm ci
NEXT_PUBLIC_GOOGLE_CLIENT_ID="<id>.apps.googleusercontent.com" npm run dev
# build/export
NEXT_PUBLIC_GOOGLE_CLIENT_ID="<id>.apps.googleusercontent.com" npm run build
npx serve out -p 3000
```

4) **Deploy**
- Push to `main`. GitHub Action will build and publish to Pages.
- Visit `https://driveread.github.io`.

## Notes
- Tokens are kept in-memory only. No server is used.
- Optional roaming progress can be added later using Drive AppData scope.
