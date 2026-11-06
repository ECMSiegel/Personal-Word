# Personal Word changelog

Dated history, newest first, built from `git log --date=short` and [app history](app-history.md). [app-history.md](app-history.md) already gives a fuller narrative for 2026-10-14 to 2026-10-18 (including what each pass did and did not verify), so this file links to it rather than repeating it. Fixed issues are listed with dates in [limitations](limitations.md). Verification details are in the [validation record](validation.md).

## 2026-11-04

UI wave 7 (lanes A, B, C and tasks T236-T244; CLAIMED; T240 ran Chromium, unit and cargo; two native WebKit harness runs followed (T242), by command only: real keys, drags and resize edges are not checked; the final Chromium run on this tree had one failure, a probable timing flake, and Rust was unchanged so cargo was not rerun). Record: [wave-7 validation](agent-work/2026-11-04-ui-wave-7/VALIDATION.md).

- Sidebar: the word count and the Cmd-K hint in Find in project are gone (the count stays in the pane footer). Hovering a row grows its rail line like pointing at the line does.
- Hierarchy: the section heading you are in is bold in the normal text colour (its icon keeps the tint in Color); rows are dim until hovered, focused or open, then go to full text colour.
- Resize edges (sidebar, research panel, split divider) show no coloured line on hover or drag; the cursor changes, and keyboard focus still shows a ring. The split divider keeps its resting line.
- Format bar: the zoom, text style and font dropdowns have no box, on the bar and in More; Page setup's Paper and Margins dropdowns keep theirs.
- Snapshots page: the title, buttons and text share one left edge, with token spacing.
- Floating sidebar: starts at the same left edge as the docked one and its list hugs its content, with no painted resize edge.
- Ruler (Page setup, off by default): drag to set the real document margin (up to 2 inches), with new 1 1/4 to 2 inch presets; continuous view has an adjustable, screen-only top gap (default 32 px). The continuous column is now the page's text width (608 to 624 px), so some lines rewrap.
- Cite here moves focus to the card's Page field.
- Native WebKit: the caret stays below the ruler when page view is zoomed (T243). With only a fragment on screen, only Fragments is bold; Manuscript and Research can both be bold when both hold something on screen (T244).
- Sidebar spacing: bottom rows are equal height with a centred label, the split icon keeps a gap from the rail, and the chevron sits rightmost in one column.
- Research panel: divider lines only where there is something to divide, two helper texts removed, and **Upload PDF** adds a PDF with no source; the PDFs list and its sidebar rows appear only once one exists.
- A busy moment after an arrow key no longer leaves the caret behind the ruler until the next press.
- Inserting a footnote no longer risks sending your typing into the document if a slow frame arrives just after the note opens.
- CI fixes: select-all after a click, focus after Insert table, the reduce-motion card opacity, and the motion test's wait.
- Docs: design system, architecture, limitations, user guide, validation.

## 2026-11-03

UI wave 6 (tasks T225-T232, each independently reviewed; CLAIMED; final check, Fable review and repairs done 2026-11-03 with Chromium, unit and native WebKit captures at the fixed 1240 px window, light and dark, Plain and Color (palette, settings, Notes tab, 190 px sidebar, rail and preview cards, split view, toast beside the card, toolbar at rest and magnified, floating sidebar and card at page 50 %); hover, window resizing (1100/1600 px) and continuous 125/150 % stay Chromium-only or owner hand checks; see the [wave-6 validation record](agent-work/2026-11-02-ui-wave-6/VALIDATION.md)). Plan: [the wave-6 plan](agent-work/2026-11-02-ui-wave-6/PLAN.md).

