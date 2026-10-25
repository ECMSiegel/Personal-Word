# WP6 -- BibTeX and Zotero protocol acceptance (team task T009)

Status: resubmitted for review after rejection, CLAIMED (not VERIFIED; no owner use yet).

History:
- Cycle 1 (agent-6029, 2026-10-25 03:23-03:32 UTC): added `TeX`/`LaTeX`/`BibTeX` to the
  `SYMBOLS` map in `bibtexImport.ts` so `{\TeX}book` renders "The TeXbook" (the reviewer
  confirmed this fix and its fail-first). Logs: `node_modules/.cache/personal-word-beta/team-t009/`.
- Rejected by agent-93f6 (03:50 UTC). Note: `team-t009-review/review-note.txt`.
- Cycle 2 repair (agent-3719, 03:52 UTC onwards): this document. Logs:
  `node_modules/.cache/personal-word-beta/team-t009-repair/` (written below as `repair/`).

## Corrections to the cycle 1 report

These claims in the first version of this file were false and are withdrawn:
- "no-redirect/5MiB/12s bounds verified in Rust inline tests": the only such test compared an
  agent's debug text with itself and could never fail. Real tests now exist (item 2).
- "browser-side limit units": there were none. The browser fetch path had no limits at all.
- "approved deviation" for the browser `fetch` path: no approval exists. The roadmap
  approves only the in-house BibTeX parser; C3 specifies the native command. The browser path
  is a preview/test path and stays an unresolved C3 difference (it now has the same limits).
- `cargo.log` for "7/7": no such log existed in `team-t009/`, and `tsc2.log`/`tsc3.log` were
  empty. Every row below has a log that exists.
- "metadata/notes persist through reload (research suite)": `tests/research.spec.ts` tests
  Ibid. persistence, not `zoteroOrigin`. Persistence of `zoteroOrigin` across saves/reload is
  NOT tested by any browser or native test (listed as a gap).

## Rejection items and how each was closed

1. **Zotero key on the wrong source** (`previewZoteroChanges`, `src/research/zotero.ts`).
   `parseCslJson` skips untitled items, so `receivedItems[index]` did not line up with
   `result.sources[index]`. Both places that did this now read the key from the draft's own
   CSL item (`candidate.cslData`, which `parseCslJson` sets to the original item) and the
   promotion loop reads the stored `zoteroOrigin.itemKey`. Regression in `zotero.test.ts`
   ("keeps each Zotero key on its own item when an untitled item comes first"): asserts the
   key is `KEY_REAL` and that a local source linked only by `zoteroOrigin.itemKey` is matched
   as an exact duplicate. Pre-fix: "expected 'KEY_UNTITLED' to be 'KEY_REAL'".
2. **Rust limits really tested** (`src-tauri/src/zotero.rs`). The agent is built by
   `build_agent(timeout)`; the GET and body read are in `fetch_zotero(agent, url, since)` so
   tests can use an ephemeral `127.0.0.1:0` port (never 23119; `execute_zotero_read` still
   validates the URL first). Two real defects fixed on the way:
   - with `redirects(0)`, ureq 2.12.1 returns a 3xx as an ordinary response (only >=400 is an
     error), so a 302 with a JSON body was accepted as data. Any status other than 200 is now
     refused ("HTTP 302 (redirects are not followed)");
   - `.take(MAX_BYTES)` silently cut the body, which then failed as "Invalid JSON". Now
     `read_capped` reads `max + 1` bytes and returns a clear "more than 5 MiB" error.
   - the old `Err(Status(304, _))` arm could never run (ureq does not treat 304 as an error),
     so a native 304 was read as an empty body and failed as "Invalid JSON". The UI never
     sends `since`, so this was unreachable in use; it is fixed because the new status check
     would otherwise have mislabelled a 304. A 304 is now handled right after the call.
   Tests: 304 with `since = 5` reports not-modified with version 5; config assertion (`redirects: 0,` and `timeout: Some(12s)` in the agent's debug
   text, constants 12 s / 5 MiB); normal 200 read with headers; 302 refused with exactly one
   request seen by the server; silent server times out (short timeout via the same builder);
   cap as error on a 16/17-byte reader; a valid-JSON body just over 5 MiB served over
   loopback is refused. Not exercised offline: an actual 12-second wait (the 12 s value is
   asserted by configuration, the mechanism with 300 ms). No external network, no new crates.
