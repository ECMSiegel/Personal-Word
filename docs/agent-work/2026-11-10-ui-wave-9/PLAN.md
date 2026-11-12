# PLAN -- UI wave 9: polish fixes, fonts, Research panel, side ruler, Export menu, Projects page
Date: 2026-11-10 | Architect: Claude Code / Fable 5.2 | Project: Project 13 - Word Processor | Status: APPROVED (owner, 2026-11-10: "alright do it")

## Goal
The owner can use Personal Word without the hover blur, cut-off cards, covering scrollbar,
duplicate font entries and cluttered Research panel reported on 2026-11-10, can pick the interface
font from every installed font or add font files, can show a side ruler in page view, can export
from a header menu, and gets a clearer Projects page and Settings page.

## Request
Owner, 2026-11-10, two messages (summarised; quoted where the wording decides something):
1. "almost all text gets fuzzy when hovered over and magnified"
2. Research panel "super full and very cluttered without clear organization and lots of extra text"
3. Open beside: "I want the one that changes to be the one that was being worked on most recently"
4. "the split pane icon in card view isn't space right and doesnt magnify"
5. Settings appearance option to change "the font of the program appearance too -- everything besides the logo"
6. "a small upload font in the appearance section of the settings"; uploaded fonts usable in documents
7. Click anywhere on the page to start writing, without aiming at text
8. PubMed link did not auto-format; DOI did. Wants clarity on online/offline
9. Side ruler like Google Docs "as an option with our ruler", placed "with the sidebar in mind"
10. Prose check and margins icons are the same; "prose check dropdown spacing isn't right"
11. "The card view is cut off on the left side of the bar -- this only happens sometimes"
12. Small screens: "a scroll bar on the side bar that covers our UI"
13. Font shows with quotes in the top bar and appears as a duplicate entry
14. "the top bar compresses the name of the font" even with room
15. Card view "doesnt fit the research stuff"; "generally card view needs polish"
16. "three icons and the trash can on the project page don't magnify"
17. "make sure the plan is written with maximum possible parallelism in mind"
18. Third message, 2026-11-10: add "the recommended set" -- collapse empty Synopsis and Notes boxes;
    bold and italic files for an added font; fonts embedded in Word export; list every installed
    font and embed built-in choices such as Georgia and Times in PDF (with Core Text declared as a
    direct dependency); from wave 8: "Used in" locations with Go to, the Settings section strip,
    the Export menu in the header with a shortcut, the Projects page layout and empty state -- plus
    "The Research panel slides in". "Remember the parallelism where possible."
19. The four defaults (side ruler hides while the sidebar floats; font controls in the General
    section; `AGENTS.md` edits) are approved: "1 - 4 questions are all good."
Excluded by the owner: "Dont do browser pane yet."
Defaults the owner accepted ("yes that looks good", then "You can write it"): hover drops the text
grow and keeps the faux bold; blank-page click behaves like Word; about ten built-in fonts plus
uploads (no listing of every installed font); side ruler on the left edge of the paper under the
existing Ruler toggle.

## Definition of done
- Hovering a text control thickens it without growing it; text stays sharp in the built Mac app.
- The font dropdown never lists one font twice, never shows quote marks, and shows a full name such
  as "Times New Roman" when the bar has room.
- Prose check and Page setup have different icons; the Prose check menu's checkboxes line up.
- The sidebar shows no system scrollbar and cannot scroll sideways; cards never exceed its width.
- Research rows in card view are compact one-line cards in one column; the card split icon is inset.
- Projects page icons, the trash can and the card split icon grow on hover and keyboard focus.
- With a split open, Open beside replaces the pane last clicked; PDFs still open on the right.
- Clicking blank page area focuses the editor: below the text puts the caret at the end, beside a
  line puts it on that line.
- A PubMed or PMC link, or a bare PMID, fills in the source; the panel says lookup needs internet.
- An open source in the Research panel shows Source, Citation and a collapsed More details zone.
- Settings has an Interface font dropdown and an Add font button. Both font menus list the
  built-in fonts, added fonts and every installed font. An added family may have regular, bold,
  italic and bold-italic files and shows under its real family name.
- A font applied to text is embedded in PDF and Word export when its file can be read and it
  permits embedding; otherwise export falls back as today and says so in `docs/limitations.md`.
- In card view a card with no synopsis and no notes hides both boxes until it is open or holds
  keyboard focus.
- Each "Used in" footnote row names its section and has a Go to control that shows the marker.
- Settings has a sticky strip of links to its sections.
- The header has an Export menu (Word, PDF, Markdown, Markdown with images, Plain text, Export
  settings, Complete project) with a rebindable shortcut and a command palette entry; the old
  portable-project icon is gone.
- The Projects page remembers sort and view, puts them in a quiet caption above the list, leads
  each row with the title and "Edited", and has a useful empty state.
- Opening Research with the pointer slides the panel in; keyboard and Reduce Motion stay instant.
- With Ruler on in page view, a side ruler shows inches and the top and bottom margins.
- `npm run build`, `npm test`, `npm run test:e2e` (built app) and `cargo test` pass.

## Non-goals
- Browser pane (owner: not yet).
- Storing added fonts inside a project file or its portable export.
- Separate top and bottom margins: the side ruler moves the one margin shared by all four sides.
- The document default font setting (serif, sans or mono) and its choices: only text with a font
  applied to it changes in export.
- Print path fonts (`src/print/nativePdf.ts`): no production caller of `buildPrintHtml` was found.
- The Reading display font menu and the Export typeface menu.
- Wave 8 ideas not chosen: pinned action foot and tabs in the Research panel; the Research panel's
  exit animation, the project open and close fade, the Keep as Fragment animation; the "Continue
  writing" row and word and section counts on the Projects page; the section strip in the
  Projects-screen settings dialog.
- Fixing the intermittent CI failures recorded in `HANDOFF.md` (owner: after this wave).

## Context (verified)
- Base: branch `main` at `834f534`; uncommitted: `team/BOARD.md` modified, untracked shots folders,
  `docs/agent-work/2026-11-05-ui-wave-8/`, `scripts/__pycache__/` (verified, `git status`).
- Hover: `--emph-stroke: 0.04em`, `--emph-scale: 1.04` -- `src/styles.css:39-41`; the one rule
  that applies them -- `src/styles.css:407-475`; Reduce Motion already sets the scale to 1 --
  `src/styles.css:484-488` (verified). Which of stroke or scale blurs in WebKit: unknown.
- Hover test pins the grow: "H2 emphasis: no-shift faux bold and scale 1.04 on hover" --
  `tests/hover-emphasis.spec.ts:412` (verified).
- Interface font is hard-coded at `src/styles.css:223-228`, `:1477-1483`, `:1939-1945`; the logo
  `.brand` at `:589` and the document default `.writing-surface` at `:1011` are separate (verified).
- Other hard-coded interface font stacks: `src/organization/fragments.css:4`,
  `src/research/citation-card.css:14`, `src/research/research.css:7`,
  `src/components/command-palette.css:20`, `src/components/dropdown.css:60`,
  `src/editor/editor.css:122`, `:254`, `:784`, `:961`. Document-font rules, not interface:
  `src/editor/editor.css:534`, `:676`, `:716`, `src/organization/fragments.css:99`.
  `src/editor/editor.css:814` already reads `var(--ui-font, inherit)`, but nothing defines
  `--ui-font` yet (verified by grep).
- Document font list `FONT_FACES` (7 entries) -- `src/Writer.tsx:159-167`; current value read at
  `:1125-1126`; dropdown with `width={124}` at `:1328-1351`; `withCurrent` appends any value not in
  the list -- `:178-186` (verified).
- The font mark reads back `el.style.fontFamily` -- `src/editor/formatting.ts:9` (verified); the
  webview returns multi-word names quoted, so the value no longer matches the list (inferred).
- Prose check and Page setup both use `Settings2` -- `src/Writer.tsx:1759`, `:1819` (verified).
- Prose check menu markup, with an inline style and no dedicated layout CSS --
  `src/components/ProseIssues.tsx:41-65`; list CSS only at `src/editor/editor.css:43-60` (verified).
- Sidebar list: `.sidebar-groups { overflow: auto }`, no scrollbar styling anywhere --
  `src/styles.css:1642-1647` (verified). Edge fade is attached only in floating mode --
  `src/components/ProjectSidebar.tsx:596` (verified).
- Card rules -- `src/styles.css:1737-1774`, `:1807-1815`, `:2022-2025`; two columns at 380px
  container width -- `:1812-1815`; the open-beside wrapper `.reorder` is `position: absolute;
  right: 0` with no top or inset -- `:731-744`; markup at `src/components/ProjectSidebar.tsx:943-958`
  (verified). Cards wider than the sidebar cause the left cut-off (inferred from the screenshots).
- Icon-only buttons are excluded from the text hover rule (`.open-beside`, `.delete-entry`,
  `.library-display > button`, ...) -- `src/styles.css:407-437`; the magnifying dock only handles
  `.toolbar-icon` in the format bar -- `src/components/dock.ts:31` (verified).
- Projects page icons live in `.library-display`; the row trash is `button.delete-entry` --
  `src/components/ProjectLibrary.tsx:261-283`, `:359-366` (verified).
- `openBeside` always writes the right pane -- `src/split.ts:89-102`; `select` already replaces the
  focused pane and never shows one entry twice -- `:115-123`; `Split.left` is an entry id, the right
  pane may be a PDF, a PDF pane never takes focus -- `:104-108` (verified). Callers:
  `src/App.tsx:575`, `:955` (verified).
- The editor viewport's only click handler is for footnotes -- `src/Writer.tsx:2041-2051`; clicks in
  page gaps are handled by `clickSpacer` -- `src/editor/pagination.ts:525-555`, wired at `:729`
  (verified). Margins and blank sheet area have no handler (verified by reading).
- Lookup: DOI goes to Crossref, ISBN to Open Library, a web address is fetched and its meta tags
  read, then Crossref if a DOI is found -- `src/research/lookup.ts:40-62`, `:356-437`; native fetch
  with user agent `PersonalWord/0.1 (citation lookup)` -- `src-tauri/src/lookup.rs:7-58` (verified).
- A command-line request for a PubMed article page with that user agent returned HTTP 203 and a
  5.5 KB page with no citation tags (verified once with curl, not from the app; cause inferred).
  `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi?db=pubmed&id=<PMID>&retmode=json`
  returned 200 with the title and an `articleids` entry of `idtype: "doi"`; the same address with
  `db=pmc&id=7745181` also returned 200 with a DOI (both verified with curl, app user agent).
- Research panel structure and the parked design -- `docs/agent-work/2026-11-05-ui-wave-8/IDEAS.md`
  section 1 (verified read; its line references were not re-checked today).
- Settings: `GeneralSettings` -- `src/settings/GeneralSettings.tsx:15`, used at `src/App.tsx:2098`;
  theme and palette are stored under `folio.workspace.appearance` -- `src/appearance.ts:30` (verified).
