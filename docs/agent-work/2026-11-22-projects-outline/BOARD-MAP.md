# Projects outline rebuild -- plan task to board ID

| Plan | Board | Model | Depends on | Title |
|---|---|---|---|---|
| OB1 | T335 | Sonnet | - | Build the outline model (pure) |
| OB2 | T336 | Opus | T335 | Draw the outline, header row, folder totals, remove cards |
| OB3 | T337 | Sonnet | T335 | Build the sort menu and column chooser (components only) |
| OB4 | T338 | Sonnet | T336, T337 | Wire the sort menu and column chooser into the page |
| OB5 | T339 | Opus | T338 | Rebuild dragging and Move up/down (after OB4: both edit ProjectLibrary.tsx) |
| OB6 | T340 | Sonnet | T339 | Pins -- HELD until the owner answers plan question 1 |
| OB7 | T341 | Sonnet | T340 | Sweep the old specs and update the docs |
| OB8 | T342 | Opus | T341 | Eyes-on review with screenshots |
| OB9 | T343 | Sonnet | T342 | Final validation and rebuild |

Parallel points: OB2 (Opus) and OB3 (Sonnet) run together after OB1. Everything else is a chain because the tasks share ProjectLibrary.tsx.
Not started: the owner has not asked for workers to be deployed. Open questions 1-5 in PLAN.md wait on him.
