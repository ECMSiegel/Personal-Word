# IDEAS -- UI wave 8 (ideation, 2026-11-05)

Owner request (verbatim subjects): Research panel, Settings, Motion, Projects page. See the
chat turn of 2026-11-05 for the bullets. Status: PARKED for wave 8 (owner, 2026-11-05: keep as an idea; no planning or implementation now).
Research by four read-only agents over the live code; file:line references are from that read.

Rules that bound every idea (docs/design-system.md): flat, square, no fills for selection;
one hover/emphasis rule; motion only transform/opacity/clip-path, tokens only, <= 220 ms,
keyboard never animates (except the menu morph), Reduce Motion = no animation at all.

---------------------------------------------------------------------------------------------
## 1. Research panel

### What I found
- The full panel has no stage concept. Top to bottom (src/research/ResearchPanel.tsx:365-797):
  tabs; two repeat-citation checkboxes; lookup field + Look up; Capture quote / Enter manually /
  Upload PDF / Import from Zotero; Zotero connect row; rule; status line; PDFs; source list
  (one open at a time); rule; Text-only notes; Bibliography (collapsed); Chicago help blurb.
- An open source renders SourceForm (src/research/SourceForm.tsx) in this order: PDF attach,
  type, creators/authors, title, short title, kind fields, extra fields, edition, THREE manual
  override textareas (always visible), "Review required details", CSL details, then DOI / ISBN /
  URL last. Only after all that: Note / Shortened note / Bibliography previews, then
  Cite here / Add quote / Delete source, then quotes, then the footnote list.
- The floating card already has stages new -> preview -> cited with a head, a scrolling body and
  a foot that keeps Cite here visible (src/research/CitationCard.tsx:130-214;
  tests/scroll-fade.spec.ts:82 pins "foot outside body").
- "Where used" today = the per-source footnote rows (editable) with counts in the collapsed
  toggle. No section location: footnotes live inside entry documents, so "in <section>" needs
  an entry scan (src/research/citationActions.ts has no usage query).
- The panel scrolls inside the host `.research-aside` (src/styles.css:2039); nothing is sticky.
- Pinned by tests: `hr.research-rule` count and position at 0 and 3 sources
  (tests/research.spec.ts:177); Tab from the lookup input lands on Look up (:383); the card's
  keyboard flow (tests/floating.spec.ts:848); field labels, not field order.