- PDF export ignores a run's font: every character is keyed `family:style:shard` from the document
  setting -- `src/export/pdf.ts:68`, `:116-130`; fonts are embedded at `:174-184`; the run's raw
  font value is available as `Inline.fontFamily` -- `src/export/document.ts:129-131` (verified).
- Word export writes the run's first font name with quote marks stripped --
  `src/export/docx.ts:69-72`, `:83` (verified).
- Native rich-text validation checks mark types only; `textFormat` is allowed --
  `src-tauri/src/store.rs:1139-1146` (verified for the lines read; attribute checks elsewhere: unknown).
- Native commands are registered in two lists -- `src-tauri/src/lib.rs:237-270`, `:272-292` (verified).
- Content security policy has no `font-src` -- `src-tauri/tauri.conf.json:23` (verified). A
  `FontFace` built from bytes makes no network fetch, so it should not need `font-src` (inferred;
  proven only by the C3 hand check in the built app).
- Page geometry: one `margin` for all four sides, clamped 24..192 px; `height` 1056 (Letter) or
  1122.5 (A4); `gap: 32` between pages -- `src/editor/formatting.ts:127-146` (verified). 96 px per
  inch (inferred from 816 px = 8.5 in).
- Top ruler: markup at `src/Writer.tsx:2053-2125`, drag state at `:556-616`, toggle stored under
  `folio.workspace.ruler` at `:175`, CSS at `src/editor/editor.css:432-490`, `:581` (verified).
- Floating sidebar carries the class `is-floating` -- `src/components/ProjectSidebar.tsx:1002` (verified).
- System fonts: Georgia, Times New Roman, Arial, Verdana, Courier New and Trebuchet MS are single
  `.ttf` files with separate Bold, Italic and Bold Italic files in
  `/System/Library/Fonts/Supplemental/`; Futura, Gill Sans, Charter, Optima, Avenir Next and
  Helvetica Neue are `.ttc` collection files (verified, `ls`). Whether pdf-lib can embed one face
  out of a collection: unknown.
- `objc2-core-text` and `objc2-app-kit` are already in `src-tauri/Cargo.lock`; macOS crates are
  declared at `src-tauri/Cargo.toml:26-45` with the note "only feature flags are added" (verified).
  Whether the needed Core Text feature flags pull in a crate that is not locked: unknown.
- The Word library (`docx` ^9.11) accepts `fonts?: readonly FontOptions[]` on the document --
  `node_modules/docx/dist/index.d.ts:3989-4001`, `:7018` (verified in the type file; not tried).
- `@pdf-lib/fontkit` is a dependency (`package.json:20`) and can read a font's name table (inferred).
- Header: Snapshot button, then the icon button "Export portable project" -- `src/App.tsx:2388-2400`
  (verified). Export functions `save`, `saveText`, `saveMarkdownBundle` are local to the component
  -- `src/export/ExportPanel.tsx:48-110`; export is reachable only from Settings (verified).
- Shortcuts: `src/shortcuts/registry.ts:28-38`; no entry uses Cmd+Shift+E (verified by grep).
- Research panel mount: a plain conditional, no animation -- `src/App.tsx:2909-2911`; the app
  already tracks whether the last input was a pointer -- `pointerInput` ref, `src/App.tsx:1981-1990`;
  motion helpers `play`, `MOTION_MS`, `EASING`, `prefersReducedMotion` -- `src/motion.ts:7-37` (verified).
- Per-entry footnote order already exists: `EntrySummary.referenceOrder: string[]` --
  `src/derived/projectIndex.ts:3`, built at `:20-40` (verified). That it lists footnote ids: inferred.
- Settings page: `div.project-settings` with an `h1` and `.settings-section` blocks, each with an
  `h2` -- `src/App.tsx:2435-2440`, `src/settings/GeneralSettings.tsx:44-45,139-140` (verified).
- Projects page toolbar: Sort dropdown, a reverse button whose content is the text "↑" or "↓" (not
  an icon), the view toggle, the gear -- `src/components/ProjectLibrary.tsx:300-331`; empty state
  is one line -- `:369`; view and sort are plain state with no storage (verified).
- Type sizes: `--type-small` 12, `--type-body` 13, `--type-large` 15 -- `src/styles.css:20-22` (verified).
- Browser tests: one worker, port from `PLAYWRIGHT_PORT` (default 1420), dev server unless
  `PLAYWRIGHT_PREVIEW=1`, `reuseExistingServer: false` -- `playwright.config.ts` (verified).
- CSS entry points: `src/main.tsx:4` imports `./styles.css` (verified).

## Rules in force
- Read `docs/design-system.md` before changing any CSS; flat, square, no fills for selection --
  `AGENTS.md` (project).
- "Toolbar icons use the magnifying dock instead. Do not add a second hover weight or scale rule
  anywhere." -- `AGENTS.md` (project). B3 adds a 25 percent grow for standalone icons outside the
  toolbar, at the owner's request (items 4 and 16); D1 amends this sentence to allow it.
- Keep `folio.*` storage keys and native event names; never delete user projects or recovery data
  for a test; use isolated test storage -- `AGENTS.md` (project).
- Extend the Rust rich-text allowlist when adding nodes or marks (none are added here) -- `AGENTS.md`.
- Every hover interaction has keyboard access; Reduce Motion is honoured -- `AGENTS.md`.
- Chromium results are not proof of macOS rendering; check native WebKit for editor and layout
  changes -- `AGENTS.md`.
- Parallel agents need explicit file ownership; shared types go through the integrating agent --
  `AGENTS.md`; never edit a path registered to another live task -- `team/PROTOCOL.md:186`.
- A new test must be shown to fail first when practical; CLAIMED, not VERIFIED, until the owner
  confirms -- workspace `AGENTS.md`.
- No commits unless asked; no package installs without asking -- workspace `AGENTS.md`. Declaring Core
  Text as a direct dependency (C6) is approved by the owner (2026-11-10, "alright do it", in
  answer to the recommendation to declare it). Nothing else may be added or downloaded.
- Motion uses only transform, opacity or clip-path, the motion tokens, at most 220 ms; keyboard
  actions never animate; Reduce Motion means no animation -- `docs/design-system.md`.
- Haiku or Sonnet workers; one Opus reviewer checks all work; warn the owner before any native
  screen run -- owner preferences (memory, 2026-11-04).

## Approach
One short serial task (T0) cuts seams in the shared files: empty per-task CSS files that are
already imported, stub modules with fixed signatures, and the few wiring lines in `Writer.tsx`,
`App.tsx`, `main.tsx`, `styles.css`, `GeneralSettings.tsx` and `ResearchPanel.tsx`. After T0,
fifteen tasks can start at once, each owning files nobody else touches. Short chains remain only
where one file must be edited in place: `src/styles.css` (A1, A2, A3), `src/Writer.tsx` (B1, then
C5), `src/App.tsx` (E1, then G1), `src-tauri/src/lib.rs` (C2, then C6), and docs last.

Rejected:
- One worker per shared file with no seams: only four or five tasks could run at once.
- Moving existing CSS blocks into new files: cascade order ties make a pure move risky.
- One git worktree per worker: the team board lives in the main checkout; merges add a serial step.
- Gating the larger pieces on the small fixes: the batches below are review batches, not gates.
- Reading font names in Rust: it would need a font-parsing crate; the app reads them in the
  webview with the fontkit library it already ships.

### Parallelism map
| Task | Depends on | Owns (nobody else edits) | Test port | Batch |
|---|---|---|---|---|
| T0 Seams | -- | see T0 | 1430 | 0 |
| A1 Hover | T0 | `src/styles.css`, `tests/hover-emphasis.spec.ts` | 1431 | 1 |
| A2 Sidebar scroll | A1 | `src/styles.css`, `src/components/ProjectSidebar.tsx` | 1432 | 1 |
| A3 Cards | A2 | `src/styles.css`, `src/components/ProjectSidebar.tsx` | 1433 | 2 |
| B1 Font menu and icon | T0 | `src/Writer.tsx`, `src/editor/editor.css` | 1434 | 1 |
| B2 Prose check menu | A1 | `src/components/ProseIssues.tsx`, `src/components/prose-issues.css` | 1435 | 1 |
| B3 Icon magnify | T0 | `src/components/icon-magnify.css` | 1436 | 1 |
| B4 Open beside | T0 | `src/split.ts`, `src/split.test.ts`, `tests/split-view.spec.ts` | 1437 | 1 |
| B5 Blank-page click | T0 | `src/editor/blankClick.ts` and its test | 1438 | 1 |
| B6 PubMed lookup | T0 | `src/research/lookup.ts`, `src/research/lookup.test.ts` | none | 1 |
| C1 Research panel | T0 | `src/research/ResearchPanel.tsx`, `SourceForm.tsx`, `research.css`, `tests/research.spec.ts` | 1439 | 2 |
| C2 Font storage, native | T0 | `src-tauri/src/fonts.rs`, `src-tauri/src/lib.rs` | none | 2 |
| C3 Fonts in the app | T0 | `src/fonts/store.ts`, `src/fonts/registry.ts`, `src/fonts/fontInfo.ts`, `src/settings/AppearanceSettings.tsx`, `src/settings/appearance-settings.css` | 1440 | 2 |
| C4 Fonts in PDF | T0 | `src/export/pdf.ts`, `src/export/fontSource.ts` and their tests | none | 2 |
| C5 Side ruler | B1 | `src/Writer.tsx`, `src/editor/SideRuler.tsx`, `src/editor/side-ruler.css` | 1441 | 2 |
| C6 Installed fonts, native | C2 | `src-tauri/src/sysfonts.rs`, `src-tauri/src/lib.rs`, `src-tauri/Cargo.toml`, `src/fonts/system.ts` | none | 2 |
| C7 Fonts in Word | T0 | `src/export/docx.ts` and a new test | none | 2 |
| E1 Export menu | T0 | `src/App.tsx`, `src/export/ExportMenu.tsx`, `src/export/exportActions.ts`, `src/export/ExportPanel.tsx`, `src/shortcuts/registry.ts` | 1442 | 2 |
| G1 Used-in locations and Go to | E1, C1 | `src/App.tsx`, `src/derived/footnoteLocations.ts` | 1443 | 2 |
| M1 Research panel slides in | T0 | `src/research/asideMotion.ts` | 1444 | 1 |
| P1 Projects page | T0 | `src/components/ProjectLibrary.tsx`, `src/components/library.css`, `tests/projects-screen.spec.ts` | 1445 | 2 |
| S1 Settings section strip | T0 | `src/settings/SettingsNav.tsx`, `src/settings/settings-nav.css` | 1446 | 1 |
| D1 Docs | all above | `docs/*.md`, `AGENTS.md` | none | 3 |
| V Validation | D1 | nothing (reports only) | 1420 | 3 |

Every task also owns one new browser or unit spec named in its Files line. Widest point: A1, B1,
B3-B6, C1-C4, C7, E1, M1, P1, S1 (fifteen tasks) can run together as soon as T0 is approved; B2
and A2 join after A1, C6 after C2, C5 after B1, G1 after E1 and C1.

