# REVIEW-9 -- T316 (T12 header colour swatches), T317 (T13 Projects trash), T318 (T14 README)

Reviewer: Opus reviewer LP-H (board agent-6a55), 2026-11-13. Independent, read-only on source. Branch
`layout-primitives`, HEAD 1361f1e plus uncommitted work. Chromium (Playwright) only.

## Verdicts

| Task | Verdict | One line |
|---|---|---|
| T316 / T12 header colour | **APPROVE** | Works as designed in light and dark on all four header kinds, per project, keyboard complete; only low findings. |
| T317 / T13 Projects trash | **APPROVE (with a caveat for the owner)** | Change is correct and harmless, but in Chromium nothing was misaligned before it either; the owner's complaint is probably not what was fixed. |
| T318 / T14 README | **REJECT (small text fixes)** | Two feature claims are not true as written and the shot spec keeps a dead "Colour…" branch; exact replacements below. |

## What I ran

- `npx vitest run src/organization/groups.test.ts src/model.test.ts src/palette.test.ts src/appearance.test.ts src/hoverEmphasis.test.ts src/motion.test.ts src/layoutPrimitives.test.ts` -> 7 files, 123 passed.
- `npx tsc -b` -> clean (exit 0).
- One serial-lock hold (owner `reviewH`), PLAYWRIGHT_PORT=1484, three separate commands:
  - throwaway `tests/reviewH-tmp.spec.ts` (deleted afterwards) -> 3 passed; measurements logged, 33 screenshots in `notes/reviewH-*.png`.
  - `tests/layout-invariants.spec.ts -g "T12|T13|T5|Projects|T2|T4"` -> 18 passed, 0 failed.
  - `hs9-top-level-sections, appearance, sidebar-context-menu, accessibility, of5-settings, w9-projects-page, projects-screen, alignment, hover-emphasis, tables-context` -> 122 passed, 4 skipped, 0 failed (126 cases).
- Read: AGENTS.md, PLAN.md (Approach, The system, T12-T14), BRIEF.md + addenda, notes T12/T13/T14 + fail-first files and screenshots, README.md vs `git show 1361f1e:README.md`, tests/readme-shots.spec.ts, all six docs/evidence/readme PNGs, diffs of ContextMenu.tsx, context-menu.css, GeneralSettings.tsx, App.tsx (colour regions), model.ts, groups.ts, store.rs, model.test.ts, appearance.spec.ts, hs9 colour cases, the T12 and T13 invariants.

## T316 / T12 -- header colour from the right-click menu

### Verified (Chromium, 1440x900, dsf 2)
a. Menu on Manuscript, Fragments, Research and a custom header, light and dark: rule + one row of 8 swatches,
   row height 32, slots 24x24, first square's left edge = the item labels' left edge (79/79, 71/71, 67/67,
   65/65). The checked square's background equals the heading icon's computed colour in all 8 cases (e.g. light
   Blue rgb(0,98,205) = icon; dark Orange rgb(255,159,10) = icon). Unset custom header marks Blue = Manuscript's
   colour. The current-colour outline is visible on Yellow in both themes (it sits 2 px off the square, on the
   menu background: `notes/reviewH-T12-yellow-checked-{light,dark}.png`). Click applies at once, menu closes,
   focus returns to the heading (`BUTTON.group-title`). Fragments recoloured to Purple: heading icon, the entry-row
   icon and the card view's icons all purple (`notes/reviewH-T12-frag-cards-light.png`). Plain: no row, no rule
   (hs9 case). Menu dispatched at the window's bottom-right corner (1436, 896): placed at x 1218..1432,
   y 617..892 (custom) and 681..892 (Fragments) -- inside the 8 px margin. Menu width is 214 (was min 160).
