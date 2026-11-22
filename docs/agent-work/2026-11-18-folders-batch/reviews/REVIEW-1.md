# REVIEW-1 -- FB3 (T321), FB11 (T329), FB12 (T330)
Reviewer: Claude Opus reviewer (agent-4a97), 2026-11-19. Read-only review: no source or test file was edited.
Tree: main @ 3ac28af plus uncommitted work from several tasks; only each task's files were judged.

## FB3 (T321) -- Library store: APPROVED

### Evidence (run by the reviewer)
- `npx vitest run src/library/folders.test.ts src/storage.test.ts`: 2 files, 33 passed.
- `cd src-tauri && cargo test --offline --jobs 1 -- --test-threads=1`: 75 passed, 0 failed, 1 ignored. The three new tests are `library_file_round_trips_and_is_not_a_project`, `invalid_library_write_preserves_existing_file` and `second_library_write_keeps_a_backup_of_the_first`.
- `npx tsc -b`: clean (no output) on the tree at review time.

### Contract check
- Every `folders.ts` signature matches the plan. `orderedProjects` is generic over `{id}`, which is compatible with the contract.
- `moveProject` always rebuilds from `shownIds`, and works when the project was absent from them (tested).
- `reorderFolder` and `orderedFolders` use `order["folders:" + (parent ?? ROOT)]`.
- `fileProject` removes the project from every order list.
- `readLibrary`:
  - Native: `invoke("read_library")` returns `null` when the file is missing, giving `null`.
  - Native: when the file holds invalid JSON, the Rust read errors and `JSON.parse` would also throw, so the call rejects.
  - Browser: `read("library", null)` throws on bad JSON inside the async function, so it rejects too.
- Rust `write_library` refuses invalid JSON and anything over 1 MB before touching disk. It copies the existing file to `library.backup.json`, then writes through `atomic`.
- Both `generate_handler!` lists contain `read_library` and `write_library`.
- `Store::list()` skips every entry that is not a UUID-named directory (store.rs :214), so `library.json` and `library.backup.json` can never appear as projects or as damaged.
- The fail-first run for the TypeScript tests is recorded in notes/FB3.md.

### Findings
- High: none. Medium: none.
- Low (left unfixed):
  1. `deleteFolder` writes the literal `"root"` into `placement` for projects of a deleted top-level folder, instead of deleting the key. This is correct only through `containerOf`; FB4 must never read `placement` directly.
  2. There are 3 cargo tests, not the "four" the plan names, but together they cover all five required behaviours. There is no fail-first record for the Rust tests.
  3. No test covers a corrupt `library.json` making `read_library` fail in Rust, or the browser branch rejecting on bad JSON. The code does both.
  4. Coordinator note before FB4: `parseLibrary` returns an empty library if a single folder entry is malformed, duplicated or carries a different `version`. This matches the written contract ("bad input -> emptyLibrary"). Combined with FB4's write-on-update, though, one bad entry would lose every folder after two saves, because the backup is only one write deep. FB4 may want to treat "valid JSON but parsed to empty while the raw value had folders" like a failed read.

## FB11 (T329) -- Drag project tabs: APPROVED

### Evidence (run by the reviewer)
- `npx vitest run src/components/dragReorder.test.ts`: 34 passed.
- `npx playwright test tests/fb-tab-drag.spec.ts tests/drag-reorder.spec.ts tests/features.spec.ts --workers=1 --trace off` (dev server, serial lock): 25 passed.
- `npx tsc -b`: clean.

### Contract check
- `useDragReorder` takes `axis?: "x" | "y"`, default `"y"`.
- Vertical callers are unchanged: `keyboardMove` defaults to `"y"`, and `DragController`'s new `byPointer` argument defaults to false.
- `ProjectTabs` has the `onReorder(from, to)` prop.
- The App change is one prop plus one import, using the existing `reorder` helper (imported as `reorderList`, because App already has a local `reorder`). It is not a whole-file rewrite.
- The close button never starts a drag. A drag swallows the click that would otherwise select the tab.
- Option+Left and Option+Right move the tab, announce the move in a polite live region, and keep focus on it. All three are tested.
- The existing tests were not weakened; the new x-axis unit tests are additive.
- Fail-first evidence is in notes/FB11.md.

### Findings
- High: none. Medium: none.
- Low (left unfixed):
  1. `drag-reorder.css` overrides the drop line's `height: 2px` with `block-size: 100%`. The worker says this was chosen so the layout budget stays at 1. The guard's `SPACING_PROP` regex (`src/layoutPrimitives.test.ts` :84) does not match logical properties, so this is a hand-written height the guard cannot see. It is a drop-line size, not spacing, but the coordinator should decide one of two things: allow it, or have the guard count `block-size` / `min-block-size`.
  2. The announcement reads "Alpha moved to position 2 of 3". The sidebar says "Moved Alpha to position 2 of 3" (`ProjectSidebar.tsx` :471).
  3. Only Chromium against the dev server was checked; native WebKit was not.

## FB12 (T330) -- Real page view for Read and Bibliography: REJECTED