Contracts between parallel tasks (each side builds against the stub or the name, not the other's code):
- Fonts: B1, C3, C4, C6 and C7 share the T0 signatures in `src/fonts/` and
  `src/export/fontSource.ts`. C2 and C3 share the four
  `font_*` command names; C6 owns both sides of its two commands.
- Icons: B3 styles the class `icon-grow`; P1 puts that class on the Projects page icon buttons.
- Research: T0 adds two optional props to `ResearchPanel`; C1 renders them, G1 supplies them.
- Settings: E1 calls `scrollToSettingsSection` from S1's file (a T0 stub until S1 lands).

### Rules for every worker (referred to as "the common rules")
1. Run browser tests against your own dev server and only your own spec files:
   `PLAYWRIGHT_PORT=<your port> npx playwright test <files>`. Never set `PLAYWRIGHT_PREVIEW`, never
   run `npm run build` or `npm run tauri build`: they write the shared `dist/` folder.
2. Unit tests: `npx vitest run <your test files>`. Type check: `npx tsc -b`. If it reports errors in
   files you do not own, do not fix them; note them in your done note.
3. Other workers are editing the same checkout. If your browser spec fails on an error from a file
   you do not own, wait two minutes and rerun once; if it still fails, message that file's owner
   (`python3 team/team.py owner "<path>"`) and continue with your other steps.
4. If a change of yours breaks an existing spec file you do not own, register it
   (`python3 team/team.py files add <T> --agent <ID> "<path>"`). If that exits 2, do not edit it;
   list the spec and the needed change in your done note for task V.
5. Write a short note `docs/agent-work/2026-11-10-ui-wave-9/notes/<task>.md`: what changed, what a
   user sees, any limitation, and the exact hand check. D1 builds the docs from these notes.
6. No commits. No new packages.
7. "All pass" for an existing spec file means: no failure that is not already in
   `notes/baseline-dev.txt` (T0 records it on the dev server). A new spec you create must fully pass.

## Tasks

### T0 -- Seams in the shared files
- Files: modify `src/main.tsx`, `src/styles.css:223-228,1477-1483,1939-1945`, `src/Writer.tsx`
  (viewport div at `:2041-2051`), `src/App.tsx` (`:950-951` comment, `:2436` settings page,
  `:2909-2911` research aside), `src/settings/GeneralSettings.tsx`,
  `src/research/ResearchPanel.tsx` (props type only), and the interface font stacks at
  `src/organization/fragments.css:4`, `src/research/citation-card.css:14`,
  `src/research/research.css:7`, `src/components/command-palette.css:20`,
  `src/components/dropdown.css:60`, `src/editor/editor.css:122,254,784,961`. Create
  `docs/agent-work/2026-11-10-ui-wave-9/notes/baseline-dev.txt`, `src/fonts/types.ts`,
  `src/fonts/names.ts`, `src/fonts/names.test.ts`, `src/fonts/store.ts`, `src/fonts/system.ts`,
  `src/fonts/registry.ts`, `src/fonts/fontInfo.ts`, `src/export/fontSource.ts`, `src/settings/AppearanceSettings.tsx`, `src/settings/SettingsNav.tsx`,
  `src/editor/blankClick.ts`, `src/research/asideMotion.ts`, and empty CSS files
  `src/components/icon-magnify.css`, `src/components/prose-issues.css`,
  `src/settings/appearance-settings.css`, `src/settings/settings-nav.css`,
  `src/editor/side-ruler.css`.
- Interfaces: uses none. Provides, exactly:
  - `src/fonts/types.ts`:
    `export type FontStyle = "regular" | "bold" | "italic" | "boldItalic"`;
    `export type UserFont = { id: string; family: string; style: FontStyle; fileName: string; format: "ttf" | "otf" }`;
    `export type FontFile = { bytes: Uint8Array; postscriptName: string; collection: boolean }`.
  - `src/fonts/names.ts` (real code, not a stub):
    `export function primaryFamily(value: string): string` -- first family of a CSS font value, with
    surrounding single or double quotes and extra spaces removed (`'"Times New Roman", serif'` ->
    `Times New Roman`); `export function sameFont(a: string, b: string): boolean` -- true when the
    two `primaryFamily` results match ignoring case; `export function fontValue(family: string): string`
    -- `'"<family>", sans-serif'` (always double-quoted, so "Source Sans 3" is valid CSS).
  - `src/fonts/store.ts` (stubs): `listUserFonts(): Promise<UserFont[]>` resolves `[]`;
    `addUserFont(file: File): Promise<UserFont>`, `removeUserFont(id: string): Promise<void>`,
    `userFontBytes(id: string): Promise<Uint8Array>` each reject with `new Error("Fonts are not available yet")`.
  - `src/fonts/system.ts` (stubs): `listSystemFamilies(): Promise<string[]>` resolves `[]`;
    `systemFontFile(family: string, bold: boolean, italic: boolean): Promise<FontFile | null>` resolves `null`.
  - `src/fonts/registry.ts` (stubs): `export const BUILT_IN_FONTS: { label: string; stack: string }[] = []`;
    `export function initFonts(): Promise<void>` resolves;
    `export type FontOption = { value: string; label: string; style?: { fontFamily: string } }`;
    `export function useDocumentFontOptions(): FontOption[]` returns a constant empty array (C3
    makes it return added families, then installed families, and re-render on change).
  - `src/fonts/fontInfo.ts` (stub):
    `export type Embedding = "installable" | "editable" | "preview" | "restricted"`;
    `export function readFontInfo(bytes: Uint8Array): Promise<{ family: string; style: FontStyle; embedding: Embedding }>`
    rejects with `new Error("Fonts are not available yet")`.
  - `src/export/fontSource.ts` (stub):
    `export type ResolvedFont = { bytes: Uint8Array; family: string; exact: boolean; embedding: Embedding }`;
    `export type ExportFontSource = { resolve(family: string, bold: boolean, italic: boolean): Promise<ResolvedFont | null> }`;
    `export function defaultFontSource(): ExportFontSource` whose `resolve` resolves `null`.
  - `src/settings/AppearanceSettings.tsx`: `export function AppearanceSettings(): JSX.Element | null` returns `null`.
  - `src/settings/SettingsNav.tsx`: `export function SettingsNav(): JSX.Element | null` returns `null`;
    `export function scrollToSettingsSection(heading: string): void` does nothing. Contract for
    S1's real version: it may be called before the Settings page has mounted, and must wait (up to
    two seconds) for a section with that heading to exist before scrolling.
  - `src/editor/blankClick.ts`: `export function blankPageClick(view: EditorView, event: MouseEvent): boolean` returns `false`.
  - `src/research/asideMotion.ts`:
    `export function useResearchAsideEntrance(aside: RefObject<HTMLElement | null>, shown: boolean, wasPointer: () => boolean): void` does nothing.
  - `ResearchPanel` props gain two optional members, unused for now:
    `footnoteLocations?: ReadonlyMap<string, { entryId: string; title: string }>` and
    `onGoToFootnote?: (footnoteId: string) => void`.
  - CSS custom property `--ui-font` on `:root`.
- Steps:
  1. Before any edit, record the baseline: run `PLAYWRIGHT_PORT=1430 npx playwright test` in the
     background with output to `docs/agent-work/2026-11-10-ui-wave-9/notes/baseline-dev.txt`.
     Make no edit and create no file under `src/` until that run has exited (the dev server serves
     the live tree, so an early edit would spoil the baseline). Read the whole log when it ends.
     This is the dev-server pass and fail list every other task compares against.
  2. Create the files above with exactly those exports.
  3. `src/main.tsx`: after the `./styles.css` import, import the five new CSS files in the order
     listed, then call `void initFonts()` before the app renders.
  4. `src/styles.css`: in the `:root` block at `:223`, add
     `--ui-font: Futura, "Avenir Next", -apple-system, BlinkMacSystemFont, sans-serif;` and set
     `font-family: var(--ui-font);`. Replace the font stacks at `:1477-1483` and `:1939-1945` with
     `font-family: var(--ui-font);`. Do not touch `.brand` (`:589`) or `.writing-surface` (`:1011`).
     Make the same replacement at each interface stack listed under Files. Leave the document-font
     rules alone (`src/editor/editor.css:534,676,716`, `src/organization/fragments.css:99`). Then
     `grep -rn "Futura" src --include=*.css` and list every remaining hit in the done note with
     one word each: logo, document, or missed.
  5. `src/Writer.tsx`: on the `div` with `ref={viewport}` (`:2041-2051`) add
     `onMouseDown={(event) => { if (editor) blankPageClick(editor.view, event.nativeEvent); }}` and
     import `blankPageClick`. Change nothing else in the file.
  6. `src/settings/GeneralSettings.tsx`: render `<AppearanceSettings />` directly after the
     theme and palette controls (`:59-80`), inside the existing General section (`:44`). There is
     no separate Appearance section today and this plan does not add one.
  7. `src/App.tsx:2436`: render `<SettingsNav />` directly after the `h1` in `div.project-settings`.
  8. `src/App.tsx:2909-2911`: add `const researchAside = useRef<HTMLElement>(null)` beside the
     other refs, put `ref={researchAside}` on the `aside.research-aside`, and call
     `useResearchAsideEntrance(researchAside, destination === "research" && !showCard, () => pointerInput.current)`
     at the top level of the component, after `pointerInput` is declared (`:1984`).
  9. `src/App.tsx:950-951`: reword the comment to say the open-beside button opens the entry in the
     pane last used when a split is open, otherwise in a new right pane.
  10. `src/research/ResearchPanel.tsx`: add the two optional props to the props type. No other edit.
- Acceptance check: `npx vitest run src/fonts/names.test.ts` -> passes, with cases for quoted,
  unquoted, single-quoted, multi-family and digit-leading values; `npx tsc -b` -> no errors;
  after the edits, a second full run `PLAYWRIGHT_PORT=1430 npx playwright test` -> no failure that
  is not in `notes/baseline-dev.txt`.
- Fail-first: write `names.test.ts` before `names.ts` has a body; it fails.
- Stop and ask if: any font stack differs from the lines recorded; the viewport `div` already has
  an `onMouseDown`; `GeneralSettings.tsx` has no theme controls; `pointerInput` is not a ref in
  scope where the hook must be called.
- Default if unanswered: none -- must ask.

### A1 -- Hover drops the grow
- Files: modify `src/styles.css:41`; modify `tests/hover-emphasis.spec.ts` (the H2 test at `:412`
  and any assertion of `1.04` in the same file).
- Interfaces: none.
- Steps:
  1. In `tests/hover-emphasis.spec.ts`, change the H2 test to expect a hover scale of exactly 1 and
     an unchanged bounding box, keep the faux-bold assertion, and rename the test to say "no grow".
  2. Run it; confirm it fails on the current tree.
  3. Set `--emph-scale: 1;` at `src/styles.css:41`. Leave the stroke, the press scale (`0.99`) and
     the Reduce Motion block as they are.
- Acceptance check: `PLAYWRIGHT_PORT=1431 npx playwright test tests/hover-emphasis.spec.ts` -> all pass.
- Fail-first: step 2.
- Stop and ask if: another spec asserts `1.04` (search `tests/` for `1.04` and `emph-scale`); list
  each hit, then apply common rule 4.