### Ideas
**A. Card grammar in the panel (recommended).** Reorder an open source into three named zones
using the card's own vocabulary, and move the primary actions up:
  1. *Source* -- type, authors, title, the kind fields (the card's compact set).
  2. *Citation* -- the Note and Bibliography previews live, directly under the fields, and the
     actions row right beneath them: **Cite here**, **Add quote**, then Delete source at the far
     right. For a book this lands inside the first screen of the panel.
  3. *More details* -- one `<details>` (collapsed, remembered per session) holding: short
     title, edition, extra fields, DOI / ISBN / URL, the three manual overrides, Review
     required details, CSL fields, PDF attach. Every field stays.
  4. *Used in* -- the existing footnotes and quotes lists under one small heading with the
     counts ("Used in 3 footnotes, 1 quote").
  Also at the top of the tab: the two repeat-citation checkboxes move below the source list
  into a collapsed "Citation rules" row, so the top of the tab is only "enter a source".
  Why: the card and the panel then read as the same flow at two sizes; the Cite here test
  flow is unchanged. Effort M (one component reorder, CSS, one new details, research.spec
  rule-count tests re-pinned if the checkboxes move). Risk: Cite here is near the top but not
  fixed; a long creator list still pushes it down.

**B. Sticky action foot, like the card.** The panel gets its own scroll region with a foot
outside it; the foot shows the primary action for the current state: no source open ->
"Look up / Enter manually"; source open -> "Cite here / Add quote". Can be added on top of A.
Effort M to L: retarget watchScrollFade from `.research-aside` to the new body, re-pin
tests/scroll-fade.spec.ts:33 and :73, floating-mode margin fit unchanged. Risk: the foot takes
~40 px always; two "primary" buttons in one foot needs a rule for which is bold.

**C. Three segmented views inside a source: Details | Citation | Used in.** Explicit split via
the existing Segmented control (src/components/Segmented.tsx). Details = all fields; Citation =
previews + note-form choices + manual overrides; Used in = footnotes and quotes. Actions row
outside the segments. Effort M. Risk: fields and preview are no longer visible together (fails
the first bullet) unless Details also carries a one-line preview.

**D. "Used in" with locations (priced add-on to A or B).** Each footnote row gains "in <section
title>" and a Go to action: scan entries' documents for the footnote id once per project change
(memoised). Effort M (one derived map in src/derived, row text, a Go to that reuses the
footnote-click path). Risk: a footnote in a fragment or an unsaved doc reads "unknown".

Recommendation: A, with D if the budget allows; B only if the owner's hand test still finds
Cite here too far down.

---------------------------------------------------------------------------------------------
## 2. Settings and the Export route

### What I found
- One long page `div.project-settings` (src/App.tsx:2435-2505), max-width 720 px, six
  `.settings-section`s in fixed order: General, Sidebar, Shortcuts (tallest, 11 rows), Goals,
  Export document (src/export/ExportPanel.tsx), Templates. No anchors, tabs or spy.
- Export is reachable ONLY from Settings (user guide line 12 says "scroll to Export document");
  there is no shortcut, palette command or toolbar entry. Cmd+, is reserved
  (src/shortcuts/registry.ts:46). The header already has an icon "Export portable project"
  (project JSON) next to Snapshot -- a confusable neighbour for any new Export control.
- Segmented (weight + colour, no box) is the live secondary-nav pattern; `role="tab"` is styled
  in src/styles.css but no component uses it.
- Tests: ~10 specs open Settings then find export buttons by name; appearance.spec.ts:546 pins
  the centred column and the Sidebar section's five checkboxes; `.settings-section .first()`
  is assumed to be General. All stay green if sections stay in DOM order.

### Ideas (the six-entry nav is given; the choice is how it behaves)
**A. Anchored single page with a sticky section strip (recommended).** A row of six text links
(Segmented look: weight + colour, no box) under the "Project settings" title, sticky at the top
of the settings scroll region. Click scrolls to the section (smooth for a pointer, instant for a
key or Reduce Motion); a small spy marks the section in view. Everything else stays. Why: every
destination is one click away and still scannable; zero test churn beyond a new spec. Effort S
to M. Risk: Shortcuts stays long; the strip costs one row.

**B. Grouped pages.** The same strip acts as tabs; one section mounted at a time (General by
default). Fastest to a destination (no scroll). Effort M plus test churn (every spec that opens
Settings and expects Export buttons, `.first()` assumptions, the centred-column check).
Risk: loses "see it all at once"; the Projects-screen gear dialog diverges further.

**C. Sidebar sub-rows.** The Settings bottom row expands to six child rows, like Manuscript
sections, so the nav lives in the sidebar and the page is untouched. Effort M. Risk: the bottom
rows are deliberately fixed and plain (design-system.md:179, 188); floating mode has no room.

Export route from the workspace (independent of A/B/C):
**E1 (recommended). An Export menu in the header, replacing the portable-project icon.** One
text control "Export" beside Snapshot opens a Popover (the create-menu morph): DOCX, PDF,
Markdown, Markdown with images (.zip), Plain text, rule, "Export settings..." (jumps to the
Settings Export section via the strip's anchor), "Complete project (.json)" (absorbs the current
icon). Plus a palette command "Export..." and a rebindable shortcut `exportDocument`
(default Cmd+Shift+E). Why: one obvious place, the confusable icon is resolved, the panel
remains the place for options. Effort M (menu reuses Popover; export calls reuse ExportPanel's
functions, which need lifting out of the component). Risk: header width at 1100 px with a long
project title; needs a check.
**E2. Export as a fifth sidebar bottom row.** Goes to the Export section as a destination.
Effort S to M. Risk: an action dressed as a place; the bottom group grows.
**E3. Palette command and shortcut only.** Effort S. Risk: invisible to pointer users.

Recommendation: A + E1.

---------------------------------------------------------------------------------------------
## 3. Motion

### What I found
- Engine: src/motion.ts `play`, `presence`/`usePresence`, `staggerIn`; tokens press 80 / fast
  120 / base 180 / morph 220; enter ease-out, exit ease-in, spring only for size. Used today only
  by Popover (clip-path morph + item stagger) and the create button fade.
- Opening Research: the aside mounts/unmounts with no animation (src/App.tsx:2910-2924). The
  floating card fades and slides down on a POINTER open only (citation-card.css:23-34).
- Projects <-> document: a plain ternary at src/App.tsx:2150; hard cut both ways.
- Keep as Fragment: `extract` (src/App.tsx:1105-1158) deletes the range at once, appends the
  entry, shows the text notice bottom-right. No motion anywhere in the chain. It has a shortcut
  (Shift+Cmd+X) so the keyboard path must stay instant.
- None of the three is sampled by tests/motion.spec.ts; each idea carries a new spec that must
  fail first.

### Ideas, one per transition (each has a recommended form and an alternative)
**M1. Opening Research -- the panel arrives from its edge.** Pointer open: `.research-aside`
is laid out at full width at once (the document reflows instantly, no layout animation) and its
content slides in from the right by `--space-4` with opacity, base/out; close is fast/in with
the exit reversed if reopened. Same tokens as the card, so card and panel feel like one thing.
Keyboard, palette and Reduce Motion: instant. Alternative: a clip-path reveal from the top
(the panel "unrolls" under its header) -- more character, but it is the menu's gesture and
would read as a popover.
Effort S. Spec: pointer open shows exactly one animation on the aside, transform + opacity;
keyboard open shows zero.

**M2. Projects <-> document -- the page comes forward.** Opening a project: the sidebar and
header appear at once (navigation stays immediate), only the document sheet fades in and rises
4 px, base/out. Going back to Projects: the library fades in, fast/out, and the list rows get
the existing `staggerIn` (transform only, 15 ms per row, capped). Implementation: wrap the
ternary's two branches in `usePresence` so the outgoing tree stays mounted for its 120 ms exit;
`saveAll` already runs before `setProject(null)`, so the order is unchanged. Enter on a project
row (keyboard) is instant. Alternative: a 0.98 -> 1 scale on the sheet ("comes forward") instead
of the rise -- more cinematic, risks looking like a zoom on a page that already has a zoom.
Effort M (presence around the swap; `FloatContext.key` re-measure unaffected). Spec: pointer
open of a project animates only the sheet, not the sidebar.

**M3. Keep as Fragment -- the snip is visible.** Pointer click on the scissors: (a) the
scissors icon rotates -12 deg and back over two press beats (transform only); (b) the new
Fragments row in the sidebar enters with the `staggerIn` slide (transform only, no opacity so
it is never dim); if the Fragments group is collapsed its heading gets the same 4 px nudge.
The deleted text's gap closes instantly (layout cannot animate under the rules, and the editor
must stay immediate). Shift+Cmd+X: everything instant, as today. Alternative: a ghost of the
selection flying to the sidebar -- rejected: it needs a cloned fixed element and a 220 ms cap
makes a cross-screen flight look rushed.
Effort S to M. Spec: toolbar snip shows animations on the icon and the new row only; shortcut
shows zero.