- Command palette: the highlighted row's shortcut no longer runs into the right edge. Rows with text on the right (palette rows, project rows) now grow only their label on hover or focus, through the same one emphasis rule.
- Projects screen: the trash button has its own slot and no longer overlaps the dates on a hovered row.
- Settings: the project settings column is centred, and the sidebar options (Reveal sidebar on hover, Floating sidebar and research, and per project Read, Comments, History) live together in a new Sidebar section.
- The "Give these words a home" strip under a fragment is gone. Move a fragment's words by copy and paste from the split view or the sidebar right-click menu; the Fragments panel's Append action is unchanged.
- Scissor (Keep as fragment) and Comment work with just the cursor in a paragraph: they act on that paragraph when nothing is selected, and stay off in an empty paragraph. The scissor now magnifies in the toolbar dock like the other icons.
- Sharper toolbar icons: the artwork is drawn at 24 px and scaled down at rest, so the biggest magnification draws at full size instead of stretching a small image.
- Notes tab: the "Ideas and reminders" hint is gone, there is one line between notes with equal space either side, and the source dropdown and Delete note share a row.
- Floating mode: the fit now judges every end state together (sidebar and card floating, one of them, neither) so widening or narrowing the window settles on one layout instead of flipping, and widening hands the Research panel back to the card. The notice toast keeps clear of the card or panel.
- Sidebar: no grey box behind the group action icons at narrow widths (and they stay clickable), word counts stay visible at 190 px, and labels ellipsize at every width.
- Line rail: each Manuscript, Fragments and Research group has one short line per item (idle 6 px, open 12 px, active 16 px, evenly spaced). Click, Enter or Space on a line opens the item (in Read mode, scrolls to the section); Reorder stays row drag and Option+Up or Down. Each line is a Tab stop after its group's rows.
- Docs: design system (emphasis rows, dock artwork, line rail, Notes tab, sidebar widths), limitations (wave-5 rough edges o, p, s, t, u closed), user guide.

## 2026-11-02

Part of UI wave 5, itemised below under 2026-11-01 because the wave was planned and started that day: floating mode, citation card, sidebar search clear and the command palette component landed overnight 2026-11-01 to 2026-11-02 (tasks T201, T208-T215, T219). The scroll fade (T216), the command palette wiring (T217) and the sidebar right-click menu (T218) landed the same night and are listed below.

## 2026-11-01

UI wave 5 (tasks T194-T220, each independently reviewed; CLAIMED, final validation pending; Chromium and unit evidence only, native WebKit not yet run). Plan: [the wave-5 plan](agent-work/2026-11-01-ui-wave-5/PLAN.md). Entries dated 2026-11-02 below belong to the same wave.

