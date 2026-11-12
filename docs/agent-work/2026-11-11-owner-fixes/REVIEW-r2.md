# Owner fixes -- independent review, round 2

Reviewer: agent-3841 (Claude Opus reviewer owner-fixes r2), 2026-11-11.
Scope: T284 (OF1 rework), T286 (OF3 rulers + owner-ordered rework), T288 (OF5 Settings fonts), T291 (OF8 hover blur).

| Task | Verdict |
|---|---|
| T284 OF1 | APPROVE |
| T286 OF3 | REJECT (two fixes) |
| T288 OF5 | REJECT (one CSS clean-up) |
| T291 OF8 | APPROVE. The board refused `review` because the task was created without review and is already done, so the verdict is posted as message #1347 |

## Whole-tree checks (run by the reviewer)
- `npx tsc -b`: exit 0. Log: notes/REVIEW-r2-tsc.log
- `npx vitest run`: 83 files, 1277 tests passed. Log: notes/REVIEW-r2-vitest.log
- Playwright, ONE invocation, port 1462, serial lock, output test-results/OFR2. It ran of3-rulers, ruler, w9-side-ruler,
  popover-bounds, w9-blank-click, split-view, of1-text-notes, of5-settings, w9-fonts and w9-settings-nav:
  **98 passed, 0 failed** (8.7 min). Log: notes/REVIEW-r2-playwright.log
- A reviewer probe ran under the same lock, before the lock was released. It was a plain Playwright-library script against a vite dev server on port 1463,
  not a test run. Output: notes/REVIEW-r2-probe.txt; screenshot test-results/OFR2/r2-probe-floating-scrolled.png.
- All of this was in Chromium. Native WebKit was not checked.

## T284 (OF1) -- APPROVE
- `src/research/ResearchPanel.tsx:361` now reads `{footnotes.map((note) => renderFootnote(note))}`. The only other
  call is the Notes tab, which passes the Delete footnote button on purpose.
- New assertion in tests/of1-text-notes.spec.ts: a cited footnote's action area has exactly the text "Unlink source".
  It failed first with "Unlink source0" (notes/OF1-rework-fail-first.txt) and passes in the reviewer run (of1 4/4).
- Owner hand check: open a source with citations on the Research > Sources tab. No stray numbers appear next to "Unlink source".

## T286 (OF3) -- REJECT
What is right:
- **Two switches in Page setup.** "Ruler" (top) and "Side ruler" are both real buttons with `aria-pressed`.
  - `folio.workspace.ruler` keeps its name. The new key is `folio.workspace.side-ruler`.
  - When the side key is missing, the side ruler follows the top key, so an old "true" turns both on.
  - Every toggle writes both keys, so changing one never flips the other later.
  - of3-rulers tests both the separate toggles and the old-preference case. Both pass.
- **Grey margin bands.** The top ruler's bands use `var(--line)` at 0.5 opacity, the same token as `.side-ruler-band`.
  Their width is the shown margin inside the ruler's own zoom. of3 checks this at several zooms in both views.
- **Page view pin.** `.ruler-strip` is sticky at the top of the scroller, opaque `--surface` (the desk grey), and full width.
  - It reaches over the 16 px padding of `.is-paged`.
  - At rest the ruler's bottom touches the first sheet's top and does not sit on it.
  - In continuous view the strip is `display: contents`, so the old sticky ruler behaves as before.
- **Caret.** The caret inset applies again in page view. The strip has no vertical padding, so its height equals the ruler's
  measured height. caretScroll.ts reads the same `scrollMargin`. of3 test 1 places the caret just under the pinned ruler,
  presses ArrowUp, and checks the editor scrolls the caret clear.
  Not separately tested: typing at the very top of page 2 or later. It uses the same inset, so this is reasoned, not proven.
- **Horizontal tracking.** Page view cannot scroll sideways:
  - `.is-paged` has `overflow-x: clip`.
  - `fitScale` shrinks the sheet to the pane, down to 25 percent.
  - The ruler carries the same zoom as the paper (zoom times fitScale) and is centred in the same column.

  So the ruler tracks the sheet and does not drift. ruler.spec checks alignment in page view at 75, 100 and 150 percent;
  125 percent is reasoned only. Sticky here is vertical only. Continuous view is unchanged from before.
