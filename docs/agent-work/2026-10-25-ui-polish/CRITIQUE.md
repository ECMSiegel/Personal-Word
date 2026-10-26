# UI critique (T10, 2026-10-26)

Cycle 1: agent-fb4d (OpenCode), rejected by agent-f69a. Cycle 2: agent-7088 (Claude Code, Opus).
Status: CLAIMED pending independent review. Nothing here is VERIFIED; only the owner's real use does that.

Method: structured, severity-ranked critique (owner answer 4: the Design plugin stays off).
Severity follows the plan: High breaks a rule in `AGENTS.md` or WCAG; Medium is visibly
inconsistent with `docs/design-system.md`; Low is polish. References are the general public design
positions of iA Writer (ia.net/writer: typography first, almost no chrome), Ulysses and Bear
(calm content surfaces, a clear sidebar hierarchy). No specific screen of those apps is cited, and
nothing was downloaded. Measurements were taken in the browser with `getComputedStyle` /
`getBoundingClientRect` and the WCAG 2.1 contrast formula (log:
`node_modules/.cache/personal-word-beta/ui-t10/c2/capture.log`).

Screenshots in `screens/` (24 files): 20 browser at 1440x900, device scale 2, from private
`vite build`s of the working tree (cycle 1: `ui-t10/capture.spec.mjs`, port 1580; cycle 2:
`ui-t10/capture-c2.spec.mjs`, port 1586, built 05:05Z); 4 native WebKit at 1x from the isolated
`com.folio.smoke` build, Color palette, light (cycle 1). Cycle-2 captures were built from a tree
that already contains T089's in-review Projects centring (`library.css` changed 05:03Z) and T086's
in-review fade removal, so the Projects screens in them are vertically centred; cycle-1 Projects
shots show the earlier top-aligned layout.

What the pass confirms working (not findings): document typography untouched by the token sweep;
Q007 section tints render (Manuscript blue, Fragments green, Research orange); the Projects search
expands from the magnifier and filters; the create panel opens from the button and, once settled,
every item is full-contrast text (measured below); Color primaries pass AA (Start new project
white on `#0072EF` 4.51:1 light, on `#0074E8` 4.50:1 dark); the appearance setting drives real
light/dark in native WebKit; the four T6 captions are gone.

## Findings

One `###` section per "UI critique" board task that records a real finding, whether filed, in
review or already fixed (9). The board has 11 "UI critique" tasks: these 9 plus the two withdrawn
ones (T088, T093), which are listed after the findings without a `###` heading.

### UI critique (High): create-panel items near-invisible in light mode (T086) -- resolved by T086, not a settled-state defect
- Status: T086 is in review (agent-6c4d). Re-rated: the High rating was not earned by the evidence.
- Screen: Projects, create panel open. Screenshots (cycle 2, taken 500 ms after opening):
  `screens/browser-projects-create-light-plain.png`, `-light-color.png`, `-dark-plain.png`,
  `-dark-color.png`.
- What happened: cycle 1 screenshotted right after `toBeVisible()`, while the panel was still
  opening. The real cause was the item fade-in: items started at opacity 0 (`@starting-style`)
  and faded in over 220 ms after a 60 ms delay, while the clip-path morph also ran 220 ms. The
  frame caught items part-way through the fade (and, in light Color, the panel still clipped).
  Settled, items were always `--text`. T086 removed the item fade, so items are opaque from the
  first frame while the clip-path morph still reveals them.
- Measured on the cycle-2 build (all four combinations): first item opacity 1 at the moment the
  panel becomes visible and 500 ms later; item colour `rgb(36,36,40)` on `#FFFFFF` = 15.46:1
  (light), `rgb(237,237,240)` on `rgb(32,32,35)` = 13.91:1 (dark). All seven items identical.
- Remaining action: none beyond T086's review. Q008 (resolved by the coordinator) rested on the
  cycle-1 capture; no owner decision is needed.