- Default if unanswered: re-pin only what you own; report the rest.
- Hand check for the note: in the built app, hover sidebar rows, toolbar text menus and Settings
  buttons; text must look thicker and stay sharp. If it is still fuzzy, the stroke is the cause:
  report it; do not change the stroke.

### A2 -- Sidebar scrollbar and sideways scroll
- Files: modify `src/styles.css:1642-1647`; modify `src/components/ProjectSidebar.tsx:595-597`;
  create `tests/w9-sidebar-scroll.spec.ts`.
- Interfaces: none.
- Steps:
  1. Write the spec: at a 1100 x 500 viewport with enough entries to overflow vertically, assert
     the computed style of `.sidebar-groups` is `overflow-x: hidden`, `overflow-y: auto`,
     `scrollbar-width: none`, that `clientWidth === offsetWidth`, and that the list still scrolls
     vertically with the wheel. Run it; the computed-style assertions fail. (Headless Chromium may
     draw no scrollbar gutter, so the width check alone is not a fail-first proof. "Cards never
     overflow" belongs to A3.)
  2. `.sidebar-groups`: `overflow-x: hidden; overflow-y: auto; scrollbar-width: none;` plus
     `.sidebar-groups::-webkit-scrollbar { display: none; }`.
  3. `ProjectSidebar.tsx:596`: attach `watchScrollFade` to `groupsContainer` in docked mode too
     (drop the `isFloating &&` condition), so the edge fade is the scroll cue.
- Acceptance check: `PLAYWRIGHT_PORT=1432 npx playwright test tests/w9-sidebar-scroll.spec.ts tests/scroll-fade.spec.ts tests/floating.spec.ts` -> all pass.
- Fail-first: step 1.
- Stop and ask if: the fade's CSS only exists under `.is-floating` (then the docked sidebar would
  get the attribute but no visible fade).
- Default if unanswered: keep step 2, skip step 3, and say so in the note.

### A3 -- Card view polish
- Files: modify `src/styles.css:731-744,1737-1774,1807-1815,2022-2025`; modify
  `src/components/ProjectSidebar.tsx` only if a class or data attribute is missing; create
  `tests/w9-cards.spec.ts`.
- Interfaces: none.
- Steps:
  1. Write the spec, in card view, at sidebar widths 220, 254 and 420 px, with one entry whose
     title is a 60-character unbroken word, one Fragments entry whose preview text is a 200-character
     unbroken word, and one research source with an attached PDF. Assert: the list's
     `scrollWidth <= clientWidth`; every Synopsis input and Notes row is inside its card;
     every `.cards-view .entry-row` has `right <=` the list's right edge and `left >=` its left
     edge; in the Research section every card is at most 40 px tall and all cards share one `left`
     except the PDF child, which is indented; the `.open-beside` button's box is at least 8 px
     inside the card's top and right borders. Run it; it fails.
  2. Cards: `min-width: 0` and `max-width: 100%` on `.cards-view .entry-row` and its `.entry-main`;
     titles truncate with an ellipsis on one line.
  3. Research section in card view: one column at every width (exclude it from the two-column rule
     at `:1812-1815`), no preview or details block, the row's normal one-line height.
  4. Empty boxes: in card view, a card whose synopsis and notes are both empty hides the Synopsis
     input and the Notes row at rest and shows them while the card is the open entry or contains
     keyboard focus. Hover alone does not reveal them, so moving the pointer never shifts cards.
     A card with text in either box always shows both. Add to the spec: an empty card's boxes are
     hidden at rest and on hover, visible once the card is opened, visible after Tab into the card,
     and a card with a synopsis shows them at rest.
  5. `.cards-view .reorder`: `top: var(--space-3); right: var(--space-3);` and no extra padding on
     its button, so the icon aligns with the card's content edge.
- Acceptance check: `PLAYWRIGHT_PORT=1433 npx playwright test tests/w9-cards.spec.ts tests/alignment.spec.ts tests/sidebar-selection.spec.ts` -> all pass.
- Fail-first: step 1.
- Stop and ask if: the Research section cannot be told apart from Manuscript and Fragments by an
  existing class or attribute.
- Default if unanswered: add `data-section="research"` to that section's list element in
  `ProjectSidebar.tsx` and select on it.

### B1 -- Font menu: one entry per font, full name; distinct Prose check icon
- Files: modify `src/Writer.tsx:159-167,178-186,1125-1126,1328-1351,1759`; modify
  `src/editor/editor.css:181-191`; create `tests/w9-font-menu.spec.ts`.
- Interfaces: uses `sameFont`, `primaryFamily` from `src/fonts/names.ts`, and
  `useDocumentFontOptions` from `src/fonts/registry.ts` (T0; C3 fills it in later). Provides: the
  document font dropdown shows `useDocumentFontOptions()` after the built-in list.
- Steps:
  1. Write the spec: select text, choose Times New Roman from the font dropdown, click elsewhere in
     the same text, reopen the dropdown. Assert the option list contains exactly one entry whose
     text is "Times New Roman", no option text or button text contains a quote character, and at a
     1400 px wide window the button's text is the full "Times New Roman" with `scrollWidth <=
     clientWidth`. Also assert the Prose check and Page setup buttons' `svg` markup differs. Run it;
     it fails.
  2. `fontValue` (`:1125`): if the mark's value matches a known option by `sameFont`, use that
     option's `value`; otherwise keep the raw value.
  3. Font dropdown (`:1328-1351`): options are `FONT_FACES` plus `useDocumentFontOptions()`,
     dropping any later option that is `sameFont` as an earlier one; the fallback label passed to
     `withCurrent` is `primaryFamily(fontValue)`.
  4. Replace `width={124}` with a width that fits the label: remove the prop and, in `editor.css`,
     give the font dropdown button `min-width: 124px; max-width: 220px` with ellipsis only past the cap.
  5. Prose check button (`:1759`): use the `SpellCheck` icon from `lucide-react`; Page setup keeps
     `Settings2`.
- Acceptance check: `PLAYWRIGHT_PORT=1434 npx playwright test tests/w9-font-menu.spec.ts tests/editor-toolbar.spec.ts` -> all pass.
- Fail-first: step 1.
- Stop and ask if: `SpellCheck` is not exported by the installed `lucide-react`; the wider dropdown
  pushes toolbar icons into the More menu at 1100 px (`tests/editor-toolbar.spec.ts` or
  `tests/popover-bounds.spec.ts` will show it).
- Default if unanswered: icon -> `SpellCheck2`, then `TextSearch`; width -> lower the cap to 180 px.

### B2 -- Prose check menu spacing
- Files: modify `src/components/ProseIssues.tsx:41-65`; fill `src/components/prose-issues.css`;
  create `tests/w9-prose-menu.spec.ts`.
- Interfaces: none.
- Steps:
  1. Write the spec: open Prose check. Assert all rule checkboxes share one `right` edge within
     0.5 px (include the "On" row above them if it is in the same panel); each rule row shows its
     own count; hovering a rule row does not move its checkbox (same box before and during
     hover, within 0.5 px); with one page of results no element named "Previous issue page" or
     "Next issue page" is visible. Run it; it fails.
  2. Lay each rule row out as label, count, checkbox on a three-column grid in `prose-issues.css`;
     remove the inline `style` on the status line.
  3. Replace the long run-on status line with one short line: "N issues" (or the existing pending
     and unavailable messages). Per-rule counts move into the rows.
  4. Render the pagination row only when `pageCount > 1`.
- Acceptance check: `PLAYWRIGHT_PORT=1435 npx playwright test tests/w9-prose-menu.spec.ts tests/writing-aids.spec.ts` -> all pass.
- Fail-first: step 1.
- Stop and ask if: the "On" row is rendered outside `ProseIssues.tsx` and its checkbox cannot be
  aligned from `prose-issues.css` alone.
- Default if unanswered: align the four rule rows only and name the file that renders "On" in the note.

### B3 -- Standalone icons magnify
- Files: fill `src/components/icon-magnify.css`; create `tests/w9-icon-magnify.spec.ts`.
- Interfaces: none.
- Steps:
  1. Write the spec: for a project row's `.delete-entry`, a sidebar `.open-beside` button (list
     and card view), and a test button with class `icon-grow` that the spec injects into the page
     (one with an `svg` child, one with a `span` child), assert the child's computed transform is
     a scale of 1.25 on hover and on keyboard focus, the button's own box
     does not change size, and with Reduce Motion emulated the scale stays 1. Run it; it fails.
  2. This is a plain 25 percent grow, not the toolbar's dock (no neighbour falloff). One rule in
     `icon-magnify.css`, for `.icon-grow`, `.project-row .delete-entry`, `.open-beside` and
     `.collection-open-beside`: the direct `svg` or `span` child gets `display: inline-block` (span
     only), `transition: transform var(--duration-fast) var(--ease-out)`, and on the button's
     `:hover, :focus-visible` `transform: scale(1.25)`; a `prefers-reduced-motion: reduce` block that removes it. Scale the `svg`,
     never the button (the press rule owns the button's transform).
- Acceptance check: `PLAYWRIGHT_PORT=1436 npx playwright test tests/w9-icon-magnify.spec.ts tests/projects-screen.spec.ts` -> all pass.
- Fail-first: step 1.
- Stop and ask if: the trash or open-beside button has no direct `svg` child.
- Default if unanswered: none -- must ask. (P1 adds `icon-grow` to the Projects page icon buttons;
  this task does not edit `ProjectLibrary.tsx`.)

### B4 -- Open beside replaces the pane last used
- Files: modify `src/split.ts:89-102`, `src/split.test.ts`; modify `tests/split-view.spec.ts` only
  if an existing test contradicts the new rule; create `tests/w9-open-beside.spec.ts`.
- Interfaces: `openBeside(split: Split | null, active: string, target: PaneContent): Split | null`
  keeps its signature; callers at `src/App.tsx:575` and `:955` are not edited.
- Steps:
  1. Add unit tests: (a) no split, entry target -> today's result; (b) split with `focused: "left"`,
     entry target `c` -> `left` becomes `c`, right unchanged, `focused: "left"`; (c) split with
     `focused: "right"`, entry `c` -> right becomes `c`; (d) target already shown in the other pane
     -> no pane changes, focus moves to that pane; (e) PDF target -> right pane, any focus. Run;
     (b) and (d) fail.
  2. In `openBeside`: when `split` is not null and the target is an entry, return
     `select(split, target.id)`. Otherwise keep the current body. Update the doc comment.
  3. Browser spec: open a split, click into the left pane, press a third entry's Open beside
     button; the left pane shows it and the right pane is unchanged. Repeat for the right pane.
- Acceptance check: `npx vitest run src/split.test.ts` -> all pass;
  `PLAYWRIGHT_PORT=1437 npx playwright test tests/w9-open-beside.spec.ts tests/split-view.spec.ts` -> all pass.
- Fail-first: step 1.
- Stop and ask if: an existing split-view test expects Open beside to change the right pane while
  the left pane is focused.
- Default if unanswered: re-pin that test to the new rule and quote the old expectation in the note.

### B5 -- Blank-page click places the caret
- Files: fill `src/editor/blankClick.ts`; create `src/editor/blankClick.test.ts`,
  `tests/w9-blank-click.spec.ts`.
- Interfaces: `blankPageClick(view: EditorView, event: MouseEvent): boolean`, already called from
  the viewport's `onMouseDown` (T0). Returns true only when it handled the click.
- Steps:
  1. Browser spec, in continuous and page view, with three short paragraphs: (a) click 40 px below
     the last line -> editor focused, caret at the document end, typing appends; (b) click in the
     left margin level with paragraph 2 -> caret at the start of that line; (c) click in the right
     margin level with paragraph 2 -> caret at the end of that line; (d) shift-click in the margin
     extends the selection; (e) clicks on the ruler, a footnote marker, a page gap and inside text
     behave as before. For each of (a) to (c), also log which element receives the click
     (`document.elementFromPoint`) and put the list in the note. Run it; (a) to (d) fail.
  2. Return false when: the button is not 0; ctrl, meta or alt is held; or `event.target` is a
     descendant of `view.dom` other than `view.dom` itself (a click on the writing surface's own
     padding or empty min-height area counts as blank), or is inside `.document-ruler`, `.side-ruler`, `.page-spacer`, an element with
     `data-footnote-id`, or any `button, a, input, textarea, select, [role="slider"]`.
  3. Otherwise: let `r` be `view.dom.getBoundingClientRect()`. If `event.clientY` is below the
     bottom of the last child of `view.dom`, target the document end. Else call
     `view.posAtCoords({ left: clamp(event.clientX, r.left + 1, r.right - 1), top: clamp(event.clientY, r.top + 1, r.bottom - 1) })`
     and use its `pos`; if null, target the document end.
  4. Dispatch `TextSelection` at the target (extend from the current anchor when shift is held),
     with `scrollIntoView()`, call `event.preventDefault()` and `view.focus()`, return true.
  5. Unit test the decision in step 2 with a fake target chain.
- Acceptance check: `npx vitest run src/editor/blankClick.test.ts` -> pass;
  `PLAYWRIGHT_PORT=1438 npx playwright test tests/w9-blank-click.spec.ts tests/pages-gap.spec.ts tests/ruler.spec.ts tests/footnotes.spec.ts` -> all pass.
- Fail-first: step 1.
- Stop and ask if: all of (a) to (d) already pass on the untouched tree (then the reported dead
  zone is somewhere this plan did not find; report the `elementFromPoint` list); ProseMirror's own
  mouse handling undoes the selection on mouse-up when the target is `view.dom`; in a split, a
  blank click in the unfocused pane does not move the toolbar to
  that pane (pane focus is routed in `src/App.tsx`, which this task does not own).
- Default if unanswered: none -- must ask.
- Hand check for the note: the same five cases in the built app at 100% and 150% zoom.

### B6 -- PubMed, PMC and PMID lookup
- Files: modify `src/research/lookup.ts`, `src/research/lookup.test.ts`.
- Interfaces: `lookupIdentifier(input, options)` keeps its signature. `LookupIdentifier` gains
  `{ kind: "pmid"; pmid: string }`.
- Steps:
  1. Add tests with a fake `fetchText`: `https://pubmed.ncbi.nlm.nih.gov/33301246/`,
     `https://pubmed.ncbi.nlm.nih.gov/33301246`, `PMID: 33301246`, `pmid 33301246`, and
     `https://pmc.ncbi.nlm.nih.gov/articles/PMC7745181/` each end in a Crossref request for the DOI
     the fake returns; a record with no DOI yields a journal-article draft from the summary's own
     title, authors, journal, volume, issue, pages and year; an NCBI failure on a PubMed web address
     falls back to the old page fetch. Run; they fail.
  2. `parseIdentifier`: recognise `PMID` followed by 1 to 9 digits, and web addresses on
     `pubmed.ncbi.nlm.nih.gov/<digits>`. A bare number with no `PMID` prefix is not a PMID.
  3. PMID lookup: GET
     `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi?db=pubmed&id=<pmid>&retmode=json`;
     read `result[<pmid>]`; if `articleids` has `idtype === "doi"`, return `lookupDoi` for it;
     else map the summary to a draft and `finish(draft, "PubMed", today)`.
  4. PMC web addresses (`/articles/PMC<digits>`): GET
     `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi?db=pmc&id=<digits>&retmode=json`
     and treat it the same way.
  5. Send no email, API key or tool parameter. Do not change `src-tauri/src/lookup.rs` or its user agent.
