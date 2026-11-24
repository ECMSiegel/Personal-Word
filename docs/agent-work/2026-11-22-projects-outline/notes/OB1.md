# OB1 notes (T335, agent-9226)

## Built
- `src/library/folders.ts`: `ItemKey`, `itemKey`, `parseKey` (first two characters decide the kind, so ids starting with `f:`/`p:` are safe), `PIN_LIMIT`, `LibraryState.pins`, `savedItems`, `placeBeside`, `togglePin`. `parseLibrary` and `copyState` carry pins (invalid and duplicate entries dropped, first 3 kept, non-array = none; `pins` is absent when empty). `deleteFolder` also drops `items:<id>`, `f:<id>` from every `items:` list and from pins. `fileProject` also drops `p:<id>` from every `items:` list.
- `src/libraryPreferences.ts`: six sorts, five fallback sorts, `LIBRARY_COLUMNS`, `foldersFirst`, `columns`; `view` removed and ignored on read. A saved empty `columns` list is kept (no columns); unknown/duplicate columns are dropped.
- `src/library/outline.ts`: `buildOutline`, `siblings`, `OutlineRow`. Pure, imports no React/CSS (has its own folder-path helper rather than importing `folderPath` from the .tsx).
- Tests: 58 in the four files (`npx vitest run src/library src/libraryPreferences.test.ts`). Each new test failed first (21 failed before the code), then two test mistakes of mine were corrected (expected orders), not the code.

## Decisions I made (plan was silent)
- Ordering inside a sort: newest/biggest first; a missing value sorts last; ties break by name. Words/Sections default to biggest first. `reverse` flips the whole result (so "empty folders last" becomes first when reversed).
- Sort by Added with Mixed (foldersFirst off): folders have no added date, so they sort after dated projects and by name among themselves.
- Under Custom, the fallback sort is applied with no reverse.
- `placeBeside`: rows on screen but not in the saved order are put in front (as they display), keeps off-screen saved keys, de-duplicates, returns a new state; the caller must switch sort to Custom.
- `OutlineRow.pinned` is true for any row whose own key is pinned, including a pinned project shown inside a pinned folder (OB2 can decide whether to show the pin icon there).
- Pinned rows keep their original `container`. `path` is set on any lifted row (project or folder) whose container is not root. The plan only says projects; folders get it too.
- A pinned item inside a collapsed pinned folder is simply not shown; a pinned folder that is collapsed lifts without children.
- `parseLibrary` pins: only strings starting `f:`/`p:` with a non-empty id count.
- Old-key reading: `savedItems` returns old folders list then old projects list; with foldersFirst on this reproduces today's Custom display (tested against `orderedFolders`/`orderedProjects`, including a nested folder). With only unlisted rows, fallback order is the fallback sort (today folders were always by name).

## Remaining tsc errors (expected, belong to OB2/OB4)
- src/components/ProjectLibrary.tsx(112,11): TS2339 Property 'view' does not exist on type 'LibraryPreferences'.
- src/components/ProjectLibrary.tsx(759,42): TS2353 'view' does not exist in type 'Partial<LibraryPreferences>'.
(None in libraryDrag.ts / useLibraryDrag.ts, unlike the plan's guess.)

## Later tasks must know
- `folders.ts` `Summary` is still `{id}`; outline.ts uses `Summary` from `../model`.
- `sortProjects` in ProjectLibrary.tsx is untouched and does not know the Words/Sections sorts.
