# REVIEW-5 -- independent look at FB1, FB2, FB6, FB7, FB8, FB9

Reviewer: Claude Opus (independent), 2026-11-19. Read-only: no source or test file changed. Board not touched.
Probe specs lived in `test-results/fb-review5-probe/` (dev server, serial lock, pinned Node, workers=1) and were deleted afterwards.
Screenshots and raw measurements: `test-results/fb-review5/` (`measurements.json` holds every number quoted below).
Evidence boundary: Chromium (Playwright) against the dev server only. No native WebKit, no owner use. Everything here is CLAIMED at best.

## Summary

| Task | Verdict |
|---|---|
| FB1 Projects meta layout | **fix needed** (wraps at narrow and mid widths; cramped card gap; ragged date labels) |
| FB2 Sort button | **fix needed** (menu text does not line up with the trigger text; pointer lands on "Name" so two rows are bold) |
| FB6 Backspace removes a Tab indent | fine |
| FB7 No "Page header text" placeholder | fine |
| FB8 Delete source in sidebar menu | **fix needed** (a PDF of the deleted source left open beside) |
| FB9 Research collapse chevrons | **fix needed** (three toggles are centred across the panel) |

Spec re-run (`tests/fb-projects-meta.spec.ts tests/fb-sort-menu.spec.ts tests/ci-indent.spec.ts tests/sb-page-header.spec.ts tests/sidebar-context-menu.spec.ts tests/fb-research-collapse.spec.ts`, dev server, workers=1): **34 passed, 4 skipped** (the four light/dark screenshot tests in sidebar-context-menu, skipped by design), 0 failed. Every finding below is something these specs do not measure.

---

## FB1 -- Projects meta layout: fix needed

What is right (measured, `projects-*` and `folders-*` in measurements.json):
- List view at 1100 and 1440: the four columns have identical left/right edges on every row (Edited 462-588, words 600-684, sections 696-780, Added 792-918 at 1100), all rows 53 px, no wrapping.
- **Inside folders** (two folders, a subfolder, loose projects): the columns still line up exactly with the top-level rows at both widths; only the titles move in by one slot (154 / 178 / 202). The very long title truncates with an ellipsis at x 446 and never reaches the meta (16 px clear) or the trash.
- Card view at 1100 and 1440 (cards 256 px): every card has identical offsets (Edited/Added at +17, words/sections at +141; Added directly under Edited, sections under words). Nested folder cards (capped at 256 px) match.

Findings:

1. **High -- the ≤700 px rule no longer "stacks to two lines" (plan step 4).** At a 600 or 700 px window every date wraps mid-date ("Edited Dec 12, / 2026"), each row's meta becomes four lines, row heights differ (the "Notes" row is shorter) and the right column's x moves per row (words at 461 / 479 / 495 px). This is exactly the "pushed around based on length" the owner complained about. Screens: `1-projects-list-600-light.png`, `1-projects-cards-600-light.png`.
   Cause: `src/styles.css` `@media (max-width: 700px)` keeps `.project-dates { max-width: 160px }` and the new grid uses `grid-template-columns: 1fr auto; white-space: normal`.
   Fix: in that media block, delete `max-width: 160px` for `.project-dates`, and change the two-column grid to fixed tracks with no wrapping: `grid-template-columns: 10.5em 7.5em; white-space: nowrap;` (the `auto` track is what makes the right column move).

2. **Medium -- cards wrap their dates between about 720 and 870 px windows.** At 820 px the page fits three cards of 236 px; the `1fr` date track is then 100 px for a ~120 px date, so every card's dates wrap to two lines (cards 150 px tall instead of 120). Screen: `1-projects-cards-820-light.png`; measured at 820 (card 236, all six cards wrap) and fine from 880 up.
   Fix (`src/styles.css` `.project-list--cards`): raise the card minimum so the two tracks always fit, `grid-template-columns: repeat(auto-fill, minmax(264px, 1fr))`, and add `white-space: nowrap` to the cards `.project-dates` rule. Keep `src/library/folders.css`'s nested cap equal to the new minimum (`minmax(264px, 264px)` instead of `256px`), or nested cards will wrap instead.

3. **Medium -- card meta is cramped.** The gap between the date column and the words column is 4 px (`gap: var(--space-1)`): "Added Sep 30, 2026 1 section" reads as one run of text (see `1-projects-cards-1100-light.png`, Haiku and Thesis cards). The list view uses 12 px between the same items.
   Fix: in the cards rule use `column-gap: var(--space-3); row-gap: var(--space-1);` in place of `gap: var(--space-1)` (needs the 264 px minimum from finding 2 so the 120 px date still fits: 120 + 12 + 90 = 222 = 264 - 2 x 17 padding - 8 spare). No new spacing declaration is added, so `layoutBudget.json` does not grow.