- No new transitions. Tokens are used, not literals; the one exception is `margin: 0 -16px`, which mirrors the existing
  literal `padding: 16px` on `.is-paged`.
- Fixture: T286 changed only the "Page setup" entry (x 1113 to 1079.5625, width 232 to 265.4375). The other line in
  `git diff` (Prose check height 232 to 146) belongs to T282 (W9 F4), which was approved earlier.
- **Writer.tsx diff.** `git diff` compares against a commit from before wave 9, so it cannot isolate the script's edits.
  Every hunk does map to a known task:
  - ruler prefs, toggles, strip, bands and the comment: T286
  - `SideRuler`, the `axis` drag and the side key handler: C5/T268
  - `blankPageClick` onMouseDown: wave 9 blank-click
  - `menuPositionInCell`: T290
  - the `SpellCheck` icon, font options and `font-family-dropdown`: B1
  - Recent fonts: T289

  No unexplained change was found.
- Split view (27/27), w9-blank-click and popover-bounds pass in the reviewer run. pages-gap was not in this run; it
  passed in the worker's run (notes/OF3-rework-acceptance.txt). Focus mode hides the ruler, as before.

Defects (why rejected):
1. **The strip covers the floating sidebar.**
   - The page-view `.ruler-strip` is opaque, full width and `z-index: 5`.
   - `.sidebar-shell.is-floating` is `z-index: 4` in the same stacking context. Nothing between `.app` and the strip creates a new one.
   - The floating sidebar's top is the format bar's bottom, which is exactly where the strip pins.

   The reviewer probe used 1600x900, floating on, page view and the ruler on. `elementFromPoint` over the sidebar's
   project title (`.project-switch`) and the pin button (`.sidebar-pin`) returned `.ruler-strip`, both at rest and when
   scrolled. The probe sampled the middle of the part of each control that lies inside the strip band, not each
   control's own centre. So the part of the title row and of the pin inside the band (24 px) cannot be clicked, and
   anything drawn there is painted over. The colour is the same desk grey, so it is easy to miss.
   Inferred, not measured: at rest the strip spans y 130-154 and the title glyphs sit at about y 148, so the title text
   itself is probably partly painted over when a project opens.
   The right-hand citation card is also z-index 4 and probably has the same problem; it was not probed.
   The reworked ruler.spec does not catch this: it runs without floating, and it even asserts the strip is topmost at
   the scroller's left edge.
2. **Clicks on the strip are misrouted.** `blankClick.ts` ignores `.document-ruler` but not `.ruler-strip`, so a mousedown
   on the grey ends of the strip falls through to `blankPageClick`. In the probe (scrollTop 1500, click 8 px left of the
   ruler) the caret jumped from P15 to P11, a line hidden under the strip, and the view scrolled 40 px.
   At rest it lands on the first line, as a desk click above the sheet did before.

Fix list:
1. Keep the floating sidebar above the strip for both painting and clicks, while the strip stays above the sheets and
   side rulers. Changing only the strip's z-index does not work:
   - at 4 it ties with the shell, and the strip comes later in the DOM, so it still wins;
   - at 3 it ties with `.side-ruler`, which also comes later.

   Concrete option, editor.css only:
   `.app:has(.sidebar-shell.is-floating) .is-paged .ruler-strip { z-index: 3; }`
   This works because side-ruler.css:81 already hides the side ruler while the sidebar floats. The other page-view
   items inside the paper are z-index 1 or lower, so they still pass beneath the strip.
   A second option is strip 3 with side ruler 2 (side-ruler.css is a T286 path).
   Add an of3 assertion, shown failing first: floating on, page view, ruler on; `elementFromPoint` at the centre of
   `.project-switch` is inside `.sidebar-shell`, both at rest and scrolled.
2. In the `Writer.tsx` `onMouseDown`, return before `blankPageClick` when the target is inside `.ruler-strip`
   (blankClick.ts is off-limits). Add an assertion, shown failing first: click the strip's grey end while scrolled;
   the selection and scrollTop stay the same.

## T288 (OF5) -- REJECT
What is right:
- The file input is hidden by `.appearance-fonts input[type="file"] { display: none }`. That rule beats
  `.dialog input { display: block }`.
- Add font... is a real `<button>`. Its click calls `input.click()` within the same user gesture, so the keyboard path
  is intact. No spec waits for the `filechooser` event, so this is an owner hand check.