- Acceptance check: `npx vitest run src/research/lookup.test.ts` -> all pass.
- Fail-first: step 1.
- Stop and ask if: the live summary JSON does not have the shape assumed (check once with
  `curl -s "<the step 3 address with id=33301246>"`, using curl's default user agent or the app's).
- Default if unanswered: none -- must ask.
- Hand check for the note: in the built app, paste the owner's PubMed link for the Gupta article.

### C1 -- Research panel: three zones, less text
- Files: modify `src/research/ResearchPanel.tsx`, `src/research/SourceForm.tsx`,
  `src/research/research.css`, `tests/research.spec.ts` (re-pins only); create
  `tests/w9-research-panel.spec.ts`.
- Interfaces: none. Field labels, `Cite here`, `Add quote`, `Delete source` and the lookup field
  keep their accessible names (other specs find them by name).
- Steps:
  1. Read section 1 of `docs/agent-work/2026-11-05-ui-wave-8/IDEAS.md` (idea A) and
     `docs/design-system.md`.
  2. Write the spec with one journal-article source that has four authors and one footnote. Assert:
     (a) headings "Source", "Citation", "Used in" exist in that order; (b) the Cite here button's
     top is less than 700 px below the open source's title at a 420 px wide panel; (c) a collapsed
     `details` named "More details" contains Short title, Edition, DOI, URL, the three manual
     override fields and the PDF attach control, and every one of those fields is still present
     after opening it; (d) the text "When supplied, this exact text overrides automatic formatting."
     appears at most once; (e) the Authors label's bottom edge is at or above the first author
     input's top edge; (f) the two repeat-citation checkboxes sit inside a collapsed row named
     "Citation rules" below the source list; (g) a line containing "needs an internet connection"
     is visible under the lookup field. Run it; it fails.
  3. Reorder an open source into: Source (type, authors, title, the kind-specific fields);
     Citation (Note, Shortened note and Bibliography previews, then the actions row with Cite here,
     Add quote and Delete source at the far right); More details (collapsed, every remaining field,
     one helper sentence for the three overrides); Used in (the existing footnote and quote lists
     with a count line such as "Used in 1 footnote, 0 quotes").
  4. Move the two repeat-citation checkboxes into a collapsed "Citation rules" row below the source
     list. Remove the "Review required details" sentence when core fields are present; keep it when
     a required field is missing.
  5. Fix the Authors label overlap found in (e); find the cause before changing spacing.
  6. Under the lookup field add one muted line: "Lookup needs an internet connection -- everything
     else works offline."
  7. Used in: when the `footnoteLocations` prop has an entry for a footnote, its row starts with
     "in <section title>"; when `onGoToFootnote` is supplied, the row has a text button "Go to"
     that calls it with the footnote id. When the prop is absent, or has no entry for a footnote,
     the row shows no location text and no Go to. G1's spec covers the wired behaviour; this
     task's spec asserts only that the panel renders without the props.
  8. Re-pin `tests/research.spec.ts` where it counts `hr.research-rule` or depends on field order.
- Acceptance check: `PLAYWRIGHT_PORT=1439 npx playwright test tests/w9-research-panel.spec.ts tests/research.spec.ts tests/research-library.spec.ts tests/research-pdf.spec.ts tests/floating.spec.ts tests/zotero.spec.ts` -> all pass.
- Fail-first: step 2.
- Stop and ask if: a field would have to be removed, not moved; the floating citation card
  (`src/research/CitationCard.tsx`) needs a change; a re-pin is needed outside the four listed specs.
- Default if unanswered: keep every field, leave the card alone, apply common rule 4.

### C2 -- Font storage in the native app
- Files: create `src-tauri/src/fonts.rs`; modify `src-tauri/src/lib.rs` (module line and both
  handler lists at `:237-270`, `:272-292`).
- Interfaces: provides four commands that C3 calls by name:
  - `font_add(file_name: String, family: String, style: String, data: Vec<u8>) -> Result<FontMeta, String>`
  - `font_list() -> Result<Vec<FontMeta>, String>`
  - `font_read(id: String) -> Result<Vec<u8>, String>`
  - `font_remove(id: String) -> Result<(), String>`
  - `FontMeta` serialises as `{ "id", "family", "style", "fileName", "format" }`; `style` is one
    of `regular`, `bold`, `italic`, `boldItalic`; `format` is `ttf` or `otf`.
- Steps:
  1. Store files in a `fonts` folder beside the project database (the folder `storage_path`
     reports), one file `<id>.<format>` per font file, plus `fonts/index.json` listing `FontMeta`.
  2. `font_add`: accept only `.ttf` and `.otf` names (any case); size 1 byte to 20 MB; first four
     bytes `00 01 00 00` or `true` for ttf, `OTTO` for otf. The caller supplies `family` and
     `style` (the app reads them from the file); keep only letters, digits, space, `_`, `-` and
     `.` in `family`, trimmed, 1 to 64 characters, and reject an unknown `style`. `id` is the family
     lowercased with spaces as `-`, then `-`, then the style. Reject a family and style pair that
     already exists (family compared ignoring case) with "That font is already added". Error text
     is plain English.
  3. `font_read` and `font_remove` accept only an `id` present in the index (no path building from
     input). `font_remove` deletes that one file and its index entry.
  4. Write the index atomically (temp file, then rename).
  5. Register all four commands in both handler lists.
  6. Do not change `src-tauri/tauri.conf.json`.
  7. Unit tests in `fonts.rs` with a temp folder: add, list, read back identical bytes; a second
     style of the same family is accepted; a duplicate family and style is rejected; wrong magic,
     oversize, unknown style and a `../x` id are rejected; remove then list is empty.
- Acceptance check: `cd src-tauri && cargo test fonts` -> all pass; `cargo check` and
  `cargo check --features native-smoke` -> no errors.
- Fail-first: n/a: new module; the tests cannot exist before it.
- Stop and ask if: the storage folder is not reachable from a command the way `storage_path` does
  it; a new crate would be needed.
- Default if unanswered: none -- must ask.

### C3 -- Fonts in the app: interface font, Add font, installed fonts
- Files: fill `src/fonts/store.ts`, `src/fonts/registry.ts`, `src/settings/AppearanceSettings.tsx`,
  `src/settings/appearance-settings.css`; create `src/fonts/fontInfo.ts`,
  `src/fonts/fontInfo.test.ts`, `src/fonts/registry.test.ts`, `src/fonts/store.test.ts`,
  `tests/w9-fonts.spec.ts`.