b. Keyboard: Shift+F10 and the ContextMenu key open it. Down x12 ends on the row and stays (the menu clamps, as
   before, no wrap); Up from the row returns DOM focus to the menu with `aria-activedescendant` on the last item;
   Down re-enters on the current swatch; on the row Home -> Red, Left from Red wraps to Purple, End -> Purple;
   Space and Enter pick, close, return focus to the heading and do NOT toggle the heading (is-collapsed false,
   aria-expanded unchanged). Escape returns focus to the heading on all four headers. Tab from a swatch and Tab
   from an ordinary item both close the menu and land on the same element (the sidebar resize handle):
   unchanged. `aria-checked` follows the colour; names are colour names; group named "Colour".
c. Per project: hs9 case (Colour A purple, Colour B legacy teal, tab switch both ways, reload) passes; my run:
   project A recoloured (Fragments, Research = Yellow), project B shows the legacy green, reload with B active
   keeps green, switching to A shows A's colours at once. `tint` grep: the `data-tint-*` / `--tint-*` values are
   consumed only by sidebar rules (src/styles.css 2128-2155); nothing outside the sidebar is tinted. On the
   Projects page `<html>` carries only `data-palette="color"` (no project -> legacy app-wide values, which equal
   the defaults here); the Projects-page Settings has no colour row. Split view inside one project: not run;
   by construction both panes share the one sidebar and the one `<html>` dataset (unverified in a browser).
d. Data: `validateProject` keeps the three known keys with known swatches and drops anything else without
   throwing (groups.test T12 case; `groups[].colour` unknown value dropped, model.ts:270). Archive and save-queue
   header round-trip: model.test.ts:356-363. Writes: `colourHeader` -> `mutate(setGroupColour(setHeaderColour(...)))`
   (App.tsx:1208-1210); nothing else writes either field. No code rebuilds a Project field by field (grep of
   `groupTitles`/`headerColours`), so imports and duplicates carry it. Whole-snapshot restore spreads the
   snapshot project (App.tsx:1396-1401), so restoring an older version restores that version's colours
   (and drops later ones) -- acceptable, the same as titles. Rust: `Project.extra` and `Header.extra` are
   `#[serde(flatten)] Map<String, Value>` (store.rs:54, 68) and `header()` clones `extra` (store.rs:112), so
   `headerColours` survives; only the fixture line changed (store.rs:1934-1937). cargo not run (coordinator).
e. ContextMenu: ordinary items unchanged (row menu: Open, Open beside, Rename, Move up, Move down, Delete; no
   radios, no rule; Escape returns to the row). Placement maths untouched (uses offsetWidth/Height, so the wider
   menu is measured). The row is `.row` > `.cluster.gap-0.flush-start` > `.slot`; no new hover/emphasis rule
   (hover-emphasis spec and hoverEmphasis.test pass); no @keyframes; swatches use the existing `.icon-grow`.
f. Removals: no "Colour…", "Header colour" dialog, "Header colours"/"Section colours" Settings row, `.section-swatches`,
   `.swatch-option`, `data-swatch` left in src or tests (only `swatch-chip`, now the new menu square's class).
   GeneralSettings dropped `Dropdown` and `SWATCHES` imports; tsc (noUnusedLocals) clean. user-guide.md:18,
   design-system.md:215 and :375, AGENTS.md naming line all say per project, from the right-click menu.
g. Shared files: T317's regions are intact (ProjectLibrary.tsx:272 and :375 `flush-end`; styles.css:2006
   `.project-row .delete-entry { margin-inline-start:0; opacity:0 }`; library.css last rule; both T13 invariants
   present and passing). `tests/layout-invariants.spec.ts` is untracked and HEAD is still 1361f1e, so there is
   no committed pre-T12 copy of it or of the other shared files' batch state: loss in regions other than the
   ones checked here cannot be proven absent; the 18 invariants and 122 spec cases passing (4 skipped) is the evidence.
h. Tests without the feature: the hs9 colour cases, the appearance case and the T12 invariant all start by
   locating `role=group "Colour"` / `menuitemradio`, which did not exist before, and assert `data-tint` /
   icon colour after a pick, so they would fail; the two-project case exists (hs9:344) and is meaningful
   (A changed, B legacy, tab switch both ways, reload). Reasoned, not recorded (no pre-change browser run).

