# Review: W7 small fixes (T245, T247, T248, T249)

Reviewer: agent-ba11 (Claude Opus reviewer W7 small fixes). Date: 2026-11-05.
Evidence level: Chromium headless and cargo only. No native run, no app windows. Nothing here is confirmed in real use.
No source or test edits made. Scratch: `node_modules/.cache/personal-word-beta/ui7-rv-s/` (`full.log`, `probe2.log`, `probe-shots/`). Probe script: session scratchpad `probe/probe.spec.cjs`.

| Task | Verdict | Why |
|---|---|---|
| T245 | APPROVE | Test is sound and still fails on a snap-back |
| T247 | REJECT | Comments and Snapshots lists now render beside their headings and run off the sidebar |
| T248 | REJECT | With zero sources, two rules enclose an empty 46 px band |
| T249 | REJECT (layout only) | One PDF gives the same doubled rule; the data work is sound and needs no change |

## Gates (one fresh build, one run)
- tsc: clean. `npm test`: 1157 passed, 69 files. `cargo test`: 64 passed, 1 ignored.
- Full Playwright, port 1942: **499 passed, 16 skipped, 0 failed** (25.6 min). No failures to rerun or assign.
- The suite is green while the T247 and T248/T249 defects below exist: no spec covers bottom rows with content, or the rule count in each research state.

## T245: APPROVE
- `tests/projects-screen.spec.ts:587` records the transform every animation frame from before the mouse move, then requires a frame strictly between 1 and the peak.
- Frames from before the move are all at or above the peak, because the scale only rises until the move. So only frames from after the move can satisfy the check, and pre-move frames cannot fake a pass.
- Independently confirmed fail-first: on a copy of the built CSS with `transition:` stripped, it fails with `no ease frame between 1 and 1.04: 1.04, 1, 1, ...`.
- `--repeat-each=5`: 5 passed. Full suite: passed. `src` untouched. The Reduce Motion branch is unchanged.
- Remaining risk, small: a main-thread stall longer than the 120 ms ease would produce a false failure. That is much less likely than with the old fixed sample.

## T247: REJECT
### Defect 1 (blocking, regression): bottom-row lists sit beside their headings
- Cause: `src/styles.css:2192`, `.sidebar-bottom-groups .sidebar-group { display: flex; align-items: center }`. It applies to every bottom group, and Comments and Snapshots also hold an `.entry-list` (`ProjectSidebar.tsx`, `collection && !collapsed[id]`).
- Repro: a project with any unresolved comment or any snapshot, at the default 270 px sidebar.
- Measured: Comments heading right edge 98 px (it should be 257), list starts at 98 px and ends at 280 px, past the 270 px sidebar. Snapshots list runs 171 to 291 px, so "First snapshot" is cut off. The Comments row grows to 70 px with its label centred against the two comments.
- Shot: `probe-shots/bottom-with-snapshots.png`. With no comments and no snapshots the rows look right, which is the only case the T247 spec tests.
- Applies in floating mode too: the same selector covers those groups (inferred from the CSS, not shot).
- Fix: keep the row height and centring on the heading, not the group. For example, give `.sidebar-bottom-groups .group-heading` the `min-height: var(--control-height)` and `align-items: center`, and leave the group as a block. Keep the `:last-child` Settings rule so it still lines up with the footer rule.
- Add a test: bottom rows with two comments and one snapshot, list below heading, inside the sidebar width. Show it failing first.

### Checked and fine
- Bottom rows, empty: each 32 px, gap above each divider 8 px, below 7.5 to 8 px. Settings row top 768 equals `.pane-footer` top 768, so the footer alignment holds.
- Split icon to rail gap: exactly 8 px at 190, at 270, and at 270 floating, for both `.open-beside` and `.collection-open-beside`.
- Rail: longest line is 16 px, because magnify grows length only up to 1, so it never reaches the icon.
- Chevrons: one column across the three sections at each width. Hidden toggles keep their box (opacity only), so the chevron never moves. Tab order is view toggle, add, chevron, matching the visual order.
- Cards view: `padding-right: 0`, no rail, full width, no gutter effect.
- 24 px gutter at 190: names ellipsize cleanly, nothing is cut mid-glyph. Available text is 101 px, or 69 px on PDF rows.
- Audit edit in `tests/sidebar-selection.spec.ts` (clipping text rects to the label box): legitimate. `.group-label` has `overflow: hidden`, so text past the box is not painted. The edit became necessary because the chevron no longer separates the label from the actions, not because anything got worse. The audit still catches a button over the label box.

### Non-blocking notes
- `tests/scrollspy.spec.ts:606` comment still says "the gutter is 14 px". It should say 24. The test passes but runs at the default width, not 190. Probed at 190 separately: no clipping.
- `docs/limitations.md:37` also says 14 px. The T247 note already flags the docs update.
- "Manuscript" ellipsizes at 190 ("Manusc..."), label 69 px against text 77 px. Not new: the old layout had the same space and hid it, and the T6 spec comment allows it. Reported for the owner's eye only.
- `.entry-row.has-beside .entry-main` keeps `padding-right: 40px` although the glyph moved 11 px right, so PDF rows give up more name than they need at 190. Optional.

