# REVIEW -- UI wave 9 (Validation step 6, whole wave)
Reviewer: Claude Opus, board agent-c80a ("Claude Opus independent reviewer W9 V6") | Range: HEAD 834f534 .. working tree (uncommitted) | Date: 2026-11-11

Status of everything in this file: CLAIMED, not VERIFIED. Nothing here was checked in the Mac app or by the owner.

## Verdict: CHANGES REQUIRED -- ready for the owner's native checks: NO, then YES after these fixes

The wave is ready once these are done and rerun on the built app:
- Part A work orders A1, A2, A3, A4 and A6. All five are test or fixture fixes. A1 needs the owner's or coordinator's say-so, because the plan says "do not regenerate the baseline unasked".
- Then a preview rerun of the four affected spec files, with `--repeat-each` for the timing races (counts and commands are in each work order).

No failure from the full run is an app bug introduced by wave 9:
- Three failures are stale or dev-only tests (#1, #2, #3).
- Two are test timing races (#4, #6). #6 is first recorded in wave 9.
- One (#5) is an old app/test race that wave 9 did not touch. It falls under the plan's Non-goals, so the owner decides when to fix it.

Part B found no blocker in the app. It found one should-fix in the app (B-S1, fonts at start-up), which does not stop the native checks.

## Summary
- The six e2e failures are triaged in Part A. Each one names its cause, whether the app or the test is wrong, the task that introduced it, and a work order.
- One targeted rerun was done (A1, below). Everything else was settled by reading the spec and the code.
- Whole-diff review: every Request item is delivered or delivered as the plan scoped it (checklist below). The cross-task seams were read and are consistent: fonts registry to Writer, PDF, Word and fontSource; ResearchPanel props to App; scrollToSettingsSection to ExportMenu; lib.rs command registration in both builds.
- AGENTS.md rules are kept: `folio.*` keys, one hover rule plus the icon grow, motion limits, and Reduce Motion.
- Leftovers are small (notes N1-N3). One suspected bug (blank click on the scrollbar) was checked and cleared (N13).

## Part A -- the six failures from the full built-app run

Every proof command below runs as described in the task brief, and the A5 proof also needs `npm run build` first:
- In the project folder, put the pinned Node first: `export PATH="$PWD/node_modules/.cache/personal-word-alpha-review/tools/node-v22.23.3-darwin-x64/bin:$PATH"`.
- Take the serial lock: `until mkdir node_modules/.cache/personal-word-beta/serial-check.lock 2>/dev/null; do sleep 20; done`, and write the owner into `owner.txt` in it.
- Run the command as ONE background job, with its output going to a log file that ends with an `EXIT <code>` line.
- Release the lock afterwards, even on failure: remove `owner.txt`, then `rmdir` the lock.
- Preview mode serves the existing `dist/`. After any app (src/) change, the runner must run `npm run build` again first; workers do not.

| # | Failure | Actual cause | App or test | Task | Work order |
|---|---|---|---|---|---|
| 1 | popover-bounds.spec.ts:174, "Prose check height changed", 86 (0/3) | The Prose check popover got **shorter**, as B2 intended, and did not grow. B2 replaced the old status line, which wrapped over several lines, with one line ("0 issues"), and dropped the pagination row when there is one page (`src/components/ProseIssues.tsx:46-58`). Old baseline height 232; new height 146. **Rerun proof:** the same test with a scratch copy of the fixture where only Prose check height is 146 PASSED, including Page setup, which sits after Prose check and was never reached in the failing runs. The test was run as `RECTS_BASELINE=<scratch>/rects-146.json PLAYWRIGHT_PREVIEW=1 PLAYWRIGHT_PORT=1420 npx playwright test tests/popover-bounds.spec.ts -g "toolbar popovers" --output test-results/V6`. Log: node_modules/.cache/personal-word-beta/w9-v/V6-rerun-popover-174.log. Result: 1 passed, EXIT 0. | TEST (stale baseline). Not a layout regression. | B2 / T259 (its acceptance never ran popover-bounds; C1's earlier pass predates B2 entirely) | **A1** (needs the owner's or coordinator's OK). In `tests/fixtures/popover-baseline-rects.json`, change only `"Prose check".height` from `232` to `146`; change nothing else. Prove it: `PLAYWRIGHT_PREVIEW=1 PLAYWRIGHT_PORT=1420 npx playwright test tests/popover-bounds.spec.ts -g "toolbar popovers" --trace off --output test-results/A1` gives 1 passed. |
| 2 | w9-research-panel.spec.ts:15, `.footnote-where` count 1, expected 0 (0/3) | C1 wrote the spec while ResearchPanel had no `footnoteLocations` yet. Lines 90-93 say "no location without the props". G1 then passed the props from `src/App.tsx:2975-2976`, so the Used-in row now correctly shows "in <section>" plus Go to (`src/research/ResearchPanel.tsx:193-198`). Line 93 (Go to count 0) would fail next, for the same reason. | TEST (stale expectation). The app is right: the plan's DoD says "Each 'Used in' footnote row names its section and has a Go to control". | Spec from C1 / T264; made stale by G1 / T272 (G1's acceptance list did not include this spec) | **A2.** In `tests/w9-research-panel.spec.ts`, replace the comment at line 90 with `// Used in: count line, the footnote's section, and Go to (G1 supplies the locations).` Change line 92 to `await expect(panel.locator(".footnote-where")).toHaveCount(1);` and add after it `await expect(panel.locator(".footnote-where")).toContainText(/^in \S/);`. Change line 93's `toHaveCount(0)` to `toHaveCount(1)`. Prove it: `PLAYWRIGHT_PREVIEW=1 PLAYWRIGHT_PORT=1420 npx playwright test tests/w9-research-panel.spec.ts --trace off --output test-results/A2` gives 1 passed. |
| 3 | w9-settings-nav.spec.ts:100, failed to fetch `/src/settings/SettingsNav.tsx` (0/3) | The test calls `import("/src/settings/SettingsNav.tsx")` inside the page (line 106). Only the Vite dev server serves `/src/...`; the production preview does not. The behaviour it wants is real and has a production caller: the Export menu's "Export settings..." row calls `goToDestination("settings")` and then `scrollToSettingsSection("Export document")` in the same tick (`src/App.tsx:2446-2449`). "Export document" (`src/export/ExportPanel.tsx:54`) is the **last** Settings section (`App.tsx:2526-2551`). Whether its heading can scroll up to the strip at 1100x520 depends on the panel being taller than the visible area, which is likely (the panel has many fields) but unchecked. | TEST (dev-only design) | S1 / T275 | **A3.** In `tests/w9-settings-nav.spec.ts`, rewrite the test at line 100 so it drives the real same-tick caller, not a module import. Keep the title "scrollToSettingsSection works in the same tick that opens Settings". Body: `createProject(page, "Settings strip tick")`; `expect(.project-settings).toHaveCount(0)`; click `page.locator(".topbar").getByRole("button", { name: "Export", exact: true })`; click `page.getByRole("menu", { name: "Export" }).getByRole("menuitem", { name: "Export settings..." })`; then keep the existing `h2` locator and `expect.poll` (lines 115-125), changing `hasText: "Goals"` on line 115 to `hasText: "Export document"`. Delete lines 105-114 (the `page.evaluate` with the dynamic import and `expect(result)`). The proof must run in **preview**, because dev cannot fail this way: `PLAYWRIGHT_PREVIEW=1 PLAYWRIGHT_PORT=1420 npx playwright test tests/w9-settings-nav.spec.ts --trace off --output test-results/A3` gives all passed. Also run once without `PLAYWRIGHT_PREVIEW` on a free port. **Stop and report** if the poll fails while the settings container is at its maximum scroll (`scrollTop + clientHeight >= scrollHeight - 1`); do not loosen the 60 px threshold. |
| 4 | w9-export-menu.spec.ts:55: one run timed out waiting for the download, one got `Keyboard export.docx` (1/3) | A timing race in the test. The app maps rows correctly: the pointer test "Plain text" passes and `FORMATS` in `src/export/ExportMenu.tsx:12-18` is in the right order. What happens:<br>- After Escape (line 68), focus is on the Export button.<br>- Line 72 presses Cmd+Shift+E again; the menu opens, but the first row gets focus only in a `requestAnimationFrame` (`ExportMenu.tsx:46-50`).<br>- Lines 73-76 press ArrowDown 4 times at once. Focus is still on the button, so the keys never reach the menu's `onKeyDown`: the Popover is a sibling of the button, not its parent (`Popover.tsx:332`).<br>- Then the rAF focuses "Word". Enter gives `.docx`.<br>- If Enter also lands before the rAF, it activates the focused Export button, `onOpenChange(!open)` closes the menu, and no download comes (the 90 s timeout).<br>Both symptoms fit, and nothing else handles those keys. The worker's late removal was an **outline-offset** assertion (`:focus-visible` offset -2px), not a navigation check. The global `button:focus-visible` ring still applies (`src/styles.css:396`). | TEST (race). The app has a one-frame gap: keys typed within ~16 ms of Cmd+Shift+E are lost. A person is unlikely to type that fast, even on a busy main thread, so this is very unlikely to be a user-visible bug (note N4). | E1 / T271 | **A4.** In `tests/w9-export-menu.spec.ts`, after line 72 (`await page.keyboard.press("Meta+Shift+e");`), insert `await expect(menu(page).getByRole("menuitem").first()).toBeFocused();`. After line 76 (the 4th ArrowDown), insert `await expect(menu(page).getByRole("menuitem", { name: "Plain text" })).toBeFocused();`. Prove it: `PLAYWRIGHT_PREVIEW=1 PLAYWRIGHT_PORT=1420 npx playwright test tests/w9-export-menu.spec.ts --repeat-each=5 --trace off --output test-results/A4` gives 30 passed. |
| 5 | sidebar-context-menu.spec.ts:319, opacity "0" (2/3) | No wave 9 change touches this menu: `src/components/ContextMenu.tsx` and `context-menu.css` are unchanged since 08e9f85 (wave 5), and A1, M1, A2 and A3 do not reach it. How the race happens:<br>- A pointer open sets `data-animate`, and `data-shown` arrives one frame later (`ContextMenu.tsx:73-77`).<br>- `context-menu.css:23-26` hides the menu (opacity 0) until `data-shown`, even under Reduce Motion (the media query only drops the transition).<br>- Playwright's `toBeVisible` counts opacity 0 as visible, so the test can read that first frame.<br>HANDOFF already records this test failing on CI before wave 9 (run 42178406840). | APP, minor: under Reduce Motion, a pointer-opened menu is invisible for one frame. The test exposes it. Pre-existing. | none (wave 5) | **A5, for the owner.** Plan Non-goal: "Fixing the intermittent CI failures recorded in HANDOFF.md (owner: after this wave)". If the owner wants it now: at `src/components/ContextMenu.tsx:145`, change `data-animate={viaKeyboard ? undefined : ""}` to `data-animate={viaKeyboard \|\| window.matchMedia("(prefers-reduced-motion: reduce)").matches ? undefined : ""}`. That is an app change, so the runner must run `npm run build` again before the preview proof: `PLAYWRIGHT_PREVIEW=1 PLAYWRIGHT_PORT=1420 npx playwright test tests/sidebar-context-menu.spec.ts --repeat-each=10 --trace off --output test-results/A5` gives all passed. |
| 6 | popover-bounds.spec.ts:57, menu not within the aside (2/3) | Two candidate test-side races; the failing run's rectangles were not logged, so neither is proven.<br>(a) **M1 / T273 slide-in.** The test opens Research with a pointer click (line 62), so M1 slides the aside in from `translateX(16px)` over 180 ms (`src/research/asideMotion.ts:14-24`). Line 65 reads `asideBox` straight after `toBeVisible`, which passes at opacity 0, so the box can be up to 16 px right of its resting place. The aside has 16 px padding (`styles.css:2084`), so this trips `within` only if a menu is placed nearer the aside's left edge than its padding, for example by the Popover's clamp.<br>(b) C1's worker saw the menu rect read as {0,0,0,0}, before the Popover placed it (notes/C1.md:34).<br>"Known intermittent since before wave 9" is **not supported**: baseline-dev.txt shows it passing (line 284), and no older wave doc records it. It is **first recorded in wave 9** (C1 worker, then T277). That wave 9 made it worse is likely but not proven. The A6 waits cover both candidates. | TEST (race) | First seen with C1 / T264; (a) would trace to M1 / T273 | **A6.** In `tests/popover-bounds.spec.ts`, after each `await expect(aside).toBeVisible();` (lines 64, 109, 139), insert `await page.waitForFunction(() => document.getAnimations().length === 0);` (the same wait `tests/w9-research-motion.spec.ts:22` uses). Then replace each `expect(within(asideBox, await menuRect(page))).toBe(true);` (lines 78 and 90) with `await expect.poll(async () => within(asideBox, await menuRect(page))).toBe(true);`. At line 148, insert that same poll line **before** `const menu = await menuRect(page);` (after line 147's `toBeVisible`), so `menu` is read only after placement. Leave lines 148-149 as they are. Prove it: `PLAYWRIGHT_PREVIEW=1 PLAYWRIGHT_PORT=1420 npx playwright test tests/popover-bounds.spec.ts --repeat-each=5 --trace off --output test-results/A6` gives all passed (after A1). |

## Part B -- whole-diff findings

### Blockers
None in the app. The Part A items A1-A4 and A6 are the blockers for "ready", because the DoD requires `npm run test:e2e` (built app) to pass.

### Should-fix
| # | Where | Finding | Work order |
|---|---|---|---|
| B-S1 | `src/fonts/registry.ts:70-84`, with `src/fonts/system.ts:12-17` | `initFonts` sets `--ui-font` only after two awaits (`listUserFonts`, `listSystemFamilies`), so every launch draws the interface in Futura first and then switches: a visible flash for anyone who picked another interface font. Worse, `listSystemFamilies` turns any IPC error into `[]`. In that case a saved **installed** family fails the check and `localStorage` is overwritten with Futura (line 79), so one failed native call permanently loses the user's choice. Implementation defect (C3 / T266, C6 / T269 seam). | At the top of `initFonts`, set `document.documentElement.style.setProperty("--ui-font", saved)` before any await. Do not change `system.ts`: `src/fonts/system.test.ts:24,31` pins its "errors give `[]`" behaviour. Instead, in `registry.ts`, reset only when the installed list actually loaded: change the condition on line 79 to `if (selected !== saved && installed.length > 0)`, and use `installed.length > 0 ? selected : saved` for `--ui-font` on line 80. Prove it with a unit test in `src/fonts/registry.test.ts`. Mock `./system` so `listSystemFamilies` resolves `[]`. Set `localStorage["folio.workspace.interfaceFont"] = '"Menlo", sans-serif'`, then `await initFonts()`. Expect the key unchanged and `--ui-font` equal to it. Run `npx vitest run src/fonts`. Show that the test fails before the change. |

### Notes (low; fix when convenient or leave)
| # | Where | Note |
|---|---|---|
| N1 | `src/editor/blankClick.ts:1-2` | Stale header "Stub until wave 9 task B5 fills it." left from T0. Replace with "A click on blank page area places the caret (wave 9 B5)." No other T0 stub header remains (grep of the new modules). |
| N2 | `tests/w9-blank-click.spec.ts:14`, `:124` | Diagnostic `console.log` lines added by B5. Harmless, but they add noise to every run. Remove both, or keep them with a comment saying why. (The `console.log` lines in hover-emphasis.spec.ts and split-view.spec.ts are older and deliberate.) |
| N3 | `src/export/ExportMenu.tsx:101`, `:94` | The `title="Export (⇧⌘E)"` is hard-coded, but the shortcut is rebindable (`src/shortcuts/registry.ts:35`): after a rebind, the tooltip lies. Pass the hint from App (`hintFor("exportDocument", shortcuts)`) as a prop. Line 94 keeps an inline `style` that the E1 review asked to move into `export-menu.css` (`.export-menu-anchor { position: relative; display: inline-flex; }`). |
| N4 | `src/export/ExportMenu.tsx:46-50` | First-row focus waits one animation frame, so keys pressed within that frame are lost (Part A #4). Not a user-visible problem. If wanted: use `useLayoutEffect` and focus with `{ preventScroll: true }`. |
| N5 | `src/styles.css:1958-1966` | `.manuscript-read h1`, `.read-title` and `.preview-content h3` now follow the interface font. Before, they shared the document's Futura stack with `.writing-surface` and `.read-prose`. So with Georgia as the interface font, Read-mode section titles turn Georgia while Read prose does not. Owner's call: interface ("everything besides the logo") or document typography. |
| N6 | PLAN.md "Definition of done" vs B6 step 2 | The DoD says "or a bare PMID fills in the source"; the plan's B6 step 2 and `docs/limitations.md` say a bare number is **not** a PMID (only `PMID 123` / `PMID: 123`). The implementation follows the step. This is a plan wording defect, not an implementation defect; the owner should know a bare number does nothing. |
| N7 | `src/export/docx.ts:42-80` | Word embeds one file per family (the regular one): an added family's bold and italic files are not embedded in Word, so Word synthesises them. This is exactly C7 step 3 and is in limitations.md. PDF embeds per style. |
| N8 | `src-tauri/src/fonts.rs:179`, `sysfonts.rs` | Font bytes cross IPC as a JSON number array (`Vec<u8>`, then `Uint8Array.from(file.data)` in `src/fonts/system.ts:30`). A 20-30 MB font becomes a very large JSON payload: slow on export or start-up with big added fonts. Not wrong; worth knowing for the hand check ("add a large font"). |
| N9 | `src/components/library.css` (P1 empty-state actions) | Hover and focus on the empty-state buttons change only colour (muted to text), on top of the shared stroke rule. The same colour-only pattern exists elsewhere (settings strip), so this is not a second weight or scale rule. |
| N10 | `.claude/worktrees/vibrant-mclean-7a4d55/` | An old worktree (dated Oct 16) with Rust incremental `.lock` files. It is ignored by `.gitignore` (`.claude/`) and predates wave 9: not a wave 9 leftover. The owner may delete it. |
| N11 | not wave 9 | T251's files are in the tree: `src/editor/extensions.ts` (modified), `tests/t251-marker-image.spec.ts`, `docs/agent-work/2026-11-11-t251-marker-image/`. Board task T251 was approved separately; per its NOTE, its own open problem (marker node-selected then Insert image) remains. Commit it with or apart from wave 9, as the owner prefers. |
| N12 | `goToFootnote`, `src/App.tsx:1018-1030` | The case "split open, target section in neither pane" goes through `pendingFootnote` and `editorReady` (`App.tsx:276`, `:1977`). It looks right, but no spec covers it (w9-used-in.spec.ts covers single pane, split with the target shown, keyboard, and the source row). Add it to the owner's G1 hand check. |
| N13 | `src/editor/blankClick.ts`, `Writer.tsx:2080` | Checked and cleared: a press on the editor's scrollbar does not reach the blank-click handler, because `.editor-viewport` is not the scroller (`.is-paged` uses `overflow: clip`, `.is-continuous` is `overflow: visible`; `.writer-scroll`, an ancestor, scrolls; `src/editor/editor.css:419-421, 553-559`). |

### AGENTS.md rules and plan rules checked
- **`folio.*` keys:** none removed (no `-` line with `folio.` in the diff). New keys exactly as the plan names them: `folio.workspace.interfaceFont` (`src/fonts/registry.ts:21`) and `folio.workspace.library` (`src/libraryPreferences.ts`). Added-font browser storage is the IndexedDB `personal-word.fonts`, which is new and does not rename anything.
- **One hover rule:**
  - `--emph-scale: 1` (`src/styles.css:41`); stroke only.
  - The icon grow is confined to `src/components/icon-magnify.css`: `scale(1.25)` on `> svg|span` children only, never the button, with a Reduce Motion block.
  - AGENTS.md was amended by D1 to allow it.
  - The hover crawl in the full run: 0 exceptions, 10 un-hoverable (cap 12), log step4-e2e.log:199-210. No other new scale or weight hover rule was found in the CSS diffs.
- **Motion:** M1 uses `play(... speed "base")`, 180 ms, transform and opacity only, skipped for keyboard opens and Reduce Motion (`asideMotion.ts:13`). The context menu and Popover are untouched.
- **Keyboard access:**
  - Export menu: shortcut, arrows, Home/End, Escape back to the button, Tab closes.
  - Side ruler: arrow and Home/End keys (`Writer.tsx` `adjustMarginWithSideKey`).
  - Settings strip: links are Tab stops; keyboard activation is instant.
  - Icon grow: on `:focus-visible` too.
  - Card boxes: show on `:focus-within`.
- **`.brand` and `.writing-surface` fonts:** kept as Futura (`styles.css:1497`, `:1950-1956`).
- **Side ruler:** hidden while the sidebar floats (`src/editor/side-ruler.css:81`), and in continuous view and focus mode (`Writer.tsx` condition).
- **Dependencies:** Cargo.toml adds only `objc2-core-text` and `objc2-core-foundation` with narrow features. Cargo.lock gains 2 dependency-list lines and no new package (VALIDATION.md step 5). `objc2-core-foundation` is a second direct dependency next to Core Text. The plan approved "Core Text as a direct dependency"; Core Foundation is its required companion and is already locked. Recorded so the owner knows there are two lines, not one.
- **Native commands:** the six new commands are registered in **both** `invoke_handler` lists (native-smoke and normal), `src-tauri/src/lib.rs:259-264` and `:300-305`. `font_read`/`font_remove` reject `../` ids (fonts.rs tests at :250-252). `system_font_file` takes a family name, not a path.
- **Debug leftovers:**
  - No `.only` in any spec.
  - The one `test.skip` (`tests/w9-fonts.spec.ts:74`) is conditional on missing system font files. It did not skip in the full run (16 skipped = the same 16 screenshot cases as baseline-dev.txt).
  - No `dbg!`/`println!` in the new Rust.
  - No `.bak`/`.orig`/`.rej`/`.swp` files and no stray lock in the repo outside node_modules and the ignored old worktree.
  - The serial lock was free at the end of this review.

## Request checklist (owner's items 1-19)
| # | Item | Status | Proof (file) |
|---|---|---|---|
| 1 | Hover blur: drop the grow, keep the faux bold | Delivered (sharpness in WebKit is unverified, as the plan expects) | `src/styles.css:41` (`--emph-scale: 1`); `tests/hover-emphasis.spec.ts` re-pinned to 1 |
| 2 | Research panel decluttered | Delivered | `src/research/ResearchPanel.tsx`, `SourceForm.tsx`, `research.css` (Source / Citation / More details / Used in; Citation rules collapsed); `tests/w9-research-panel.spec.ts` (after A2) |
| 3 | Open beside replaces the pane last used | Delivered | `src/split.ts:95` (`select(split, target.id)`); `src/split.test.ts`; `tests/w9-open-beside.spec.ts` |
| 4 | Card split icon spacing and magnify | Delivered | `src/styles.css` `.cards-view .reorder`, `.collection-open-beside`; `src/components/icon-magnify.css` |
| 5 | Interface font, everything but the logo | Delivered (see N5 for Read titles) | `src/settings/AppearanceSettings.tsx`, `--ui-font` in `styles.css:223`, `src/fonts/registry.ts` |
| 6 | Small upload-font control; added fonts usable in documents | Delivered | `AppearanceSettings.tsx` "Add font...", `src/fonts/store.ts`, `src-tauri/src/fonts.rs`, `Writer.tsx` font options |
| 7 | Click anywhere on the page to write | Delivered | `src/editor/blankClick.ts`, `Writer.tsx:2080`; `tests/w9-blank-click.spec.ts` |
| 8 | PubMed link lookup; online/offline clarity | Delivered as planned (prefixed PMID, PubMed and PMC links; bare number excluded, N6) | `src/research/lookup.ts:53-80, 464-496`; "needs an internet connection" line in ResearchPanel |
| 9 | Side ruler, with the sidebar in mind | Delivered | `src/editor/SideRuler.tsx`, `side-ruler.css:81`; `tests/w9-side-ruler.spec.ts` |
| 10 | Distinct Prose check icon; dropdown spacing | Delivered | `Writer.tsx` `SpellCheck` icon; `src/components/prose-issues.css`, `ProseIssues.tsx` |
| 11 | Card view cut off on the left | Delivered | `styles.css` `.cards-view .entry-row`/`.entry-main` `min-width: 0; max-width: 100%`; depth-1 margin |
| 12 | Sidebar scrollbar covering the UI | Delivered | `styles.css` `.sidebar-groups` `overflow-x: hidden; scrollbar-width: none` + `::-webkit-scrollbar` |
| 13 | Font shows with quotes / duplicate | Delivered | `src/fonts/names.ts` (`primaryFamily`, `sameFont`); `Writer.tsx` dedupe; `tests/w9-font-menu.spec.ts` |
| 14 | Font name compressed | Delivered | `src/editor/editor.css` `.font-family-dropdown { min-width: 124px; max-width: 220px }` |
| 15 | Card view fits Research; card polish | Delivered | `styles.css` `[data-group="research"]` one column, no preview; `tests/w9-cards.spec.ts` |
| 16 | Projects page icons and trash magnify | Delivered | `icon-magnify.css` (`.project-row .delete-entry`, `.icon-grow`); `tests/w9-icon-magnify.spec.ts` |
| 17 | Maximum parallelism | Process item; plan delivered it (T0 seams); not a code item | PLAN.md "Parallelism map" |
| 18a | Collapse empty Synopsis and Notes boxes | Delivered | `styles.css` `.cards-view .entry-row[data-empty]:not([data-open]):not(:focus-within) .entry-details` |
| 18b | Bold and italic files for an added font | Delivered | `src/fonts/types.ts` styles, `registry.ts:56-68` (FontFace per weight/style), AppearanceSettings style list |
| 18c | Fonts embedded in Word export | Partly, as planned: TrueType only, one file per family (N7) | `src/export/docx.ts:42-84`; `docx-fonts.test.ts` |
| 18d | Every installed font listed; built-in fonts such as Georgia and Times embedded in PDF; Core Text direct | Delivered (collection fonts such as Futura fall back, documented) | `src-tauri/src/sysfonts.rs`, `Cargo.toml`, `src/export/pdf.ts` custom keys, `fontSource.ts`, `pdf-fonts.test.ts` |
| 18e | "Used in" locations with Go to | Delivered | `src/derived/footnoteLocations.ts`, `App.tsx` `goToFootnote`; `tests/w9-used-in.spec.ts` |
| 18f | Settings section strip | Delivered | `src/settings/SettingsNav.tsx`, `settings-nav.css` |
| 18g | Export menu in the header with a shortcut | Delivered | `src/export/ExportMenu.tsx`, `exportActions.ts`, `registry.ts:35`, palette "Export..." |
| 18h | Projects page layout and empty state | Delivered | `src/components/ProjectLibrary.tsx`, `library.css`, `src/libraryPreferences.ts`; `tests/w9-projects-page.spec.ts` |
| 18i | Research panel slides in | Delivered | `src/research/asideMotion.ts`, `App.tsx:2042-2043`; `tests/w9-research-motion.spec.ts` |
| 19 | The four defaults (ruler hides when floating; font controls in General; AGENTS.md edits; Core Text) | Delivered | `side-ruler.css:81`; `GeneralSettings.tsx:81`; `AGENTS.md` diff; `Cargo.toml` |
| -- | Excluded: browser pane | Respected: no browser-pane code in the diff | -- |

Definition of done: every line is met in code, except "`npm run test:e2e` (built app) passes" (6 failures, Part A) and the sharp-text-in-the-Mac-app line, which only the owner can check. The non-goals are respected:
- no fonts stored in projects;
- one shared margin;
- `src/print/nativePdf.ts`, the Reading display font menu and the Export typeface menu untouched;
- no unchosen wave 8 ideas;
- the HANDOFF intermittents not "fixed" (A5 left to the owner).

## Plan vs diff
- Claimed done but absent from the diff: none found. Every task's main files are present (VALIDATION.md step 1, plus the file list above).
- In the diff but not in the plan: only T251's files (N11). `src/adversarial-wp2*.test.ts`, `src/split*.ts` and `src/main.tsx` are named in the plan or the notes (VALIDATION.md step 1).
- Re-pins of existing specs read for hidden regressions:
  - `research.spec.ts` (+10), `research-pdf.spec.ts` (+3) and `popover-bounds.spec.ts` (`openRules`) open the new collapsed `details` before acting. That is correct for C1 and loosens nothing else.
  - `hover-emphasis.spec.ts`: the 1.04 checks became 1. The icon-only check now fails on *any* scale, which is stricter than before.
  - `projects-screen.spec.ts` (-42) was not re-read line by line (see limits).

## Re-run validation (commands and results I produced)
- `RECTS_BASELINE=<scratchpad>/rects-146.json PLAYWRIGHT_PREVIEW=1 PLAYWRIGHT_PORT=1420 npx playwright test tests/popover-bounds.spec.ts -g "toolbar popovers" --trace off --output test-results/V6`, against the runner's dist/ build, under the serial lock (taken and released): **1 passed, EXIT 0**. Log: `node_modules/.cache/personal-word-beta/w9-v/V6-rerun-popover-174.log`.
- Read-only commands: `git status --short`, `git diff --stat`, `git diff` of the shared files and seams, greps for leftovers.
- Not rerun by me (taken from VALIDATION.md, CLAIMED): `npm run build` (exit 0), `npm test` (1237 passed), the full e2e (546 / 6 / 16), `cargo test` (70 passed, 1 ignored). Their logs in `node_modules/.cache/personal-word-beta/w9-v/` match what VALIDATION.md says for the parts I read (step4 failure lines and hover crawl counts; rerun logs for #1, #4, #5, #6).

## Evidence level reached, and what the owner must still verify by hand
- **Evidence level:** Chromium browser tests on the production build, unit tests (Node), cargo tests, and code reading. Nothing native, nothing in WebKit.
- **Owner hand checks:** the full list is in VALIDATION.md "Owner hand checks", collected from the task notes. Add two from this review:
  - Pick an installed font as the interface font, quit, relaunch: it must still be selected, with no flash of Futura (B-S1).
  - Split view, Research open, Go to a footnote whose section is in neither pane (N12).

## Not reviewed / limits
- I did not rerun unit tests, cargo or the build, and ran only one browser test (above). No native, WebKit, screen-taking or `tauri build` run, per instructions.
- Not re-read line by line: the ResearchPanel/SourceForm diff (193 + 133 lines), the ProjectLibrary diff (128 lines), `tests/projects-screen.spec.ts` deletions, the Rust bodies of `fonts.rs`/`sysfonts.rs` beyond the command signatures and path checks, `src/fonts/store.ts`, and `src/research/lookup.ts` beyond the identifier parsing. The per-task Opus reviews (agent-26ce, agent-2ff3, agent-e0a3) covered these; I relied on them there.
- I did not check `docs/user-guide.md`, `docs/design-system.md` or `docs/architecture.md` against the code beyond the AGENTS.md and limitations.md diffs.
- I did not prove the A2-A6 work orders by running them (I may not edit tests). Each one names its proof command. A4 and A6 use `--repeat-each` because a single pass does not prove a race is gone.
- T277 is not approved or rejected here, as instructed.

## Addendum after the rerun
Reviewer: Claude Opus, board agent-23c2 ("Claude Opus reviewer W9 r4") | Date: 2026-11-11 | Status: CLAIMED, not VERIFIED.

**Verdict: APPROVED. The wave is ready for the owner's native checks.**

- **Fix tasks approved:**
  - T280 (A2, A3, A4, A6);
  - T281 (B-S1) and its follow-up T283 (a failed added-font list no longer resets the saved font);
  - T282 (A1 baseline re-record and the A5 ContextMenu one-liner; the owner approved both).
- **Rerun on a fresh build:** results are in VALIDATION.md "Rerun after fixes", logs in `node_modules/.cache/personal-word-beta/w9-v2/`.
  - Unit tests: 1242 passed.
  - Cargo: 70 passed, 1 ignored.
  - Built-app e2e: 551 passed, 1 failed, 16 skipped.
  - All six first-run failures now pass.
  - The five fixed spec files at x5: 135 passed, 0 failed.
- **The one failure, `tests/command-palette.spec.ts:147`** ("Enter on a command that does not move focus keeps the caret"). It got "hello worXld" where "hello woXrld" was expected: the caret was one character right, as if one of the three ArrowLeft presses were lost or the restored caret moved.
  - **Class: unknown, most likely a pre-existing timing race. It is not a proven wave 9 regression.**
  - **Measured rate:** 1 failure in 34 runs. That is 1 of 1 inside the full suite, and 0 of 33 alone: the runner's 3 file reruns plus my `-g caret --repeat-each 30` on the built app, which gave 60/60 passed. My log: `node_modules/.cache/personal-word-beta/r4-23c2/T277-cp.log`.
  - **Earlier runs:** it passed in baseline-dev.txt and in the first wave 9 full run.
  - **Why not wave 9:** neither `src/components/CommandPalette.tsx` nor the spec has changed since wave 6. The palette saves the caret as a DOM Range when it opens and restores it on Enter. The only wave 9 code on this path is B5's `blankPageClick`, which runs on mousedown and synchronously, before any typing, on an empty document. T251's keymap handles only End and Home on node selections, and E1 adds only a shortcut and a palette row.
  - **Suggested owner follow-up (not blocking):** add it to HANDOFF's intermittent list. If it recurs, log the editor's selection before and after the palette closes.
- **Still CLAIMED and unverified:** anything native or WebKit. That covers:
  - the hand checks in VALIDATION.md, plus this file's two extra checks: no Futura flash and the interface font kept after a relaunch; Go to in split view;
  - sharp hover text in the Mac app;
  - native font listing and embedding;
  - the Reduce Motion context menu in the Mac app.
