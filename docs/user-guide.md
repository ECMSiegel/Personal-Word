# Personal Word user guide

The step-by-step guide that used to live in the README. For the short version, see the [README](../README.md).

## A short workflow

1. **Start a project.** On the Projects screen, choose **Start new project**, then **Chicago**. The template sets 12-point serif type, double spacing, one-inch margins, and a title page. Blank and Screenplay are offered too; Essay and Story are hidden from the menus, and projects already created from them still open.
2. **Write in sections.** The sidebar lists the paper's sections. Click one to open it, and add more with the **+** button beside Manuscript. Drag a section, a fragment, a source, a note or a sidebar group to reorder it, or focus it and press Option+Up or Option+Down to move it one place. The toolbar's **Page view** stacks the section as pages and splits a paragraph across a page break the way Word does, keeping at least two lines on each page.
3. **Add a source.** Open **Research** in the sidebar. Paste a DOI, ISBN, or web address and choose **Look up**, choose **Enter manually**, or import a local Zotero **CSL JSON** or **BibTeX** (.bib) export. Review the preview before adding sources. The panel shows the Chicago note and bibliography entry as you type.
4. **Cite it.** Put the cursor where the note belongs and choose **Cite here**. A numbered footnote appears in the text and at the bottom of the page. New projects shorten repeated citations automatically; existing projects keep that option off until enabled. Choose a Short title and override a note to Always full or Always short when needed. **Capture quote** saves a passage with its page and can insert both quotation and citation together.
5. **Take a snapshot.** Before a big revision, choose **Snapshot** at the top right and name it. **Snapshots & history** lets you compare versions side by side and restore a section or a single paragraph.
6. **Export.** Open **Settings** in the sidebar and scroll to **Export document**. Choose **Export DOCX** for an editable Word file with real footnotes, or **Export PDF**. **Export Markdown** and **Export plain text** include the whole project, including notes, fragments, and research notes. **Markdown with images (.zip)** adds the pictures and a checksum manifest, and can be imported again.

**Bibliography.** The Research part of the sidebar lists **Bibliography** and then every source, with research notes under **Notes**. Bibliography appears only when it means something: for a project started from the **Chicago** template, or once the project has a source or a footnote that cites one; otherwise the entry is hidden. The page is read-only: choose the entry order (Alphabetical by author, Order first cited, By source type) and whether to include uncited sources. The choice is saved with the project and used by Word, PDF, Markdown and plain-text export. **Read manuscript** ends with the same Bibliography.

**PDFs.** Attach a PDF (up to 25 MB) to a source in Research, or press **Upload PDF** in the Research panel to keep one that belongs to no source; it gets its own PDFs list. Open either beside the draft. PDFs are stored in the project folder and are never fetched from the internet; they are not carried inside the project's `.json` archive or the Markdown bundle (see [Limitations](limitations.md)).

**Open a section or a fragment beside the draft.** Cmd+click its sidebar row, or use the **Open beside** button that appears on hover or keyboard focus. Drag the divider to change the split; the width ratio is remembered, and each pane edits its own entry, so you can type in both. Opening or closing a split keeps the left pane's undo history and scroll position, and both panes line their pages up under matching headers.

**Fragments.** Select text and choose the scissor (**Keep as fragment**) to set it aside; with nothing selected the scissor, and **Comment** beside it, act on the paragraph the cursor is in. A fragment has no restore strip: to move its words into a section, open the fragment beside the draft (Cmd+click its row, or **Open beside** in its right-click menu) and copy and paste. The Fragments panel's **Append** action still adds a fragment to a section.

**Ruler and top gap.** Open **Page setup** (in More on a narrow window) and press **Ruler** to show a ruler above the page. Drag either triangle to change the page margin (both sides move together; the same margin your Word and PDF exports use, from 1/4 to 2 inches), or focus a triangle and use the arrow keys (Shift for bigger steps, Home and End for the limits). In continuous view a small handle also appears at the top of the text: drag it, or use Up and Down, to change the space above the first line. That gap is only on screen; exports ignore it. Cmd+Z does not undo a ruler drag.

**Sidebar look.** The section you are in is bold and the rest of its list stays dim until you point at a row, focus it or open it. Dragging a sidebar edge or the split divider shows no coloured line; the cursor changes instead. The word count is only at the bottom of the page.

**Line rail.** In list view each Manuscript, Fragments and Research group ends in a rail of short lines, one per item, in the same order as the rows. Click a line (or focus it and press Enter or Space) to open that item, and in Read mode to scroll to that section. The lines do not reorder anything: drag a row, or press Option+Up or Option+Down on it. Each line is one extra Tab stop after its group's rows.

