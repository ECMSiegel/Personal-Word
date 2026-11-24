# OB7a -- docs early (T345)

Sentences changed (Projects page only; sidebar card and list/cards sentences untouched).

AGENTS.md
- Naming line: unchanged (folders and subfolders still exist).
- Icon rule (Flat, restrained surfaces line): "The only folder icons are..." widened so project rows may carry a small muted document icon (owner approved 2026-11-22).
- library.json line: replaced "In each folder, subfolders come first, then projects, and a folder's contents are indented one slot under its heading. Custom is a sort and any hand reorder switches to it." with the outline rules (one row list, header row, no card view or toggle, Folders on top or Mixed, folder totals, Custom and hand reorder under any sort, pins up to three in a top band, items: order key, f:/p: keys, old keys still read, pins, version 1). Kept: never inside a project; deleting a folder never deletes a project; unreadable or unknown-version file never written over.

docs/design-system.md
- Layout primitives table, `.indent` row: now says the folder body was replaced on the Projects page by a per-row depth step.
- No decorative quills sentence: widened the folder-icon exception to project rows' document icon.
- Projects page paragraph (T274): rewritten for the outline (header row, sort menu, no card view or toggle, shared row height, document icon, folder totals, pinned band, saved keys).
- Not changed: "Label-only rows" paragraph (line about project row with its dates); still true for the trash and date area.
- Not changed: "Card view (T257)" paragraph; it is about sidebar cards.

docs/architecture.md
- Projects-page folders paragraph: "Each folder holds subfolders first, then projects" replaced with the shared items: order key, f:/p: keys, old keys still read, pins, version 1, and src/library/outline.ts (buildOutline) as the source of rows.
- Other paragraph: libraryPreferences.ts description now lists folder placement and visible columns instead of view.
