# DELEGATION -- Remaining Personal Word beta work for cheaper agents
Date: 2026-10-24 | Author: integrator (Claude Opus) | Owner direction: "delegate as much of the plan as possible ... your job will be just to come back and review."

How to use this file: run the work packages (WP) **in wave order**. Each WP is a self-contained brief: paste the "Common rules" block plus that WP into a fresh agent. WPs in the same wave touch disjoint files and may run in parallel; later waves depend on earlier ones. After each wave, stop and ask the reviewer (the expensive model) to review: see "Review gates". Do not skip a gate.

Authority: roadmap `docs/agent-work/2026-10-20-beta-roadmap/PLAN.md` (read its "Owner decisions -- 2026-10-23" section first), child plans in the same folder, project `AGENTS.md`, workspace `../AGENTS.md`. If this file and a child plan disagree, this file wins for scope and file ownership; the child plan wins for behaviour details. If reality contradicts both, stop and report -- do not invent.

## Common rules (paste into every brief)
- Project root: `/Users/ethansiegel/Local Projects/VC Projects/Project 13 - Word Processor`. Read `AGENTS.md` there and `../AGENTS.md` first. Hobby project, local only.
- Edit ONLY the files your WP lists as owned. Need another file changed? Write it in your final report; do not edit it.
- No new npm or cargo packages, no network, no installs. Rust may only use crates already in `src-tauri/Cargo.lock` and the offline cache (`cargo ... --offline`).
- Pinned Node for every npm/npx command: `export PATH="$PWD/node_modules/.cache/personal-word-alpha-review/tools/node-v22.23.3-darwin-x64/bin:$PATH"` (check `node --version` = v22.23.3).
- The Mac is slow and heavily loaded. Run builds, Playwright, cargo and native runs **one at a time**, in the background with a log under `node_modules/.cache/personal-word-beta/<wp-id>/`, then read the whole log. Never rerun because a wait timed out. Slow timing is the machine, not a regression (owner confirmed).
- Preserve writing: keep `com.folio.writing`, `folio.*` keys, native event names, every additive project/entry metadata field, revisions/SaveQueue semantics, safety snapshots. Never delete user projects, recovery data or history. Image bytes never go into the localStorage recovery journal.
- Fail-first: every new check must be shown failing against the old code or a doctored copy (save a backup, doctor, run, restore, confirm the file is byte-identical), then passing. Never loosen an assertion to make it pass.
- UI: sans-serif UI, square corners, flat surfaces, live light/dark, every hover action keyboard-reachable, UI dashes are `--`.
- No git commits, resets, stashes or checkouts. The reviewer commits after review.
- Native harness (allowed; isolated `com.folio.smoke` store only): build `npm run tauri build -- --debug --features native-smoke --no-bundle --config '{"identifier":"com.folio.smoke"}'`, then `python3 scripts/native-reliability.py --suite baseline`. Never touch the real `com.folio.writing` library.
- Final report must contain: files changed, what was done per step, exact commands run with their result lines, fail-first evidence, anything left undone or needed from other files, and status CLAIMED (never "verified").

## Baseline at hand-off (verified 2026-10-24)
- HEAD `82d7ec9` (WIP commit of wave 0 on top of `7b58acb`). "Wave 0" work (built by Sonnet agents + integrator, NOT yet independently reviewed): Rust schema v3 image assets (`src-tauri/src/assets.rs`, `store.rs`, `lib.rs`: `stage_assets`, `create_project_with_assets`, `read_asset`, attachments mirror, image/table validation, 28 Rust tests); `src/assets/{types,assets}.ts`, `src/projectArchive.ts`; editor nodes `src/editor/{media,tables}.ts` registered in `extensions.ts`; image/table support in all exporters (`src/export/*`); BibTeX parser `src/research/bibtexImport.ts`; Markdown note parser `src/import/markdownNotes.ts`. Checks: `npx tsc --noEmit -p .` clean, `npm test` 369/369, cargo 28 passed / 1 ignored.
- Nothing above is wired into the UI yet. Done earlier: R1, E1-E3, C1, C2 (reviewed), D1 (native suite green). R2/R3 descoped.

