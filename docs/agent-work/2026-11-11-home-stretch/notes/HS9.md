# HS9 -- Top-level sections beside Manuscript (T300)

## What changed
- `src/organization/groups.ts` (new) owns every rule: `groupOf` (unknown/missing id = Manuscript),
  `topGroupOrder`, `manuscriptGroupOrder`, `normalizeOrder`/`normalized` (same array/object back when
  nothing moves; always for a project with no custom sections), `addGroup`, `renameGroup` (built-ins
  write `groupTitles`; empty or default name removes the key), `deleteGroup` (entries move to
  Manuscript, key/sidebarOrder cleaned), `moveEntryToGroup` (last in target), `addSectionEntry`
  (optionally below an entry), `reorderInGroup` (index within the section).
- `src/model.ts`: additive `Project.groups`, `Project.groupTitles`, `Entry.group`; `validateProject`
  shape-checks them (array of {id, title} with non-empty unique ids that are not built-in ids; titles
  keyed only by manuscript/fragments/research; `group` must be a string) and never rejects an unknown
  group id. No Rust code change; one round-trip fixture addition in the Rust additive-metadata test
  (`src-tauri/src/store.rs`, groups/groupTitles/group) -- cargo NOT run.
- `src/App.tsx` (shared, regions): `mutate` stores `normalized(change(p))` (so every edit keeps
  `project.order` grouped by sidebar order); `add(kind, group?, after?)`; `reorder` uses
  `reorderInGroup`; new `addTopSection`, `renameTopSection`, `deleteTopSection` (confirm + safety
  snapshot "Before deleting section ..."); `onMoveToGroup`; palette entry "New top-level section".
- `src/components/ProjectSidebar.tsx`: custom sections render like Manuscript
  (`data-group-kind="manuscript"`, FileText icon, tint), each with its own drag scope (`DragScope`),
  collapse, list/card view, heading move/drag, open-heading highlight, search filter, Read scroll-spy.
  Heading menu adds New section / New top-level section / Rename / Delete (custom only). Row menu adds
  New section below and Move to <section>. Each entry row has a hover/focus "More actions" button
  (inside `.reorder`, `icon-grow`). A "New top-level section" row closes the sections area, and a
  right-click on empty space there offers the same.
- CSS: `src/styles.css` tint selectors extended with `[data-group-kind="manuscript"]`; a small rule
  keeps the "+" visible on manuscript-type headings while the view toggle stays hover-revealed.
  `src/components/scrollspy.css` rail selector extended.
- AGENTS.md: the "appear on hover" sentence now names the always-visible "+"; one line on custom sections.
  `docs/design-system.md` NOT updated: registration refused (owned by T294). Needs the same sentence.

## What the owner sees
A "New top-level section" row under Research (and in right-click on empty sidebar space, heading
menus and the command palette). New sections look like Manuscript, have their own always-visible "+",
and their entries read and export after (or before, if moved up) Manuscript's, in sidebar order.

## Limits
- No group headings inside Read or exports; no per-section colour; no drag across sections (menu does it).
- The name dialog refuses an empty value, so "restore default" is done by typing the default name.
- Whole-version / passage restore do not renormalise order until the next edit; orphaned entries
  always show under Manuscript.

## Hand check
1. Open a project, click "New top-level section", name it "Part two".
2. Use its "+" to add two sections, type text in each. 3. Right-click its heading > Rename.
4. Read manuscript: Manuscript text first, then Part two. Export > Plain text: same order.
5. Row "..." button on a Manuscript entry > Move to Part two. 6. Heading menu > Delete: entries return
   to Manuscript; Snapshots shows "Before deleting section ...". 7. Rename Manuscript, then type
   "Manuscript" to restore it.

## Later adjustments and results
- Row menu order: Open, Open beside, Rename, Move up, Move down, New section below, Move to ..., Delete
  ("New section below" after the moves keeps the existing keyboard-navigation spec unchanged).
- More button: DOM after the split icon (Tab reaches the split icon first, as before; split-view spec
  unchanged), drawn left of it with `order: -1`. Cards view: one hover/focus padding rule in styles.css
  (cards region) so the title clears both icons.
- Deleting a section keeps its entries' place in the reading order (if it sat above Manuscript they come first).
- Results: vitest groups+model+hoverEmphasis+motion+designTokens 110/110; full vitest 1301/1303 (2 export
  timeouts under load, pass alone 36/36); tsc clean. Playwright (port 1439, serial lock): hs9 3/3, w9-cards,
  sidebar-context-menu, split-view green in final runs; sidebar-rename/search/selection, drag-reorder,
  scrollspy, alignment, appearance passed in the earlier run (87 passed; that run predates only the
  menu-item reorder and More DOM move). floating.spec "Read manuscript ... starts at the top" failed --
  that is HS6's in-progress test (T297), not touched here.
- No "before" baseline of the existing sidebar specs: the lock was not free until after the edits.
- Existing assertions changed: tests/sidebar-context-menu.spec.ts line ~106 (section row items) and
  ~227 (Manuscript heading items). cargo test needed (store.rs fixture lines added, not run).

## Rework after REVIEW-2 (agent-fe44)
1. Sidebar top order: when App owns it (`onGroupOrder`), only `props.groupOrder` is used, never the
   session-local order, so a restored version without a saved order cannot leave the sidebar disagreeing
   with Read/export. New spec case: snapshot, move heading, restore, sidebar order == export == Read.
2. Row More button is now first in the DOM (no `order: -1`): Tab order matches the drawing.
   tests/split-view.spec.ts "open beside" now Tabs twice from the fragment row (only that line changed).
3. Heading menu "Reset name" appears only while a built-in heading has a custom name (drops its groupTitles key).
4. Cards: the whole-button hover padding is undone in cards and the room for the icons is reserved on the
   one-line title span on hover, so body text never re-wraps and no card moves. New spec case with 3-14 word bodies.
5. docs/design-system.md: always-visible "+" sentence; top groups now include custom sections.
Fail-first: notes/HS9-rework-fail-first.txt (4 of the new/changed cases failed before the fix). The card case
was then rewritten to measure relative to the hovered card (the first version counted scroll-into-view as a
shift); that relative version was not re-run against the old CSS.
Results: tsc clean; vitest groups+model+hoverEmphasis+motion 98/98; Playwright hs9 5/5 (final), and
sidebar-context-menu, w9-cards, drag-reorder, sidebar-selection, split-view all passed (89 passed, 4 skipped,
the only failure was the card case before the scroll fix).
