# Second review of T238 (CI failures from run 41769683535)

Reviewer: agent-ffc6 (Claude Opus). No source or test files were edited. Other lanes were editing the tree, so
I built from one snapshot of it and judged only T238's changes. Scratch: `node_modules/.cache/personal-word-beta/ui7-rv-ci2`
(port 1941, serial lock, Node 22.23.3); specs, scripts and logs in `ui7-rv-ci2/evidence/` and beside it.
Status words: CLAIMED at most. Chromium only. Native WebKit was not run, and nothing here has been seen on CI.

Variant builds of the same snapshot: `tree`; `noflush` (SelectAllSync's flush removed); `nofocus` (Writer's
`view.focus()` removed); `pub` (flush swapped for a public-API call); `noheur` (one ProseMirror heuristic disabled);
`head` (clean export of dda7208).

## Verdict: APPROVE, with open items below

The fixes are correct and I found no regression. A push is still not expected to turn CI green: writing-aids:21 is
still in the suite, and footnotes:48/:134 have no fix.

## The checks asked for

**D1 SelectionKeep gone.** File deleted; no reference left in `src` or `tests`. Cell, node and all selections now
survive (A1 below).

**SelectAllSync (`domObserver.flush()` on Mod-a keydown).** Correct.
- It is the same function ProseMirror's own `selectionchange` handler calls (`onSelectionChange` -> `flush`), so it
  does early what the queued task would do later. Then `selectAll` overwrites whatever was read.
- A1, real input, tree: text, all, dragged 2-cell, and node selections each become `all` on Cmd+A, DOM not collapsed.
  Typing replaces everything and undo restores it. Same on `noflush`.
- Undo (A2): after the race, type X gives "X", undo gives "one two", redo gives "X". On `noflush` the race leaves a
  caret and X is appended ("one twoX"), which is the bug. A selection-only transaction adds no undo step.
- Composition (A4, CDP IME): ProseMirror's keydown returns at `inOrNearComposition` before `handleKeyDown`, so the
  handler does not run during IME. During composition Cmd+A has the same result on both builds, and after commit
  Cmd+A works and the text is kept.
- Unfocused (A5): real Cmd+A with focus on the body never reaches the handler. A synthetic key on the blurred view
  does not throw: `flush` requires `hasFocusAndSelection` before reading a selection. Same as `noflush`.
- Control+A on Mac (A6) also enters the handler. Harmless: same result as `noflush`.
- Can it throw? `flush` guards `docView` and a null selection, and no page errors appeared in any run. Only a
  ProseMirror upgrade that renames the internal could: the keydown handler would throw before `captureKeyDown`. The cast
  hides that from tsc, the note says so, and the new spec would catch it.
- Public-API alternative exists: `if (view.state.selection instanceof AllSelection) view.focus();` in the same place.
  `view.focus()` is public and writes state to the DOM. `pub`: new test 8 of 8 pass, A1 and A2 pass. Optional, not
  required; I ran less on it than on the flush version.
- Native WebKit: not run. By source the only Safari branch in that path is `badSafariComposition`, which needs a
  composition. Tiptap also focuses synchronously on Safari, which affects the table item below. This is reading, not a test.

**New test in split-view.spec.ts.** Real. `noflush` failed 8 of 8 at the `getSelection().toString()` line (received "");
`tree` passed 8 of 8. The busy-thread trick works: the A2 log on `noflush` shows the caret state it predicts. It cannot
give a false failure from ordering on a fixed build, because Cmd+A is the last input. Not known whether it also fails
without the fix on the arm64 runner.

**Writer.tsx `editor.view.focus()`.** Correct, no steal or scroll change found. `chain().focus()` already schedules the
same `view.focus()` for the next frame, so this only makes it earlier; it targets nothing new. W1 (caret off screen,
scrolled away): `tree` and `nofocus` end at identical scrollTop and table position. W2 (from the More menu at 900 px):
same focus and same result on both. T1 (rAF 150 ms, CPU 6x, click then type): `nofocus` 3 of 3 failed, `tree` 3 of 3
passed. That harness is a simulation, so the CI markdown-roundtrip and assets:281 failures are still only inferred to
be this cause.

**D3 footnotes:48/:134.** `setPendingFocus` restored; `ResearchPanel.tsx` has no diff against HEAD. No fix, cause
unproven, and the note says so. They passed plain here. Not investigated further.

**D6 motion.spec.** The new assertion can fail. With a finite `width` animation started just after the sample window
closes (doctored copy, M1), the samples see only `clip-path` and the new line fails with `["width","width"]`. Without
the doctoring it passes.