Not proposed: toolbar, dropdown, typing, tab switching, sidebar selection -- all stay as they
are (immediate).

---------------------------------------------------------------------------------------------
## 4. Projects page

### What I found
- `main.library` (src/components/ProjectLibrary.tsx:175-453): brand text, then one toolbar row:
  Start new project (menu: templates, rule, Import a file..., Recover from project.json),
  Import writing, and at the right the magnifier search (clip-path reveal), Sort (Name / Added /
  Last edited), reverse, list/cards toggle, gear. Rows: title 13 px + "Added <date> -- Last
  Edited <date>". Footer "Your writing stays on this Mac."
- Empty state: one 12 px line "No projects yet." (PC:369). Not pinned by any test.
- `Summary` (src/model.ts:65) carries only id, title, updatedAt, createdAt. "Last edited" is
  free; word or section counts mean widening Summary in src/storage.ts:46 (and the native list
  if it builds it).
- View and sort are plain state, reset every visit. No storage key exists.
- Pinned: no h1 (aria-label "Projects"), brand above the button, create button flush left,
  `.library-display` flush right, toolbar y stable as rows are added, the accessible names the
  `createProject` helper clicks, the search clip-path reveal (tests/projects-screen.spec.ts:20-135).

### Ideas
**A. Three clear bands (recommended).** Keep the toolbar row but give it one job per band:
  - *Start*: Start new project (menu) + Import writing, flush left as now.
  - *Find*: the search at the right of the same row as now (its reveal tests stay).
  - *Arrange*: Sort, reverse and the view toggle leave the toolbar and sit as a quiet 12 px
    muted caption on the list's top rule ("Last edited, newest first  --  List"), so the toolbar
    holds only the two verbs and the search. The gear stays at the far right of the toolbar.
  - Rows: title at `--type-large` (15 px) so it reads first; "Edited <date>" leads the metadata
    in the normal colour, "Added <date>" follows muted. Cards: title, then Edited, then Added,
    same order, same sizes.
  - Persist view and sort (`personal-word.library.view`, `.sort`, `.reverse`).
  Why: the owner's hierarchy (create / find / arrange) becomes the layout. Effort M (toolbar
  split, row typography, two storage keys; the flush-left/right and toolbar-y pins hold).
  Risk: moving Sort breaks tests that locate it inside `.library-display` (re-pin).

