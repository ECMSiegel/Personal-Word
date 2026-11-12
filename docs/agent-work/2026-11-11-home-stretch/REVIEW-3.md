# Review 3 -- HS6 (T297) and HS7 (T298)

Reviewer: agent-9ee7 (Opus reviewer batch 3), 2026-11-12. Read-only review; no source edited.

## Verdicts
- **T297 / HS6 floating sidebar in Read: APPROVE.**
- **T298 / HS7 "sans" document font follows the interface font: APPROVE**, with one open item that the
  coordinator must apply (export label, below).

## HS6 findings
The change is two lines in `src/components/floating.ts:117-120`: when there is no `.format-bar` (Read), the
sidebar's top is the top of `.manuscript-read` instead of the first `.read-prose` block. Editor mode is
unchanged: the bar still wins when it exists, and focus mode still overrides it (`:124`).

Probe results (1600x900, 6 sections, a 6-column table and a 300-character code block at the start):

| State | Floating | Sidebar top / bottom | Leftmost reader content (x) vs sidebar right |
|---|---|---|---|
| Read, top | yes | 74 / 868 (reader top 74, footer 868) | 445 (`.reader-options`) vs 270 |
| Read, scrolled to the middle | yes | 74 / 868 | 445 vs 270 |
| Reader size 40, spacing 3 | yes | 74 / 868 | 445 vs 270 |
| Resized to 1040 | no (normal panel) | | |
| Back to 1600 | yes | 74 / 868 | 445 vs 270 |
| Read, then editor | yes | top 114 = format-bar bottom | |
| Dark, scrolled to the middle | yes | 74 / 868 | 445 vs 270 |

- The table, the code block, the options row, the eyebrow, the title and the export button all share the
  same 710 px padded column (`styles.css` `.manuscript-read` padding; tables `width:100%`, images
  `max-width:100%`). Judging the fit by the first `.read-prose` is therefore sound, and nothing wider
  overlaps the sidebar.
- Split view returns `null` (`floating.ts:108`), which gives the normal panel. This is unchanged.
- Screenshots I looked at: `notes/review3-hs6-read-top-light.png`, `review3-hs6-read-mid-light.png`,
  `review3-hs6-read-mid-dark.png`. In all three the title sits at the top, the Manuscript heading and every
  row are visible, nothing is clipped, and the text is clear of the sidebar.
