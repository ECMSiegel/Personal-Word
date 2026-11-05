# Review of T238 (CI failures from run 41769683535)

Reviewer: agent-5495 (Claude Opus). No source or test files were edited. Other lanes were editing the
same tree, so only what T238 changed is judged. Experiments ran in the review scratch folder
`node_modules/.cache/personal-word-beta/ui7-rv-ci` on port 1941, under the serial lock, with Node 22.23.3.
Status words: everything below is CLAIMED level at most. Chromium only; native WebKit was not run.

## Verdict: REJECT

`SelectionKeep` breaks table and image editing, and it does not fix split-view:155, the failure it was
written for. The explanations of split-view:155 and writing-aids:21 are contradicted by the evidence.

## Defects (must fix)

### D1. SelectionKeep destroys cell, image and select-all selections (regression)

On every editor blur it turns whatever the state holds into a `TextSelection`, because `next.eq(sel)` is
false for any other selection type. Same build with the handler disabled (`nokeep`) versus the tree:

| Action | Without SelectionKeep | With SelectionKeep |
|---|---|---|
| Drag across 2 table cells, press Font family | cell selection, 2 selected cells | text, 0 selected cells |
| ... then pick Georgia | both cells get Georgia | only the second cell |
| Drag across 2 rows, Table controls, Delete row | 3 rows become 1 | 3 rows become 2 (wrong result) |
| Select an image, press Font family | node selection, image stays selected | caret at 7, image deselected |
| Cmd+A in a document that starts with a table, press Bold | all selection | text 4..6, the first cell only |
| Cmd+A over paragraph, table, paragraph, then Georgia | all selection | text 1..52; result still correct |

Selection-only transactions do not touch undo, and a partial text selection kept its range and replaced
correctly when typed over (E6 passed in both builds), so the undo and typing worries did not show up.
No existing spec covers cell or image selection across a toolbar press, which is why the suite stayed green.

### D2. SelectionKeep does not fix split-view:155, and the "PROVEN" mechanism is not the CI path

- T238's fail-first test uses `document.execCommand("selectAll")` plus a scripted blur in one JS turn. The
  real test presses Cmd+A. Tiptap binds `Mod-a` to `selectAll`, which sets `AllSelection` synchronously in
  keydown: state read in that keydown's bubble phase is already `all`, `defaultPrevented` true. No
  `selectionchange` is involved, so a late blur cannot lose it. I confirmed T238's test does go fail to pass
  across the fix (E5), but it exercises a path the app does not take.
- Mechanism that matches CI: the state is still `AllSelection` from the first Cmd+A when the click puts a
  caret in the DOM. If the second Cmd+A arrives before the click's `selectionchange` task, it sets a
  selection equal to the current state, so ProseMirror does not rewrite the DOM. The queued
  `selectionchange` then reads the caret into state. DOM selection is collapsed, so SelectionKeep returns
  early. The apply hits stored marks: label says Georgia, no span.