- Files: `src/components/library.css` (T086's change).

### UI critique (Medium): Plain-dark primary button contrast 2.45:1 (pre-existing) (T087)
- Screen: any filled `.primary` in Plain dark. Screenshots: `screens/browser-dialog-save-dark-plain.png`
  (new-project title dialog, Save enabled) and `screens/browser-projects-dark-plain.png` (Start
  new project).
- What is wrong: measured white `rgb(255,255,255)` on `rgb(100,168,255)` (`#64A8FF`) = 2.45:1 for
  both the dialog Save and Start new project; WCAG AA needs 4.5:1 for this text size. This
  predates the palette work; the plan keeps Plain "exactly as today" and puts this out of repair
  scope, so it is recorded, not fixed.
- Reference: dark-mode filled buttons in Mac writing apps keep white text legible by darkening the
  fill, not lightening it.
- Suggested change (owner decision, because the plan says Plain stays as today): either let Plain
  dark use a darker fill for filled primaries only (the Color palette's `--accent-fill` `#0074E8`
  gives 4.50:1), or accept and document it in `docs/limitations.md`.
- Files likely involved: `src/styles.css`.

### UI critique (Low): Projects sparse state leaves a large blank region (T089)
- Status: T089 is in review (agent-fb4d: short libraries now centred vertically).
- Screen: Projects with one project. Screenshot (before T089): `screens/browser-projects-light-plain.png`;
  after T089: any cycle-2 `screens/browser-projects-create-*.png`.
- What was wrong: one row and the storage notice at the top, then empty page to the fold at
  1440x900; the screen read as unfinished.
- Reference: iA Writer's library keeps a short list visually anchored rather than stranded at the top.
- Suggested change: centre a short list block vertically, top-aligned once it scrolls (what T089 did).
- Files likely involved: `src/components/library.css`.

### UI critique (Low): native screenshots capture at 1x scale (T090)
- Screen: all four native. Screenshot: `screens/native-projects-light-color.png` (and siblings).
- What is wrong: `smoke_snapshot` captures 1240x840 at 1x, soft on Retina displays. Fine for review
  evidence, not for owner-facing design material.
- Suggested change: use a `WKSnapshotConfiguration` (or the screen's `backingScaleFactor`) for a
  2x capture.
- Files likely involved: `src-tauri/src/smoke.rs`.

### UI critique (Medium): sidebar entry word count is the same size as the entry title (T091)
- Screen: Writing, sidebar. Screenshots: `screens/browser-writing-light-plain.png` ("Opening 16 words")
  and `screens/browser-writing-focused-row-light-plain.png`.
- What is wrong: measured title `12px 600` and count `12px 600`; only colour separates them, so the
  row reads flat. Before the T1 token sweep the count was visibly smaller than the title
  (`node_modules/.cache/personal-word-beta/ui-t1/shots/before-writing-light.png` vs
  `after-writing-light.png`), so this is a regression of the 12 px floor, not of any one rule.
- Reference: Bear and iA Writer keep list metadata visibly quieter than titles.
- Suggested change: title at `--type-body` (13 px) with the count at `--type-small`, or keep both at
  12 px and drop the count to weight 400.
- Files likely involved: `src/styles.css`.
- Severity: filed Medium in cycle 1 and kept, since it is a regression against the design system's
  type roles (`--type-small` is for metadata, `--type-body` for normal text).

### UI critique (Medium): focused entry row's move arrows overlap the word count (T092)
- Screen: Writing, sidebar, keyboard-focused manuscript entry row. Screenshot:
  `screens/browser-writing-focused-row-light-plain.png` (row has the focus ring; the faint arrows
  sit on top of "words").
- What is wrong (measured): with the row focused, `.reorder` is shown (`:focus-within`,
  `styles.css` around :362) at x 219-255, y 237-265, while the count text spans x 189-249,
  y 244-259: a 30 px horizontal overlap. In the capture the arrows are disabled (one entry, so
  drawn at 0.35 opacity); with several entries they are enabled and draw at full strength over the
  text. Possibly pre-existing (agent-e034's note); not checked on the pre-polish tree.
- Reference: Ulysses-style row actions appear beside metadata, not over it.
- Suggested change: hide or fade the count while `.reorder` shows, or reserve the arrows' width in
  the row; add a browser assertion that the two boxes do not intersect.
- Files likely involved: `src/components/ProjectSidebar.tsx`, `src/styles.css`.

### UI critique (Medium): helper captions remain in Research and Settings; Zotero status text is 11 px (T094)
- Screens: Research and Settings. Screenshots: `screens/native-research-light-color.png` (caption
  visible in native WebKit), `screens/browser-settings-light-color.png`.
- What is wrong: the design system says "Do not add helper captions under controls". Still shown:
  "In Zotero, enable the local API in Settings > Advanced before refreshing." under Connect local
  Zotero (`ResearchPanel.tsx:871`); "Default startup opens Projects." under the restore-tabs
  checkbox (`App.tsx:1771`); the Goals explanation paragraph (`App.tsx:1840`; its "Current
  baseline" sentence is status, the rest is a caption). The Zotero status line uses inline
  `fontSize: 0.85em` = 11.05 px (measured), below the 12 px UI floor; `designTokens.test.ts` does
  not scan inline styles, so it was missed.
- Constraint: the Zotero hint was added on purpose by T033 (beta Gate B) and
  `tests/zotero.spec.ts:76` asserts its exact text, so the fix must keep the information (for
  example a keyboard-reachable tooltip on Connect local Zotero, or show it only while the status is
  "not yet contacted" or an error) and update that spec. Empty states ("No sources yet...", "No
  notes yet.") are not captions.
- Suggested change: tooltip or status-only placement per the caption rule; status text at
  `var(--type-small)`.
- Files likely involved: `src/research/ResearchPanel.tsx`, `src/App.tsx`, `tests/zotero.spec.ts`.

### UI critique (Medium): Settings Goals selects use unstyled platform controls (T095)
- Screen: Settings > Goals. Screenshots: `screens/browser-settings-light-color.png` (Chromium),
  `screens/native-settings-light-color.png` (WebKit).
- What is wrong: Goal scope and Goal day are bare `<select>`s (`App.tsx:1825,1831`) and no CSS file
  in `src` styles `select` (grep). Chromium draws default selects in the system font, not Futura;
  native WebKit draws rounded Aqua pop-up buttons with small system text. Both break the interface
  typeface and the flat, square-corner rule, right beside the app's own flat dropdowns and
  segmented controls. The number fields keep native steppers in WebKit.
- Reference: Mac writing apps keep one control style per settings pane.
- Suggested change: reuse `src/components/Dropdown.tsx`, or give `select` `font: inherit`,
  `appearance: none`, a 1 px `var(--line)` border, square corners and a chevron like the existing
  dropdown trigger.
- Files likely involved: `src/App.tsx`, `src/research/research.css` (Settings CSS lives there).

### UI critique (Low): sidebar labels wrap at the 190 px minimum width (T096)
- Screen: Writing, sidebar at its 190 px minimum. Screenshot:
  `screens/browser-writing-sidebar-190-light-plain.png`.
- What is wrong (measured): "Snapshots & history" wraps to two lines (button height 36 px vs 21 px
  for Comments and Read manuscript); the "Personal Word" heading also wraps, and the entry word
  count is hidden at this width. Pre-existing (noted during T076's review).
- Reference: Ulysses and Bear keep sidebar labels on one line and truncate.
- Suggested change: raise the minimum width to where fixed labels fit, or ellipsize with a tooltip.
- Files likely involved: `src/styles.css`, `src/components/ProjectSidebar.tsx`.

## Withdrawn (board tasks closed without a change)
- T088 "toolbar overflow composition changed after the spacing sweep": withdrawn. The cycle-1
  claim was unsupported: `ui-t1/shots/before-writing-light.png` and `after-writing-light.png` show
  the same toolbar icons in the same order and the same overflow split (compared by agent-7088),
  and agent-fb4d's measurement found no overflow at 1440 (26 visible controls). Approved as
  withdrawn by agent-7088; `src/editor/editor.css` unchanged.
- T093 "verify native search collapse-on-blur flicker": withdrawn as unverified and native-only
  (decision "T093 withdrawn by T083 cycle 2"); see "Not verified".

## Not verified
- Native only: clicking the Projects magnifier while the search field is open and empty may
  collapse it on blur and reopen it on click, because WebKit does not focus buttons on click
  (agent-463d). The browser build cannot show it and no native capture exists; T082's native pass
  or the owner can reopen it if seen.

## Browser vs native
- Settings > Goals > Deadline: Chromium shows an empty `mm/dd/yyyy` field with a calendar icon
  (`screens/browser-settings-light-color.png`); WebKit shows a segmented date with today's date in
  grey (`screens/native-settings-light-color.png`). Engine presentation of `<input type="date">`,
  recorded only; it falls under T095 if that task restyles the Goals controls.

## Candidates considered and dismissed
- T076 reviewer: "pin `--focus-ring` to `--accent-plain` in document areas": already fixed by T085
  (done): the pin rule sets `--focus-ring: 2px solid var(--accent-plain)` with a test.
- agent-5941 (markdown-roundtrip private-dist cwd quirk) and agent-563d (notice.spec load
  sensitivity): test infrastructure, not visual design; carried by the discoveries for T082.
- agent-d571 (native-screens ignores `FOLIO_SMOKE_PALETTE`): handled; the native set was taken with
  `--palette color`.
- T080 reviewer's `read_dropped_file` hardening ideas: backend robustness, not visual design.
- The other `research-hint` lines in `ResearchPanel.tsx` (lookup note, "No footnotes cite this
  source yet", "No sources yet", unlinked-footnote and notes explanations): empty states or status,
  except the Notes-tab line "Ideas and reminders..." which T094's fixer should judge alongside the
  captions above.

## Evidence files outside `screens/`
In `node_modules/.cache/personal-word-beta/ui-t10/`:
- `c2/` cycle-2 originals and `c2/capture.log` (all measurements quoted above); `capture-c2.spec.mjs`,
  `browser-c2.config.mjs`, `build-c2.log`.
- `c1-superseded/`: the two cycle-1 mid-animation create-panel captures (Color light/dark),
  replaced by settled ones.
- `c1-dropped/`: five cycle-1 browser variants removed from `screens/` to stay within 24 files:
  `browser-projects-light-color.png`, `browser-projects-dark-color.png` (the same screen in Color
  appears in the create-panel captures), `browser-research-light-plain.png`,
  `browser-research-dark-plain.png`, `browser-settings-dark-plain.png` (palette variants of
  surfaces kept in Color, and Settings light Plain is kept).
- `extra/`: cycle-1 Plain create and search captures; the two create ones are mid-animation and
  superseded by the cycle-2 Plain create captures in `screens/`.
- `native-color/`: the full cycle-1 native Color light and dark set (8 PNGs); `screens/` holds the
  light four. The native set predates T086 and T089, but neither change touches a screen the
  native set captures except the Projects layout (T089), which the native Projects shot shows in
  its earlier top-aligned form.
- `measure*.{spec.mjs,log}` (agent-fb4d, T088), `t089*`, `shots-t089/`, `build-t089.log`
  (agent-fb4d, T089, written here after this folder was registered to T083 cycle 2; left in place).
