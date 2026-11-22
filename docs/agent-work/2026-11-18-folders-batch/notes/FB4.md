# FB4 -- Folders on the Projects page (board T322)

Worker: agent-c096 (Claude Opus), 2026-11-19. Status: CLAIMED (Chromium browser preview only; nothing native).

## Files changed
- `src/library/folders.ts` (FB3 review extras): `parseLibrary` drops only malformed folder entries (bad id / name / parent / colour / collapsed, non-object, duplicate id) instead of returning an empty library; placements and order lists pointing at a dropped folder stay and read as top level. Whole-input garbage still gives `emptyLibrary`. `deleteFolder` now REMOVES the placement of projects that move to the top level (no literal `"root"` placement).
- `src/library/folders.test.ts`: two tests for the above (one new, one changed expectation).
- `src/library/useLibrary.ts` (new): the hook.
- `src/library/LibraryFolders.tsx` (new): `FolderHeading`, `byName`, `folderPath`, `folderSubtree`, `folderDestinations`.
- `src/library/folders.css` (new, 0 spacing declarations; imported by `LibraryFolders.tsx`).
- `src/components/ProjectLibrary.tsx`: New folder button, folder tree, context menus, rename, Move to folder, delete, colours, search paths.
- `src/App.tsx` (regions only): import of `fileProject`, `parseLibrary` and `SWATCHES`; `create(templateId, folderId?)` files the new project after the final `queue.flush()`; `colours` prop on `<ProjectLibrary>` (Color palette only, built from `SWATCHES`).
- `src/layoutBudget.json`: `"src/library/folders.css": 0` (the guard asked for it).
- `tests/fb-folders.spec.ts` (new), `tests/w9-projects-page.spec.ts` (toolbar now 8 buttons, "New folder" at index 5; added to the icon-grow list).
- Not changed: `src/components/library.css`, `tests/projects-screen.spec.ts`, `tests/alignment.spec.ts` (both pass unchanged), `ProjectSidebar.tsx` (swatches come from `SWATCHES` in `src/appearance.ts`).

