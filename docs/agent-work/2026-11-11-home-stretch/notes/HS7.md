# HS7 -- "Sans" document font follows the interface font (agent-02a7, T298)

## What changed
- New pure function `documentFontStack(font, interfaceFont)` in src/editor/documentFont.ts (+ documentFont.test.ts). sans = the interface font (bare family names get fallbacks; empty = Futura); serif/mono unchanged.
- src/Writer.tsx: `defaultFont` now uses `useInterfaceFont()` + `documentFontStack`, so editor, footnotes and the toolbar font label follow the interface font live.
- src/editor/editor.css: the Futura fallbacks (`.editor-paper .writing-surface`, footnote area) now fall back to `var(--ui-font)`.
- src/styles.css `.writing-surface, .read-prose`: `var(--ui-font, ...)` instead of hard-coded Futura.
- src/organization/fragments.css `.fragment-text`: fallback `var(--ui-font)`.
- src/App.tsx: Read-view font default is now `var(--ui-font)`, dropdown option relabeled "Interface font"; an old saved "Futura, Avenir, sans-serif" reader preference is migrated to it. Reader still has its own dropdown (Georgia, Monospace etc. still work).

## Futura literals classified
- Left (interface/logo): styles.css 223 (--ui-font default), 587 (.brand), 1009, 1249, 1316, 1364-1437, 1499 (UI/headings); fonts/registry.ts (font choice list); Writer.tsx FONT_FACES line ~167 (font picker entry).
- Changed (document default): Writer.tsx defaultFont, editor.css 545/710/750, styles.css writing-surface/read-prose, fragments.css 99, App.tsx reader default + option.
- Not changed: src/print/nativePdf.ts:204 `sans: "Futura"...` (native print path, not in my task; reported -- print of a sans project still uses Futura, not the interface font).

## Export
Export "sans" uses bundled Noto Sans (pdf.ts line 72, fonts.ts); only runs that name a font are looked up through fontSource. A sans project's body text has no per-run font, so there is no existing mechanism to carry the interface font. Left export unchanged (serif/mono untouched). DOCX sans = Arial (docx.ts ~118); PDF sans = bundled Noto Sans. So the dropdown label "Arial" is true for Word, not for PDF.

## For the coordinator
File src/export/ExportPanel.tsx line ~77:
old: `{ value: "sans", label: "Arial" },`
new: `{ value: "sans", label: "Sans (Arial in Word, Noto Sans in PDF)" },`
Optional help text (line ~64) add: "A Sans project is shown in your interface font on screen; exports use Noto Sans."

## Hand check
Settings > Appearance: pick a font (e.g. Avenir Next). Open a Blank project: body text, footnotes, toolbar font box and Read view change to it live. Chicago project stays Times New Roman.

## Results
Fail-first: HS7-fail-first.txt (2 of 3 failed before fix). After: hs7-after.log 3/3 pass; w9-fonts 1/1 pass; vitest src/export + documentFont + hoverEmphasis 13 files 195 tests pass; tsc -b clean. documentFont.test.ts was written before the module existed (not run red).
