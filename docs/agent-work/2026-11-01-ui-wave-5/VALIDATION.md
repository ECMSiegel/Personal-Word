# UI wave 5 -- validation record (T221, W5 V early)

Date: 2026-11-02 (runs 09:06-09:35 UTC, 04:06-04:35 EST). Validator: agent-7fff (Claude Sonnet worker). Base: HEAD b840851 plus the uncommitted wave-5 tree (`git status --short`: 50 modified, 101 untracked; `git diff --stat -- src-tauri` is empty, so no Rust change). Screen: LOCKED (`ioreg -n Root -d1 -a` shows `CGSSessionScreenIsLocked` true at 04:06 and again at 04:35 EST), so every native step is NOT RUN. Owner asleep. Serial lock `node_modules/.cache/personal-word-beta/serial-check.lock` held 09:05-09:36 UTC for the whole heavy run, then released.

**Status: CLAIMED** (nothing here is owner-verified; the hand-check sheet below is for the owner). No source or test file was edited. Logs and scratch: `node_modules/.cache/personal-word-beta/ui5-v/` under `/Users/ethansiegel/Local Projects/VC Projects/Project 13 - Word Processor/`.

## V2 -- after Fable repairs (T222, T223)

Validator: agent-7061 (Claude Sonnet worker, T224). Run 2026-11-02 10:48-11:11 UTC on the repaired tree (HEAD b840851 plus the uncommitted wave-5 tree plus T222/T223 edits). Serial lock held 10:48-11:11 UTC, released. No source or test edits (one `touch` of `src-tauri/src/lib.rs`, mtime only, see row 12). Status stays **CLAIMED**. Scratch and logs: `node_modules/.cache/personal-word-beta/ui5-v2/` (private config `browser.config.mjs`, port 1904, `summary.txt`).