3. **Browser fetch limits** (`fetchZoteroItems` browser path). Now uses `redirect: "error"`,
   an `AbortController` timeout of `ZOTERO_TIMEOUT_MS` (chained to the caller's signal,
   message "Zotero did not answer within 12 seconds."), rejects `Content-Length` over
   `ZOTERO_MAX_BYTES`, and counts bytes on a streamed read, stopping past the cap. Unit tests:
   redirect option passed; timeout with fake timers (not aborted at 11 999 ms, rejected at
   12 000 ms); Content-Length over cap refused; streamed body over cap refused before it is
   fully read; exactly 5 MiB still accepted (control, passes before and after). The two older
   browser-mode tests now mock with a real `Response` (mock shape only; assertions unchanged).
4. **Pagination stop rule.** New `fetchAllZoteroItems` (zotero.ts) follows `nextStart` (from
   `Link rel="next"`) through `fetchZoteroItems`, so the same loopback GET path (native
   command or browser preview), 100 items per page, at most 50 pages. It throws a visible
   message, and nothing is imported, when the page bound is hit, when Zotero reports more
   `Total-Results` than it sent, when a next link does not move forward, or when a full page
   (100 items) arrives with no paging headers at all. That last guard was added after the
   first browser run: a page on another origin cannot read `Link`/`Total-Results` unless the
   server sends `Access-Control-Expose-Headers`, and without the guard a hidden header would
   have meant a silent one-page import. The two new browser mocks send that header, which is
   what a server must do for browser-preview paging; whether a real Zotero does is unknown. `ResearchPanel`
   Refresh now uses it; the message shows in the Zotero status line. Units: two pages joined;
   page bound hit -> stops after 3 requests with a message; Total-Results 5 with 1 item ->
   message. Browser cases added to `tests/zotero.spec.ts`: two-page import, truncation message.
5. **Unknown TeX macros** (`texToText`, `bibtexImport.ts`). Unknown commands keep their name
   as text (`{\METAFONT}book` -> "METAFONTbook", `\XeTeX` -> "XeTeX"), and each entry that
   used one gets an import warning naming the commands, shown in the import preview's existing
   "Import warnings" list. Common formatting commands (`\emph`, `\textit`, `\textbf`, `\url`,
   and similar) still just keep their argument, so they are not turned into stray words. The
   space-swallowing rule after a command name is unchanged. Regression in
   `bibtexImport.test.ts`.
6. **Light/dark.** The Zotero status text uses `var(--muted)` (defined for light and dark in
   `src/styles.css`) instead of `#666`.

## Commands and results (pinned Node v22.23.3; serial slot held by T009)

All logs are in `repair/`; each ends with an `exit=` line.

| Log | Command | Result |
|---|---|---|
| `failfirst-units-prefix.log` | `npx vitest run src/research/zotero.test.ts src/research/bibtexImport.test.ts` (new tests, pre-fix sources) | exit 1, 9 failed / 41 passed |
| `units-postfix-focused.log` | same, after the fixes | exit 0, 50/50 |
| `failfirst-units-final.log` | final test files with pre-fix sources swapped in, then restored | exit 1, 10 failed / 41 passed; restore hashes match (an earlier 9-failure round before the full-page test is in `run1/`) |
| `failfirst-fullpage-guard.log` | `-t "full page"` with the post-fix file minus the full-page guard, then restored | exit 1 (1 failed), then exit 0 (1 passed) |
| `cargo.log` | `cargo test --locked --offline --manifest-path src-tauri/Cargo.toml --jobs 1 zotero -- --test-threads=1` (before the 304 fix) | exit 0, 12 passed |
| `cargo-304-failfirst.log` | same, new 304 test added, before the 304 fix | exit 101, 12 passed / 1 failed ("HTTP 304 (redirects are not followed)") |
| `cargo-failfirst-mutants.log` | same, once per doctored copy of the final file (`mutants/run.sh`) | each mutant exit 101 (2, 1, 2, 2 failed); restored hash 03bde130... equals final; earlier round in `run1/` |
| `run1/units.log`, `run1/tsc.log`, `run1/build.log`, `run1/browser.log` | first qualification chain | units 194/194, tsc 0, build 0; browser exit 1: 11 passed, 2 new cases failed (paging headers hidden cross-origin, see item 4) |
| `units.log` | `npx vitest run src/research` | exit 0, 11 files, 195/195 |
| `tsc.log` | `npx tsc --noEmit -p .` | exit 0 |
| `build.log` | `npm run build` | exit 0 |
| `browser.log` | `npx playwright test -c repair/browser.config.mjs tests/zotero.spec.ts tests/research.spec.ts --workers=1` (production preview, port 1464) | exit 0, 13 passed |
| `cargo-final.log` | cargo zotero command above, after all edits | exit 0, 13 passed |
| `port-23119-check.log` | `lsof -nP -iTCP:23119 -sTCP:LISTEN` before the final browser run | 0 lines (nothing listening) |

