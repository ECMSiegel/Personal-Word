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
- Product name: Personal Word. All interface text is sans serif, preferring locally installed Futura then Avenir/system fonts. Document typeface is independently configurable.
- Flat, restrained surfaces; square corners; no decorative folders/quills, curved selection connectors, slogans, or heavy footer strips. Selected sidebar entries are semibold: blue in the Plain palette, their section tint in Color.
- UI dash separators are '--'. Do not rewrite punctuation in user documents, citations, code, or paths.
- Live system light/dark appearance and reduced-motion behavior apply throughout.
- Sidebar width and pin/hover behavior are global. Feature order and collection list/card views are per project. Cards remain in the sidebar and adapt to its width.
- View toggles sit to the left of add buttons and appear on hover or keyboard focus. Every hover interaction must have keyboard access.
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
