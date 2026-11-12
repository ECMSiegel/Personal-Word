# OF5 (T288) working notes

Status: fixes made and validated in Chromium (run 4: 30 of 30 passed). Ready for review.

## Fail-first (before any fix)
`tests/of5-settings.spec.ts`, 4 tests, all 4 failed on their assertions (not setup), matching the owner's report. Log: `notes/OF5-fail-first.txt`.
- Dialog: hidden file input is visible (`toBeHidden` received visible).
- Project Settings: Add font not on the Interface font row (vertical centre off by 57.5 px).
- Projects dialog: same, off by 83.25 px.
- Project Settings: two rules between the strip and General (strip bottom at 189.5, section top at 221.5).

## What changed
- `src/settings/AppearanceSettings.tsx`: the dropdown and the Add font button now sit in one row (`.appearance-fonts__row`); the hidden file input moved into that row. Accessible name "Add font..." and the input's selector are unchanged.
- `src/settings/appearance-settings.css`: `.appearance-fonts input[type="file"] { display: none; }` overrides the `.dialog input` rule in styles.css (not edited). The Interface font menu is 260 px wide (was full width), with the button to its right. The added-font list and the error message span the full width below.
- `src/settings/settings-nav.css`: `.project-settings .settings-nav + .settings-section { border-top: 0; }`, so the strip's bottom border is the only rule before General.

## What the owner sees
- Projects dialog Settings: no "Choose Files" box; Add font... is the same size as in project Settings.
- Both Settings places: Interface font menu (narrower), Add font... to its right on the same row. Added fonts and any error appear below.
- Project Settings: one grey line between the section strip and General.

## Hand check
1. Open a project, click Settings. Confirm one grey line under the section strip, none extra above General.
2. In the same screen, Interface font and Add font... are on one row, Add font... to the right. Add font... opens a file picker.
3. Go back to Projects, click the Settings control. In the dialog, no "Choose Files" control; Add font... matches the project Settings button in size and sits on the Interface font row.

## Limitations
- Checked in Chromium only. Native WebKit (the Mac app) is not checked.
- The 260 px menu width is a judgement call; adjust `.appearance-fonts__menu` if the owner wants it different.
- `npx tsc -b` now fails in `src/App.tsx` (lines ~3021, a `ResearchPanel` prop `onDeleteTextOnlyFootnote`), which is not a T288 path. It passed earlier in this session, so another task changed it. Not fixed here.

## RESULTS
(to be filled in after the post-fix run: `notes/OF5-after-fix.txt`)

Run 1 after the first fixes (`notes/OF5-after-fix.txt`): 29 passed, 1 failed. The failing test was the dialog button height: the Projects dialog Add font button was 57 px tall vs 37.5 px in project Settings. The `.project-settings .settings-button` rules in research.css do not reach the dialog, so `.appearance-fonts .settings-button` now copies them (padding, border, background, colour, font size). The hidden-input assertion in that test passed.

Run 2 (`notes/OF5-after-fix2.txt`): same four specs after that CSS change. Result pending.

Run 2 (`notes/OF5-after-fix2.txt`): 29 passed, 1 failed. Dialog Add font button still 52 px vs 35 px in project Settings. Cause: the project button's 35 px is 13 px text at the inherited `line-height: 1.5` of `.project-settings` plus 8 px padding top and bottom; my copied rule used `line-height: normal`, which was wrong.

Run 3 (`notes/OF5-after-fix3.txt`): the same four specs after `line-height: 1.5` was set on `.appearance-fonts .settings-button`. Result pending.

Run 3 (`notes/OF5-after-fix3.txt`): 29 passed, 1 failed. Dialog Add font 57 px vs 37.5 px. Line-height was not the cause. The label wraps to two lines ("Add / font...", as in owner screenshot 6.png) because the dialog row is narrow and the button shrinks. Fix: `.appearance-fonts .settings-button` gets `flex: none; white-space: nowrap;`.

Run 4 (`notes/OF5-after-fix4.txt`): 30 passed, 0 failed, covering all four specs (of5-settings, w9-fonts, w9-settings-nav, appearance).

## RESULTS
- Fail-first: 4 of 4 tests in tests/of5-settings.spec.ts failed on assertions (`notes/OF5-fail-first.txt`).
- Final: 30 of 30 passed across of5-settings, w9-fonts, w9-settings-nav and appearance (`notes/OF5-after-fix4.txt`).
- Browser trips: five in total (fail-first, then runs 1 to 4); the plan allowed two. Runs 1 to 3 each left one dialog button assertion failing and were fixed in turn.
- Unit: `npx vitest run src/designTokens.test.ts src/motion.test.ts`, 29 of 29 passed.
- Types: `npx tsc -b` fails only in `src/App.tsx` around line 3021 (`onDeleteTextOnlyFootnote`), not a T288 path; passed earlier in this session (`notes/OF5-tsc.log`).
- Limit: Chromium only; native WebKit (the Mac app) not checked.

## Rework (reviewer r2 reject + owner "make Remove red")
- `.appearance-fonts .settings-button` in src/settings/appearance-settings.css now holds only `flex: none; white-space: nowrap;`. The copied padding, border, background, colour, font-size, line-height and justify-content are gone, along with the wrong comment (the dialog is wrapped in `.project-settings`, so the shared rule in research.css already applies). The dialog and project Settings Add font heights still match within 1 px.
- Remove red: cause was specificity. `.project-settings .settings-button { color: var(--text) }` (0,2,0) beat `.appearance-fonts__remove { color: var(--danger) }` (0,1,0). Fix: `.appearance-fonts .settings-button.appearance-fonts__remove { color: var(--danger); }` (0,3,0). Existing token, no fill, no new literal.
- New test "Remove font button is the danger colour in both Settings places" (tests/of5-settings.spec.ts): adds a font, checks computed colour equals resolved --danger at rest, hover and focus, in both places. Failed first (rgb(36,36,40) vs rgb(180,35,24); `notes/OF5-remove-fail-first.txt`).
- Final run (`notes/OF5-rework.txt`): 30 passed, 0 failed (of5-settings, w9-fonts, w9-settings-nav, appearance). `npx tsc -b` exit 0. Chromium only.
- Hand check: Projects page > gear and project Settings: add a font, "Remove" is red, still red on hover/Tab focus; Add font looks identical in both.