4. **Low -- the "Edited" and "Added" labels are ragged in list view.** Each track is right-aligned (as the plan said), so the numbers' right edges align but the words "Edited" start anywhere from x 472 to 483 and "Added" from 801 to 811 (`list-text-starts`). To the eye the date columns look less aligned than the counts.
   Fix: in `src/styles.css`, `.project-list--list .project-dates .project-edited, .project-list--list .project-dates .project-added { text-align: left; }` (keep words and sections right-aligned). Owner's call; listed because his complaint was about alignment by eye.

5. **Info.** The list's name column is capped at about 292 px at every width (the meta takes a fixed 456 px of the 800 px page), so a long title truncates at about 30 characters even at 1440. That is what the plan's fixed tracks imply; not a defect.

Screens: `1-projects-{list,cards}-{1100,1440}-{light,dark}.png`, `1-projects-cards-{600,760,820}-light.png`, `1-projects-list-{600,700}-light.png`, `1-projects-list-820-dark.png`, `3-folders-{list,cards}-{1100,1440}-{light,dark}.png`.

## FB2 -- Sort button: fix needed

What is right: trigger reads the current sort ("Last edited", "Custom"); no word "Sort"; menu top-left equals trigger top-left exactly (899.6, 158.5); menu width = trigger width (96.4 px, the longest row "Last edited" needs 94 px); no `.dropdown-check`; four rows Name, Added, Last edited, Custom; reverse is disabled while Custom is chosen (`2-sort-custom-*.png`); square corners, raised shadow; menu does not cover the reverse button.

Findings:

1. **Medium -- the menu's text does not sit on the trigger's text.** Trigger label text starts at x 907.6, y 162.5; the first row's text starts at x 912.6, y 172 -- 5 px right and 9.5 px lower, and the current row ("Last edited") is the third row, 73.5 px below where the label was. On open the words jump. The owner's original complaint was "misaligned". Screen: `2-sort-menu-open-light.png` vs `2-sort-trigger-rest-light.png`.
2. **Medium -- two rows look selected the moment the menu opens by mouse.** Because the menu covers the trigger, the pointer that clicked the trigger is now over the "Name" row, which goes semibold on hover; "Last edited" is semibold as the current row. With no checkmark (by request) there is no way to tell which is current. Screen: `2-sort-menu-open-dark.png` (Name and Last edited both bold).
   One fix for both: in cover mode, place the menu so the **current** row's text sits exactly on the trigger's text (the macOS pop-up rule). In `src/components/Popover.tsx` anchor placement (or in `Dropdown.tsx` after open), when `cover` is set, offset the menu by `triggerText.left - rowText.left` horizontally and `triggerText.top - currentRowText.top` vertically (clamped to the viewport like today). The pointer then rests on the current row, which is already bold, and nothing jumps. Update `tests/fb-sort-menu.spec.ts` to assert the current row's text box equals the trigger's text box (±1 px) instead of menu top = trigger top.
3. **Low -- a focus ring box after a mouse pick.** After choosing Custom with the mouse the trigger shows the blue focus outline (`2-sort-custom-dark.png`). This is shared Dropdown behaviour (focus returns to the trigger), not new in FB2, but on the Projects page it reads as a box highlight. Fix if wanted: return focus with `focus({ focusVisible: false })` when the choice came from a pointer.

## FB6 -- Backspace removes a Tab indent: fine

Probed (`fb6-Blank`, `fb6-Chicago`, `fb6-chicago-inherited` in measurements.json), caret placed with Meta+ArrowLeft or `setTextSelection`, never Home:
- Blank project, **paged by default** (`.is-paged` present): Tab gives `firstLineIndent 0.5in`; Backspace at the line start sets it to `0`, text and paragraph count unchanged; the next Backspace joins. Two Tabs (`0.5in` first line + `0.5in` left): three Backspaces go left 0, first line 0, then join.
- Chicago, paragraph inheriting the document first-line indent (attribute null): Tab gives `indentLeft 0.5in` (margin-left); Backspace sets it to `0`; the next Backspace joins (nothing explicit to remove). Cmd+Z after the Backspace restores the 0.5in left indent alone.
- Heading: Tab gives first-line 0.5in; Backspace clears it.
- List item: Backspace at the start of the second item lifts it out of the list (2 items to 1) with no indent attribute touched -- default behaviour, as required.

Findings: **Info** only. A paragraph whose left indent comes from somewhere other than Tab (e.g. an imported block quote with `indentLeft`) also loses its indent step by step on Backspace before joining. Word does the same; not a defect. The Undo check with fast synthetic typing merges with the typing group (Playwright artefact), so Undo was checked with pauses.

## FB7 -- no placeholder: fine

