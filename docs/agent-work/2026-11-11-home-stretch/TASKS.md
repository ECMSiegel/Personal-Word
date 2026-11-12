# Home-stretch task sections

Read BRIEF.md first, then ONLY your section here. Line numbers come from a code read on 2026-11-11:
verify before relying on them. "SHARED" files are being edited by other workers right now.

### HS1 Export menu opens above the format bar
Symptom: the Export dropdown in the top bar (rows PDF, Markdown, Markdown with images (.zip), Plain text,
Export settings..., Complete project (.json)) is painted BEHIND the editor's format bar; its top rows are hidden.
Likely cause: src/components/popover.css gives `.popover` z-index 40; `.writer > .format-bar`
(src/editor/editor.css ~103) is also position:relative z-index 40 and is later in the DOM, so it wins.
Menu: src/export/ExportMenu.tsx, class `export-menu`.
Fix: smallest change, preferably `.export-menu.popover { z-index: 41 }` in src/export/export-menu.css (stays
below command palette 60 and modals 70). If Snapshot/Saved popovers in the same bar have the same problem,
fix them the same way and say so.
Test first: tests/hs1-export-menu.spec.ts -- entry open in the editor (copy setup from
tests/editor-toolbar.spec.ts), open Export, assert every menu row is the topmost element at its centre
(document.elementFromPoint returns the row or a descendant).

### HS2 Line-spacing popover: drop "pt", align the boxes
Symptom: rows "Custom" [box], "Space before" [box] pt, "Space after" [box] pt; the Custom box does not line
up because of the trailing "pt". Owner wants "pt" removed and the three boxes the same width and right edge.
Where: src/Writer.tsx ~1708-1752 `case "spacing"` (SHARED): Custom uses `<NumberInput width={64}/>`; the other
two wrap `<NumberInput width={56}/>` plus literal `pt` in `<span className="toolbar-field-unit">`.
CSS: src/editor/editor.css ~312-325 `.toolbar-field`, `.toolbar-field-unit` (SHARED).
Fix: remove the `pt` text and the unit wrappers, width 64 on both, keep the `${n}pt` values written to the
document unchanged, put the unit into the aria-labels ("Space before, points"). Remove the
`.toolbar-field-unit` rule only if nothing else uses it (grep src and tests).
Test first: tests/hs2-spacing.spec.ts -- open the popover, assert the three number inputs have equal width
and equal right edge (0.5px) and no standalone "pt" text. Grep tests/ for assertions your change
legitimately breaks; update only those and list them.

### HS3 Square checkboxes everywhere
Symptom: every checkbox is the stock rounded macOS control; the design system demands square corners.
Where: global rules src/styles.css ~495-515 (SHARED) (`input[type="checkbox"] { accent-color }`, focus ring;
~501 excludes checkboxes from the field border). Per-context: src/research/research.css ~68-71 and ~493-500
(14x14), src/editor/editor.css ~38-42 `.prose-check-panel` 16x16 (SHARED), src/components/prose-issues.css
~3-5, src/organization/organization.css ~33-35. Sites: organization/CommentsPanel.tsx, Writer.tsx ~1812,
App.tsx ~2172, organization/FragmentLibrary.tsx, research/CslImportPreview.tsx (inline styles),
settings/GeneralSettings.tsx, research/ResearchPanel.tsx, components/ProseIssues.tsx,
research/BibliographyPage.tsx, export/ExportPanel.tsx. No radios or switches exist.
Fix: ONE global rule in src/styles.css replacing the accent-color rule: appearance none (+ -webkit-), 14px
box, 1px solid border in a token colour clearly visible in both themes, border-radius 0, paper/surface
background; `:checked` fills `var(--accent)` with a crisp check mark from a pseudo-element (legible on the
accent in both themes); `:indeterminate` only if a site uses it; `:disabled` uses the disabled-opacity token;
keep the focus ring; no new motion. Reconcile the per-context overrides to 14px, keep their margins, nothing
may reintroduce a radius or native look; label text stays vertically centred with the box. Add ONE line to
docs/design-system.md near "Checkboxes use the accent" (~121).
Test first: tests/hs3-checkbox.spec.ts -- on Settings (General), Export settings, and one more site assert
appearance none, border-radius 0px, 14x14, and that checking changes the background to the accent. A vitest
guard scanning src/**/*.css for a checkbox rule with a non-zero radius is welcome. Take light and dark
screenshots into notes/ and LOOK at them. Also run src/hoverEmphasis.test.ts and src/motion.test.ts.

