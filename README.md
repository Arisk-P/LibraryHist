# LibraryHist

**Keep track of the latest chapter or volume you read, for every manga, novel or comic you follow.**

LibraryHist is a personal reading log. Add each title once, then tap **+1** whenever you finish a chapter. The app remembers where you are, what you read and when, so you never lose your place across many series.

It runs fully offline. Everything is stored on your device, with no account and no server.

## Download

### Android

**[⬇ LibraryHist_v1.0.1](https://github.com/Arisk-P/LibraryHist/raw/main/LibraryHist_version/LibraryHist_v1.0.1.apk)** (latest)

1. Download the APK on your phone and open it.
2. If Android blocks it, allow **Install unknown apps** for the app you opened it from (Files, Chrome, LINE, …).
3. If Play Protect warns you, tap **More details → Install anyway**.

Installing a new version over an old one keeps your library. Uninstalling the app **deletes** it, so make a backup first (Setting → Backup → Export).

| Version | Changes |
| --- | --- |
| [v1.0.1](https://github.com/Arisk-P/LibraryHist/raw/main/LibraryHist_version/LibraryHist_v1.0.1.apk) | The page no longer hides under the phone's status bar or navigation bar, and both bars follow the theme (Retro dark / Manga light). Backup export saves a `.zip` file. |
| [v1.0.0](https://github.com/Arisk-P/LibraryHist/raw/main/LibraryHist_version/LibraryHist_v1.0.0.apk) | First release. |

### Web

No install, build step or dependencies: open `index.html` in any modern browser.

## Features

### Track your reading
- **Titles:** name, cover image, category, current chapter or volume, tags and a link to where you read it.
- **Quick update:** **+1** and **+0.1** buttons on every card (for chapters like 12.5), with no form to open.
- **Cover link:** tap a cover to open the title's website.
- **Favorites:** star titles to pin them in a carousel at the top of Home.

### Organize
- **Categories** (e.g. Manga, Light Novel), each counted by **Chapter** or **Volume**.
- **Tags** of three types: **Publisher**, **Author** and **General**. In tag search, type `@author`, `@publisher` or `@general` to filter by type.
- **Browse by** Publisher, Author or Category: grouped lists you can expand.

### Find
- **Search** by name.
- **Sort** by date modified, A–Z, or most / least chapters.
- **Filter** by category, tags to include and tags to exclude.
- **Select mode:** favorite, remove from a category, or delete many titles at once.

### Keep a record
- **History:** every add, read, edit, delete and restore, grouped by day (the latest 1,000 entries).
- **Recently Deleted:** deleted titles stay for 30 days, so you can restore them.
- **Backup:** export or import the whole library as a `.zip` containing an Excel file and the cover images (see below).

### Look and feel
- **Two themes** (Setting → Theme):
  - **Retro:** kraft paper, ink and olive.
  - **Manga:** black ink on white with screentone.
- **Theme images:** a cover can use the theme's filter (sepia and grain for Retro, black and white for Manga) or keep its original colours.
- **Responsive layout:** phone, tablet, and PC with a permanent sidebar.

## Backup (Setting → Backup)

**Export** saves `libraryhist-backup-YYYY-MM-DD.zip`:

```
library.xlsx      sheets: Titles, Recently Deleted, Categories, Tags, History
images/<id>.jpg   one cover per title (the "Image" column points to it)
```

**Import** reads the same format and replaces the whole library (after a confirmation). Use this to move your data between phone and browser, or to a new device.

You can also add or edit rows in Excel before importing:
- Categories and tags are matched by name. Only the `Name` column is required.
- `Publisher`, `Author` and `Tags` take several names separated by `;`.
- `Image Style` is `Theme` (the cover uses the current theme's filter) or `Original`. Empty means Original.

The theme itself is saved per device and isn't part of the backup.

## Project files

| File | Purpose |
| --- | --- |
| `index.html` | Pages: Home/category list, title form, category form, tags, browse, setting, theme, history, recently deleted; filter panel; menu drawer |
| `styles.css` | Layout for phone / tablet / PC and the Retro and Manga themes |
| `app.js` | Data store + migration, page router, searchable dropdown, popover menu, dialogs, rendering, backup, and the Android bridge |
| `vendor/` | [JSZip](https://stuk.github.io/jszip/) 3.10.1 and [SheetJS](https://sheetjs.com/) 0.18.5 (mini), loaded only for backup export/import |
| `LibraryHist_version/` | Android APK builds |

Data is stored in the browser's `localStorage` (key `libraryhist.v1`).

### Android app

The APK is an Android Studio project with a WebView that loads these same files from `app/src/main/assets/`. `MainActivity` adds what a browser would otherwise provide:
- the file picker for cover images and backup import
- a "Save as" dialog for backup export (`Android.saveFile`)
- status bar and navigation bar colours that follow the theme (`Android.setSystemBars`)
- the back button

To build a new version, copy `index.html`, `app.js`, `styles.css` and `vendor/` into `assets/`, raise `versionCode` / `versionName` in `app/build.gradle.kts`, then use **Build → Generate APKs**.
