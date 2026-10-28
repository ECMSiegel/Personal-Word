# UI wave 3 final validation (T151 / plan task V)

Date: 2026-10-28, runs 10:37Z to 10:50Z (06:37 to 06:50 EDT). Run by agent-a0fd (Claude Code, Opus 5.5) for coordinator agent-3663, on the final uncommitted wave-3 tree (HEAD `b3a151a` plus working-tree changes), pinned Node v22.23.3, serial slot announced at 10:34Z (board #810, #811) and registered on T151 once T150 (D2) was done, display kept awake with `caffeinate -d -i -u`. No source or test file was changed by this task; nothing committed.

**Status: CLAIMED.** Every result below is an automated or viewed check. Nothing is VERIFIED; only the owner's real use of the new app does that (sheet at the end).

**The Mac screen was LOCKED for the whole run** (`ioreg -n Root -d1`: `"IOConsoleLocked" = Yes` at about 10:36Z and again at 10:48:53Z; HID idle about 2 h). The native steps 6 and 7 and the P2 native gate were therefore NOT RUN. That is an environment limit, not a product failure; the exact morning commands are below.

Logs and artifacts: `node_modules/.cache/personal-word-beta/ui3-final/` (called `LOGS/` below). Every run log ends with `EXIT=<code>` and a UTC timestamp.

## Results, plan Validation steps 1-11

| Step | Command | Expected | Actual | Log |
|---|---|---|---|---|
| 0 | tree fingerprint at start and end (`git rev-parse HEAD`, `git stash list`, `git status --porcelain`) | no source change during the run | HEAD `b3a151a` both times; stash list empty both times; the only status difference is 4 new `team/agents/*.json` files (board joins). No file under `src/`, `tests/` or `src-tauri/src/` is newer than the start stamp. D2 (T150) last docs edit 10:47:36Z, approved 10:48:29Z (approved during this run), docs only | `LOGS/tree-start*.txt`, `LOGS/tree-end*.txt` |
| 1 | `node -v`; `npx tsc --noEmit -p .` | v22.23.3; exit 0 | v22.23.3; no errors, exit 0 | `LOGS/step1-tsc.log` |
| 2 | `npm test -- --no-file-parallelism --maxWorkers=1` | all pass (973 + new cases) | 60 files, **1025 passed**, 0 failed, exit 0 | `LOGS/step2-unit.log` |
| 3 | `npm run build` | exit 0 | built, exit 0 (chunk-size warning only) | `LOGS/step3-build.log` |
| 4 | Playwright, whole `tests/`, production preview of a private build (`npx vite build --outDir "LOGS/dist"`), 1 worker, no retries, port 1620, `PW_DIST_DIR` set | all pass | **265 passed, 0 failed** in 7.5 min, first run; no reruns needed. New specs all green: page-break 1, tables-context 3, sidebar-rename 4, pages 5, shortcuts 4, drag-reorder 7, drop-target 7, alignment 7 (tests counted from the log). 0 failures in the log. Load-sensitive specs all passed (notice, performance, research:176, split-view incl. :155, writing-aids:21); motion-u7 now has cases at :43 and :61 (both passed; the old :22 case no longer exists after T154) | `LOGS/step4-dist-build.log`, `LOGS/step4-playwright.log`, `LOGS/step4-report.json`, `LOGS/browser.config.mjs` |
| 4b | T155 Chromium dry-run `npx playwright test -c node_modules/.cache/personal-word-beta/ui3-nativefix/dry.config.mjs` | 1 pass | **as given it cannot run**: Playwright refuses to strip TypeScript under `node_modules/` ("Stripping types is currently unsupported for files under node_modules", "No tests found"), exit 1. A harness limit, not a product failure; filed as board task T160 (p3) | `LOGS/step4b-t155-dry.log` |
| 4b' | same spec with only its 6 type annotations removed (`LOGS/t155/dry.spec.mjs`), run against (i) this run's dist, port 1623 and (ii) the T147 dist it was written for (`ui3-p2/dist`, built 04:53 local), port 1661 | 1 pass each | **1 passed on both**. More open after the Page view toggle; a document-level Escape leaves it open (the fail-first, as designed); the closeMore helper text from `tests/native-screens.js` and `tests/native-smoke.js` closes it (0 open). 585 px block: zoom 0.6777 (pageScale the same), maxPageStartDrift 0, refPageMismatches 0. Chromium only: drift 0 was expected here, only WebKit can show a zoomed offsetTop | `LOGS/step4b-t155-dry-final.log`, `LOGS/step4b-t155-dry-p2.log`, `LOGS/t155/` |
| 5 | `cargo test --locked --offline --manifest-path src-tauri/Cargo.toml --jobs 1 -- --test-threads=1` | 63 passed (T157 added 6 Rust tests to wave 2's 57), 1 ignored | **63 passed, 0 failed, 1 ignored**, exit 0 | `LOGS/step5-cargo.log` |
| 6 | smoke rebuild; `native-reliability.py --suite baseline` (13 + 5) and `--suite beta` (19 + 42); `native-smoke.py` (3 phases) | pass | **NOT RUN (screen locked)**; commands below | `LOGS/lock-check.log` |
| 7 | `native-screens.py` plain and color, every PNG viewed | 10 + 10 plus page view | **NOT RUN (screen locked)** | `LOGS/lock-check.log` |
| P2 gate | `ui3-p2/native-gate.py` per `ui3-p2/NATIVE-GATE-MORNING.md` | latency and caret flags | **NOT RUN (screen locked)** | - |
| 8 | Shift+Enter page break exported to DOCX and PDF | `w:pageBreakBefore`; PDF page 2 starts after the break | DOCX: the whole-suite `tests/page-break.spec.ts` asserts exactly one `<w:pageBreakBefore/>` (passed in step 4). Separately a private spec built "Before the break." + Shift+Enter + "After the break." and saved both exports from Settings: `pdfinfo` 2 pages; `pdftotext` page 1 = title, "Opening", "Before the break.", folio 1; page 2 = "After the break.", folio 2; `p-2.png` viewed (only "After the break." at the top, folio 2). DOCX `word/document.xml` has 1 `<w:pageBreakBefore/>`, carried by an empty paragraph placed between the two text paragraphs (Word shows page 2 starting with that empty line, then "After the break.") | `LOGS/step8-playwright-rerun.log`, `LOGS/step8-artifacts.log`, `LOGS/s8/` |
| 9 | `df -h` >= 5 GB; `npm run tauri build`; identity; marker scan | app built; `com.folio.writing`; zero smoke markers | free space 9.1 GB before, 8.1 GB after; build exit 0 (Rust release 59.9 s); details below | `LOGS/step9-df.log`, `LOGS/step9-app-build.log`, `LOGS/step9-scan.log` |
| 10 | owner hand-check sheet | prepared, empty | below | this file |
| 11 | docs updated (D2), every status CLAIMED | D2 done | T150 last docs edit 10:47:36Z, approved 10:48:29Z (approved during this run); `docs/validation.md` "UI wave 3" section now points here | `docs/validation.md` |

### Step 9: normal app

- Path: `/Users/ethansiegel/Local Projects/VC Projects/Project 13 - Word Processor/src-tauri/target/release/bundle/macos/Personal Word.app` (15.57 MiB), built 10:50:16Z. It replaces the wave-2 build (binary sha256 `13e98e8c...`).
- `Info.plist`: `CFBundleIdentifier` = `com.folio.writing`; `CFBundleShortVersionString` and `CFBundleVersion` = 0.1.1.
- sha256 of `Contents/MacOS/folio` (16,273,440 bytes): `31fff151b20c83626b9693e6b88711dd60eba7ed6f9c063a4ce288c747445479`.
- Marker scan (`grep -c -a`). The control is the existing smoke debug binary `src-tauri/target/debug/folio` (wave 2, 2026-10-27 22:12 local; NOT rebuilt tonight, so it lacks T157's command), which proves the scan finds markers when they are present:

| Marker | Normal app | Smoke debug binary (control) |
|---|---|---|
| `smoke_snapshot` | 0 | 10 |
| `native-screens` | 0 | 2 |
| `com.folio.smoke` | 0 | 8 |
| `FOLIO_SMOKE` | 0 | 12 |
| `read_dropped_file` (allowed) | 2 | 5 |
| `read_dropped_pdf` (allowed, new in T157) | 2 | 0 |

## Native steps NOT RUN: morning commands (unlocked, unoccluded screen; hold the serial slot)

From the project folder:

    export PATH="$PWD/node_modules/.cache/personal-word-alpha-review/tools/node-v22.23.3-darwin-x64/bin:$PATH"
    df -h /System/Volumes/Data          # stop if under 5 GB free (8.1 GB after tonight's app build)
    npm run tauri build -- --debug --features native-smoke --no-bundle --config '{"identifier":"com.folio.smoke"}'
    python3 scripts/native-reliability.py --suite baseline     # expect 13 scenarios + 5 controls
    python3 scripts/native-reliability.py --suite beta         # expect 19 scenarios + 42 controls
    python3 scripts/native-smoke.py                            # expect 3 phases ok
    python3 scripts/native-screens.py --out "node_modules/.cache/personal-word-beta/ui3-final/native-plain"
    python3 scripts/native-screens.py --out "node_modules/.cache/personal-word-beta/ui3-final/native-color" --palette color

View every PNG, especially `writing-pages-light/dark`: pages stacked, a grey gap between page 1 and page 2, no sideways scrollbar, no open More popover.

P2 native gate: follow `node_modules/.cache/personal-word-beta/ui3-p2/NATIVE-GATE-MORNING.md` steps 1-5 exactly (rebuild BOTH smoke binaries after the T155 patch, base and p2; then `python3 "$S/native-gate.py" --binary base="$S/bin/folio-base" --binary p2="$S/bin/folio-p2" --runs 2`). Pass: p2 sync p50 <= 25 ms and p95 <= 50 ms at start and middle in both runs; all six caret flags true; 585 px pane maxPageStartDrift <= 2 and refPageMismatches 0. Then the narrow-pane and IME hand steps 4-5. The debug smoke binary must be rebuilt in any case: the one on disk predates T155 and T157.

## Incidents during the wave (for the record)

- **Duplicate dispatch at start (05:47-05:51Z):** a second session (agent-a6ec, OpenCode) joined and dispatched ten workers without reading the coordinator's dispatch (#588/#591), so two batches raced for the same tasks. The board's first-to-claim rule kept one owner per task; the duplicates left without editing; a6ec stood down as coordinator (#598). Two of its workers kept T138 and T145 legitimately.
- **Tree stash, 08:33:46Z to 08:37:25Z:** a "T135 counterfactual" `git stash` put `src/styles.css`, `src/App.tsx` and `src/components/ProjectSidebar.tsx` back to HEAD for about four minutes (#710, #716). Any build in that window was a wave-2 baseline and was discarded. The coordinator then banned stash, checkout and reset on the shared tree (#714). Tonight's V run started at 10:37Z with an empty stash list.
- **Unquoted-path rm incident (about 09:48Z, agent-ceda, T156):** an unquoted path (the project path has spaces) split an `rm -rf`/`mkdir`/`cp` into pieces. No project file was lost (checked with git, #784). Stray empty folders remain for the owner: `/Users/ethansiegel/Local` (empty) and `./Processor` (an empty folder chain `Processor/node_modules/.cache/personal-word-beta/ui3-e3-cfg`, created 04:03 local, older than that incident). Unknown whether a pre-existing `/Users/ethansiegel/Local` was removed. Not touched by V.
- **V's own stray (10:47Z, fixed at once):** the first version of the step-8 spec built its output folder from a URL path, so the spaces became `%20` and Playwright created `/Users/ethansiegel/Local%20Projects/VC%20Projects/Project%2013%20-%20Word%20Processor/.../ui3-final/s8/` holding the two exports. V moved both files into `LOGS/s8/`, then removed only the empty folders it had just created (`find ... -type d -empty -exec rmdir`; no `rm -rf`). It confirmed that `/Users/ethansiegel/Local%20Projects` no longer exists, switched the spec to `fileURLToPath`, and reran step 8 (the evidence above is from the rerun).
- Also from the board: T139 S1 was rejected once on a specificity bug (fixed); T152 (an S2 regression), T153 (split-view test viewport), T154 (motion-u7:22) and T159 were filed and closed during the wave; all their specs passed in step 4.

## Not established

- Anything native: WebKit rendering, latency and caret behaviour of vertical page view (P2 gate), native reliability and smoke, native screenshots. All of these were NOT RUN because the screen was locked.
- T155's harness fixes in WebKit. The Chromium dry-run passed, but a zoomed offsetTop can only show up in WebKit.
- Native PDF drop onto a source's PDF slot (T157): Rust-tested (63 cargo tests) and unit-routed, never driven in the GUI.
- Native file drop on the Projects screen, native drag reorder by hand, Mac Reduce Motion with real menus.
- Opening the DOCX in Word or Pages: only the XML and the PDF were checked.
- The new app has not been launched by anyone.
- Browser checks prove nothing about native WebKit rendering or native SQLite storage.

## Open owner decisions (answered tonight with plan defaults; the owner may change them)

1. **Page rule at a page foot:** P2 ships the P1 spike rule. A block that does not fit the space left on a page moves WHOLE to the next page, which can leave blank space at the page foot up to one block tall. Only a block taller than a whole page straddles the gap. The plan's open question 3 said "taller than the remaining space straddles". Switching to that is a one-condition change in `src/editor/pagination.ts` (decision 2026-10-28T07:22Z).
2. **Counter digits under Futura:** kept Futura with proportional counter digits. The tabular-nums rule stays, and the limitation is documented. Alternatives: (b) system-font counters, (c) monospaced counter digits (decision 08:36Z).
3. **Cmd+Shift+S now only takes a snapshot** and no longer also saves (K2/T156). Saving is Cmd+S.
4. **Projects screen import:** a text button "Import writing" sits beside "Start new project" (T158). It replaces the orphan "Select files" control.

## OWNER HAND-CHECK sheet (Personal Word.app, build above, sha256 31fff151...)

Run these in the new app (path above), then write the result. Agents may not fill these in.

a. Toolbar at the default window: icons only; Insert image and Insert table on the bar; More holds the five rare groups (indent, spacing, view, aids, setup) as labelled rows with shortcut hints. Result: ____
b. Hover a trash can, a tab, Snapshot, a toolbar icon and a menu row: no grey box anywhere, only bold or colour; the trash goes red. Result: ____
c. Select an entry in Plain and in Color: the entry is semibold (text colour in Plain, section tint in Color), and its section header is NOT emphasised. Result: ____
d. Rename the project from the sidebar title, then click away: the name is saved; it appears once above the editor (tab strip); the row above the editor shows only the section. Result: ____
e. Open a split in continuous and in page view: the two panes' first lines are level, undo history in the left pane is kept after opening and closing, and the footer page number updates as soon as you click into the other pane. Result: ____
f. Page view scrolls down, not sideways; a tall paragraph at a page end (note what it does: whole-block move, see decision 1); a narrow split pane shows a scaled page. Result: ____
g. Shift+Enter breaks the page (Cmd+Enter is a soft line break). Settings > Shortcuts: rebind Focus mode; a reserved chord and a duplicate are refused; Reset works; the new chord survives quit and reopen. Result: ____
h. Right-click inside a table (or Shift+F10 with the caret in a cell): Add row below, Delete row, Add column after, Delete column, Toggle header row and Delete table all work; Escape closes the menu. Result: ____
i. Drag a sidebar group and an entry to new places (2 px accent line, no shadow); the arrow buttons still reorder; the order survives reopen. Result: ____
j. Drag a .md file over the Projects screen and a .pdf over a source: the outline appears only on the target; a wrong file type is rejected; the native drop works. Result: ____
k. The gear on the Projects screen opens settings (appearance, palette, section colours, reveal on hover, restore tabs, storage, shortcuts); changes apply at once. Result: ____
l. Research: Bibliography is listed on a Chicago project; on another template it appears only once a source or cited footnote exists; notes are listed and open the Notes tab. Result: ____
m. Word count and page status do not jitter as numbers change (tabular figures; under Futura see decision 2). Result: ____
n. Mac Reduce Motion on: menus and drag shifts are instant. Result: ____
o. Anything that looks wrong: ____

Additions for this wave:

p. P2 native gate per `node_modules/.cache/personal-word-beta/ui3-p2/NATIVE-GATE-MORNING.md`: latency, caret flags, 585 px numbers, narrow-pane and IME steps (or let an agent run the gate on an unlocked screen). Result: ____
q. Page rule decision: keep whole-block moves at the page foot, or switch to straddling (decision 1). Result: ____
r. Native PDF drop (T157): open a project > Research > Sources and pick a source with no PDF. Drag a .pdf under 25 MB from Finder onto its PDF slot (the outline says "Drop to attach"): it attaches, its name and size show, and Open beside works. Drag a .txt onto the slot: refused with "Only PDF files can be attached". Drag the same PDF onto the Projects list: still refused. Result: ____
s. "Import writing" button (T158) beside "Start new project": it opens the file picker; a picked .md imports; it has the same height and row as Start new project and no grey box. Result: ____
t. Cmd+Shift+S only takes a snapshot now (it does not also save); Cmd+S saves (decision 3). Is that what you want? Result: ____
u. Stray empty folders from tonight: `/Users/ethansiegel/Local` and `./Processor` inside the project. Confirm nothing of yours was there, then delete them yourself if you want. Result: ____
v. Counter digits under Futura (decision 2): keep, or pick (b) or (c). Result: ____

## Evidence status

CLAIMED for every item. Owner confirmation of the sheet above is what would move any of it to VERIFIED.

## Post-fix revalidation (after T162-T165)

Run by agent-981c (T166), 11:37Z-11:47Z, pinned Node v22.23.3, no source edits. Status: CLAIMED.

| Step | Result | Log |
|---|---|---|
| tsc --noEmit | exit 0 | node_modules/.cache/personal-word-beta/ui3-final2/step1-tsc.log |
| Unit (vitest, 1 worker) | 60 files, 1034 passed, 0 failed | node_modules/.cache/personal-word-beta/ui3-final2/step2-unit.log |
| npm run build | exit 0 | node_modules/.cache/personal-word-beta/ui3-final2/step3-build.log |
| Playwright, whole tests/, production preview, port 1621, 1 worker, no retries | 269 passed, 0 failed (no reruns needed) | node_modules/.cache/personal-word-beta/ui3-final2/step4-playwright.log |
| cargo test (locked, offline, 1 job, 1 thread) | 63 passed, 0 failed, 1 ignored | node_modules/.cache/personal-word-beta/ui3-final2/step5-cargo.log |
| Free disk before app build | 8.8 GiB | node_modules/.cache/personal-word-beta/ui3-final2/step9-df.log |
| npm run tauri build | exit 0 | node_modules/.cache/personal-word-beta/ui3-final2/step9-app-build.log |

New app: src-tauri/target/release/bundle/macos/Personal Word.app, CFBundleIdentifier com.folio.writing, version 0.1.1.
Contents/MacOS/folio sha256: 1d309ed2d62c7a696f1a36154f5ce1500ba3eca7b8f9aec065cc563b27452bed (replaces 31fff151...).
Smoke markers (same scan as before): smoke_snapshot 0, native-screens 0, com.folio.smoke 0, FOLIO_SMOKE 0 (read_dropped_file 2 and read_dropped_pdf 2 are the normal drop commands). Log: node_modules/.cache/personal-word-beta/ui3-final2/step9-scan.log.

Native steps (reliability, smoke, screens, P2 gate) remain NOT RUN: the screen was locked.

## Owner decisions and Word-style page split (2026-10-28 afternoon, T167-T169)

Owner answers to Q018: page view should "do what Word would" (paragraphs split between lines with at least two lines on each page); keep Futura counter digits, Cmd+Shift+S snapshot-only, F1-F12 bare shortcuts and the "Import writing" label. Stray empty folders `/Users/ethansiegel/Local` and `./Processor` removed. Logs: `node_modules/.cache/personal-word-beta/ui3-wordsplit/` and `ui3-p2/`.

- T167 native gate on the pre-split tree (screen unlocked, `ui3-p2/w1-gate.log`): sync p50 9 ms / p95 10-15 ms; paint ratio to base <= 1.24; 585 px pane zoom 0.678, page-start drift 0, footnote page mismatches 0. Caret: 5 of 6 flags; "Up from page 2's first line" read one line high. Later diagnostics showed that was the reading (a wrap position reads as either line), not the drawn caret.
- T168 Word-style split (`src/editor/pagination.ts`): inline spacers inside paragraphs, widow/orphan control, headings keep with next, edited paragraphs (including mark-only edits) and width changes re-measured without their forced breaks, Up/Down across a gap moved by the plugin. Fable review `FABLE-REVIEW-T168.md`: SHIP WITH FIXES, then SHIP after two re-checks.
- Fail-first: new pages.spec vs the pre-split build fails (no inline spacers); the rewrap test fails on a build without stale-spacer hiding (356 px short line) and without mark-step widening (104 px).
- Final native gate (`ui3-p2/w2-gate.log`, binary `ui3-p2/bin/folio-split`): sync p50 8-9 ms, p95 <= 11 ms; all caret flags true for a gap inside a paragraph and between blocks in both runs, judged on WebKit's drawn selection rectangle, including Up from the far end of page 2's first line; 585 px drift <= 1, mismatches 0. Paint p50 ratio to base 1.13-1.43 across runs; p95 paint was above 50 ms for both base and split on this busy machine (split 92-107 ms, base 47-88 ms in the last run) -- reported, no budget set.
- native-smoke.py: 3 phases passed. native-screens.py plain and color: 12 PNGs each, viewed: stacked pages, grey gap, no sideways scroll, no open More popover (T169 fixed the harness's return to continuous view).
- Final full run (`full3.log`, `pw-full4.log`): tsc 0; unit 1042; build 0; cargo 63 passed, 1 ignored; Playwright 270/270 on rerun. The first run had 2 failures: motion.spec (e) (flaky, passes 35/35 isolated) and writing-aids.spec:21 focus mode, which also fails 1 in 5 on the pre-split build (pre-existing flake, filed separately).
- Release app: `src-tauri/target/release/bundle/macos/Personal Word.app`, folio sha256 5907b8c3d69604d13cb8e1147df2a2fdadb6f5e44819fe49e8fc981fc1c75f5b, identifier com.folio.writing.
- Not established: the owner's own use; justified text at a split; RTL text at a split; what a user sees at the one-character-back caret position (Fable: press End on page 2's first line, Up, type a letter -- it should land at the end of page 1's last line).