### HS4 Docked sidebar header lines up with the main pane
Symptom: in the docked (not floating) sidebar the title and the "Find in project" row sit ~12px lower than
the main pane's rows. Owner wants the sidebar title centred on the line of the top bar (the bar showing the
entry name, e.g. "Opening") and the search row centred on the line of the format bar (undo/redo, "100%").
Read (verify in the browser): `.sidebar-shell .sidebar` padding 16px 12px 0 (src/styles.css ~1568);
`.sidebar-title-row` (~1609) min-height 32px, centre ~32px; `.search` (~1632) margin 12px 0 16px, ~24px tall,
centre ~72px. Main pane: `.topbar` 40px + 1px border (~2096), centre 20px; `.writer > .format-bar` 40px + 1px
border (src/editor/editor.css ~103-120), centre ~61px.
Fix: CSS only, sidebar-header rules of src/styles.css (SHARED), scoped to the docked sidebar: floating
(`.is-floating`, src/components/floating.css) and overlay sidebars must not change. Title row occupies the
same 40px(+1px) band as `.topbar`, search row the same 40px band as the format bar, content vertically
centred. Prefer matching heights/centres without adding new border lines unless the design-system sidebar
section allows them; say which you chose. Left edges stay aligned with the section headings below. Views
without a format bar (Settings, Comments, Read) just keep the same positions. Check the narrow sidebar and a
destination title such as "Comments".
Test first: tests/hs4-sidebar-align.spec.ts -- entry open, sidebar docked: |centreY(title) - centreY(.topbar)|
<= 1px and |centreY(search input) - centreY(.format-bar)| <= 1px; plus a floating-mode case asserting the
floating title position is unchanged (record the value before your fix). Run tests/alignment.spec.ts and
tests/sidebar-*.spec.ts before and after; report pre-existing failures separately. Before/after screenshot
into notes/ and LOOK at it.

### HS5 Text typed after a page break keeps the font and size
Symptom: after inserting a page break, typed text falls back to the default font.
Likely cause: fonts are the Tiptap mark `textFormat` (fontFamily/fontSize, src/editor/formatting.ts). Page
break is atom block node `pageBreak` (formatting.ts ~92-110). Both insert sites -- Shift-Enter in
src/editor/pageBreakKeys.ts ~25-28 and the Page setup "Insert page break" handler in src/Writer.tsx
~1910-1920 (SHARED) -- do `.insertContent([{type:"pageBreak"},{type:"paragraph"}])`: an empty paragraph with
no marks and no stored marks.
Fix: carry the marks active at the cursor (stored marks if set, else `$from.marks()`) to the new paragraph as
stored marks, so the next typed character has the same textFormat and bold/italic, as Enter does. Also carry
paragraph attrs Enter would carry (line spacing, alignment, indent) if the new paragraph visibly loses them;
say what you carried. ONE shared helper (in pageBreakKeys.ts or a small file beside it) used by both sites.
Test first: vitest beside pageBreakKeys (see how other editor tests build a headless editor with the app
schema): set a textFormat font and size, type, insert a page break, type, assert the text after the break
has the same attrs. Cover cursor at end and mid-paragraph, and that one undo removes the break cleanly.
Then `npx vitest run src/editor`. Playwright optional.

