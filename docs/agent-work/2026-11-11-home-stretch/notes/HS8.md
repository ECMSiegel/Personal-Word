# HS8 Page number position option

## What changed
- `src/research/types.ts`: optional `DocumentSettings.pageNumberPosition` (six values) plus `pageNumberPositionOptions`. Absent = bottom-right.
- `src/export/pdf.ts`: number drawn at the chosen corner/centre; top = mirror of the bottom offset. Default output is unchanged. Chicago still skips the title page and starts at 0.
- `src/export/docx.ts`: top positions use a Header, bottom a Footer, with matching alignment. Default unchanged.
- `src/export/ExportPanel.tsx`: "Page number position" select under the checkboxes (shown when Page numbers is on).
- `src/Writer.tsx` Page setup popover (new `onDocumentSettingsChange` prop) and `src/App.tsx` (passes it): "Page numbers" checkbox, "Position" select, muted line "Shown in PDF and Word exports."
- Tests: `src/export/pageNumbers.test.ts`, `tests/hs8-page-numbers.spec.ts`.
- Rust: no change. `documentSettings` is an opaque flattened `extra` map in src-tauri/src/store.rs, so the field round-trips; no cargo test needed.

## What the owner sees
Page setup now has Page numbers and Position. Nothing is drawn on the editor pages. Choose "Top center", export PDF or Word: the number is in the top margin, centred.

## Limits
Top-right/bottom-right in PDF keep the old fixed x offset (width - margin - 10) so default files stay identical, so they are not exactly flush for multi-digit numbers. Print preview and Markdown/plain text ignore the field.

## Hand check
Page setup -> uncheck then check Page numbers -> Position "Top center" -> reopen Page setup (kept) -> Export settings shows the same -> export PDF and Word and look at the top of page 2.
