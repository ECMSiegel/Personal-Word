# T019 -- Final rich-export and native-style UI artifact acceptance

Status: **CLAIMED** (nothing here is owner-verified; no Word, no WebKit, no VoiceOver, no IME, no ARM).
Agent: agent-15e2 (Claude Sonnet worker). Date: 2026-10-25. No product code changed.
Working folder: `node_modules/.cache/personal-word-beta/team-t019/` (call it `T019/` below). All data is synthetic; the real `com.folio.writing` library and real Zotero data were never touched.

## 0. How the artifacts were made

- Harness: `T019/t019-artifacts.test.ts`, run with the pinned Node v22.23.3 as
  `npx vitest run -c T019/vitest.config.mjs` (log `T019/vitest-artifacts.log`, 1 test passed). It imports the real
  `src/export/*` and `src/projectArchive.ts` modules, like Gate C's `team-t017` harness. Nothing under `src/` was edited.
- Project: two sections ("Opening", "Second section"), headings (H1/H2), about 150 paragraphs of mixed Latin / Greek /
  Cyrillic text, a bullet list with a nested ordered list starting at 4, a 3-column table with a header row and 46 body rows
  (it spans 7 PDF pages), a real 240x120 PNG and a real 200x160 JPEG (generated locally; the old fixture JPEG is header-only
  and cannot show glyph/image loss), a hard-break, a strikethrough run, an explicit page break, 8 footnotes
  (a first full citation, a short citation, a back-to-back repeat that resolves to **Ibid.** under
  `citationPolicy {repeats: "ibid"}`, a second source (journal), a 3-paragraph note, a note inside a table cell, a note in the
  second section), a 2-entry bibliography, and the project title. A second DOCX holds Arabic, Hebrew and CJK lines.
- Source images are hashed (sha256 as the asset id), so the bundle and archive verify them for real.
- Production preview: `npm run preview` on port 1480, from the existing `dist/` (no `src/` file is newer than `dist/index.html`,
  built 04:41; I did not rebuild). I started and stopped that server myself; port 1480 is closed now.
