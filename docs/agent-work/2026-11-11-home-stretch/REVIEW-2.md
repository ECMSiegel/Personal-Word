# Review 2 -- T292 (HS1), T294 (HS3), T300 (HS9)

Reviewer: Opus reviewer batch 2 (agent-082c), 2026-11-12. No source edited.

## Verdicts
| Task | Verdict |
|---|---|
| T292 HS1 Export menu above the format bar | APPROVE |
| T294 HS3 Square checkboxes everywhere | APPROVE |
| T300 HS9 Top-level sections beside Manuscript | REJECT (one should-fix ordering defect, reproduced; rest is sound) |

## T300 HS9 findings

1. **should-fix (rejection reason) -- sidebar order and Read/export order disagree after a whole-version restore.**
   `src/components/ProjectSidebar.tsx:248` keeps a session-local `localOrder` (reset only when `project.id`
   changes, :259-261) and `:264` uses `props.groupOrder ?? localOrder`. `moveGroup` (:276-284) writes both.
   When the restored version has no `sidebarOrder`, `props.groupOrder` is undefined and the sidebar keeps
   showing the stale local order, while `project.order` (and `normalizeOrder`, which reads
   `project.sidebarOrder`) puts Manuscript first.
   Reproduced in the browser: add "Part two" with "Alpha", snapshot V1, move Part two above Manuscript,
   restore V1. Sidebar: `Part two, Manuscript, ...`; plain-text export: `Opening, Alpha`. It still disagrees
   after a further edit (the edit normalises against `project.sidebarOrder`, which is undefined), and only a
   reload brings the sidebar back to `Manuscript ... Part two`. This breaks the owner decision (Read and
   exports follow the sidebar order).
   The cause is not missing normalisation in `restoreVersion` (`src/App.tsx:1376-1399`): stored versions are
   already normalised, because every write goes through `mutate`. The fix belongs in the sidebar. When the
   parent owns the order (`props.onGroupOrder` given), derive `topOrder` only from `props.groupOrder`,
   e.g. `sidebarOrder: props.onGroupOrder ? props.groupOrder : localOrder`. Or reset `localOrder` whenever
   `props.groupOrder` changes. Add a Playwright case: snapshot, move a heading, restore, then assert the
   sidebar heading order equals the export order.
2. **low -- Tab order differs from visual order in a row.** `ProjectSidebar.tsx:781-783`: More is drawn
   left of the split icon (`order: -1`), but Tab goes title -> Open beside -> More (probed). This was done
   on purpose to keep the split-view spec unchanged. It is acceptable, but cleaner to put More first in the DOM
   and update that spec's Tab expectation.
3. **low -- "restore default name" is only reachable by typing the default.** The design says empty/unchanged
   restores; the shared name dialog refuses empty. `renameGroup` handles it correctly
   (`src/organization/groups.ts:81-89`). Either accept, or add a "Restore default name" heading-menu item
   for renamed built-ins.
4. **low (mostly pre-existing) -- hovering a card with body text grows the card and moves the cards below.**
   `src/styles.css:2112` (HS9, 48 px) and the older `:714` (40 px) pad the whole `.entry-main` button, which
   includes the full-width `.entry-preview`, so the preview re-wraps on hover. Sweep of 3-16 word bodies at the
   default width: the current rule shifts the next card by 18 px at 4 lengths. Forcing the old 40 px shifts it at
   3 lengths, so this is pre-existing and HS9 makes it slightly worse. Reserving the space on the title span
   instead (`.cards-view .entry-main > span { padding-right: 48px }` and no hover padding on `.entry-main`)
   gave zero shifts. The HS9 spec's "shifts nothing" case uses cards with no body text, so it cannot catch this.
   This hover padding rule is otherwise legitimate: it is not an emphasis/weight/scale rule.
5. **note -- duplicate custom titles are allowed** (two identical "Move to X" rows). Harmless, not required.