### Findings
1. low -- swatch focus look (`notes/reviewH-T12-focus-checked-{light,dark}.png`, `-focus-next-*`): the focus
   ring is the standard `button:focus-visible` ring (2 px accent, offset -2 px, inset), but `.icon-grow` scales
   the square to 20 px so it touches the ring with no gap, and on the CURRENT swatch the 1 px "current" outline
   (scaled with the square) sits right outside the ring -> a blue+black (dark: blue+white) double frame. That
   is the default keyboard look, because Shift+F10 -> End lands on the current swatch. It stays readable
   (ring inside, outline outside), and the accent ring equals the Blue swatch, so on a focused Blue square
   the ring reads as part of the square. Optional fix: drop `icon-grow` from the swatch buttons
   (ContextMenu.tsx:221 className `context-menu-swatch slot`) so the 16 px square keeps a 2 px gap inside the ring.
2. low -- mixed pointer/keyboard (ContextMenu.tsx:238): with DOM focus on a swatch, hovering "Rename" moves the
   highlight but not focus; Enter then runs Rename while the focus ring is still drawn on the swatch.
   Optional fix: in `onPointerEnter` of an ordinary item call `highlightAt(index)` instead of `setHighlight(index)`.
3. low -- tests/hs9-top-level-sections.spec.ts:305-307 and :356-358 write T12-*.png into docs/agent-work/.../notes
   on every run, so every suite run rewrites committed evidence (my run did). Gate them behind an env var or
   write to test-results.
4. low -- stale wording: src/styles.css:2140 "same swatches as Settings"; docs/design-system.md:373 heading
   "Section colours and templates" (content is right). Text only.
5. note -- a custom header cannot return to "follow Manuscript" once a colour is picked (accepted by the owner's
   simple-swatch design); an unset custom header marks Manuscript's colour (verified).

## T317 / T13 -- Projects page trash

### Measurements (Chromium, dsf 2; pixel ink from screenshots; identical light/dark, hover/keyboard focus)

| | 1440 | 900 |
|---|---|---|
| row (content column) | x 320..1120 | x 50..850 |
| trash svg box / slot | 1104..1120 / 1100..1124 | 834..850 / 830..854 |
| trash pixel ink x | 1105.5..1118.5 | 835.5..848.5 |
| gear pixel ink x | 1105..1119 | 835..849 |
| trash ink right vs rule end | -1.5 | -1.5 |
| trash ink right vs gear ink right | -0.5 | -0.5 |
| trash ink y / centre | 233.5..248.5 / 241.0 | same |
| "Added" ink cap top..baseline / centre | 236..246.5 / 241.25 | same |
| trash centre minus dates centre | -0.25 | -0.25 |
| trash ink below baseline / above cap | 2.0 / 2.5 | same |
| title box centre y | 241 | 241 |
| gap Added ink -> trash ink | 18.2 | 18.2 |
| trash hovered itself (1.25 grow) ink right vs rule | +0.5 | +0.5 |

The dates do not move on hover (invariant). Hover changes only the trash's opacity and, when the trash itself is
hovered, its colour (red) and size (icon-grow) -- nothing shifts. Cards: svg top inset 13, right inset 13 (equal).

### Judgement
In Chromium nothing on the list row is misaligned by more than 1.5 px: the trash is optically centred on the
dates (0.25 px), symmetric about cap height and baseline, on the gear's right edge, inside the column. Before T13
both icons sat 4 px inside the rule end -- equal to each other, so also not "misaligned" to the eye. The 4 px
move is correct by the plan and harmless, but it plausibly does NOT address what the owner saw. Candidates:
(1) native WebKit rendering differs (not checkable here; the owner tested the real app);
(2) keyboard focus on a row draws the focus ring around the title+dates button only, ending 12 px left of the
trash, so the trash appears to sit outside the row (`notes/reviewH-T13-*-list-focus-*.png`);
(3) cards view with a long title (finding 2 below).
Ask the owner for a crop of what he means, or have him re-check in the built app.