- Serial slot: taken and announced (msg #125); only vitest, one preview server and 4 Playwright tests ran. Released at `done`.

## 1. Artifact table (SHA-256; full list in `T019/hashes-artifacts.txt`, `T019/hashes-screens.txt`)

| File (under `T019/artifacts/`) | Bytes | SHA-256 | How generated |
|---|---|---|---|
| `t019.pdf` | 163181 | `bb0c1a4b27d5fce8326be353abb80888cd6c8b3fcb01629d9339b48bda50724c` | `exportPdf(project, undefined, assets)`; the 3-paragraph note joined with spaces (see D1). 12 pages, letter. Hash is run-specific (pdf-lib stamps CreationDate, gate-c F3) |
| `t019.docx` | 81755 | `46d50c3b011d4c1da5c129bb27b7bcc06d1ec38e77e572ecfa92c2a215082de5` | `exportDocx(project, assets)` |
| `t019.md` | 12422 | `d0dd641f1b74593afcb53269629d8c74475d1e71da0c07245e39fcb698288203` | `projectMarkdown(project, assets)` |
| `t019.txt` | 11878 | `95dcca854f8ec351012c6ebec97625f466ad3f27d6d07047ad936ca5fab1a55f` | `projectPlainText(project, assets)` |
| `t019-bundle.zip` | 70215 | `5aabff2d85edc1af6996bdfb2738545c6d184069473121006c8225ed54e3ee53` | `exportMarkdownBundle(project, assets)` |
| `t019.personalword.json` | 188872 | `d57819f5ed87986cee0a367122333460007097ded017e302285a07dc76d31eb9` | `createProjectArchive(project, resolver)` (portable archive v2) |
| `t019-scripts.docx` | 10588 | `5f0985c1edd2468e207336324217165944397f663e8c5efc2849687c7bfcd65d` | DOCX of Arabic/Hebrew/CJK lines (the PDF correctly refuses it, asserted in the harness) |
| `source-fixture.png` / `.jpg` | 64364 / 7906 | `fde544e3...d15a` / `66415159...ae5d` | generated inputs |
| `pdf-multiparagraph-note-refusal.txt` | 171 | `3a513311b408556d43bd7377eae79cf0dac962b5f58913db4a1797b3fa003106` | the exact error text from the real PDF exporter for the full project (D1) |
| `docx-ql/t019.docx.png` | | `4959d8295e90833400234249ec367c681557d20e7b1dc98679311f5e64f67b54` | `qlmanage -t -s 900` (log `T019/qlmanage.log`) |
| `pdf-pages/p-01..12.png` | | (`shasum` them if needed) | `pdftoppm -r 80 -png t019.pdf` |
| `docx-xml/`, `bundle-x/` | | | unzipped copies for inspection |

PDF/DOCX/ZIP bytes embed export timestamps, so they differ on every run. Compare content, not hashes (done in section 2).

## 2. Cross-format comparison (`T019/compare.py`, `compare2.py`; logs `compare.log`, `compare2.log`)

| Check | docx | pdf | md | txt | bundle manuscript.md |
|---|---|---|---|---|---|
| Table body rows 1..46 present | 46 | 46 | 46 | 46 | 46 |
| "Header A" once, Bibliography once, both bibliography entries once | yes | yes | yes | yes | yes |
| "Ibid." present (note 3 plus the body sentence that mentions it) | 2 | 2 | 2 | 2 | 2 |
| Notes 1..8 in the expected order with expected text (full, short, Ibid., 3-paragraph, journal, short 88, table-cell, section 2) | ORDERED | ORDERED | ORDERED | ORDERED (note 1 checked separately at txt line 103) | ORDERED |
| Word multiset vs Markdown | differs only by title, "Opening", "Second section" (not printed in DOCX/PDF, see O1), image alt text, list-number "4", and the "A line" hard-break join | same plus page numbers 1-12, footnote numerals, and the long unbroken token wrapped by character | baseline | differs only by note numbers, `[Page break]` and `[Image]` placeholders | `md` plus asset file names |

- `t019.md` and the bundle's `manuscript.md` are byte-identical (`diff`).
- Bundle zip: `manuscript.md`, `manifest.json`, `assets/<sha256>.png`, `assets/<sha256>.jpg`. Manifest has 2 assets; both
  files re-hash to the manifest ids and match `byteLength`. DOCX media re-hash to the same two sha256 values, so the PNG
  and JPEG bytes are exactly the inputs.
- Archive: `personal-word` v2, 2 assets (sha256 verified), 2 entries, 8 footnotes, 2 image references, and the multi-paragraph note keeps its blank lines.
- Import preview of the bundle (screenshot 07): 155 paragraphs, 2 images, 1 table, 8 notes -- matches the source (8 notes).
- **Comparator control (fail-first):** in a copy (`T019/control/`) I swapped two Markdown note lines; `compare2.py` printed
  `md [...] CHECK` (not ORDERED) while the untouched bundle stayed ORDERED (`T019/control.log`). The real artifacts were not touched.

## 3. PDF, page by page (all 12 pages viewed with Read at 80 dpi)

`pdffonts`: Noto Serif regular/bold/italic shards, all embedded. No glyph loss or tofu anywhere (Latin-extended, Greek with
tonos, Cyrillic, em dashes, curly quotes, the strikethrough, and the long unbroken token all render).

| Page | Findings |
|---|---|
| 1 | H1 "Synthetic export QA", strikethrough, hard-break, bullet and nested "4." item, long token wrapped by character (no overflow), H2, body. Note 1 (full citation, locator 9) at the foot. Page number 1. No clipping |
| 2 | Body continues; refs 2, 3, 4 on the page; notes 2 ("Smith, A Book of Examples, 42."), 3 ("Ibid."), 4 (3-paragraph note, flattened to one block because of D1 workaround) in order at the foot |
| 3 | Notes 5 (journal citation with italic title) and 6 (short). The PNG and JPEG both render with correct aspect, centered, no clipping; they touch with no gap between them (cosmetic, O2) |
| 4 | Table header row and rows 1-4, borders intact, Greek/Cyrillic cells fine; table-cell note 7 at the foot; the next row would not fit so the table breaks (about 70 px of white above the note rule) |
| 5-9 | Rows 5-44, 8 rows per page. **No header row on any continuation page.** Cells wrap, no overlap or clipping |
| 10 | Rows 45-46, the paragraph after the table, then blank (explicit page break follows). Still no header row |
| 11 | "Text immediately after the explicit page break", then H1 "Second section heading" and its paragraph; note 8 at the foot |
| 12 | "Bibliography" heading, two entries in alphabetical order |

Notes are present and in order on every page that cites them. Images present. No overlap. Page numbers 1-12 at bottom right.

## 4. DOCX XML (`T019/artifacts/docx-xml/`)

- Parts: `document.xml`, `footnotes.xml` (8 footnotes), `endnotes.xml`, `footer1.xml`, `numbering.xml`, `settings.xml`,
  `styles.xml`, `media/*.png|jpg`; `document.xml.rels` links both media (rId8, rId9) and footnotes/footer.
- 8 `w:footnoteReference` ids 1..8 in document order; footnote texts match the Markdown notes (full, short, "Ibid.", journal...).
- Two `w:drawing` inline images with `descr`/`title` alt text; extents 240x120 and 200x160 px in EMU; media hashes equal the inputs.
- Table: header row carries `<w:tblHeader/>` (46 body rows `w:tblHeader w:val="off"`), so Word repeats the header (not observed in Word).
- Explicit page break and the bibliography use `pageBreakBefore` (2 uses); nested ordered list has `w:start w:val="4"` in numbering.xml; footer has the page-number field.
- **D2 (likely defect):** the 3-paragraph note is one `w:footnote` paragraph with one `<w:t xml:space="preserve">` that contains literal newlines (`footnotes.xml`, footnote id 4). Word does not treat a literal line feed inside `w:t` as a paragraph break, so the three paragraphs should show as one run-on paragraph. Source: `src/export/docx.ts:214-225` (one `TextRun` per part). Not observed in Word (not installed); XML evidence only.
- `t019-scripts.docx`: Arabic, Hebrew, CJK text is present in `w:t`; the run has no `w:rtl`/`w:bidi`/complex-script font marking, so how Word shapes and orders it is owner-pending.
- QuickLook thumbnail (`docx-ql/t019.docx.png`, viewed): body, headings, list, long-token wrap, strikethrough all fine; it does not render footnotes or page breaks (as Gate C F3 said), so it proves little beyond "opens". It is not Word.

## 5. Native-style UI screenshots (Chromium on the production preview, NOT WebKit/macOS native)

`T019/screens.mjs light|dark` (viewport 1280x800, `colorScheme` emulated), output `T019/screens/*.png`, hashes in
`T019/hashes-screens.txt`, style probe in `T019/screens/report-{light,dark}.json`. Every one of the 18 PNGs was viewed.

| Screenshot (light and dark) | What I checked | Result |
|---|---|---|
| `01-editor-*` editor with table and image | sans UI, flat surfaces, selected sidebar entry | Futura/Avenir-stack UI font; "Manuscript" and "Opening" blue and semibold; table header shaded; image has alt-text placeholder; no rounded corners; dark and light each internally consistent (the image landed inside the last table cell only because my script's caret was there) |
| `02-read-*` reading view | theme, "--" separators | "CONTINUOUS MANUSCRIPT -- READ ONLY", title, heading, table, image; "Read manuscript" blue/semibold |
| `03-csl-import-preview-*` | dialog | 3 sources with checkboxes, Cancel/"Add sources"; square dialog; dark primary button is the light-blue token with dark text |
| `04-research-*` research panel with sources | sources and Zotero hint | 3 sources listed ("Halloway -- A Lantern...", etc.); "In Zotero, export CSL JSON or BibTeX (.json, .bib, .bibtex)." and "Zotero refresh: disabled / enable the local API in Settings > Advanced before refreshing." visible |
| `05-export-panel-*`, `05b-export-section-*` | export panel | Preview PDF, Export DOCX (primary), Markdown, "Markdown with images (.zip)", plain text, PDF buttons; text says PDF covers Latin/Greek/Cyrillic, notes that do not fit are reported; note it does not mention multi-paragraph notes (D1) |
| `06-import-docx-*` | DOCX import preview | "rich-sample.docx -- DOCX", 5 paragraphs, 1 image, 1 table, 1 note |
| `07-import-bundle-*` | bundle import preview | "t019-bundle.zip -- Markdown bundle", 155 paragraphs, 2 images, 1 table, 8 notes |
| `00-projects-*` | projects list | calm, flat, text-link actions |

Computed-style probe: body and buttons `font-family: Futura, "Avenir Next", -apple-system, "system-ui", sans-serif`;
selected sidebar entry `font-weight 600`, colour `rgb(0,105,217)` in light; zero elements with a non-zero `border-radius`
among buttons, inputs, sidebar, sections and dialogs. `"--"` is the DOM text everywhere I checked (dialogs, reading view
labels); Futura appears to draw `--` as an en-dash-looking glyph in the dialogs and project list, so it can look like a single dash in
screenshots. A "Selected sources added." toast sits over the "Export PDF" button in screenshots 05/05b (it was still on screen;
it has an X). Both are cosmetic, noted for the owner, not defects I filed.

## 6. Accessibility and input coverage

- `tests/accessibility.spec.ts` on the production preview (port 1480, config `T019/browser.config.mjs`): **4 passed** (log `T019/a11y.log`, JSON `T019/a11y-report.json`).
  It covers: the font-family dropdown is a listbox that takes keyboard focus, supports Arrow/Home/End/type-ahead,
  restores focus on Escape/selection; Tab closes it and the menu stays inside an 850x600 viewport in light and dark with reduced motion;
  page-layout measurement keeps the editor element and undo history; an overlong page footnote offers a keyboard-operated continuous view.
- What it does not cover: any screen reader output, IME composition, focus rings visually, the research/export/import dialogs' tab order, native WKWebView.
- Owner-pending (cannot be done with the installed tools): interactive VoiceOver on the built app; IME (Japanese/Chinese/Korean composition, dead keys) in the editor; Word rendering of the DOCX (footnote paragraphs, header-row repeat, Arabic/Hebrew shaping, images); Apple Silicon run; long-session (hours) editing and memory; WebKit/native look of the light/dark UI.

## 7. Defects found

| ID | Finding | Pointer | Disposition |
|---|---|---|---|
| D1 | The legacy PDF exporter throws "PDF export currently supports Latin, Greek, and Cyrillic text ... script shaping ... export it as DOCX" for any footnote that contains a newline (e.g. a multi-paragraph note), a misleading refusal for ordinary Latin text. Repro: note text `"First.\n\nSecond."`; also `"A\nB"` fails, a single-line note passes. Cause: `selectShard` looks up U+000A in the font character sets. | `src/export/pdf.ts:78-99`; `src/export/document.ts:107` passes `n.text`; error text in `T019/artifacts/pdf-multiparagraph-note-refusal.txt`; export-panel copy does not warn about it | Filed as **T043** (priority 3, together with D2) |
| D2 | DOCX footnote with several paragraphs is written as one run containing literal newlines, so the paragraph breaks will be lost in Word (XML evidence only). | `src/export/docx.ts:214-225`; `docx-xml/word/footnotes.xml` footnote 4 | T043 |

Observations (not filed; for T020/T022 to judge): **O1** DOCX and PDF omit the project title and the section entry titles ("Opening", "Second section") that Markdown/plain text/bundle print. **O2** PDF images stack with no gap. **O3** Trailing spaces before a note reference come from my fixture text, not the exporter.

## 8. Known limitations: retained or closed

- **PDF tables do not repeat the header row on continuation pages: RETAINED, re-confirmed.** Pages 5, 6, 7, 8, 9, 10 of `t019.pdf` start directly with body rows. DOCX does mark the header row (`w:tblHeader`), unverified in Word.
- **BibTeX "Jr." suffix only in raw `cslData`: RETAINED.** `src/research/bibtexImport.test.ts:95-104` still expects `creators` with family "Smith" given "John Q." and the suffix only at `cslData.author[2].suffix`.
- **Save-benchmark latency: NOT closed by me (not re-run, per instructions).** T018 recorded release-mode p95 116.57 / 130.43 / 124.37 ms (budget 150, load about 2, FULLFSYNC on, Intel, one host) in `team-t018/logs/bench-release-{1,2,3}.log` and `wp11-matrix.md` lines 64 and 83; the HANDOFF line (347/499 ms) was taken at load 49-107 and is stale. Still no Apple silicon and no run on a loaded machine within budget.
- Native print path (Arabic lam-alef) is out of scope; Gate C documents it as a STOP.
- Word rendering, ARM, VoiceOver, IME, WebKit visuals, long session: owner-pending (section 6).

## 9. Commands (exact)

```
export PATH="$PWD/node_modules/.cache/personal-word-alpha-review/tools/node-v22.23.3-darwin-x64/bin:$PATH"   # v22.23.3
npx vitest run -c node_modules/.cache/personal-word-beta/team-t019/vitest.config.mjs     # 1 passed
pdfinfo / pdffonts / pdftotext / pdftoppm -r 80 -png t019.pdf pdf-pages/p                # 12 pages
unzip -oq t019.docx -d docx-xml ; unzip -oq t019-bundle.zip -d bundle-x
qlmanage -t -s 900 -o docx-ql t019.docx
python3 T019/compare.py ; python3 T019/compare2.py                                         # section 2
npm run preview -- --host 127.0.0.1 --port 1480 --strictPort                              # mine, stopped
node T019/screens.mjs light ; node T019/screens.mjs dark                                  # 18 PNGs
npx playwright test -c T019/browser.config.mjs                                            # 4 passed
```

## 10. Owner steps to confirm (none done yet; everything above stays CLAIMED)

1. Open `T019/artifacts/t019.docx` in Word: check the 3-paragraph footnote 4, the repeated table header on page 2+, both images, and `t019-scripts.docx` Arabic/Hebrew.
2. Open the built app (WebKit) in light and dark and compare against `T019/screens/*.png`.
3. VoiceOver pass over the sidebar, the export panel and the import dialog; IME composition in the editor.
