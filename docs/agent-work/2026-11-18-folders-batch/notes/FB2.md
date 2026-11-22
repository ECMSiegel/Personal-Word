# FB2 -- Sort button: the current sort is the button; add Custom

Board: T320. Owner: agent-2f5c (OpenCode). Date: 2026-11-19. Status: done, awaiting review.
Nothing committed.

## What changed

- `src/libraryPreferences.ts`: `LIBRARY_SORTS` is now `["name","added","edited","custom"]`. New
  `LIBRARY_FALLBACK_SORTS = ["name","added","edited"]` and type `LibraryFallbackSort`.
  `LibraryPreferences` gains `fallbackSort: LibraryFallbackSort`, default `"edited"`. Reading
  validates it against `LIBRARY_FALLBACK_SORTS`, so a saved `"custom"` (or junk) reads back as
  `"edited"`. The historical key `folio.workspace.library` and the field names `sort`, `reverse`,
  `view` are unchanged; the added key is additive.
- `src/libraryPreferences.test.ts`: 8 cases. New/changed: a saved Custom sort with its fallback
  reads back; `fallbackSort: "custom"` is rejected; saved-value and write cases now include the new
  field.
- `src/components/Dropdown.tsx`: two optional props, both defaulting to today's behaviour.
  - `cover?: boolean` -- passes `morph="anchor"` to `Popover` (the menu's top-left sits on the
    trigger's) and adds the class `dropdown-menu-cover` to the menu.
  - `plain?: boolean` -- omits the `.dropdown-check` span entirely, so there is no tick column;
    the current row is still weight 600 through the existing `.dropdown-option.is-current` rule.
  - `morph={cover ? "anchor" : "edge"}` and the className expression keep every other Dropdown
    byte-identical (`Popover`'s default is `"edge"`).
- `src/components/dropdown.css` (region edit, one rule next to `.dropdown-option.is-current`):
  `.dropdown-menu-cover { min-width: 100% }`, so the menu is never narrower than its trigger. The
  stylesheet's own 320 px cap and `placePopover`'s viewport clamp still apply.
- `src/components/ProjectLibrary.tsx`:
  - new exported pure helper `sortProjects(projects, sort, reverse)` -- the old inline
    sort-and-reverse moved out unchanged (name via `localeCompare`, added/edited via the ISO string
    comparison, `reverse` reverses the result); the caller keeps filtering by the search needle.
  - `changePrefs` writes `fallbackSort` when the new sort is `"custom"`: it records the sort the
    owner came from, and leaves an existing fallback alone if Custom was already selected.
  - the Sort control is now the `Dropdown` itself (`aria-label="Sort projects"` kept, `cover`
    `plain` passed, option `custom` / "Custom" added). The wrapping `<label class="cluster">` and
    the visible word "Sort" are gone.
  - while `sort === "custom"` the list renders `sortProjects(..., fallbackSort, reverse)`, and the
    reverse button (`aria-label="Reverse project sort order"`) is `disabled`.
- `tests/w9-projects-page.spec.ts`: the saved-preferences assertion now expects
  `{ sort: "name", fallbackSort: "edited", reverse: true, view: "cards" }` (the field is part of the
  stored object).
- `tests/fb-sort-menu.spec.ts` (new, 3 cases): the trigger reads "Last edited" at rest and the word
  "Sort" is absent from the toolbar; the open menu's left edge and top equal the trigger's (+-1 px)
  and its width is between the trigger's and trigger + 24 px; the menu has no `.dropdown-check`; the
  four rows are Name, Added, Last edited, Custom; Added reorders by `createdAt`, Custom then keeps
  that order, its button says Custom, reverse is disabled, and the stored object is
  `{ sort: "custom", fallbackSort: "added", reverse: false, view: "list" }` across a reload; Name
  sorts alphabetically and Custom then keeps it.
- `tests/fixtures/popover-baseline-rects.json`: **no change was needed**. The fixture holds six
  keys (Editor zoom, Font family, Line and paragraph spacing, Page setup, Paragraph style, Prose
  check) -- format-bar triggers only; there is no Sort entry to regenerate. Step 6 of the plan
  ("regenerate only the Sort entry") therefore applied to nothing, and `popover-bounds.spec.ts`
  passes on the unchanged fixture.

## Fail-first

Run with `src/components/Dropdown.tsx`, `src/libraryPreferences.ts` and
`src/components/ProjectLibrary.tsx` temporarily restored from `HEAD` (pre-FB2 tree; scratch copies
under `node_modules/.cache/personal-word-beta/fb2/`, restored immediately afterwards and checked
with `cmp` against my working copies -- silence = identical).

```
npx playwright test tests/fb-sort-menu.spec.ts --workers=1
  ✘ the trigger is the current sort and the menu covers it, with no tick column
    Error: menu y 183.5 vs trigger 158.5   (the menu sat 25 px below the trigger)
  ✘ choosing Added orders by when projects were added, and Custom keeps that order
    waiting for getByRole('option', { name: 'Custom', exact: true })   (option absent)
  ✘ Name sorts alphabetically and Custom keeps coming from it
    waiting for getByRole('option', { name: 'Custom', exact: true })   (option absent)
  3 failed
```

Log: `node_modules/.cache/personal-word-beta/fb2/failfirst.log` (attempt 2; attempt 1 was a first
draft whose locator used the new class, so it only proved the class was absent -- it was replaced by
the behaviour locator `.popover.dropdown-menu` before this run).

Two honest limits on that evidence: at `HEAD` the geometry assertion fails before the no-tick-column
assertion is reached, so the "no check column" half is proven by the passing run only; and the two
Custom cases fail because the option does not exist yet, not because the order is wrong.

## Passing

```
npx vitest run src/libraryPreferences.test.ts
  8 passed (1 file)                       # log: fb2/accept.log

npx playwright test tests/fb-sort-menu.spec.ts tests/w9-projects-page.spec.ts \
    tests/t10-dropdown-label.spec.ts tests/popover-bounds.spec.ts --workers=1
  24 passed (2.4m)                        # log: fb2/accept.log
```

Also run, not part of the acceptance list:

```
npx vitest run src/layoutPrimitives.test.ts
  3 passed      # dropdown.css gained a min-width only; no counted spacing property changed
npx tsc -b
  clean         # whole tree, no errors in this task's files
```

## Not verified / limits

- Chromium only (Playwright's Chromium). The `morph="anchor"` geometry is a WebKit-sensitive
  measure; nothing was checked in the native app or Safari.
- `tests/fb-sort-menu.spec.ts` checks the menu geometry at 1100 px width only; a narrow window where
  the trigger sits near the right edge (clamping) is not covered.
- The browser preview cannot reach a project with no counts, but FB2 does not depend on that.
- Custom shows the fallback order because folders and hand-made order do not exist yet (FB4/FB5);
  this task does not implement persistence of a hand-made order.

## Deviations from the plan text

- The plan wrote `sortProjects(projects, sort: "name"|"added"|"edited", reverse)`; the signature uses
  the exported `LibraryFallbackSort` type, which is exactly that union. No behaviour difference.
- The plan described `cover` as "width = max(trigger, longest row)" but named only `morph="anchor"`
  for the mechanism; `morph="anchor"` gives the corner, not the width, so the width comes from the
  `.dropdown-menu-cover { min-width: 100% }` rule plus the menu's natural (content) width. The
  stylesheet's 320 px cap is untouched.
- `tests/fixtures/popover-baseline-rects.json` was registered on the task but needed no edit (see
  above).