- The "dash" is the scroll-spy rail: a compact, vertically centred stack (`scrollspy.css` header, the
  owner's Variant B). It sits in the gutter beside the visible rows. The docked Read view draws it the same
  way (`notes/review2-hs9-read-spy.png`), so it is not an HS6 artefact.

Findings:
1. low -- `tests/floating.spec.ts:443-445` checks overlap only for `.read-prose` boxes, not for the
   options row or the title. My probe covered those, and the CSS guarantees the same column. Optional fix:
   measure every descendant of `.manuscript-read`.
2. low -- The new Read top no longer depends on scroll position, so the missing scroll listener (task
   hypothesis) no longer matters. Nothing to do.

## HS7 findings
`src/editor/documentFont.ts` is a pure stack builder: serif and mono return byte-identical strings to the
old `Writer.tsx` ternary (checked in the git diff). `Writer.tsx:338-339` uses `useInterfaceFont()`, so the
font updates live through `useSyncExternalStore`. The CSS fallbacks are `editor.css:539,704,744`,
`styles.css:2002-2006` and `fragments.css:99`. The `.brand` rule stays Futura (`styles.css:1527`).

Probe results:

| Check | Result |
|---|---|
| Verdana interface font, Blank editor | `Verdana, sans-serif`; toolbar box shows "Verdana" |
| Same project, Read view | `Verdana, sans-serif` |
| Interface font changed to Gill Sans while Read is open | Read updates live |
| Custom name with spaces and quotes (`"My Odd Font 3", sans-serif`) | valid stack, applied |
| System interface font | `-apple-system, system-ui, sans-serif` |
| Chicago project, editor | `"Times New Roman", serif`, unchanged |
| Chicago project, Read view with a saved Georgia reader pref | Georgia, preference kept |
| Old saved reader pref `{font:"Futura, Avenir, sans-serif", size:20, spacing:1.7}` | migrated to `var(--ui-font)`; size and spacing kept; dropdown shows "Interface font" |

Screenshots I looked at: `notes/review3-hs7-editor-verdana.png` and `review3-hs7-read-verdana.png`. Both
show Verdana body text and a "Verdana" toolbar label.

On the questions in the brief:
- (1) **Migration.** It touches only `personal-word.reader.font` (a display preference; not project data,
  not a `folio.*` key). It fires only on the exact old default and option literal (`App.tsx:319`; the git
  diff confirms the old value was `"Futura, Avenir, sans-serif"`, labelled "Futura / Avenir"). Size and
  spacing are kept. The reader keeps its own dropdown, so the AGENTS.md rule that Read has separate display
  settings holds. Export does not read it.
- (2) **styles.css.** The HS7 rule is present at `styles.css:2002-2006`. The `--ui-font` default (223),
  `.brand` (1527) and the heading font group (2007-2015) are intact, and the computed fonts above prove the
  rule is live. I could not identify which backup the other worker restored.
- (6) **Font marks.** Explicit font marks win in the code (`Writer.tsx:1151` `fontFamily ?? defaultFont`;
  marks render inline). I did not exercise this in a browser.
- (7) **Exports.** The sans mappings are unchanged (`docx.ts:118` Arial; `pdf.ts:72` family "sans", which is
  bundled Noto Sans). `npx vitest run src/export` passes.
- (8) **nativePdf.** `src/print/nativePdf.ts:204` (Futura) is reached only through `printProbe.ts`, which
  only the tests and the dev scripts `scripts/native-print-fixtures.mjs` and `scripts/native-print-smoke.py`
  use. No app path reaches it, so the owner cannot hit it today.

Findings:
1. should-fix (coordinator; HS8 owns the file) -- `src/export/ExportPanel.tsx:82` still reads
   `{ value: "sans", label: "Arial" }`. TASKS HS7 requires a truthful relabel. The worker's proposed
   `"Sans (Arial in Word, Noto Sans in PDF)"` is accurate per `docx.ts:118` and `pdf.ts:72`. Apply it.
   The worker's notes say about line 77; the line is 82.
2. low -- When the interface font is "System", the toolbar font box for unmarked text reads
   "-apple-system" (`Writer.tsx:1383`, `withCurrent(..., primaryFamily(fontValue))`). Fix: label the value
   with the matching `BUILT_IN_FONTS` label (via `sameFont`) before falling back to `primaryFamily`.
3. low -- The Read view of a serif (Chicago) project uses the reader font, whose default is now the
   interface font (it was Futura). This follows the separate-display-settings rule, so it is not a
   regression, but the owner should know.
4. low -- The `documentFontStack` empty-string fallback is effectively unreachable (`getInterfaceFont`
   always returns a stack). Harmless.
5. low -- A user who had explicitly picked "Futura / Avenir" in Read is migrated too; it is
   indistinguishable from the default. There is no visible change while the interface font is Futura.

## What I ran
- `npx vitest run src/editor/documentFont.test.ts src/components/floating.test.ts src/export src/hoverEmphasis.test.ts`:
  14 files, 205 tests pass.
- `npx tsc -b`: clean.
- One locked run, `PLAYWRIGHT_PORT=1443 npx playwright test tests/floating.spec.ts tests/hs7-document-font.spec.ts tests/review3-tmp.spec.ts`:
  47 passed (4.9 min). `tests/review3-tmp.spec.ts` was deleted afterwards.

## Unverified
- Native WebKit / Tauri rendering of both changes (Chromium only).
- Fragments font live update (by code only: `fragments.css:99` uses `--document-font` and then
  `--ui-font`).
- Split view with HS7 (each Writer computes its own `defaultFont`; by code only).
- Exported files were not opened.

## Owner hand test
- Floating on, wide window, Read manuscript: scroll, and look at the top of the sidebar.
- Settings > Appearance: pick a non-Futura font. A Blank project's editor and Read view should follow it
  live, and a Chicago project's editor should stay Times New Roman.
- Pick "System" as the interface font and look at the toolbar font box label.