- Interfaces: uses C2's command names through `invoke` when `"__TAURI_INTERNALS__" in window`, and
  `listSystemFamilies` from `src/fonts/system.ts` (T0 stub; C6 fills it). Provides the T0
  signatures with real bodies, including `readFontInfo` in `src/fonts/fontInfo.ts`. B1, C4 and C7
  already call these through the stubs.
- Steps:
  1. Test fonts: do not add a font file to the repository and do not download one. In specs and
     unit tests, read `/System/Library/Fonts/Supplemental/Trebuchet MS.ttf`,
     `Trebuchet MS Bold.ttf` and `Trebuchet MS Italic.ttf` at run time (browser spec: upload with
     `setInputFiles`). Skip those cases with a clear message if the files are missing.
  2. `fontInfo.ts`: load `@pdf-lib/fontkit` with a dynamic import and read the family (typographic
     family if present, else family name), the style (bold and italic flags from the font's own
     style data, falling back to the subfamily name), and the font's embedding permission as one of
     `installable`, `editable`, `preview` (preview and print only) or `restricted`. A file fontkit cannot read rejects with "That file is not a font this app
     can read".
  3. `store.ts`: `addUserFont(file)` reads the bytes, calls `readFontInfo`, then stores. Native
     branch calls `font_add` (`fileName`, `family`, `style`, `data` as a number array), `font_list`,
     `font_read`, `font_remove`. Browser branch keeps the same data in an IndexedDB database named
     `personal-word.fonts` and applies the same rules and error sentences as C2 step 2.
  4. `registry.ts`:
     - `BUILT_IN_FONTS`: Futura, Avenir Next, Helvetica Neue, System (`-apple-system,
       BlinkMacSystemFont`), Gill Sans, Optima, Verdana, Georgia, Charter, Times New Roman. Each
       `stack` ends in `sans-serif` or `serif` as fits.
     - Interface font preference under the storage key `folio.workspace.interfaceFont` (a stack
       string; absent means Futura). Applying it sets `--ui-font` on `document.documentElement`.
     - `initFonts()`: apply the saved interface font; load every stored file with
       `new FontFace(family, bytes, { weight, style })` (bold files weight 700, italic files style
       italic) and `document.fonts.add`; then fetch `listSystemFamilies()` once. A font that fails
       to load is skipped.
     - `useUserFonts()`: a hook over a small module-level store so Settings, the toolbar and every
       pane update together after add or remove. Add `useSystemFamilies(): string[]` the same way.
     - `export function buildDocumentFontOptions(userFonts: UserFont[], systemFamilies: string[]): FontOption[]`
       (pure): one option per distinct added family (`value: fontValue(family)`, `label: family`,
       styled in its own face), then one option per installed family not already listed (`value:
       fontValue(family)`, `label: family`, no per-option face, so several hundred stay fast).
       `useDocumentFontOptions()` returns it for the current added and installed fonts.
  5. `AppearanceSettings.tsx`: a labelled "Interface font" dropdown (built-in fonts, added families,
     then installed families) using the existing `Dropdown`; a small "Add font..." text button
     that opens a file picker limited to `.ttf,.otf` and accepts several files at once; under it
     the added families, each showing which styles it has (for example "Regular, Bold") and a
     "Remove" button (danger colour) that removes all of that family's files. Errors use the app's
     existing notice style. No new hover rules.
  6. If the saved interface font is an added family that is later removed, fall back to Futura.
  7. Browser spec: choose Georgia -> on the Projects page, the workspace (sidebar, toolbar, an
     open dropdown, the command palette, the Research panel, a citation card) and Settings, every
     visible element with its own text has a computed font family starting with Georgia, except
     `.brand`, document text (`.writing-surface`, previews of document text) and code; `.brand`
     is unchanged; reload -> still Georgia. Upload the three Trebuchet files -> one family
     "Trebuchet MS" listed with three styles; it appears once in the Interface font dropdown and
     once in the document font dropdown; applied to text, the computed family names it. Trebuchet
     MS is also installed on this Mac, so prove the uploaded files are the ones loaded: assert
     `document.fonts` holds three entries with family "Trebuchet MS", one of weight 700 and one of
     style italic, each with status `loaded`, and none before the upload. Uploading the
     regular file again shows "That font is already added". A `.txt` renamed to `.ttf` shows the
     read error. Remove -> gone from both menus.
  8. Unit test `buildDocumentFontOptions`: order, no duplicates, quoted
     values, a digit-leading family ("Source Sans 3").
- Acceptance check: `npx vitest run src/fonts` -> all pass;
  `PLAYWRIGHT_PORT=1440 npx playwright test tests/w9-fonts.spec.ts tests/appearance.spec.ts` -> all pass.
- Fail-first: write the spec first; it fails against the T0 stubs.
- Stop and ask if: `tests/appearance.spec.ts:546` (centred column, Sidebar section's five
  checkboxes) breaks because of the new controls; the existing `Dropdown` cannot scroll a list of
  several hundred options or has no keyboard type-ahead.
- Default if unanswered: appearance spec -> common rule 4; Dropdown -> cap its menu height with a
  scroll in `appearance-settings.css` for these two menus only and report the type-ahead gap.
- Hand check for the note: in the built app, add a real font family (two files), quit, relaunch,
  confirm it is still listed and applied; open both font menus and confirm installed fonts are
  listed (needs C6). This is the only proof of native storage and of the security policy. If a
  font is listed but not applied in the built app, report it: the fix is a `font-src` entry in
  `src-tauri/tauri.conf.json`, which needs the owner's OK.

### C4 -- Fonts in PDF export
- Files: modify `src/export/pdf.ts`; create `src/export/fontSource.ts`,
  `src/export/fontSource.test.ts`, `src/export/pdf-fonts.test.ts`.
- Interfaces: uses `listUserFonts`, `userFontBytes` (`src/fonts/store.ts`), `systemFontFile`
  (`src/fonts/system.ts`), `sameFont`, `primaryFamily` (`src/fonts/names.ts`), `readFontInfo`
  (`src/fonts/fontInfo.ts`; a T0 stub that rejects until C3 lands, so treat a rejection as
  `embedding: "restricted"` in real use and inject a fake in tests). Provides the real body of
  `defaultFontSource()` in `src/export/fontSource.ts` (types fixed by T0), used by C7 as well.
  `exportPdf` gains an optional last parameter `fontSource?: ExportFontSource`, defaulting to
  `defaultFontSource()`; callers in `src/export/ExportPanel.tsx` are not edited.
- Steps:
  1. `defaultFontSource().resolve`: (a) an added family that matches by `sameFont`: the file with
     the requested style, else its regular file, else any file (`exact` false when the style
     differs); (b) otherwise `systemFontFile(family, bold, italic)`; return null when it is null or
     when `collection` is true. Every result carries the `embedding` level from `readFontInfo`.
     Never throw: a failure is null.
     Unit test each branch with fakes.
  2. PDF test with a fake `fontSource` serving one bundled Noto file as "Test Face": a project with
     a run `fontFamily: '"Test Face", sans-serif'` exports with one more embedded font than the
     same project without that run; a bold run asks for `bold: true`; a character the font lacks
     still exports (bundled fallback); a family the source returns null for exports exactly as
     today; a source that rejects exports exactly as today. Run; the first case fails.
  3. Before segmentation, collect the distinct (family, bold, italic) triples of body runs that
     carry a font value and resolve each once. Use a result unless its `embedding` is
     `restricted` (preview-and-print fonts may go in a PDF).
  4. In `segment` (`:116-130`): a character in a run whose triple resolved, and that the font's
     character set contains, gets a key outside the bundled key space; every other character
     keeps today's key.
  5. Embed each resolved font once with `subset: true` beside the bundled ones (`:174-184`) and
     let `font(r)` return it for those keys. Width measurement must use the same font.
  6. Notes, bibliography and running headers are unchanged. Text with no font applied is unchanged.
- Acceptance check: `npx vitest run src/export` -> all pass, including the existing PDF tests.
- Fail-first: step 2.
- Stop and ask if: the `PdfFontKey` type cannot carry the new keys without changes outside
  `src/export/pdf.ts`; a real `.otf` with CFF outlines fails to embed.
- Default if unanswered: keep a second map inside `pdf.ts`; for the embed failure, fall back to
  the bundled font for that run and record it for `docs/limitations.md`.
- Hand check for the note: export a PDF with one paragraph each in an added font, Georgia and
  Futura; open it in Preview and read Tools > Show Inspector > Fonts. Georgia should be listed;
  Futura is a collection file and is expected to fall back.

### C5 -- Side ruler
- Files: modify `src/Writer.tsx` (ruler block `:2053-2125`, drag state `:556-616`); create
  `src/editor/SideRuler.tsx`; fill `src/editor/side-ruler.css`; create `tests/w9-side-ruler.spec.ts`.
- Interfaces: uses the existing `rulerShown`, `focusMode`, `layout`, `geometry`, `pages`,
  `pageStyle.zoom` and the ruler drag helpers in `Writer.tsx`. Provides `.side-ruler` (B5 already
  ignores clicks on it).
- Steps:
  1. Browser spec: Ruler on, page view, two pages. Assert one `.side-ruler` per page, each as tall
     as its page sheet, its right edge within 1 px of the paper's left edge, inch numbers 1 to 10
     on Letter; shaded top and bottom bands each equal to the margin in px; changing the margin
     with the top ruler updates the bands; dragging the top-margin marker down by 48 px raises the
     margin by 48 px (within the 24..192 clamp) and the top ruler's markers move with it; arrow
     keys on the marker change the margin; Ruler off, continuous view and focus mode show no side
     ruler; at 150% zoom the ticks still line up with the page; with the floating sidebar shown
     the side ruler is hidden. Run it; it fails.
  2. `SideRuler.tsx`: props `{ pageIndex: number; geometry: ReturnType<typeof paperGeometry>; margin: number; onDragStart(event: ReactPointerEvent): void; onKeyDown(event: ReactKeyboardEvent): void }`.
     Renders a 16 px wide strip: a tick every 12 px, a number every 96 px, shaded bands for the top
     and bottom margin, and two `role="slider"` markers named "Adjust top and bottom margins from
     the top" and "... from the bottom".
  3. `Writer.tsx`: in page view with `rulerShown && !focusMode`, render one `SideRuler` per page
     next to each `.page-sheet`, at `top: page * (geometry.height + geometry.gap)`, inside the
     zoomed paper so it scales with zoom. Reuse the existing margin drag (kind `"margin"`), with
     the vertical pointer distance as the delta, so preview and commit behave like the top ruler.
  4. `side-ruler.css`: position the strip immediately left of the paper edge; reuse the top
     ruler's tick, number and marker styles (`editor.css:445-490`) by matching their tokens, not by
     editing `editor.css`. Hide it while the sidebar floats:
     `.app:has(.sidebar-shell.is-floating) .side-ruler { display: none; }`.
- Acceptance check: `PLAYWRIGHT_PORT=1441 npx playwright test tests/w9-side-ruler.spec.ts tests/ruler.spec.ts tests/pages.spec.ts tests/pages-zoom.spec.ts tests/split-view.spec.ts` -> all pass.
- Fail-first: step 1.
- Stop and ask if: the drag helpers cannot take a vertical delta without changing how the top
  ruler computes its own; there is less than 16 px left of the paper at the default sidebar width
  and 1100 px window.
