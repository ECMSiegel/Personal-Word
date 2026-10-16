# Personal Word: writing workspace update

## Delivered workflows

- Project library: compact rows, cards, template menu, sorting by name/added/edited with direction control.
- Multiple open project tabs; default startup is Projects. Settings can restore the open tab session.
- Resizable sidebar with global pin/hover preferences, per-project feature order and list/card preferences. Keyboard controls supplement dragging and hovering.
- Fonts, sizes, line spacing, paragraph spacing, paper size, margins, zoom, and explicit page breaks. View changes preserve the mounted editor and undo stack.
- Editable page view uses actual CSS multicolumn fragmentation. Pages are arranged horizontally. Count and current page refer to the open section, not an exported full manuscript.
- Templates: blank, essay, Chicago student paper, screenplay, story, and user-saved structure/settings templates. Blank writing defaults to sans serif. Chicago uses 12 pt serif, double spacing, one-inch margins, half-inch first-line indentation, editable title-page fields, notes, bibliography, and page numbers. Screenplay has named paragraph styles and Tab/Shift-Tab cycling.
- Research: source records, quotations, paraphrases, personal notes, locators, and insertion into the editor. Footnote references retain stable IDs and are numbered in manuscript order.
- Chicago 18 citation assistance for common books, journal articles, and websites; full/short notes and a cited-source bibliography. Review complicated names, unusual source types, and institutional instructions manually. Official references are linked in the app.
- Word export produces editable native footnotes; PDF export includes page-bottom notes and an in-app PDF preview.
- Comments and revision tasks can quote selected text. They remain available and are marked detached when their quoted passage disappears.
- Fragments have tags, search across saved projects, side-by-side browsing, copy with remapped research references, and placement history.
- Snapshot comparison highlights changed paragraphs side by side; restore a section or a paragraph with a safety snapshot first.
- Read manuscript has independent typeface, size, and line-spacing controls and displays note markers and notes.

## Important boundaries

This is an initial implementation of the expanded workspace, not publication-ready word-processing parity.

1. Editor pages, PDF, and Word use different layout engines. Their page breaks and font metrics can differ. The editor does not lay footnote bodies into its paper margins; use the research panel for note editing and PDF preview for exported placement.
2. PDF currently uses standard Latin fonts, substitutes the document font family, and rejects unsupported Unicode, overlong unbreakable words, or footnotes that exceed a page. Word export is the alternative for these cases. Long footnotes are not silently truncated.
3. Revision comparison is paragraph-based, not a word-level tracked-changes engine. Restoring a passage replaces the paragraph at the same index. The interface states that behavior.
4. Comment anchors use quoted text rather than a full operational-transform anchoring system. Repeated identical passages can be ambiguous; changed or removed quotes are labeled detached.
5. Font families depend on fonts installed on the Mac. No proprietary Futura files are bundled.
6. Cross-project fragment search reads saved projects; it does not index damaged recovery journals.
7. The app remains local-only and unsigned/not notarized. No cloud sync, collaboration, subscription, or licensing system was added.

## Data compatibility

Project and entry metadata are additive optional fields. Frontend validation shares the editor extensions; native validation recognizes text-format marks, page breaks, and footnote references. Rust structs flatten extra metadata so settings/research/annotations survive the SQLite header/body split, journals, snapshots, and mirrors. The existing database schema is retained.

The historical identifier `com.folio.writing`, localStorage prefixes, event names, and Rust executable/library names remain stable intentionally. These must not be renamed as a cosmetic cleanup. The display name, HTML title, npm package name, documentation, and app icon are Personal Word.

## Branding and cleanup

`app-icon.svg` is the source for the black P / blue W on white. Regenerate desktop assets using `npm run tauri icon app-icon.svg`; omit generated Android/iOS/Windows Store variants from this Mac project. Preserve the current release bundle and remove superseded Folio bundles only after the new release builds successfully. Source history remains in Git; user writing is never cleanup material.

## Verification

Use the current test output in docs/validation.md. The browser suite covers project operations, recovery, live appearance, research insertion/export, tabs, and page reflow/undo. Native Rust tests include extended metadata round trips. `scripts/native-smoke.py` launches an isolated smoke app and checks WebKit editor interaction, quit/restart, SQLite integrity, snapshots, and portable mirrors. It must run against a freshly built smoke binary.

Read AGENTS.md before future implementation work.
