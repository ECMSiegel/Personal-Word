# Folio

A Mac-first, local writing workspace built with Tauri, React, TypeScript, Tiptap / ProseMirror, and SQLite.

## Run

Requires Node 22+ and Rust, plus the macOS Xcode command-line tools.

```sh
npm ci
npm run tauri dev
```

Build a desktop bundle with `npm run tauri build`. The bundle is generated under `src-tauri/target/release/bundle/macos/Folio.app`. It is not signed or notarized for distribution.

`npm run dev` opens a **browser preview** at http://localhost:1420. The preview uses browser storage, not SQLite; the interface labels this distinction. Use the desktop app for real writing.

## First slice

- Create and reopen local projects.
- Rich text: headings, bold, italic, underline, strike, lists, quotations, links, Markdown shortcuts, smart typography, undo/redo, OS spellcheck.
- Create, rename, drag-reorder sections; keyboard-accessible reorder buttons.
- Create and edit fragments. Select manuscript text and use **Keep as fragment** or **⌘⇧X**. The cut and fragment commit together, with source metadata. Append a fragment to a selected section while retaining the original.
- Automatic local saves, immediate recovery journals, visible failures and retry.
- Named snapshots, read-only inspection, restoration with an automatic safety snapshot; separate automatic recovery history.
- Project search, word and character counts, focus mode, continuous plain-text read view.
- Export full portable JSON or manuscript plain text; recover a JSON project as a new project.

Shortcuts: **⌘S** flush saves, **⌘⇧S** snapshot, **⌘⇧N** section, **⌘K** project search, **⌘\\** focus mode. Formatting uses Tiptap's standard shortcuts. Double-click a sidebar section or click its large title to rename it.

## Your files

Desktop project folders live at `~/Library/Application Support/com.folio.writing/projects/<project-id>/` on macOS. Click **Local storage** in the footer for the actual path.

Each folder contains:

- `project.sqlite3` and its WAL/SHM files: authoritative transactional data.
- `project.json`: full current portable rich-text project.
- `manuscript.txt`, `fragments.txt`: ordinary readable text.
- `snapshots/*.json`: named snapshot content (names and dates also in SQLite).
- `previous-session.sqlite3`: online database backup made on opening.
- `attachments/`: reserved ordinary-file directory; attachment UI is deferred.

Use **Saved** as confirmation that SQLite and the current portable copies have both completed. Save failures keep pending data in memory and the recovery journal where available. Quit/window close attempts to flush first and stays open on failure. A forced kill can bypass this guard; recovery depends on the last persisted journal/database state. Do not interpret this as a power-loss guarantee.

### Recovery

1. Keep a copy of the entire damaged project folder before making changes.
2. Launch normally to recover pending edits from the WebView journal.
3. Inspect **Snapshots & history → Recovery history** to restore an earlier state. Restoration creates a safety snapshot first.
4. If SQLite cannot open, return to the project library and import `project.json` or a file from `snapshots/`. This creates a new project; it does not overwrite the damaged one.
5. For database backup recovery, quit the app, preserve the original folder, then copy `previous-session.sqlite3` into a **new copy** of that folder as `project.sqlite3`, removing stale WAL/SHM files in that copy only. Seek technical help if unsure. Never overwrite the sole surviving copy.

For external backups, quit Folio and copy the whole project folder. A copy on the same disk does not protect against drive failure. Mirror files may lag SQLite after an export failure; the app reports this and retries repair them.

## Validation

```sh
npm test
cargo test --manifest-path src-tauri/Cargo.toml
npm run build
npx playwright install chromium
npm run test:e2e
```

See [architecture](docs/architecture.md) and [validation](docs/validation.md). This is an initial working slice, not a claim of production readiness. Native forced-termination/power-loss coverage, large manuscripts, accessibility, and signed distribution need further qualification. Research, split editing, alternate drafts, images/tables, find/replace, and DOCX/PDF are deferred.

### Native integration test

The optional harness runs the real Tauri WebView in two successive processes against temporary SQLite files. Build it with an isolated application identifier, then run the harness:

```sh
npm run tauri build -- --debug --features native-smoke --no-bundle --config '{"identifier":"com.folio.smoke"}'
python3 scripts/native-smoke.py
```

It creates a project through the UI, switches sections, cuts/restores a fragment, takes a snapshot, types immediately before the real quit guard, reopens the process, and restores the snapshot. The runner also checks SQLite integrity and equality with the portable JSON copy. Test reports are in `test-results/`; the temporary project directory is printed. Rebuild normally without `native-smoke` afterward. This harness is excluded from the default build.
