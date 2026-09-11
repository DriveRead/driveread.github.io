# Google Cloud setup

DriveRead is a Google Drive **Open with** application. It does not browse or list a user's Drive.

## API and OAuth configuration

1. Create or select a Google Cloud project and enable the **Google Drive API**.
2. Configure the OAuth consent screen. Add the deployed domain as an authorized domain and add test users while the app is in testing.
3. Add only these scopes:
   - `https://www.googleapis.com/auth/drive.file` — access to files that the user explicitly opens with DriveRead.
   - `https://www.googleapis.com/auth/drive.appdata` — access to DriveRead's hidden `appDataFolder`, used for roaming reading progress. Remove this scope and the remote-progress calls if that feature is disabled.
4. Create a **Web application** OAuth client. Add the deployed site (for example, `https://driveread.github.io`) and local development URL to **Authorized JavaScript origins**.
5. Set `NEXT_PUBLIC_GOOGLE_CLIENT_ID` to the resulting client ID when building the site.

Do not request `drive.readonly`: `drive.file` is the narrower scope for files explicitly opened by the user.

## Register the Drive “Open with” handler

In the Google Cloud console, open **Google Drive API → Configuration** (the Drive UI integration settings):

1. Enable **Drive UI integration**.
2. Set the application URL to the deployed DriveRead URL and provide the required application icons.
3. Add `application/epub+zip` as a supported MIME type and `.epub` as a supported file extension.
4. Enable **Open with** and save the configuration.

Once the configuration is available to the account, a user can right-click one EPUB in Drive, choose **Open with**, and select **DriveRead**. Drive adds a URL-encoded JSON `state` query parameter. DriveRead accepts only an `open` action containing exactly one non-empty file ID, authenticates, checks that file's metadata, and then downloads it.

Opening the site directly is also supported, but it does not prompt for authentication or show a Drive library. The landing page explains how to select an EPUB from Google Drive.
