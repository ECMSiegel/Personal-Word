# Personal Word: writing workspace update

## Delivered workflows

- Project library: compact rows, cards, template menu, sorting by name/added/edited with direction control.
- Import writing accepts UTF-8 `.txt` and Markdown (`.md`, `.markdown`) files up to 5 MB, previews the file name, format, excerpt, and warnings, and only creates a new project when Import is chosen; Cancel changes nothing and the source file is untouched. Markdown headings, emphasis, strong, strike, links, nested lists, quotes, and code import into the editable schema; images, tables, relative links, and raw HTML are kept as visible literal text with a warning and nothing remote is fetched. Full-project JSON recovery remains separate.
- Multiple open project tabs; default startup is Projects. Settings can restore the open tab session.
- Resizable sidebar with global pin/hover preferences, per-project feature order and list/card preferences. Keyboard controls supplement dragging and hovering.
- Fonts, sizes, line spacing, paragraph spacing, paper size, margins, zoom, and explicit page breaks. View changes preserve the mounted editor and undo stack.
- Editable page view uses actual CSS multicolumn fragmentation. Pages are arranged horizontally. Count and current page refer to the open section, not an exported full manuscript. Export pagination is independent.
- Templates: blank, essay, Chicago student paper, screenplay, story, and user-saved structure/settings templates. Blank writing defaults to sans serif. Chicago uses 12 pt serif, double spacing, one-inch margins, half-inch first-line indentation, editable title-page fields, notes, bibliography, and page numbers. Screenplay has named paragraph styles and Tab/Shift-Tab cycling.
- Research: two tabs. Sources holds each work with its Chicago note/bibliography preview, its quotes and paraphrases, and the footnotes that cite it (Cite here, Insert quote + cite); footnotes without a source are listed as text-only notes. Notes holds loose personal notes. Footnote references retain stable IDs and are numbered in manuscript order; clicking a reference opens its source.
- Citation lookup: paste a DOI (Crossref), ISBN (Open Library), or web address (page metadata) and the fields fill in as a draft to review. Nothing is sent until Look up is clicked, and only the typed identifier is sent.
- Writing screen: section title lives in the top bar; one-row formatting toolbar (zoom, style, font, size, marks, link, lists, indent, spacing popover, page view, page setup popover, comment, keep as fragment) that folds trailing groups into a More menu when narrow; page count in the status line. Tab/Shift-Tab indent like Word (lists nest; paragraph start sets a first-line indent; otherwise the paragraph moves 0.5 in). Fragments and Research side panels are resizable (width stored globally). All dropdowns use the flat in-app Dropdown component instead of native selects.
- Chicago 18 citation assistance for common books, journal articles, and websites; full/short notes and a cited-source bibliography. Review complicated names, unusual source types, and institutional instructions manually. Official references are linked in the app.
- Word export produces editable native footnotes; PDF export includes page-bottom notes and an in-app PDF preview.
- Comments and revision tasks can quote selected text. They remain available and are marked detached when their quoted passage disappears.
- Fragments panel is a split view: each fragment is shown in full and editable beside the main editor (read-only if it is the entry open in the main editor), with Insert at cursor, Append to section, Open in editor, tags, and delete.
- Fragments have tags, search across saved projects, side-by-side browsing, copy with remapped research references, and placement history.
- Snapshot comparison highlights changed paragraphs side by side; restore a section or a paragraph with a safety snapshot first.
- Read manuscript has independent typeface, size, and line-spacing controls and displays note markers and notes.

## Important boundaries

This is an initial implementation of the expanded workspace, not publication-ready word-processing parity.

1. Editor pages, PDF, and Word use different layout engines. Their page breaks and font metrics can differ. The editor shows footnote text below the section in continuous view and at the bottom of the page holding each reference in page view; notes are editable in place. Page view reserves the same footnote space on every page (the tallest page's notes), so pages without notes keep extra bottom space, and very long notes are not split across pages. PDF and Word place notes with their own engines.
2. PDF draws with bundled Noto Serif, Noto Sans, and Noto Sans Mono subsets instead of the fonts installed on the Mac, so its typeface only approximates the document font. It covers Latin, Latin Extended, Greek, and Cyrillic; other scripts are rejected with a clear message, and Word export is the alternative. Oversized words and URLs are split at Unicode code-point boundaries, which prevents character loss but does not provide typographic hyphenation. A footnote that cannot fit on one page is reported instead of truncated.
3. Revision comparison is paragraph-based, not a word-level tracked-changes engine. Restoring a passage replaces the paragraph at the same index. The interface states that behavior.
4. Comment anchors use quoted text rather than a full operational-transform anchoring system. Repeated identical passages can be ambiguous; changed or removed quotes are labeled detached.
5. Font families depend on fonts installed on the Mac. No proprietary Futura files are bundled.
6. Cross-project fragment search reads saved projects; it does not index damaged recovery journals.
7. The app is unsigned/not notarized and stores everything locally. Citation lookup is the only network use and is opt-in per click; Crossref/Open Library/site metadata can be incomplete or wrong, so results are drafts to review. Web page lookup in the browser preview often fails because sites block cross-origin reads. No cloud sync, collaboration, subscription, or licensing system was added.

## Data compatibility

Project and entry metadata are additive optional fields. Frontend validation shares the editor extensions; native validation recognizes text-format marks, page breaks, and footnote references. Rust structs flatten extra metadata so settings/research/annotations survive the SQLite header/body split, journals, snapshots, and mirrors. The existing database schema is retained.

The historical identifier `com.folio.writing`, localStorage prefixes, event names, and Rust executable/library names remain stable intentionally. These must not be renamed as a cosmetic cleanup. The display name, HTML title, npm package name, documentation, and app icon are Personal Word.

## Branding and cleanup

`app-icon.svg` is the source for the black P / blue W on white. Regenerate desktop assets using `npm run tauri icon app-icon.svg`; omit generated Android/iOS/Windows Store variants from this Mac project. Preserve the current release bundle and remove superseded Folio bundles only after the new release builds successfully. Source history remains in Git; user writing is never cleanup material.

## Verification

Use the current test output in docs/validation.md. Browser tests use browser preview storage and do not prove native SQLite persistence. Native Rust tests include extended metadata round trips and instance-lock behavior. `scripts/native-smoke.py` launches an isolated smoke app and checks WebKit editor interaction, quit/restart, SQLite integrity, snapshots, and portable mirrors when the desktop session permits; consult the dated validation entry for the latest result.

Read AGENTS.md before future implementation work.