### Findings
1. note -- the owner's complaint is unconfirmed as fixed (above). Approve on the code; do not tell the owner it is fixed.
2. should-fix (pre-existing, not a T13 regression) -- cards view, long title: `.project-name` keeps
   `white-space: nowrap` but in the card's column flex it is sized to its content (628 px in a 256 px card), so
   the title runs past the card border into the next card and under the trash
   (`notes/reviewH-T13-1440-cards-hover-dark.png`). Same CSS and markup at 1361f1e (styles.css 1957-1987,
   ProjectLibrary.tsx:367). Fix (styles.css, card selectors): `.project-list--cards .project-row > button:first-child
   { align-items: stretch; }` (or `width:100%`) so the existing ellipsis applies, and keep the title clear of the
   trash slot (end padding already `--space-5`).

## T318 / T14 -- README

### Claim check (Features section)

| Claim | Evidence | OK? |
|---|---|---|
| Split view, each pane own footer with page and word count | design-system.md:285 "Each pane has its own footer"; split-light.png shows two footers | yes |
| Open beside "on any sidebar row", right-click, Cmd+click | buttons only on section, fragment and PDF rows (ProjectSidebar.tsx:619, :815); source rows without a PDF, notes, Bibliography have none | **no (overstated)** |
| A source beside the draft (PDF in right pane, draft editable) | user-guide.md:16, :20 "A PDF always opens in the right pane" | yes |
| A fragment "sits next to the section it came from" | Open beside replaces the last-used pane; it is beside whatever is open, not necessarily its origin (user-guide.md:20, :34) | low |
| Divider drag, "the ratio is remembered" | user-guide.md:20; design-system.md:285 `personal-word.splitRatio` | yes |
| Keeps left pane's undo history and scroll position | user-guide.md:20 | yes |
| Headers, custom headers part of manuscript, Read/exports follow order | AGENTS.md; groups.ts | yes |
| Fragments, page view, layout-engine caveat | user-guide; caveat kept | yes |
| DOI, ISBN, PubMed link or web address lookup; Zotero CSL JSON/BibTeX | user-guide.md:9; lookup.ts:472 (NCBI) | yes |
| Chicago footnotes, shortening, bibliography; Capture quote; PDFs | unchanged from 1361f1e README; user-guide | yes |
| Interface font: installed or added `.ttf`/`.otf` | user-guide.md:24 | yes |
| Appearance "System, Light or Dark, switched with Cmd+Shift+L" | registry.ts:39 Cmd+Shift+L = "Switch light or dark" (not System) | low (imprecise) |
| Palette tints sidebar icons and buttons, not document | user-guide.md:54 | yes |
| Header colour: every header, per project, swatches in right-click menu, Color palette; rename, move, delete added | matches T12 as built (verified above) | yes |
| Sidebar: resizable, pinnable, list/card per group, reveal on hover, floating sidebar and citation card | ProjectSidebar.tsx:661 collection = all three + custom; user-guide.md:44 | yes |
| Focus mode dims all but the paragraph, hides toolbar | unchanged from 1361f1e README; user-guide.md:56 | yes |
| Page setup: paper, margins, page numbers, top and side ruler | Writer.tsx:1951-1979; user-guide.md:26, :36 | yes |
| Typeface, size, line spacing, space after, zoom | Writer.tsx:1777-1786 | yes |
| Reading view own font, size, line spacing | App.tsx:313-335, :2699 `reader` | yes |
| Templates Blank, Chicago, Screenplay | user-guide.md:7 | yes |
| Goals: manuscript word goal, daily goal, deadline | user-guide.md:56 | yes |
| Prose check, switch per rule | ProseIssues.tsx:4-24 `RULE_LABELS`, `onRuleChange` | yes |
| Rebindable shortcuts; command palette Cmd+Shift+P | registry.ts:40 | yes |
| Restore tabs at launch | GeneralSettings "Restore open project tabs at launch" | yes |
| Saves while typing, crash recovery; snapshots compare + restore section/paragraph | unchanged claims | yes |
| "Local only ... The only network use is a citation lookup" | Zotero refresh calls `http://127.0.0.1:23119` (zotero.ts:63), off by default; fonts are local (no remote url in src/index.html) | **no (as written)** |
| Exports: Word with footnotes, PDF, Markdown, plain text, full-project backup | user-guide.md:12, :58 | yes |
| Project library searchable, sortable, list or cards | user-guide.md:52 | yes |

