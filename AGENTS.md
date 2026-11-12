# Personal Word working principles

Personal Word is a Mac-first Tauri 2 app with React, TypeScript, Tiptap, and Rust/SQLite. Read README.md and docs/architecture.md before significant changes.

## Preserve writing
- Keep com.folio.writing, folio.* storage keys, and native event names compatible. These are historical persistence identifiers, not user-facing branding. Renaming them without migration can hide existing projects.
- Browser preview storage is separate from native SQLite. Browser tests never prove native persistence.
- Project metadata and Entry metadata must survive native serialization, incremental saves, recovery journals, snapshots, imports, and exports. Rust flattened metadata maps preserve additive fields.
- Use immutable project mutations with increasing revisions and SaveQueue. Flush before switching/closing projects. Take a safety snapshot before restoration or destructive edits.
- Share the editor schema with import validation. Extend the Rust rich-text allowlist when adding nodes or marks.
- Never delete user projects or recovery data to make tests pass. Use isolated test storage.

## Product and UI
- Read docs/design-system.md before changing any CSS.
- Product name: Personal Word. All interface text is sans serif and prefers the font chosen in Settings (`--ui-font`; Futura then Avenir/system fonts by default); the logo (`.brand`) stays Futura. Document typeface is independently configurable.
- Flat, restrained surfaces; square corners; no decorative folders/quills, curved selection connectors, slogans, or heavy footer strips.
- Sidebar selection is weight and colour, never a fill. Sidebar hierarchy: section headings and entry rows are 13px. The heading for any section holding what is on screen (main pane or either split pane) is bold in the normal text colour; its icons keep their section tint in Color mode. Rows are never bold: at rest they use `--muted`, and on hover, keyboard focus, or while open they use the normal text colour. The bottom rows (Read, Comments, History, Settings) keep their own look, and while Settings, Comments, Bibliography or Read is on screen nothing in the three sections is lit.
- Hover and keyboard focus on any text control (button, link, tab, menu row, sidebar row) use one shared rule in `src/styles.css`: a width-neutral faux bold drawn as a 0.3 px `text-shadow` copy in the text colour (`--emph-bold`) and nothing else; never `-webkit-text-stroke` (macOS WebKit draws it unsmoothed and it blurs on 1x screens): text controls no longer grow on hover (the press scale stays). Nothing may move its neighbours; danger stays red. Toolbar icons use the magnifying dock instead. Standalone icons outside the toolbar grow 25 percent on hover and focus (the icon only, never the button; off under Reduce Motion) through `src/components/icon-magnify.css`. Do not add another hover weight or scale rule anywhere.
- UI dash separators are '--'. Do not rewrite punctuation in user documents, citations, code, or paths.
- Live system light/dark appearance and reduced-motion behavior apply throughout.
- Sidebar width and pin/hover behavior are global. Feature order and collection list/card views are per project. Cards remain in the sidebar and adapt to its width.
- Floating mode (Settings, off by default) never overlaps document text: the sidebar and the citation card appear only in margins wide enough for them and otherwise the normal panels show; the floating sidebar has no background, border or shadow.
- View toggles sit to the left of add buttons and appear on hover or keyboard focus. Add buttons do too, except the "+" on Manuscript and custom top-level sections, which is always shown (owner approved, HS9). Every hover interaction must have keyboard access.
- Custom top-level sections beside Manuscript (Project.groups, Entry.group) are part of the manuscript: their entries stay `kind: "section"` in `project.order`, which every edit keeps grouped in sidebar order (src/organization/groups.ts), so Read and exports follow the sidebar. An unknown group id shows under Manuscript.
- Launch to Projects by default; restoring open tabs is optional. Closing tabs never deletes projects.
- Manuscript reading has separate display settings. Export formatting must not silently change when reading preferences change.
- Use documented Chicago 18 notes/bibliography guidance and official Turabian student-layout guidance. Instructor requirements may override layout. Keep limitations explicit.

## Verification and delivery
- Run npm run build, npm test, npm run test:e2e, and native cargo tests for affected persistence. Review actual light/dark screenshots and exported artifacts.
- Check native WebKit behavior for editor/layout changes; Chromium results alone are not proof of macOS rendering.
- Editable page view and PDF/Word pagination currently use different layout engines. Do not promise exact page parity.
- Rebuild with npm run tauri build before offering a new app. Report the resulting Personal Word.app path; never point to an old Folio.app as the new build.
- Keep generated build artifacts out of Git. Remove stale app bundles only when authorized; preserve current release and source history.
- Parallel agents must have explicit file ownership. Coordinate shared types and package installation through the integrating agent.