### HS6 Floating sidebar in Read manuscript
Symptom (owner screenshots, Floating sidebar on, Read manuscript view): the sidebar's project title starts
about 400px down the window; the "Manuscript" heading is missing and only its entry rows show; a small
stray dash sits at the sidebar's right edge under the search row. In the editor the floating sidebar is fine.
Hypothesis (reproduce first): src/components/floating.ts `documentEdges()` (~106-127) uses, for read, the
first `.manuscript-read .read-prose`, and top = `bar?.getBoundingClientRect().bottom ?? r.top` (~116). Read
has no `.format-bar`, so top is the first prose block's top, far down the page. It re-measures only on
resize/floatKey change, not when the reader (`.manuscript-read`) scrolls. The squeezed box leaves
`.sidebar-groups` a sliver; its scroll-fade mask (src/components/scroll-fade.css) probably hides the heading;
the dash is probably a scroll-spy marker (src/components/scrollspy.css `.spy-rail`). Wiring: src/App.tsx
~2024-2060 (SHARED), src/components/ProjectSidebar.tsx ~603-609, src/components/floating.css.
Fix: in Read the floating sidebar starts at the top of the reading area and runs to the footer, as in the
editor; horizontal fit is judged against the reading column so it never overlaps text (else the normal panel
shows). The Manuscript heading must be visible; no clipped or orphaned marker (if the dash is a legitimate
marker beside a visible heading, leave it; if an artefact, fix its cause). Prefer floating.ts/floating.css;
an App.tsx change must be a tiny region edit and reported. Editor-mode behaviour must not change.
Test first: add Read cases to tests/floating.spec.ts: wide viewport, several sections with text: title top
within ~60px of the reading area's top, "Manuscript" heading visible, no overlap with `.read-prose`, sidebar
stays put after scrolling the reader; and a narrow viewport falls back to the normal panel. Before/after
screenshots into notes/ and LOOK at them. Run all of tests/floating.spec.ts and the floating unit tests
before and after. Notes must say what the dash actually was.

### HS7 "Sans" document font follows the interface font
Owner: "The default font on a project should be the same as the chosen interface font."
Facts: per-project `DocumentSettings.font: "serif"|"sans"|"mono"` (src/research/types.ts ~73-90; default
serif; Blank template sets sans in src/templates.ts ~30-36). src/Writer.tsx ~330-335 (SHARED) maps it to a
stack: serif -> Times New Roman, mono -> Courier New, else hard-coded "Futura, system-ui, sans-serif";
exposed as `--document-font` (~1124), used by src/editor/editor.css ~710 with a Futura fallback ~545 (SHARED).
Other hard-coded Futura document-text sites: src/styles.css ~1953-1960 `.writing-surface`, `.read-prose`
(SHARED), src/organization/fragments.css ~99, reader defaults src/App.tsx ~313 and ~2641 (SHARED). Toolbar
font box shows `getAttributes("textFormat").fontFamily ?? defaultFont` (Writer.tsx ~1147). Interface font:
localStorage `folio.workspace.interfaceFont`, `setInterfaceFont`/`useInterfaceFont()`/`initFonts()` in
src/fonts/registry.ts, CSS var `--ui-font` (default styles.css ~223), picker src/settings/AppearanceSettings.tsx.
Decision (owner approved): "sans" now MEANS the interface font. No new value, no migration, keys unchanged.
For a sans project the editor, Read view, fragments and the toolbar's default-font label use the current
interface font and update live when it changes. Serif and mono unchanged. Logo (`.brand`) stays Futura.
Do: replace the hard-coded document-text Futura stacks (useInterfaceFont() in JS, var(--ui-font) in CSS, sane
fallbacks). Grep other "Futura" literals in src and classify each (interface/logo: leave; document default:
change); list them in notes. Relabel the sans option of the "Export typeface" dropdown
(src/export/ExportPanel.tsx ~67-81) truthfully.
Exports: read src/export/fontSource.ts, src/export/pdf.ts ~65-130 and the body-font embedding rules.
PDF/Word export of a sans project uses the interface font ONLY through the mechanism that already exists for
named/embedded fonts, with the existing fallback; if nothing fits without new machinery, leave export as is,
keep the dropdown/help text honest, and report it. Serif/mono export output must not change at all.
Test first: vitest for the mapping (extract a pure function, e.g. src/editor/documentFont.ts): sans +
"Avenir Next" starts with Avenir Next; serif/mono unchanged. tests/hs7-document-font.spec.ts: set a
non-Futura interface font, open a Blank project, computed font-family of editor body text and Read prose
starts with it; a Chicago (serif) project is unaffected. `npx vitest run src/export` before and after.