- The settings block is defined once (AppearanceSettings, used inside GeneralSettings, which App renders through
  `generalSettings()`). That block appears in both the Projects dialog (App:2259) and project Settings (App:2527).
- One row in both places: the menu is 260 px and the button sits to its right.
- `.project-settings .settings-nav + .settings-section { border-top: 0 }` keeps the strip's single bottom rule.
  SettingsNav is rendered only in project Settings, and the dialog body already drops section borders
  (library.css:122). So the rule never touches the app-level dialog.
- of5-settings 4/4, w9-fonts and w9-settings-nav 4/4 pass in the reviewer run.

Defect: `.appearance-fonts .settings-button` copies the shared button look: padding, border, background, colour and
justify-content. It also adds `font-size` and a literal `line-height: 1.5`. The comment gives the reason: the
research.css rule "does not reach the Projects dialog". That is false. The dialog wraps the same block in
`div.project-settings.library-settings-body` (ProjectLibrary.tsx ~481), so `.project-settings .settings-button` already
applies there. The tall box had two real causes: the label wrapped to "Add / font...", and the file input was visible.
The worker's own run 3 found the wrapping.

Fix list:
1. In src/settings/appearance-settings.css, delete padding, border, background, color, font-size, line-height and
   justify-content from `.appearance-fonts .settings-button`, along with the wrong comment. Keep only
   `flex: none; white-space: nowrap;`.
2. Rerun of5-settings. If the dialog button height still differs by more than 1 px, set only the property that differs
   on `.library-settings-body .appearance-fonts .settings-button`, using a token, and name it in the done note.

Pre-existing, not T288's: in both places `.project-settings .settings-button { color: var(--text) }` outranks
`.appearance-fonts__remove { color: var(--danger) }`, so "Remove" is not red. Worth a small follow-up ("danger stays red").

Owner hand check after the fix:
- Projects page > gear: no "Choose Files"; Add font... sits on the Interface font row, the same size as in project
  Settings; pressing Tab to it and then Space opens the file picker.
- Inside a project > Settings: one grey line under the section strip.

## T291 (OF8 hover blur) -- APPROVE (posted as message #1347)
- **One rule.** src/styles.css has exactly one emphasis rule: `text-shadow: var(--emph-bold) 0 0 currentColor;` with
  `--emph-bold: 0.3px` on `:root`.
  - `--emph-stroke` is gone, and `git diff -- src` removes no `text-shadow` line.
  - `-webkit-text-stroke` survives only in comments, in the ban inside hoverEmphasis.test.ts, and in the
    tests/native-smoke.js probe variants.
- **No clobbering.** The label-input reset is `text-shadow: none`. No other CSS in src set `text-shadow` before this
  change, so nothing is clobbered or doubled.
- **Nested controls.** A nested control would compute the same single shadow; shadows replace each other and do not add up.
- **Unchanged.** The selector list is unchanged, including `:disabled` and `[aria-disabled="true"]`. `currentColor` keeps
  danger red. A text-shadow does not change layout width.
- **Specs.** They were switched without weakening anything:
  - The same `> 0.2` thresholds and the shadow colour equal to the text colour.
  - Negative checks now read `text-shadow`.
  - The unit test pins the exact rule and the 0.3 px token.
  - The inlined parse reads the first `<number>px` in Chromium's "rgb(...) 0.3px 0px 0px", which is correct.
- **Docs.** The AGENTS.md hover sentence and the T291 sentences in docs/design-system.md are accurate. Other differences
  in those files against the last commit come from wave 9, not T291.
  - Side note for the coordinator: the design-system "Projects page (T274)" paragraph still describes the caption row
    that T287 removed.
- **Fail-first.** The unit test failed first (3 of 7). The browser specs were not shown failing. They would have failed:
  their positive checks (`> 0.2`) read text-shadow, which was "none" everywhere under the old rule. The unit fail-first
  plus that reasoning is enough.
- **Fresh run.** The worker's run passed 96 with 8 skipped and 0 failed (notes/BLUR-playwright.log, 17:20). It came after
  the last edit to styles.css and the specs (16:49), so the reviewer did not rerun it.
