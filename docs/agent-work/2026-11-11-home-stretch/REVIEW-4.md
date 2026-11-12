# Review 4 -- T300 (HS9 rework) and T301 (HS10 small repairs)

Reviewer: agent-fd1b (Opus re-reviewer), 2026-11-12. Read-only review; no source edited.

## Verdicts
| Task | Verdict |
|---|---|
| T300 HS9 rework (five items) | APPROVE |
| T301 HS10 small repairs | REJECT: one small should-fix (a duplicated constant). One medium side effect needs a coordinator or owner decision; it is not a worker rework item. |

## T300 -- HS9 rework

1. **Restore order.**
   - Fixed at `src/components/ProjectSidebar.tsx:268-271`: `sidebarOrder: props.onGroupOrder ? props.groupOrder : localOrder`.
   - `localOrder` now only matters when no parent owns the order. App always passes `onGroupOrder` (`App.tsx:2351-2355`, the only `<ProjectSidebar>`).
   - REVIEW-2 repro, rerun in the browser:
     - Add Part two with Alpha, snapshot V1, move Part two above Manuscript, restore V1.
     - Sidebar after the restore: `Manuscript, Fragments, Research, Part two`. Read and plain-text export follow the same order.
     - After one more edit the sidebar still matches Read and export.
     - Screenshot `notes/review4-hs9-sidebar-after-restore.png`, looked at: Manuscript is on top and Part two sits below Research.
   - Moving a heading up three times and reloading keeps `Part two, Manuscript, ...`, and the export matches.
   - Dragging a heading: Part two moved to the top, `sidebarOrder` was stored, and the order survived a reload.
   - A project with no stored `sidebarOrder` (deleted from storage and confirmed `null` after the reload) renders `Manuscript, Fragments, Research, Part two`.
2. **Tab order.**
   - More is now first in the DOM (`ProjectSidebar.tsx:775-798`, no `order: -1`).
   - Probed: Tab from the row goes to "More actions for Opening", then "Open Opening beside". More is drawn left of the split icon.
   - `tests/split-view.spec.ts:408-411`: the only change is a second `Tab` and a comment, which is legitimate. I did not run split-view (not in my allowed set). The coordinator's full e2e covers it.
3. **Reset name.** `ProjectSidebar.tsx:880-882` shows the item only for a built-in heading with a `groupTitles` key. `App.tsx:2471` calls `renameGroup(p, id, "")` through `mutate`, which removes the key (`groups.ts:85-88`). The hs9 spec checks that the item appears, resets the name, then disappears.
4. **Card hover.**
   - `src/styles.css:2113-2118`: in cards the whole-button hover padding goes back to `--space-3`, and only the title span reserves 36 px on hover.
   - With `box-sizing: border-box` (`styles.css:230`) and the fixed `flex-basis`, the span's width does not change. Probed: a long title is 195 px at rest and 195 px on hover, and it is clipped with an ellipsis earlier. Nothing else moves.
   - Shifts: 0 over 3-14 word bodies with the current CSS.
   - **Would the rewritten test fail on the old CSS?** Yes. I injected the old rule (48 px on `.entry-main`, no title reserve) and the worker's relative measure (gap to the next card plus both heights) counted 3 shifts.
   - Cutting a long title earlier on hover is not a violation:
     - Nothing moves its neighbours.
     - It is layout, not a second weight or scale rule.
     - The list row already does the same (`styles.css:714`, 40 px).
     - The alternative is the icons drawn over the title text.
   - Screenshot `notes/review4-hs9-card-hover-light.png`, looked at: "A very long section title t..." ends before the "..." and split icons, and the cards above and below are in place. The dark screenshot was also saved.
5. **docs/design-system.md.**
   - `:198` has the always-visible "+" sentence for Manuscript and custom sections.
   - `:190` now describes the top groups as the three built-ins plus custom top-level sections.
   - Both are correct.

Findings: none blocking. Note: cargo test for the `store.rs` fixture is still not run (carried over from REVIEW-2).

## T301 -- HS10 small repairs