| # | Step | Result | Log | EXIT / UTC |
|---|---|---|---|---|
| 1 | Pinned Node `node -v`; `npx tsc --noEmit -p .` | PASS: v22.23.3; tsc clean (empty log) | `ui5-v2/summary.txt`, `ui5-v2/tsc.log` | EXIT=0 2026-11-02T10:48:27Z |
| 2 | `npm test -- --no-file-parallelism --maxWorkers=1` | PASS: 67 files, **1124 passed** (same count as V; T222's citation-card.css edit changed an existing list, added no vitest cases) | `ui5-v2/unit.log` | EXIT=0 2026-11-02T10:48:54Z |
| 3 | `npm run build`; private `vite build --outDir ui5-v2/dist` | PASS | `ui5-v2/npmbuild.log`, `ui5-v2/build.log` | EXIT=0 10:49:11Z / EXIT=0 10:49:20Z |
| 4 | Playwright, whole `tests/`, production preview of the private build, port 1904, 1 worker, no retries, private config `ui5-v2/browser.config.mjs` | **PASS (EXIT=0): 411 passed, 16 skipped, 0 failed, 0 flaky** (18.3 min). V had 405 passed + 3 failed; the +6 are the T222 specs (floating x2, popover-bounds x1) and the previously failing three now passing. No reruns were needed. | `ui5-v2/pw-full.log`, `ui5-v2/report.json` | EXIT=0 2026-11-02T11:07:41Z |
| 4r | Known-flake specs in this run | all PASSED first time: `motion.spec.ts:36` (a), **`motion.spec.ts:85` (e) now PASSES (T223 fix)**, `writing-aids.spec.ts:21`, `research.spec.ts:176`, `split-view.spec.ts:155`; hover-emphasis crawl passed | `ui5-v2/pw-full.log` | n/a |
| 5 | `git diff --stat -- src-tauri` | EMPTY (0 lines), so no Rust change and no cargo rerun (V's 63 passed + 1 ignored stands) | `ui5-v2/src-tauri-diff.log` | 2026-11-02T11:07:41Z |
| 12 | `df -h`, `npm run tauri build`, identity, marker scan, sha256 | PASS after one forced recompile (details below) | `ui5-v2/step12-df.log`, `tauri-release-1-stale.log`, `tauri-release.log`, `step12-scan-1-stale.log`, `step12-scan.log` | build 1 EXIT=0 11:08:02Z (stale); build 2 EXIT=0 11:10:17Z |

### V2 step 12: release app
- `df -h /System/Volumes/Data` before: 11 GiB free (>= 5 GB).
- **Finding: the first `npm run tauri build` on this tree produced a STALE app.** Cargo reported "Finished release in 1.49s" and recompiled nothing, so the binary's sha256 was identical to V's (`6704f6e2...2457`, 13.19 MiB) even though `dist/` changed (new bundle `index-wI4VKn3V.js`; V's was `index-DGcylxAn.js`). Cargo does not see changes in `dist/` as a reason to rebuild the embedding crate. Logs kept: `tauri-release-1-stale.log`, `step12-scan-1-stale.log`. Inferred, not proven: V's app (13.7 MB) may not have contained the wave-5 frontend at all; the new one is 16.3 MB.
- Fix used: `touch src-tauri/src/lib.rs` (mtime only, no content change; `git diff --stat -- src-tauri` is still empty), then `npm run tauri build` again: release profile compiled for 53.85 s, bundle 15.58 MiB, EXIT=0 11:10:17Z. **Any future rebuild after a frontend-only change needs the same touch** (or the app silently keeps the old UI).
- App: `/Users/ethansiegel/Local Projects/VC Projects/Project 13 - Word Processor/src-tauri/target/release/bundle/macos/Personal Word.app`. Binary mtime 2026-11-02 06:10 EST (11:10 UTC), 16,285,728 bytes, Mach-O x86_64. `Info.plist`: `CFBundleIdentifier` com.folio.writing, version 0.1.1, executable `folio`.
- **New sha256 of `Contents/MacOS/folio`: `3f6c7e667a04add7b6a8a6be087143fa856ba8edfb9c0e7d5e5f923172a8006b`** (identical to `src-tauri/target/release/folio`). V's `6704f6e285e743081c213227d419a01146d0afa8f546ca89373ed4df29ec2457` is **STALE**; do not use it.
- Marker scan (`grep -c -a` on the binary): `smoke_snapshot` 0, `native-screens` 0, `com.folio.smoke` 0, `FOLIO_SMOKE` 0 (zero smoke markers); `read_dropped_file` 2, `read_dropped_pdf` 2 (allowed, as before).
- Not opened or run (native steps still NOT RUN; see below).

---- V's original record (T221) follows; superseded where V2 says so ----

## Result table

| # | Step | Result | Log | EXIT / UTC |
|---|---|---|---|---|
| 1 | Pinned Node `node -v`; `npx tsc --noEmit -p .` | PASS: v22.23.3; tsc clean | `node_modules/.cache/personal-word-beta/ui5-v/summary.txt`, `tsc.log` | EXIT=0 2026-11-02T09:06:41Z |
| 2 | `npm test -- --no-file-parallelism --maxWorkers=1` | PASS: 67 files, **1124 passed** (wave-4 baseline 1070, +54) | `node_modules/.cache/personal-word-beta/ui5-v/unit.log` | EXIT=0 2026-11-02T09:07:13Z |
| 3 | `npm run build` (+ private `vite build --outDir node_modules/.cache/personal-word-beta/ui5-v/dist`) | PASS | `node_modules/.cache/personal-word-beta/ui5-v/npmbuild.log`, `build.log` | EXIT=0 09:07:35Z / EXIT=0 09:07:46Z |
| 4 | Playwright, whole `tests/`, production preview of the private build, port 1892, 1 worker, no retries, private config `node_modules/.cache/personal-word-beta/ui5-v/browser.config.mjs`, isolated synthetic data | **FAIL (EXIT=1)**: **405 passed, 16 skipped, 3 failed**. Two of the failures are flakes (`motion.spec.ts:36` (a) and `writing-aids.spec.ts:21` passed on rerun); `motion.spec.ts:85` (e) is a test race that reproduces on HEAD, fixed in the test (T223). The 16 skipped are screenshot specs that need an env var; they were run in step 8. Failures: `motion.spec.ts:36` (a), `motion.spec.ts:85` (e), `writing-aids.spec.ts:21` | `node_modules/.cache/personal-word-beta/ui5-v/pw-full.log`, `report.json` | EXIT=1 2026-11-02T09:26:38Z (18.9 min) |
| 4r | Each of the 3 failures rerun once in isolation | `motion.spec.ts:36` PASS; `writing-aids.spec.ts:21` PASS; `motion.spec.ts:85` (e) FAIL again (test race reproducing on HEAD, fixed in the test (T223)) | `node_modules/.cache/personal-word-beta/ui5-v/pw-rerun.log` | EXIT=1 2026-11-02T09:29:00Z (2 passed, 1 failed) |
| 5 | `cargo test --locked --offline --manifest-path src-tauri/Cargo.toml --jobs 1 -- --test-threads=1` | PASS: **63 passed, 0 failed, 1 ignored**; `git diff --stat -- src-tauri` empty | `node_modules/.cache/personal-word-beta/ui5-v/cargo.log` | EXIT=0 2026-11-02T09:28:37Z |
| 6 | Smoke rebuild, native-reliability baseline/beta, native-smoke, native gates | **NOT RUN** (screen locked) | -- | commands below |
| 7 | native-screens plain/color, with the two N1 floating scenarios (8 screens per run) | **NOT RUN** (screen locked) | -- | commands below |
| 8 | Chromium screenshots, light/dark x Plain/Color, floating on/off | DONE: 99 PNGs, all opened with Read; list below | `node_modules/.cache/personal-word-beta/ui5-v/shots-summary.txt`, `shots-mine.log`, `shots-floating.log`, `shots-palette.log`, `shots-search.log`, `shots-ctx.log` | mine 09:30:49Z; floating 09:31:14Z; palette 09:31:34Z; search 09:31:57Z; ctx 09:32:25Z (all EXIT=0) |
| 9 | Persistence | Browser part: the reorder specs (`drag-reorder.spec.ts`, with reload) are inside step 4 and passed. **Native part NOT RUN** (hand step below) | step 4 | -- |
| 10 | Export compare vs pre-wave-5 (HEAD) | PASS, identical (details below) | `node_modules/.cache/personal-word-beta/ui5-v/export-new.log`, `export-head.log`, `export-compare.txt` | EXIT=0 both, ~09:08Z |
| 11 | Fable review | SHIP AFTER REPAIRS (see the Fable review section) | `docs/agent-work/2026-11-01-ui-wave-5/FABLE-REVIEW.md` | -- |
| 12 | `df -h`, `npm run tauri build`, identity, marker scan, sha256 | PASS (details below) | `node_modules/.cache/personal-word-beta/ui5-v/step12-df.log`, `tauri-release.log`, `step12-scan.log` | EXIT=0 2026-11-02T09:34:44Z |

### Step 4 failures, in full
- `tests/motion.spec.ts:36` (a) opening the projects search animates only transform/opacity/clip-path/visibility: in the full run an extra animated property `"clip-path"` was seen (`expected [] received ["clip-path"]` at line 41). This is NOT on the known-flake list I was given (it named motion (e) only). Passed on the isolated rerun, so it looks timing-dependent; not investigated, not fixed. Reported to agent-2a1b.
- `tests/motion.spec.ts:85` (e) a menu reopened mid-close reverses from its current frame without remounting: **test race reproducing on HEAD, fixed in the test (T223)**: the spec pressed Escape 40 ms into the show so the hide could finish before the reopen; failed in the full run and again in the isolated rerun (line 110, `toMatchObject` on the reopened listbox).
- `tests/writing-aids.spec.ts:21` focus-mode dimming: known flake; passed on the rerun.
- Known flakes that did NOT fail this run: `research.spec.ts:176`, `split-view.spec.ts:155`, the hover-emphasis crawl (Snapshot-dialog Cancel scale; the crawl ended with "H3 un-hoverable controls: 0, H3 exceptions: 0").

### Step 10: exports
Synthetic project built in `node_modules/.cache/personal-word-beta/ui5-v/export.mjs` (no user data): three sections with `order` reordered to C, A, B in the "reordered" variant, one loose fragment, three sources whose sidebar order (`research.sources`) is reversed (Zeta, Mid, Alpha) in the reordered variant, one footnote per source. 12 variants: bibliographyOrder author/cited/type x scope cited/all x plain/reordered, each exported to DOCX (`exportDocx`), PDF (`exportPdf`) and Markdown (`projectMarkdown`), from the current tree and from `git archive HEAD` extracted to `node_modules/.cache/personal-word-beta/ui5-v/head/` (node_modules symlinked), both through Vite SSR so the same code runs as in the app.
- Compared: Markdown byte-for-byte; DOCX `word/document.xml` + `word/footnotes.xml`; PDF `pdftotext -layout` text. All 12 variants: md same, docx same, pdf same (`export-compare.txt`).
- Bibliography order follows the option, not the sidebar: with sources stored Zeta, Mid, Alpha, `author` gives Alpha, Mid, Zeta; `cited` gives Mid, Zeta, Alpha (citation order of the reordered sections); `type` groups under "Books" alphabetically.
- Limits: `src/export`, `src/model.ts` and `src/research/bibliography.ts` have no diff against HEAD (only `ResearchPanel.tsx` and `research.css` changed under research), so a match is expected. This shows the wave did not change export output for a project with such data; it does not show the UI reorder writes the same `order`/`sources` arrays (the drag-reorder specs cover that). DOCX/PDF were compared as XML/text, not rendered in Word.

### Step 12: release app
- `df -h /System/Volumes/Data` before: 11 GiB free (>= 5 GB).
- `npm run tauri build`: release profile finished in 1m 24s; bundle 13.19 MiB.
- App: `/Users/ethansiegel/Local Projects/VC Projects/Project 13 - Word Processor/src-tauri/target/release/bundle/macos/Personal Word.app` (the only entry in that folder; no Folio.app). Binary mtime 2026-11-02 04:34:43 EST.
- `Info.plist`: `CFBundleIdentifier` com.folio.writing, version 0.1.1, executable `folio`; Mach-O x86_64.
- sha256 of `Contents/MacOS/folio`: `6704f6e285e743081c213227d419a01146d0afa8f546ca89373ed4df29ec2457` -- **STALE** (superseded by the V2 sha256 `3f6c7e66...006b`; see V2 step 12).
- Marker scan (`grep -c -a` on the binary): `smoke_snapshot` 0, `native-screens` 0, `com.folio.smoke` 0, `FOLIO_SMOKE` 0 (zero smoke markers); allowed `read_dropped_file` 2 and `read_dropped_pdf` 2 (same as wave 3).
- Not opened or run (screen locked). This app is STALE: rebuilt in V2.

## Native steps NOT RUN: morning commands
Screen was locked. Unlock the Mac, keep the screen unoccluded, take the serial lock, and from a shell:

    cd "/Users/ethansiegel/Local Projects/VC Projects/Project 13 - Word Processor"
    ioreg -n Root -d1 -a | grep -A1 CGSSessionScreenIsLocked        # must say false
    mkdir "node_modules/.cache/personal-word-beta/serial-check.lock" && echo "owner native $(date -u)" > "node_modules/.cache/personal-word-beta/serial-check.lock/owner.txt"
    export PATH="$PWD/node_modules/.cache/personal-word-alpha-review/tools/node-v22.23.3-darwin-x64/bin:$PATH"
    df -h /System/Volumes/Data                                       # stop under 5 GB
    N="node_modules/.cache/personal-word-beta/ui5-v"; G="node_modules/.cache/personal-word-beta/ui4-g"
    touch src-tauri/src/lib.rs   # cargo does not notice dist/ changes (V2 step 12); forces the smoke binary to embed the CURRENT tree
    # 6a. smoke rebuild (debug binary, identifier com.folio.smoke), then keep a copy for the gates
    caffeinate -dimsu npm run tauri build -- --debug --features native-smoke --no-bundle --config '{"identifier":"com.folio.smoke"}' > "$N/smoke-build.log" 2>&1; echo EXIT=$?
    mkdir -p "$N/bin" && cp src-tauri/target/debug/folio "$N/bin/folio-v"
    # 6b. native reliability and smoke (expect 13 scenarios + 5 controls; 19 + 42; 3 phases ok)
    caffeinate -dimsu python3 scripts/native-reliability.py --suite baseline > "$N/native-baseline.log" 2>&1; echo EXIT=$?
    caffeinate -dimsu python3 scripts/native-reliability.py --suite beta > "$N/native-beta.log" 2>&1; echo EXIT=$?
    caffeinate -dimsu python3 scripts/native-smoke.py > "$N/native-smoke.log" 2>&1; echo EXIT=$?
    # 6c. native gates (no page code changed; regression only; expect zero flags True)
    caffeinate -dimsu python3 "$G/native-gate.py" --binary v="$N/bin/folio-v" --runs 1 --phase pages-zoom --out "$N/gate-zoom.json" > "$N/gate-zoom.log" 2>&1; echo EXIT=$?
    caffeinate -dimsu python3 "$G/native-gate.py" --binary v="$N/bin/folio-v" --runs 1 --phase pages-probe --out "$N/gate-probe.json" > "$N/gate-probe.log" 2>&1; echo EXIT=$?
    # 7. native screens, plain and color (each run ends with the two floating scenarios: 8 screens per scenario)
    caffeinate -dimsu python3 scripts/native-screens.py --out "$N/native-plain" > "$N/native-screens-plain.log" 2>&1; echo EXIT=$?
    caffeinate -dimsu python3 scripts/native-screens.py --out "$N/native-color" --palette color > "$N/native-screens-color.log" 2>&1; echo EXIT=$?
    rm "node_modules/.cache/personal-word-beta/serial-check.lock/owner.txt"; rmdir "node_modules/.cache/personal-word-beta/serial-check.lock"

Read every PNG (writing-pages light/dark; both floating screens: sidebar bare in the margin, card open top right). `native-screens.py` takes only `--out`, `--timeout` and `--palette`; the floating scenarios are always captured at the end. The smoke build writes `src-tauri/target/debug` and does not touch the release `Personal Word.app` above. Step 9 native hand step: in the real app reorder two fragments, two sources and two notes, quit with Cmd+Q, reopen, and check the order held.

## Screenshots (step 8): every file opened with Read, one line each
Set: `node_modules/.cache/personal-word-beta/ui5-v/shots/` (`rows/`, `panel/`, `floating/`, `split/`, `palette/`, `search/`, `ctxmenu/`, `card/`). Sources: my spec `node_modules/.cache/personal-word-beta/ui5-v/shotspec/v.spec.mjs` (config `browser.shots.mjs`, port 1893) plus the shot hooks already in the wave specs (`PW_SHOTS_DIR`, `PALETTE_SHOTS`, `E1_SHOTS`, `E4_SHOTS`), run against my private build. Light/dark is the emulated scheme; Plain/Color is the saved palette. Each file was opened; the lines are written per family, so files that differ only by scheme or palette share wording, and where one differed I say so in the notes.

Things worth a human look (seen in the files): at 190 px the "Manuscript" label is cut off by the hover icons and word counts are hidden (pre-existing); the research panel's "Selected sources added" toast covers the bottom of the panel, and the "Recovered pending edits" toast sits over the bottom of the card in the first screens after a reload (known limit: toast over the card); in the "Full citation again" dropdown the selected row looks heavier and larger than the other row; in floating mode the long Research list runs behind the bottom rows (a note row peeks above "Read manuscript"); the card harness cites repeatedly so extra source rows and footnote numbers pile up in the card shots (a harness artefact, not an app fault).

- `card/card-cited-color-dark.png` -- card cited, color dark: card 'cited' stage: Page field, Note form, Preview, Add another/Done; the footnote appears at the page bottom
- `card/card-cited-color-light.png` -- card cited, color light: card 'cited' stage: Page field, Note form, Preview, Add another/Done; the footnote appears at the page bottom
- `card/card-cited-plain-dark.png` -- card cited, plain dark: card 'cited' stage: Page field, Note form, Preview, Add another/Done; the footnote appears at the page bottom
- `card/card-cited-plain-light.png` -- card cited, plain light: card 'cited' stage: Page field, Note form, Preview, Add another/Done; the footnote appears at the page bottom
- `card/card-focus-color-dark.png` -- card focus, color dark: focus mode: toolbar hidden, card sits below the reveal band, sidebar below it
- `card/card-focus-color-light.png` -- card focus, color light: focus mode: toolbar hidden, card sits below the reveal band, sidebar below it
- `card/card-focus-plain-dark.png` -- card focus, plain dark: focus mode: toolbar hidden, card sits below the reveal band, sidebar below it
- `card/card-focus-plain-light.png` -- card focus, plain light: focus mode: toolbar hidden, card sits below the reveal band, sidebar below it
- `card/card-footnote-color-dark.png` -- card footnote, color dark: card opened from a footnote number: heading 'Edit citation', same fields, toolbar comment/clip buttons enabled
- `card/card-footnote-color-light.png` -- card footnote, color light: card opened from a footnote number: heading 'Edit citation', same fields, toolbar comment/clip buttons enabled
- `card/card-footnote-plain-dark.png` -- card footnote, plain dark: card opened from a footnote number: heading 'Edit citation', same fields, toolbar comment/clip buttons enabled
- `card/card-footnote-plain-light.png` -- card footnote, plain light: card opened from a footnote number: heading 'Edit citation', same fields, toolbar comment/clip buttons enabled
- `card/card-narrow-fallback.png` -- 1100x800: citation card replaced by the full Research panel (fallback), sidebar normal
- `card/card-new-color-dark.png` -- card new, color dark: card 'Add a citation' with the DOI lookup, Look up and Enter manually, Open full research panel; top right, clear of the toolbar and page
- `card/card-new-color-light.png` -- card new, color light: card 'Add a citation' with the DOI lookup, Look up and Enter manually, Open full research panel; top right, clear of the toolbar and page
- `card/card-new-plain-dark.png` -- card new, plain dark: card 'Add a citation' with the DOI lookup, Look up and Enter manually, Open full research panel; top right, clear of the toolbar and page
- `card/card-new-plain-light.png` -- card new, plain light: card 'Add a citation' with the DOI lookup, Look up and Enter manually, Open full research panel; top right, clear of the toolbar and page
- `card/card-preview-color-dark.png` -- card preview, color dark: card in preview: fields filled from the mocked Crossref lookup, scrollable body, Cite here/Start over pinned in a footer row, bottom of the field list fades
- `card/card-preview-color-light.png` -- card preview, color light: card in preview: fields filled from the mocked Crossref lookup, scrollable body, Cite here/Start over pinned in a footer row, bottom of the field list fades
- `card/card-preview-plain-dark.png` -- card preview, plain dark: card in preview: fields filled from the mocked Crossref lookup, scrollable body, Cite here/Start over pinned in a footer row, bottom of the field list fades
- `card/card-preview-plain-light.png` -- card preview, plain light: card in preview: fields filled from the mocked Crossref lookup, scrollable body, Cite here/Start over pinned in a footer row, bottom of the field list fades
- `card/floating-color-dark-continuous.png` -- floating sidebar full window, color dark, continuous view: sidebar bare in the left margin, document clear of it; toast bottom right in the light shots
- `card/floating-color-dark-page.png` -- floating sidebar full window, color dark, page view: sidebar bare in the left margin, document clear of it; toast bottom right in the light shots
- `card/floating-color-light-continuous.png` -- floating sidebar full window, color light, continuous view: sidebar bare in the left margin, document clear of it; toast bottom right in the light shots
- `card/floating-color-light-page.png` -- floating sidebar full window, color light, page view: sidebar bare in the left margin, document clear of it; toast bottom right in the light shots
- `card/floating-narrow-fallback.png` -- 1100x800 window, floating on: normal sidebar, no floating (fallback); a focus ring is on the More button (harness artefact)
- `card/floating-plain-dark-continuous.png` -- floating sidebar full window, plain dark, continuous view: sidebar bare in the left margin, document clear of it; toast bottom right in the light shots
- `card/floating-plain-dark-page.png` -- floating sidebar full window, plain dark, page view: sidebar bare in the left margin, document clear of it; toast bottom right in the light shots
- `card/floating-plain-light-continuous.png` -- floating sidebar full window, plain light, continuous view: sidebar bare in the left margin, document clear of it; toast bottom right in the light shots
- `card/floating-plain-light-page.png` -- floating sidebar full window, plain light, page view: sidebar bare in the left margin, document clear of it; toast bottom right in the light shots
- `ctxmenu/after-delete.png` -- after Delete from the menu: Versions panel lists the 'Before deleting "Better idea"' safety snapshot, toast confirms the delete
- `ctxmenu/dark-color-floating.png` -- floating sidebar without dividers, dark color
- `ctxmenu/dark-color-menu-group.png` -- right-click menu on the Fragments heading, dark color: Collapse, Move up, Move down
- `ctxmenu/dark-color-menu-section.png` -- right-click menu on a section row, dark color: Open, Open beside, Rename, Move up, Move down (disabled), Delete in red; opens at the pointer
- `ctxmenu/dark-plain-floating.png` -- floating sidebar without dividers, dark plain
- `ctxmenu/dark-plain-menu-group.png` -- right-click menu on the Fragments heading, dark plain: Collapse, Move up, Move down
- `ctxmenu/dark-plain-menu-section.png` -- right-click menu on a section row, dark plain: Open, Open beside, Rename, Move up, Move down (disabled), Delete in red; opens at the pointer
- `ctxmenu/floating-560.png` -- floating sidebar in a 560 px window: list ends right above 'Read manuscript' (tight but not overlapping)
- `ctxmenu/floating-no-dividers.png` -- floating sidebar: no 1 px rules between Read/Comments/History/Settings
- `ctxmenu/light-color-floating.png` -- floating sidebar without dividers, light color
- `ctxmenu/light-color-menu-group.png` -- right-click menu on the Fragments heading, light color: Collapse, Move up, Move down
- `ctxmenu/light-color-menu-section.png` -- right-click menu on a section row, light color: Open, Open beside, Rename, Move up, Move down (disabled), Delete in red; opens at the pointer
- `ctxmenu/light-plain-floating.png` -- floating sidebar without dividers, light plain
- `ctxmenu/light-plain-menu-group.png` -- right-click menu on the Fragments heading, light plain: Collapse, Move up, Move down
- `ctxmenu/light-plain-menu-section.png` -- right-click menu on a section row, light plain: Open, Open beside, Rename, Move up, Move down (disabled), Delete in red; opens at the pointer
- `floating/floating-pinned-color-dark.png` -- floating sidebar pinned, color, dark: bare text on the desk, no fill, border or divider lines above Comments/History/Settings; clear of the page; Research group list scrolls behind the bottom rows (last note row peeks above 'Read manuscript')
- `floating/floating-pinned-color-light.png` -- floating sidebar pinned, color, light: bare text on the desk, no fill, border or divider lines above Comments/History/Settings; clear of the page; Research group list scrolls behind the bottom rows (last note row peeks above 'Read manuscript')
- `floating/floating-pinned-plain-dark.png` -- floating sidebar pinned, plain, dark: bare text on the desk, no fill, border or divider lines above Comments/History/Settings; clear of the page; Research group list scrolls behind the bottom rows (last note row peeks above 'Read manuscript')
- `floating/floating-pinned-plain-light.png` -- floating sidebar pinned, plain, light: bare text on the desk, no fill, border or divider lines above Comments/History/Settings; clear of the page; Research group list scrolls behind the bottom rows (last note row peeks above 'Read manuscript')
- `floating/floating-revealed-color-dark.png` -- floating sidebar revealed, color, dark: bare text on the desk, no fill, border or divider lines above Comments/History/Settings; clear of the page; Research group list scrolls behind the bottom rows (last note row peeks above 'Read manuscript')
- `floating/floating-revealed-color-light.png` -- floating sidebar revealed, color, light: bare text on the desk, no fill, border or divider lines above Comments/History/Settings; clear of the page; Research group list scrolls behind the bottom rows (last note row peeks above 'Read manuscript')
- `floating/floating-revealed-plain-dark.png` -- floating sidebar revealed, plain, dark: bare text on the desk, no fill, border or divider lines above Comments/History/Settings; clear of the page; Research group list scrolls behind the bottom rows (last note row peeks above 'Read manuscript')
- `floating/floating-revealed-plain-light.png` -- floating sidebar revealed, plain, light: bare text on the desk, no fill, border or divider lines above Comments/History/Settings; clear of the page; Research group list scrolls behind the bottom rows (last note row peeks above 'Read manuscript')
- `palette/palette-dark-color.png` -- command palette open with query 's', dark color: grouped Actions/Sections, chord hints right-aligned, active row coloured not filled; sits over the top of the toolbar
- `palette/palette-dark-plain.png` -- command palette open with query 's', dark plain: grouped Actions/Sections, chord hints right-aligned, active row coloured not filled; sits over the top of the toolbar
- `palette/palette-light-color.png` -- command palette open with query 's', light color: grouped Actions/Sections, chord hints right-aligned, active row coloured not filled; sits over the top of the toolbar
- `palette/palette-light-plain.png` -- command palette open with query 's', light plain: grouped Actions/Sections, chord hints right-aligned, active row coloured not filled; sits over the top of the toolbar
- `panel/panel-dropdown-color-dark.png` -- research panel dropdown, color, dark: 'Full citation again' dropdown open at 260 px: menu stays inside the panel, two options, the selected row renders heavier/larger than the other (eyeball)
- `panel/panel-dropdown-color-light.png` -- research panel dropdown, color, light: 'Full citation again' dropdown open at 260 px: menu stays inside the panel, two options, the selected row renders heavier/larger than the other (eyeball)
- `panel/panel-dropdown-plain-dark.png` -- research panel dropdown, plain, dark: 'Full citation again' dropdown open at 260 px: menu stays inside the panel, two options, the selected row renders heavier/larger than the other (eyeball)
- `panel/panel-dropdown-plain-light.png` -- research panel dropdown, plain, light: 'Full citation again' dropdown open at 260 px: menu stays inside the panel, two options, the selected row renders heavier/larger than the other (eyeball)
- `panel/panel-notes-color-dark.png` -- research panel notes, color, dark: Notes tab at 260 px: 'Add note' label, evenly spaced note blocks, red Delete note; toast at the bottom
- `panel/panel-notes-color-light.png` -- research panel notes, color, light: Notes tab at 260 px: 'Add note' label, evenly spaced note blocks, red Delete note; toast at the bottom
- `panel/panel-notes-plain-dark.png` -- research panel notes, plain, dark: Notes tab at 260 px: 'Add note' label, evenly spaced note blocks, red Delete note; toast at the bottom
- `panel/panel-notes-plain-light.png` -- research panel notes, plain, light: Notes tab at 260 px: 'Add note' label, evenly spaced note blocks, red Delete note; toast at the bottom
- `panel/panel-sources-color-dark.png` -- research panel sources, color, dark: Sources tab at a 260 px aside: toggles, lookup field and links fit; source rows readable; the 'Selected sources added' toast covers the bottom of the panel
- `panel/panel-sources-color-light.png` -- research panel sources, color, light: Sources tab at a 260 px aside: toggles, lookup field and links fit; source rows readable; the 'Selected sources added' toast covers the bottom of the panel
- `panel/panel-sources-plain-dark.png` -- research panel sources, plain, dark: Sources tab at a 260 px aside: toggles, lookup field and links fit; source rows readable; the 'Selected sources added' toast covers the bottom of the panel
- `panel/panel-sources-plain-light.png` -- research panel sources, plain, light: Sources tab at a 260 px aside: toggles, lookup field and links fit; source rows readable; the 'Selected sources added' toast covers the bottom of the panel
- `rows/rows-190-color-dark.png` -- rows 190 px, color, dark: Research rows (Bibliography, source, notes) start at the same x as the Manuscript entries; PDF row one step deeper; a short line on every row of all three groups; no arrow buttons (only the collapse chevron); at 190 px the Manuscript label is clipped by the hover icons (known) and word counts are hidden
- `rows/rows-190-color-light.png` -- rows 190 px, color, light: Research rows (Bibliography, source, notes) start at the same x as the Manuscript entries; PDF row one step deeper; a short line on every row of all three groups; no arrow buttons (only the collapse chevron); at 190 px the Manuscript label is clipped by the hover icons (known) and word counts are hidden
- `rows/rows-190-plain-dark.png` -- rows 190 px, plain, dark: Research rows (Bibliography, source, notes) start at the same x as the Manuscript entries; PDF row one step deeper; a short line on every row of all three groups; no arrow buttons (only the collapse chevron); at 190 px the Manuscript label is clipped by the hover icons (known) and word counts are hidden
- `rows/rows-190-plain-light.png` -- rows 190 px, plain, light: Research rows (Bibliography, source, notes) start at the same x as the Manuscript entries; PDF row one step deeper; a short line on every row of all three groups; no arrow buttons (only the collapse chevron); at 190 px the Manuscript label is clipped by the hover icons (known) and word counts are hidden
- `rows/rows-270-color-dark.png` -- rows 270 px, color, dark: Research rows (Bibliography, source, notes) start at the same x as the Manuscript entries; PDF row one step deeper; a short line on every row of all three groups; no arrow buttons (only the collapse chevron)
- `rows/rows-270-color-light.png` -- rows 270 px, color, light: Research rows (Bibliography, source, notes) start at the same x as the Manuscript entries; PDF row one step deeper; a short line on every row of all three groups; no arrow buttons (only the collapse chevron)
- `rows/rows-270-plain-dark.png` -- rows 270 px, plain, dark: Research rows (Bibliography, source, notes) start at the same x as the Manuscript entries; PDF row one step deeper; a short line on every row of all three groups; no arrow buttons (only the collapse chevron)
- `rows/rows-270-plain-light.png` -- rows 270 px, plain, light: Research rows (Bibliography, source, notes) start at the same x as the Manuscript entries; PDF row one step deeper; a short line on every row of all three groups; no arrow buttons (only the collapse chevron)
- `rows/rows-390-color-dark.png` -- rows 390 px, color, dark: Research rows (Bibliography, source, notes) start at the same x as the Manuscript entries; PDF row one step deeper; a short line on every row of all three groups; no arrow buttons (only the collapse chevron)
- `rows/rows-390-color-light.png` -- rows 390 px, color, light: Research rows (Bibliography, source, notes) start at the same x as the Manuscript entries; PDF row one step deeper; a short line on every row of all three groups; no arrow buttons (only the collapse chevron)
- `rows/rows-390-plain-dark.png` -- rows 390 px, plain, dark: Research rows (Bibliography, source, notes) start at the same x as the Manuscript entries; PDF row one step deeper; a short line on every row of all three groups; no arrow buttons (only the collapse chevron)
- `rows/rows-390-plain-light.png` -- rows 390 px, plain, light: Research rows (Bibliography, source, notes) start at the same x as the Manuscript entries; PDF row one step deeper; a short line on every row of all three groups; no arrow buttons (only the collapse chevron)
- `search/dark-color-empty.png` -- sidebar search dark color, empty: 'Find in project' with the Cmd+K hint, no clear button
- `search/dark-color-floating-empty.png` -- sidebar search floating dark color, empty: 'Find in project' with the Cmd+K hint, no clear button
- `search/dark-color-floating-text.png` -- sidebar search floating dark color, text 'hello': clear X at the right of the field, Cmd+K hint hidden, matching groups only; floating: no surface behind the field
- `search/dark-color-text.png` -- sidebar search dark color, text 'hello': clear X at the right of the field, Cmd+K hint hidden, matching groups only
- `search/dark-plain-empty.png` -- sidebar search dark plain, empty: 'Find in project' with the Cmd+K hint, no clear button
- `search/dark-plain-floating-empty.png` -- sidebar search floating dark plain, empty: 'Find in project' with the Cmd+K hint, no clear button
- `search/dark-plain-floating-text.png` -- sidebar search floating dark plain, text 'hello': clear X at the right of the field, Cmd+K hint hidden, matching groups only; floating: no surface behind the field
- `search/dark-plain-text.png` -- sidebar search dark plain, text 'hello': clear X at the right of the field, Cmd+K hint hidden, matching groups only
- `search/light-color-empty.png` -- sidebar search light color, empty: 'Find in project' with the Cmd+K hint, no clear button
- `search/light-color-floating-empty.png` -- sidebar search floating light color, empty: 'Find in project' with the Cmd+K hint, no clear button
- `search/light-color-floating-text.png` -- sidebar search floating light color, text 'hello': clear X at the right of the field, Cmd+K hint hidden, matching groups only; floating: no surface behind the field
- `search/light-color-text.png` -- sidebar search light color, text 'hello': clear X at the right of the field, Cmd+K hint hidden, matching groups only
- `search/light-plain-empty.png` -- sidebar search light plain, empty: 'Find in project' with the Cmd+K hint, no clear button
- `search/light-plain-floating-empty.png` -- sidebar search floating light plain, empty: 'Find in project' with the Cmd+K hint, no clear button
- `search/light-plain-floating-text.png` -- sidebar search floating light plain, text 'hello': clear X at the right of the field, Cmd+K hint hidden, matching groups only; floating: no surface behind the field
- `search/light-plain-text.png` -- sidebar search light plain, text 'hello': clear X at the right of the field, Cmd+K hint hidden, matching groups only
- `split/split-fallback-dark.png` -- split view with floating on, dark: two panes, sidebar is the normal panel (fallback), Research opens the full right panel not the card
- `split/split-fallback-light.png` -- split view with floating on, light: two panes, sidebar is the normal panel (fallback), Research opens the full right panel not the card

## Known flakes observed
- `writing-aids.spec.ts:21` focus dimming: failed once, passed on rerun.
- `motion.spec.ts` (e): test race reproducing on HEAD, fixed in the test (T223): Escape at 110 ms plus an `isConnected` precondition. After the fix, `--repeat-each=25` gave 0 failures on the current build (before the fix: 2/25) and 0 on a HEAD build; whole `motion.spec.ts` x5 35/35 pass (logs `node_modules/.cache/personal-word-beta/ui5-r2/{before,after,after-file,head-after}.log`).
- `motion.spec.ts:36` (a): new to the list; failed once in the full run, passed on rerun.
- Not seen this run: `research.spec.ts:176`, `split-view.spec.ts:155`, hover-emphasis crawl failures.

## Not established
- Anything native: WebKit rendering of the floating sidebar and card, native persistence of reordered fragments/sources/notes, native reliability and smoke suites, native screenshots. Chromium is not proof of macOS rendering.
- That the release app launches and shows the wave-5 UI (built and scanned, not opened).
- Word's rendering of the exported DOCX.
- The Fable repairs are covered by the V2 rerun of steps 1-5 and 12 (browser/Chromium only; native still not run).

## Owner hand-check sheet (write the result after each item)
a. Research rows line up with Manuscript and Fragments; the PDF row is one step deeper. Result: ____
b. No arrows anywhere in the sidebar. Drag a group, a section, a fragment, a source and a note; Option+Up/Down on each moves it and VoiceOver reads the move. Result: ____
c. Lines on every row; move the pointer down the list: they swell near it and fall off over about three rows; scroll a long section: the open line fills; Read mode follows. Result: ____
d. Research panel: "Review required details" spans the panel; Notes tab spacing and label; "Full citation again" menu opens inside the panel. Result: ____
e. Settings > "Floating sidebar and research" is off by default; on, with a wide window and page view: the sidebar is bare text on the desk and never touches the page; hover and Tab show the shared bold; narrow the window and it becomes the normal panel; continuous view is on white. Result: ____
f. Card: the Research heading opens it top right; DOI or manual entry, preview, Cite here, Add another; click a footnote number and its card opens; Escape closes it and the cursor returns; the link opens the full panel. Result: ____
g. Focus mode with floating on: the toolbar reveal does not cover the card or the sidebar. Result: ____
h. Snapshot and export buttons are still reachable. Result: ____
i. Anything that looks wrong: ____
j. Sidebar search: type a word, the X appears (the Cmd+K hint hides); clicking X clears and keeps focus in the field; Escape clears a non-empty field and does nothing more on an empty one. Result: ____
k. Scroll fade: the research panel and the card fade at the top/bottom edge only while there is more to scroll; "Cite here" stays visible at the bottom of the card even in a short window. Result: ____
l. Cmd+Shift+P opens the command palette: run a command (for example Take snapshot); "Go to ..." opens a section; Escape returns the cursor to exactly where it was. Result: ____
m. Right-click, or Shift+F10 on a focused row or heading, opens the menu on a section, fragment, source, note, Bibliography and a group heading. Delete keeps a snapshot (check Snapshots & history). On the PDF row, Move moves its source (with its PDF). Result: ____
n. Floating mode has no divider lines above Comments, History and Settings (the normal panel keeps them). Result: ____

Limits to eyeball (known, not fixed):
o. Hysteresis: widen the window while the panel is open instead of the card; the panel does not hand back to the card until Research is reopened. Result: ____
p. A toast ("Recovered pending edits", "Selected sources added", saves) can sit over the bottom of a tall card or panel by 7-12 px. Result: ____
q. After "Cite here", focus goes to the new footnote's text field on the page, not back to the card. Result: ____
r. The Project settings title is now 19 px. Result: ____
s. In floating mode at a sidebar width of 240 px or less the group action icons sit over the labels on hover (no backing, by the no-surface rule). Result: ____
t. At 190 px sidebar width the "Manuscript" label is overlapped by the group icons on hover and word counts are hidden (pre-existing since T096). Result: ____
u. Floating with a long Research list: the list scrolls behind the bottom rows; a half-visible row above "Read manuscript" in short windows. Result: ____

## Fable review
Reviewer: Claude (Fable 5.1), report `FABLE-REVIEW.md`. Verdict: **SHIP AFTER REPAIRS**. No Critical finding and no data-safety finding. Nothing here is owner-verified; the wave stays CLAIMED.

Findings (severity; repaired by T222?):
1. HIGH -- floating + unpinned: hover-reveal collapses crossing the gap between the 8 px edge strip and the 16 px inset sidebar. Repaired by T222.
2. MEDIUM -- floating + unpinned shell paints at z-index 60, not the contracted 4. Repaired by T222.
3. MEDIUM -- B2's inline `maxWidth` lifts the Dropdown's 320 px cap inside scroll containers. Repaired by T222.
4. MEDIUM -- `motion.spec.ts (e)`: test race reproducing on HEAD, fixed in the test (T223), not an app defect; `src/` unchanged. Before 2/25 failures, after 0/25 on the current build and 0/25 on a HEAD build.
5. MEDIUM -- `src/motion.test.ts` never scanned `src/research/citation-card.css`. Repaired by T222.
6. LOW -- the search clear button fades on a keyboard action (plan vs owner rule; owner call). Not repaired.
7. LOW -- floating sidebar: a long Research list is clipped mid-row above "Read manuscript". Not repaired (hand-check / wave 6).
8. LOW -- "Full citation again" selected row is heavier (weight 600 plus the shared stroke and grow; owner taste). Not repaired.
9. LOW -- smaller defects 9a-9p (context-menu Tab and wrap, PDF-row chord, stale menu items, keyboard resize ignores floating cap, palette keyboard fade and `role=status` placement, duplicated Note form dropdown, second focus-ring width, `.lookup-tip` fade exemption, dead `FOCUS_REVEAL_BAND`, scrollspy focus-out shrink, Escape during drag, find-in-project in an inert sidebar, group icons over labels, comment wording). Not repaired (wave 6).

Disposition: findings 1, 2, 3 and 5 were repaired (T222, approved); finding 4 was a test race fixed in the test (T223, approved); 6-9 are owner hand-check / wave 6. V steps 1-5 and 12 were rerun in V2 (all pass) and `Personal Word.app` rebuilt (V's sha256 is stale; new sha256 in V2 step 12). T222's own rerun of the affected specs is recorded on the board note for T222.

## V3 -- full re-run incl. native, screen unlocked (2026-11-02 19:33-20:00 UTC)
Script and logs: `node_modules/.cache/personal-word-beta/ui5-v3/` (`run.sh`, `summary.txt`). Tree unchanged since V2 (only `src-tauri/src/lib.rs` mtime, from the forced-recompile touch).
- tsc 0; unit 1124/1124 (67 files); npm run build 0; Playwright 411 passed / 0 failed (18.4 min); cargo 63 passed, 0 failed, 1 ignored.
- Smoke build recompiled (26 Compiling lines). native-reliability baseline passed; beta passed; native-smoke passed; gates pages-zoom and pages-probe: zero flags True.
- native-screens plain and color: EXIT 1. Captured projects, writing, writing-pages, research, settings, pdf-preview and floating-sidebar (sidebar floating, page centred in the window); FAILED at floating-card: "floating did not engage: no 'Add a citation' card (feature missing or right margin too small)".
  Cause (inferred, not proven natively): the capture window is 1240x840 and the scenario uses 75 % zoom, which leaves ~314 px beside the sheet; the card needs 312 px (280 + 2x16 gap), so it sits on the threshold. Chromium probe at the same 1240x840: the sidebar does not float either; at 1440x900 both the sidebar and the card float and the card opens (`ui5-v3/probe/`). The app falls back to the full research panel as designed (never overlaps text).
  Proposed test-only fix (not applied, awaiting owner): use 50 % zoom for the floating scenario in `tests/native-screens.js`, rebuild the smoke binary, re-run both screen runs.
- V3 follow-up (owner OK'd the 50 % test change): the card still fell back at 50 %, so the margin theory was wrong. A diagnostic added to the failure message (`tests/native-screens.js`) showed, right after the Research click, `paper 439-1255` while the page is drawn at about 220-628: native WebKit reports `.editor-paper`'s rect in its own CSS-`zoom` space (exactly 1/zoom times the drawn size), Chromium does not. `useMarginFit`/`documentEdges` (`src/components/floating.ts`) therefore mis-measure the margins in the real app at any zoom other than 100 %: below 100 % the left margin is overstated (the sidebar can float wider than the real margin, risking overlap) and the right margin understated (the card never opens); above 100 % the reverse. 100 % is correct. Chromium tests cannot see this. Proposed fix (not applied, awaiting owner): detect the legacy-zoom behaviour once with a zoomed probe element and multiply the document edges by the element's total zoom when it applies.
- V3 fix (owner OK 2026-11-02): `src/components/floating.ts` -- `documentEdges` multiplies the column's left/right by its total CSS zoom when a one-time zoomed probe shows the engine reports unzoomed rects (`drawnEdges`, `reportsUnzoomedRects`, `totalZoom`). Chromium reports drawn pixels, so nothing changes there. New unit test in `floating.test.ts` failed before the fix (`drawnEdges is not a function`) and passes after. `tests/native-screens.js`: floating scenario at 50 % and a failure message that records the clicked button, aside/paper/workspace rects and dialog count.
- After the fix (logs `ui5-v3/summary-fix.txt`, `summary-final.txt`): tsc 0; unit 1125/1125; npm run build 0; Playwright floating + scroll-fade 31 passed, then full suite 411 passed / 0 failed; native-screens plain and color EXIT 0, 16 + 16 screens incl. floating-sidebar and floating-card (opened: sidebar bare in the left margin, card top right clear of the page, light/dark, Plain/Color -- files read). Release app rebuilt: `src-tauri/target/release/bundle/macos/Personal Word.app`, folio sha256 3c4a01f7d975165fe0f546c83a5cee74c015797b11615fc95092747916df2cef (3f6c7e66 is now STALE). Native smoke/reliability/gates were run before the fix (V3 above); the fix touches only floating-mode measurement, which they do not exercise.
- Still NOT RUN: step 9 native hand step (reorder, Cmd+Q, reopen). Not checked natively: floating at zoom above 100 % and continuous view (the fix covers them by the same rule; worth a glance in the hand check).
