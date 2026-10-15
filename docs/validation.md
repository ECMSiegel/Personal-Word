# First milestone validation — October 14, 2026

This is a working local desktop slice, not a production durability certification.

## Confirmed behavior

- **Native macOS WebView + SQLite:** the opt-in harness launched two real Tauri processes with an isolated application identifier and temporary project directory. Phase one created a project through the UI, wrote and switched sections, moved prose into a fragment, restored it, and created a named snapshot. It then typed immediately before invoking the real quit guard. Phase two reopened that final text and restored the named snapshot. Both processes exited successfully.
- **Database and portable copies:** after each native process exited, the runner verified `PRAGMA integrity_check = ok`, checked the expected manuscript content, compared `project.json` with the stored project, and verified snapshot counts, including the safety snapshot created before restoration. See [native evidence](evidence/native-smoke.json).
- **Browser end-to-end:** three passing Playwright scenarios cover the complete writer journey, recovery from a newer journal, and 5,004 words across sections with repeated switching, drag reordering, and reload. Browser persistence is explicitly separate from native SQLite.
- **TypeScript unit tests:** nine passing tests cover serialized saves, immediate journals, concurrent edits, retry after failed writes, unavailable journals, malformed/conflicting recovery copies, JSON key-order independence, text export boundaries, and malformed imports.
- **Rust persistence tests:** transactional extraction, restart/reopen, snapshot restoration, portable mirrors, online backups, stale/conflicting writes, SQL rollback, and repair after a failed mirror write are covered. A separate test rejects malformed rich text and future database schema versions.
- **Visual inspection:** inspected the [actual browser writing view](evidence/writing-view.png) after the long-manuscript test. This is a screenshot of the implemented editor with synthetic test prose, not a design mockup.
- **Dependencies:** the initial test-runner audit findings were resolved by updating Vitest; the subsequent npm install audit reported zero vulnerabilities.

## Important boundaries

- Native integration exercises the app's editor, IPC, SQLite, and quit guard. It is not a physical keyboard/menu automation test, a crash/power-loss test, or proof of all WebKit editing behavior.
- The 5,004-word scenario demonstrates persistence and navigation; it is not a latency benchmark or evidence for 50,000-word projects.
- No forced process kill, disk removal, power interruption, exhausted physical disk, or OS crash was induced. Failed SQL writes and portable-file failures were deliberately simulated in Rust tests.
- OS spellcheck, IME composition, extensive rich paste, accessibility/VoiceOver, long sessions, native file-dialog exports, and signed/notarized distribution still need focused manual qualification.
- Automatic recovery history is bounded to 100 saved states; deliberate named snapshots are separate.
- The delivered local app bundle is a development build. A release build is available with `npm run tauri build`; distribution signing/notarization is not configured.

## Reproduce

```sh
npm ci
npm test
npm run build
cargo test --manifest-path src-tauri/Cargo.toml
npx playwright install chromium
npm run test:e2e
npm run tauri build -- --debug --features native-smoke --no-bundle --config '{"identifier":"com.folio.smoke"}'
python3 scripts/native-smoke.py
npm run tauri build -- --debug --bundles app
```

The native harness's temporary project directory is printed by the runner. Browser test reports are transient under `test-results/`. The committed evidence file preserves the successful native run without embedding any real writing.