Structure: intro paragraph byte-identical to 1361f1e; Quick start, Good to know, For developers, Open source and
License identical; every link and image path resolves; pronouns appear only in the tagline/intro, Quick start
and Good to know (no feature bullet). Honest limits kept: page-break caveat (Features), beta, Mac only, not signed,
Rosetta untested. Dropped from the old features: "Calm to write in" (merged), "put it back into a section later"
(now copy-back), "never scroll through 80 pages" -- fine.

Screenshots: all six opened; believable demo content, no lorem, no tooltips or open menus, no test strings
except the browser-preview footnote, which is cropped out of projects-light.png. The spec builds everything
through the UI in a fresh Playwright context (isolated storage), reads nothing from docs/agent-work or real
projects. Invented sources (Ellison 1927, Lindqvist 1961) shown only inside a demo: acceptable in my view (they
are clearly a demo paper, and inventing avoids misquoting real authors); the third, a real-sounding 1826 Canal
Commissioners report, is plausible public-domain style. Optional: swap Ellison/Lindqvist for real public-domain
works (e.g. a 19th-century canal history) if the owner prefers nothing fictitious on the public page.
One visible app quirk in split-light.png and research-light.png: the footnote shows the book title upright, while
the Research panel's note shows it italic (pre-existing editor rendering, not a README issue).

### Findings (fix before commit; text only)
1. should-fix -- README.md:15 replace with:
   `- **Open beside.** A section, a fragment or a source's PDF opens in a second pane from the **Open beside** button on its sidebar row, from its right-click menu, or with Cmd+click.`
2. should-fix -- README.md:61 replace with:
   `- **Local only.** No account, no subscription, no cloud. The only time it reaches the internet is a citation lookup; the optional Zotero refresh talks only to Zotero on the same Mac.`
3. low -- README.md:40 replace with: `- **Appearance.** System, Light or Dark; Cmd+Shift+L switches between Light and Dark.`
4. low -- README.md:17 replace with: `- **A fragment beside a section.** A fragment opens next to the section being written, ready to copy back.`
5. should-fix -- tests/readme-shots.spec.ts:141-154: delete the "Colour…" branch and use the row directly:
   ```ts
   const swatch = menu.getByRole("group", { name: "Colour", exact: true })
     .getByRole("menuitemradio", { name: colour, exact: true });
   await swatch.click();
   await expect(menu).toHaveCount(0);
   ```
   and update the stale comments at :9-10 ("does not depend on the header right-click menu's internals") and
   :277 ("...and header colours" -> Settings no longer has them). The run that made the PNGs already took the
   fallback path, so the images are valid.
6. low -- customise-light.png: keep the Settings shot as the group image (it shows four real options at once);
   the swatch row is small and its bullet already says where it is. If a menu image is wanted, add a second
   cropped shot taken before `shot()` (which presses Escape and blurs), e.g. right-click "Part two", wait for
   the menu's animations, `page.screenshot({ clip: menu box + 16 px })` as `header-colour-light.png`.

## Unverified
- Native WebKit / the built app (the owner's T13 report may be WebKit-specific); cargo test for store.rs;
  `README_SHOTS=1` run of readme-shots (not rerun; the coordinator retakes); split view tint check in a browser;
  Reduce Motion on the swatch magnify; T12 behaviour before the change (no recorded pre-change browser run).
