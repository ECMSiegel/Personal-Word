# Personal Word architecture

A single-writer, Mac-first desktop application. Tauri 2 hosts React/TypeScript and Tiptap 3 (ProseMirror). Rust owns SQLite and file access. No network service, accounts, or AI. The one outbound request is the opt-in citation lookup: when the writer clicks Look up, the typed DOI, ISBN, or web address is sent to Crossref, Open Library, or that website (natively through the `lookup_fetch` Rust command: http/https only, 12 s timeout, 3 MB cap). The browser development preview uses explicitly labeled browser storage, still one whole-project blob per save; it is not desktop persistence.

## Boundaries

- React owns navigation and an in-memory project. The main Tiptap instance follows the active section or fragment; section changes remount it to isolate undo histories. The fragments panel can also mount inline editors for other fragments.
- A serialized save coordinator owns the recovery journal, debounce, flush, and errors. Every edit journals immediately. Navigation does not cancel pending writes. The frontend handles the actual native close request, waits for writes and portable copies, and leaves the app open when either fails.
- Rust validates project identity, revisions, document shape, and references, then commits changes in a SQLite transaction. SQL is parameterized. Schema versioning uses user_version (currently 2; version 1 databases are migrated in one transaction on open); newer schemas are rejected.

## Model and storage

Project: ID, title, created/updated timestamps, revision, ordered section IDs, entries. Entry: ID, kind (section/fragment), title, ProseMirror JSON, plain text, updated timestamp, optional source section/selection/context. A project has one manuscript in this milestone. Research sources, notes, footnotes, comments, and entry tags are additive project/entry metadata. Attachments and alternate drafts remain deferred.

Application data lives in the OS application-data directory under com.folio.writing. Each UUID project directory contains project.sqlite3, project.json, manuscript.txt, fragments.txt, and attachments/.

SQLite is the source of truth. The `project` table holds one small header row (title, timestamps, revision, section order, and the ordered list of entry IDs) and no prose. The `entries` table holds one row per section or fragment (ID, kind, JSON). Reading a project rebuilds it from the header plus the entry rows inside one read transaction. A save upserts only the entries that changed, deletes entries the header no longer lists, checks that every listed entry exists and that the order names exactly the sections, then replaces the header — all in one transaction. Named snapshots are separate rows holding complete project JSON, and also standalone JSON files.

project.json, manuscript.txt and fragments.txt are portable copies, not part of the save. A background thread rewrites them at most every 3 seconds for projects saved since the last pass, and immediately on ⌘S, Retry, returning to the library, and quit. Each file is atomically replaced (same-directory temporary file, fsync, rename, directory fsync). The pass reads SQLite outside the store lock, so saves never wait on it. A failed pass keeps the project pending, shows "Database saved, but portable copy failed … Retry to repair it" in the error banner, and is retried by the next pass or by Retry; quit is blocked until it succeeds. The copies can therefore lag SQLite by a few seconds while the app runs.

There is a narrow boundary after SQLite commits and before the live Store marks the project dirty for mirror writing. A process ending in that boundary can leave SQLite newer than `project.json`; the fresh Store starts with an empty in-memory dirty set, so automatic mirror repair on restart is not established. D1 has an isolated checkpoint/restart scenario for this boundary. Until that native scenario passes, treat SQLite as authoritative and use [the recovery and backup steps](recovery.md) for portable copies.

## Save, history, and recovery

Every edit bumps the project revision and writes the recovery journal synchronously to WebView localStorage: the changed entry under its own key plus a small header (title, order, revision, entry IDs, and which entries are journaled). Unchanged entries are neither copied nor serialized, so a keystroke costs the size of the section being edited, not the project. The journal is synchronous to memory only: WebKit writes localStorage to disk on its own schedule with no fsync, so it protects against reloads and in-app failures, not against a hard kill or power loss.

Autosave uses a responsive 250 ms trailing debounce and a 2,000 ms maximum scheduling wait from the first pending edit. The latter bounds when a healthy queue attempts persistence; slow I/O, errors, suspension, and blocked event loops can exceed it. The coordinator sends Rust the header plus the entries whose objects differ from the last state confirmed on disk, along with that state's revision. Rust refuses a delta built on a revision the disk never reached. Writes are serialized and reject stale revisions; a same-revision retry is a no-op when it matches what is stored and a conflict otherwise. After any failed save the coordinator forgets what is on disk and the retry sends every entry. Journal keys clear only after the newest journaled revision is persisted. On opening, a newer journal is rebuilt on top of the saved project (or alone, for a project never saved) and saved; an incomplete, malformed, or same-revision-but-different journal is kept and reported instead of guessed at. Journals from the previous whole-project format are still recovered.

SQLite uses WAL and synchronous=FULL. On macOS each new database connection also sets `fullfsync=ON` and `checkpoint_fullfsync=ON`, requesting Apple's stronger `F_FULLFSYNC` operation for commits and WAL checkpoints. This improves the requested flush behavior; it cannot guarantee survival of a power cut, storage-controller failure, or other hardware/OS fault. Edits not yet committed exist only in memory and the WebView journal. The maximum scheduling timer prevents healthy continuous typing from indefinitely postponing a save attempt, but it does not guarantee a fixed loss window under slow I/O or failure.