### HS8 Page number position option
Owner found no way to add page numbers. Today: a "Page numbers" checkbox only in Export settings; number is
always bottom-right in PDF and Word. Owner chose the SMALL option: surface page numbers in the editor's Page
setup popover with a position choice. No header/footer text and NOTHING drawn on the on-screen pages.
Facts: `DocumentSettings.pageNumbers: boolean` default true (src/research/types.ts ~78, ~89). Checkbox
src/export/ExportPanel.tsx ~140-157. PDF src/export/pdf.ts ~594-603 (x = paperWidth - margin - 10,
y = margin/2, size 10; Chicago starts at 0 and skips the title page). Word src/export/docx.ts ~318-345
(Footer, right-aligned PageNumber.CURRENT; Chicago titlePage:true, start 0). Page setup popover: the case in
src/Writer.tsx that renders "Insert page break" (~1900-1920) (SHARED).
Build:
1. Optional additive `pageNumberPosition`: "top-left"|"top-center"|"top-right"|"bottom-left"|
   "bottom-center"|"bottom-right"; absent = bottom-right so old projects export byte-for-byte as before.
   AGENTS.md "Preserve writing" applies: find how DocumentSettings is normalised, archived/imported and stored
   natively (check src-tauri/src for any allowlist of document-settings keys); the field must round-trip;
   unit test the round trip. Rename nothing.
2. Page setup popover: "Page numbers" checkbox (same field) and, when on, a "Position" select with six plain
   labels ("Top left" ... "Bottom right"), in the popover's `.toolbar-field` row style, plus one muted line
   "Shown in PDF and Word exports." Keyboard accessible. Plain `<input type="checkbox">`, no local styling
   (HS3 restyles checkboxes globally).
3. ExportPanel.tsx: the same Position select beside the existing checkbox.
4. pdf.ts: draw at the chosen position (top = mirror of the current bottom offset in the top margin;
   left/center/right against the text-block margins; measure text width). docx.ts: top = Header, bottom =
   Footer, matching alignment. Keep Chicago's skip-title-page and start-at-0 for every position. Markdown,
   plain text and print preview must ignore the field harmlessly.
Test first: unit tests beside the pdf/docx export tests -- "top-center": PDF number drawn in the top margin,
centred; docx has a Header with a centred PAGE field and no page-number Footer; absent/default identical to
current output. tests/hs8-page-numbers.spec.ts: Page setup -> toggle, choose "Top center", value kept on
reopen and in Export settings. `npx vitest run src/export src/research` before and after. If you touch Rust,
do NOT run cargo; report that cargo test is needed.

### HS9 Top-level sections beside Manuscript (add, rename, delete, move entries)
Owner: "I want the ability to create a section on the same level as Manuscript ... Should just be able to add a
manuscript section, not a fragment style or research style. Need to be able to rename sections as well in a
drop down." Owner decision: contents of new top-level sections ARE part of Read manuscript and exports, in
sidebar order. Research (code read 2026-11-11, verify): no group abstraction exists; Manuscript = `project.order`
mapped to entries (src/components/ProjectSidebar.tsx ~289-294); `collapsibleGroups`, `labels`, icons, tints and
the `group()` function (~610-995) hard-code the three ids. TS `validateProject` (src/model.ts ~133-278) and Rust
(src-tauri/src/store.rs ~538, ~1065, ~1091) require `kind` in section|fragment and `project.order` == exactly
the set of section ids; unknown fields round-trip natively through `#[serde(flatten)] extra`, the save queue,
snapshots and the project archive. Read, exports, word counts, footnote numbering, the command palette and the
native manuscript.txt mirror all iterate `project.order`.

Design (do not change it; if the code contradicts it, `block` and report):
1. Data: additive optional `Project.groups?: { id: string; title: string }[]` (custom top-level sections) and
   `Entry.group?: string` (id of its custom section; absent = Manuscript). Entries stay `kind: "section"` and
   stay in `project.order`. NO new kind, NO Rust code change, no key renames. Also additive optional
   `Project.groupTitles?: Record<string,string>` holding a display name for the built-in headings
   ("manuscript" | "fragments" | "research") when the owner renames them.