## Wave 1 -- wire images and tables into the app (I1 completion)
### WP1 Storage adapters and model text (recommended: Sonnet)
Owned: `src/storage.ts`, `src/model.ts`, `src/model.test.ts`, `src/storage.test.ts` (create if absent).
1. Add to the storage adapter interface: `stageAssets(projectId, assets: PendingAsset[]): Promise<AssetMeta[]>`, `readAsset(projectId, id): Promise<PendingAsset>`, `createProjectWithAssets(project, assets)`. Native: `invoke("stage_assets", {projectId, assets:[{id, meta, data: toBase64(bytes)}]})`, `invoke("read_asset", {projectId, assetId})` (returns raw ArrayBuffer -> Uint8Array, then `verifyPendingAsset`), `invoke("create_project_with_assets", {change, assets})` where `change` matches the existing `save_changes` payload for a new project. Browser preview: `browserAssetStore` from `src/assets/assets.ts`, plus the existing browser project save.
2. `model.ts`: entry plain text (`textOf`/word counts) includes image alt text as its own block and table cells separated so words do not run together; `validateProject` already uses the shared schema (now containing image/table) -- add tests that a project with image+table validates and a nested table / bad assetId is rejected.
Accept: `npx vitest run src/model.test.ts src/storage.test.ts src/assets` + `npx tsc --noEmit -p .`.

### WP2 Editor UI and reading view (recommended: Sonnet) -- parallel with WP1
Owned: `src/Writer.tsx`, `src/components/ReadDocument.tsx`, `src/editor/editor.css`, `src/components/*` new files only if needed, `tests/assets.spec.ts` (new; browser part for the editor).
1. Toolbar: "Insert image" (file input accept `image/png,image/jpeg`) and "Insert table" (default 3x3 with header row). Inside a table show keyboard-reachable controls: add row, delete row, add column, delete column, toggle header row, delete table (commands exist in `src/editor/tables.ts`). Image insert flow takes a callback prop `onInsertImage(file): Promise<{assetId, alt, width, height} | null>` supplied by App (WP3) -- Writer must not call storage itself. Ask for alt text (simple inline prompt field, not `window.prompt`).
2. Call `setImageSourceResolver` from `src/editor/media.ts` via a prop/effect fed by App; cache object URLs per assetId and revoke on unmount/project switch.
3. ReadDocument renders images (same resolver, alt fallback) and tables.
Accept: `npx tsc --noEmit -p .`, unit tests, and a Playwright spec using a seeded browser project (see `tests/research.spec.ts` seeding pattern) that inserts a table, edits cells, adds/deletes rows by keyboard, reloads and finds the table; image display can use a seeded asset in IndexedDB once WP3 exists -- leave image E2E for WP3 if blocked.

