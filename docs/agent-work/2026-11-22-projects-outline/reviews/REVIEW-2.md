# REVIEW-2 -- repair check of OB10 (T346) against REVIEW-1

Reviewer: Claude Opus (agent-74f5), 2026-11-23. A repair check, not a second full review. No source or spec edits. Evidence status: CLAIMED (Chromium on the built preview, isolated preview storage; nothing checked in the Mac app's WebKit, no native run).

## Verdict: APPROVE WITH REPAIRS (one blocker, N1)

Every REVIEW-1 finding OB10 was asked to fix is fixed, and the layout did not move. But the B1 repair added a new way to lose pins: if a folder's Pin or Unpin menu is opened while the project list is still empty (the first moments after launch), every project pin in `library.json` is silently deleted. This was reproduced (below). The repair is small. The board has only approve or reject, and N1 is silent data loss, so T346 is **rejected on the board** to get N1 (and the S3 ring, should-fix) repaired before OB9. Nothing else needs redoing.

## How it was checked
- Fresh build under the serial lock with Node v22.23.3: `npm run build` exit 0 (`node_modules/.cache/personal-word-beta/rv2-build.log`); `npx tsc --noEmit` exit 0 (`rv2-tsc.log`); `npx vitest run` 100 files / 1442 tests passed (`rv2-vitest.log`).
- Throwaway harness `reviews/ob-review2.config.ts` + `reviews/ob-review2.spec.ts` (helpers copied from ob8), port 1491, one worker: 16 passed (`rv2-review-run1.log`), and the L test was re-run once with a fixed announcement reader (`rv2-review-run2.log`). Measurements: `reviews/shots2/measure.json`. Screenshots: `reviews/shots2/`.
- Screenshots opened and looked at: `b1-after-delete-dark`, `b2-500tall-end-dark`, `s3-blank-rightclick-light`, `l2-chevron-hover-dark`, `b3-band-1280-light`, `b3-band-600-dark`, `b1-after-delete-light`, `b1-risk-empty-listing`, `b2-500tall-end-light`, `s2-chooser-words-hidden-dark`, `s3-focus-light`, `s3-focus-header-dark`, `l1-rename-row-light`, `l1-rename-dark`, `l3-mid-drag-light`, `s2-sidebar-menu-light`, `s2-toolbar-dropdown-dark`, `s2-menu-folder-dark` (next to REVIEW-1's `shots/menu-folder-dark`). The others were only measured.
- Full browser suite not run (the final validation task runs it).

## Per finding

| Finding | Result | Evidence |
|---|---|---|
| B1 deleted pinned project keeps its slot | **Fixed, with a new problem (N1)** | Pinned Fiction, Alpha, Poems; deleted Poems. Stored pins became `[f:f-fiction, p:Alpha]`, 2 marks, band updated, unpinned rows offer an enabled "Pin to top"; the same after reload; pinning Zebra then works (`b1-light`/`b1-dark`, `b1-after-delete-*`, `b1-repinned-*`). |
| B2 sort menu highlight out of view | Fixed | 1280x500, keyboard open, ArrowDown x14, End, Home: the highlight was inside the menu on every step (End: row 461-493 in a menu ending at 494, scrollTop 115). Highlighted rows get the shared faux bold (`text-shadow 0.3px`). `b2-500tall-end-*`. |
| B2 styles.css selector change | Allowed | The diff adds `[role="menuitemradio"], [role="menuitemcheckbox"]` to the three existing `:is(...)` lists of the one shared emphasis block (base transform, hover/focus, `:active`). No new rule. The only other `menuitemradio` elements (the colour swatches) are `<button>`s and already matched. REVIEW-1 has no baseline shots of these two, so this is what can be shown. The sidebar header menu (`s2-sidebar-menu-*`) has 6 plain `menuitem` rows plus the swatches, no check span, and a 13 px label inset (the same as the folder menu, 478 - 465). The toolbar Paragraph style dropdown uses `role=option`, which the selector change does not touch, and it looks normal (`s2-toolbar-dropdown-dark`). |
| B3 long pinned name loses its pin | Fixed | 117-character pinned title: title ellipsized, "-- Fiction" and the pin kept, pin right edge = name column right edge (634 at 1280, 444 at 900, 446 at 600), first cell starts 8 px after it. `b3-band-*`. |
| S1 pin inside a pinned folder has no mark | Fixed | Essay one inside pinned Essays shows its own pin (3 marks for 3 slots); path only on top band rows. |
| Alignment after the new name cell | Unchanged | No-pin tree: names 296/320/344/368 at 1280 (106/130/154/178 at 900, 80/104/128/152 at 600); cell right edges 732/812/910/1008 at 1280 and 542/622/720/818 at 900; header labels at the same x as REVIEW-1 (e.g. Edited 697.8-732); no sideways scroll. Identical to REVIEW-1. |
| S2 ContextMenu checked state | Fixed | Folder menu (465,314, 214x320) and project menu (465,592, 160x202) have exactly REVIEW-1's boxes, label x 478, 32 px rows, plain `menuitem`, no check span. Column chooser: all four labels start at x=804, rows are `menuitemcheckbox` with `aria-checked`, blue Lucide check in the check column, hover emphasis applies. |
| S3 header hit area | **Fixed, with a new problem (S-new-1)** | A right-click on blank header space opens "Columns". A click in the top-left corner of the Words cell (4,3 px in) sorts by Words. Buttons now fill their cells (e.g. Words 72x40). Label positions are the same before and after sorting, and the same as REVIEW-1. The focus ring (2 px, 1 px offset) is drawn in full, not clipped (only `.library` scrolls, and the ring is inside it), but it is now oversized: see S-new-1. |
| L1 rename text jump | Fixed | Input padding 0; "Essays" text starts at 296, the same as "Fiction" above. The font matches the folder name (13 px, 700). `l1-rename-row-light`, `l1-rename-dark`. |
| L2 chevron hover | Fixed | The chevron svg scales `matrix(1.25…)` on hover; the name stays at 320. |
| L3 trash while dragging | Fixed | 0 trash icons visible mid-drag. After the drop, hover shows the trash again. `l3-mid-drag-*`. |
| L5 announcements | Fixed | "Drafts is already the last folder", "Essay one is already the first project". When nothing of the other kind follows, the message is unchanged ("Huge manuscript is already last"). |
| L7 stale comment | Fixed | `outline.css` says 16px. |

Spacing budget: `outline.css` adds only `padding: 0` and `--row-height: 0px`, which the budget test counts as zero; the unit run passes `layoutPrimitives.test.ts` and `hoverEmphasis.test.ts`.

## New findings

### N1 (blocker) -- Pinning or unpinning anything while the project list is empty deletes every project pin
- **Where:** `pinItem` in `src/components/ProjectLibrary.tsx:405-414`. It treats every pin whose project is not in `projects` as stale. `run` then calls `togglePin(dropPins(s, stale), key)` and writes `library.json`, on Pin and on Unpin alike.
- **When `projects` is wrongly empty:** App's `library` starts as `[]` (`App.tsx:512`) and is filled only when `storage.list()` resolves (`App.tsx:633-646`). `useLibrary` reads `library.json` separately (`useLibrary.ts:30`). Natively, `list()` opens every project's SQLite database (`store.rs:208-238`), which is much slower than reading one JSON file. So for a moment after launch the Projects page shows every folder ("0 projects") with no projects. A right-click on a folder in that state offers Pin to top or Unpin. (If `list()` rejected at startup, the page would presumably stay like that; inferred, not checked.)
- **The window is wider than the empty moment:** the menu's items, and so `run`'s `stale` list, are built when the menu opens (`openMenu` stores the items in state, `ProjectLibrary.tsx:143-144`). A menu opened during the empty moment and clicked after the projects have appeared still drops the pins (from reading the code).
- **Reproduced:**
  - Setup: hid the project keys from `storage.list()` for one load (harness init script) and seeded pins `[f:f-essays, p:Alpha]`.
  - Page in that state (`shots2/b1-risk-empty-listing.png`): 5 folders, 0 projects. The folder menu offers an enabled "Pin to top".
  - Pinning Fiction stored `[f:f-essays, f:f-fiction]`, so Alpha's pin was deleted.
  - After a normal reload with the full listing, Alpha shows no pin (`b1-risk` in `measure.json`, `b1-risk-after-reload.png`). This is silent, permanent loss in `library.json`.
- **Why the brief's other cases are safe (checked in code):**
  - Delete-pruning effect (`ProjectLibrary.tsx:232-240`): it only drops ids that were listed before and are now gone and not in `damagedFolders`. `setLibrary` and `setDamagedFolders` land in one batched update. Native `list()` puts any unreadable project into `damaged`. So a damaged project, the empty first listing, an import or create (the list only grows), search, and a slow library read (it waits for `ready`) cannot drop a pin there.
  - `setLibrary` has one caller (`refreshLibrary`). Its call sites (`App.tsx:791, 1194, 1630, 2370, 2415, 2423, 3398`) are startup, delete, back to Projects, close tab, discard journal and retry save. None changes the storage location, so the list shrinks only when `list()` returns fewer projects.
  - Setting a damaged folder aside does not drop a pin, because a damaged id was never in the listed set.
  - Left over (low): a project folder moved out of the projects folder by hand, then refreshed, loses its pin. That is arguably correct.
  - So `pinItem`'s stale drop is the one path found.
- **Repair:**
  - App passes ProjectLibrary a `listed` flag, set true after the first successful `refreshLibrary`. Until it is true, project pins never count as stale. Folder pins can (the library is loaded).
  - Compute `stale` inside `run` (at click time, from the current `projects`), not when the menu is built. The label can keep its build-time count.
  - A `projects.length > 0` test instead of the flag would also stop the loss. But with a library that is truly empty and holds old dead pins, it would bring back B1's ghost slot. Prefer the flag.
- **Test:** add an `ob-pins.spec.ts` case using the same `Object.keys` init-script trick. Pin a folder while the listing is hidden, reload normally, and expect the project pin to still be stored. Show it fails before the fix.

### S-new-1 (should-fix) -- Header focus ring is now the whole cell, flush against the label
- Because the buttons fill their cells, keyboard focus draws the ring around the whole cell: 90x40 for Edited, 338x40 for Name.
- The right-aligned label's ink ends 1 px inside the ring's inner edge (`s3-focus-light.png`, Edited).
- It is not clipped, and it is the app's standard ring. It reads a little large and cramped on the label side.
- The brief asked for a ring that is "not oversized", and this one is.
- Repair: draw the ring around the label only. One way: put the label text and arrow in an inner span and move the visible ring onto it with `.outline-sort:focus-visible { outline: none }` plus `.outline-sort:focus-visible > span { outline: <the shared ring> }`. Simpler: a negative `outline-offset` on `.outline-sort:focus-visible`. Neither is a spacing declaration. The coordinator may downgrade this.

### L-new-2 (low) -- Home in a cut-off sort menu hides the "Sort by" heading
- In the 500 px window, Home brings "Name" into view with `block: "nearest"`, but `scrollTop` stays 31, so the group heading above it stays hidden.
- Optional repair: when the first row is highlighted, scroll the menu to 0.

## Not checked
- The Mac app's WebKit (subgrid, `:has()`, the faux bold in the menus).
- The native listing timing that N1 depends on (inferred from the code, reproduced only in the preview).
- Native persistence of `library.json`.
- The full browser suite and `cargo test`.

## Throwaway files from this review
`reviews/ob-review2.config.ts`, `reviews/ob-review2.spec.ts`, `reviews/shots2/`. Not part of the suite.
