# First milestone validation — October 14, 2026

This is a working local desktop slice, not a production durability certification.

## Confirmed behavior

- **Native macOS WebView + SQLite:** the opt-in harness launched two real Tauri processes with an isolated application identifier and temporary project directory. Phase one created a project through the UI, wrote and switched sections, moved prose into a fragment, restored it, and created a named snapshot. It then typed immediately before invoking the real quit guard. Phase two reopened that final text and restored the named snapshot. Both processes exited successfully.
- **Database and portable copies:** after each native process exited, the runner verified `PRAGMA integrity_check = ok`, checked the expected manuscript content, compared `project.json` with the stored project, and verified snapshot counts, including the safety snapshot created before restoration. See [native evidence](evidence/native-smoke.json). Re-run on October 16, 2026 after the per-entry save path and schema version 2: both phases passed, and the runner rebuilt the project from the header and entry rows and matched it against `project.json` written at quit.
- **Browser end-to-end:** three passing Playwright scenarios cover the complete writer journey, recovery from a newer journal, and 5,004 words across sections with repeated switching, drag reordering, and reload. Browser persistence is explicitly separate from native SQLite.
- **TypeScript unit tests:** seventeen passing tests cover serialized saves, immediate journals, concurrent edits, retry after failed writes, unavailable journals, malformed/conflicting recovery copies, JSON key-order independence, text export boundaries, and malformed imports. Since October 16 they also cover per-entry journaling (a keystroke writes exactly the edited entry and the header), saves that send only changed entries with their base revision, a full resend after a failed save, recovery that combines the saved project with journaled entries, rebuilding a never-saved project from the journal, refusing an incomplete journal, and keeping journal keys while a newer edit is unsaved.
- **Rust persistence tests:** transactional extraction, restart/reopen, snapshot restoration, portable mirrors, online backups, stale/conflicting writes, SQL rollback, and repair after a failed mirror write are covered. A separate test rejects malformed rich text and future database schema versions. Since October 16: delta saves rebuilt from entry rows (with stale-base, missing-entry, stray-entry and deletion cases), history sharing unchanged entry versions and pruning by age, the time-bucket retention rule, and migration of a committed version 1 database fixture (`src-tauri/tests/fixtures/v1-project.sqlite3`, written by the version 1 code) including its history and snapshot.
- **Visual inspection:** inspected the [actual browser writing view](evidence/writing-view.png) after the long-manuscript test. This is a screenshot of the implemented editor with synthetic test prose, not a design mockup.
- **Dependencies:** the initial test-runner audit findings were resolved by updating Vitest; the subsequent npm install audit reported zero vulnerabilities.

## Important boundaries

- Native integration exercises the app's editor, IPC, SQLite, and quit guard. It is not a physical keyboard/menu automation test, a crash/power-loss test, or proof of all WebKit editing behavior.
- The 5,004-word scenario demonstrates persistence and navigation; it is not a latency benchmark or evidence for 50,000-word projects.
- No forced process kill, disk removal, power interruption, exhausted physical disk, or OS crash was induced. Failed SQL writes and portable-file failures were deliberately simulated in Rust tests.
- OS spellcheck, IME composition, extensive rich paste, accessibility/VoiceOver, long sessions, native file-dialog exports, and signed/notarized distribution still need focused manual qualification.
- Automatic recovery history keeps every save from the last 10 minutes, one per 5 minutes for a day, one per hour beyond that, up to 2,000 states; deliberate named snapshots are separate.
- The delivered local app bundle is a development build. A release build is available with `npm run tauri build`; distribution signing/notarization is not configured.

## Personal Word workspace update -- October 16, 2026

Re-run after the expanded workspace changes (see [personal-word-v2.md](personal-word-v2.md)):

