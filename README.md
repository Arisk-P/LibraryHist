# LibraryHist

Keeps track of the latest chapter / volume you read for each title.

No build step and no dependencies: open `index.html` in a browser.
Data is stored in the browser's `localStorage`.

| File | Purpose |
| --- | --- |
| `index.html` | Pages: Home/category list, title form, category form, tags, setting, history, recently deleted; filter panel; menu drawer |
| `styles.css` | Styles, light/dark theme |
| `app.js` | Data store + migration, page router, searchable dropdown, popover menu, dialogs, rendering and interactions |
| `vendor/` | [JSZip](https://stuk.github.io/jszip/) 3.10.1 and [SheetJS](https://sheetjs.com/) 0.18.5 (mini), loaded only for backup export/import |

## Backup (Setting → Backup)

**Export** downloads `libraryhist-backup-YYYY-MM-DD.zip`:

```
library.xlsx      sheets: Titles, Recently Deleted, Categories, Tags, History
images/<id>.jpg   one cover per title (the "Image" column points to it)
```

**Import** reads the same format and replaces the whole library (after a confirmation).
Categories and tags are matched by name, so you can add rows in Excel: only the `Name` column is required;
`Publisher`, `Author` and `Tags` take several names separated by `;`.
`Image Style` is `Theme` (cover uses the current theme's filter) or `Original` (empty means Original).
The theme itself (Setting → Theme: Retro or Manga) is saved per device and is not part of the backup.
