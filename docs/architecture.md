# Folio: first milestone

A single-writer, Mac-first desktop application. Tauri 2 hosts React/TypeScript and Tiptap 3 (ProseMirror). Rust owns SQLite and file access. No network service, accounts, or AI. The browser development preview uses explicitly labeled browser storage, still one whole-project blob per save; it is not desktop persistence.

## Boundaries

- React owns navigation and an in-memory project. One Tiptap instance is mounted per active section or fragment; section changes remount to isolate undo histories.
- A serialized save coordinator owns the recovery journal, debounce, flush, and errors. Every edit journals immediately. Navigation does not cancel pending writes. Desktop close waits for writes and for the portable copies; either failing blocks close.
- Rust validates project identity, revisions, document shape, and references, then commits changes in a SQLite transaction. SQL is parameterized. Schema versioning uses user_version (currently 2; version 1 databases are migrated in one transaction on open); newer schemas are rejected.

## Model and storage

Project: ID, title, created/updated timestamps, revision, ordered section IDs, entries. Entry: ID, kind (section/fragment), title, ProseMirror JSON, plain text, updated timestamp, optional source section/selection/context. A project has one manuscript in this milestone. ResearchItem, Attachment, Tag and alternate drafts are deferred entities, not empty UI promises.

Application data lives in the OS application-data directory under com.folio.writing. Each UUID project directory contains project.sqlite3, project.json, manuscript.txt, fragments.txt, and attachments/.

SQLite is the source of truth. The `project` table holds one small header row (title, timestamps, revision, section order, and the ordered list of entry IDs) and no prose. The `entries` table holds one row per section or fragment (ID, kind, JSON). Reading a project rebuilds it from the header plus the entry rows inside one read transaction. A save upserts only the entries that changed, deletes entries the header no longer lists, checks that every listed entry exists and that the order names exactly the sections, then replaces the header — all in one transaction. Named snapshots are separate rows holding complete project JSON, and also standalone JSON files.

project.json, manuscript.txt and fragments.txt are portable copies, not part of the save. A background thread rewrites them at most every 3 seconds for projects saved since the last pass, and immediately on ⌘S, Retry, returning to the library, and quit. Each file is atomically replaced (same-directory temporary file, fsync, rename, directory fsync). The pass reads SQLite outside the store lock, so saves never wait on it. A failed pass keeps the project pending, shows "Database saved, but portable copy failed … Retry to repair it" in the error banner, and is retried by the next pass or by Retry; quit is blocked until it succeeds. The copies can therefore lag SQLite by a few seconds while the app runs.

## Save, history, and recovery

Every edit bumps the project revision and writes the recovery journal synchronously to WebView localStorage: the changed entry under its own key plus a small header (title, order, revision, entry IDs, and which entries are journaled). Unchanged entries are neither copied nor serialized, so a keystroke costs the size of the section being edited, not the project. The journal is synchronous to memory only: WebKit writes localStorage to disk on its own schedule with no fsync, so it protects against reloads and in-app failures, not against a hard kill or power loss.

Autosave is debounced 250 ms. The coordinator sends Rust the header plus the entries whose objects differ from the last state confirmed on disk, along with that state's revision. Rust refuses a delta built on a revision the disk never reached. Writes are serialized and reject stale revisions; a same-revision retry is a no-op when it matches what is stored and a conflict otherwise. After any failed save the coordinator forgets what is on disk and the retry sends every entry. Journal keys clear only after the newest journaled revision is persisted. On opening, a newer journal is rebuilt on top of the saved project (or alone, for a project never saved) and saved; an incomplete, malformed, or same-revision-but-different journal is kept and reported instead of guessed at. Journals from the previous whole-project format are still recovered.

SQLite uses WAL and synchronous=FULL, so the hard-kill floor is the 250 ms debounce into SQLite: whatever was typed since the last 250 ms pause (plus any save in flight) exists only in memory and the journal. The debounce restarts on every keystroke, so an unbroken burst of typing is exposed for its whole length. On macOS, SQLite's FULL sync uses fsync, not F_FULLFSYNC, so a power cut can still lose commits the drive had not written.

Automatic recovery history is separate from named milestones. Before each new revision is written, the current state is archived: its header and, per entry, a pointer to a stored entry version. Each entry version is stored once and shared by every history row that contains it, so typing in one section adds one section-sized blob per save, not a project-sized copy. Retention is by time, in clock-aligned windows: every save from the last 10 minutes, the newest save per 5 minutes for the last day, the newest per hour beyond that, and never more than 2,000 rows (oldest dropped first). Entry versions no longer referenced are deleted in the same transaction. Named snapshots store complete project content and ordering. Restoring creates a new revision; first the UI creates a safety snapshot of current writing. Fragment extraction changes section and fragment in the same save transaction; provenance remains on the fragment. Restoring copies prose into a chosen section, retaining the original fragment.

## Backups and portability

On opening a database, use SQLite's online backup API to make a previous-session backup. Never copy a live SQLite main file alone. Portable mirrors provide an independent recovery route; import validates them before creating a new project identity. Copy the whole project folder when the app is closed for an external backup. Local backups do not protect against disk loss; external backup is still necessary. No silent corruption reset. Errors keep the journal and show an actionable retry.

## UI

Quiet warm-neutral chrome, restrained accent, serif writing surface, compact formatting toolbar, sidebar for ordered manuscript and fragments. Native-feeling keyboard controls. Drag reordering has accessible move-up/down alternatives. Snapshot inspection is read-only; restoration is explicit. Focus mode hides the sidebar. Continuous read view is read-only in this milestone.

## Risks and deliberate limits

Opening a project still loads and validates every entry (about 45 ms of Rust for 100,000 words, mostly JSON parsing), and each portable-copy pass rewrites the whole project.json (about 200 ms at that size, off the save path). See validation.md for measured per-keystroke and per-save costs. No cross-section editing, research UI, DOCX/PDF, advanced tables/images, or alternate drafts yet. OS spellcheck availability depends on WebView. Journal storage can fill: surface failure, keep memory, and attempt disk persistence. Native hard-kill/power-loss testing, signing/notarization, and broader accessibility QA remain release gates. Browser tests are not evidence of native WebView behavior.

## References checked during implementation

- https://v2.tauri.app/start/prerequisites/
- https://tiptap.dev/docs/editor/getting-started/install/react