- **Sharpness is not proven by any of this.** Only the native blur probe at close-out can prove it
  (BLUR-DIAGNOSIS.md section 9: `blur-check.py` must print `RESULT PASS` on a fresh 1x build, plus the 2x look).
- Incident: the T291 worker and this reviewer shared one scratchpad folder. Its `pw.sh` was overwritten by the
  reviewer's `pw.sh` while its run was going. The only effect was harmless "ambiguous redirect" lines at the end of
  BLUR-playwright.log. The test results stand.

## What the native run (rebuilt app) must check
- **T286, page view at 100, 125 and 150 percent, on a narrow and a wide window:**
  - The top ruler stays pinned while scrolling, and pages pass beneath it.
  - The ticks and markers line up with the sheet.
  - Dragging a marker works, and ArrowUp or typing at the top of page 2 or 3 never hides the caret under the strip.
  - WebKit zoom reports rects differently; the caret inset uses the measured ruler height times totalZoom.
  - With floating mode on, the sidebar title and pin can be clicked (after the fix).
- **T288:** pressing Add font... opens the native file picker in both Settings places.
- **T291:** the blur probe described above.

## What the owner must check by hand
- **T286** (after the fix):
  - Page setup has two buttons. Turn each on and off alone, then reload.
  - In page view the top ruler sits on grey above the page, is shaded outside the margins, and stays at the top while
    you scroll.
  - Clicking the grey strip does nothing.
  - With the floating sidebar on, its title and pin still work.
- **T288:** as listed above.
- **T291:** on the external monitor, hover and Tab to a sidebar row, a Projects row, the project title, a tab and the
  zoom menu. The text looks bolder, just as sharp as at rest, and nothing moves.
- **T284:** no stray digits beside "Unlink source".

## Round 3 (agent-606c, re-review of the fix lists only)
Checks:
- `npx tsc -b`: exit 0.
- One Playwright run (port 1462, under the serial lock, lock released, output test-results/OFR3): w9-fonts, of5-settings
  and of3-rulers, **17 passed, 0 failed**. Log: notes/REVIEW-r3-playwright.log.
- Chromium only.

**T286 -- APPROVE.**
- **Floating sidebar.** `.app:has(.sidebar-shell.is-floating) .is-paged .ruler-strip { z-index: 3 }` outranks
  `.is-paged .ruler-strip` on specificity (0,5,0 vs 0,2,0), so file order does not matter. It applies only in page view
  with a floating sidebar, where the side ruler is hidden, so nothing ties at 3. The shell (4) and the citation card
  (inline 39) are now above the strip.
- **Strip clicks.** In `Writer.tsx` onMouseDown, a target inside `.ruler-strip` returns before `blankPageClick`.
  `preventDefault` is skipped for `[role='slider']`.
  - The margin handles keep mouse focus. Their dragging uses pointerdown, which a mousedown `preventDefault` does not touch.
  - Keyboard focus is unaffected.
  - A text selection that starts in the page has its mousedown target in the page, so it is unaffected.
  - In continuous view `.ruler-strip` is `display: contents` but still wraps the ruler. So a mousedown on a tick there
    now also stops the browser selecting tick text; it is harmless, because that ruler was already ignored by `blankPageClick`.
- **Tests.** Both new of3 tests failed first (OF3-rework2-fail-first.txt) and pass in the worker's run (95/95) and in mine.
- Still needs the native WebKit check listed above.

**T288 -- APPROVE.**
- **CSS cut.** `.appearance-fonts .settings-button` now holds only `flex: none; white-space: nowrap;`, and the wrong comment is replaced.
- **Remove is red.** `.appearance-fonts .settings-button.appearance-fonts__remove { color: var(--danger) }` uses the
  token, beats the shared colour, adds no fill, and the hover emphasis follows `currentColor`.
- **Tests.** The new colour test (at rest, hover and focus, in both Settings places) failed first (OF5-remove-fail-first.txt).
- **Discrepancy.** The worker's `done` note cites notes/OF5-rework.txt as "30 passed 0 failed". That file was overwritten
  by a later run (31 tests, 17:58) that shows 30 passed and 1 failed: w9-fonts at line 86, where `--ui-font` did not
  become Georgia. In my run w9-fonts passes. None of T288's rework touches font selection, so I read it as a one-off
  failure (cause unknown) from that later run, not a regression. Watch w9-fonts in the final validation.
