# Personal Word

**A private writing app for the Mac, built for research papers.** Write in sections, keep your sources beside the draft, insert Chicago-style footnotes, and export to Word or PDF. Your writing is stored on your Mac. Citation lookup is optional and contacts external services.

> **Alpha.** Personal Word is early software for local writing. Keep your own backups, and read [Limitations](#limitations) before trusting it with work you cannot replace.

![A Chicago-style paper open in Personal Word, with a footnote at the bottom of the page](docs/evidence/readme/writing-light.png)

## Who it is for

Personal Word is for someone writing a long piece with sources: a student paper, a thesis chapter, an essay, or a book-length draft. It suits writers who:

- cite in **Chicago notes and bibliography** style, or follow a Turabian-style student paper layout;
- want their research notes, quotations, and sources **in the same window** as the draft;
- want their writing **stored on their own Mac**, with no account, subscription, or cloud service.

It also includes story and screenplay templates. It is not a replacement for Microsoft Word. It supports inline images (PNG, JPEG), tables (with header rows, row/column operations), Chicago notes, comments, and project archives. It does not handle arbitrary merged table cells, live multi-user collaboration, or tracked changes.

## What it looks like

| Sources and citations beside the draft | Dark mode follows macOS |
| --- | --- |
| ![Research panel showing a source with its Chicago note and bibliography entry](docs/evidence/readme/research-light.png) | ![The writing screen in dark mode](docs/evidence/readme/writing-dark.png) |

![The project library listing two projects](docs/evidence/readme/projects-light.png)

These screenshots come from the browser preview, using made-up writing. The installed Mac app uses Apple's WebKit engine, so small rendering details can differ.

## Supported platform

| | |
| --- | --- |
| **Supported** | macOS only |
| **Tested on** | An Intel Mac running macOS 15 |
| **Not yet hand-tested** | Apple silicon Macs, older macOS versions |
| **Not supported** | Windows, Linux, iPad, phones |

There is no downloadable app yet. You build it from source using the steps below. The build is not signed or notarized by Apple, so macOS may warn you the first time you open it.

Download preparation and its remaining gates are recorded in [Mac distribution status](docs/distribution.md). Prepared [third-party notices](src-tauri/resources/THIRD_PARTY_NOTICES.txt) and license texts still await distribution review.

## Setup

You need three things installed:

1. **Node.js 22** (the long-term-support version). Get it from [nodejs.org](https://nodejs.org).
2. **Rust**, installed with [rustup](https://rustup.rs).
3. **Apple's command line tools.** Install them by running this in Terminal:

   ```sh
   xcode-select --install
   ```

Then download this repository, open Terminal in its folder, and install its dependencies:

```sh
npm ci
```

To run the app while you try it out:

```sh
npm run tauri dev
```

To build a standalone app you can keep in your Applications folder:

```sh
npm run tauri build
```

The finished app appears at `src-tauri/target/release/bundle/macos/Personal Word.app`.

There is also a quicker browser preview, started with `npm run dev`. It opens at `http://localhost:1420`. **The preview keeps writing in your browser, not in the app's database.** Use it for a look around, not for real work.

## A short workflow

1. **Start a project.** On the Projects screen, choose **Start new project**, then **Chicago student paper**. The template sets 12-point serif type, double spacing, one-inch margins, and a title page.
2. **Write in sections.** The sidebar lists the paper's sections. Click one to open it, and add more with the **+** button beside Manuscript.
3. **Add a source.** Open **Research** in the sidebar. Paste a DOI, ISBN, or web address and choose **Look up**, choose **Enter manually**, or import a local Zotero **CSL JSON** or **BibTeX** (.bib) export. Review the preview before adding sources. The panel shows the Chicago note and bibliography entry as you type.
4. **Cite it.** Put the cursor where the note belongs and choose **Cite here**. A numbered footnote appears in the text and at the bottom of the page. New projects shorten repeated citations automatically; existing projects keep that option off until enabled. Choose a Short title and override a note to Always full or Always short when needed. **Capture quote** saves a passage with its page and can insert both quotation and citation together.
5. **Take a snapshot.** Before a big revision, choose **Snapshot** at the top right and name it. **Snapshots & history** lets you compare versions side by side and restore a section or a single paragraph.
6. **Export.** Open **Settings** in the sidebar and scroll to **Export document**. Choose **Export DOCX** for an editable Word file with real footnotes, or **Export PDF**. **Export Markdown** and **Export plain text** include the whole project, including notes, fragments, and research notes. **Markdown with images (.zip)** adds the pictures and a checksum manifest, and can be imported again.

Set manuscript/daily word goals and a deadline in **Settings > Goals**. The toolbar offers **Focus mode** (Cmd/Ctrl+Shift+F) and an optional local **Prose check** with a keyboard-accessible issue list.

The app saves as you type. The download icon at the top right saves a complete copy of the project as a `.json` file, which is useful as a backup.

## Where your writing lives

Each project is stored in its own folder in your Mac's application-data area, under the name `com.folio.writing`. In **Settings**, choose **Show path** next to Storage location to see the exact folder. Each folder holds a SQLite database, which is the real copy, plus readable JSON and plain-text copies.

To back up, quit the app and copy the whole project folder somewhere else. The only time the app uses the internet is when you choose **Look up** for a citation. It sends the DOI or ISBN you entered to Crossref or Open Library, or fetches the web page you named. A DOI found in that page’s metadata may trigger a follow-up request to Crossref. The optional Zotero refresh (off by default) talks only to Zotero on your own Mac.

## Alpha status

Personal Word is still alpha. As of 2026-10-25 (Gate D) the board's automated and isolated-harness checks have run on the current source and a fresh normal app has been built and inspected, but no beta has been declared ready, and the owner has not yet tried the beta features in real use. Every result below is automated or harness evidence (CLAIMED), not confirmed behavior; only the owner's real use can make anything VERIFIED.

### Beta board, 2026-10-25

What has been checked on the current source, by kind of evidence. Details and run IDs are in the [validation record](docs/validation.md).

- **Browser tests (Chromium, production preview).** Suites for images and tables, rich import, Markdown notes and bundle round trip, BibTeX/Zotero, research, keyboard-only indent, accessibility and import cancel were executed (counts per suite in the validation record). The final full production-preview run (task T046 rerun, Gate D) passed 112 of 112 tests across 23 spec files (one worker, no retries, Chromium only); the per-suite counts above are history. Chromium is not Apple's WebKit.
- **Unit and Rust tests.** 858 unit tests in 46 files and 48 Rust tests (1 ignored benchmark) passed at the end of task T018 (history). Task T043 later changed the PDF/DOCX exporters and added 7 tests. The Gate D counts on the final source are `tsc` exit 0, **865 unit tests in 47 files**, and **48 Rust tests passed with 1 ignored** (offline, serial).
- **Isolated native tests.** A diagnostic build with a separate app identifier ran a baseline suite (13 scenarios, 5 negative controls) and a beta suite (19 scenarios, 42 negative controls). They covered a synthetic project with images and tables through saving, reload, history and snapshots, and process kills at four points: after an image was stored, between the database commit and the portable copies, during a research-source merge, and during a snapshot restore. It used synthetic data only. It is not the normal app and not a real shutdown.
- **Exported files.** A rich synthetic project was exported to PDF, Word, Markdown, plain text, a Markdown bundle and a project archive and compared. The PDF pages were viewed. The Word file was inspected as XML, not opened in Word.
- **Saving at scale.** On this Intel Mac, with the database's full-flush setting on and little other load, a 100,000-word save of one edited section took 116.57, 130.43 and 124.37 ms at the 95th percentile in three runs (budget 150 ms); the final-qualification rerun measured a median of 108.12 ms and a 95th percentile of 117.98 ms. That is a measurement on one machine, not a guarantee. Apple silicon has not been measured, and a busy Mac can be slower; typing is buffered while a save is in progress.

### Gate D, 2026-10-25 (final qualification; CLAIMED, not beta ready)

Task T021 ran the final qualification serially and task T022 (Gate D) reviewed it independently and reran the key checks. Verdict as recorded: **PASS for automated acceptance; beta readiness pending owner real use.** Nothing here is VERIFIED.

- **Numbers.** `tsc` exit 0; 865 unit tests in 47 files; production-preview Playwright 112/112 across 23 spec files (one worker, no retries, Chromium only; the one earlier failure was a stale test, repaired in T046); offline serial Rust 48 passed, 1 ignored; save benchmark p95 117.98 ms (budget 150 ms, one Intel Mac at low load).
- **Isolated native runs** (synthetic data, `com.folio.smoke` identifier, not the normal app), all on source identity `7e07795970ee8195`: baseline `20261025T093854Z-eb139b9b` 13 scenarios + 5 negative controls; beta `20261025T093937Z-7c31d8de` 19 + 42; Gate D reviewer rerun of the beta suite `20261025T100024Z-93ccb1f1` 19 + 42.
- **Normal app.** `src-tauri/target/release/bundle/macos/Personal Word.app` (inside this project folder), identifier `com.folio.writing`, version 0.1.1, Intel (x86_64). Main binary `Contents/MacOS/folio` sha256 `66da1177a6b0063c88a34a8b4c6e58459f657d55bf2271d424582d121cb932f2`. It contains none of the diagnostic smoke markers. It is unsigned, not notarized and not published, and it has never been opened against the real library.
- **Evidence verifier.** `scripts/verify-beta-evidence.py` exits 2 ("consistent but incomplete"): no check failed, and the nine owner items below plus the review's own recording were pending when T021 and T046 ran. It will stay at exit 2 until the owner reports.
- **Owner items still pending (nine).** keyboard-only editing and the duplicate-comment jump in the real app; blocked-close retry; the recovered image and its hash; reopening the pre-restore safety copy; Microsoft Word rendering of the exported DOCX; an Apple silicon run; VoiceOver and input methods; a long real writing session; native WebKit light/dark visuals. Open owner questions: Q001 (off-board edits to the print-probe files), Q002 (off-board orchestrator edits), Q003 (zip header size limit), Q004 (native print STOP options).
- Not covered by any of this: Apple silicon, other macOS versions, native WebKit drawing of the new screens, Word rendering of the DOCX, VoiceOver and input methods, power loss, hosted CI. Records: [validation record](docs/validation.md), `docs/agent-work/2026-10-24-team-reconciliation/evidence.md` and `gate-d.md`, and `docs/agent-work/2026-10-20-beta-roadmap/06-durability/REVIEW.md`.

### Not done yet

- No signed, notarized download. A fresh normal app build was made and inspected on 2026-10-25 (see Gate D below), but nobody has opened it yet: its first launch opens the real `com.folio.writing` library, so that step is the owner's.
- No check of exported files in Microsoft Word. Earlier synthetic fixtures were rendered in LibreOffice and Poppler; the beta artifacts were inspected with Poppler and XML only.
- No VoiceOver, input-method, Apple silicon, long-session or physical power-loss qualification. Isolated forced-process-termination coverage is narrower than a real shutdown.
- No hosted CI run, and no check of how the Mac app's WebKit draws the editor.
- The native print engine for an exact PDF preview was investigated and stopped (see Limitations). Owner question Q004 about it is open.

### Earlier checks (October 2026, history)

- Automated tests covered saving, crash recovery journals, imports, exports, and the main writing journeys in a browser.
- A 100,000-word project measured under a millisecond of the app's own work per keystroke and about 9 milliseconds for one database save, excluding screen drawing.
- Isolated native tests passed a three-phase save/recovery scenario on October 18. A later review run that day timed out before UI injection with macOS system-service errors.

The [roadmap](ROADMAP.md) lists what comes next.

## Limitations

- **Page breaks differ between views.** The editor's page view, PDF export, and Word export each lay out pages differently. Expect page breaks to move; exact page parity is not promised. **Preview PDF** shows the same PDF exporter's output. An exact print-engine preview does not exist: a native WebKit print probe was tried and stopped, because Arabic text containing the lam-alef ligature (for example السلام) could not be searched in its PDF with 26 of the 28 installed fonts tried, so the PDF exporter below remains the only PDF path. The probe exists only in a diagnostic build, and the owner has not yet decided how to proceed (question Q004).
- **PDF uses bundled fonts.** PDF export draws with bundled Noto fonts, not the fonts on your Mac. It covers Latin, Greek, and Cyrillic scripts. Other scripts are refused with a message, so use Word export for them. A footnote too long to fit on one page is also refused rather than cut off. PDF tables do not repeat the header row on continuation pages (Word export marks the header row to repeat, which has not been checked in Word). PDF stacks consecutive images with no gap. Multi-paragraph footnotes are split into separate paragraphs in PDF and Word (task T043, repaired and reviewed; not checked in Word).
- **Citation help covers common sources.** Books, journal articles, and websites are supported. The current development source also formats bounded examples for print edited-book chapters, ProQuest PhD dissertations, signed online newspaper articles, broadcast audio interviews and online TED Talks. Those examples have browser-preview and generated-export checks; they do not cover every subtype. Other imported records retain raw fields and offer manual citation forms. Full audio/video notes with specific time references currently require manual text. Lookup results can be wrong or incomplete. Check every citation and your instructor's rules yourself.
- **Imports.** Plain text and Markdown files (up to 5 MB) keep their structure, but images, tables and raw HTML inside them arrive as visible literal text with a warning. HTML, Word (.docx) and Markdown-with-images (.zip) bundle files (up to 20 MB) import headings, lists, links, notes, rectangular tables and PNG/JPEG images through a preview dialog. They check the zip's declared sizes before unpacking, parse HTML without running it, and never fetch an outside image (it is omitted with a warning). Cancel creates nothing. A bundle's checksums are verified on import. Merged or nested table cells are not supported. A zip whose headers understate an entry's size is rejected only after that entry is unpacked, so a hostile file can cost memory first (owner question Q003 is open). **Cancel import** discards the result of a slow parse and creates nothing; abandoning the dialog some other way, such as leaving the screen, is not covered. The XML check refuses only external DOCTYPE declarations. The import button label says "up to 20 MB" for every format, including the 5 MB text limit.
- **Zotero and bibliography import.** Supports CSL JSON, BibTeX (.bib, .bibtex), and an optional Zotero refresh that is off by default, read-only, and limited to your own Mac (127.0.0.1:23119); every change goes through the review dialog. In the BibTeX importer a "Jr." suffix is kept only in the raw record, not in the formatted creator name. The refresh has no polling, no incremental updates, no handling of items deleted in Zotero, and no distinct "Zotero is off" message; it has never been run against a real Zotero. In the browser preview a different code path fetches the data, which was not approved as part of the design. Import preview reports identifier matches and possible matches without silently discarding records based on title or surname. You can keep existing sources, add selected separate copies, or explicitly update selected fields on one matched source. Updates preserve identity and linked notes, leave unselected local fields intact, and require a checked safety snapshot. No fields are selected automatically; replacing original CSL data replaces that whole field. By default, short notes run across the manuscript and never use ibid. An opt-in **Use repeat citation rules** setting in the Research panel lets you choose to show the full citation again once per section and to use "Ibid." for back-to-back repeats instead of a short note (`src/research/ResearchPanel.tsx:686`).
- **Writing aids are optional heuristics.** Prose checks can be wrong; they never correct text. Goals count manuscript sections only, and daily baselines reset by the local date. When a section has an extreme number of flagged words, only the issues nearest the cursor are shown (the panel says so) so typing stays responsive.
- **Quote insertion has a layout limit.** A citation inserted after a block quotation can appear after the block rather than inside its final paragraph. Review the placement before export.
- **Large projects can slow writing aids.** Goal and citation summaries currently recompute across the project during renders.
- **Markdown footnotes round-trip.** Markdown export writes footnotes as definitions, and Markdown import reads single- and multi-paragraph notes back with their positions and order (unit and browser tests). Word and PDF export now write a multi-paragraph footnote as separate paragraphs (task T043, repaired and independently reviewed on 2026-10-25; the Word rendering has not been checked in Word, and Word continuation paragraphs have no indent while PDF's are indented).
- **Version comparison works by paragraph.** It does not track changes word by word.
- **Comments attach to quoted text.** If two passages are identical, a comment may attach to the wrong one. If its passage is edited away, the comment is marked detached.
- **Exports omit some titles.** Word and PDF export do not print the project title or the section titles that Markdown, plain text and the bundle include.
- **Small known issues.** A confirmation message can cover the **Export PDF** button until it is closed. One error message for a project made by a newer version still says "Folio" (the app's earlier name; `src-tauri/src/store.rs`).
- **Fonts depend on your Mac.** The interface prefers Futura, then Avenir. No commercial fonts are included.
- **Saving is tested, not guaranteed.** Personal Word uses SQLite WAL with macOS `fullfsync=ON` and immediate transactions. Isolated native tests killed the app at checkpoints between asset staging and save, between the database commit and the portable copies, during a research-source merge and during a snapshot restore, and the project came back intact each time. On this Intel Mac a 100,000-word one-section save measured 116.57 / 130.43 / 124.37 ms at the 95th percentile at low load (budget 150 ms; earlier runs on a heavily loaded Mac took 347 to 499 ms). Apple silicon is unmeasured. Sudden power loss, a kernel panic or disk failure cannot be guaranteed against; keep external backups.

## For developers

- [Architecture and how saving works](docs/architecture.md)
- [Feature guide](docs/personal-word-v2.md)
- [Validation record](docs/validation.md)
- [Contributing](CONTRIBUTING.md) and [security reporting](SECURITY.md)
- [Third-party licenses](THIRD_PARTY.md)

The app uses Tauri 2, React, TypeScript, the Tiptap editor, and Rust with SQLite. Run the checks with:

```sh
npm run build
npm test
npm run test:e2e
cargo test --manifest-path src-tauri/Cargo.toml
```

Some internal names still say `folio`, from the app's earlier name. They keep existing projects readable. Do not rename them without a data migration.

## License

GPL-3.0-only. See [LICENSE](LICENSE).
