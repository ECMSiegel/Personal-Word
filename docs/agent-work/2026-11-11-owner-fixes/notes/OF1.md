# OF1 (T284): text-only notes move to Notes, and can be deleted

## What changed
- `src/research/ResearchPanel.tsx`: the whole "Text-only notes" block (heading, Insert footnote at cursor, the rows with Used-in / Go to / Preview) moved from the Sources tab to the Notes tab, under the loose notes. Each row now has a "Delete footnote" button (red, same `is-danger` style as "Delete note", a normal button so Tab/Enter/Space work). "No notes yet." only shows when there are neither loose notes nor text-only notes.
- `src/research/removeFootnote.ts` (+ test): pure functions that remove a footnote marker from document JSON and delete a text-only footnote (record + markers in every section/fragment). A source-linked footnote is never removed (returns null); a record with no marker is removed alone.
- `src/App.tsx` (small regions, not registered): `deleteTextOnlyFootnote` opens the app's existing confirmation dialog (same one as Delete section), then on confirm: flush saves, take a safety snapshot "Before deleting a footnote", delete the marker through the live editor if that section is open in either pane (so the editor's next save cannot bring it back), then one project mutation removes the record and the marker from every other entry.
- Specs: new `tests/of1-text-notes.spec.ts`; existing specs that clicked "Insert footnote at cursor" on the Sources tab now click the Notes tab first (accessibility, features, footnotes, t251-marker-image, research, w9-used-in); research.spec rule-geometry check now measures against the Bibliography block instead of the removed subhead.

## What the user sees
Research panel > Notes: "Text-only notes" with each footnote and a red "Delete footnote". Pressing it opens "Delete this text-only footnote?" saying which section it is in; Cancel or Escape changes nothing. Delete footnote: the row goes, the marker leaves the text, the remaining footnotes renumber, and a snapshot appears in Snapshots & history.

## Undo
The reliable undo is the snapshot: Snapshots & history > "Before deleting a footnote" > Restore this version (brings back the marker and the note text; the restore itself keeps a safety snapshot). Editor Cmd+Z in an open section reverses only the marker removal and was not tested; do not rely on it to bring the note text back.

## Limitations
- Deleting a note that is cited in two places (same id twice) removes every marker.
- Browser (Chromium) tests only; not checked in the native app.

## Hand check
1. Make a project with sections One and Two. In Two type text, open Research > Notes, Insert footnote at cursor twice, write "A" and "B".
2. Open section One. In Research > Notes press Delete footnote on A: a dialog names "Two". Press Cancel: nothing changes. Press Escape the same way.
3. Delete footnote > confirm: A's row goes. Open Two: one marker, numbered 1, text B. Snapshots & history lists "Before deleting a footnote". Reload: still gone.
4. Repeat with Two open in the editor: marker disappears at once; keep typing; reload; it stays gone.

## Evidence
Fail-first: OF1-fail-first.txt (move), OF1-delete-fail-first.txt (delete tests fail with the button off), OF1-unit-fail-first.txt (doctored impl). Passing: OF1-acceptance.txt (first run, 5 failures from specs pinning the old place, fixed), OF1-acceptance2.txt, OF1-acceptance3.txt; vitest 1277 passed; tsc -b clean.

## Rework
Reviewer found `footnotes.map(renderFootnote)` passed the array index as extraActions (stray 0, 1 beside Unlink source). Fixed to `footnotes.map((note) => renderFootnote(note))`; no other map(render...) call of a changed function. New assertion in of1 spec (cited footnote action row text is exactly 'Unlink source'): failed first (OF1-rework-fail-first.txt), passes after (OF1-rework-pass.txt, of1 + w9-used-in 8/8). tsc -b clean, vitest src/research pass.
