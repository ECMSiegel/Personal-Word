# REVIEW-1 -- OB8 eyes-on review of the Projects page outline (T342)

Reviewer: Claude Opus (agent-9e6b), 2026-11-23. Diff reviewed: `git diff ebe40f2` plus the untracked `src/library/*` files and `tests/ob-*.spec.ts`. No source or spec edits were made.

## Verdict: APPROVE WITH REPAIRS

The rebuild does what the owner asked. Folders and projects are now one list of rows, nesting reads correctly, columns line up to the pixel at every depth, the sort menu and header sorting work, and dragging under any sort keeps the hand-made order. Three defects must be fixed before the OB9 rebuild:

- **B1:** deleting a pinned project uses up a pin slot for good.
- **B2:** the sort menu's keyboard highlight is not scrolled into view, so `tests/motion.spec.ts` (g) fails and the full suite cannot pass.
- **B3:** a pinned project with a long name loses its pin mark.

Each needs only a small, local change.

Status of this review's evidence: CLAIMED. Everything was checked in Chromium on the built preview, using isolated preview storage. Nothing was checked in the Mac app's WebKit.

## How it was checked
- Build: `npm run build` under the serial lock with the pinned Node 22.23.3. tsc exited 0 (`node_modules/.cache/personal-word-beta/ob8-tsc.log`) and the build exited 0 (`ob8-build.log`).
- Unit tests: `npx vitest run` gave 99 files and 1435 tests passed (`ob8-vitest.log`).
- OB specs: `PLAYWRIGHT_PREVIEW=1 PLAYWRIGHT_PORT=1489 npx playwright test tests/ob-outline.spec.ts tests/ob-sort-menu.spec.ts tests/ob-drag.spec.ts tests/ob-pins.spec.ts --workers=1` gave 46 passed and 5 skipped (the screenshot cases), exit 0 (`ob8-obspecs.log`).
- Review harness (throwaway, not part of the suite): `reviews/ob8.config.ts` and `reviews/ob8-review.spec.ts`, on port 1488 against the built preview.
  - Runs: run 2 had 29 passed and 1 harness selector error, which was fixed. Runs 3, 4 and 5 had 5, 1 and 1 passed (`ob8-review-run2..5.log`).
  - Measurements are in `reviews/shots/measure.json`, and the 96 screenshots are in `reviews/shots/`.
- Seeded library:
  - Essays: teal, expanded, holding Drafts, then Old, then Ancient draft (three levels).
  - Fiction: collapsed. Empty: no contents.
  - 12 projects with 0 to 999,999 words, 1 to 30 sections, dates from 2025 to 2026, and one 117-character title.
  - Also a library with no folders and an empty library.

### Screenshots opened and looked at

All of these are under `reviews/shots/`:

- **Tree and indent:** `tree-1280-light`, `tree-1280-dark`, `tree-600-light`, `worst-case-indent-light`.
- **Sort menu:** `sortmenu-open-light`, `sortmenu-500tall-end-key-light`.
- **Column chooser:** `columns-menu-dark`, `columns-two-hidden-light`, `columns-menu-one-hidden-full`.
- **Pins:** `pins-three-expanded-light`, `pins-3of3-menu-dark`, `pins-folder-collapsed-light`.
- **Dragging:** `drag-before-light`, `drag-into-dark`, `drag-end-light`, `drag-refused-own-subtree-light`.
- **Menus, rename and search:** `menu-folder-light`, `rename-dark`, `search-light`.
- **Focus and hover:** `focus-row-light`, `focus-folder-dark`, `hover-folder-light`.
- **No folders and empty:** `nofolders-1280-light`, `empty-600-dark`.
- **Opened in a second pass:**
  - `mixed-name-light`, `mixed-name-600-light`, `sort-words-light`, `sort-name-reversed-light`;
  - `pins-600-light`, `hover-row-light`, `drag-mixed-before-folder-light`;
  - `worst-case-indent-dark`, `ghost-pin-menu`.

Every other PNG in that folder was only measured through `measure.json`, not opened:

- the 900-wide and remaining dark trees;
- the other sorts;
- the rest of the menu, drag, hover and focus variants;
- `orphan-pin-after-folder-delete`, `pinned-band-zoom`, `kbd-shift-f10`.

