# Lane A notes (UI wave 7): docs that should change

Lane A did not edit docs/*.md. The owner or the docs lane should update these lines of docs/design-system.md:

1. Line 196 (Find in project field): remove the claim that the icon-only clear button shares a cell with the `⌘K` hint (`.search-end`) and that the hint hides while the clear button shows. The field now has no hint; the clear button is alone in `.search-end`. Cmd-K still focuses the field (App.tsx findInProject).
2. Line 216 (sidebar row labels): remove the sentence about the word count (`.entry-main small`), which no longer exists. The word count stays only in the bottom pane footer.
3. Scrollspy rail behaviour (wave 5 A3 / wave 6 T7b text in the "Wave 6" paragraph and the rail notes): add that hovering a sidebar row magnifies that row's rail line exactly as the pointer on the line does (useSpyDock; a row under the pointer counts as its own line; Reduce Motion writes nothing).
4. Stale comment in src/components/scrollspy.css header: still accurate (no CSS change for the row hover; it is JS-driven through `--spy-mag`).
