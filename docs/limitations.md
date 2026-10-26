# Limitations and resolved issues

Part 1 lists what is still true today. Part 2 lists issues that were fixed, newest first. Evidence for the figures is in the [validation record](validation.md).

## Part 1 -- Current limitations

### (a) Deliberate design limits

- **Page breaks differ between views.** The editor's page view, PDF export, and Word export each lay out pages differently. Expect page breaks to move; exact page parity is not promised. **Preview PDF** shows the same PDF exporter's output. An exact print-engine preview does not exist.
- **PDF uses bundled fonts.** PDF export draws with bundled Noto fonts, not the fonts on your Mac. It covers Latin, Greek, and Cyrillic scripts. Other scripts are refused with a message, so use Word export for them. A footnote too long to fit on one page is also refused rather than cut off. Word continuation paragraphs of a multi-paragraph footnote have no indent while PDF's are indented.
- **Citation help covers common sources.** Books, journal articles, and websites are supported. The current development source also formats bounded examples for print edited-book chapters, ProQuest PhD dissertations, signed online newspaper articles, broadcast audio interviews and online TED Talks. Those examples have browser-preview and generated-export checks; they do not cover every subtype. Other imported records retain raw fields and offer manual citation forms. Full audio/video notes with specific time references currently require manual text. Lookup results can be wrong or incomplete. Check every citation and your instructor's rules yourself. By default, short notes run across the manuscript and never use ibid. An opt-in **Use repeat citation rules** setting in the Research panel lets you choose to show the full citation again once per section and to use "Ibid." for back-to-back repeats instead of a short note (`src/research/ResearchPanel.tsx:686`).
- **Version comparison works by paragraph.** It does not track changes word by word.
- **Fonts depend on your Mac.** The interface prefers Futura, then Avenir. No commercial fonts are included.
- **Saving is tested, not guaranteed.** Personal Word uses SQLite WAL with macOS `fullfsync=ON` and immediate transactions. Isolated native tests killed the app at checkpoints between asset staging and save, between the database commit and the portable copies, during a research-source merge and during a snapshot restore, and the project came back intact each time. On this Intel Mac a 100,000-word one-section save measured 116.57 / 130.43 / 124.37 ms at the 95th percentile at low load, and 141.69 ms on 2026-10-25 at moderate load (load average about 20-26) after the cheap-fixes changes (budget 150 ms; earlier runs on a heavily loaded Mac took 347 to 499 ms). Apple silicon is unmeasured. Sudden power loss, a kernel panic or disk failure cannot be guaranteed against; keep external backups.
- **Zotero refresh scope.** The optional refresh is off by default, read-only, and limited to your own Mac (127.0.0.1:23119); every change goes through the review dialog. It works in the desktop app only; the browser preview shows a desktop-only message and makes no network read. It has no distinct "Zotero is off" message and has never been run against a real Zotero. Updates to a matched source preserve identity and linked notes, leave unselected local fields intact, and require a checked safety snapshot. No fields are selected automatically; replacing original CSL data replaces that whole field.
- **Imports have size caps and cannot carry everything.** Plain text and Markdown files (up to 5 MB) keep their structure, but images, tables and raw HTML inside them arrive as visible literal text with a warning. HTML, Word (.docx) and Markdown-with-images (.zip) bundle files (up to 20 MB) import headings, lists, links, notes, rectangular tables and PNG/JPEG images through a preview dialog. They check the zip's declared sizes before unpacking, parse HTML without running it, and never fetch an outside image (it is omitted with a warning). Cancel creates nothing. A bundle's checksums are verified on import. Merged or nested table cells are not supported, and the app has no live multi-user collaboration or tracked changes. **Cancel import** discards the result of a slow parse and creates nothing; abandoning the dialog with Escape (while reading or at the preview) is covered by browser tests (2026-10-25), but abandoning it by leaving the screen is not. The XML check refuses only external DOCTYPE declarations.
- **Writing aids are optional heuristics.** Prose checks can be wrong; they never correct text. Goals count manuscript sections only, and daily baselines reset by the local date. When a section has an extreme number of flagged words, only the issues nearest the cursor are shown (the panel says so) so typing stays responsive.

### (b) Known issues still open

- **PDF tables do not repeat the header row on continuation pages.** Word export marks the header row to repeat (confirmed by the owner in Word).
- **Zip header size cap.** A zip whose headers understate an entry's size is rejected only after that entry is unpacked, so a hostile file can cost memory first. The owner accepted this as a documented beta limit (Q003).
- **Citation after a block quotation.** A citation inserted after a block quotation can appear after the block rather than inside its final paragraph. Review the placement before export.
- **Comment anchors on identical passages.** Comments attach to quoted text. If two passages are identical, a comment may attach to the wrong one. If its passage is edited away, the comment is marked detached.
- **Zotero refresh gaps.** The refresh has no polling, no incremental updates, and no handling of items deleted in Zotero.
- **Large projects can slow writing aids.** Goal and citation summaries currently recompute across the project during renders.
- **Native print stopped.** A native WebKit print probe could not produce searchable Arabic: Arabic text containing the lam-alef ligature (for example السلام) could not be searched in its PDF with 26 of the 28 installed fonts tried. The probe exists only in a diagnostic build. The legacy PDF exporter remains the only PDF path, and exact native PDF preview and flowing per-page footnotes are cancelled (Q004, WP9/WP10). A bundled open-licence Arabic body font and a new probe are the recorded route to reconsider it.

## Part 2 -- Resolved issues

Newest first. Task IDs are board tasks.

- 2026-10-25 -- Native print probe stopped (T013, T014, Gate C T017); the legacy PDF exporter was kept by owner decision (Q004).
- 2026-10-25 -- T057: import cancel and Escape-abandon paths now have browser test coverage.
- 2026-10-25 -- T055: BibTeX "Jr." suffix now formats as "John Q. Smith Jr." in notes and "Smith, John Q., Jr." in the bibliography.
- 2026-10-25 -- T056: browser-preview Zotero fetch no longer makes an unapproved network read; it shows a desktop-only message.
- 2026-10-25 -- T054: Word and PDF exports now print the project title and section titles, matching Markdown, plain text and the bundle.
- 2026-10-25 -- T053: PDF images no longer stack without a gap.
- 2026-10-25 -- T052: the notice toast no longer covers the export button and now auto-dismisses.
- 2026-10-25 -- T051: the "newer version of Folio" error text now uses the Personal Word name.
- 2026-10-25 -- T050: the import size label now shows the correct 20 MB cap.
- 2026-10-25 -- T043: multi-paragraph footnotes are written as separate paragraphs in Word and PDF export (Word rendering confirmed by the owner); Markdown footnotes round-trip.
- 2026-10-25 -- Benchmark rerun: the save p95 of 116-130 ms at low load now meets the 150 ms budget (earlier "not met" figures of 347 to 499 ms were from a heavily loaded host).
