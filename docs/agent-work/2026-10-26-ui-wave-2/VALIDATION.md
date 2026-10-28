# UI wave 2 final validation (T127 / plan task U21)

Date: 2026-10-27 (runs 21:49 to 22:25 local, 2026-10-28 UTC). Run by agent-a138 (Claude Sonnet worker) for the coordinator, on the final uncommitted wave-2 tree, pinned Node v22.23.3, serial slot held throughout, display kept awake with caffeinate, screen unlocked for every native step, no source or test code changed by this task, nothing committed.

**Status: CLAIMED.** Everything below is an automated or viewed check. Nothing is VERIFIED; only the owner's real use in the new app does that (see the hand-check sheet).

Logs and artifacts: `node_modules/.cache/personal-word-beta/ui2-final/` (called `LOGS/` below).

## Results, plan Validation steps 1-9

| Step | Command | Expected | Actual | Log |
|---|---|---|---|---|
| 1 | `node --version`; `npx tsc --noEmit -p .` | v22.23.3; exit 0 | v22.23.3; no errors, exit 0 | `LOGS/step1-tsc.log` |
| 2 | `npm test -- --no-file-parallelism --maxWorkers=1` | all pass (~973) | 56 files, **973 passed**, 0 failed, exit 0 | `LOGS/step2-vitest.log` |
| 3 | `npm run build` | exit 0 | built in 14.35 s, exit 0 (chunk-size warning only) | `LOGS/step3-build.log` |
| 4 | Playwright, whole `tests/` folder, production preview of a private build (`LOGS/dist`, built with `vite build --outDir`), 1 worker, no retries, port 1590, `PW_DIST_DIR` set | all pass | **214 passed, 1 failed** in 7.4 min: `tests/writing.spec.ts:2` (see below). Every other spec passed first time, including all load-sensitive ones (notice, performance, split-view, research:176): no flake reruns were needed | `LOGS/step4-playwright.log`, `LOGS/browser.config.mjs` |
| 4b | rerun `tests/writing.spec.ts` alone (same dist) | - | same failure again (2 passed, 1 failed): deterministic, not a flake | `LOGS/step4-rerun-writing.log` |
| 4c | rerun `tests/writing.spec.ts` alone after the T130 test fix (same dist, no rebuild; the fix is test-only) | pass | **3 passed, 0 failed** | `LOGS/step4-rerun-writing-after-T130.log` |
| 5 | `cargo test --locked --offline --manifest-path src-tauri/Cargo.toml --jobs 1 -- --test-threads=1` | 57 passed, 1 ignored | **57 passed, 0 failed, 1 ignored**, exit 0 | `LOGS/step5-cargo.log` |
| 6a | smoke rebuild `npm run tauri build -- --debug --features native-smoke --no-bundle --config '{"identifier":"com.folio.smoke"}'` | exit 0 | built `src-tauri/target/debug/folio`, sha256 `981adc1041dff6e5e28e198a0409162c2151d53c4abb8528b5782af87373335f`, exit 0 | `LOGS/step6-smoke-build.log` |
| 6b | `python3 scripts/native-reliability.py --suite baseline` | exit 0, 13 + 5 | run `20261028T021548Z-d0fd79ec`: passed; **13 scenarios passed + 5 controls detected**, exit 0 | `LOGS/step6-baseline.log` |
| 6c | `python3 scripts/native-reliability.py --suite beta` | exit 0, 19 + 42 | run `20261028T021648Z-e07b5098`: passed; **19 scenarios passed + 42 controls detected**, exit 0 | `LOGS/step6-beta.log` |
| 6d | `python3 scripts/native-smoke.py` | 3 phases pass | phases 1, 2, 3 all `ok: true`; "Native WebView + SQLite smoke test passed.", exit 0. The earlier-noted "Acknowledged checkpoint, found Journaled recovery" message did NOT appear in this run | `LOGS/step6-smoke.log` |
| 7 | `native-screens.py --out LOGS/native-plain` and `--out LOGS/native-color --palette color` | 10 + 10 PNGs | **10 + 10 PNGs**, exit 0, all 20 viewed; pdfProbe `application/pdf` (embed 622x538) in all four runs (light and dark, both palettes) | `LOGS/step7-plain.log`, `LOGS/step7-color.log` |
| 8 | browser export of a bibliography fixture, type order, scope all, to DOCX, PDF, Markdown | same heading/entry order | identical order in all three (below), PDF page viewed | `LOGS/step8-playwright.log`, `LOGS/s8/` |
| 9 | `npm run tauri build` (normal app) + marker scan | app built; zero smoke markers | built, identifier `com.folio.writing`, zero markers (below) | `LOGS/step9-app-build.log`, `LOGS/step9-scan.log` |

