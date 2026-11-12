# Review 5 -- T301 (HS10 round 2) and T302 (HS11)

Reviewer: agent-73e0 (Opus final reviewer), 2026-11-12. Read-only review; no source edited.

## Verdicts
| Task | Verdict |
|---|---|
| T301 HS10 round 2 (partial document settings) | APPROVE. No blockers; four low notes. |
| T302 HS11 (four e2e failures) | APPROVE. No blockers; three low findings. |

## T301 -- partial `documentSettings`

### Every reader, checked by my own grep (not the worker's list)
All of these resolve through a helper or a per-key fallback that matches the old behaviour.

- **Writer.tsx**
  - `:339-346` reads font, size, line and margin through `editorSettings`; `:1130` reads the indent the same way.
  - `:675` (`settingsRef?.firstLineIndent ? 0.5 : 0`) and `:1341` (`?.font === "mono"`) work per key, and a missing key is treated as false.
  - `:879`, `:949` and `:1093` are only effect dependencies or are passed through untouched (useFootnoteLayout types it as `unknown`).
  - `:1919` and `:1929` read through `exportSettings`. `:1935` falls back to `?? "bottom-right"`.
- **App.tsx**
  - `:964` and BibliographyPage use `Pick`, with `?? "author"` and `?? "cited"`. `:2809` checks `bibliography !== false`, so the default is on.
  - `:1433` writes from a template. Every built-in template (`templates.ts`) stores a full object, and so does every custom one (`:1742` uses `exportSettings`).
  - `:1928` (page numbers and Position), `:1935-1943` (margin, compared against `editorSettings`) and `:2657` (Bibliography) merge onto the stored partial only.
  - `:2620-2634` (Export panel) uses `changedSettings` against the current effective export settings.
- **Export**
  - `export/document.ts:91` and `ExportPanel.tsx:33` merge onto `defaultDocumentSettings`, which is the same as `exportSettings`.
  - pdf.ts and docx.ts take `d.settings` from document.ts. pdf.ts `:597` and docx.ts `:253-256` default the position to `?? "bottom-right"`.
  - `textExport.ts:185/270` checks `bibliography === false`.
- **Not readers:** printProbe builds a full literal. `validateProject` does not inspect the field, and neither does Rust (generic flattened map). The archive and snapshots copy the project as it is.
- **Earlier finding fixed:** the REVIEW-4 rejection reason is gone. `unsavedDocumentSettings` has been removed, and `editorFallbackSettings` is the single source.

### Probes (throwaway `src/review5-tmp.test.ts`, deleted)
- `editorSettings` and `exportSettings` over `undefined`, `{}`, `{pageNumbers:false}`, `{marginInches:1.25}` and `{pageNumberPosition:"top-left"}`: no key is undefined and no number is NaN.
- Projects with no settings and with `{}`: the Word output (all `word/*.xml`), the PDF output (page sizes and decoded content streams), Markdown and plain text are identical to the export of a project with full `defaultDocumentSettings`.
- Each of these partial objects exports identically to the same keys merged onto the full defaults: `{pageNumbers:false}`, `{marginInches:1.25}`, `{pageNumberPosition:"top-left"}`, `{bibliography:false}`.
- A partial object survives `validateProject` after a JSON round-trip, and survives `createProjectArchive` followed by `readProjectArchive`.
- `newProject()` stores no `documentSettings`, so the "no settings" case is real (imports, older projects), not only a test setup.

### The `changedSettings` trap
- **The worker's description is inaccurate.** It does not store "keys that differ from the export defaults". It stores the keys that differ from the project's *current effective* export value, which in practice is the one key just edited.
- **A choice equal to the default is never discarded.** Setting a value back to the export default stores it explicitly, and the editor follows. Removing the key instead would be wrong, because the editor would then fall back to its own, different value.
- **Choosing the value already shown does nothing.** `Dropdown.choose` (`components/Dropdown.tsx:92`) skips `onChange` when the value is unchanged. So on a no-settings project, choosing "Times New Roman" while it is already shown changes nothing. It did nothing before this batch either.
- **Before and after:**
  - Before the batch, any change in the Export panel copied the whole export look into the editor.
  - Now, only the edited key follows.
  - This is coherent and matches the owner's intent (one setting changes one thing).
- **Type change:** sound. `tsc -b` is clean with `Project.documentSettings` typed `Partial`. The only casts are harmless:
  - `changedSettings` casts `Record` to `Partial`.
  - `Object.keys` is cast to `keyof`.
  - `document.test.ts:77` has an older cast that predates this batch.
- **Existing export unit tests:** untouched (modification times are all before round 2) and green.