1. **should-fix (rejection reason) -- duplicated fallback constant.**
   - `src/App.tsx:100-108` (`unsavedDocumentSettings`: sans, 14, 1.5, `defaultPageLayout.margin/96`, no indent) restates Writer's fallbacks as separate literals:
     - `src/Writer.tsx:339-341`: `documentSettings?.fontSize ?? 14`, `?.lineSpacing ?? 1.5`, and font `undefined`, which goes down the same interface-font path as `"sans"` in `documentFontStack`.
     - `:343-346` (margin).
     - `:1131` (`firstLineIndent` false).
   - The values agree today; only the margin is shared (`defaultPageLayout`). If anyone changes Writer's 14 or 1.5, the Page setup toggle silently goes back to flipping the editor.
   - Fix: export one constant (for example `editorFallbackSettings` beside `defaultDocumentSettings` in `src/research/types.ts`). Writer reads `documentSettings ?? editorFallbackSettings` for font, size, line, indent and margin, and App merges onto the same constant.
2. **medium, coordinator or owner decision, not a worker defect -- the toggle now changes the export instead of the editor.**
   - The export reads `{...defaultDocumentSettings, ...project.documentSettings}` (`src/export/document.ts:91`, `ExportPanel.tsx:33`).
   - Probed on a project with no saved settings:

     | When | Export typeface shown | Stored settings |
     |---|---|---|
     | Before the toggle | "Times New Roman" (serif 12, double, indent) | none |
     | After one Page setup page-number toggle | "Sans (Arial in Word, Noto Sans in PDF)" | `{font:"sans",fontSize:14,lineSpacing:1.5,marginInches:1,firstLineIndent:false,...}` |

   - So the PDF or Word output silently changes font, size, spacing and indent.
   - The brief allowed merging onto the editor's effective value, so the worker followed it. Before HS10 the editor flipped instead.
   - Also, the Export panel's own "Page numbers" checkbox (`App.tsx:2635`, built from the defaults-merged `s`) still flips the *editor* to serif 12 on such a project. The same field therefore behaves differently from its two entry points. Bibliography (`App.tsx:2667`) does the same; the worker reported it.
   - The root cause is that the editor and the export disagree about what "no settings" means. Decide which one wins (or store only the changed keys and make Writer's margin read tolerate a partial object), then make all three handlers use it.
   - HS10.md does not mention the export effect.
3. **Checked, fine:**
   - A project with saved settings: toggling Page setup "Page numbers" changes only `pageNumbers`. Font, size, spacing, margin 1.25, indent and bibliography were preserved exactly.
   - Both handlers write through `mutate`.
4. **pageBreakKeys.ts:14-19.**
   - The marks are filtered through `editor.extensionManager.splittableMarks`, the same list Tiptap's own `splitBlock`/`ensureMarks` uses (`@tiptap/core` dist :2796-2811).
   - The link mark does not carry (it is not splittable). `textFormat` and bold do carry (unit tests).
   - Comment anchors are not marks in this schema, so they are not affected.
5. **ExportPanel label.** `ExportPanel.tsx:82` reads "Sans (Arial in Word, Noto Sans in PDF)". The help text never named Arial. The spec passes.
6. **Writer.tsx font box.**
   - `:1386` labels the current value from `BUILT_IN_FONTS` (the "System" stack) before `primaryFamily`, so unmarked text under the System interface font shows "System". The spec passes.
   - Nothing else in the region was lost. All present:
     - HS2 spacing popover: no "pt", no `toolbar-field-unit`, three NumberInputs width 64, labels "Space before, points" and "Space after, points" (`:1688-1740`).
     - HS5 `insertPageBreak(editor)` used by the Page setup button (`:1955`) and imported (`:66`).
     - HS7 `defaultFont = documentFontStack(documentSettings?.font, useInterfaceFont())` (`:338-339`).
     - HS8 "Page numbers" checkbox and "Position" dropdown, with the "Shown in PDF and Word exports." line (`:1909-1943`).

## What I ran
- `npx vitest run` pageBreakKeys, groups, model, hoverEmphasis, motion and src/export: 286/286 passed.
- `npx tsc -b`: clean.
- One locked Playwright run (port 1445):
  - Specs: `hs9-top-level-sections`, `hs10-repairs`, `w9-cards`, plus a throwaway `tests/review4-tmp.spec.ts` (6 probes; deleted afterwards).
  - Result: **18 passed, 0 failed**.

## Unverified
- `tests/split-view.spec.ts` (not in my run); the coordinator's full e2e covers it.
- Native WebKit rendering of the card title reserve and ellipsis; native persistence (cargo not run).
- Real PDF and Word output after the toggle. The export typeface was read from the Export panel and the stored settings, not from an exported file.
