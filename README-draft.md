# Personal Word

**A private writing app for the Mac, built for research papers.** Write in sections, keep your sources beside the draft, insert Chicago-style footnotes, and export to Word or PDF. Everything stays on your computer.

> **Alpha.** Personal Word works for daily writing, but it is early software. Keep your own backups, and read [Limitations](#limitations) before trusting it with work you cannot replace.

![A Chicago-style paper open in Personal Word, with a footnote at the bottom of the page](docs/evidence/readme/writing-light.png)

## Who it is for

Personal Word is for someone writing a long piece with sources: a student paper, a thesis chapter, an essay, or a book-length draft. It suits writers who:

- cite in **Chicago notes and bibliography** style, or follow a Turabian-style student paper layout;
- want their research notes, quotations, and sources **in the same window** as the draft;
- want their writing **stored on their own Mac**, with no account, subscription, or cloud service.

It also includes story and screenplay templates. It is not a replacement for Microsoft Word. It does not handle images, complex tables, collaboration, or tracked changes.

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
3. **Add a source.** Open **Research** in the sidebar. Paste a DOI, ISBN, or web address and choose **Look up**, or choose **Enter manually**. The panel shows the Chicago note and bibliography entry as you type.
4. **Cite it.** Put the cursor where the note belongs and choose **Cite here**. A numbered footnote appears in the text and at the bottom of the page.
5. **Take a snapshot.** Before a big revision, choose **Snapshot** at the top right and name it. **Snapshots & history** lets you compare versions side by side and restore a section or a single paragraph.
6. **Export.** Open **Settings** in the sidebar and scroll to **Export document**. Choose **Export DOCX** for an editable Word file with real footnotes, or **Export PDF**.

The app saves as you type. The download icon at the top right saves a complete copy of the project as a `.json` file, which is useful as a backup.

## Where your writing lives

Each project is stored in its own folder in your Mac's application-data area, under the name `com.folio.writing`. In **Settings**, choose **Show path** next to Storage location to see the exact folder. Each folder holds a SQLite database, which is the real copy, plus readable JSON and plain-text copies.

To back up, quit the app and copy the whole project folder somewhere else. The only time the app uses the internet is when you choose **Look up** for a citation. It then sends only the identifier you typed, to Crossref, Open Library, or the web page you named.

## Alpha status

What has been checked, as of October 2026:

- **Automated tests** cover saving, crash recovery journals, imports, exports, and the main writing journeys in a browser.
- **Saving at scale** was measured on a 100,000-word project. The app's own work per keystroke measured under a millisecond, and a database save about 9 milliseconds. Screen drawing time is not included. See the [validation record](docs/validation.md).
- **A full test inside the real Mac app** passed on October 16. The most recent attempt on October 17 timed out before its first checkpoint, with macOS system-service errors in its log. Current native behaviour is therefore not freshly confirmed.

Not done yet:

- No signed, notarized download.
- No check of exported files in Microsoft Word or LibreOffice. Exports were inspected as files and in macOS Quick Look only.
- No VoiceOver, input-method, or forced-shutdown testing in the Mac app.

The [roadmap](ROADMAP.md) lists what comes next.

## Limitations

- **Page breaks differ between views.** The editor's page view, PDF export, and Word export each lay out pages differently. Expect page breaks to move.
- **PDF uses bundled fonts.** PDF export draws with bundled Noto fonts, not the fonts on your Mac. It covers Latin, Greek, and Cyrillic scripts. Other scripts are refused with a message, so use Word export for them. A footnote too long to fit on one page is also refused rather than cut off.
- **Citation help covers common sources.** Books, journal articles, and websites are supported. Lookup results come from outside services and can be wrong or incomplete. Check every citation and your instructor's rules yourself.
- **Imports are text only.** You can import a plain-text or Markdown file up to 5 MB as a new project. Images, tables, and raw HTML in Markdown arrive as plain text. Word files cannot be imported.
- **Version comparison works by paragraph.** It does not track changes word by word.
- **Comments attach to quoted text.** If two passages are identical, a comment may attach to the wrong one. If its passage is edited away, the comment is marked detached.
- **Fonts depend on your Mac.** The interface prefers Futura, then Avenir. No commercial fonts are included.
- **Saving is careful, not guaranteed.** The app keeps a recovery journal and history, but a power cut or a forced shutdown at the wrong moment has not been tested in the Mac app.

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