### Low notes (no rework required)
1. **low -- the editor and the Export panel still disagree on a project with no settings.** `ExportPanel.tsx:33` shows Times New Roman 12, double spacing and indent, while the editor shows sans 14 and 1.5. Keys stay stored, so the result depends on history. Example: untick then retick "Half-inch paragraph indent". The panel looks the same as before, but `{firstLineIndent:true}` is now stored and the editor gains an indent. The disagreement itself predates this batch. If the owner wants one look, it needs an owner decision, not a worker fix.
2. **low -- inaccurate description.** `notes/HS10.md` and the board note describe `changedSettings` wrongly (see above); the code is right.
3. **low -- "Save as template" from a project with partial settings.** It takes the export defaults for any key not set (`App.tsx:1742`). A project created from that template therefore opens with a serif 12 editor. This matches the export, and the worker lists it as a limit.
4. **low -- browser test coverage.** `tests/hs10-repairs.spec.ts` covers only the Page setup page-number toggle. The margin, Position, Export panel and Bibliography paths are verified by reading the code and by unit probes, not in a browser.
- **Hardening idea (not a defect):** the helpers spread `stored`, so a key explicitly set to `undefined` in memory would override the fallback. My probe shows `editorSettings({fontSize: undefined}).fontSize` is `undefined`. No current code path writes such a key, and JSON drops it.

## T302 -- HS11

1. **Focus fix (`Writer.tsx:1336`, `:1355`, `:1400`) is correct.**
   - **Mouse:** `Dropdown.choose` closes the menu, focuses the button, then calls `onChange`. `view.focus()` moves focus to the editor straight away, and ProseMirror restores the selection from its state. Tiptap's later focus (one animation frame on) is a harmless no-op.
   - **Keyboard:** Enter and Space are handled with `preventDefault` and `stopPropagation` in `handleMenuKey` (`Dropdown.tsx:107-111`, `:124`, `:146-151`). So the key that picks an option is not also typed into the newly focused editor.
   - **Split pane:** `editor` is the Writer's own instance. The shared toolbar renders only for `side === focusedPane` (`App.tsx:1994`), so the toolbar always drives the focused pane's editor.
2. **hs1 spec.** It now waits for the menu's animations to finish (`getAnimations` then `finished`), and the z-index story fits the CSS:
   - The format bar is `z-index: 40` (`editor.css:104/242`); the export menu is 41 (`export-menu.css:29`).
   - I did not re-run the worker's injection of `z-index: 40` (which they say fails 8 of 8 times). That claim is unverified by me.
3. **hs7 spec.** It goes through Settings, then Interface font, then "Gill Sans". It runs against the built app.
4. **Popover baseline.**
   - **Page setup:** x, y and width match the values OF3 recorded (1079.5625, 115.5, 265.4375); only the height changed (136 to 228).
   - **Prose check:** height 146 to 141; 146 was recorded by T282.
   - **Fits:** at the spec's 1440x900 window, Page setup spans y 115.5 to 343.5 and x up to 1345, so it is inside the window. The spec has no window-bounds check for toolbar popovers. The Dropdown 320 px cap test does not apply to Page setup.
   - **Other four entries:** there is no git and no older copy of them, so "nothing else changed" rests on the worker's measurement.
   - **Files changed since REVIEW-4** (`find -newer`): only the expected src files and specs, plus the fixture.

### Findings
1. **low -- `tests/hs7-document-font.spec.ts:27-37` overstates what it proves.**
   - Settings replaces the manuscript view (`App.tsx:2571`), so Writer unmounts and mounts again on the way back. The test therefore proves the font is read when the editor mounts, not that it updates live.
   - Live updating does exist in the code: `useInterfaceFont` uses `useSyncExternalStore` (`fonts/registry.ts:38`).
   - Fix, if wanted: rename the test or comment that it checks the font on remount.
2. **low -- a sibling has the same one-frame focus gap: the toolbar icon buttons.**
   - Affected: Bold, Italic, Underline, Strike, lists, quote (`Writer.tsx:1173-1211`), Undo and Redo (`:1268/1280`), Remove link (`:1469`) and the table row/column buttons (`:1608-1651`).
   - They call `chain().focus()` with no `view.focus()`, and there is no `preventDefault` on mousedown (`popoverItem` at `:1217` only sets a data attribute).
   - In Chromium, a key typed within one frame of the click lands on the button. In WebKit, buttons usually do not take focus on click, so the owner is less likely to hit it.
   - Fix: add the same `editor.view.focus()` inside the shared `iconButton` run (`:1240-1252`).
3. **low -- a sibling with a larger gap: the font size buttons.**
   - "Decrease font size" and "Increase font size" (`Writer.tsx:1406-1440`, `setSize` at `:1162`) never focus the editor at all, so typing after clicking +/- is lost until the owner clicks back into the text.
   - Line spacing presets and the Paper, Margins, Zoom and Position dropdowns keep focus on purpose (their popover stays open, or they are not editing controls). There is no colour control.
   - Fix, if the owner wants it: call `editor.view.focus()` after `setSize` from the +/- buttons only, not from the NumberInput.

## What I ran
- `npx vitest run src/export src/research src/editor src/model.test.ts src/projectArchive.test.ts` plus the probe:
  - 634 passed.
  - 1 failure: the probe's full-export case hit the 5 s timeout under parallel load.
  - Rerun alone with a 60 s timeout, and stronger (it also compares PDF content streams), it passed. The probe was then deleted.
- `npx tsc -b`: clean.
- No Playwright run. Everything was settled by reading the code. The coordinator's full e2e run covers the specs passing.

## Unverified
- The hs1 spec's teeth (the injected `z-index: 40` still fails).
- Real WebKit (Tauri) focus timing.
- The other four popover baseline entries (no git).
- The margin, Position and Export panel paths in a real browser.
- Native persistence of a partial object: cargo not run. The Rust code treats it as a generic map.