- Default if unanswered: first -> ship the ruler with shaded margins and keyboard-adjustable
  markers, no pointer drag, and say so in the note; second -> draw the strip over the paper's left
  edge inside the margin (the margin is never under 24 px).
- Hand check for the note: built app, 100% and 150% zoom, single pane and split.

### C6 -- Installed fonts in the native app
- Files: create `src-tauri/src/sysfonts.rs`; modify `src-tauri/src/lib.rs` (module line and both
  handler lists), `src-tauri/Cargo.toml:26-45`; fill `src/fonts/system.ts`; create
  `src/fonts/system.test.ts`.
- Interfaces: provides commands `system_font_families() -> Result<Vec<String>, String>` and
  `system_font_file(family: String, bold: bool, italic: bool) -> Result<Option<SystemFontFile>, String>`
  where `SystemFontFile` serialises as `{ "data": number[], "postscriptName": string, "collection": boolean }`;
  and the real bodies of `listSystemFamilies` and `systemFontFile` (T0 signatures), which return
  `[]` and `null` outside the native app or on any error.
- Steps:
  1. Declare `objc2-core-text` (and `objc2-core-foundation` if needed) under the macOS
     dependencies at the versions already in `Cargo.lock`, with only the feature flags used.
     Run `cargo check --offline` first: it must succeed without downloading anything.
  2. `system_font_families`: the available family names from Core Text, sorted, without names
     that start with `.` (system-private faces).
  3. `system_font_file`: find the face of that family with the requested bold and italic traits,
     read its file through the font's file URL, and return the bytes, its PostScript name, and
     `collection: true` with empty `data` when the file is a `.ttc` or `.otc` (first four bytes
     `ttcf`); callers skip collections. Return
     `None` when there is no such family, no file URL, or the file is over 30 MB. Read only the
     path Core Text returns; never build a path from the `family` argument.
  4. Register both commands in both handler lists.
  5. Rust tests (macOS only): the family list contains "Georgia"; Georgia regular returns bytes
     starting `00 01 00 00` and `collection: false`; Georgia bold returns different bytes;
     "Futura" returns `collection: true` and no bytes; an unknown family returns `None`.
  6. `system.ts` unit test with a mocked `invoke`: shapes are mapped, errors become `[]` and `null`.
- Acceptance check: `cd src-tauri && cargo test sysfonts` -> all pass; `cargo check` and
  `cargo check --features native-smoke` -> no errors; `npx vitest run src/fonts/system.test.ts` -> pass.
- Fail-first: n/a: new module.
- Stop and ask if: `cargo check --offline` fails because a crate or feature is not in
  `Cargo.lock`; Core Text gives no file URL for ordinary fonts.
- Default if unanswered: none -- must ask (declaring Core Text is the only dependency change on the
  table; new downloads are not).

### C7 -- Fonts in Word export
- Files: modify `src/export/docx.ts`; create `src/export/docx-fonts.test.ts`.
- Interfaces: uses `ExportFontSource` and `defaultFontSource` from `src/export/fontSource.ts`
  (types and a null-returning stub from T0; C4 fills it). Tests inject a fake source.
  `exportDocx` gains an optional last parameter `fontSource?: ExportFontSource`; callers are not edited.
- Steps:
  1. Read `FontOptions` at `node_modules/docx/dist/index.d.ts:3989-4001` and the `fonts` document
     option at `:7018`.
  2. Test with a fake source: a project with a run in "Test Face" produces a `.docx` whose zip
     contains an embedded font part and whose font table names "Test Face"; with a source that
     returns null the output has no embedded font part and the run still names the font, as today;
     a source that rejects exports as today. Run; the first case fails.
  3. Collect the distinct (family, bold, italic) triples of runs that carry a font value, resolve
     each once, and pass the resolved files whose `embedding` is `installable` or `editable` to the
     document's `fonts` option under the run's family name (a Word file is editable, so
     preview-only and restricted fonts are not embedded). One entry per family; when several styles resolved, embed the regular file.
  4. Run font names are written exactly as today (`:69-72`, `:83`).
- Acceptance check: `npx vitest run src/export` -> all pass, including the existing Word tests.
- Fail-first: step 2.
- Stop and ask if: `FontOptions` cannot take raw `.ttf` bytes; embedding an `.otf` makes the
  library throw.
- Default if unanswered: embed `.ttf` only, skip others, and record it for `docs/limitations.md`.
- Hand check for the note: export a `.docx` with a paragraph in an added font; open it in Word and
  in Pages on this Mac and report whether each shows the font. Whether Word for Mac uses embedded
  fonts is unknown; report what you see, do not claim it works.

### E1 -- Export menu in the header
- Files: modify `src/App.tsx` (header at `:2388-2410`, the shortcut dispatch, the command palette
  command list), `src/export/ExportPanel.tsx`, `src/shortcuts/registry.ts`; create
  `src/export/ExportMenu.tsx`, `src/export/exportActions.ts`, `src/export/exportActions.test.ts`,
  `tests/w9-export-menu.spec.ts`.
- Interfaces: uses `scrollToSettingsSection("Export document")` from `src/settings/SettingsNav.tsx`
  (T0 stub; S1 fills it). Provides `src/export/exportActions.ts`:
  `export type ExportFormat = "docx" | "pdf" | "markdown" | "markdown-bundle" | "plain"` and
  `export async function exportProject(project: Project, format: ExportFormat): Promise<"saved" | "canceled">`
  (throws an `Error` with a readable message on failure). G1 edits `src/App.tsx` after this task.
- Steps:
  1. Read `docs/design-system.md` (Popover, text controls) and
     `docs/agent-work/2026-11-05-ui-wave-8/IDEAS.md` section 2, idea E1.
  2. Browser spec: the header has a button named "Export" next to Snapshot and no button named
     "Export portable project"; clicking it opens a menu with, in order, Word (.docx), PDF,
     Markdown, Markdown with images (.zip), Plain text, a rule, "Export settings...", "Complete
     project (.json)"; choosing Plain text triggers one download with the project's file name;
     "Export settings..." shows Settings with the Export document section in view; Cmd+Shift+E
     opens the menu with focus on its first item; the command palette lists "Export..."; the
     menu works from the keyboard (arrows, Enter, Escape returns focus to the button); at a
     1100 px window with a 60-character project title the header does not wrap or overlap. Run it;
     it fails.
  3. Move the bodies of `save`, `saveText` and `saveMarkdownBundle` (`ExportPanel.tsx:48-110`) into
     `exportProject` unchanged in behaviour; `ExportPanel` calls `exportProject` and keeps its own
     busy and message state and its buttons. Unit test `exportProject` for "canceled".
  4. `ExportMenu.tsx`: a text button "Export" that opens the existing `Popover` menu pattern (the
     one the create menu uses) with the items in step 2. Results and errors show through the app's
     existing notice. "Complete project (.json)" runs the code now behind the portable-project
     icon (`App.tsx:2391-2400`), passed in as a prop.
  5. `App.tsx`: replace the portable-project icon button with `<ExportMenu ... />`.
  6. `registry.ts`: add `{ id: "exportDocument", label: "Export", scope: "app", default: { key: "e", meta: true, shift: true } }`;
     handle it where the other app-scope shortcuts are dispatched by opening the menu; add
     "Export..." to the command palette's commands the same way "Take snapshot" is added.
- Acceptance check: `npx vitest run src/export/exportActions.test.ts src/shortcuts` -> pass;
  `PLAYWRIGHT_PORT=1442 npx playwright test tests/w9-export-menu.spec.ts tests/shortcuts.spec.ts tests/command-palette.spec.ts tests/markdown-roundtrip.spec.ts tests/features.spec.ts` -> all pass.
- Fail-first: step 2.
- Stop and ask if: an existing spec clicks "Export portable project" (search `tests/`); Cmd+Shift+E
  is taken by a browser or system action in the native webview; the header overlaps at 1100 px.
- Default if unanswered: re-pin those specs to the menu item (common rule 4); shortcut -> none,
  must ask; overlap -> the button shows only an icon with the accessible name "Export" below 1200 px.

### G1 -- "Used in" locations and Go to
- Files: modify `src/App.tsx` (the `ResearchPanel` call at `:2921-2930` and a new handler); create
  `src/derived/footnoteLocations.ts`, `src/derived/footnoteLocations.test.ts`,
  `tests/w9-used-in.spec.ts`.
- Interfaces: uses the two optional `ResearchPanel` props from T0 (C1 renders them). Provides
  `export function footnoteLocations(project: Project): Map<string, { entryId: string; title: string }>`.
- Steps:
  1. Unit tests: a footnote referenced in the second manuscript section maps to that section's id
     and title; one referenced in a fragment maps to the fragment; one referenced nowhere is
     absent; the same result object is returned for the same project object (memoised).
  2. Implement by walking each entry's document for `footnoteReference` nodes, or by reusing
     `createProjectIndex` (`src/derived/projectIndex.ts:20`) if its `referenceOrder` holds footnote
     ids. Memoise on the project object.
  3. `App.tsx`: pass `footnoteLocations={...}` (memoised on the project) and `onGoToFootnote`.
     The handler: find the entry; if it is shown in a pane, focus that pane, else open it in the
     focused pane the way a sidebar click does; then select the footnote marker in that pane's
     editor and scroll it into view. The Research panel stays open.
  4. Browser spec: with a cited footnote in section 2 while section 1 is open, the source's
     "Used in" row reads "in <section 2 title>"; clicking Go to shows section 2 with the marker
     selected and inside the viewport; in a split where section 2 is already in the other pane,
     Go to focuses that pane and changes neither pane's entry; Go to works from the keyboard.
- Acceptance check: `npx vitest run src/derived` -> all pass;
  `PLAYWRIGHT_PORT=1443 npx playwright test tests/w9-used-in.spec.ts tests/footnotes.spec.ts tests/split-view.spec.ts` -> all pass.
- Fail-first: step 1; the browser spec fails before step 3.
- Stop and ask if: the editor for a just-opened entry is not ready in the same tick.
- Default if unanswered: for the second, wait for the pane's editor with the same mechanism the
  comments "Go to passage" jump uses; name the function you reused in the note.

### M1 -- Research panel slides in
- Files: fill `src/research/asideMotion.ts`; create `tests/w9-research-motion.spec.ts`.
- Interfaces: `useResearchAsideEntrance(aside, shown, wasPointer)` is already called from
  `src/App.tsx` (T0). Uses `play`, `prefersReducedMotion` from `src/motion.ts`.
- Steps:
  1. Read the motion rules in `docs/design-system.md` and `tests/motion-helpers.ts`.
  2. Browser spec: opening Research by clicking its sidebar row runs exactly one animation on
     `.research-aside`, animating only transform and opacity, lasting 180 ms, ending at no
     transform and opacity 1, and the document's width is already final on the first frame;
     opening it with the keyboard or the command palette runs none; with Reduce Motion emulated a
     pointer open runs none; closing runs none. Run it; the first case fails.
  3. In the hook: when `shown` turns true and `wasPointer()` is true and Reduce Motion is off, call
     `play` on the aside from `translateX(var(--space-4))`, opacity 0 to no transform, opacity 1,
     with the base duration and the ease-out token. Cancel on unmount. Nothing on close.
