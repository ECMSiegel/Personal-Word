# Folio: first milestone

A single-writer, Mac-first desktop application. Tauri 2 hosts React/TypeScript and Tiptap 3 (ProseMirror). Rust owns SQLite and file access. No network service, accounts, or AI. The browser development preview uses explicitly labeled browser storage; it is not desktop persistence.

## Boundaries

- React owns navigation and an in-memory project. One Tiptap instance is mounted per active section or fragment; section changes remount to isolate undo histories.
- A serialized save coordinator owns the recovery journal, debounce, flush, and errors. Every edit journals immediately. Navigation does not cancel pending writes. Desktop close waits for writes; failed writes block close.
- Rust validates project identity, revisions, document shape, and references, then commits changes in a SQLite transaction. SQL is parameterized. Schema versioning uses user_version; newer schemas are rejected.

## Model and storage

Project: ID, title, created/updated timestamps, revision, ordered section IDs, entries. Entry: ID, kind (section/fragment), title, ProseMirror JSON, plain text, updated timestamp, optional source section/selection/context. A project has one manuscript in this milestone. ResearchItem, Attachment, Tag and alternate drafts are deferred entities, not empty UI promises.

Application data lives in the OS application-data directory under com.folio.writing. Each UUID project directory contains project.sqlite3, project.json, manuscript.txt, fragments.txt, and attachments/. SQLite stores project metadata, entry rows, bounded automatic history, and separate named snapshot rows. Entry upserts only touch changed rows. JSON and text mirrors are atomically replaced using same-directory temporary files, fsync, rename and directory fsync. SQLite commits precede mirrors; mirror failures remain visible and retries repair mirrors. project.json contains the complete current rich-text state; text copies are human-readable. Snapshots also receive standalone JSON files.

## Save, history, and recovery

Autosave is debounced 250 ms, with a synchronous local WebView storage journal per project updated on every edit. Journals clear only after successful persistence of that exact revision. A newer journal is recovered on opening. Writes are serialized and reject stale revisions. A commit retry is idempotent. SQLite uses WAL and synchronous FULL. Automatic history retains the last 100 changed states; it is recovery history, separate from named milestones. Named snapshots store complete project content and ordering. Restoring creates a new revision; first the UI creates a safety snapshot of current writing. Fragment extraction changes section and fragment in the same save transaction; provenance remains on the fragment. Restoring copies prose into a chosen section, retaining the original fragment.

## Backups and portability

On opening a database, use SQLite's online backup API to make a previous-session backup. Never copy a live SQLite main file alone. Portable mirrors provide an independent recovery route; import validates them before creating a new project identity. Copy the whole project folder when the app is closed for an external backup. Local backups do not protect against disk loss; external backup is still necessary. No silent corruption reset. Errors keep the journal and show an actionable retry.

## UI

Quiet warm-neutral chrome, restrained accent, serif writing surface, compact formatting toolbar, sidebar for ordered manuscript and fragments. Native-feeling keyboard controls. Drag reordering has accessible move-up/down alternatives. Snapshot inspection is read-only; restoration is explicit. Focus mode hides the sidebar. Continuous read view is read-only in this milestone.

## Risks and deliberate limits

The first slice loads one project's entries and sends the project envelope per save; entry SQL writes are incremental, but portable mirrors/history serialize the project. This must be profiled and moved to section-level journals/background exports before claiming 50,000-word performance. No cross-section editing, research UI, DOCX/PDF, advanced tables/images, or alternate drafts yet. OS spellcheck availability depends on WebView. Journal storage can fill: surface failure, keep memory, and attempt disk persistence. Native hard-kill/power-loss testing, signing/notarization, and broader accessibility QA remain release gates. Browser tests are not evidence of native WebView behavior.

## References checked during implementation

- https://v2.tauri.app/start/prerequisites/
- https://tiptap.dev/docs/editor/getting-started/install/react