2. One pure module src/organization/groups.ts (+ groups.test.ts) owning all rules:
   - `groupOf(project, entry)`: unknown/missing group id => Manuscript (orphans are never invisible).
   - `manuscriptGroupOrder(project)`: the manuscript-type sections ("manuscript" + custom ids) in sidebar order
     (project.sidebarOrder where present, new ones appended).
   - `normalizeOrder(project)`: returns project.order re-sequenced so entries are grouped by
     manuscriptGroupOrder, keeping relative order inside each group. EVERY mutation that changes groups,
     sidebar order of these sections, an entry's group, or adds/reorders a section entry must store the
     normalised order. This is what makes Read, exports, footnotes and manuscript.txt follow sidebar order
     with no change to those consumers. A project with no custom groups must come out byte-identical.
   - addGroup / renameGroup / deleteGroup (its entries move to Manuscript, nothing is deleted) /
     moveEntryToGroup / reorder-within-group helpers, all immutable.
   - `validateProject`: tolerate and shape-check the new fields (array of {id,title non-empty}, unique ids);
     never reject an entry whose group id is unknown.
3. Sidebar (ProjectSidebar.tsx): custom sections render exactly like Manuscript (same icon, same tint -- add a
   CSS hook such as `data-group-kind="manuscript"` so src/styles.css ~2282-2295 and src/components/scrollspy.css
   ~18 tint rules cover them), each listing only its own entries; Manuscript lists only ungrouped/orphan
   entries. Collapse, list/card view, heading move up/down and drag, row drag-reorder within the section, the
   "open" heading highlight (only the section that really holds the open entry lights), Find in project
   filtering, and the Read-mode scroll-spy/active marker must all work per section. Its "+" adds an ordinary
   entry INTO that section (`add("section", groupId)`).
4. Controls (every one keyboard reachable, existing ContextMenu/menuProps and `setNameDialog` reused):
   - Right-click a top-level heading: existing items plus "New section" (entry in that section, manuscript-type
     headings only), "New top-level section", "Rename" (all headings; built-ins write groupTitles, and an
     empty/unchanged name restores the default), and for custom ones "Delete" (danger; confirm via the
     existing `setChoice` pattern with a safety snapshot; text says its entries move to Manuscript).
   - Right-click empty sidebar space in the sections area: "New top-level section".
   - A visible control to add a top-level section at the end of the three-section area, styled like the
     existing quiet sidebar rows (read docs/design-system.md; no fill, no new hover rule).
   - Entry row menu: add "New section below" and "Move to <section title>" for each other manuscript-type
     section. Each entry row gets a hover/focus-revealed "more" button opening the same row menu (so Rename is
     discoverable); it must not shift neighbours and must use the existing icon-magnify hover, no new rule.
   - The "+" on manuscript-type headings is always visible (owner approved; this deliberately relaxes the
     "appear on hover" rule for these headings only -- update that sentence in AGENTS.md and
     docs/design-system.md accordingly). View toggles stay hover-revealed.
   - New command-palette action "New top-level section".
5. App.tsx (SHARED, region edits): handlers + props; places that light or open "manuscript" for a section
   entry must still work for entries in custom sections; whole-version snapshot restore and passage restore
   must leave no invisible entry (orphan fallback covers it -- add a test). "Save as template" may ignore groups.
6. Out of scope: group headings inside Read/exports, per-section colours, renaming via the Settings page,
   dragging an entry across sections (the menu does that).
Test first: src/organization/groups.test.ts (normalizeOrder incl. the no-groups identity, orphan fallback,
delete moves entries, move/add keep order valid against validateProject); model round-trip tests (validate,
project archive export/import, save-queue header) for the new fields; one assertion line in the Rust
additive-metadata test (src-tauri/src/store.rs ~1915-1960) for `groups`/`group` -- do NOT run cargo, report
that cargo test is needed. tests/hs9-top-level-sections.spec.ts: add a top-level section, add two entries to
it, rename it, see it survive reload; Read manuscript shows Manuscript entries then the new section's entries;
plain-text export order matches; move an entry to it from Manuscript; delete it and see its entries under
Manuscript; rename "Manuscript" and restore the default. Existing pins you will legitimately change:
tests/sidebar-context-menu.spec.ts ~225-249 (heading menu items) and ~106/~201 (row menu items) -- update
only those assertions and list them. With no custom sections every other existing sidebar spec must pass
unchanged: run tests/sidebar-*.spec.ts, tests/drag-reorder.spec.ts, tests/scrollspy.spec.ts before and after.
Tool-call cap for this task: 110 (it is the large one); hand off with a precise note if not done by then.

