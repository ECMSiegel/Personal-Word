# VALIDATION -- folders batch (T332 / FB14), 2026-11-19
Tree: main @ 3ac28af plus the uncommitted batch. Pinned Node on PATH. No failures, so nothing was re-run alone.

| Step | Command | Result | Log |
|---|---|---|---|
| a | `npx tsc -b` | no output, exit 0 | node_modules/.cache/personal-word-beta/fb-tsc.log |
| b | `npm test` | 97 files, 1377 tests passed | node_modules/.cache/personal-word-beta/fb-unit.log |
| c | `cd src-tauri && cargo test --offline --jobs 1 -- --test-threads=1` | 75 passed, 0 failed, 1 ignored | node_modules/.cache/personal-word-beta/fb-cargo.log |
| d1 | `npm run build` (inside the serial lock) | built, exit 0 | node_modules/.cache/personal-word-beta/fb-build.log |
| d2 | `PLAYWRIGHT_PREVIEW=1 PLAYWRIGHT_PORT=1420 npm run test:e2e -- --trace off --output test-results/fb-final` (3 workers) | 739 passed, 0 failed, 76 skipped, 10.4 min, exit 0 | node_modules/.cache/personal-word-beta/fb-final.log |
| e | failures re-run alone | none needed; the known intermittents (drop-target:123, comments:36, floating:933, editor-toolbar:24) all passed in the full run | -- |
| f | `touch src-tauri/src/lib.rs && npm run tauri build` | exit 0, bundle built, NOT launched | node_modules/.cache/personal-word-beta/fb-tauri.log |

Serial lock released after d2 (checked: no lock folder left).

## Rebuilt app
- Path: src-tauri/target/release/bundle/macos/Personal Word.app
- Binary Contents/MacOS/folio modified: 2026-11-19 03:50:24; no file under src, src-tauri/src or tests is newer.
- sha256: 04401d0bb07ecb98818fd20384281e811dcba2f661861b8742b85e03bcb9a4cd

## Kept build
The previous owner-tested bundle (binary 2026-11-17 03:25, sha256 3b8e696c...dabf) was copied (not moved) to src-tauri/target/release/bundle/known-good-3ac28af/Personal Word.app before the rebuild. The folder did not exist before.

## Re-validation after REVIEW-5 repairs (FB15, FB16)
Final tree after T333/T334. Pinned Node on PATH. No failures, so nothing was re-run alone.

| Step | Command | Result | Log |
|---|---|---|---|
| 1 | `npx tsc -b` | no output, exit 0 | -- |
| 2 | `npm test` | 97 files, 1377 tests passed | node_modules/.cache/personal-word-beta/fb2-unit.log |
| 3 | `cd src-tauri && cargo test --offline --jobs 1 -- --test-threads=1` | 75 passed, 0 failed, 1 ignored | node_modules/.cache/personal-word-beta/fb2-cargo.log |
| 4a | `npm run build` (inside the serial lock) | built, exit 0 | node_modules/.cache/personal-word-beta/fb2-build.log |
| 4b | `PLAYWRIGHT_PREVIEW=1 PLAYWRIGHT_PORT=1420 npm run test:e2e -- --trace off --output test-results/fb-final2` (3 workers) | 748 passed, 0 failed, 76 skipped, 10.7 min, exit 0 | node_modules/.cache/personal-word-beta/fb-final2.log |
| 5 | failures re-run alone | none needed | -- |
| 6 | `touch src-tauri/src/lib.rs && npm run tauri build` | exit 0, bundle built, NOT launched | node_modules/.cache/personal-word-beta/fb2-tauri.log |

Serial lock released after 4b (checked: no lock folder left).

### Rebuilt app
- Path: src-tauri/target/release/bundle/macos/Personal Word.app
- Binary Contents/MacOS/folio modified: 2026-11-19 04:57:55; `/usr/bin/find src src-tauri/src tests -newer <binary> -type f` prints nothing.
- sha256: 138f53d01cb7f04b8e7d2f153e5c22125faf2180911a7a162ad792a7f2a269c1
- This replaces the 03:50:24 build (sha256 04401d0b...a4cd) listed above.
