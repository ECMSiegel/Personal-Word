# T251 — Selected footnote marker then Insert image drops the note

Owner: opencode-watch · Found in `docs/agent-work/2026-11-04-ui-wave-7/REVIEW-r3.md` (line 92).

## Bug

Clicking a footnote marker gives ProseMirror a **NodeSelection**. Node
selections have no DOM caret, so the browser's own End key does nothing and
ProseMirror never reads a new selection back. If the user then chooses
Insert image, the image is inserted at the node selection and **replaces the
marker node**: `footnoteReference` disappears from the document and from every
export, while the note record stays in storage as an orphan.

## Fail-first evidence

`tests/t251-marker-image.spec.ts` (new, registered to this task). The spec
creates a project, types a sentence, inserts a footnote, types the note text,
closes research, clicks the `[data-footnote-id]` marker, closes the note
editor that the marker click opens, returns focus to the document editor
(ProseMirror restores its state selection — the node selection — on focus,
which is exactly the state the failing round-trip path had), presses End,
then inserts a 1×1 PNG and asserts the marker and the note survive.

- Run 1 (`fail-first.log`): fixture error in the spec itself (there is no
  "Back to document" button; the note is typed in the research panel) — spec
  fixed to fill "Footnote text" and click "Close research".
- Run 2 (`fail-first-r2.log`): `selectionKind` helper read `sel.type`, which
  only exists in `toJSON`; helper now reads `sel.jsonID`.
- Run 3 (`fail-first-r3.log`): bug shape seen — but focus was still in the
  note textarea (clicking a marker opens the note editor, by design), so the
  End key did not reach ProseMirror. The fixture was reworked to close the
  note editor and refocus the document editor before pressing End, and an
  in-page probe (`debug.log`, throwaway spec since removed) confirmed the
  handler moved the selection when invoked directly.
- Run 4 (`fail-first-final.log`): **fail-first on the final fixture, fix
  temporarily unregistered from `documentExtensions()`** — the editor is
  focused, the node selection is present, and after End the selection is
  still `"node"` (expected `"text"`).

## Fix

`src/editor/extensions.ts`: new extension `NodeSelectionCaretKeys`
(priority 1000, registered in `documentExtensions()` next to
`SelectAllSync`). It binds only End and Home, and only acts when the
selection is a `NodeSelection` whose node sits inside a text block:

- End → `TextSelection.near(doc.resolve($to.end($to.depth)), -1)`,
- Home → `TextSelection.near(doc.resolve($from.start($from.depth)), 1)`,

both with `scrollIntoView()`. Everything else returns `false`, so the
browser's visual-line End/Home behavior for text carets is untouched and
block-node selections (images, tables) keep their current behavior. Insert
image itself is not modified.

## Checks

- `npx tsc -b` → EXIT=0 (`tsc.log`; re-run in the regression pass, EXIT=0).
- Acceptance: `tests/t251-marker-image.spec.ts` 1/1 with the fix re-enabled
  (`acceptance-r2.log`).
- Regression under the serial lock, dev server on port 1439
  (`regression.log`): `tests/footnotes.spec.ts` 6/6;
  `tests/markdown-roundtrip.spec.ts` 9/9 of the dev-runnable tests; the 4
  tests that dynamically import the production `dist/assets/markdownBundle-*.js`
  chunk cannot run on a dev server (vite serves index.html for `/assets/...`,
  so the fetch and the dynamic import both fail) — rerun in preview mode
  against the existing build, `PLAYWRIGHT_PREVIEW=1`
  (`regression-preview.log`): 4/4. They do not touch this change (the
  markdownBundle chunk is separate from the writer extensions).
- No native runs (coordinator msg #1265: native checks deferred to T278).
