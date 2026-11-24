# VALIDATION -- Projects outline rebuild (T343 / OB9), 2026-11-22/23
Tree: main @ ebe40f2 plus the uncommitted batch (nothing committed). Pinned Node v22.23.3 on PATH (`node_modules/.cache/personal-word-alpha-review/tools/node-v22.23.3-darwin-x64/bin`). Status: CLAIMED. No failures, so nothing was re-run alone and there are no intermittents to record. All logs are under `node_modules/.cache/personal-word-beta/`; driver scripts `ob-run.sh` and `ob-tauri.sh` beside them.

| Step | Command | Result | Log |
|---|---|---|---|
| 1 | `npx tsc --noEmit` | no output, exit 0 | ob-tsc.log |
| 2 | `npm test` (vitest) | 100 files, 1446 tests passed, 0 failed, exit 0 | ob-unit.log |
| 3 | `cd src-tauri && cargo test --offline --jobs 1 -- --test-threads=1` | 75 passed, 0 failed, 1 ignored (the two other test targets: 0 tests), exit 0 | ob-cargo.log |
| 3b | `git diff ebe40f2 --stat -- src-tauri` | empty (no Rust change) | -- |
| 4 | `git diff ebe40f2 -- src/layoutBudget.json` | see below | -- |
| 5a | `npm run build` (inside the serial lock) | built in 7.67 s, exit 0 | ob-build.log |
| 5b | `PLAYWRIGHT_PREVIEW=1 PLAYWRIGHT_PORT=1420 npm run test:e2e -- --trace off --output test-results/ob-final` (3 workers, same lock) | 793 passed, 0 failed, 84 skipped, 10.8 min, exit 0 | ob-final.log |
| 6 | `touch src-tauri/src/lib.rs && npm run tauri build` (inside the serial lock) | exit 0, bundle built, NOT launched | ob-tauri.log |

Serial lock released after each held step (checked: no lock folder left).

## Layout budget (step 4)
Changed lines, from the diff against ebe40f2:
- `+  "src/library/outline.css": 0` -- new file at 0.
- `-  "src/styles.css": 115` / `+  "src/styles.css": 106` -- went down by 9.
No number went up.

## Kept build (step 6)
The bundle the owner already hand-tested (binary 2026-11-19 04:57:55, sha256 138f53d01cb7f04b8e7d2f153e5c22125faf2180911a7a162ad792a7f2a269c1) was copied, not moved, to `src-tauri/target/release/bundle/known-good-folders-batch/Personal Word.app` before the rebuild. That folder did not exist before; the copy's binary has the same sha256. `known-good-3ac28af/` was not touched (also kept: known-good-12d9804, known-good-1361f1e).

## Rebuilt app
- Path: src-tauri/target/release/bundle/macos/Personal Word.app
- Binary Contents/MacOS/folio modified: 2026-11-22 21:58:18; `/usr/bin/find src src-tauri/src -newer <binary> -type f` prints nothing. (tests/ was not part of that check.)
- sha256: 3c41db2a0d97c309ee7cb69b8a9c7438119b37306b3abdb1ca90de25b08f1505
- Not launched.

## Not verified
- The Mac app's WebKit rendering of the outline: subgrid, `:has()`, the new header row and name-cell layout, the faux-bold in the menus. All browser runs are Chromium.
- A real `library.json` in the real app (only unit and cargo tests cover the file; native `list()` timing behind REVIEW-2 N1 is inferred from code).
- Touch or trackpad drag.
- VoiceOver reading of the outline, pins and column chooser.
- Exported PDF/Word (untouched by this batch; not re-checked by eye).