### HS10 Small repairs from REVIEW-1 and worker notes
Three independent small repairs. Read REVIEW-1.md (same folder) sections for HS5 and HS8 first.
1. src/editor/pageBreakKeys.ts ~14 (`insertPageBreak`): a link (or any non-splittable mark) at the cursor is
   carried past the page break; plain Enter would not carry it. Carry only splittable marks: filter the marks
   through `editor.extensionManager.splittableMarks` (verify the API in the installed Tiptap version; marks
   such as link/comment anchors must not carry, textFormat/bold/italic must). Test first in
   src/editor/pageBreakKeys.test.ts: cursor at the end of linked text, insert page break, typed text is not a link
   but keeps the font.
2. src/App.tsx ~1929 (SHARED, tiny region; the `onDocumentSettingsChange` handler added by HS8): on a project that
   has NO saved document settings, the first Page setup "Page numbers"/"Position" change writes the full defaults
   object, which flips the editor to serif 12 double-spaced. Fix: changing page numbers must change only
   `pageNumbers` / `pageNumberPosition` and leave everything the owner sees unchanged. Find how the editor derives
   its effective settings when `documentSettings` is absent (template? `defaultDocumentSettings`?) and merge onto
   THAT effective value, or store only the changed keys if the readers already merge with defaults -- pick the
   smaller correct one and say which. The existing margin control has the same flaw: fix it the same way only if
   it is the same handler/one-line change; otherwise leave it and report. Test first: a unit or Playwright case
   -- project without document settings, toggle page numbers in Page setup, editor font/size/line spacing
   unchanged (computed style before == after).
3. src/export/ExportPanel.tsx ~77: `{ value: "sans", label: "Arial" }` is no longer truthful. Change the label to
   "Sans (Arial in Word, Noto Sans in PDF)". If the panel's help text names Arial for sans, make it agree. Update
   any test that pins the old label and list it.
Files you own: src/editor/pageBreakKeys.ts, src/editor/pageBreakKeys.test.ts, src/export/ExportPanel.tsx, your
test files; src/App.tsx by tiny region. Run `npx vitest run src/editor src/export`, `npx tsc -b`, and your
Playwright spec plus tests/hs8-page-numbers.spec.ts under the lock.

