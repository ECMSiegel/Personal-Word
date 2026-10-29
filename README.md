# Personal Word

**A free, open-source writing app for the Mac, built for long writing.** I write in sections, keep my sources beside the draft, drop in Chicago-style footnotes, and export to Word or PDF when I'm done. Everything stays on my own Mac.

![Personal Word's writing screen: a manuscript section open, the sidebar on the left](docs/evidence/readme/writing-light.png)

## Why I made it

Word and Google Docs are not built for long writing. Once a paper runs to dozens of pages with sources, notes and drafts, they turn into one endless scroll and a pile of separate files. The apps that do handle long writing well are not open source, and most of them cost money.

I wanted something that worked well and was free, so I built it. Personal Word is for the people: anyone writing something long, whether a paper, a thesis chapter, an essay or a book, who wants a good tool without paying for one or handing their writing to someone else's server.

## Features

**Built for long pieces, not single pages**
- **Write in sections.** My manuscript is a list of sections in the sidebar. I open one at a time, reorder them by dragging, and never scroll through 80 pages to find a paragraph.
- **Fragments.** When I cut a passage I am not sure about, it goes to Fragments instead of disappearing. I can put it back into a section later.
- **Two things side by side.** I can open two sections, a fragment, or a source's PDF next to the draft, each in its own pane with its own page count and word count.
- **Real pages when I want them.** Page view stacks the section as actual pages at any zoom. Paragraphs split across a page break the way Word does them, and footnotes sit at the bottom of their page.

**Research lives next to the writing**
- **Sources in the same window.** I paste a DOI, ISBN or web address and Personal Word looks the source up. I can also enter it by hand or import from Zotero (CSL JSON or BibTeX).
- **Chicago footnotes without the fuss.** "Cite here" drops a numbered footnote in the right Chicago 18 format. Later citations of the same source shorten automatically, and the bibliography builds itself.
- **Quotes with their page numbers.** "Capture quote" saves a passage with its page and inserts the quotation and the citation together.
- **PDFs beside the draft.** I attach a source's PDF and read it in the second pane while I write.

**Safe with my work**
- **Saves as I type**, with crash recovery.
- **Snapshots and history.** Before a big revision I take a snapshot. I can compare versions side by side and restore one section or a single paragraph.
- **Mine, on my Mac.** No account, no subscription, no cloud. The only time it touches the internet is when I ask it to look up a citation.
- **Easy to get out.** Word (with real footnotes), PDF, Markdown and plain text exports, plus a full-project backup file.

**Calm to write in**
- A quiet, flat design that follows macOS light and dark mode, with a Plain or Color palette.
- Focus mode dims everything but the paragraph I'm writing and hides the toolbar until I reach for it.
- Word and daily goals with a deadline, an optional on-device prose check, and keyboard shortcuts I can change.

| My sources beside the draft | Page view in dark mode |
| --- | --- |
| ![Research panel open beside the draft](docs/evidence/readme/research-light.png) | ![Page view in dark mode, two pages stacked](docs/evidence/readme/writing-dark.png) |

## Quick start

**You need a Mac.** I haven't published a download yet, so these steps build Personal Word from source.

1. **Install the tools.** Install [Node.js 22](https://nodejs.org) and [Rust](https://rustup.rs). Then open **Terminal** and install Apple's command line tools if you don't have them:

   ```sh
   xcode-select --install
   ```

2. **Download and run it.** In Terminal, one line at a time:

   ```sh
   git clone https://github.com/ECMSiegel/Personal-Word.git
   cd Personal-Word
   npm ci
   npm run tauri dev
   ```

   The first launch takes a few minutes while it builds. When the window opens, choose **Start new project**, then **Chicago**, and start writing.

3. **Make a real app (optional).** Stop the command above with **Control+C**, then:

   ```sh
   npm run tauri build
   open src-tauri/target/release/bundle/macos
   ```

   Drag **Personal Word.app** into Applications. It isn't signed by Apple yet, so the first time you open it macOS may warn you. If it does, allow it under **System Settings > Privacy & Security**.

The [user guide](docs/user-guide.md) walks through a whole paper: projects, sections, sources, citations, snapshots and export.

## Good to know

- **It's beta.** I use it for real writing, but keep your own backups. The download icon at the top right saves a complete copy of a project. Known gaps are listed in [Limitations](docs/limitations.md).
- **Mac only.** Windows, Linux, iPad and phones are not supported.
- **Where it keeps your writing:** each project is a folder in the Mac's app-data area (look under `com.folio.writing`). **Settings > Show path** shows the exact folder. To back up, quit the app and copy the folder.
- **What it isn't:** a full replacement for Microsoft Word. There are no tracked changes, live collaboration or merged table cells.

## For developers

Tauri 2, React, TypeScript, the Tiptap editor, and Rust with SQLite. How to run the tests, the architecture and how saving works are in [Developing Personal Word](docs/development.md). See also [Contributing](CONTRIBUTING.md), the [changelog](docs/changelog.md) and the [validation record](docs/validation.md).

## License

Free and open source under GPL-3.0-only. See [LICENSE](LICENSE) and the [third-party notices](THIRD_PARTY.md).