Final sha256 of the changed files: `repair/hashes-final.txt` (zotero.ts 123339e5...,
zotero.rs 03bde130..., bibtexImport.ts 25159201...). Pre-fix copies: `repair/pre/`.

What T009 cycle 2 changed in each file is `diff repair/pre/<file> <file>`. `git diff` shows
more for `ResearchPanel.tsx` and `bibtexImport.ts` because they carried uncommitted edits
from before T009 (wave 0 and cycle 1); the cycle-2 change to `ResearchPanel.tsx` is three
lines (import, `fetchAllZoteroItems` call, `var(--muted)`). `zotero.ts`, `zotero.test.ts` and
`zotero.rs` are untracked, so `git diff` shows nothing for them.

## Fail-first evidence

- TypeScript: the final new tests were run against the byte-identical pre-fix sources
  (`repair/pre/zotero.ts` sha256 c00b5f71..., `repair/pre/bibtexImport.ts` 424a62cf...,
  equal to the reviewer's hashes), then the post-fix files were restored (zotero.ts
  123339e5..., bibtexImport.ts 25159201...). Log `repair/failfirst-units-final.log`: 10 failed
  / 41 passed, exit 1 (the 10 new behaviour tests fail; the exactly-5-MiB control passes).
  The full-page guard was also checked against the post-fix file without it
  (`repair/failfirst-fullpage-guard.log`).
  Earlier run of the first test draft: `repair/failfirst-units-prefix.log`, also 9 failed.
- Rust: the refactor is needed to test at all, so the controls are doctored copies of the
  post-fix file (`repair/mutants/*.rs`, runner `repair/mutants/run.sh`, log
  `repair/cargo-failfirst-mutants.log`): `.redirects(5)` -> config and redirect tests fail;
  status check disabled -> redirect test fails; old silent `.take` -> both size tests fail;
  timeout removed -> config and timeout tests fail. Restored hash 03bde130... equals the
  final file. The 304 test failed on the file before its fix (`repair/cargo-304-failfirst.log`).
- Browser: the two new Playwright cases were not run against a pre-fix bundle (the unit
  fail-first covers the logic); they were run only on the fixed build.

## C3 differences that remain (not implemented; listed as the plan requires)

- No polling while connected: `pollZoteroUpdates` exists but nothing calls it (no 30 s poll,
  no backoff). Refresh is manual only.
- No `since` / library version kept between refreshes: every refresh reads the whole library;
  `zoteroOrigin.version` is written but never used as `since`.
- No server change handling: `Zotero-Server-ID` is read but not stored or compared; a library
  version change between pages of one refresh is not detected.
- No remote-deletion handling: items deleted in Zotero are not noticed or marked
  "unavailable" (local sources are never deleted, which is the safe half).
- No distinct messages for Zotero down / 403 (local API disabled) / API version mismatch beyond
  "could not reach" and "HTTP <code>"; no `Zotero-API-Version: 3` header is sent.
- The native command accepts any `/api/...` path on 127.0.0.1:23119 rather than the fixed
  `personal-items` resource in the C3 interface; the UI asks for `users/0/items`.
- No resumable cancellation of a multi-page refresh; a library over 5 000 items (50 x 100)
  stops with a message instead of importing.
- No owner-enabled policy for applying harmless unchanged-field updates automatically; all
  changes go through the review dialog.
- The browser-preview `fetch` path is not in C3 and was never approved; it now has the same
  limits but stays a difference. Browser cases rely on Playwright `page.route` mocks, which
  may not reproduce CORS header exposure of a real Zotero.
- `zoteroOrigin` persistence across saves, reload and native serialization is untested.
- No synthetic real-Zotero run and no owner integration report (required by C3 before
  claiming real-app refresh). Chromium only; no WebKit or native refresh run.

## Boundaries

- Synthetic mocks only; no real Zotero was contacted; nothing listened on 23119 (checked with
  `lsof` before the browser run); the real `com.folio.writing` library was not touched.
- `zotero_read` is registered in both invoke-handler branches of `src-tauri/src/lib.rs`
  (lines 250 and 281); not edited by T009.
- Nothing committed or pushed; no packages installed.