## Interfaces provided (contracts FB5 relies on)
- `useLibrary(onError?)` returns `{ state, update, ready }`. Deviation: the plan's `useLibrary()` takes no argument; it takes an optional `onError` (ProjectLibrary passes `onDropError`), and also returns `ready`. `update` is a no-op until the first read has succeeded and for the whole session after a failed read. `update(fn)` computes `fn` synchronously from the latest state (a ref), so a caller can read values set inside `fn` right after the call; writes are chained in order.
- `ProjectLibrary` props: `onCreate(templateId?, folderId?)`, `colours?: {id,label,colour}[]`.
- DOM:
  - `div.library-tree.stack[ref=tree]` (position: relative; the ContextMenu's offsetParent) inside `DropTarget`.
  - Folder: `section.library-folder[data-folder-id=<id>]` > `div.folder-heading.row[data-folder-heading=<id>]` + (when expanded) `div.folder-body`.
  - Heading children: `button.folder-chevron.icon-button.slot` (aria-label = folder name, `aria-expanded`; the keyboard stop and focus-restore target), `svg.folder-icon`, `span.folder-name` (or `input.folder-name-input[aria-label="Folder name"]` while renaming), `span.folder-count` ("-- n", n = projects in the folder and all its subfolders). A click anywhere on the heading toggles collapse (the chevron's own click bubbles to it; it has no handler of its own). contextmenu and keydown handlers sit on the heading div (keydown ignores events from the input).
  - Projects: `div.folder-projects.project-list.project-list--{list|cards}[data-container=<folder id | "root">]` whose children are `div.project-row.row[data-project-id]` (attribute is NEW in FB4). The root container always renders (it holds the empty state); a folder's container renders only when it has projects, so an empty folder is just its heading.
  - Order inside a container: child folders (by name; `orderedFolders` while Custom) then the projects (`sortProjects` with the active sort, or `fallbackSort` + `orderedProjects` while Custom).
  - Search (query non-empty): one `div.folder-projects.project-list[data-search]` (no `data-container`), no headings; a filed project's title carries `span.project-path` "-- Essays / Drafts".
  - Project-row contextmenu / keydown are on the `.project-row` div. Focus restore selectors: `[data-project-id] .row-label` and `[data-folder-id] > [data-folder-heading] .folder-chevron`.
- Menus: folder -- Collapse|Expand, New project here, New subfolder, Rename, Move up, Move down, Move to folder…, Delete folder (danger), then the Colour swatches (Color only; picking the current colour clears it). Project -- Open, Move up, Move down, Move to folder…, Delete (danger, App's confirm). Move up / Move down are present and `disabled` (FB5 wires them; the items are built by `folderItems` / `projectItems` in ProjectLibrary). Move to folder… swaps in a second menu at the same point (new `key`): "Top level" then every folder path in tree order; current location disabled; a folder never lists itself or its descendants; labels are made unique with " (2)" because ContextMenu keys rows by label.
- Spacing (all primitives): headings indent one `--slot` per level through the row's own `--edge` (`--depth` inline custom property); the tree and each folder body are `.stack` with `gap-5` (list) / `gap-6` (cards) so a folder's last project is visibly separated from what follows; a section is `gap-0` (list) / `gap-2` (cards) between heading and body.

## Fail-first
FB3 extras (`npx vitest run src/library/folders.test.ts`, before the fix):
```
FAIL ... drops only the malformed folder entries and keeps the rest of the library
  expected [] to equal [["good",null],["child","good"],["orphan",null]]
FAIL ... deletes a folder while preserving child folders and project placement
  AssertionError: expected { p1: 'root', p2: 'b' } to deeply equal { p2: 'b' }
Tests  2 failed | 7 passed (9)
```
`tests/fb-folders.spec.ts` before step 1 (run interrupted after four tests because each waited the 90 s timeout for the missing button):
```
✘ 1 New folder sits left of the view toggle ... -- expect(names.indexOf("New folder")).toBe(...) Expected: 0 Received: -1
✘ 2 a subfolder nests ... -- locator.click: waiting for getByRole('button', { name: 'New folder', exact: true })
✘ 3 Move to folder files a project ... -- same
✘ 4 collapse hides a folder's rows ... -- same
```

## Passing
- `npx vitest run src/library/folders.test.ts` -> 9 passed. `src/layoutPrimitives.test.ts src/hoverEmphasis.test.ts` -> pass. `npx tsc -b` -> clean.
- `tests/fb-folders.spec.ts` -> 12 passed (11 + the FB4_SHOTS screenshot case).
- Final run after the chevron change: `tests/fb-folders.spec.ts tests/w9-projects-page.spec.ts tests/w9-icon-magnify.spec.ts` (FB4_SHOTS=1) -> `25 passed (1.3m)`. `npx vitest run` -> 1369 passed, 1 failed (the designTokens icon-size case below).
- Acceptance plus neighbours, one run under the serial lock, `--workers=1`, after the final spacing change: `tests/fb-folders.spec.ts tests/projects-screen.spec.ts tests/w9-projects-page.spec.ts tests/fb-projects-meta.spec.ts tests/fb-sort-menu.spec.ts tests/sb-motion-projects.spec.ts tests/drop-target.spec.ts tests/alignment.spec.ts tests/w9-icon-magnify.spec.ts` (with FB4_SHOTS=1) -> `99 passed (5.0m)`.
- `tests/layout-invariants.spec.ts -g T5`: the toolbar-centre case FAILS waiting for `.library-display label` -- the Sort `<label>` was removed by FB2 (the word "Sort" dropped), not by FB4; that shared spec needs its locator updated (region edit, coordinator). The other T5 cases pass.
- Not run: the full browser suite (once per batch, FB14), `tests/hover-emphasis.spec.ts`, `tests/popover-bounds.spec.ts`.

## Screenshots (Color palette, 1100 x 900, two folders, one subfolder, projects inside and at top level)
`test-results/fb-FB4/projects-folders-{list,cards}-{light,dark}.png` (made by `FB4_SHOTS=1 npx playwright test tests/fb-folders.spec.ts -g screenshots`; Playwright clears that folder on the next run with the same `--output`).
Looked at: first pass had no space between a folder's last row and the next heading / the top-level projects, so top-level projects read as part of the last folder; fixed with the stack gaps above. Second pass: the chevron ink sat ~4 px right of the project titles; `.flush-start` on the chevron with `--icon-size: 14px` now puts the chevron's drawn path within 2 px of the titles (asserted in the subfolder test).

## Not verified / notes
- Native app (library.json through Tauri) not run; browser preview storage only. WebKit not checked.
- `src/designTokens.test.ts` "sizes every icon at 16 px" currently fails on `ChevronRight size={12}` in `src/research/Cite.tsx` and `ResearchPanel.tsx` -- not FB4's files (research-bar task).
- Visual concern for the owner/coordinator: projects inside a folder are not indented (plan: heading only); grouping relies on the headings and the gaps.
- The card meta (FB1) puts "0 words" close to the date at 230 px cards; FB1's layout, untouched here.
- Deleting a project leaves its placement entry in the library (harmless: unknown projects are ignored).