**No test weakened.** T238's spec changes are the added motion lines and the added split-view test. footnotes,
writing-aids, markdown-roundtrip and assets specs have no diff. Other removed or changed lines in floating and
split-view belong to the sidebar lane, and I did not judge them.

## writing-aids:21: cause found (T238 had it open)

**It is a test-speed problem, and unlikely for a user at human speed (not tried by hand).** The cause is a heuristic in
ProseMirror itself, and it is already at HEAD.

`prosemirror-view` `flush()` (dist/index.js:4879): if the DOM caret lands exactly on the document's start within 200 ms
of the editor gaining focus, with no click in the last 300 ms, ProseMirror assumes the browser reset the selection after
focus and writes the state's selection back. The test goes from focus to Home in under 200 ms because it types at
machine speed.

Evidence:
- Failing trace, unthrottled: ArrowUp keydown at 1031.7 ms, Home at 1046.1, `selectionchange` to "First paragr" offset 0
  at 1049.6, `selectionchange` back to "Second parag" offset 16 at 1050.2, with **no transaction in between**. So the
  keys did move the caret, and it was then put back. State stayed 34.
- Fail-first on the cause: real spec x30 `tree` 4 failed; `noheur` (only that condition disabled) 0 failed.
- Same steps plus a 250 ms wait before ArrowUp: 0 of 30 failed; without the wait 6 of 30.
- Why rates differ: slower means safe. At CPU 4x the same steps never failed (0 of 20 plain, 0 of 20 logged, 0 of 48
  with a tighter trace), because the test then takes over 200 ms. Unthrottled: real spec 1 of 12 on `head`, 1 of 12 and
  4 of 30 and 10 of 30 on `tree` across runs; T238 logged 14 of 20 and 5 of 10. It varies with load, and none of it comes from
  T238's changes.

User impact: needs the caret moved to the very start of the document within 200 ms of keyboard or programmatic focus,
without clicking. ArrowUp then Home after real typing would not hit it unless the editor had gained focus in the last
200 ms. If it did happen the caret stays put and a second press works. I did not try to reproduce it by hand.

Inferred, not replayed: the CI symptom (poll passes, then `focus-dim` on the first paragraph) is the same cause. The
poll reads the DOM between Home and the `selectionchange` task, sees paragraph 0 and passes; the heuristic then restores
state's caret in paragraph 2, so focus mode dims paragraph 1. This fits the CI snapshot.

Suggested follow-up for the owner (not done, tests are not mine to edit): make the test wait past the 200 ms window after
focusing, with a comment naming the heuristic. This does not weaken what it checks. Tested only in my copy without the
focus-mode click.

## Do the notes state only what was shown?

Mostly. The counts I checked against T238's logs match: fail-first 4 of 5 and 5 of 5, T1 3 and 3, x20 14 of 20, base 5 of
10, specs 110 and 2. Corrections for the owner, none blocking:
- REWORK says "so the keys did not move the caret at all". This was inference, and the trace shows it is wrong.
- REWORK says it "points at a key or selection sync problem in the tree". It is in the ProseMirror dependency, and
  also fails on `head` 1 of 12.
- The top "Status" paragraph still reads "All 13 diagnosed" and cluster 3 and 6 still sit there. REWORK says it
  supersedes them and withdraws them by name, so this is untidy rather than false. A reader who stops at the top is misled.

## Open items (labelled, not blocking)

1. writing-aids:21 stays intermittent on CI until the test changes. Cause above.
2. footnotes:48/:134 cause unproven, no fix. May fail again on CI.
3. markdown-roundtrip x4 and assets:281: fixed under a simulated slow frame only. CI not seen.
4. `domObserver.flush` is an internal. Public alternative above if wanted.
5. Native WebKit unverified for both editor changes, which AGENTS.md asks for. Native builds are V's job.

## Commands and results

- `npx tsc --noEmit -p .`: exit 0. `npx vitest run`: 68 files, 1137 passed.
- Real specs on `tree` (snapshot): motion, footnotes, markdown-roundtrip, assets 31 passed; floating, split-view 66 passed.
- writing-aids:21 and variants: as above. My A3 (typing and Cmd+A queued together) was a bad test: keys interleaved, and
  both builds gave the same result, so it shows nothing. Queued mutations rest on source reading only.

## Not verified

Native WebKit. Anything on GitHub's arm64 runner. The CI symptom replay for writing-aids:21. A manual human-speed check of
the heuristic. Full `npm run test:e2e` (I ran the specs T238 touches, not every spec).