- Sidebar rows: Research, Manuscript and Fragments labels now start at one x position at every sidebar width, with an icon on every Research row (source, note, Bibliography, PDF, Comments, History); a PDF row sits exactly one step deeper.
- Sidebar reorder: the up and down arrow buttons are gone. Group headings, sections, fragments, research sources and research notes all drag, and Option+Up and Option+Down move the focused row one place at once, announced to screen readers. Order is saved with the project.
- Scrollspy lines on every Manuscript, Fragments and Research row in list view; they grow toward the pointer, and the active line fills with accent as its section or fragment scrolls (not for research rows). The line gutter is 14 px, not 20.
- Research panel: spacing and type sizes on the design tokens, hints and buttons span the full panel width, the Notes tab has a labelled Note field with space above it. Side effects accepted: the Project settings heading is 19 px, and some control paddings and gaps snapped to the scale.
- Menus inside a scrolling container (the Research panel's Full citation again menu) now open inside it and wrap long labels instead of being clipped; toolbar popovers are unchanged.
- Floating sidebar and research: a new Settings > General checkbox (off by default). When on, and only where the page margin is wide enough, the sidebar floats in the left margin as bare text with no background, border or shadow, and the citation card floats in the right margin; where there is no room, or in split view, on a destination page or on Versions, the normal sidebar and Research panel show. See the design system's Floating layout.
- Citation card: a small raised card for adding or editing one citation at a time (look up or enter by hand, review, Cite here, then Page and Note form), opened from the Research heading or by clicking a footnote number. It shares its logic with the Research panel, so the footnotes it makes are identical. After Cite here, focus goes to the new footnote's text field, as in the panel.
- Research panel internals: citation logic moved into shared modules (`citationActions`, `useLookup`, `SourceForm`, `Cite`) with no change to what the panel looks like or does.
- Sidebar search: a clear button appears in the field when there is text, and Escape clears the text without leaving the field.
- Command palette: Cmd+Shift+P opens a search box over every app action, "Go to" each section, fragment and page, and New fragment; Enter runs the choice, Escape closes it and puts the cursor back where it was. The shortcut can be changed in Settings > Shortcuts.
- Scroll fade: the Research panel, the citation card and (in floating mode) the sidebar's list fade at an edge that has more content beyond it; no fade while a menu or dialog is open inside.
- Sidebar right-click menu: right-click or Shift+F10 on a sidebar row for Open, Open beside, Rename, Move up or down and Delete (sections and fragments), or Collapse/Expand and Move on a group heading. In floating mode the thin lines above Read, Comments, History and Settings are gone.
- Docs and tests: design system (Floating layout, Search, header), architecture (shared citation modules, floating measurement), limitations, validation, user guide (reordering text corrected). The hover crawl test now scrolls covered controls into view.

## 2026-10-29

UI wave 4 (tasks T171-T193, each independently reviewed; CLAIMED, final validation pending; Chromium and unit evidence only, native WebKit not yet run). Plan: [the wave-4 plan](agent-work/2026-10-28-ui-wave-4/PLAN.md).

- Page view: the page breaks were always correct; the WebKit bug was the grey paper gradient not following zoom. Pages are now drawn as real page-sheet boxes, so gaps follow zoom. Chromium fit-zoom drift (up to 4 px by page 13) fixed. Backspace or Delete next to a page break removes the break and keeps the caret; undo restores it.
- One hover and keyboard focus rule for every text control: a width-neutral faux bold (text stroke, 0.04em) plus a 4 percent grow, no layout shift, danger stays red, Reduce Motion drops the grow. Enforced by `src/hoverEmphasis.test.ts` and `tests/hover-emphasis.spec.ts`. The Snapshot button has no border. Toolbar icons use a magnifying dock instead (peak 1.5, keyboard equivalent, none under Reduce Motion).
- Split view: no "Give these words a home" strip in split panes; header and divider rules line up; each pane has its own footer (page status left, word count right) and writing goals show once, in the left pane.
- Sidebar selection: the section header of what is on screen is bold and coloured (accent blue in Plain, section tint in Color); open entries are bold in the text colour, in split panes too; destination pages light nothing. This replaces the wave-3 rule.
- Scrollspy lines beside the Manuscript rows (Read mode follows the section being read; a line click eases there).
- Focus mode hides the formatting bar until the pointer nears the top, focus enters it, or the new rebindable shortcut Show formatting bar (Cmd+Alt+T); its space is reserved so text never jumps or sits under it at the top, and in page view the band is desk-coloured.
- The Snapshot name dialog now closes on Escape even when focus left it.
- Docs updated: AGENTS.md (sidebar selection, hover emphasis), design system, architecture, limitations, validation.

## 2026-10-28

- Page view splits paragraphs like Word (owner decision 2026-10-28, task T168; CLAIMED): a paragraph runs on to the next page between lines when at least two lines stay on each page, headings keep with the paragraph after them, and Up and Down cross a page gap to the adjacent line in WebKit too.
- UI wave 3 (tasks T131-T149, each independently reviewed; CLAIMED, final validation pending T151): an icons-only toolbar at every width with no gap between groups, Shift-Enter page breaks, a right-click table menu, a Bibliography that appears only when it means something, one project name with a breadcrumb and a rename that saves on blur, Settings opened from the Projects screen's gear, no heading on Projects, no box highlights anywhere (weight and colour instead), separators, tabular-figure counters, 24 px hit areas and the optical-nudge hook, a Segmented control without a fill, a shortcut registry with Settings > Shortcuts and rebinding, drag-to-reorder sidebar groups and sections, drop targets with a labelled keyboard path, a vertical page view that moves whole blocks, a split view that keeps the left editor's history and scroll and lines both page tops up, and this documentation pass.
- Docs updated: design system (rewritten States, Toolbar, Sidebar and Split view; new Separator, Pages, Shortcuts, Optical alignment and Drop targets sections), README, architecture, validation record, limitations, this changelog and the later-fixes plan.

## 2026-10-27

- UI wave 2 (tasks T098-T129, each independently reviewed; CLAIMED, final validation pending T127): motion tokens and a motion engine with reduced-motion handling, the shared Popover behind every menu and toolbar panel, the create menu morphing out of its button, toolbar label mode with a labelled More menu, sliding selection in the sidebar and Segmented, the sidebar title row with the hover-reveal switch, per-project sidebar feature switches, split view (Cmd/Ctrl+click and the Open beside button), section colours, hidden Essay and Story templates with Chicago renamed, the Bibliography page and source list, PDF attachments opened beside the draft, and the documentation pass.
- Docs updated: README, design system, architecture, validation record, limitations, this changelog, the feature guide and the later-fixes plan.
- Native smoke and native screenshots need an unlocked, visible desktop session with the window in front (T129); a sandboxed process cannot drive a visible window (T125).

## 2026-10-26

- UI polish wave (tasks T071-T096, each independently reviewed; CLAIMED, final validation pending T082): native screenshot tool (`scripts/native-screens.py`), type-scale and spacing tokens, complete hover/focus/pressed/disabled states, `docs/design-system.md`, Appearance (System, Light, Dark; Cmd/Ctrl+Shift+L) and Palette (Plain, Color) settings with the Mac title bar following the choice, helper captions removed, Projects screen search, the Start new project button growing into a panel (templates, Import a file…, Recover from a project.json file…), drag-and-drop import onto the Projects screen.
- Critique pass and its fixes: create-panel items no longer fade in, short Projects lists centred, sidebar entry title/count hierarchy, move arrows no longer cover the count, remaining captions replaced by a tooltip, Goals selects use the app dropdown, sidebar labels fit at 190 px. Plain-dark primary button contrast (2.45:1) is recorded, not changed.
- README, design system, architecture, limitations and validation record updated.

## 2026-10-25

- Cheap-fixes wave (T050-T057, each independently reviewed): import size label, "newer version of Folio" error text, notice toast position and auto-dismiss, PDF image gap, Word and PDF exports now print project and section titles, BibTeX "Jr." suffix, browser-preview Zotero fetch, import cancel test coverage; full validation list rerun and the app rebuilt (commit `4659847`).
- Quick start added below the project description in the README (`72732d8`).
- Owner acceptance: the owner confirmed all nine real-use checks; Personal Word marked **beta** (`d499b88`).
- README refreshed for the completed beta board and owner decisions; owner answers to board questions Q001-Q004 recorded (`6f3027c`, `d95b6d0`). Q005 (Chicago first-page title) answered the same day.
- Beta board completed: waves 3-5, Gates B-D, fresh normal app build; native print probe stopped and the legacy PDF exporter kept; T043 multi-paragraph footnotes in Word and PDF export.

## 2026-10-24

- Wave 0 work (image assets, tables, BibTeX, Markdown notes) checkpointed as unreviewed, and the delegation baseline pointed at that checkpoint.
- D1 native durability run completed and stale portable copies repaired.

## 2026-10-23

- Beta roadmap work checkpointed after independent review. Signing and downloadable distribution removed from beta scope by the owner.

## 2026-10-20

- Current source alpha qualified and release evidence refreshed.

## 2026-10-19

- Local source alpha prepared; deadline, citation and text export edge cases repaired.
- Alpha URL handling and sidebar selection hardened; DOCX hyperlinks restricted to http, https and mailto links.
- Reviewed source-alpha evidence and privacy audit finalized; PDF font format wording in THIRD_PARTY corrected.

## 2026-10-18

- Writer features: short notes, Zotero CSL JSON import, quote capture, writing goals, prose check, whole-project text export.
- Completion pass: Markdown import with preview, bundled Noto font subsets for PDF, DOCX XML checks, keyboard-focusable dropdown, three-phase isolated native smoke harness; writing workflow qualified and source release prepared.

## 2026-10-17

- Sidebar reorganized: collapse chevrons, features at the bottom, no switch arrow or placeholder. Bounded save scheduling, plain-text import, list/strike export support and an advisory single-instance lock.

## 2026-10-16

- Workspace update: project tabs, page view, templates, research with Chicago citations, DOCX/PDF export, comments, fragments, revision comparison.
- One-row toolbar, flat dropdowns, Word-style indent, research rework with citation lookup.
- Editable footnotes, fragment split view, visual polish.
- Durability: recovery lockouts fixed, project delete and rename added, Personal Word UI; saves now write only changed entries, projects rebuild from entry rows, history is time-bucketed; per-section saves merged.

## 2026-10-14

- Initial Folio local-first writing workspace and durability checks: projects, sections, rich-text editing, SQLite persistence, recovery journaling, snapshots, portable copies.