- Acceptance check: `PLAYWRIGHT_PORT=1444 npx playwright test tests/w9-research-motion.spec.ts tests/motion.spec.ts tests/research.spec.ts` -> all pass.
- Fail-first: step 2.
- Stop and ask if: `play` cannot resolve a CSS variable inside a keyframe.
- Default if unanswered: read `--space-4` with `getComputedStyle` and pass pixels.

### P1 -- Projects page
- Files: modify `src/components/ProjectLibrary.tsx`, `src/components/library.css`,
  `tests/projects-screen.spec.ts` (re-pins only); create `src/libraryPreferences.ts`,
  `src/libraryPreferences.test.ts`, `tests/w9-projects-page.spec.ts`.
- Interfaces: provides the class `icon-grow` on the page's icon-only buttons (B3 styles it).
- Steps:
  1. Read `docs/design-system.md` and `IDEAS.md` section 4, ideas A and D.
  2. Browser spec. Run it; it fails. Assert:
     - the toolbar row holds only Start new project, Import writing, the search and the gear;
     - Sort, the reverse button and the view toggle sit in a caption row directly above the list,
       at 12 px in the muted colour, are not bolded or outlined by the text hover rule (the
       icon-only ones carry the existing `icon-button` class, which that rule already excludes),
       and keep their accessible names ("Sort projects", "Reverse
       project sort order", "Show project cards" / "Show project list");
     - each row's title is 15 px and comes first; "Edited <date>" follows in the normal text
       colour, then "Added <date>" muted; cards use the same order;
     - sort, direction and view survive a reload;
     - the search button, the reverse button, the view toggle and the gear have the class
       `icon-grow`, and the reverse button's arrow is inside a `span` (the row trash keeps its
       `delete-entry` class, which B3 already styles);
     - with no projects, the list area shows one sentence and the text controls Blank, Chicago,
       Screenplay (or the template names the create menu actually offers) and Import writing, each
       doing what the same item in the Start new project menu does; no illustration.
  3. `libraryPreferences.ts`: read and write `{ sort, reverse, view }` under the storage key
     `folio.workspace.library`, tolerant of missing or bad data (unit tested).
  4. Make the layout and typography changes with `--type-large`, `--type-small` and `--muted`.
  5. Empty state sentence: "Start with a blank page or a template, or bring in writing you
     already have." Keep "No matching projects." for an empty search.
  6. Re-pin `tests/projects-screen.spec.ts` where it finds Sort or the view toggle inside
     `.library-display`.
- Acceptance check: `npx vitest run src/libraryPreferences.test.ts` -> pass;
  `PLAYWRIGHT_PORT=1445 npx playwright test tests/w9-projects-page.spec.ts tests/projects-screen.spec.ts tests/hover-emphasis.spec.ts tests/import.spec.ts tests/accessibility.spec.ts` -> all pass.
- Fail-first: step 2.
- Stop and ask if: a pinned rule in `tests/projects-screen.spec.ts:20-135` (brand above the
  button, create button flush left, `.library-display` flush right, toolbar y stable, search
  reveal) cannot hold with the new layout.
- Default if unanswered: none -- must ask.

### S1 -- Settings section strip
- Files: fill `src/settings/SettingsNav.tsx`, `src/settings/settings-nav.css`; create
  `tests/w9-settings-nav.spec.ts`.
- Interfaces: `<SettingsNav />` is already rendered under the Settings `h1` (T0). Provides the real
  `scrollToSettingsSection(heading: string): void` (E1 calls it with "Export document").
- Steps:
  1. Browser spec: the strip lists one link per `.settings-section h2` in page order with the same
     text; it stays visible at the top while the page scrolls; a click scrolls that section's
     heading to just under the strip (smooth for a pointer; instant for the keyboard and with
     Reduce Motion); the link for the section in view is marked `aria-current="true"` and shown by
     weight and colour, no fill; links are reachable by Tab and work with Enter;
     `scrollToSettingsSection("Export document")` brings that section into view, including when
     it is called in the same tick that switches to Settings, before the page has mounted. Run
     it; it fails.
  2. On mount, find the nearest `.project-settings` ancestor, read its section headings, give each
     section an id derived from its heading if it has none, and render the links. Re-read when the
     sections change (a `MutationObserver` on the container's direct children is enough).
  3. Mark the section in view with an `IntersectionObserver`.
  4. Style with the look of the existing `Segmented` control (`src/components/segmented.css`):
     weight and colour only. The shared hover rule applies as is; add none.
- Acceptance check: `PLAYWRIGHT_PORT=1446 npx playwright test tests/w9-settings-nav.spec.ts tests/appearance.spec.ts tests/shortcuts.spec.ts` -> all pass.
- Fail-first: step 1.
- Stop and ask if: the Settings page is not its own scroll container (a sticky strip then needs a
  change in `src/App.tsx` or `src/styles.css`, which this task does not own).
- Default if unanswered: none -- must ask.

### D1 -- Docs
- Files: modify `docs/design-system.md`, `docs/user-guide.md`, `docs/limitations.md`,
  `docs/changelog.md`, `docs/architecture.md`, `AGENTS.md` (project).
- Interfaces: uses every `notes/<task>.md`.
- Steps:
  1. `AGENTS.md`, Product and UI: the hover rule no longer grows text (faux bold only; the press
     scale stays); standalone icons outside the toolbar grow 25 percent on hover and focus, so the
     "no second scale rule anywhere" sentence now applies to text controls; interface text prefers the font chosen in Settings, Futura by default; the logo
     stays Futura. Change only those sentences.
  2. `docs/design-system.md`: hover rule, standalone icon magnify rule, interface font variable
     `--ui-font`, card rules, side ruler, Research panel zones.
  3. `docs/user-guide.md`: interface font, Add font, installed fonts, side ruler, Open beside
     rule, blank-page click, PubMed lookup and the offline note, the Export menu and its shortcut
     (replace the "scroll to Export document" instruction), the Settings strip, "Used in" and Go
     to, the Projects page.
  4. `docs/limitations.md`: added fonts are not stored in projects; which fonts are embedded in
     PDF and Word and which fall back (collection files such as Futura, fonts that forbid
     embedding, whatever C4 and C7 report); side ruler hides while the sidebar floats and moves
     one shared margin; lookup needs internet; anything else the notes report.
  5. `docs/architecture.md`: font storage (native folder, browser database, commands), installed
     font commands, the export font source, `exportActions`, `footnoteLocations`.
  6. `docs/changelog.md`: an Unreleased entry. UI dash separators are `--`.
- Acceptance check: `grep -c "ui-font" docs/design-system.md` -> at least 1;
  `grep -n "4 percent grow" AGENTS.md` -> no match.
- Fail-first: both greps give the opposite result on the untouched tree.
- Stop and ask if: a note reports a limitation that contradicts the Definition of done.
- Default if unanswered: none -- must ask.

## Validation (after all tasks, in order)
One runner only; nothing else may be running tests or builds.
1. `git status --short` -> only files named in this plan, plus the pre-existing untracked items.
2. `npm run build` -> succeeds.
3. `npm test` -> all pass.
4. `PLAYWRIGHT_PREVIEW=1 npm run test:e2e` -> all pass. For each failure, rerun that spec alone
   three times and record pass counts; compare with the intermittent failures in `HANDOFF.md`.
   Do not call a failure a false alarm; the reviewer decides.
5. `cd src-tauri && cargo test` -> all pass; `git diff --stat src-tauri/Cargo.lock` -> no new
   package entries (feature changes only).
6. Independent review (skill `independent-review`) of the whole diff against this plan, by Opus.
7. Ask the owner before this step (it takes over the screen): `npm run tauri build`, then report
   the new `Personal Word.app` path.
8. Owner hand checks in the built app, collected from the task notes: hover sharpness; blank-page
   click at 100% and 150%; PubMed link; add a font family, relaunch, pick an installed font, export
   a PDF and a Word file; side ruler; sidebar on a short window; card view at narrow and wide
   sidebar widths; Export menu and Cmd+Shift+E; Go to from "Used in"; Research slide-in; Settings
   strip; Projects page with and without projects.
Status after step 6 is CLAIMED. Only the owner's report in step 8 makes anything VERIFIED.

## Risks and rollback
- Nothing is committed, so `git checkout -- <path>` restores any modified file and deleting the new
  files removes the rest. Ask before running either; other workers' edits share the checkout.
- The hover blur may come from the faux-bold stroke, not the grow. A1 then changes nothing visible
  and the owner has to choose between dropping the stroke and colour-only hover.
- The faux-bold stroke was tuned for Futura; on a heavier interface font it may look too thick.
- Hidden scrollbar: the edge fade is the only scroll cue in the sidebar.
- Fonts: native storage, and whether the security policy lets an added font load, are covered only
  by the hand check.
  Removing an added font deletes its stored copy; the user's original file is untouched.
- Research panel: `tests/research.spec.ts` pins rule counts and tab order; re-pins can hide a real
  regression, so the reviewer reads each re-pin.
- PDF and Word embedding of installed fonts is the least certain part: the default document look
  (Futura) lives in a collection file and is expected to keep falling back in PDF. If most fonts
  the owner uses fall back, the feature will feel unfinished; the hand check decides.
- Several hundred installed fonts in a dropdown may be slow or awkward to scan.
- E1 moves the three export functions; a slip there breaks every export. The existing export specs
  are in its acceptance check for that reason.
- Fifteen dev servers at once may be heavy on this Mac; the coordinator can cap the number of
  workers without changing the plan.
- A half-finished edit by one worker can break another worker's dev server (common rule 3).

## Open questions for the user
None. Answered on 2026-11-10: the side ruler hides while the sidebar floats; font controls sit in
the General section; `AGENTS.md` is edited in D1; Core Text may be declared as a direct dependency.

## Notes for the implementer (traps, things NOT to do)
- Do not rename or remove any `folio.*` key. The new keys are `folio.workspace.interfaceFont` and
  `folio.workspace.library`.
- Do not change punctuation inside user documents, citations or paths. UI separators are `--`.
- Do not send a browser-like user agent, an email address or an API key to NCBI or any other site.
- Do not edit `.brand` or `.writing-surface` fonts: the logo and the document default are separate
  from the interface font.
- Do not add a second hover weight or scale rule for text. B3 scales icon glyphs only.
- Do not scale a button's own transform in B3; the press rule owns it.
- Line numbers were read at commit `834f534`. If a file differs, stop and ask.
- `tests/popover-bounds.spec.ts` compares against `tests/fixtures/popover-baseline-rects.json`; a
  wider font dropdown may shift those rectangles. Report it; do not regenerate the baseline unasked.
- Workers never run `npm run build`, `npm run tauri build` or any native screen script.
- Wave 8's `IDEAS.md` is an untracked file from another session: read it, do not edit it.