### HS11 Four failures from the full built-app e2e run
Full run: 600 passed, 5 failed (one was load flake). Logs: test-results/hs-validation/e2e.log and rerun5.log,
error contexts under test-results/hs-validation/rerun5/. The suite ran with `PLAYWRIGHT_PREVIEW=1` (built app in
dist/), which is how validation runs; worker runs used the dev server. Before this batch the suite was 583/0.
Root-cause each one before changing anything; say what the cause was.
1. tests/hs1-export-menu.spec.ts:5 -- in the built app "Export settings..." is NOT the topmost element at its
   centre (other rows may be fine). Find what covers it (elementFromPoint at that point; check whether the row is
   outside the viewport, under the sticky ruler strip, under another popover layer, or whether the built CSS
   order differs from dev so `.export-menu.popover { z-index: 41 }` loses). If the menu really is still partly
   hidden for the owner, fix the app (owner's report: the Export dropdown is behind the bar); if only the test is
   wrong (e.g. row scrolled out of view), fix the test. Either way the spec must pass in BOTH dev and preview.
2. tests/hs7-document-font.spec.ts:27 -- the test does `import("/src/fonts/registry.ts")` in the page, which
   only exists on the dev server. Rewrite it to change the interface font through the real Settings UI (see how
   tests/w9-fonts.spec.ts does it) so it runs against the built app.
3. tests/popover-bounds.spec.ts:178 -- "Prose check height changed" by 5px: HS3 made checkboxes 14px (were 16px in
   `.prose-check-panel`). This is an intended change. Re-record ONLY the baselines that this batch legitimately
   changed (Prose check; probably Line spacing after HS2 removed "pt"; Page setup after HS8 added two rows) --
   the test stops at the first mismatch, so iterate. Find how the baseline was re-recorded last time
   (docs/agent-work/2026-11-11-owner-fixes/ notes for T282/T286 mention it). Any popover whose placement changed
   that this batch did NOT intend is a finding: report it, do not re-record it.
4. tests/w9-fonts.spec.ts:72 -- REGRESSION: after choosing "Trebuchet MS" in the toolbar font box and typing
   "Trebuchet specimen", the span contains "ebuchet specimen": the first two keystrokes are lost (or typed
   without the mark, or eaten by something else). Reproduce, then find which change caused it: candidates are
   HS7 (defaultFont from the interface font, Writer.tsx font box), HS10 item 4 (font box label for System), HS5/
   HS10 (stored marks / pageBreakKeys), HS9 (sidebar focus handling). Check where focus is right after the option
   click and where the first two characters go. Fix the cause in the app, not the test; add or keep a test that
   pins it. The owner types right after picking a font, so this matters.
Files: the four spec files, tests/popover-bounds baseline data, and whichever source file the root causes point
to (register with `files add`; shared files by tiny region). Run each fixed spec in BOTH modes under the lock:
dev (`PLAYWRIGHT_PORT=<port> npx playwright test <spec>`) and preview (`PLAYWRIGHT_PREVIEW=1 PLAYWRIGHT_PORT=1420
npx playwright test <spec> --trace off`; preview serves dist/, so after any src change run `npm run build`
first -- allowed for THIS task only, inside the lock). Then run tests/editor-toolbar.spec.ts tests/w9-fonts.spec.ts
tests/popover-bounds.spec.ts tests/hs*.spec.ts in preview. Tool-call cap 80.

### HS12 Toolbar buttons return focus to the editor at once
Owner approved fixing the two findings of REVIEW-5.md (T302 part); read that part and notes/HS11.md first (HS11
fixed the same gap for the Font family / Paragraph style dropdowns with `editor.view.focus()` right after the
command's `.run()`; tests/hs11-font-focus.spec.ts pins it by clicking and checking focus in the same step).
1. src/Writer.tsx ~1406-1440: the font size "+" and "-" buttons never return focus to the editor, so typing right
   after clicking them is lost. After the click the editor must have focus with the selection unchanged and the
   new size applied to what is typed next (and to the selection if there is one).
2. src/Writer.tsx ~1173-1280 and ~1608-1651: Bold, Italic, list, quote, undo/redo, table (and any sibling icon
   button that runs an editor command) use Tiptap's `.focus()`, which waits one animation frame; a key typed in
   that frame lands on the button. Put `editor.view.focus()` in the SHARED icon-button handler (one place), not
   per button. Audit every other toolbar control that runs an editor command (alignment, indent, colour, link,
   line-spacing presets, zoom excluded since it is not an editor command) and list in your notes which already
   focus synchronously, which you fixed, and which deliberately keep focus elsewhere (a popover that stays open
   to accept more input, e.g. number boxes, must NOT steal focus while the user is still in it).
Must not change: keyboard activation (Enter/Space on a toolbar button must not type that key into the document),
the toolbar's roving/arrow-key navigation and the magnifying dock, popovers that stay open, split view (the
toolbar drives the focused pane's editor), read-only states, undo history (no extra history step).
Test first: extend tests/hs11-font-focus.spec.ts (register it) with cases that click a button and assert in the
same step that document.activeElement is inside the editor: font size + and -, Bold, a list button, Undo; plus
one keyboard case (focus Bold, press Space, editor text unchanged, bold toggled). They must fail before the fix
(save output to notes/HS12-fail-first.txt). Then run, under the lock, in dev AND preview (`npm run build` first,
inside the lock, allowed for this task): tests/hs11-font-focus.spec.ts tests/editor-toolbar.spec.ts
tests/w9-fonts.spec.ts tests/popover-bounds.spec.ts tests/split-view.spec.ts and any spec grep finds for
"toolbar" keyboard navigation. `npx tsc -b`, `npx vitest run src/editor`. src/Writer.tsx is the only source file;
nobody else is editing. Tool-call cap 45.
