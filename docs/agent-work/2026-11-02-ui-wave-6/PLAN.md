# PLAN -- UI wave 6: owner fixes, line rail navigation, lighter process
Date: 2026-11-02 | Architect: Claude (Opus 5.5) | Project: Project 13 - Word Processor | Status: APPROVED (owner 2026-11-02: "Approve commit"; wave 5 committed first; board not yet seeded)

## Goal
Every issue the owner reported on 2026-11-02 and every "known rough edge" from wave 5 is gone in the real macOS app, and the sidebar lines become a rail you can click to jump through the document, with a hover preview like the owner's reference app.

## Request
Owner, 2026-11-02 (screenshots in the session; copies to be saved beside this plan as `shots/1..12` by T0):
1. "the command palette works great, but the spacing on the right side isn't great" (highlighted row's shortcut runs into the right edge).
2. "The settings page isn't centered, and the sidebar settings aren't all in the sidebar section".
3. "The little scissor on the top right corner doesnt magnify and is not clickable" (same for the comment button beside it).
4. "the projects screen is having some weird overlap with the trash can".
5. "entirely remove the 'give these words a home' bottom panel, they can just be copy pasted from the split panel view".
6. "get rid of the 'ideas and reminders...' text".
7. "The spacing on the right side bar notes section is all weird with the lines and dividers ... needs some reworking".
8. "the magnifying top bar blurs the hovered thing, not just magnifys".
9. Sidebar: (1) "the cards and plus still have a little grey box in some modes"; (2) "the spacing of the split view and scroll horizontal line is off"; (3) "The horizontal line we added can't be used to move things up and down right now"; (4) reference pictures of how lines work in another app (a compact stack of short lines; the current one is longer; hovering shows a preview card; clicking jumps).
10. "also include fixes to all the 'Known rough edges'" = wave-5 VALIDATION.md items o, p, s, t, u.
Process: "maximize parallelism"; owner suspects too many gates before the final check. Defaults accepted 2026-11-02: lines jump on click with a hover preview (reorder stays row drag); scissor and comment always clickable, acting on the cursor's paragraph when nothing is selected, and magnifying like every toolbar icon; settings centred with the sidebar options in the Sidebar section. "don't run the plan just design".

## Definition of done
- Palette: the highlighted row's shortcut stays exactly where it sits unhighlighted; left and right inner padding are equal.
- Settings: the settings column is centred in the pane; "Reveal sidebar on hover" and "Floating sidebar and research" sit in a "Sidebar" section (Project settings: the existing Sidebar section; Projects-screen settings: a Sidebar section of their own).
- Scissor and comment buttons are clickable whenever the cursor's paragraph has text, act on the selection or else that paragraph, and magnify with the dock like every toolbar icon.
- Projects list: hovering a row never puts the trash icon over any text.
- No "Give these words a home" panel anywhere; nothing it alone used remains.
- Notes tab: no "Ideas and reminders" hint; at most one divider line between two notes and none stacked on another line.
- Toolbar icons are as sharp at full magnification as at rest, in the macOS app.
- Sidebar: no filled box behind any hover icon in any mode (Plain/Color, light/dark, pinned/unpinned/floating, any width 190-390); hover icons never cover a label; word counts stay visible at 190 px.
- Line rail: clicking a line opens/scrolls to that item; hovering (or keyboard focus) shows a preview card with its title and first words; the open item's line is longer; spacing even; works in split view.
- Rough edges o, p, s, t, u: widening the window hands the research panel back to the card; no toast covers the card or panel; floating Research list never runs behind the bottom rows.
- Validation list passes, including native macOS screenshots; owner hand-check sheet written. Status stays CLAIMED until the owner confirms.

## Non-goals
- No storage, schema, Rust or export changes; no new `folio.*` keys.
- No reorder by dragging the rail's lines (reorder stays dragging rows / Option+Up/Down).
- No new keyboard shortcuts; no change to the palette's command list.
- Fable findings 9a-9p from wave 5 (wave 6+ backlog) unless a lane's own files fix one in passing -- then note it, don't hunt for them.
- No early-start copy tasks, no gate tasks, no separate docs task, no separate native task (see Approach).
- No commits/pushes by implementers; owner decides at the end (no Claude co-author trailer).

## Context (verified unless marked)
- Base: `main` @ b840851; wave 5 is in the working tree, uncommitted (64 modified/untracked paths outside `team/`), CLAIMED -- verified (`git status`). Wave 6 builds on that tree. Do not stash, reset or checkout.
- Shared emphasis rule: one selector block `src/styles.css:405-470` scales any button/option/row by `--emph-scale` (4%) with `--emph-origin`; full-width rows grow from the left (`styles.css:487-495`) -- verified. A full-width row with right-side content (palette hint, project dates) therefore pushes that content 4% of the row width to the right -- inferred from the rule and screenshots 3 and the projects crop (palette row 560 px -> about 22 px).
- Palette: `.command-palette-option` padding `--space-2 --space-5 --space-2 --space-4` (right larger "to absorb the grow") `src/components/command-palette.css` ~line 70 -- verified; rows highlight on mouse move (`CommandPalette.tsx:188`) and arrows (`:139`) -- verified.
- Projects row: `.project-row` flex with the open button (dates right-aligned) then `.delete-entry` trash (`ProjectLibrary.tsx:349-366`; CSS `styles.css:1135-1153, 1878-1905, 2118-2124`) -- verified.
- Settings: `div.project-settings` `max-width: 720px` with no auto margin, so it hugs the left (`src/research/research.css:367-376`) -- verified; an older `.project-settings` rule also exists in `src/organization/organization.css:147-154` -- verified (stale duplicate; leave unless it fights the change). The two sidebar checkboxes live in `src/settings/GeneralSettings.tsx:124-139`; the project-only "Sidebar" section (Show Read/Comments/History) is in `src/App.tsx:2391-2422`; `generalSettings` element `App.tsx:2053-2075` is shown both in Project settings (`:2390`) and on the Projects screen (`:2120`) -- verified.
- Scissor `.format-bar .extract` (`src/Writer.tsx:1762-1772`) and comment `.toolbar-icon` (`:1749-1760`) are `disabled={editor.state.selection.empty}` -- verified. `:disabled` and `.format-bar .extract` are excluded from emphasis (`styles.css:428,431`); `.extract` has no `toolbar-icon` class so the dock never magnifies it -- verified. Shortcut path calls `callbacksRef.current.onExtract(activeEditor)` (`Writer.tsx:620`) -- verified.
- Dock: `src/editor/toolbar-motion.css:4-7` scales the 16 px svg up to `--dock-scale` 1.5 -- verified; WebKit rasterises the small svg and stretches it (blur in the owner's native screenshot) -- inferred (Chromium does not show it).
- "Give these words a home": `App.tsx:1842-1864` footer, `target` state `:500`, `restoreFragment` `:1139`, CSS `styles.css:1079-1098`; tests `tests/writing.spec.ts:35`, `tests/fragments-panel.spec.ts:150`, `tests/split-view.spec.ts:286`, `tests/hover-emphasis.spec.ts:355` -- verified.
- Notes tab: `src/research/ResearchPanel.tsx:689-741` (hint `:690-692`, Add note, `.note-item` per note); `.note-item` has a top border (`research.css:325-329`) and the textarea and dropdown draw their own bottom lines, so three lines stack (screenshot 7) -- verified. Hint asserted at `tests/research.spec.ts:54` -- verified.
- Sidebar grey box: at container width <= 240 px `.group-actions` becomes `position:absolute` over the heading with `background: var(--sidebar)` (`styles.css:1795-1808`) -- verified; in floating mode or Color palette that fill differs from what is behind it (screenshot 8). The same overlay covers the label (rough edges s, t); `.entry-main small { display:none }` hides word counts at narrow widths (`styles.css` ~1790) -- verified.
- Line rail today: `src/components/scrollspy.ts` (pointer magnify, progress fill; no click handling: only pointermove/leave at `:262-268`) and `scrollspy.css`; one line per sidebar row, rendered in `ProjectSidebar.tsx` (wave-5 A3 region, formerly `:524-547`) -- verified. What a line "is" in the reference: one per item, compact stack, current one longer, preview on hover -- verified from screenshots 1-2.
- Split view (9.2): owner screenshot 12 shows the sidebar panel over the left end of the format bar and left pane (zoom box cut off) -- verified from the image; whether that is the unpinned hover overlay (by design) or a pinned-layout bug -- unknown; T7 measures it.
- Floating measurement: `src/components/floating.ts` measures margins inside `.workspace`; a docked sidebar or an open research aside shrinks `.workspace`, so the fit is judged against the space they occupy. Chromium probe 2026-11-02 at 1240x840, 75%: sidebar did not float although its floating margin would be 314 px (needs 222) -- verified (`node_modules/.cache/personal-word-beta/ui5-v3/probe/`). Same cause explains rough edge o (panel open -> card never fits) -- inferred.
- Toast `.notice` fixed bottom-right 16 px, max 360 px (`styles.css:1456-1464`), rendered `App.tsx:3021` -- verified; card/aside also bottom-right -> overlap (rough edge p) -- verified by wave-5 shots.
- Native screens harness `tests/native-screens.js` (baked into the smoke binary; rebuild after edits) can drive clicks but not hover -- verified.

## Rules in force
- `folio.*` keys, `com.folio.writing`, native event names unchanged -- `AGENTS.md`.
- Read `docs/design-system.md` before CSS; tokens only (`--space-*`, type, motion); transitions only transform/opacity; no `@keyframes` -- `docs/design-system.md`, `src/designTokens.test.ts`, `src/motion.test.ts`.
- ONE hover/focus emphasis rule (`styles.css`), no second hover weight/scale; toolbar icons use the dock -- `AGENTS.md`, `src/hoverEmphasis.test.ts`.
- No fills or grey boxes; square corners; sidebar selection is weight + colour -- `AGENTS.md`, memory `personal-word-ui-taste`.
- Every hover interaction has a keyboard path; keyboard actions never animate; Reduce Motion respected -- `AGENTS.md`.
- Floating mode never overlaps document text -- `AGENTS.md`.
- Check native WebKit for layout/editor changes; Chromium is not proof -- `AGENTS.md`.
- Parallel agents need explicit file ownership -- `AGENTS.md`. Team board: claim, register paths, `team.py review` -- `team/PROTOCOL.md`.
- No commits/pushes; no Claude trailer -- memory `no-claude-commit-credit`, owner.

## Approach
Eight lanes run at once, each owning named files (or named line regions of the two shared files `src/styles.css` and `src/App.tsx`). Each lane is one board task done by one Sonnet worker, ends with its own targeted specs and screenshots, writes its doc notes to `docs/agent-work/2026-11-02-ui-wave-6/notes/<task>.md`, and gets one independent Sonnet review (`team.py review --approve/--reject`). The line rail starts with a 30-minute prototype the owner picks from, while the other lanes work. Then one final check (V) runs everything, Chromium and native, merges the notes into the docs, and builds the app; a Fable review follows; repairs re-run only what they touch plus the native screens.
Rejected: wave-5 process (gate tasks, early-start copies, separate docs/native tasks, full re-validation twice) -- about twice the agents and time, and its Chromium-only gates missed the one native bug; two batches (quick fixes, then design) -- two native rounds; one agent doing everything -- no parallelism.

Lanes and ownership (no two lanes edit the same file region):
| Task | Owner files / regions |
|---|---|
| T0 setup | `docs/agent-work/2026-11-02-ui-wave-6/` (REQUEST.md, shots/), board seeding |
| T1 emphasis rows: palette + projects | `src/styles.css` emphasis block (405-500) and `.project-row`/`.delete-entry` rules (1135-1153, 1878-1912, 2114-2124); `src/components/command-palette.css`; `CommandPalette.tsx`; `ProjectLibrary.tsx`; `src/hoverEmphasis.test.ts`; `tests/command-palette.spec.ts`; `tests/projects-screen.spec.ts`; `tests/hover-emphasis.spec.ts` |
| T2 settings + remove fragment footer | `GeneralSettings.tsx`; `research.css` 367-405 only; `App.tsx` 495-505 (`target`), 1139-1150 (`restoreFragment`), 1842-1864 (footer), 2053-2075 (`generalSettings`), 2389-2425 (Sidebar section); `styles.css` 1079-1098 (`.restore-fragment`); `tests/writing.spec.ts`, `tests/fragments-panel.spec.ts`, `tests/split-view.spec.ts:286` line only, `tests/appearance.spec.ts` settings asserts if any |
| T3 toolbar: scissor, comment, dock blur | `src/Writer.tsx` 600-625 and 1740-1775; `src/editor/toolbar-motion.css`; `src/components/dock.ts` (only if needed); `tests/editor-toolbar.spec.ts`; new unit test `src/editor/paragraphTarget.test.ts` |
| T4 notes tab | `ResearchPanel.tsx` 686-745; `research.css` 150-335; `tests/research.spec.ts` |
| T5 floating fit + toast (o, p) | `src/components/floating.ts`, `floating.test.ts`; `App.tsx` 1935-2060 (fit/card), 3015-3030 (notice); `styles.css` 1271-1290 and 1456-1467 (`.notice`); `tests/floating.spec.ts` |
| T6 sidebar look (9.1, s, t, u, 9.2 layout) | `src/components/ProjectSidebar.tsx` except the line-rail markup; `styles.css` 1540-1830 (sidebar block); `src/components/floating.css`; `src/components/split.css`, `SplitDivider.tsx`; `tests/sidebar-selection.spec.ts`, `tests/alignment.spec.ts`, `tests/split-view.spec.ts` (except T2's line) |
| T7a rail prototype | scratch only: `node_modules/.cache/personal-word-beta/ui6-rail/` |
| T7b rail build (after owner pick + T6 approved) | `scrollspy.ts`, `scrollspy.css`, `scrollspy.test.ts`, `tests/scrollspy.spec.ts`, line-rail markup in `ProjectSidebar.tsx` |
| V final check | `tests/native-screens.js`, `scripts/native-screens.py`, `docs/*.md`, VALIDATION.md, HANDOFF.md |
| F Fable review, R repairs | review read-only; repairs scoped by findings |

Shared-file protocol for `src/styles.css` and `src/App.tsx`: edit only inside your rows above with the Edit tool (never rewrite the file, never run a formatter), re-read the region right before each edit, keep the tree compiling after every edit, and if your region's anchor text has moved or changed, re-find it by its text, not its line number.

## Tasks

### T0 -- Set up the wave (coordinator)
- Files: create `docs/agent-work/2026-11-02-ui-wave-6/REQUEST.md`, `shots/` (copy the owner's 12 images from the session scratch `images/1.png..12.webp`), `notes/`.
- Interfaces: provides the folder and board tasks T1-T7b, V, F, R with the ownership table above registered (`team.py files add`).
- Steps: 1. Write REQUEST.md with the Request section verbatim. 2. Images: already copied to `shots/` on 2026-11-02 (1-2 reference rail, 3 palette, 4 settings, 5 scissor, 6 sidebar at 150%, 7 fragment footer, 8 grey box, 9-11 notes/projects crops, 12 split view); open each and fix this mapping in REQUEST.md if it is off. 3. Seed board tasks; T7b depends on T6 and on the owner's rail pick; V depends on T1-T6, T7b.
- Acceptance check: `python3 team/team.py status | grep -c "W6"` -> 11 tasks listed (T1-T6, T7a, T7b, V, F, R); `ls docs/agent-work/2026-11-02-ui-wave-6/shots | wc -l` -> 12.
- Fail-first: n/a: setup.
- Stop and ask if: the board shows a live task registered on any path in the table.
- Default if unanswered: none -- must ask.

### T1 -- Label-only emphasis for rows with right-side content (items 1, 4)
- Files: per table.
- Interfaces: provides CSS classes `.emph-row` (a row that does not itself scale) and `.emph-label` (its child that receives the shared stroke + grow when the row is hovered, focused or highlighted). Other lanes may use them; none are required to.
- Steps:
  1. In the shared emphasis block, add `.emph-row` to the exclusion list, and extend the same block's trigger selector so `.emph-row:is(:hover, :focus-visible, [data-highlighted], .is-highlighted) .emph-label` gets the identical stroke and `--emph-s` (grow origin left). This extends the one rule; do not write a second rule.
  2. `CommandPalette.tsx`: option gets `emph-row`, label span gets `emph-label`. `command-palette.css`: padding `--space-2 --space-4` on both sides; drop the "absorb the grow" comment.
  3. `ProjectLibrary.tsx`: the row's open button gets `emph-row`, `.project-name` gets `emph-label`; dates do not move. Give `.delete-entry` its own fixed slot (`flex: 0 0 auto`, `margin-left: var(--space-2)`) so it never overlaps the dates; card view unchanged unless it overlaps there too (then same fix).
  4. Update `src/hoverEmphasis.test.ts` so it accepts the extended block and still fails on any second hover scale/weight rule.
  5. Specs: palette -- the highlighted row's hint `getBoundingClientRect().right` equals its unhighlighted value (+/-0.5) and left/right padding are equal; projects -- with a row hovered, the trash rect does not intersect the dates rect, at 1100 and 1600 px wide.
- Acceptance check: `npx vitest run src/hoverEmphasis.test.ts` -> pass; `npx playwright test -c <private config> command-palette projects-screen hover-emphasis` -> all pass.
- Fail-first: the two new spec assertions fail on the untouched tree (hint moves about 22 px; trash intersects dates at 1100 px).
- Stop and ask if: hoverEmphasis.test.ts cannot express "one block" with the new selectors without weakening its check.
- Default if unanswered: none -- must ask.

### T2 -- Settings centred with a Sidebar section; remove "Give these words a home" (items 2, 5)
- Files: per table.
- Interfaces: `GeneralSettings` gains prop `sidebarExtras?: ReactNode` (rendered at the end of its new "Sidebar" section). Nothing else uses it.
- Steps:
  1. `research.css` `div.project-settings`: `margin-inline: auto; width: 100%` (keep max-width 720). Also centre the settings block on the Projects screen if it is left-hugging there.
  2. `GeneralSettings.tsx`: move the two checkboxes out of General into a new `<section className="settings-section"><h2>Sidebar</h2>` placed right after General, followed by `{sidebarExtras}`.
  3. `App.tsx`: pass the Show Read/Comments/History checkboxes as `sidebarExtras` only in Project settings, and delete the now-duplicate Sidebar section there. Projects-screen settings show the Sidebar section with just the two checkboxes.
  4. Remove the fragment footer (`App.tsx:1842-1864`), the `target` state, `restoreFragment`, and `.restore-fragment` CSS, plus imports left unused by that removal only.
  5. Update the four specs that click or count "Append to section": delete the steps that used it; where a test's purpose was restoring a fragment, replace the step with copy from the split pane only if the test still has a purpose, otherwise delete the test and say so in the notes.
  6. Notes file lists the removed tests by name.
- Acceptance check: `npx tsc --noEmit -p .` -> 0; `rg -n "Give these words a home|restoreFragment|restore-fragment" src tests` -> no output; Playwright `appearance projects-screen writing fragments-panel split-view` -> pass; new assertion: settings column centre x equals pane centre x (+/-1) at 1600 px.
- Fail-first: the centring assertion and the rg check fail on the untouched tree.
- Stop and ask if: anything other than the footer calls `restoreFragment`.
- Default if unanswered: none -- must ask.

### T3 -- Scissor and comment always usable; sharp dock (items 3, 8)
- Files: per table.
- Interfaces: provides `paragraphRange(state: EditorState): { from: number; to: number } | null` in `src/editor/paragraphTarget.ts` (new) -- the selection if non-empty, else the cursor's textblock content range, else null when that block is empty.
- Steps:
  1. Write `paragraphTarget.ts` + unit test (empty selection in a text paragraph -> its range; empty paragraph -> null; non-empty selection -> selection).
  2. `Writer.tsx`: both buttons `disabled` only when `paragraphRange` is null. Before calling `onComment`/`onExtract` (button and the shortcut at `:620`), if the selection is empty set it to the range.
  3. Give the scissor `toolbar-icon` so the dock magnifies it; remove `.format-bar .extract` from the emphasis exclusion only if it then double-styles (it is T1's block: ask T1 via board message instead of editing).
  4. Dock blur: draw toolbar svgs at 24 px and scale them down at rest, so peak magnification is scale 1 (`width/height: 24px`, negative margin keeping the 16 px layout box, transform `scale(calc(var(--dock-scale,1) / 1.5))`). Bar layout width/height and icon centres must not move.
- Acceptance check: `npx vitest run src/editor/paragraphTarget.test.ts` -> pass; Playwright `editor-toolbar` -> pass, plus new checks: with the cursor in a text paragraph and no selection, the scissor is enabled and clicking it creates a fragment containing that paragraph; the format bar's width and every icon's centre are unchanged (+/-0.5 px) at rest; the scissor's svg scale on hover is > 1.
- Fail-first: the new spec fails on the untouched tree (scissor disabled). Blur: n/a in Chromium -- proven by V's native zoomed screenshot, so add a native-screens capture request to the notes for V.
- Stop and ask if: a Writer path other than these two buttons and the shortcut reads `selection.empty` for these actions.
- Default if unanswered: none -- must ask.

### T4 -- Notes tab rework (items 6, 7)
- Files: per table.
- Interfaces: none.
- Steps:
  1. Delete the "Ideas and reminders..." hint; keep "No notes yet." when empty.
  2. Layout: "Add note" row, then `--space-4`, then the notes. Lines: one 1px `--line` between consecutive notes only (`.note-item + .note-item`), none above the first; the textarea keeps its own bottom line; the "Attach to source" dropdown and "Delete note" share one row (dropdown grows, Delete to its right) so no line sits directly on another.
  3. Spacing tokens only; gap inside a note `--space-2`, between notes `--space-5`.
  4. Update `tests/research.spec.ts:54`; add a spec that, with two notes, counts horizontal 1px lines between the first note's last field and the second note's first field = 1, and that no two lines are within 8 px of each other in the tab.
- Acceptance check: Playwright `research` -> pass; screenshot of the Notes tab with 0, 1 and 2 notes in light/dark, read by the implementer.
- Fail-first: the line-count spec fails on the untouched tree.
- Stop and ask if: the owner-visible layout in your screenshots still shows a line touching another.
- Default if unanswered: none -- must ask.

### T5 -- Floating fit measures the space floating would free; toast clear of card/panel (o, p)
- Files: per table.
- Interfaces: `floating.ts` exports `freedMargins(edges, hostRect, docked: { left: number; right: number }): { left: number; right: number }` -- margins as they would be if the docked sidebar width (`left`) and open research aside width (`right`) were free. `useMarginFit` gains a `docked` argument. T6 relies on nothing new.
- Steps:
  1. Unit-test `freedMargins` (1240-wide window, docked sidebar 270, sheet 612 -> left/right about 314).
  2. App: pass the docked sidebar width (0 when floating already) and the aside width (0 when the card shows). Keep the fit hysteresis-free: widening while the panel is open must show the card without reopening Research.
  3. Toast: when the card or aside is on screen, the notice sits to their left (right offset = their width + `--space-4`); otherwise unchanged.
- Acceptance check: `npx vitest run src/components/floating.test.ts` -> pass; Playwright `floating` -> pass plus new: at 1240x840, 75% zoom, page view, floating on -> sidebar floats and Research opens the card; at 1100 open Research (panel) then widen to 1600 -> card shows without a click; a toast raised while the card is open does not intersect it.
- Fail-first: all three new specs fail on the untouched tree (verified for the first on 2026-11-02 by probe).
- Stop and ask if: making the fit "as if floating" ever lets the sidebar or card overlap the sheet in any existing floating spec.
- Default if unanswered: none -- must ask.

### T6 -- Sidebar: no grey boxes, icons never over labels, word counts kept, floating list, split-view layout (9.1, 9.2 layout, s, t, u)
- Files: per table.
- Interfaces: none for other lanes; T7b starts from T6's approved tree.
- Steps:
  1. At every width, `.group-actions` stays in the heading's flow (space reserved, opacity toggled as today), never absolute, never filled. Labels ellipsize to make room; word counts stay visible and the label truncates before the count.
  2. Remove any remaining background on hover icons and card toggles in all modes (search `styles.css` sidebar block and `floating.css` for `background` on `.group-actions`, `.view-toggle`, add buttons).
  3. Floating: the Research (and every) list scrolls inside its own region that ends above the bottom rows; the bottom rows never overlap list rows; a scroll fade (existing `scrollFade`) marks more content.
  4. Split view (9.2): screenshot pinned and unpinned, at 1280 and 1600, with split on. If the pinned sidebar covers the format bar or the left pane, fix the layout so the workspace starts after it. If it only happens in the unpinned hover overlay, record it in notes as by-design and stop there.
  5. Specs: for widths 190, 240, 270, 390 x Plain/Color x pinned/floating: hovered heading's action buttons and their ancestors up to the heading have transparent backgrounds, do not intersect the label text rect; at 190 the word count is visible. Floating with 40 research notes at 900 px tall: last list row bottom <= first bottom row top.
- Acceptance check: Playwright `sidebar-selection alignment floating split-view` -> pass with the new cases.
- Fail-first: the background and overlap cases fail at 240 px on the untouched tree.
- Stop and ask if: the split-view fix needs `App.tsx` outside T5's region or a Writer change.
- Default if unanswered: none -- must ask.

### T7a -- Line rail prototypes (9.3, 9.4)
- Files: scratch only (per table); a static HTML page using the app's tokens, or a patched private build that is never written back.
- Interfaces: provides `ui6-rail/README.md` with screenshots of two variants and the owner's choice.
- Steps:
  1. Variant A "rows": the current per-row lines, plus click-to-jump and a hover/focus preview card.
  2. Variant B "rail": a compact stack of evenly spaced short lines (one per item of the open group) in the sidebar's right gutter, the open item's line longer, hover/focus preview card (title + first 120 characters), click jumps -- like the owner's reference.
  3. Post both screenshots to the board as an owner question; the coordinator relays it.
- Acceptance check: `ls node_modules/.cache/personal-word-beta/ui6-rail/*.png | wc -l` -> >= 4 (each variant light + dark).
- Fail-first: n/a: prototype.
- Stop and ask if: never -- it ends with the owner's pick.
- Default if unanswered: Variant B (closest to the reference).

### T7b -- Build the chosen rail (9.2 lines, 9.3, 9.4)
- Files: per table. Starts after T6 is approved.
- Interfaces: uses the owner's variant from T7a.
- Steps:
  1. Click (and Enter/Space on a focused line) opens that item; for the open section it scrolls to the top. Keyboard: lines are focusable buttons with the item title as their name.
  2. Hover or focus shows a preview card (title + first 120 characters, `role="tooltip"`, `aria-describedby`), placed beside the line, never over document text; Escape hides it; keyboard show/hide is instant; Reduce Motion instant.
  3. Keep wave-5 behaviours the variant keeps (progress fill, magnify); update `scrollspy.spec.ts` contracts the owner's variant changes and say which in notes.
  4. Even spacing: equal centre-to-centre distance between lines (+/-1 px) in each group, in split view too.
- Acceptance check: `npx vitest run src/components/scrollspy.test.ts` -> pass; Playwright `scrollspy split-view hover-emphasis` -> pass plus new: clicking the second line opens the second section; focusing a line and pressing Enter does the same; hovering shows the tooltip with that section's first words; spacing equal.
- Fail-first: the click and tooltip specs fail on the untouched tree.
- Stop and ask if: the chosen variant needs a change to the document/editor scroll code outside these files.
- Default if unanswered: none -- must ask.

### V -- Final check (one pass, Chromium + native), docs merge, app build
- Files: per table.
- Interfaces: uses every lane's notes file.
- Steps:
  1. Serial lock; pinned Node. `npx tsc --noEmit -p .`; `npm test`; `npm run build`; full Playwright on a private config; `cargo test`.
  2. `tests/native-screens.js`: add captures for the palette (open, a row highlighted), Settings, the Notes tab with two notes, split view with the rail, the toolbar at 1.5x hover is not possible natively -- instead capture a toolbar icon at rest at 2x device zoom and ask the owner to judge blur by hand.
  3. `touch src-tauri/src/lib.rs`; smoke build; native reliability baseline + beta; native smoke; gates pages-zoom and pages-probe; native screens plain + color. Read every new PNG.
  4. Merge `notes/*.md` into `docs/design-system.md`, `docs/changelog.md`, `docs/limitations.md` (remove o, p, s, t, u), `docs/user-guide.md` (fragment restore is now copy/paste or the context menu).
  5. `touch src-tauri/src/lib.rs`; `npm run tauri build`; record the app sha256.
  6. Write VALIDATION.md (results + owner hand-check sheet, one line per Definition-of-done bullet).
- Acceptance check: every command above exits 0; Playwright 0 failed; native screens EXIT 0 with all captures; VALIDATION.md has a hand-check line per Definition-of-done bullet.
- Fail-first: n/a: integration.
- Stop and ask if: any native capture contradicts its Chromium spec.
- Default if unanswered: none -- must ask.

### F -- Fable review; R -- repairs
- F: one Fable reviewer, read-only, checks request + plan + diff + V's results and screenshots; writes `FABLE-REVIEW.md`.
- R: one Sonnet worker per independent finding group (file ownership as above). After repairs re-run: the specs touching changed files, unit tests, tsc, native screens, and the app build. Not the whole suite again unless a repair touches `styles.css` emphasis block, `App.tsx` or `floating.ts` -- then the full Playwright suite once.
- Acceptance check: every finding has a disposition line in VALIDATION.md; re-runs exit 0.

## Validation (after all tasks, in order)
1. V steps 1-6 (above).
2. F review; R repairs; targeted re-runs as in R.
3. Owner hand check from VALIDATION.md in the new app.

## Risks and rollback
- Two shared files edited in parallel (`styles.css`, `App.tsx`): region ownership plus Edit-only; if a lane's edit lands in another lane's region, that lane reviewer rejects and the coordinator restores from the reviewer's diff.
- T5 changes how floating decides fit: worst case it floats where it overlaps. Guarded by the existing "never overlaps" specs plus T5's stop condition.
- Removing the fragment footer removes a feature; reversible from git (wave 5 is uncommitted -- keep a copy of `App.tsx` lines 1842-1864 in the T2 notes file).
- Rollback overall: nothing is committed; the owner can commit wave 5 first so wave 6 is a clean diff (see Open questions).

## Open questions for the user
1. Commit wave 5 before wave 6 starts? Default: yes, as its own commit (no Claude trailer), so wave 6 is reviewable and reversible on its own.
2. Rail variant (asked by T7a with screenshots). Default: Variant B.

## Notes for the implementer (traps, things NOT to do)
- Never `git stash/checkout/reset/clean`; never `rm -rf`; double-quote paths; register paths before editing.
- Every build and Playwright run takes the serial lock; pinned Node (`HANDOFF.md` Commands); private Playwright config and port per task; scratch specs under node_modules must be `.mjs`.
- `touch src-tauri/src/lib.rs` before any native or release build, or cargo reuses the old binary.
- Native runs need an unlocked, visible screen; use `caffeinate -dimsu`.
- Do not add a second hover rule; extend the one block (T1 owns it).
- Doc notes go to your `notes/<task>.md`, never straight into `docs/*.md` (V merges them).

## Amendment 1 (owner, 2026-11-03): every-state check in V and F
Owner approved adding a "design every state" check to the final check and the Fable review (decision "W6 every-state check in V and F"). No new lanes; defects found go to R.
- V (T233): add to the Chromium run and to `tests/native-screens.js` captures of: a long command name highlighted in the palette; a long project name hovered on the Projects screen (beside dates + trash) at 1100 and 1600; long section, note and source titles and their rail preview cards at the 190 px sidebar; the Notes tab with no notes; a rail group with 0 and 1 items; a project with no research; a source with no title or year in the rail preview; a toast raised while the citation card is open. Read every capture; list each in VALIDATION.md with pass/fail.
- F (T234): judge those captures alongside the diff (overflow, overlap, truncation that hides meaning, missing empty text, broken previews).