- Reproduced with real input (click and Cmd+A sent while the page's main thread is busy for 400 ms):
  `<p>Left sample</p>`, no span, on both builds. **Tree 9 of 9 failed, nokeep 1 of 1 failed.** Same result in
  a one-turn scripted version (R1), which also shows `state: all` with `domCollapsed: true` right after
  the key.
- CI frames agree: highlight (from the first Cmd+A), then a visible caret at 1317546.7, then no highlight
  at all. T238 called the caret frame a "blur repaint", but a blurred editor shows no caret, and a retained
  non-collapsed selection would still paint. No frame shows a second select-all.
- Nothing in T238's "split-view x6 = 156 passed" tests the fix: the real path never failed locally before
  it either (my real-steps run on `nokeep` passed 6 of 6 at 20x CPU throttle).

Fix direction: remove SelectionKeep. Make the second select-all take effect when state is already all but
the DOM has moved on (for example, sync the DOM selection in before running `Mod-a`), and use the R2 steps
as the fail-first test. A test-only wait is the cheaper option but leaves the small real bug.

### D3. footnotes:48 and :134 are not shown to be fixed, and the note has no fail-first

T238's note gives "code-verified" only for this cluster. Restoring `setPendingFocus` (`prefix` build) and
the tree behave the same in my test: both pass plain and at 6x CPU (4 of 4), and both fail under the
harness T238 itself used for cluster 2 (150 ms rAF delay, 6x CPU), 4 of 4. In the tree failure the field
gets focus, then disappears 600 ms later with the same CI text, `element(s) not found`. Inferred cause:
`insertFootnote` calls Tiptap `focus()`, whose delayed `view.focus()` fires after the field's `autoFocus`,
which blurs and closes the field. Not traced to the line. T238's removal may still be right, but it is not
demonstrated to matter and the failure remains reachable.

### D4. writing-aids:21 explanation is refuted by the CI trace

T238 blames a window where `enabled()` still reads false. `focusModeRef.current` is assigned during render
and the refresh runs in an effect after that render, so that order cannot occur. The CI trace snapshot after
the click shows `<p class="focus-dim">` on the **first** paragraph and none on the second, so decorations
were computed with focus mode on and the head still in paragraph 2. PM state was stale; the test's poll
reads only the DOM selection although its comment says "the editor's own selection". The suggested Writer.tsx
hardening would not help, and SelectionKeep ignores collapsed selections. Inferred, not proven: the caret's
`selectionchange` from ArrowUp and Home landed after the click blurred the editor, the blur race T238 proved
but with a collapsed selection. This should be reported as open, not explained.

### D5. Validation claim could not be supported

The note says real specs ran "under 6x throttle". The saved `real.config.mjs` has no throttle, and no file
in `tests/` or the T238 configs applies one to real specs (only the private repro specs do). Treat those
counts as unthrottled unless T238 shows how it was applied.

### D6. motion:36 change removes a real check

After the wait for `getAnimations().length === 0`, `animatedProperties()` returns `[]` by construction, so the
final `toEqual([])` can never fail. Only the wait's timeout remains, which catches never-ending animations, but
a finite animation of a forbidden property that outlives the 300 ms window now passes where it used to fail.
Required tweak: assert everything still running is in `ALLOWED`, then drain. The diagnosis itself is sound.

## Lesser points

- `src/editor/selectionKeep.ts` comment and the note say WebKit clears the selection on blur so the handler
  is a no-op. No evidence given, and AGENTS.md asks for native WebKit checks on editor changes. Moot if removed.
- Removing `setPendingFocus` also removed the panel's `scrollIntoView` for the new note, so a long Notes list
  no longer reveals it. Nothing else relies on it: `citeHere`, `addNote` and the prop-driven path keep theirs.
  Keyboard flow is fine: Enter on "Insert footnote at cursor" lands in the field and typing works (F2, both builds).
- markdown-roundtrip x4 and assets:281 fix is not in the tree (`Writer.tsx` has no `view.focus()`), so pushing
  now would not fix these 5. T1 reproduces the lost keystrokes under the rAF harness (2 of 2).
- assets:281 is grouped with them by inference only: it uses `pressSequentially`, which focuses the editor
  first, and its CI symptom is an empty `th`, not "ol A". Recheck it after the Writer fix.

## What holds up

- floating:790: real and fixed. Prior `useState(!animateIn)` with the rAF harness: opacity "0", 3 of 3 failed.
  Tree: 3 of 3 passed.
- motion:36: diagnosis fits the CI data (`["clip-path"]`, an allowed property, still running); see D6 for the test.
- markdown-roundtrip cluster: mechanism fits ("ol A", "B", and the Table controls dialog open in the CI snapshot).
- floating:578 and :800: other lane's fix, not judged. The spec diffs there tighten the assertions.
- No retries or longer timeouts were added: `retries: 0`, and T238's only spec change is the motion drain (D6). footnotes, split-view, writing-aids, assets and markdown-roundtrip specs have no diff.

## Commands and results

- `npx tsc --noEmit -p .`: exit 0. `npm test`: 68 files, 1137 passed.
- Fresh build, specs footnotes, split-view, floating, writing-aids, motion, assets, markdown-roundtrip,
  tables-context, research, and every spec touching selection: 253 passed, 4 failed. The 4 are appearance:263,
  :353, :392 and split-view:866, all sidebar selection weight or colour (for example `font-weight` 400 or 700
  where 600 is expected). None touches T238's code; `src/styles.css` has uncommitted lane work. Owner to check.
- Review specs and logs (not committed): `node_modules/.cache/personal-word-beta/ui7-rv-ci/evidence/`
  (`rv.spec.ts`, `rv2.spec.ts`, `race.spec.ts`, logs `rv.log`, `rv2.log`, `rv3.log`). The specs ran from another
  folder, so point `RV_TESTDIR` at a folder with a `node_modules` link. Variant build config:
  `ui7-rv-ci/variant.config.mjs`. R2 in `rv2.spec.ts` is the fail-first test for D2.

## Not verified

The real footnotes:48 and :134 specs were not compared across builds under the rAF delay (that run was stopped
while waiting on the serial lock), so D3 rests on my F1 test, which has the same steps plus a 600 ms hold.
Native WebKit. Anything on the arm64 runner: no fix here has been seen on CI. R2 forces the interleaving with a
busy main thread, so it shows the mechanism and the frames match it, but CI's own timing cannot be replayed.