**B. "Continue writing" lead row.** The most recently edited project sits above the list at
`--type-title` with "Edited yesterday" and is the first Tab stop; the list below is everything
else. The page then opens on what you were writing. Effort M. Risk: duplicates one project in
the eye; with one project the list is empty under it; relative dates need a formatter and a
decision on when to fall back to absolute.

**C. Richer rows: words and sections.** Widen Summary with wordCount and sectionCount computed
at save and listed by storage; rows read "12,400 words  --  6 sections  --  edited Nov 4".
Effort M to L (storage.ts, possibly the Rust list command; migration for old summaries shows
blanks). Risk: Futura's proportional digits (limitations) make the column ragged.

**D. Empty state as the first move (recommended, combinable with any).** Replace "No projects
yet." with a short block in the list area: one body-size sentence ("Start with a blank page,
a Chicago paper or a screenplay, or bring in writing you already have."), then the same
actions as text controls: Blank, Chicago, Screenplay, Import writing, and "or drop a file
here". No illustration, no hero, no slogan. Effort S. Risk: none pinned; keep the toolbar
button as the one primary.

Recommendation: A + D + persist; B only if the owner wants the "desk" feel strongly; C as a
later add-on once Summary widening is priced.

---------------------------------------------------------------------------------------------
## Questions for the owner (defaults in brackets)
1. Timing: do the chosen items go into the 0.3.0 rebuild, or does 0.3.0 ship as approved and
   this becomes wave 8? [Default: wave 8 after 0.3.0 -- wave 7 is approved and the native
   rerun T252 is in review; new UI code would invalidate it.]
2. Research: actions right under the preview (A) or a sticky foot too (B)? [Default: A only.]
3. Projects: the "Continue writing" lead row (B)? [Default: no, plain list with A + D.]

## Next step
Owner picks; then `plan-authoring` writes docs/agent-work/2026-11-05-ui-wave-8/PLAN.md.