Checked and fine:
- **groups.ts (a):**
  - `normalizeOrder` returns the same array when there are no groups, and when nothing moves.
  - Order is always a permutation of the section ids; unit tests run it against `validateProject`.
  - Orphans fall back to Manuscript in the list, the highlight (`allIn`) and the bucket.
  - Delete moves entries without deleting anything, and cleans `sidebarOrder`.
  - Built-in rename to the default (or blank) removes the key.
- **App (b):**
  - `mutate` wraps `normalized(change(p))` (`App.tsx:556-563`), so add, reorder, move, group handlers,
    heading moves (`onGroupOrder` via `mutate`), passage restore (`App.tsx:1652`) and entry delete all store
    a normalised order.
  - Extract creates a fragment, not a section, so `order` is untouched.
  - The palette lists sections in `project.order`.
  - Delete-section case: no disagreement. The deleted section's entries join Manuscript, and both the sidebar
    and Read use `project.order`.
  - A version restore to a project without groups shows everything under Manuscript.
- **Sidebar (c):**
  - Only the section holding the open entry is lit.
  - Drag A3 to the top of a custom section gives A3, A1, A2 in the sidebar and the same in the export.
  - Find in project filters per section.
  - In Read, the scroll-spy rail renders 3 lines for the custom section and marks the right one active.
  - Tints match Manuscript in Color, light and dark.
  - The "+" is aligned; long titles are ellipsised.
  - The "New top-level section" row is a quiet muted row with a "+", in the same column as the rows. Fine
    against design-system.md.
  - The More button uses `icon-grow`; there is no new hover rule (hoverEmphasis/motion tests pass).
- **Tests (d):**
  - `tests/hs9-top-level-sections.spec.ts` covers reload (rename survives), Read order, plain-text order,
    move, heading move, delete with snapshot, and built-in rename and restore.
  - The two changed pins in `tests/sidebar-context-menu.spec.ts` (:106, :227) are exactly the new menu
    items and are legitimate.
  - Probed extra: a moved custom heading survives reload, and the export matches.

## T294 HS3
- No findings.
- One global rule `src/styles.css:510-540`: `appearance: none`, 14 px, `--muted` border, radius 0,
  accent fill, `--paper` check.
- No other `input` rule outranks it on a checkbox site. Checked:
  - `.dialog input` now excludes checkboxes.
  - `.research-lookup`, `.reader-options` and `.revision-selection-locations` hold no checkboxes.
  - Per-context rules only set margins or size 14.
- Check marks are legible in light (Settings) and dark (injected states).
- Focus ring visible: 2 px accent outline.
- Disabled: opacity 0.35 through the existing `input:disabled`.
- Label centres are within 1 px of the box centres on the Settings checkboxes.
- The Comments "Show resolved" box sits close to its label (global `margin: 0`; about 4 px gap). Cosmetic, not
  a finding.

## T292 HS1
- No findings.
- `.export-menu.popover { z-index: 41 }` (`src/export/export-menu.css:26-30`).
- Other top-bar controls: Snapshot opens a modal (70) and Saved is a plain span, so no other popover there.
- 41 stays below the command palette (60), modals and the context menu (70).

## Coordinator notes (not reasons to reject)
- `docs/design-system.md` still lacks the HS9 sentence: the "+" on Manuscript and custom top-level headings is
  always visible.
- `docs/design-system.md:190` still says "three reorderable top groups"; it needs a line on custom sections.
- `cargo test` is needed for the `src-tauri/src/store.rs` fixture lines (not run).

## What I ran
- `npx vitest run` groups, model, checkboxSquare, hoverEmphasis and motion tests: 99/99 passed.
- `npx tsc -b`: clean.
- Playwright (port 1442, serial lock):
  - Regression: hs9, sidebar-*, drag-reorder, scrollspy, w9-cards, hs1, hs3 -- 99 passed, 12 skipped,
    0 failed.
  - Two throwaway probe runs (5 and 2 tests, all passed): `tests/review2-tmp.spec.ts`, now deleted.
- Screenshots: `notes/review2-*.png`.

## Unverified
- Native persistence of `groups`/`groupTitles`/`group`, and their removal when deleted (cargo not run;
  browser storage only).
- WebKit rendering of the checkbox check mark and the More button.
- Floating-sidebar mode with custom sections.
