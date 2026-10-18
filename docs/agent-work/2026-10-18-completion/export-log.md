# T3 export implementation log

Base HEAD: `c62332c`. The export sources were already dirty before this task and are retained; starting source copies are under the root-owned baseline cache in `node_modules/.cache/personal-word-completion/baseline/`.

## Status

- T3 export fidelity and local fonts: DONE; root inspected the generated DOCX XML and rendered both artifacts in QuickLook. Word's own rendering remains owner verification.

## Fail-first evidence

- DOCX hard break: `npm test -- src/export/document.test.ts` first failed the new WordprocessingML assertion with `expected ... to contain '<w:br'`; archive XML showed the line break serialized as whitespace in `<w:t>`.
- DOCX list restart: temporarily restored baseline `src/export/docx.ts`, then ran `npm test -- src/export/document.test.ts -t 'ordered-list restart values'`. It failed because `word/numbering.xml` contained `<w:start w:val="1"/>` and no start value 7. The baseline source was restored in a `finally` block.
- PDF multilingual support: temporarily restored baseline `src/export/pdf.ts`, then ran `npm test -- src/export/document.test.ts -t 'embeds bundled fonts'`. It failed with `PDF supports Latin text with the built-in fonts. Use DOCX for this document’s Unicode characters.` The baseline source was restored in a `finally` block.

## Changes and acceptance evidence

- `document.ts` emits a dedicated hard-break run and carries list instance, nesting level, and start value through export blocks. DOCX uses a distinct numbering instance for each source list, applies the list start, and avoids inheriting manuscript first-line indent on list paragraphs. PDF treats the explicit hard-break token as a line boundary.
- `docx.ts` emits native `w:br`, `w:footnoteReference`, strike properties, nested `w:numPr`, and list starts. `document.test.ts` inspects `word/document.xml`, `word/footnotes.xml`, and `word/numbering.xml` with JSZip.
- `fonts.ts` bundles OFL Noto Serif, Noto Sans, and Noto Sans Mono WOFF2 subset assets into the application. PDF selects Latin, Latin Extended, Greek, or Cyrillic font shards and preserves available bold/italic faces. Unsupported scripts or missing glyphs produce a clear DOCX fallback error. No network font loading occurs.
- pdf-lib/fontkit subset embedding raised an asynchronous `RangeError: Index out of range` for the bundled WOFF2 files. PDF now embeds the used font shards without subsetting; the generated synthetic PDF was 73 KB, so the size remains modest for the fixture.
- `src/export/export-fixtures.ts` and `scripts/render-export-fixtures.mjs` generate synthetic DOCX/PDF files, including multilingual text, a footnote, strike, hard break, nested list start 4, long token, and bibliography. Root accepted the `.mjs` Node entrypoint adaptation; root owns the npm script.
- `npm test -- src/export/document.test.ts` → `Test Files 1 passed (1); Tests 9 passed (9)`.
- `node scripts/render-export-fixtures.mjs` → `Wrote synthetic DOCX and PDF fixtures to .../test-results/export-fixtures`; generated files were 11 KB DOCX and 73 KB PDF. Vite reported a non-fatal sandbox `listen EPERM` on its internal HMR socket, but returned exit 0 and wrote both fixtures.

## Decisions and limits

- Fonts are locally bundled under their OFL package licenses; package attribution is integrated by root.
- PDF text support is Latin, Latin Extended, Greek, and Cyrillic where the selected font contains the glyph. Arabic, Indic, and other shaping-dependent scripts remain rejected. DOCX remains the fallback.
- Long footnotes still fail explicitly when they cannot fit on one PDF page. PDF/DOCX pagination parity is not promised.
- Root inspected the generated fixtures: DOCX XML shows the footnote reference, strike, hard break, and two numbering instances (numId 2 and 3, ilvl 0 and 1), and both DOCX and PDF render correctly in QuickLook. Native WebKit, the full build, the full browser and native suites, and owner confirmation were run by root separately; see `docs/validation.md` for the dated results.