Both "Page header text" inputs are empty with no `placeholder` attribute (Page setup, Export settings), light and dark. `grep placeholder="Siegel" src` is empty; the doc comment says "Lastname".
- **Low (pre-existing, not FB7's change):** in Export settings the field is an underline-only input between boxed inputs (Font size, Margins), so empty it reads as a stray rule (`6-export-settings-light.png`). Previously the grey "Siegel" hid this. Fix if wanted: give `src/export/ExportPanel.tsx`'s Page header text input the same class/box as the Font size input.

Screens: `6-page-setup-{light,dark}.png`, `6-export-settings-{light,dark}.png`.

## FB8 -- Delete source: fix needed

What is right: the source row's menu reads Open, Move up, Move down, Delete source (red, danger); PDF, note and Bibliography rows unchanged; a linked source shows the refusal text and stays; an unlinked one asks "Delete source “Beta source”?", flushes, snapshots "Before deleting source …", then deletes (spec passes). Screens: `5-source-menu-{light,dark}.png`, `5-delete-source-dialog-{light,dark}.png`, `5-delete-source-refusal-light.png`.

Findings:

1. **Medium -- the deleted source's PDF stays open beside.** Open the source's PDF beside (right-click PDF row -> Open beside), then Delete source: the right pane stays, now reading "This PDF is not stored in this project." (`5-after-delete-source-with-pdf-open-light.png`; 2 panes after delete). `remove()` prunes the split after deleting; `deleteSource` does not.
   Fix (`src/App.tsx` `deleteSource`, after `mutate`): copy `remove()`'s split handling -- `const pruned = prune(splitRef.current, p.entries.map((x) => x.id), researchPdfHolderIds(p)); splitRef.current = pruned; setSplit(pruned);` using the updated project. Add a case to `tests/sidebar-context-menu.spec.ts`: Open beside the PDF, delete its source, expect one `.split-pane`.
2. **Low -- refusal shows a "Retry" button.** The refusal goes through the shared error banner, which always offers Retry (save-and-refresh), meaningless here. It follows the plan's wording. Fix if wanted: show the refusal through `setNotice` instead of `setError`.
3. **Low -- no confirmation after deleting.** `remove()` shows "“…” deleted. A safety snapshot keeps it."; `deleteSource` shows nothing. Fix: `setNotice(\`“${title}” deleted. A safety snapshot keeps it.\`)` after `mutate`.
4. **Info.** The dialog's Delete source button is the blue primary (not red), the same as every existing delete confirmation in the app.

## FB9 -- research collapse chevrons: fix needed

What is right: four toggles; each hides its body and flips `aria-expanded`; state shared and remembered (spec passes); label colour and size equal the old field labels (12 px, `--muted` rgb(108,108,116)); chevrons `--muted`, 14 px, rotate 90° when open; hover is the shared 0.3 px text-shadow only; the Cite dialog's previews are unchanged.

Findings:

1. **High -- Note, Shortened note and Bibliography toggles are centred across the panel.** The toggle is a full-width grid item (357 px) and the global `button { justify-content: center }` centres its content, so the labels sit at x 1195-1240 while the citation text below starts at 1067 (`4-research-expanded-light.png`, `4-research-note-usedin-collapsed-dark.png`). It looks broken.
   Fix (`src/research/research.css`, the existing `.research-panel button.research-collapse-toggle` rule): add `justify-self: start;` (the button then hugs its label at the left edge). No spacing declaration is added.
2. **Medium -- the chevron pushes the labels off the text edge and puts it on the wrong side.** The chevron comes first, so "Used in" starts at x 1085 while its sibling headings "Source" and "Citation" start at 1067, and (after fix 1) the preview labels will start 18 px in from the citation text under them. Everywhere else in the app the disclosure chevron is at the right of its label (sidebar headers, the source row's chevron at x 1410).
   Fix (`src/research/Cite.tsx` `Preview` and the Used in button in `src/research/ResearchPanel.tsx`): render `<span>{label}</span>` before `<ChevronRight …/>`. The label text then starts on the same x as the text beneath it (optical alignment), and the chevron trails it.
3. **Medium -- "Used in" lost its heading look.** It used to be a `research-subhead` (600, text colour) like "Source" and "Citation"; the button's `color: var(--muted)` now makes it grey while its siblings are dark (`4-research-expanded-view-light.png`). The owner asked for a small grey *arrow*, not a grey heading.
   Fix (`src/research/research.css`): `.research-subhead > .research-collapse-toggle { color: inherit; font-size: inherit; }` so the heading keeps its own colour and the chevron stays `--muted` through the existing `svg` rule.
4. **Low.** The chevron is 14 px beside 12 px text, so it reads slightly larger than "the same tiny grey" (recorded deviation in PLAN.md "As built"). Fine if the owner accepts; 12 px is what the plan asked for.

Screens: `4-research-expanded-{light,dark}.png`, `4-research-expanded-view-{light,dark}.png`, `4-research-note-usedin-collapsed-{light,dark}.png`, `4-research-hover-short-light.png`.

## Steps for the owner to confirm after repair
1. Projects page, list view, window about 650 px wide: each project's meta is two lines and the right column starts at the same x on every row.
2. Card view, window about 820 px wide: no date breaks onto a second line; there is clear space between the dates and the counts.
3. Click the Sort button: the current sort's word sits exactly where the button's word was, and only that row is bold.
4. Open a source's PDF beside, delete the source from the sidebar: the PDF pane closes.
5. Open a source in the research bar: Note, Shortened note and Bibliography labels start at the left edge above their text, chevron after the label; "Used in" looks like "Citation".