## Wave 2 -- App integration (one agent; App.tsx is shared)
### WP3 App wiring, archive, fragments, exports (recommended: Sonnet, high effort)
Owned: `src/App.tsx`, `src/export/ExportPanel.tsx`, `src/organization/operations.ts`, `src/organization/*.test.ts`, `tests/assets.spec.ts` (extend).
1. `onInsertImage`: `createPendingAsset(bytes)` -> `storage.stageAssets(projectId,[asset])` -> return attrs (display width capped to page width). Staging must finish before the node is inserted (bytes durable before any reference).
2. Image resolver for Writer/ReadDocument: `storage.readAsset` -> Blob URL.
3. Exports: build `Map<AssetId, PendingAsset>` from `collectAssetIds(project)` via `storage.readAsset` and pass to `exportDocx(project, assets)`, `exportPdf(project, undefined, assets)`, `projectMarkdown/projectPlainText(project, assets)`. Missing asset -> visible error, no file.
4. "Export portable project" (App.tsx ~1565): `createProjectArchive(project, resolver)`. "Recover from a project.json" (`importProject` ~993): `readProjectArchive(text)`; it gives the project a new id, so call `storage.createProjectWithAssets(newProject, assets)` (native: one transaction). Legacy plain JSON keeps working.
5. Fragment import across projects (`importFragment`, operations.ts): copy referenced assets source -> target (`readAsset` then `stageAssets`) BEFORE the content mutation.
Accept: full `npm test`, `npx tsc --noEmit -p .`, `npm run build`, Playwright `tests/assets.spec.ts tests/research.spec.ts --workers=1` on the production preview (copy `node_modules/.cache/personal-word-beta/c2-prod.config.mjs` and rename its report/results), then the native harness extended with one asset scenario: stage + save image project, kill after staging (before content), restart -> project opens with last acknowledged content and no missing-image reference; reopen image project -> bytes match. Extend `tests/native-reliability.js`, `scripts/native-reliability.py`, `src-tauri/src/smoke.rs` only for that scenario (owned for this WP).

### WP4 Markdown note round trip fix + I3 import wiring (recommended: Haiku/Sonnet) -- parallel with WP3
Owned: `src/export/textExport.ts`, `src/export/textExport.test.ts`, `src/import/manuscript.ts`, `src/import/manuscript.test.ts`.
1. Exporter: indent continuation paragraphs of multi-paragraph notes by 4 spaces so `[^n]: A\n\n    B` re-imports (reported by the I3 agent).
2. Wire `parseMarkdownNotes` into `manuscript.ts` exactly as described in `src/import/markdownNotes.ts` header/report: rename existing `markdownDocument` body to `markdownBody`, wrap it, set `project.research = {...emptyResearch(), footnotes}` when notes exist.
3. Test: export project with multi-paragraph notes -> import -> same notes, order, reference positions.
Accept: `npx vitest run src/import src/export` + tsc.

## Review gate A (reviewer)
Reviewer reviews wave 0 + waves 1-2 together against `03-imports/PLAN.md` I1, reruns everything, writes `docs/agent-work/2026-10-20-beta-roadmap/03-imports/REVIEW.md`, repairs or returns findings, commits.

## Wave 3 -- rich import and research import
### WP5 I2 DOCX/HTML import (recommended: Sonnet, high effort)
Owned (create): `src/import/docxImport.ts`, `src/import/htmlImport.ts`, `src/import/importLimits.ts`, `src/import/richImport.test.ts`, `src/import/ImportPreview.tsx` (modify), `src/app/ProjectDialogs.tsx` (modify), `tests/rich-import.spec.ts`, fixtures under `tests/fixtures/rich-import/`. Do NOT touch App.tsx -- report the one call change needed.
Follow `03-imports/PLAN.md` I2 with the owner-approved deviation: no parse5 and no worker for parsing; use `new DOMParser().parseFromString(...)` (inert: never attach to the live DOM, never set innerHTML on live nodes, no network) and existing `jszip`. Check zip entry count, per-entry and total uncompressed sizes from the central directory BEFORE inflating; reject encrypted DOCX, path traversal names, external relationships (never fetch). Convert paragraphs/headings/bold/italic/underline/lists/footnotes (word/footnotes.xml -> Footnote records)/tables/inline PNG+JPEG images (-> `createPendingAsset`, other image types -> warning). Return `ImportDraft {project, assets, warnings, counts}`; cancel via AbortSignal checkpoints. Malicious fixtures (zip bomb, traversal, XXE-style DOCTYPE, script/onerror HTML, remote img) must produce no fetch, no script, no partial project. Accept: `npx vitest run src/import`, tsc, Playwright `tests/rich-import.spec.ts tests/import.spec.ts --workers=1`.