## T248: REJECT
### Defect 2 (blocking): zero sources gives two rules around nothing
- `ResearchPanel.tsx` renders `<hr>`, the always-present `.research-status` (`min-height: 1em`, empty), an empty `.source-list` (hidden), then `<hr>`.
- Measured with zero sources, zero PDFs: rules at 363 and 409, a 46 px empty band. Shot: `probe-shots/panel-zero.png`.
- The owner asked for lines to break up Zotero and Text-only notes. With nothing between them that takes one rule. The task's "no leftover gap" check fails.
- Fix: render the second rule only when there are sources or PDFs, and take the empty status out of the layout flow without removing it from the accessibility tree. It is `role="status"`, a live region, so `display: none` could silence later messages. For example `.research-status:empty { position: absolute }`, which also frees the grid gaps around it. The status returns to flow when it has text.
- T248 and T249 register the same three paths and share this root cause: one worker should repair both together.
- Add a test: rule count with zero sources, one PDF, and several sources. Show it failing first.

### Related, same fix
With several sources the band between the first rule and the first source is also 46 px where the panel rhythm suggests about half that (`probe-shots/panel-three-sources.png`). Taking the empty status out of flow fixes it.

### Checked and fine
- Both helper texts are gone from the code and the screen, and the Bibliography help text stays. Rules are in the requested places.
- Several sources: not over-rendered, one rule above and one below the list.
- `.source-list:empty` works. Tree tests pass.

## T249: REJECT (layout only)
### Defect 3 (blocking, same family as Defect 2): one PDF gives a doubled rule
- `.research-pdfs` has its own `border-top` (`src/research/research.css`, `.research-pdfs`), directly after the new `<hr>` and the empty status.
- Measured with one PDF: rules at 363, 409 and 516. The first two have nothing between them. Shot: `probe-shots/panel-one-pdf.png`.
- The T249 handoff note said to delete this rule, and it was kept.
- Fix: drop `border-top` and `padding-top` on `.research-pdfs`, and take the empty status out of flow as in Defect 2 (not `display: none`). Check the PDFs subheading still has its gap under the first rule. Repair with T248, one worker. Do not redo the data paths below.

### Data paths: reviewed, no defect, no change needed
- **Native save and journal:** `research` travels whole in the header (`headerOf`, flattened `extra` in Rust), so incremental saves, the journal and snapshots carry `pdfs` with no field list to miss.
- **`pdf_ids` (`store.rs:1002`):** includes `research.pdfs[*].assetId`. `standalone_pdfs_reach_the_attachments_mirror` passes. There is no asset deletion anywhere in the Rust store or browser asset store (`DELETE FROM assets` absent), so a PDF cannot be collected.
- **`model.ts`:** validated, old projects load, and a malformed entry rejects like a bad source PDF.
- **Snapshot restore:** probe uploaded, took a snapshot, removed, restored. The row returned and the pane opened with all 51 bytes. `mergeMissingResearch` unions by id.
- **Other writers:** every path that rebuilds `research` spreads the existing object, so none drops `pdfs` (App reorder, merge, panel `onChange`, importers).
- **Removal:** no confirm, asset left in place, same as a source's PDF. Same bytes uploaded twice gives two rows on one asset, and removing one leaves the other working.
- **Removal while open beside:** the pane stays, titled "PDF", with "This PDF is not stored in this project." and a working close button. No crash, no page errors. After reload the split is pruned. Same behaviour as a source's PDF and already recorded in `docs/limitations.md:71`, so not a new defect. It is awkward enough to mention to the owner.
- **Split:** standalone and source PDF splits both restore after reload. A saved split pointing at an unknown id is dropped. `App.tsx:130` only feeds `readSplit` and `prune`, so there is no other effect.
- **Sidebar:** order is sources, loose PDFs, notes. Rail has one line per row in the same order. Click and rail click open beside. Row lit, rail line `open`, Research heading `data-open`. Source chord reorder works around loose rows. Chord and drag on a loose row do nothing and do not crash. Search filters them. No page errors.
- **Keyboard:** Tab reaches Upload PDF after Enter manually, Enter opens the file chooser (single file), and the next Tab skips the hidden input.
- **Panel:** `.research-pdfs` is absent with no PDFs, present after upload, gone after removal. At a 227 px panel the action row wraps without overflow, and a 110 character unbroken file name wraps inside the panel.
- **Not carried in archives:** like source PDFs, standalone PDFs are not in the `.json` archive or Markdown bundle. `docs/limitations.md:22` names only source PDFs and should cover both.

## Found while reviewing, not from these tasks
**Split icon covers long section titles on hover.** `.reorder` is absolute at the row's right edge and section rows reserve no room, unlike `.has-beside` rows. Measured: title runs to 150 px, icon starts at 137 px at 190 wide; 233 and 217 at 270 wide. Shot: `probe-shots/long-hover-190-false.png`. Likely exposed when row word counts were removed in W7 A1 (inferred). T247 did not cause it and it does not count toward the verdict, but it sits right next to the owner's complaint in shot 16, so fix it in the T247 repair pass or file it.

## Native must check for T249 (not reachable here)
1. Upload through the real Mac picker from the Upload PDF button in WebKit (hidden input `.click()`).
2. `attachments/<assetId>.pdf` appears in the project folder.
3. Row in the sidebar, Open beside draws the PDF in WebKit.
4. Quit and relaunch keeps the list, and a restored split reopens.
5. Remove, relaunch: stays removed, project loads.
6. Snapshot, remove, restore: row returns and the PDF opens.
7. After the T247 fix: bottom rows with comments and snapshots in WebKit, docked and floating.