Harness artefacts, not product defects:

- **Sort and Mixed shots.** They catch the sort menu in its closing animation. The harness shot straight after Escape, so the menu shows faded or clipped. The row orders were read from `measure.json`.
- **Drag shots.** Their text looks heavier than in the other shots, header and toolbar included. Measured mid-drag, the computed `font-weight` and `text-shadow` on `.brand` and on the header buttons match the values after the drop (`measure.json` "followups"). The difference is Chromium's headless rasterizing.
- **Leftover focus rings.** Some shots show a focus ring on Huge manuscript or Zebra plan, left over from an earlier Escape in the same test.

## Definition of done -- verdict per line

| # | Definition of done line | Verdict | Evidence |
|---|---|---|---|
| 1 | No card view or view toggle; folders and projects are rows of one height in one list | PASS | Toolbar: Start, Import, search, Sort, New folder, Settings only. Every `.outline-row` is 40 px at 1280, 900 and 600 (`measure.json` tree-*). |
| 2 | Siblings start at the same x, a child is one step right, every column's right edge is equal at every depth | PASS | 1280: names at 296 / 320 / 344 / 368 px for depths 0-3 (+24 each); cell right edges 732 / 812 / 910 / 1008 on all 15 rows, folders included; header label right edges are identical. Same at 900 (106 / 130 / 154 / 178) and 600. No sideways scroll. |
| 3 | Header labels Name, Edited, Words, Sections, Added; click sorts, second click flips; right-click on the header row chooses columns (Name always shown); choice survives restart | PASS, with S3 | Arrow never moves its label (labelLeft and labelRight identical across all 10 clicks). Two columns hidden: header and cells still aligned. Choice survives a reload. But the right-click and click targets are only the 36x15 px label buttons: a right-click on blank header space, or 8 px above a label, does nothing (S3). A native restart was not checked. |
| 4 | Folder rows show total words, "n projects", latest edit (subfolders included) | PASS | Essays reads 3,967 = 1,000 + 2,117 + 800 + 50 (Old's project included), "4 projects", Nov 12, 2026 (from Drafts). Empty reads "0", "0 projects", no date. |
| 5 | One sort menu with Sort by / Direction / Folders, each checked; arrow button gone | PASS, with B2 | `sortmenu-open-light`. In windows under about 620 px tall the keyboard highlight leaves the view (B2). |
| 6 | Drag under any sort moves one row in the saved order and switches to Custom; with no saved order, the screen order becomes saved | PASS | Rule A: saved order Zebra, Poems, Alpha, Long, Blank, Huge in the old `order.root` key. Under Name, Zebra was dragged below Alpha. Result: Poems, Alpha, Zebra, Long, Blank, Huge (not alphabetical), sort Custom, `order.root` unchanged (`measure.json` "followups"). Rule B under Mixed and Edited: `items:root` = the on-screen order with Zebra moved. `ob-drag.spec.ts` also passes. |
| 7 | Drop at the end of the top level; folder into folder | PASS | `drag-end-light` shows the line at depth 0 under the last row. Empty was dropped into Essays (lands first), then dragged back to the blank area (lands last). |
| 8 | Up to three pins, shown in a top band with a pin mark and nowhere else; no band when nothing is pinned | **FAIL** | B1 (a deleted pinned project keeps its slot forever), B3 (no pin mark on a long name), S1 (a pin inside a pinned folder uses a slot and shows no mark). The band, gap, path and "no band when unpinned" all behave correctly. |
| 9 | The owner's existing `library.json` reads exactly as before | PASS (preview + unit) | An old-shape fixture under Custom shows `folders:root` then `root` in order; a drag writes only `items:root` and leaves `order.root` / `order["folders:root"]` byte-identical. Native file not checked. Caveat: `fileProject` (pre-existing, `folders.ts:269-270`) still removes a moved project's id from old-key lists, so "old keys never rewritten" holds for reorders, not for Move to folder. |
| 10 | tsc clean; unit, cargo and full suites pass; Opus review approves; app rebuilt, not launched | NOT MET | tsc and unit tests are clean (here). Cargo was not run (OB9's job). The full suite's last run (OB7 `ob-full2.log`) still fails motion (g), which B2 fixes. This review approves with repairs. The rebuild is OB9's job. |

## The owner's four complaints

1. **"A drag made under another sort should apply to your saved order":** met. Rule A and rule B both behave correctly (DoD 6).
2. **Better nesting and indent:** met. One 24 px step per level, folder and document icons in one slot, names at one edge per level (`tree-1280-light`).
3. **A Drive-style menu with several settings:** met. One menu with three checked groups (`sortmenu-open-light`).
4. **"Something in a folder is shown below a subfolder although it is the level above it":** met.
   - With Folders on top, Essay one and Essay two follow the open Drafts > Old > Ancient draft. Their icon (296) and name (320) sit one step left of Deep draft (320 / 344), so they read as Essays' children by indent alone.
   - Worst case checked (`worst-case-indent-light`): the last top-level folder, Zoo, ends with a collapsed folder (Cage) and an empty one (Pen), followed by top-level projects. The top-level project's icon (272) and name (296) sit one step left of Pen's icon (296) and name (320), and the result reads correctly.
   - One nuance is left for the owner's hand test (L8): a top-level project's document icon is only 8 px right of a depth-1 folder's chevron (264 vs 272), so the leftmost marks step slightly "in". The names and icons carry the reading.

## Findings

### Blockers

**B1 -- A deleted pinned project keeps its pin slot forever.**
- Evidence:
  - Seeded pins Alpha, Zebra and Poems, then deleted Poems through its trash and dialog.
  - Only 2 pin marks are visible, but every unpinned row's menu says "Pin to top (3 of 3 used)" (disabled), even after a reload (`measure.json` "ghost-pin"; `shots/ghost-pin-menu.png`). `library.json` still holds `p:<Poems>`.
  - The deleted project has no row, so nothing in the UI can unpin it.
- Causes:
  - `removeProject` (`src/App.tsx:1170-1195`) never touches the library.
  - `pinItem` (`src/components/ProjectLibrary.tsx:389-398`) counts the raw `lib.pins.length`.
  - `togglePin` (`src/library/folders.ts:342-348`) refuses at 3 raw entries.
  - The same happens to a pin whose project is missing from the listing for any other reason.
- Repair:
  - In `pinItem`, count only live pins for `full` and for the label. A live pin is a key whose folder is in `lib.folders` or whose project is in `projects`.
  - Do not prune keys just because their project is missing from `projects`:
    - `projects` is `[]` until the first listing (`App.tsx:512,643`);
    - a damaged project folder is left out of the listing but sits in `damagedFolders`.
  - Remove a project's pin only on a confirmed delete. Either:
    - (a) have `ProjectLibrary` unpin `p:<id>` in the delete path, after `removeProject`'s dialog confirms (for example, App passes a callback, or ProjectLibrary prunes when an id it had disappears and is not in `damagedFolders`); or
    - (b) when a new pin is added at the raw limit, drop only the dead keys whose id is not in `damagedFolders`.
  - Add a unit test, and an `ob-pins.spec.ts` case: pin 3, delete one, and the next menu offers an enabled "Pin to top".

**B2 -- The sort menu's keyboard highlight is never scrolled into view (open item i; this is why motion (g) fails).**
- Evidence:
  - At 1280x900 the menu fits: 427 px, computed `max-height` 427 px, End shows "Mixed with projects" in view (`measure.json` "sortmenu-light").
  - At 1280x500 the menu is capped at 309 px of 427, and the Folders group is below the fold. The only visible hint is a half-cut "Oldest first" (`sortmenu-500tall-end-key-light.png`).
  - After End, the highlighted row is at y=575-607 while the menu ends at 494, and `scrollTop` stays 0. A mouse wheel does scroll it (`scrollTop` 118), so pointer users can reach it but keyboard users lose the highlight.
  - The menu needs a window about 620 px tall.
- Cause: `SortMenu.tsx` has no `scrollIntoView`; the old `Dropdown.tsx:86` had one.
- Repair:
  - In `SortMenu.tsx`, add `useLayoutEffect(() => { if (open) document.getElementById(\`${id}-${highlight}\`)?.scrollIntoView({ block: "nearest" }); }, [open, highlight])`.
  - Re-run `tests/motion.spec.ts` (g) alone, then `ob-sort-menu.spec.ts` and `fb-sort-menu.spec.ts`.

**B3 -- The pin mark disappears on a long pinned name (open item vi).**
- Evidence:
  - The 117-character pinned project shows no pin at all (`pins-three-expanded-light.png`, band row 3).
  - Measured: the pin is drawn at x=990-1006 while the name span is clipped at 634 (`measure.json` "pins-light"). The same happens at 600 wide.
  - Since the band has no heading, the pin mark is the only sign the row is pinned, so the row looks out of place.
- Cause: `Outline.tsx:137-141` puts the pin inside `.outline-name`, which ellipsizes (`outline.css:86-93`).
- Repair:
  - Put the title text in its own inner span that carries the ellipsis (`min-width: 0; overflow: hidden; text-overflow: ellipsis`).
  - Lay `.outline-name` out as the existing `.cluster` + `.gap-1` primitives (`src/components/layout.css:48,58`), with the path and pin after the title as `flex: none`.
  - Use the primitive's gap, not the current `" "` text node: whitespace-only text between flex items is dropped.
  - Add no spacing declaration to `outline.css` (budget 0).
  - Add an `ob-pins` assertion: the pin icon's right edge is at or before the name column's right edge for a long pinned title, at 1280 and 600.

### Should-fix

**S1 -- A pin inside a pinned folder uses a slot but shows no mark anywhere.**
- Evidence:
  - Pinned Fiction and Essays, then pinned Deep draft, which lives inside Essays.
  - Deep draft stays inside Essays in the band (Q1 default) with no pin icon (`Outline.tsx:124,127`: marks only on depth-0 band rows).
  - Every other row then reads "Pin to top (3 of 3 used)" while only 2 marks are visible (`measure.json` "logic-pins": withDeepPin, deepMenu). Inside a collapsed pinned folder it is not even drawn.
- Repair (pick one, coordinator's call):
  - (a) Draw the pin mark on any row with `row.pinned` inside the band, keeping the path only on top rows. This is one condition in `nameExtras`.
  - (b) Disable "Pin to top" on rows inside a pinned folder, reading "Pin to top (folder is pinned)".
  - (a) is cheaper and matches "a way to show they are pinned".

**S2 -- The column chooser's labels do not line up, and its check differs from the sort menu's.**
- Evidence:
  - With Words hidden, "Words" starts at x=799 while the ticked labels' text starts about 14 px further right, after a "✓ " prefix (`columns-menu-one-hidden-full.png`; `measure.json` "last".chooser).
  - The sort menu uses a blue Lucide `Check` in a fixed check column.
  - Cause: `columnMenu.ts` prefixes text because `ContextMenuItem` has no checked state (OB3 note).
- Repair:
  - Give `ContextMenuItem` an optional `checked?: boolean`, drawn with the same `.dropdown-check` + `Check` column the SortMenu uses (and `role="menuitemcheckbox"`).
  - Drop the text prefix. `ContextMenu.tsx` is shared, so this goes through the coordinator.
  - Cheaper fallback: always reserve the check column (an empty fixed-width span on unticked rows).

**S3 -- Header click and right-click targets are only the label text.**
- Evidence:
  - Each header button is as wide as its label and 15 px tall inside the 40 px header row (Words: 36x15 px at y 226-241; row y 214-254).
  - A right-click on blank header space (x+250, mid-height) opens no menu. A right-click or left-click 8 px above the Words label does nothing (`measure.json` "followups").
  - DoD 3 says "right-clicking the header row". In the Mac app a miss may also show WebKit's own context menu.
- Cause: `onContextMenu` sits on each `button.outline-sort` only (`Outline.tsx:163`), and the buttons do not fill their cells.
- Repair:
  - Move the `onContextMenu` handler to the `.outline-header` row (keep Shift+F10 on the buttons).
  - Let each `.outline-sort` fill its cell with `align-self: stretch` and the row's alignment, so the whole cell height sorts. That is not a spacing declaration.
  - Spec: a right-click on blank header space opens "Columns".

### Low

**L1 -- The rename field's text jumps 8 px right of the sibling names.**
- Evidence: the input box starts at 296 (the name edge), but its computed `padding-left` is 8px, so "Essays" is drawn at 304 while the sibling "Fiction" text is at 296 (`measure.json` "last".rename; `rename-dark.png`).
- Repair: zero the input's inline padding through a primitive, or a `.flush-start`-style negative inset equal to it. Outline.css's budget is 0, so either use a primitive or record a budget decision with the coordinator.

**L2 -- Folder rows give no hover cue although the whole row toggles on click.**
- Evidence: hovering a folder name or chevron changes nothing (`text-shadow: none`, chevron `transform: none`, cursor default; `measure.json` "last"; `hover-folder-light.png`). The trash icon does grow.
- Repair: add `icon-grow` to `.folder-chevron` in `Outline.tsx:211`, so the shared `icon-magnify.css` rule applies. It is not a new rule. Leave the name as is.

**L3 -- Trash icons show while dragging (open item v), and the lifted row shifts.**
- Evidence:
  - Mid-drag, the hovered target row and the lifted row both show their trash (`drag-before-light.png`; `measure.json` "drag-light".trashShown).
  - The lifted row's content also sits about 4 px right (the shared press scale).
- Repair: a visibility rule (not a hover weight or scale), `.library-tree[data-dragging] .delete-entry { visibility: hidden; }`, in `folders.css`. Leave the press scale alone.

**L4 -- Dragging a folder dims only the folder row.** Its children, which move with it, stay at full strength (`drag-refused-own-subtree-light.png`).
- Repair (optional): also mark the rows whose ancestors include the dragged folder as lifted in `dragAttrs`.

**L5 -- Misleading announcement for a folder step.** Option+Down on Drafts (the last folder in Essays, with projects below it under Folders on top) announces "Drafts is already last" (`measure.json` "keyboard".altDownFolder).
- Repair: when the refusal comes from the kind boundary, say "Drafts is already the last folder" (or "first project").

**L6 -- `moveFolder` leaves a stale key in the old parent's order list.**
- Evidence: after Empty went into Essays and back out, `order["items:f-essays"]` still lists `f:f-empty` (`measure.json` "logic-pins".libAfterBack).
- Impact: harmless when drawn, but "Move to folder…" back into Essays then shows Empty at its stale position instead of first among unlisted rows.
- Repair: in `moveFolder`, strip `f:<id>` from every `items:` list, as `fileProject` does for projects.

**L7 -- Stale comment.** `src/library/outline.css:110` says the pin is "14px"; it is 16 px (open item vii). Fix the comment.

**L8 -- Leading marks stair-step slightly.** A top-level project's icon (x=272) sits 8 px right of a depth-1 folder's chevron (x=264), so in the worst case the leftmost marks step slightly inward. No repair: names and icons read correctly. Flag it for the owner's hand test.

**L9 -- An empty folder shows an open (down) chevron with nothing under it** (`tree-1280-light.png`, Empty). Cosmetic; leave unless the owner minds.

**L10 -- Column chooser focus.** After toggling a column from the keyboard, focus goes to the first header button ("Name"), not the one that opened the menu. That one may be gone when its own column was hidden. Leave.

### Open items from the brief -- confirmed and sized

| Item | Finding |
|---|---|
| (i) SortMenu scroll / 320 px cap | The menu is not capped at 320 px at normal sizes: the computed max-height is 427 px at 900 px tall and the whole menu shows. It is cut below about 620 px tall, and the keyboard highlight then goes out of view. B2. |
| (ii) Folder rows not staggered on return | Confirmed in code: `src/research/pageMotion.ts:30` still staggers only `.project-row`, so folder rows appear without the stagger. Not checked by eye. Cosmetic. Leave until the cause of the `fb-folders.spec.ts:241` swatch-click conflict is known. Not a blocker. |
| (iii) "Into" anchors on the saved list | Correct: every drop switches to Custom, so "first in the saved order" is "first on screen" right after. No repair. |
| (iv) "After B inside A" unreachable when B is A's last row and expanded | Confirmed by reading `outlineDrag.ts:58`. Workarounds: collapse B, or use Move down. Low; accept. |
| (v) Trash shows while dragging | Confirmed. L3. |
| (vi) Pin ellipsized | Confirmed. B3. |
| (vii) Pin 14 to 16 px | Correct: design-system.md and `designTokens.test.ts` require 16 px Lucide icons, and the plan's 14 px was wrong. Only the comment is stale (L7). |

### Design rules -- verdict
- **Flat and square:** met. No row fills, no band fill or heading, square menus, square focus rings (`tree-1280-*`, `pins-*`, `focus-*`).
- **Selection is weight and colour:**
  - Met: the sorted header is in the text colour with an arrow; checked sort-menu rows are bold with a check; "into" is the accent colour on the folder name.
  - No fills anywhere.
- **One shared hover rule:** met for project rows (the faux bold in `hover-row-light`). `src/hoverEmphasis.test.ts` passes in the unit run. Folder rows have no hover cue at all (L2). The column chooser's text check is the odd one out (S2).
- **'--' separators:** met. Paths read "-- Fiction" and "-- Essays / Drafts".
- **16 px icons:** met. Folder, document, pin and trash icons are 16 px, chevrons 14 px. `src/designTokens.test.ts` passes.
- **Spacing budget:** met. `outline.css` and `folders.css` are at 0 and `styles.css` went down from 115 to 106 (`src/layoutBudget.json`). `layoutPrimitives.test.ts` passes in the unit run.

### Checked and fine
- Every sort orders folders and projects as Decisions 3, 5 and 6 say:
  - Added orders folders by name.
  - Words and Sections use the subtree totals.
  - Custom with no saved order shows the sort it came from.
  - Z to A flips folders and projects alike.
  - Mixed interleaves (Drafts: Deep draft before Old).
- Search is a flat list with "-- Essays / Drafts" paths, no folders and no band, even with pins set.
- Deleting a pinned folder unpins it and lifts its children to the parent. They show first in Custom, as Decision 3 says.
- Orphan pin: Novel stays pinned when Fiction is deleted and loses its path. Unpinned, it returns to the top level in sort order.
- Preferences survive a reload: sort, direction, Folders and columns, plus a folder's collapsed state.
- Keyboard:
  - Tab order runs Sort, New folder, Settings, the five headers, then rows (folder chevron; project open, trash).
  - Left and Right on a chevron collapse and expand, with focus kept.
  - Enter on a chevron toggles.
  - Option+Down reorders and switches to Custom, with focus kept.
  - Shift+F10 on a row and on a header opens the right menu, and Escape returns focus.
- Context menus stay inside the window, including on the last row of a 600 px tall window.
- The folder menu carries its swatch row with the current colour marked.
- The no-folders library has no arrow slot: the icon sits on the row edge, and the names and the Name header are flush at 264 px.
- The empty library has no header and no rows, just the empty state.
- Pinned and unpinned name text sit at the same height (12-29 px inside a 40 px row). The pin's bottom aligns with the text bottom.
- Dark mode: muted cells, the "into" accent name and the drop line are all readable (`tree-1280-dark`, `drag-into-dark`).
- OB7's rewritten specs (spot-checked in `fb-folders.spec.ts`) were adapted, not weakened. The indent checks are tighter than before (1 px against the old 2 px).

## Could not check
- The Mac app's WebKit: grid `subgrid` on the project open button, `:has()` for the closing rule, Futura rendering and the 40 px rows. Playwright WebKit is not installed and installs are not allowed.
- Touch and trackpad dragging, and the native window's real height for the sort menu.
- Native persistence: Rust `library.json` read and write, and a restart with pins and preferences. The preview only uses browser storage.
- Undefined word or section counts. In preview `projectCounts` always returns numbers, so only the unit test (`projectLibraryCounts.test.ts`) covers the empty cell.
- `cargo test` and the full built-app browser suite were not run (OB9's job). OB7's `ob-full2.log` is the latest full run: 2 failures, motion (g) and a performance timing case.
- VoiceOver and screen-reader reading of the outline, and the Reduce Motion stagger (ii).
- The owner's real library: never opened, by rule.

## Throwaway files from this review
- `reviews/ob8.config.ts`
- `reviews/ob8-review.spec.ts`
- `reviews/shots/` (96 PNGs + `measure.json`)

These are not part of the suite and can be deleted when the owner is done with the screenshots.