### Step 4 failure and its repair

- Failure: `tests/writing.spec.ts:2` "writer journey" at line 33. `getByRole('button', { name: /The first paragraph belongs here./ })` matched two sidebar buttons (strict-mode violation): the fragment row's `entry-main` button and the new wave-2 `open-beside` button (aria-label "Open <title> beside", `src/components/ProjectSidebar.tsx`). A stale test, not a product fault: the button was added by split view and the spec was not updated.
- Not on the known load-sensitive list; reproduced on a lone rerun (4b), so deterministic.
- Filed as board task T130 (not fixed inside T127, per plan). The coordinator then anchored the locator in `tests/writing.spec.ts` (`/^The first paragraph belongs here\./`); this agent did not edit the spec. Rerun 4c passed (3 of 3) against the same private dist. The whole `tests/` folder was not rerun after the fix; only this spec was (as the coordinator asked).
- Net: first full run 214 passed + 1 failed; after the T130 fix the failed spec passes, so all 215 tests have passed (the 214 in one run, the 215th in the rerun).

### Step 8 details (exported artifacts)

Fixture built through the browser UI (Playwright `LOGS/s8/step8.spec.mjs`, config `LOGS/s8/s8.config.mjs`, production preview port 1590): project "Bibliography fixture", one cited book (Yu) and three uncited sources (Adams book, Brook and Cole journal articles); Bibliography page set to "By source type" and "Include uncited sources" on; then Settings > Export DOCX, PDF, Markdown. Files in `LOGS/s8/`: `type-all.docx`, `type-all.pdf`, `type-all.md`, `page-lines.txt` (the page's own order).

Order in the page, the Markdown, `pdftotext` of the PDF and the text of `word/document.xml` in the DOCX, all identical:

- Books: Adams, Zed. Zebra Studies. 2018. then Yu, Charles. Interior Chinatown. 2020.
- Journal articles: Brook, Ana. "Atlas of Tides." (2019). then Cole, Mia. "Harbor Light." (2017).

`p-2.png` (pdftoppm page 2, viewed): "Bibliography" heading, bold "Books" and "Journal articles" subheadings, entries in that order, italic book titles, page number 2. Fixture note: the two journal entries show a doubled space before the year because the fixture has no journal title; this is the fixture, not an ordering issue (unrelated to this check).

### Step 9: normal app

- Path: `/Users/ethansiegel/Local Projects/VC Projects/Project 13 - Word Processor/src-tauri/target/release/bundle/macos/Personal Word.app` (15.55 MiB). This REPLACES the accidental mid-wave build (binary sha256 ebffe3f3..., 06:22Z).
- `Info.plist`: `CFBundleIdentifier` = `com.folio.writing`, version 0.1.1.
- sha256 of `Contents/MacOS/folio` (16,252,296 bytes): `13e98e8c9c69455b2658030b7f76b7e6b5118a46dfaeeeade15f3de7c01f49fb`.
- Marker scan (`grep -c -a`):

| Marker | Normal app | Smoke debug binary (proves the scan works) |
|---|---|---|
| `smoke_snapshot` | 0 | 10 |
| `native-screens` | 0 | 2 |
| `com.folio.smoke` | 0 | 8 |
| `FOLIO_SMOKE` | 0 | 12 |
| `read_dropped_file` (allowed) | 2 | 5 |

## Step 7: the 20 native PNGs (each viewed)

All 1240x840, from the `com.folio.smoke` build, fixture project "Screens fixture". Folders `LOGS/native-plain/` and `LOGS/native-color/`. Known tool limit: menus, the create panel, search and drop highlight are not captured, so no native menu motion is shown.

Plain:
1. `native-plain/projects-light.png` -- empty Projects screen, white; "Personal Word" title; blue "Start new project" button with chevron; search, Sort "Last edited", direction and view icons right; "No projects yet." and "Your writing stays on this Mac."
2. `native-plain/projects-dark.png` -- same layout on dark; light-blue primary button with white text (the known low-contrast item).
3. `native-plain/writing-light.png` -- sidebar starts with the project title "Screens fixture" and a "Find in project" row; Manuscript bold, selected "Opening" row grey fill with semibold black text (no blue); Fragments, Research, Bibliography rows; bottom rows Read manuscript / Comments / Snapshots & history / Settings with divider lines; one-row toolbar with labelled-free icons; two paragraphs; "Saved"; 16 words.
4. `native-plain/writing-dark.png` -- same on dark; selected row white semibold on dark fill; a slightly different band under the last ~28 px of the window, outside the page area (seen before).
5. `native-plain/research-light.png` -- Research panel at right (Sources/Notes tabs, lookup field, a "A synthetic source" form with Attach PDF... button and Source type menu); the sidebar lists Bibliography and the source under Research; Research label bold, no blue; toolbar collapsed to Undo/Redo/zoom/style/font/More; "Saved".
6. `native-plain/research-dark.png` -- same on dark; links light blue, readable.
7. `native-plain/settings-light.png` -- Project settings: General (Restore tabs, Appearance System/Light/Dark with Light selected, Palette Plain/Color with Plain selected, "Reveal sidebar on hover" checked, Storage location), new Sidebar block with three "Show ..." switches checked, Goals; Settings bottom row is a tight chip with bold label; no Section colours row in Plain.
8. `native-plain/settings-dark.png` -- same on dark with Dark selected; checkboxes blue.
9. `native-plain/pdf-preview-light.png` -- Settings > Export preview: the PDF is drawn in the window (grey frame, white page with title, "Opening" and both paragraphs), followed by "Templates". The pdfProbe line reported `application/pdf`, 622x538.
10. `native-plain/pdf-preview-dark.png` -- same page drawn in the window on the dark theme (white page on grey frame).

Color (`--palette color`):
11. `native-color/projects-light.png` -- same empty Projects layout, brighter blue button.
12. `native-color/projects-dark.png` -- saturated blue button with white text (better contrast than Plain dark).
13. `native-color/writing-light.png` -- Manuscript and Opening in section blue, Fragments icon green, Research icon brown/orange; green "Saved" check.
14. `native-color/writing-dark.png` -- brighter blue, green and orange icons and labels on dark; green "Saved".
15. `native-color/research-light.png` -- Research label and icon dark orange and bold, panel as in Plain; header shows "Saving..." (captured mid-save, a timing artifact).
16. `native-color/research-dark.png` -- Research orange bold, Manuscript icon blue, "Saved" green.
17. `native-color/settings-light.png` -- Palette shows Color selected; extra "Section colours" row with three pickers (Blue, Green, Orange); Settings chip tinted blue; coloured sidebar icons.
18. `native-color/settings-dark.png` -- same on dark; Palette Color and Dark selected in blue; pickers readable.
19. `native-color/pdf-preview-light.png` -- the PDF drawn in the window as in Plain; Settings chip tinted blue; coloured sidebar icons; green "Saved".
20. `native-color/pdf-preview-dark.png` -- same on dark.

Not shown by any PNG: a source PDF drawn in the right split pane, a menu open, the hover-reveal sidebar.

## Incidents during the wave (for the record)

- An agent's board message shell-expanded backticks and ran a normal `npm run tauri build` (06:22Z) from a half-finished tree; Personal Word.app was overwritten with an accidental mid-wave build (sha ebffe3f3...). Replaced by the step 9 build above.
- T102: an agent edited files after handing the task off; reconciled; attribution is in the T102 note.
- T128: a native-reliability failure ("attachments mirror missing") was a harness skip (Insert overflowed into the closed More menu); fixed in `tests/native-reliability.js`; Rust exonerated; baseline 13+5 and beta 19+42 pass (again here).
- T129 / Q009: native smoke hung while the Mac screen was locked (locked window throttles WebKit requestAnimationFrame); approved as environmental. Here smoke passed all three phases on an unlocked screen.
- T127 (this run): `tests/writing.spec.ts:2` failed on the final tree (stale locator vs the new open-beside button); filed as T130, fixed test-side by the coordinator, rerun passed (above).

## Not established

- A source PDF drawn in the right split pane natively (inferred from the export-preview path, which does draw natively; no native screenshot shows it).
- Native menu motion (Popover open, close, reverse, highlight) and Mac Reduce Motion: no native run opens a menu.
- Toolbar label-mode decision (hand-check d): pending the owner; one constant, `LABEL_MIN_WIDTH` in `src/Writer.tsx`.
- Native persistence of a non-default section colour after relaunch (Chromium-only tested).
- Insert image from the More menu natively (file dialog, then image inserted).
- Native title bar behaviour, the Finder drag path, and sidebar drag-reorder by hand.
- The whole `tests/` folder after the T130 fix (only `writing.spec.ts` was rerun).
- Browser checks prove nothing about native WebKit rendering or native storage.

## Open owner decisions (from board reviews; none decided)

1. Toolbar label mode (U6, open question 3): at a 1440 px window the format bar is in label mode and keeps only Undo/Redo, zoom, paragraph style, font, More, Comment and Keep as fragment; Bold, Italic, lists, link, insert, spacing and Page view move into More. Icons-only mode (bar below 1100 px) keeps nearly everything. Measured cliff: bar 1099 = 9 of 13 groups visible; bar 1100 = 3 of 13. Options: raise the threshold (~1600-1900 px bar) or shorten labels.
2. Default native 1240 px window: Insert image, Page view and other groups sit under More.
3. U3: at a 1280 px window Insert image / Insert table / Table controls sit under More (inline from ~1287 px) because of the 8 px header gap.
4. U3: "Start new project" measures 39 px and the top-bar Snapshot button 34 px, not 32.
5. U8: sidebar title rename cancels on blur (Finder saves on blur); after Enter, focus drops to the page body.
6. U9: Settings bottom-row highlight is a tight chip around the label, not a full-row fill.
7. U14: whole-version restore CLOSES the split (plan step 2) although steps 5 and 6 suggest both panes stay; kept closing (safe).
8. U13: opening or closing a split resets the left pane's undo history and scroll position (no text loss); the footer page number may lag one update after switching panes.
9. U16: research notes are no longer listed in the sidebar (Research panel Notes tab only).

## OWNER HAND-CHECK sheet (Personal Word.app, build above)

Run these in the new app (path above), then write the result. Agents may not fill these in.

a. Open and close a toolbar dropdown, Sort, the More menu and the create menu quickly and repeatedly: motion feels continuous, a reopened menu reverses without a jump. Result: ____
b. System Settings > Accessibility > Display > Reduce motion on: menus appear and vanish instantly. Result: ____
c. The create menu grows out of the button and the header does not move. Result: ____
d. Widen the window until the toolbar shows labels: is the result better or worse than icons only? (answers open question 3 and decision 1 above). Result: ____
e. The sidebar starts with the project title; Settings > General "Reveal sidebar on hover" works and survives quit and reopen. Result: ____
f. Settings > Sidebar switches hide Read manuscript, Comments, Snapshots & history per project; the bottom rows have no hover icons. Result: ____
g. Selected rows: no blue in Plain, tints in Color; the Section colours pickers recolour the sidebar in Color only. Result: ____
h. Story and Essay are gone from the create menu; an old Story project opens. Result: ____
i. An empty text-only footnote plus Backspace removes it. Result: ____
j. Cmd+click a section opens it beside; the open-beside button works; drag the divider; type in both panes; quit and reopen: the split, the ratio and both texts are back. Result: ____
k. The Bibliography page orders, and the Word/PDF export match it. Result: ____
l. Attach a real PDF to a source and open it beside: it is drawn in the pane (no native screenshot shows this). Result: ____
m. Anything that looks wrong: ____

Additions from the wave's reviews:

n. Pick a non-default section colour (for example Purple) in the native app; confirm it persists after relaunch. Result: ____
o. Native menu behaviour: Popover open, close, reverse and highlight; no native run has opened a menu. Result: ____
p. Insert image from the More menu: the file dialog opens, then the image is inserted. Result: ____
q. Native smoke on an unlocked screen was run by this task and passed (3 phases); owner may re-run `python3 scripts/native-smoke.py` and note whether the message "expected Acknowledged SQLite checkpoint, found Journaled recovery after deliberate kill" ever appears (it did not here). Result: ____
r. Escape closes the create menu natively (Escape is now handled on the create wrapper). Result: ____
s. Open decisions 1-9 above: which to fix, accept or defer. Result: ____

## Later-fix items noticed (recorded for U20 and the later-fixes plan)

- DATA SAFETY (pre-existing, single pane too): passage restore writes content, then awaits the SaveQueue before remounting editors; typing into the restored entry during that wait overwrites the restore.
- The More menu stays open after clicking one of its rows (U4/U6); causes a split-view menus test flake (~2/20).
- Plain palette: brief accent-blue flash while pressing an unselected sidebar row (pre-existing); in Color, `:active` on a selected group title uses accent, not its tint.
- `slideHighlight(null)` mid-slide snaps the box before fading (minor).
- Load-sensitive tests: `src/adversarial-wp3-exports.test.ts` (2-6 s vs a 5 s timeout), `tests/notice.spec.ts` toast-cover, `tests/performance.spec.ts`, `tests/research.spec.ts:176`. None failed in this run.
- `docs/design-system.md:42` says the search slot is 28x28; it is 32 (`var(--control-height)`).
- Removing a PDF (or deleting its source) while it is open beside leaves the split showing the "not stored" alert instead of closing (`prune()` in `src/split.ts`).
- PDF size label goes only up to KB (25 MB shows "25600.0 KB"), `src/research/ResearchPanel.tsx` `.source-pdf-size`.
- `tests/research-pdf.spec.ts:33` starts its network check after first load, so first-load requests are unchecked.

## Evidence status

CLAIMED for every item. Owner confirmation of the sheet above is what would move any of it to VERIFIED.