- `npm run build`: passed.
- `npm test`: 34 unit tests passed in 6 files.
- `npm run test:e2e`: 11 Playwright scenarios passed (Chromium; browser storage only).
- `cargo test`: 14 Rust persistence tests passed, 1 ignored.
- Native smoke (fresh `native-smoke` debug build, macOS WebKit): both phases passed, including page fragmentation of an overflowing paragraph with a page count above one, the continuous/pages toggle, quit flush, process restart, snapshot restore, SQLite integrity, and portable JSON equality. See [native evidence](evidence/native-smoke.json).
- Release: `npm run tauri build -- --bundles app` produced `src-tauri/target/release/bundle/macos/Personal Word.app` (identifier `com.folio.writing` retained). The superseded debug `Folio.app` bundle was removed.

## UI and research rework -- October 16, 2026 (evening)

- `npm run build`: passed. `npm test`: 52 unit tests (indent stepping, citation lookup parsing/mapping with inline fixtures, Chicago website dates).
- `npm run test:e2e`: 25 Playwright scenarios (adds toolbar, layout, and research specs; Chromium, browser storage only).
- `cargo test`: 16 Rust tests passed, 1 ignored (adds `lookup_fetch` scheme rejection).
- Native smoke on a fresh `native-smoke` build: both phases passed, including page fragmentation with the new Page view toggle and status-line page count in macOS WebKit.
- Typing cost (production build, Chromium, 1,200-word paragraph, insertText + frame): median ~17 ms before and after the rework.
- Light/dark screenshots reviewed in Chromium: writing screen, research panel, project list with open sort menu, unpinned sidebar. Native WebKit visuals beyond the smoke test were not screenshot-reviewed.
- Citation lookup was exercised only against mocked Crossref responses; live Crossref/Open Library/web requests were not run in tests.

## Save path at 100,000 words — October 16, 2026

`npm run bench` (`scripts/bench-save.sh`) builds a 100,000-word project (100 sections × 1,000 words) and times one keystroke in the middle section and one save. "Before" is commit 6f1e6e9 run with the same benchmark; three runs each on this Intel Mac, no other build running.

| Cost | Before | After |
| --- | --- | --- |
| Keystroke: App mutate + journal + sidebar word totals (Node) | 46–62 ms | 0.3–0.7 ms |
| Save, frontend: build and serialize the IPC payload (Node) | 7.5–9 ms, ~1.5 MB | 0.3–0.4 ms, ~29 KB |
| Save, Rust: SQLite commit including history (release) | 216–298 ms, plus three mirror files fsynced on every save | 8–9 ms |
| Portable copies (project.json + text), Rust | inside every save | ~200 ms per background pass, at most every 3 s, outside the store lock |
| Opening: rebuild and validate the project, Rust | ~46–54 ms | ~44–48 ms |

What changed: the keystroke no longer clones and stringifies the project (only the edited entry and a small header go to the journal), sidebar word counts are cached per unchanged entry, a save sends one entry instead of the project, Rust no longer rewrites the whole project blob or copies the whole project into history, and the portable copies moved off the save path.

Limits of these numbers: the keystroke and payload figures run in Node with an in-memory journal, so they leave out WebKit's localStorage write and React rendering; the old number additionally hid WebKit writing a ~1.5 MB journal value per keystroke. The Rust per-save figure is a 50-save loop on a fresh project; the old path got slower as its 100-row history filled. The edited section here holds 1,000 words, so both journal and save cost grow with the size of the section being edited, not the project.

## Reproduce

```sh
npm ci
npm test
npm run build
cargo test --manifest-path src-tauri/Cargo.toml
npm run bench
npx playwright install chromium
npm run test:e2e
npm run tauri build -- --debug --features native-smoke --no-bundle --config '{"identifier":"com.folio.smoke"}'
python3 scripts/native-smoke.py
npm run tauri build -- --debug --bundles app
```

The native harness's temporary project directory is printed by the runner. Browser test reports are transient under `test-results/`. The committed evidence file preserves the successful native run without embedding any real writing.