The native editor's `Saving…`, `Unsaved edits`, and `Save failed` labels describe the save coordinator. `Saved` means the latest queued write completed successfully through SQLite; portable JSON/text copies are a separate path and may still lag or show a retryable error. Neither state means an external backup exists. A successful save acknowledgement is distinct from the local recovery journal, portable mirrors, and an external backup.

Automatic recovery history is separate from named milestones. Before each new revision is written, the current state is archived: its header and, per entry, a pointer to a stored entry version. Each entry version is stored once and shared by every history row that contains it, so typing in one section adds one section-sized blob per save, not a project-sized copy. Retention is by time, in clock-aligned windows: every save from the last 10 minutes, the newest save per 5 minutes for the last day, the newest per hour beyond that, and never more than 2,000 rows (oldest dropped first). Entry versions no longer referenced are deleted in the same transaction. Named snapshots store complete project content and ordering. Restoring creates a new revision; first the UI creates a safety snapshot of current writing. Fragment extraction changes section and fragment in the same save transaction; provenance remains on the fragment. Restoring copies prose into a chosen section, retaining the original fragment.

## Backups and portability

On opening a database, use SQLite's online backup API to make a previous-session backup. Never copy a live SQLite main file alone. Portable mirrors provide an independent recovery route; import validates them before creating a new project identity. Copy the whole project folder when the app is closed for an external backup. Local backups do not protect against disk loss; external backup is still necessary. No silent corruption reset. Errors keep the journal and show an actionable retry.

## UI

Quiet warm-neutral chrome, restrained accent, serif writing surface, compact formatting toolbar, sidebar for ordered manuscript and fragments. Native-feeling keyboard controls. Drag reordering has accessible move-up/down alternatives. Snapshot inspection is read-only; restoration is explicit. Focus mode hides the sidebar. Continuous read view is read-only in this milestone.

## Source organization and boundaries

`src/model.ts` owns project/entry invariants; `src/save-queue.ts` owns journaling and serialized save scheduling; `src/storage.ts` selects native versus browser adapters; `src/editor/` owns the shared Tiptap schema and editor layout; `src/research/` owns citation/research behavior; `src/organization/` owns fragments, comments, and comparison; `src/import/` owns manuscript decoding; `src/export/` owns the shared document representation and DOCX/PDF renderers. `src/App.tsx` remains the lifecycle/orchestration join point, and `src/Writer.tsx` owns the mounted editor and toolbar/layout composition. Domain and persistence remain independent of React views.

The native app takes an advisory Unix `flock` on a file at the library data root. A concurrent desktop instance using the same root fails at startup with a clear message; the operating system releases the lock when the process exits. This does not create cross-device or network-filesystem coordination guarantees.

Plain UTF-8 `.txt` and Markdown (`.md`, `.markdown`) import creates a new project (5 MB maximum) after a preview step that shows the format, an excerpt, and warnings; the source file is left unchanged. Markdown is parsed into the shared editor schema without a DOM or HTML execution path: headings, emphasis, strong, strike, links (http, https, mailto), nested lists, block quotes, inline and fenced code, and line breaks are represented; images, tables, relative links, and raw HTML are retained as visible literal text with a warning, and no remote resource is fetched. JSON recovery remains a separate full-project path.

DOCX and PDF currently preserve text, bold, italic, underline, strike, links, heading structure, lists (including nesting and ordered start values), page breaks, paragraph alignment/indent/spacing, footnotes, and optional bibliography in their shared representation. DOCX uses native Word numbering, footnote, and strike markup. PDF embeds bundled OFL Noto Serif, Noto Sans, and Noto Sans Mono subsets for the selected document typeface, covering Latin, Latin Extended, Greek, and Cyrillic; it does not use document fonts, does not shape complex scripts, rejects scripts outside those ranges, rejects footnotes that cannot fit on a single page, and may split long tokens at Unicode code-point boundaries. Both exporters use independent pagination engines.

## Risks and deliberate limits

Opening a project still loads and validates every entry (about 45 ms of Rust for 100,000 words, mostly JSON parsing), and each portable-copy pass rewrites the whole project.json (about 200 ms at that size, off the save path). See validation.md for measured per-keystroke and per-save costs. Research and DOCX/PDF export are implemented with the limitations above. Cross-section editing, advanced tables/images, and alternate drafts remain outside scope. OS spellcheck availability depends on WebView. Journal storage can fill: surface failure, keep memory, and attempt disk persistence. Native hard-kill/power-loss testing, signing/notarization, and broader accessibility QA remain release gates. Browser tests are not evidence of native WebView behavior.

## References checked during implementation

- https://v2.tauri.app/start/prerequisites/
- https://tiptap.dev/docs/editor/getting-started/install/react

## Expanded workspace (October 2026)

See [the feature guide](personal-word-v2.md). Project headers now optionally carry document settings, page layout, research sources/notes, comments, and sidebar order. Entry metadata includes synopsis, drafting status, tags, and fragment usage. Rust Project/Header/Entry structs preserve these additive fields through flattened JSON metadata. The SQLite schema and legacy application identity remain unchanged.

The editor and frontend validator share src/editor/extensions.ts. Page layout uses CSS multicolumn fragmentation; DOCX and PDF exporters walk the same rich text but use independent layout engines. UI composition stays in App.tsx; research, export, editor, and organization modules own their specific behaviors. Future work should extract App routing/state further before adding more destinations.