### Evidence (run by the reviewer)
- `npx vitest run src/editor/staticPagination.test.ts src/editor/pagination.test.ts src/components/ReadDocument.test.ts src/layoutPrimitives.test.ts`: 39 passed.
- `npx playwright test tests/fb-paged-read.spec.ts tests/pages.spec.ts tests/scrollspy.spec.ts tests/floating.spec.ts tests/research.spec.ts --workers=1`: 92 passed.
- `npx playwright test tests/hs7-document-font.spec.ts tests/w9-fonts.spec.ts tests/hs9-top-level-sections.spec.ts tests/appearance.spec.ts tests/assets.spec.ts tests/hover-emphasis.spec.ts --workers=1`: 46 passed.
- `tests/features.spec.ts` passed in the FB11 run above.
- `npx tsc -b`: clean.
- Screenshots in `test-results/fb-FB12/` were regenerated by this run and looked at:
  - read-light shows a white sheet on a grey desk, the page label "Halloway 1" at top right, title, section heading, and justified-width paragraphs.
  - read-break-dark shows the gap between sheets 1 and 2, with page 1's text ending inside the margin.
  - bibliography-dark shows the hanging indents kept across the page break.
  - All three look correct.
- A temporary probe (deleted afterwards; it lived outside `tests/`) ran under the lock in the default state: page view on, floating sidebar on, four sections, 1600x900 and 1100x900.

### What is right
- The interfaces match: `measureStatic`, `paginateStatic` and `PagedSheet` with props `layout`, `settings`, `templateId`, `contentKey` and `className`.
- The surface is keyed by `contentKey`, there is a ResizeObserver, a re-run after `fonts.ready`, and a re-run on image load.
- The `paged` preference defaults to true.
- Removing spacers is exact (unit-tested). Joining the split text nodes instead of calling `normalize()` is a sound, documented deviation.
- Paragraphs really split across pages; the whole-paragraph fallback was not needed.
- The shared specs were only seeded with `paged: false`; no assertion was changed.
- The budget entry for `paged-sheet.css` is 0.
- The `read-<id>` anchors survive on the title blocks.

### Findings
- High:
  1. **The floating sidebar overlaps Read in page view at ordinary widths.**
     - At 1100x900, the sidebar box spans 0-206 px while the sheet starts at 142 px.
     - The sidebar's "Find in project" collides with the reading toolbar's "Font" label.
     - The Manuscript heading's controls sit on the "MANUSCRIPT -- READ ONLY" eyebrow.
     - The section rail draws inside the sheet.
     - Document paragraphs (left 238) stay clear by 32 px.
     - Writer in page view falls back to the docked panel at this width (`tests/floating.spec.ts` "a 1100 px window: ... page view keeps the panel"). Read in page view does not.
     - Cause: `documentEdges` (`src/components/floating.ts` :109-111) measures `.manuscript-read .read-prose`. In page view that element is the sheet's inner text column, not the sheet. Also, `paged-sheet.css` narrows `.manuscript-read.is-page-view`'s side padding, which pulls the toolbar and eyebrow left with it.
     - At 1600 px the sidebar (right edge 270) clears the sheet (left edge 392), so the wide-window case is fine.
- Medium:
  2. **The scroll tracker shows wrong progress in Read page view, which is the default.**
     - `useReadSpy` (`src/components/scrollspy.ts` :120-126) takes the section's height from the `read-<id>` element's box.
     - In page view that element is just the title button, so progress jumps from 0 to 1.000 as soon as the title passes one third of the view.
     - Probe output at 10 % scroll steps: `spy=[1.000,-,-,-]` from 10 % onward, `[-,1.000,-,-]` at 30-40 %, and so on. The rail never shows partial progress.
- Low (may stay unfixed):
  3. Only `<p>` blocks report lines. A list, blockquote or table taller than a page cannot split, and will run past the sheet's margin.
  4. The page-view Read markup duplicates the Notes and Bibliography rendering from the continuous branch, so the two can drift apart.
  5. The worker's own notes list three unchecked items: the reader font now applies to Notes and Bibliography in page view; manual page breaks are not honoured; and switching tabs between two projects in Read was not tested.

### Fixes required (minimal)
1. `src/components/floating.ts` `documentEdges`, Read mode: when Read is paged (`.manuscript-read .editor-paper` exists), measure the `.editor-paper` (the sheet), as Writer's paged path does, instead of `.read-prose`.
   - Make sure the column-growth/fit calculation for that path matches Writer's, so 1100 px falls back to the docked panel.
   - Add a test to `tests/floating.spec.ts` in page view (no `paged: false` seed). At 1600 px, assert the sidebar is clear of `.page-sheet` by the 16 px gap. At 1100 px, assert it falls back to the normal panel, or else is clear of the sheet, the reader toolbar and the eyebrow.
   - Show the new test failing on the current tree first.
2. `src/components/scrollspy.ts` `useReadSpy`: compute each section's height as the distance from its anchor's top to the next anchor's top. For the last section, use the bottom of the scroller's content.
   - Continuous view keeps the same numbers, because `section` boxes are contiguous.
   - Add a page-view case to `tests/scrollspy.spec.ts` asserting that mid-section progress lies strictly between 0 and 1. Show it failing first.
3. File ownership: `floating.ts` and `scrollspy.ts` are outside FB12's registered files. Both are unowned on the board (`team.py owner`), so FB12's worker can register them with `files add`.
