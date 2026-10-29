# Personal Word user guide

The step-by-step guide that used to live in the README. For the short version, see the [README](../README.md).

## A short workflow

1. **Start a project.** On the Projects screen, choose **Start new project**, then **Chicago**. The template sets 12-point serif type, double spacing, one-inch margins, and a title page. Blank and Screenplay are offered too; Essay and Story are hidden from the menus, and projects already created from them still open.
2. **Write in sections.** The sidebar lists the paper's sections. Click one to open it, and add more with the **+** button beside Manuscript. Drag a section or a sidebar group to reorder it, or use the arrow buttons that appear on hover or keyboard focus. The toolbar's **Page view** stacks the section as pages and splits a paragraph across a page break the way Word does, keeping at least two lines on each page.
3. **Add a source.** Open **Research** in the sidebar. Paste a DOI, ISBN, or web address and choose **Look up**, choose **Enter manually**, or import a local Zotero **CSL JSON** or **BibTeX** (.bib) export. Review the preview before adding sources. The panel shows the Chicago note and bibliography entry as you type.
4. **Cite it.** Put the cursor where the note belongs and choose **Cite here**. A numbered footnote appears in the text and at the bottom of the page. New projects shorten repeated citations automatically; existing projects keep that option off until enabled. Choose a Short title and override a note to Always full or Always short when needed. **Capture quote** saves a passage with its page and can insert both quotation and citation together.
5. **Take a snapshot.** Before a big revision, choose **Snapshot** at the top right and name it. **Snapshots & history** lets you compare versions side by side and restore a section or a single paragraph.
6. **Export.** Open **Settings** in the sidebar and scroll to **Export document**. Choose **Export DOCX** for an editable Word file with real footnotes, or **Export PDF**. **Export Markdown** and **Export plain text** include the whole project, including notes, fragments, and research notes. **Markdown with images (.zip)** adds the pictures and a checksum manifest, and can be imported again.

**Bibliography.** The Research part of the sidebar lists **Bibliography** and then every source, with research notes under **Notes**. Bibliography appears only when it means something: for a project started from the **Chicago** template, or once the project has a source or a footnote that cites one; otherwise the entry is hidden. The page is read-only: choose the entry order (Alphabetical by author, Order first cited, By source type) and whether to include uncited sources. The choice is saved with the project and used by Word, PDF, Markdown and plain-text export. **Read manuscript** ends with the same Bibliography.

**PDFs.** Attach a PDF (up to 25 MB) to a source in Research and open it beside the draft. PDFs are stored in the project folder and are never fetched from the internet; they are not carried inside the project's `.json` archive or the Markdown bundle (see [Limitations](limitations.md)).

**Open a section or a fragment beside the draft.** Cmd+click its sidebar row, or use the **Open beside** button that appears on hover or keyboard focus. Drag the divider to change the split; the width ratio is remembered, and each pane edits its own entry, so you can type in both. Opening or closing a split keeps the left pane's undo history and scroll position, and both panes line their pages up under matching headers.

The **Projects** screen has a search button that opens a field and filters the list by title. **Start new project** opens a panel listing the templates, then **Import a file…** and **Recover from a project.json file…**. The **gear** at the right of the display row opens **Settings** without leaving Projects. You can also drag one `.txt`, `.md`, `.docx`, `.html` or `.zip` file onto the Projects screen to open the import preview, or choose **Import writing** for the same picker from the keyboard; Cancel creates nothing.

**Appearance:** in **Settings > General**, choose Appearance (System, Light or Dark) and Palette (Plain or Color). Cmd/Ctrl+Shift+L switches between Light and Dark. System follows macOS live; Color adds section tints in the sidebar and colored buttons without changing the document area.

Set manuscript/daily word goals and a deadline in **Settings > Goals**. **Settings > Shortcuts** lists every shortcut the app binds and lets you change the ones it owns; menu hints follow your changes. The toolbar offers **Focus mode** (Cmd/Ctrl+Shift+F) and an optional local **Prose check** with a keyboard-accessible issue list.

The app saves as you type. The download icon at the top right saves a complete copy of the project as a `.json` file, which is useful as a backup.

## Where your writing lives

Each project is stored in its own folder in your Mac's application-data area, under the name `com.folio.writing`. In **Settings**, choose **Show path** next to Storage location to see the exact folder. Each folder holds a SQLite database, which is the real copy, plus readable JSON and plain-text copies.

To back up, quit the app and copy the whole project folder somewhere else. The only time the app uses the internet is when you choose **Look up** for a citation. It sends the DOI or ISBN you entered to Crossref or Open Library, or fetches the web page you named. A DOI found in that page’s metadata may trigger a follow-up request to Crossref. The optional Zotero refresh (off by default) talks only to Zotero on your own Mac.

## Beta status

Personal Word 0.1.1 is **beta**. Gate D passed automated acceptance, and on 2026-10-25 the owner confirmed personally completing all nine real-use checks successfully. Those owner gates are VERIFIED by owner report. See the [owner results](agent-work/2026-10-24-team-reconciliation/OWNER_TEST_RESULTS.md) for the confirmation and its scope, and the [validation record](validation.md) for automated counts, run IDs and binary hashes.

The nine checks covered keyboard editing and comment navigation, blocked-close retry, recovered images, pre-restore safety copies, Microsoft Word rendering, Apple silicon, VoiceOver and input methods, a long writing session, and native WebKit light/dark visuals. See the [roadmap](../ROADMAP.md) for future work.

