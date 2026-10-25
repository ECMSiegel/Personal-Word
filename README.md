# Personal Word

**A private writing app for the Mac, built for research papers.** Write in sections, keep your sources beside the draft, insert Chicago-style footnotes, and export to Word or PDF. Your writing is stored on your Mac. Citation lookup is optional and contacts external services.

## Quick start

**You need a Mac.** There is no app download yet; these steps run Personal Word from source.

### 1. Install the prerequisites

Install [Node.js 22](https://nodejs.org) and [Rust](https://rustup.rs). Then open **Terminal** and install Apple's command line tools if you do not already have them:

```sh
xcode-select --install
```

Wait for installation to finish before continuing.

### 2. Download and run

Run these commands in Terminal, one line at a time:

```sh
git clone https://github.com/ECMSiegel/Personal-Word.git
cd Personal-Word
npm ci
npm run tauri dev
```

The first launch compiles the app and can take a few minutes. When the window opens, choose **Start new project**, then **Chicago student paper**, and start writing. Keep Terminal open while using this development version.

### 3. Build a standalone app (optional)

Close the app and press **Control+C** in Terminal to stop the development command, then run:

```sh
npm run tauri build
open src-tauri/target/release/bundle/macos
```

The folder contains **Personal Word.app**, which you can copy to Applications. It is unsigned and not notarized, so macOS may warn you when opening it.

For a browser-only preview, run `npm run dev` and open `http://localhost:1420`. **Browser writing is stored separately from the Mac app's database.**

> **Beta.** Personal Word is early software for local writing. Keep your own backups, and read [Limitations](#limitations) before trusting it with work you cannot replace.

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
| **Tested on** | Intel macOS 15 automated checks; Intel and Apple silicon real-use checks confirmed by the owner ([results](docs/agent-work/2026-10-24-team-reconciliation/OWNER_TEST_RESULTS.md)) |
| **Not yet hand-tested** | Older macOS versions |
| **Not supported** | Windows, Linux, iPad, phones |

There is no downloadable app. Building from source produces `Personal Word.app`; a fresh local build was recorded on 2026-10-25 and the owner has confirmed the real-use checks passed. The build is not signed or notarized by Apple, so macOS may warn you the first time you open it.

Signing and downloadable distribution were removed from beta scope on 2026-10-23; the retained preparation work and gates are recorded in [Mac distribution status](docs/distribution.md). Prepared [third-party notices](src-tauri/resources/THIRD_PARTY_NOTICES.txt) and license texts still await distribution review.

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

## Beta status

Personal Word 0.1.1 is **beta**. Gate D passed automated acceptance, and on 2026-10-25 the owner confirmed personally completing all nine real-use checks successfully. Those owner gates are now VERIFIED by owner report. See the [owner results](docs/agent-work/2026-10-24-team-reconciliation/OWNER_TEST_RESULTS.md) for the confirmation and its scope, and the [validation record](docs/validation.md) for automated counts, run IDs and binary hashes.

The nine checks covered keyboard editing and comment navigation, blocked-close retry, recovered images, pre-restore safety copies, Microsoft Word rendering, Apple silicon, VoiceOver and input methods, a long writing session, and native WebKit light/dark visuals. The app remains unsigned and unpublished. Known limitations below still apply; passing these checks does not establish physical power-loss safety.

All four [board questions](team/QUESTIONS.md) were resolved on 2026-10-25: the reviewed board copies supersede the stray WP8 work; the off-board orchestrator was stopped and its folder archived; the zip-header inflation limit was accepted for this beta; and the legacy PDF exporter remains in use, with WP9/WP10 cancelled. A bundled open-licence Arabic body font and a new probe are the recorded route to reconsider native print later. Signing and downloadable distribution were removed from beta scope by the owner on 2026-10-23. Hosted CI has not been qualified. See the [roadmap](ROADMAP.md) for future work.

## Limitations

- **Page breaks differ between views.** The editor's page view, PDF export, and Word export each lay out pages differently. Expect page breaks to move; exact page parity is not promised. **Preview PDF** shows the same PDF exporter's output. An exact print-engine preview does not exist: a native WebKit print probe was tried and stopped, because Arabic text containing the lam-alef ligature (for example السلام) could not be searched in its PDF with 26 of the 28 installed fonts tried, so the PDF exporter below remains the only PDF path. The probe exists only in a diagnostic build, and the owner chose to keep the legacy exporter and leave exact native PDF preview and flowing per-page footnotes cancelled (Q004).
- **PDF uses bundled fonts.** PDF export draws with bundled Noto fonts, not the fonts on your Mac. It covers Latin, Greek, and Cyrillic scripts. Other scripts are refused with a message, so use Word export for them. A footnote too long to fit on one page is also refused rather than cut off. PDF tables do not repeat the header row on continuation pages (Word export marks the header row to repeat, confirmed by the owner in Word). PDF stacks consecutive images with no gap. Multi-paragraph footnotes are split into separate paragraphs in PDF and Word (task T043, repaired and reviewed; owner-confirmed in Word).
- **Citation help covers common sources.** Books, journal articles, and websites are supported. The current development source also formats bounded examples for print edited-book chapters, ProQuest PhD dissertations, signed online newspaper articles, broadcast audio interviews and online TED Talks. Those examples have browser-preview and generated-export checks; they do not cover every subtype. Other imported records retain raw fields and offer manual citation forms. Full audio/video notes with specific time references currently require manual text. Lookup results can be wrong or incomplete. Check every citation and your instructor's rules yourself.
- **Imports.** Plain text and Markdown files (up to 5 MB) keep their structure, but images, tables and raw HTML inside them arrive as visible literal text with a warning. HTML, Word (.docx) and Markdown-with-images (.zip) bundle files (up to 20 MB) import headings, lists, links, notes, rectangular tables and PNG/JPEG images through a preview dialog. They check the zip's declared sizes before unpacking, parse HTML without running it, and never fetch an outside image (it is omitted with a warning). Cancel creates nothing. A bundle's checksums are verified on import. Merged or nested table cells are not supported. A zip whose headers understate an entry's size is rejected only after that entry is unpacked, so a hostile file can cost memory first (accepted by the owner as a documented beta limit in Q003). **Cancel import** discards the result of a slow parse and creates nothing; abandoning the dialog some other way, such as leaving the screen, is not covered. The XML check refuses only external DOCTYPE declarations. The import button label says "up to 20 MB" for every format, including the 5 MB text limit.
- **Zotero and bibliography import.** Supports CSL JSON, BibTeX (.bib, .bibtex), and an optional Zotero refresh that is off by default, read-only, and limited to your own Mac (127.0.0.1:23119); every change goes through the review dialog. In the BibTeX importer a "Jr." suffix is kept only in the raw record, not in the formatted creator name. The refresh has no polling, no incremental updates, no handling of items deleted in Zotero, and no distinct "Zotero is off" message; it has never been run against a real Zotero. In the browser preview a different code path fetches the data, which was not approved as part of the design. Import preview reports identifier matches and possible matches without silently discarding records based on title or surname. You can keep existing sources, add selected separate copies, or explicitly update selected fields on one matched source. Updates preserve identity and linked notes, leave unselected local fields intact, and require a checked safety snapshot. No fields are selected automatically; replacing original CSL data replaces that whole field. By default, short notes run across the manuscript and never use ibid. An opt-in **Use repeat citation rules** setting in the Research panel lets you choose to show the full citation again once per section and to use "Ibid." for back-to-back repeats instead of a short note (`src/research/ResearchPanel.tsx:686`).
- **Writing aids are optional heuristics.** Prose checks can be wrong; they never correct text. Goals count manuscript sections only, and daily baselines reset by the local date. When a section has an extreme number of flagged words, only the issues nearest the cursor are shown (the panel says so) so typing stays responsive.
- **Quote insertion has a layout limit.** A citation inserted after a block quotation can appear after the block rather than inside its final paragraph. Review the placement before export.
- **Large projects can slow writing aids.** Goal and citation summaries currently recompute across the project during renders.
- **Markdown footnotes round-trip.** Markdown export writes footnotes as definitions, and Markdown import reads single- and multi-paragraph notes back with their positions and order (unit and browser tests). Word and PDF export now write a multi-paragraph footnote as separate paragraphs (task T043, repaired and independently reviewed on 2026-10-25; the Word rendering was confirmed by the owner, and Word continuation paragraphs have no indent while PDF's are indented).
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
# Recorded qualification used Node v22.23.3. If available locally:
export PATH="$PWD/node_modules/.cache/personal-word-alpha-review/tools/node-v22.23.3-darwin-x64/bin:$PATH"
node --version
npm run build
npm test -- --no-file-parallelism --maxWorkers=1
PLAYWRIGHT_PREVIEW=1 npm run test:e2e -- --workers=1
cargo test --locked --offline --manifest-path src-tauri/Cargo.toml --jobs 1 -- --test-threads=1
```

Without `PLAYWRIGHT_PREVIEW=1`, `npm run test:e2e` starts the development server. The board qualified the production preview only; build first as above. The pinned Node path is a local cache, not included in a fresh clone; otherwise install Node v22.23.3 separately to reproduce that runtime.

For the isolated native beta checks, build the diagnostic app first, then run the two suites serially:

```sh
npm run tauri build -- --debug --features native-smoke --no-bundle --config '{"identifier":"com.folio.smoke"}'
python3 scripts/native-reliability.py --suite baseline
python3 scripts/native-reliability.py --suite beta
python3 scripts/verify-beta-evidence.py --evidence docs/agent-work/2026-10-20-beta-roadmap/06-durability/EVIDENCE.json --source-manifest docs/agent-work/2026-10-20-beta-roadmap/06-durability/SOURCE_MANIFEST.json
```

The evidence verifier checks recorded evidence and source identity; it does not run the suites. Exit 0 means the recorded evidence and owner reports are consistent; exit 2 means required outcomes are still incomplete. The nine owner confirmations are now recorded as passed. Local evidence/build artifacts are required and are not shipped in Git; a fresh clone cannot verify the original local run without them. Rebuild the normal app without diagnostic features before owner testing.

Some internal names still say `folio`, from the app's earlier name. They keep existing projects readable. Do not rename them without a data migration.

## License

GPL-3.0-only. See [LICENSE](LICENSE).
