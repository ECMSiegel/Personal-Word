# Personal Word

A Mac-first, local writing workspace built with Tauri, React, TypeScript, Tiptap / ProseMirror, and SQLite.

## Run

Requires Node 22+ and Rust, plus the macOS Xcode command-line tools.

```sh
npm ci
npm run tauri dev
```

Build a desktop bundle with `npm run tauri build`. The bundle is generated under `src-tauri/target/release/bundle/macos/Personal Word.app`. It is not signed or notarized for distribution.

`npm run dev` opens a **browser preview** at http://localhost:1420. The preview uses browser storage, not SQLite; the interface labels this distinction. Use the desktop app for real writing.

## First slice

- Create, reopen, rename and delete local projects. Deleting a desktop project sets its folder aside as `<project-id>.deleted` instead of erasing it.
- Rich text: headings, bold, italic, underline, strike, lists, quotations, links (added through an in-app dialog), Markdown shortcuts, smart typography, undo/redo, OS spellcheck.
- Create, rename, delete, drag-reorder sections; keyboard-accessible reorder buttons. Deleting a section or fragment keeps a safety snapshot first.
- Create and edit fragments. Select manuscript text and use **Keep as fragment** or **⌘⇧X**. The cut and fragment commit together, with source metadata. Append a fragment to a selected section while retaining the original.
- Automatic local saves, immediate recovery journals, visible failures and retry.
- Named snapshots, read-only inspection, restoration with an automatic safety snapshot; separate automatic recovery history.
- Project search, word and character counts, focus mode, continuous plain-text read view.
- Export full portable JSON or manuscript plain text; recover a JSON project as a new project.

Shortcuts: **⌘S** flush saves, **⌘⇧S** snapshot, **⌘⇧N** section, **⌘K** project search, **⌘\\** focus mode. Formatting uses Tiptap's standard shortcuts. Double-click a sidebar section or click its large title to rename it; click the project title in the top bar to rename the project. The trash button beside a section or fragment title deletes it; the trash button on a library row deletes the project.

## Your files

Desktop project folders live at `~/Library/Application Support/com.folio.writing/projects/<project-id>/` on macOS. Open **Settings → Local storage** for the actual path.

Each folder contains:

- `project.sqlite3` and its WAL/SHM files: authoritative transactional data.
- `project.json`: full current portable rich-text project.
- `manuscript.txt`, `fragments.txt`: ordinary readable text.
- `snapshots/*.json`: named snapshot content (names and dates also in SQLite).
- `previous-session.sqlite3`: online database backup made on opening.
- `attachments/`: reserved ordinary-file directory; attachment UI is deferred.

Use **Saved** as confirmation of the database save. Portable mirrors are written in the background and flushed on explicit save, library navigation, and quit; mirror failures are reported separately. Save failures keep pending data in memory and the recovery journal where available. Quit/window close attempts to flush first and stays open on failure. A forced kill can bypass this guard; recovery depends on the last persisted journal/database state. Do not interpret this as a power-loss guarantee.

### Recovery

1. Keep a copy of the entire damaged project folder before making changes.
2. Launch normally to recover pending edits from the WebView journal.
3. Inspect **Snapshots & history → Recovery history** to restore an earlier state. Restoration creates a safety snapshot first.
4. If SQLite cannot open, the project library lists that folder under **Needs attention** and keeps every other project visible. Keep a copy, then import its `project.json` or a file from `snapshots/`. This creates a new project; it does not overwrite the damaged one. **Set aside** renames the folder to `<project-id>.deleted` once you are done with it.
5. If the WebView journal and the saved copy are at the same revision but disagree, opening the project asks which to keep: the disk copy, the journal copy, or export the journal to a file first. A journal that cannot be parsed is listed in the library under **Needs attention** with **Export** (raw text) and **Discard**; it never blocks the library or the project.
6. For database backup recovery, quit the app, preserve the original folder, then copy `previous-session.sqlite3` into a **new copy** of that folder as `project.sqlite3`, removing stale WAL/SHM files in that copy only. Seek technical help if unsure. Never overwrite the sole surviving copy.

For external backups, quit Personal Word and copy the whole project folder. A copy on the same disk does not protect against drive failure. Mirror files may lag SQLite after an export failure; the app reports this and retries repair them.

## Validation

```sh
npm test
cargo test --manifest-path src-tauri/Cargo.toml
npm run build
npx playwright install chromium
npm run test:e2e
```

See [architecture](docs/architecture.md) and [validation](docs/validation.md). This is an initial working slice, not a claim of production readiness. Native forced-termination/power-loss coverage, large manuscripts, accessibility, and signed distribution need further qualification. Research and DOCX/PDF export are now implemented with documented limitations. Images/tables, cloud collaboration, and full tracked changes remain outside this release.

### Native integration test

The optional harness runs the real Tauri WebView in two successive processes against temporary SQLite files. Build it with an isolated application identifier, then run the harness:

```sh
npm run tauri build -- --debug --features native-smoke --no-bundle --config '{"identifier":"com.folio.smoke"}'
python3 scripts/native-smoke.py
```

It creates a project through the UI, switches sections, cuts/restores a fragment, takes a snapshot, types immediately before the real quit guard, reopens the process, and restores the snapshot. The runner also checks SQLite integrity and equality with the portable JSON copy. Test reports are in `test-results/`; the temporary project directory is printed. Rebuild normally without `native-smoke` afterward. This harness is excluded from the default build.

## Appearance

Personal Word follows the computer’s light/dark appearance automatically, including changes while open. The interface uses system typography, neutral surfaces, accessible focus rings, and reduced-motion support. Projects open from the library; manuscript reading offers section shortcuts; the thin line below the toolbar tracks document scrolling.

Design references include [Rare UI](https://rareui.com) and [Dieter Rams’ ten principles](https://tenprinciples.design/). The current design removes the former decorative folder and curved hook treatments in favor of compact rows, optional cards, and flat sans-serif controls. No Rare UI component source is bundled.

The existing application identifier and storage keys remain stable so previously saved projects continue to open after the rename.

## Expanded writing workspace

See [the current feature and limitation guide](docs/personal-word-v2.md) and [agent working principles](AGENTS.md). The library now opens on launch; use **Start new project** to choose a template. Each sidebar collection can switch between lines and cards. **Settings** contains document defaults, startup preferences, reusable templates, DOCX/PDF export, PDF preview, and Local storage.

Page view is editable and currently arranges section pages horizontally. Exported Word/PDF pagination is independent; inspect the export preview before submission. The app does not claim exact print parity or exhaustive Chicago citation coverage.