**Find in project.** The field at the top of the sidebar filters its rows (Cmd+K focuses it; there is no hint written in the field). When it has text, a small **x** appears at its right to clear it and keep typing; Escape does the same without leaving the field.

**Floating sidebar and research.** In **Settings > Sidebar**, turn on **Floating sidebar and research** (off by default). When the page has wide margins, the sidebar then floats in the left margin as plain text on the page, without its own background, and the **Research** heading opens a small citation card in the right margin instead of the side panel. It never covers your text: if the window or the page is too narrow, you are in a split view, or a page such as Settings or Snapshots & history is showing, the usual sidebar and Research panel appear instead. If you widen the window while the panel is open, the card takes over again once there is room.

**The citation card.** Open Research (or click a footnote number in the text). Paste a DOI, ISBN or web address and choose **Look up**, or choose **Enter manually**; check the details, then choose **Cite here** to add a footnote where the cursor is. The card then lets you set the page and note form, **Add another** or finish with **Done**. After Cite here the cursor moves to the new footnote's text, just as with the panel. **Open full research panel** at the bottom of the card switches to the side panel. Escape closes the card.

**Command palette.** Press Cmd+Shift+P to search every action the app owns (Save, Take snapshot, New section and so on, each showing its shortcut), jump to any section or fragment with "Go to ...", or open Research, Comments, Snapshots & history, Settings or Read. Type to filter, use Up and Down, press Enter to run, Escape to close; your cursor returns to where it was. You can change the shortcut in **Settings > Shortcuts**.

**Right-click a sidebar row** (or press Shift+F10 on it) for Open, Open beside, Rename, Move up, Move down and Delete; on a group heading it offers Collapse or Expand and Move.

The **Projects** screen has a search button that opens a field and filters the list by title. **Start new project** opens a panel listing the templates, then **Import a file…** and **Recover from a project.json file…**. The **gear** at the right of the display row opens **Settings** without leaving Projects. You can also drag one `.txt`, `.md`, `.docx`, `.html` or `.zip` file onto the Projects screen to open the import preview, or choose **Import writing** for the same picker from the keyboard; Cancel creates nothing.

**Appearance:** in **Settings > General**, choose Appearance (System, Light or Dark) and Palette (Plain or Color). The sidebar options (reveal on hover, floating, and per project which of Read, Comments and History show) are together in **Settings > Sidebar**. Cmd/Ctrl+Shift+L switches between Light and Dark. System follows macOS live; Color adds section tints in the sidebar and colored buttons without changing the document area.

Set manuscript/daily word goals and a deadline in **Settings > Goals**. **Settings > Shortcuts** lists every shortcut the app binds and lets you change the ones it owns; menu hints follow your changes. The toolbar offers **Focus mode** (Cmd/Ctrl+Shift+F) and an optional local **Prose check** with a keyboard-accessible issue list.

The app saves as you type. The download icon at the top right saves a complete copy of the project as a `.json` file, which is useful as a backup.

## Where your writing lives

Each project is stored in its own folder in your Mac's application-data area, under the name `com.folio.writing`. In **Settings**, choose **Show path** next to Storage location to see the exact folder. Each folder holds a SQLite database, which is the real copy, plus readable JSON and plain-text copies.

To back up, quit the app and copy the whole project folder somewhere else. The only time the app uses the internet is when you choose **Look up** for a citation. It sends the DOI or ISBN you entered to Crossref or Open Library, or fetches the web page you named. A DOI found in that page’s metadata may trigger a follow-up request to Crossref. The optional Zotero refresh (off by default) talks only to Zotero on your own Mac.

## Beta status

Personal Word 0.1.1 is **beta**. Gate D passed automated acceptance, and on 2026-10-25 the owner confirmed personally completing all nine real-use checks successfully. Those owner gates are VERIFIED by owner report. See the [owner results](agent-work/2026-10-24-team-reconciliation/OWNER_TEST_RESULTS.md) for the confirmation and its scope, and the [validation record](validation.md) for automated counts, run IDs and binary hashes.

The nine checks covered keyboard editing and comment navigation, blocked-close retry, recovered images, pre-restore safety copies, Microsoft Word rendering, Apple silicon, VoiceOver and input methods, a long writing session, and native WebKit light/dark visuals. See the [roadmap](../ROADMAP.md) for future work.