### WP6 C3 BibTeX wiring and optional Zotero refresh (recommended: Sonnet)
Owned: `src/research/ResearchPanel.tsx`, `src/research/CslImportPreview.tsx`, `src/research/zotero.ts` + `zotero.test.ts` (create), `src-tauri/src/zotero.rs` (create), `tests/zotero.spec.ts` (create). Report (do not make) the `lib.rs` registration line.
1. Import button accepts `.json,.bib,.bibtex`; route by extension to `parseBibtex` / `parseCslJson`; preview wording says "sources" not "Zotero CSL" when BibTeX.
2. Optional one-way Zotero refresh per `04-research/PLAN.md` C3: off by default, localhost Zotero local API only (`http://127.0.0.1:23119/api/...`), read-only, results go through the same reviewed per-field update preview (never automatic overwrite). Native fetch via a Rust command limited to 127.0.0.1:23119 and GET only. Synthetic tests only (mock server / fixtures); no real Zotero access.
Accept: vitest research tests, tsc, Playwright `tests/zotero.spec.ts tests/research.spec.ts --workers=1`, `cargo test --offline` for zotero.rs URL guard.

### WP7 I3 Markdown bundle export/import (recommended: Sonnet) -- after WP4 and WP5
Owned (create): `src/export/markdownBundle.ts` + test, `tests/markdown-roundtrip.spec.ts`; modify `src/export/ExportPanel.tsx` only for the new "Markdown with images (.zip)" option. ZIP: `manuscript.md`, `assets/<sha>.<ext>`, `manifest.json`; import returns an `ImportDraft` through WP5's path; verify hashes; bounded sizes. Accept: unit + Playwright round trip with image+table+notes, zero network requests.

## Review gate B (reviewer)
Review WP5-WP7 (+ any WP4 leftovers); write REVIEW sections in `03-imports/REVIEW.md` and `04-research/REVIEW.md`; commit.

## Wave 4 -- layout (L1-L3) -- needs a stronger model
### WP8 L1 native print feasibility (recommended: Sonnet high or Opus; do not use Haiku)
Owned: `src-tauri/src/printing.rs` (create), `src/print/nativePdf.ts`, `src/print/printProbe.ts`, `tests/native-print.js`, `scripts/native-print-smoke.py`; report the `lib.rs`/`Cargo.toml` lines needed (only `objc2-web-kit` 0.3.2 / objc2 crates already in Cargo.lock; check `cargo tree --offline`). Follow `05-layout/PLAN.md` L1 exactly, including its stop rules. If WKWebView PDF creation cannot meet the probe (paged, searchable text, fonts ready, no external resources), STOP and report evidence -- that ends wave 4 and the existing pdf-lib exporter stays.
### WP9 L2, WP10 L3 -- only if WP8 passes
Follow `05-layout/PLAN.md` L2 then L3 with the file lists there; one agent at a time (shared `src/print/*`).

## Review gate C (reviewer)

## Wave 5 -- D2 final durability and beta evidence (recommended: Sonnet high)
### WP11 D2
Follow `06-durability/PLAN.md` D2: extend `native-reliability.py --suite beta` with image/table/new-field fixtures and fault points (asset staging vs content commit, restore, source merge), create `scripts/verify-beta-evidence.py` (no signing/notary fields -- descoped), update README/docs limitations honestly, then a normal `npm run tauri build` and confirm no smoke markers in the normal app. Owned: the files that plan lists, minus signing/release items.

## Review gate D (reviewer) -> owner real-use testing
Reviewer runs the full validation (build, `npm test`, full Playwright on production preview, cargo, native suite), writes the final REVIEW, commits, and prepares the owner's manual test checklist.

## Review gates -- what the reviewer checks every time
Read each WP's final report as a claim. Diff since the last commit; every hunk traces to an owned file and a step. Re-run the WP acceptance commands. Spot-check fail-first evidence by redoing one doctored run. Check the preservation rules (metadata, journal never holds bytes, no deletions). Then write findings, repair or send back, and commit locally (no push).
