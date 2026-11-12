# OF6 (T289): Font menu Recent section

What changed
- src/fonts/recent.ts (+ recent.test.ts, 11 tests): list logic for the Recent fonts, stored under `folio.recentFonts`. Newest first, at most 5, de-duplicated with `sameFont`, tolerant of bad stored data and blocked storage; `recentFontOptions` returns only fonts still in the menu (a removed added font is dropped).
- src/components/Dropdown.tsx: an option may carry `kind: "heading" | "separator"`. These rows render as `role="presentation"` (label) and `role="separator"`, are not `data-popover-item`, are skipped by arrows, Home/End, type-ahead, pointer hover and click. The highlight index handed to Popover is the rank among real items, so menus without such rows behave exactly as before. dropdown.css: `.dropdown-heading` (small muted uppercase label) and `.dropdown-separator` (1px `--line`).
- src/Writer.tsx (not registered; Font family case only plus one import line at line 97, outside that region): Recent rows + divider are put in front of the full list when there is at least one recent font; applying a font from the menu records it.
- tests/w9-font-menu.spec.ts: "one entry per font" now means once in the full list (below the divider). tests/of6-recent-fonts.spec.ts: new, 9 tests.

What a user sees
Pick a font: next time the menu opens with "RECENT", up to five recent fonts in their own faces, a grey line, then the whole list. Nothing until a font has been picked.

Limitations
- Choosing the font that is already current does nothing (Dropdown only reports changes), so it does not move to the top.
- The label is a `role="presentation"` row, not an ARIA group label.
- A font in Recent is also in the list, so it is highlighted/bold in both places (the first match is where the highlight starts).
- Fail-first: the browser spec was run before wiring (T289-fail-first.txt, all 9 failed; three of them are regression guards, they failed first only because of a spec bug: page-wide `separator` query hit another separator on the page, since fixed). The unit tests were written with the module and only a passing run exists.

Hand check
Open a document, pick Georgia, then Arial from the Font family menu, reopen the menu: RECENT shows Arial, Georgia, then a grey line, then all fonts. Arrow keys never stop on the label or the line.
