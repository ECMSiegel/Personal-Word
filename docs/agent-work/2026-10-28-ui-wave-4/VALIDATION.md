# UI wave 4 -- validation record

Final tree: all wave-4 tasks (T171-T193, T187) plus the Fable repairs and the sidebar-bottom alignment. Status: CLAIMED (nothing is owner-verified until the hand-check sheet below is filled in). Logs: `node_modules/.cache/personal-word-beta/ui4-v/`.

| Step | Result | Log |
|---|---|---|
| `tsc --noEmit` | exit 0 | `full2.log` |
| Unit (vitest, 1 worker) | 1070 passed | `unit.log` |
| `npm run build` | exit 0 | `npmbuild.log` |
| Playwright, whole `tests/`, production preview, 1 worker | 330 / 331; the one red is `writing-aids.spec.ts:21` focus-mode dimming, a known flake (1 in 8 on rerun; also flaky before wave 4) | `pw-full.log`, `pw-focus.log` |
| cargo test (locked, offline) | 63 passed, 1 ignored | `cargo.log` |
| Native gate, pages-zoom (WebKit, unlocked screen, 2026-10-29 12:04) | zero flags True: grey gaps and page starts correct at 50/75/100/125/150 | `gate-zoom3.log` |
| Native gate, pages-probe | zero flags True; all six caret flags true | `gate-probe3.log` |
| native-smoke.py | 3 phases pass | `native-smoke3.log` |
| native-screens.py plain + color | pass; 12 PNGs each, viewed (stacked pages, clean gaps, sidebar header/entry/spy line, footer and Settings on one continuous band) | `screens3/`, `screens3-color/` |
| Release app | `src-tauri/target/release/bundle/macos/Personal Word.app`, folio sha256 6a6a4f1203372e4c6e1306ad9cf5dc94d8035864424440cda190322106a57d4a, identifier com.folio.writing | `tauri-release.log` |
| Fable review | SHIP WITH FIXES, repaired, re-check verdict SHIP | `FABLE-REVIEW.md` |

An earlier native run at 04:21 timed out because the screen locked at 03:54 (CGSSessionScreenIsLocked); it was rerun on an unlocked screen with the same smoke binary (built from the final tree at 04:20).

## Owner hand-check sheet (write the result after each item)

a. Page view at 50, 75, 125 and 150 percent zoom: the grey gaps sit between pages; nothing from page 2 sits on page 1 (your `1.png`). Result: ____
b. In a narrow window or split pane, the caret never appears inside a grey gap (your `3.png`). Backspace at the start of a paragraph after a page break removes the break; Cmd+Z brings it back. Result: ____
c. Hover any text button or link in the app (Delete note, Snapshot, Append to section, tabs, menu rows, settings): it looks bold and grows slightly, nothing next to it moves, danger stays red; Tab to it shows the same. Links inside your writing do not change. Does the faux bold look right in Futura? Result: ____
d. Snapshot has no box around it. Result: ____
e. Toolbar icons magnify as you move across them (peak about 1.5x); Tab gives the same; Reduce Motion turns it off. Result: ____
f. Split view: no "Give these words a home" in either pane; the divider meets the header line cleanly; each pane has its own page number (left) and word count (right); goals show once on the left. Result: ____
g. Sidebar: the section you are in has a bold, coloured header (blue in Plain); the open entry is bold; split panes count too. On Settings/Comments/Bibliography/Read nothing in the sections is lit -- OK? Result: ____
h. Scrollspy lines beside manuscript sections: the open section's line is long and blue; in Read mode the line follows the section you are reading and clicking a line scrolls there. Result: ____
i. Focus mode (Cmd+Shift+F): toolbar hides; moving the pointer to the top, Tab, or Cmd+Option+T brings it back; text never jumps or hides under it; in split view the toolbar stays. Result: ____
j. The Settings row at the bottom of the sidebar lines up with the footer as one band. Result: ____
k. Snapshot dialog: Escape always closes it. Result: ____
l. Anything that looks wrong: ____
