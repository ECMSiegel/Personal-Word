# PLAN -- Writer features: automatic short notes, Zotero import, quote capture, goals and focus, prose check, whole-project text export
Date: 2026-10-18 | Architect: Claude Code (Opus 5.5) | Project: Project 13 - Word Processor | Status: APPROVED

Approval: 2026-10-18, owner: "Implement the plan with Luna sub agents". Use the four named defaults below. Owner's T0 decision: "Wait until the completion work is committed". Do not implement features on the dirty completion baseline.

> **For agentic workers:** REQUIRED SUB-SKILL: use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task by task. Codex/OpenCode: use `plan-execution` and keep `IMPLEMENTATION_LOG.md` beside this file. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add six writer features that make Personal Word the strongest local app for footnoted research writing, without adding any network service or account.

**Architecture:** Citation work (T1-T5) extends the existing single citation formatter in `src/research/citations.ts`, so every renderer (editor notes, research panel, Read manuscript, DOCX, PDF) picks up changes from one place. Editor aids (T6-T8) are decoration-only Tiptap extensions that never change the saved document or the shared schema. Export (T9) adds a Markdown/plain-text serializer next to the existing DOCX/PDF exporters.

**Tech stack:** Tauri 2, React, TypeScript, Tiptap 3.32 (`@tiptap/pm`), Vitest, Playwright, Rust/SQLite. No new npm or Cargo dependencies.

**Spec:** the user's numbered brainstorm list in this conversation (items 1, 3, 4, 5, 7, 8), quoted under Request. No separate design document exists; this plan carries the design decisions.

## Request

User, 2026-10-18: "write a plan that builds 1 3 4 5 7 and 8" -- referring to this list from the brainstorm:
1. **Import from Zotero.** Read an exported library file into Sources, with no account or internet.
3. **Automatic short notes.** Full note on first citation of a source, shortened note after; today a checkbox does this by hand.
4. **Quote capture.** Paste a passage with its page into a source, then insert it with its citation in one step.
5. **Writing goals and focus mode.** Word targets, deadlines, and dimming everything but the current paragraph.
7. **Optional prose check.** Flag repeated words, passive voice, and filler; runs locally with no AI service.
8. **Export the whole project as plain text or Markdown.**

The user also asked that plan-authoring and make-plan instructions be followed (Phase 0 fact discovery, Allowed APIs, anti-pattern guards).

## Definition of done

- A Zotero "CSL JSON" export file can be chosen from the Research panel, previewed, and merged into the open project's Sources; duplicates are skipped and unsupported item types are counted, never silently dropped.
- In a project with automatic short notes on, the first footnote citing a source renders as a full note and every later one as a short note, identically in the editor note area, Research panel preview, Read manuscript, DOCX, and PDF. Each footnote can override to Full or Short.
- Short notes use a source's short title (or its main title before a colon) instead of the full title.
- A "Capture quote" dialog saves a quote with page to a source and can insert it with a citation in one step; quotes of 100 words or more insert as a block quotation without quotation marks.
- A project can have a total word goal, a daily goal, and a deadline; the status line shows progress.
- Focus mode (button and Cmd/Ctrl+Shift+F) dims every top-level block except the one holding the cursor.
- Prose check (off by default) underlines repeated words, passive constructions, filler words, and sentences over 40 words, and lists them in a keyboard-reachable panel. It never changes the document.
- Settings > Export offers "Export Markdown" and "Export plain text" for the whole project, including section titles, numbered notes, bibliography, fragments, and research notes.
- `npm run build`, `npm test`, `npm run test:e2e`, and `cargo test --manifest-path src-tauri/Cargo.toml` all pass, and every new test was seen failing first.

Status words follow workspace rules: implemented and checked features are CLAIMED; only the owner's real-use confirmation makes them VERIFIED.

## Non-goals

- BibTeX/BibLaTeX import (escape handling makes a reliable parser a separate project), live sync with a running Zotero, the Zotero web API.
- New source kinds beyond book, journal, website. Other CSL types are counted and skipped.
- "Ibid." (Chicago 18 discourages it; shortened notes replace it).
- Restarting full notes per chapter (Chicago's per-chapter rule was not confirmed from primary text; the manuscript is one note sequence).
- The "ready to submit" check (brainstorm item 2) and the corkboard (item 6).
- AI or any network use for the prose check; grammar correction; auto-fixes.
- Typewriter scrolling, hiding the sidebar in focus mode, streaks, statistics history.
- Markdown export round trip back into footnotes (import keeps `[^n]` as literal text).
- Changing the DOCX/PDF layout, the Rust allowlist, or the database schema.

## Context (verified unless marked)

Base state:
- HEAD `c62332c` on `main`; about 54 uncommitted paths from the 2026-10-18 completion pass by another agent, whose log marks T1-T5 DONE and T6 (independent review) IN PROGRESS -- `docs/agent-work/2026-10-18-completion/IMPLEMENTATION_LOG.md` (verified)
- New uncommitted files from this session: `README-draft.md`, `docs/evidence/readme/*.png` (verified)

Citations and research:
- `Source` = {id, kind: "book"|"journal"|"website", title, authors: string[] (given-name first), publisher?, year?, journal?, volume?, issue?, pages?, url?, doi?, accessed?, website?, isbn?, lookupNote?} -- `src/research/types.ts:1-20` (verified)
- `ResearchNote` = {id, kind: "quote"|"paraphrase"|"personal", text, sourceId?, locator?} -- `src/research/types.ts:21-27` (verified)
- `Footnote` = {id, text, sourceId?, locator?, shortened?: boolean} -- `src/research/types.ts:28-34` (verified)
- `ResearchData` = {sources, notes, footnotes}; `emptyResearch()` -- `src/research/types.ts:35-39, 58` (verified)
- `citationParts(s, mode: "full"|"short"|"bibliography", locator)`; the short branch uses the full `s.title` -- `src/research/citations.ts:50-79` (verified)
- `footnoteParts(note, data)` picks `note.shortened ? "short" : "full"`; `footnoteText` joins parts -- `src/research/citations.ts:125-140` (verified)
- Callers of `footnoteParts`/`footnoteText`: `src/App.tsx:1540` (Read manuscript), `src/App.tsx:1561` (editor note area), `src/research/ResearchPanel.tsx:289` (panel preview), `src/export/document.ts:86-87` (DOCX/PDF) -- grep (verified)
- "Shortened citation" checkbox -- `src/research/ResearchPanel.tsx:312-319` (verified by subagent read)
- Footnote numbering walks `project.order` over all entries -- `src/App.tsx:1050-1065` (verified); export numbering walks only `kind === "section"` entries -- `src/export/document.ts:70-94, 169-174` (verified by subagent). `project.order` holds exactly the sections, never fragments, because `validateProject` enforces it -- `src/model.ts:185-187` (verified). The two numbering walks therefore agree.
- "Insert quote + cite" handler creates `{id, text:"", sourceId, locator}` and inserts curly-quoted text plus a `footnoteReference` -- `src/App.tsx:1753-1792` (verified by subagent)
- `addQuote`, `citeHere` -- `src/research/ResearchPanel.tsx:264-275, 249-256` (verified by subagent)
- `validateProject` checks `research.sources[]` kind against the three kinds -- `src/model.ts:123-143` (verified by subagent)
- New projects have no `research` until first use; every creation path goes through `newProject(title)` -- `src/model.ts:70-81`, `src/App.tsx:852` (verified). Fallback literals `{sources:[],notes:[],footnotes:[]}` exist at `src/App.tsx:1191, 1760` and `src/organization/operations.ts:17` (verified).
- Tiptap packages declared in `package.json` are `@tiptap/react`, `@tiptap/pm`, starter-kit, typography, and placeholder; `@tiptap/core` is installed only as a transitive dependency; `getSchema` is imported from `@tiptap/react` -- `src/model.ts:1` (verified)
- Editor footnote node is `footnoteReference` with one attr `id` -- `src/editor/formatting.ts:146-182` (verified by subagent)

Editor, settings, UI:
- `words(text)` and memoized `entryWords(e)` -- `src/model.ts:~98-100` (verified by subagent)
- Status line `<footer className="document-statistics">` -- `src/App.tsx:1668-1680` (verified by subagent)
- `readPreference<T>(key, fallback)` for global prefs; writes are `localStorage.setItem` in `useEffect` -- `src/App.tsx:61, 171-204` (verified by subagent)
- `mutate(change)` increments revision and enqueues SaveQueue -- `src/App.tsx:220-228` (verified by subagent)
- Toolbar groups `ToolbarGroup`, `TOOLBAR_ORDER`, `OVERFLOW_ORDER`, `groupBody(id)`, `PanelButton` popovers -- `src/Writer.tsx:63-110, 550, 918`; `src/editor/ToolbarControls.tsx:58` (verified by subagent)
- Writer `useEditor` config with `editorProps.handleKeyDown`, `onUpdate`, `onTransaction` -- `src/Writer.tsx:~225-262` (verified)
- No ProseMirror Plugin/Decoration exists anywhere in `src` (verified by subagent grep)
- `documentExtensions()` also builds the validation schema (`getSchema`) -- `src/editor/extensions.ts`, `src/model.ts:5` (verified by subagent)
- Taken shortcuts: Cmd/Ctrl+S, +\, +K, +Shift+N, +Shift+S (`src/App.tsx:518-538`), +Shift+X (`src/Writer.tsx:247-250`), Tab (verified)
- Settings page sections and `ExportPanel` mount -- `src/App.tsx:1343-1392` (verified by subagent)
- Reduced motion only disables transitions -- `src/styles.css:1367` (verified by subagent)

Import/export:
- `documentBlocks(project)` returns {blocks, notes, settings, bibliography}; blocks lack section titles; blockquote and code marks are not represented -- `src/export/document.ts:17-191` (verified by subagent)
- `saveExport(blob, name)` labels every filter "PDF" or "Word document" -- `src/export/document.ts:204-215` (verified by subagent)
- Existing read-mode "Export plain text" (titles + text only, no notes) -- `src/App.tsx:1485-1494` (verified by subagent)
- Import pattern: hidden file input, 5 MB limit, fatal UTF-8 decode, preview modal -- `src/components/ProjectLibrary.tsx:204-215`, `src/import/manuscript.ts:5, 82-88`, `src/import/ImportPreview.tsx:4` (verified by subagent)
- Additive metadata survives native saves through `#[serde(flatten)] extra` -- `src-tauri/src/store.rs:37-65`; test `extended_project_metadata_survives_save_and_restart` at `store.rs:1319` (verified by subagent)
- Rust validates node and mark type names only, not attrs, not `research` -- `src-tauri/src/store.rs:775-840` (verified by subagent)
- CSP blocks webview network; only `lookup_fetch` reaches the network -- `src-tauri/tauri.conf.json:23`, `src-tauri/src/lookup.rs:54` (verified by subagent)

External references (Phase 0 discovery):
- CSL JSON: only `id` and `type` required; names {family, given, literal}; dates {date-parts, raw, literal}; `title-short` exists -- https://raw.githubusercontent.com/citation-style-language/schema/master/schemas/input/csl-data.json (verified, primary)
- Zotero export: right-click library or collection > Export, choose format -- https://www.zotero.org/support/kb/exporting (verified); that the format list says "CSL JSON" and writes `.json` (inferred, not confirmed in a fetched page)
- Chicago 18 shortened note: surname + short title (four words or fewer) + locator; ibid. discouraged -- secondary guide https://guides.douglascollege.ca/Chicago18/ShortenedCitations (inferred from secondary source)
- Prose heuristics: write-good (MIT) checks passive, weasel words, adverbs, repeated words -- https://github.com/btford/write-good (verified); its algorithm details (inferred)

## Rules in force

- Keep `com.folio.writing`, `folio.*` keys and event names; additive metadata only; immutable mutations with increasing revisions through SaveQueue -- `AGENTS.md` (project)
- Share the editor schema with import validation; extend the Rust allowlist when adding nodes or marks (this plan adds none) -- `AGENTS.md` (project)
- Never delete user projects or recovery data; use isolated test storage -- `AGENTS.md` (project)
- UI text sans serif; flat square surfaces; UI dash separator `--`; never rewrite punctuation in user documents -- `AGENTS.md` (project)
- Every hover interaction has keyboard access; live light/dark and reduced motion throughout -- `AGENTS.md` (project)
- Export formatting must not silently change when reading preferences change -- `AGENTS.md` (project)
- Chicago 18 / Turabian guidance documented; limitations explicit -- `AGENTS.md` (project)
- Run build, unit, e2e, and cargo tests; review light/dark screenshots and exported artifacts; check native WebKit for editor changes -- `AGENTS.md` (project)
- No commits unless the user asks; never commit another session's files; no package installs without asking -- `../AGENTS.md` (workspace)
- A new test must be shown failing before the fix -- `../AGENTS.md` (workspace)

## Approach

Six features, ordered so shared citation plumbing lands first. Each phase ships on its own.

- **Phase A, citations (T1-T5):** a manuscript-order helper decides each footnote's form once, and every renderer passes it to the existing formatter. A per-footnote `form` field replaces the boolean while still honouring old `shortened: true`. A project flag `autoShortNotes` turns the automatic rule on: true for new projects, absent (meaning off) for existing ones, so no existing export changes silently.
- **Phase B, writing aids (T6-T8):** goals are project metadata shown in the status line. Focus mode and prose check are decoration-only Tiptap extensions passed to the Writer editor alone, never to `documentExtensions()`, so the schema, import validation, and saved JSON are untouched.
- **Phase C, export (T9):** a new serializer walks the project directly, not `documentBlocks`, because it needs section titles, block quotes, fragments, and research notes that `documentBlocks` drops. It reuses T1's numbering and note forms.

Rejected alternatives:
- Using write-good as a dependency: the workspace needs approval for installs, and four small heuristics are under 150 lines.
- Parsing BibTeX: LaTeX escapes and macros need a real parser. CSL JSON is Zotero's own structured export.
- Auto-shortening existing projects: this would silently change their exports, which the rules forbid.
- Storing note form in the `footnoteReference` attrs: Rust doesn't validate attrs, but footnote data already lives in `research.footnotes`, so one place is simpler.

## Allowed APIs (from Phase 0; do not invent others)

- Tiptap: `Extension.create({ name, addProseMirrorPlugins() })` and `Editor`, imported from `@tiptap/react`; `Plugin`, `PluginKey` from `@tiptap/pm/state`; `Decoration.node`, `Decoration.inline`, `DecorationSet.create` from `@tiptap/pm/view`. Confirm each import path exists in `node_modules/@tiptap/pm` before use.
- Project code: `mutate`, `readPreference`, `words`, `entryWords`, `citationParts`, `footnoteParts`, `footnoteText`, `bibliography`, `saveExport`, `safeFilename`, `PanelButton`, `Dropdown` (`src/components/Dropdown.tsx`), `ModalFrame` (used by `ImportPreview`), `validateProject`.
- Anti-patterns: no `fetch` for import; no new Tiptap node or mark; no `localStorage` writes outside the `useEffect` pattern; no edits to `store.rs`.

## Review Focus

These are the inputs most likely to hurt a real user that no single feature test covers. Each line names the task that pins it with a test.

1. **A Zotero file with names that are only `literal`, such as an institution, or with no author at all.** The import must keep the literal name whole and never produce "undefined". Pinned in T4.
2. **A footnote cut and pasted earlier in the manuscript, before the first citation of its source.** The forms must recompute so that the new first occurrence is full. Pinned in T1.
3. **Text inside quotation marks or block quotes.** The prose check must not flag it, because it's the cited author's wording. Pinned in T7.
4. **Undo after an inserted captured quote.** One Cmd+Z must remove both the quote text and its footnote reference, with no dangling footnote error on export. Pinned in T5.
5. **A section title containing Markdown characters (`#`, `*`, `[`).** Markdown export must escape them so the heading structure survives. Pinned in T9.

---

## Tasks

### T0 -- Preconditions and baseline
- Files: none changed. Record results in `docs/agent-work/2026-10-18-writer-features/IMPLEMENTATION_LOG.md`.
- Steps:
  - [ ] 1. Run `git status --short` and `git log -3 --oneline`. Record both.
  - [ ] 2. Confirm the 2026-10-18 completion pass is committed, or that the user has said to build on top of its uncommitted files.
  - [ ] 3. Run `npm test`, `npm run build`, and `cargo test --manifest-path src-tauri/Cargo.toml`. Record the pass and fail counts.
- Acceptance check: `npm test` → exits 0. Record the test count as the baseline.
- Fail-first: n/a. This task records the baseline only.
- Stop and ask if: the completion pass is still uncommitted and the user hasn't said to build on top of it, or any baseline check fails.
- Default if unanswered: none. You must ask, because mixing these edits into another agent's uncommitted work can't be untangled later.

### T1 -- Manuscript-order note forms (automatic short notes engine)
- Files: create `src/research/noteForms.ts` and `src/research/noteForms.test.ts`. Modify `src/research/types.ts:28-39` and `src/research/citations.ts:125-140`.
- Interfaces produced:
  - In `types.ts`, `export type NoteForm = "auto" | "full" | "short"`. `Footnote` gains `form?: NoteForm`, and `shortened?` is kept for old data. `ResearchData` gains `autoShortNotes?: boolean`.
  - `emptyResearch()` returns `autoShortNotes: true`, and `newProject(title)` in `src/model.ts:70-81` sets `research: emptyResearch()`, so every new project, template or import, starts with the rule on. The fallback literals at `App.tsx:1191, 1760` and `operations.ts:17` stay unchanged: they serve old projects, which keep the flag absent and therefore off.
  - `export function footnoteIdsInOrder(project: Pick<Project,"order"|"entries">): string[]` gives first-appearance order over `kind === "section"` entries in `project.order`, recursing into content.
  - `export function resolveNoteForms(ids: string[], data: ResearchData): Record<string, "full" | "short">`.
  - `footnoteParts(note, data, form?: "full" | "short")` and `footnoteText(note, data, form?)`. When `form` is given, it wins over `note.shortened`.
- Rule for `resolveNoteForms`, in order:
  1. If `form === "full"` or `"short"`, use it.
  2. Otherwise, if `shortened === true`, use `"short"`.
  3. Otherwise, if `data.autoShortNotes` is true and the note has a `sourceId` already seen earlier in `ids`, use `"short"`.
  4. Otherwise, use `"full"`.
  5. Notes with no source always resolve to `"full"`. It doesn't affect their output.
- Steps:
  - [ ] 1. Write the failing tests in `noteForms.test.ts`:
    - "first citation is full and later citations of the same source are short": with two sources A and B and ids `[a1, b1, a2]`, the result is `{a1:"full", b1:"full", a2:"short"}`.
    - "projects without the flag keep every note full": `autoShortNotes` is undefined, giving `a2:"full"`.
    - "explicit form and legacy shortened win over the automatic rule": `a1.form = "short"` gives `"short"`, and `a2.form = "full"` gives `"full"`. Legacy `{shortened: true}` with the flag off gives `"short"`.
    - "moving a later citation before the first recomputes forms" (Review Focus 2): ids `[a2, a1]` give `{a2:"full", a1:"short"}`.
    - "footnoteIdsInOrder skips fragments and nested duplicates": a fragment entry holding a reference is excluded, and a repeated id is listed once.
    - "new projects start with automatic short notes on" (in `src/model.test.ts`): `newProject("x").research?.autoShortNotes === true`.
  - [ ] 2. Run `npx vitest run src/research/noteForms.test.ts`. Expect FAIL, because the module isn't found.
  - [ ] 3. Implement the types, both functions, and the `form` parameter. `footnoteParts` uses `form ?? (note.shortened ? "short" : "full")`.
  - [ ] 4. Run `npx vitest run src/research`. Expect PASS, including the existing `citations.test.ts`.
  - [ ] 5. Add a validation check in `src/model.ts` near lines 140-142: if `footnotes[].form` is present, it must be one of the three values. Otherwise throw `Error("Invalid footnote form")`. Add a case to `src/model.test.ts`.
  - [ ] 6. Commit, only if the user has authorized commits: `feat: resolve Chicago note forms in manuscript order`.
- Acceptance check: `npx vitest run src/research src/model.test.ts` → all pass.
- Fail-first: step 2.
- Stop and ask if: an existing test asserts the exact shape of `newProject()` and fails because `research` was added.
- Default if unanswered: update that assertion to include `research`, and record it in the log.

### T2 -- Short titles in shortened notes
- Files: modify `src/research/types.ts` (Source), `src/research/citations.ts:65-79`, `src/research/citations.test.ts`, and `src/research/ResearchPanel.tsx` (the source form).
- Interfaces produced:
  - `Source.shortTitle?: string`.
  - `export function shortTitle(s: Source): string` returns `s.shortTitle` if it's non-empty. Otherwise it returns the main title, which is the text before the first `: ` or `? `, with the `?` kept. If the result is still over four words, it's returned unchanged. Chicago's choice of key words is the writer's call, and the "Short title" field lets them make it.
- Steps:
  - [ ] 1. Write the failing tests in `citations.test.ts`:
    - "short notes use the main title before a colon": title "Lamps and Ledgers: Keeping the Coastal Lights", `formatCitation(s, "short", "48")` → `"Halloway, Lamps and Ledgers, 48."`.
    - "an explicit short title wins": `shortTitle: "Ledgers"` gives `"Halloway, Ledgers, 48."`.
    - "journal short notes quote the short title": a journal source titled "On Testing: A Method" with locator "12" gives `Smith, “On Testing,” 12.`.
    - "two authors and et al. in short notes": the outputs start `"Yu and Lee, "` and `"Yu et al., "`. These pin existing behaviour that has no test yet.
  - [ ] 2. Run `npx vitest run src/research/citations.test.ts`. Expect FAIL on the first three.
  - [ ] 3. Use `shortTitle(s)` in the short branch only. Full notes and the bibliography keep `s.title`.
  - [ ] 4. Add a "Short title" text input to the source form under Title, with the placeholder "Used in shortened notes". The form uses the same `patchSource` path as the other fields.
  - [ ] 5. Run the test again. Expect PASS.
  - [ ] 6. Commit, only if authorized: `feat: shortened notes use short titles`.
- Acceptance check: `npx vitest run src/research` → all pass.
- Fail-first: step 2.
- Stop and ask if: any existing test assertion on a short note changes its expected text.
- Default if unanswered: keep the existing assertions and fix the implementation instead.

### T3 -- Wire note forms into every renderer, plus the note-form control
- Files: modify `src/App.tsx:1050-1065, 1540, 1561`, `src/research/ResearchPanel.tsx:289, 312-319`, `src/export/document.ts:70-94`, `src/export/document.test.ts`, and `tests/research.spec.ts`.
- Interfaces consumed: `footnoteIdsInOrder`, `resolveNoteForms`, and `footnoteParts(note, data, form)` from T1.
- Steps:
  - [ ] 1. Write the failing test in `document.test.ts`, "auto short notes reach the export notes": a project with `autoShortNotes: true` cites one book twice. Assert `documentBlocks(p).notes[1].text` starts with `"Halloway, Lamps and Ledgers"` and has no publisher.
  - [ ] 2. Write the failing e2e test in `tests/research.spec.ts`, "second citation of a source shows a shortened note":
    1. Create a project from the Blank template.
    2. Add a manual source with Authors "Marguerite Halloway", Title "Lamps and Ledgers: Keeping the Coastal Lights", Publisher "Harbor Street Press", and Year "2019".
    3. Choose "Cite here" twice, at two cursor positions.
    4. Close research.
    5. Assert that `.footnote-area` contains "(Harbor Street Press, 2019)" exactly once and also contains "Halloway, Lamps and Ledgers."
  - [ ] 3. Run `npx vitest run src/export/document.test.ts` and `npx playwright test tests/research.spec.ts -g "shortened"`. Expect both to FAIL.
  - [ ] 4. Compute `const forms = resolveNoteForms(footnoteIdsInOrder(project), research)` once per render in `App.tsx`, next to `footnoteNumbers`. Pass `forms[n.id]` at lines 1540 and 1561, and pass `forms` to `ResearchPanel` as a new prop `noteForms: Record<string,"full"|"short">`.
  - [ ] 5. In `documentBlocks`, compute the same forms and pass them at lines 86-87.
  - [ ] 6. Replace the "Shortened citation" checkbox with a `Dropdown` labelled "Note form". Its options are "Automatic (full)" or "Automatic (short)" depending on the resolved form, then "Always full" and "Always short". Choosing one writes `form` and deletes `shortened` through `patchFootnote`.
  - [ ] 7. Add a checkbox at the top of the Research Sources tab: "Shorten repeat citations automatically". It's bound to `research.autoShortNotes` and writes through `onChange`.
  - [ ] 8. Rerun both tests. Expect PASS. Then run `npm test`.
  - [ ] 9. Commit, only if authorized: `feat: automatic Chicago short notes across editor and exports`.
- Acceptance check: `npm test && npx playwright test tests/research.spec.ts tests/footnotes.spec.ts` → all pass.
- Fail-first: step 3.
- Stop and ask if: the PDF or DOCX fixtures in `src/export/export-fixtures.ts` change output for projects without `autoShortNotes`.
- Default if unanswered: none. You must ask, because exports must not change silently.

### T4 -- Zotero CSL JSON import
- Files:
  - Create `src/research/cslImport.ts` and `src/research/cslImport.test.ts`.
  - Create `src/research/CslImportPreview.tsx`.
  - Modify `src/research/ResearchPanel.tsx`, `src/research/types.ts`, and `src/App.tsx` (modal wiring next to `ImportPreview` at about line 1904).
  - Add the test fixture `tests/fixtures/zotero-sample.json`.
  - Add a case to `tests/research.spec.ts`.
- Interfaces produced:
  - `export type CslImportResult = { sources: SourceDraft[]; skipped: Record<string, number>; duplicates: number; warnings: string[] }`.
  - `export function parseCslJson(text: string, existing: Source[]): CslImportResult`.
  - `Source.cslId?: string`, which keeps the Zotero item id for duplicate detection.
- Mapping:
  - **Types:**
    - `book` maps to book.
    - `article-journal`, `article-magazine`, and `article-newspaper` map to journal, with `container-title` going to `journal`.
    - `webpage`, `post`, and `post-weblog` map to website, with `container-title` going to `website`.
    - Every other type is counted in `skipped[type]`.
  - **Names:** `author[]` becomes `given + " " + family`, or `literal`, or `family` alone.
  - **Dates:** `issued.date-parts[0][0]` becomes `year`. `accessed` becomes `yyyy-mm-dd`, or is left out if it's partial.
  - **Other fields:**
    - `title-short` becomes `shortTitle`.
    - `DOI` becomes `doi`, `ISBN` becomes `isbn` (first ISBN if space-separated), and `URL` becomes `url`.
    - `volume`, `issue`, and `page` become `volume`, `issue`, and `pages`, converted to strings.
    - `publisher` becomes `publisher`.
    - `lookupNote` is set to "Imported from Zotero".
  - **Duplicates:** an item is a duplicate when it has the same `cslId`, the same normalized DOI, or the same lowercased title plus first author surname as an existing or earlier item.
- Steps:
  - [ ] 1. Write the failing tests in `cslImport.test.ts`:
    - "maps a book and a journal article": use the two minimal CSL examples quoted in Context.
    - "keeps literal institutional authors and tolerates no author" (Review Focus 1): `{literal:"World Health Organization"}` is kept whole, and an item with no author gives `authors: []`. No output contains "undefined".
    - "counts unsupported types instead of dropping them silently": `chapter` and `thesis` give `skipped: {chapter:1, thesis:1}`.
    - "skips duplicates by Zotero id, DOI, or title and author".
    - "rejects text that is not a CSL JSON array": it throws "This file is not a CSL JSON export from Zotero."
    - "reads raw-only dates": `{raw:"2019"}` gives `year: "2019"`.
  - [ ] 2. Run `npx vitest run src/research/cslImport.test.ts`. Expect FAIL.
  - [ ] 3. Implement `parseCslJson`. It accepts a top-level array, or an object with an `items` array.
  - [ ] 4. Run the test again. Expect PASS.
  - [ ] 5. Add the "Import from Zotero…" button beside "Enter manually" in the Sources tab. It opens a hidden `<input type="file" accept=".json">`, reuses the 5 MB limit and fatal UTF-8 decode from `manuscript.ts`, and shows `CslImportPreview`, built on `ModalFrame`. The preview shows:
    - "N sources to add";
    - the skipped counts by type;
    - the duplicate count;
    - the first 10 titles;
    - the buttons "Add sources" and "Cancel".

    "Add sources" appends sources with new ids in one `mutate`. "Cancel" changes nothing.
  - [ ] 6. Add the help text under the button: "In Zotero, right-click a library or collection, choose Export, and pick CSL JSON."
  - [ ] 7. Write and run the e2e test "imports sources from a Zotero CSL JSON file": `setInputFiles` with the fixture, choose "Add sources", and assert both titles are listed.
  - [ ] 8. Commit, only if authorized: `feat: import sources from a Zotero CSL JSON export`.
- Acceptance check: `npx vitest run src/research && npx playwright test tests/research.spec.ts` → all pass.
- Fail-first: step 2.
- Stop and ask if: you're tempted to add a fourth source kind, or to read BibTeX.
- Default if unanswered: skip and count the item, and leave BibTeX out.

### T5 -- Quote capture
- Files: create `src/research/CaptureQuote.tsx` and `src/research/quoteText.ts` with `quoteText.test.ts`. Modify `src/research/ResearchPanel.tsx` and `src/App.tsx:1753-1792`. Add a case to `tests/research.spec.ts`.
- Interfaces produced:
  - `export function cleanPastedQuote(raw: string): string`. It joins a hyphen plus line break ("evi-\ndence" becomes "evidence"), turns other single line breaks into spaces, collapses runs of whitespace, trims, and strips one pair of surrounding straight or curly quotation marks.
  - `export function isBlockQuote(text: string): boolean` is true when `words(text) >= 100`, following Chicago's 100-word guideline.
  - The `onInsertNote` handler in `App.tsx` changes as follows:
    - A quote of 100 words or more inserts a `blockquote` holding one paragraph of the text with no quotation marks, followed by the footnote reference.
    - Shorter quotes keep today's curly quotes.
    - The new footnote is created with `form: "auto"` and no `shortened`.
    - Text and reference go in one `insertContent` chain, so one undo removes both.
- Steps:
  - [ ] 1. Write the failing tests in `quoteText.test.ts`:
    - "joins hyphenated line breaks from PDF copy";
    - "strips one pair of surrounding quotation marks only";
    - "treats 100 words as a block quotation and 99 as inline".
  - [ ] 2. Run `npx vitest run src/research/quoteText.test.ts`. Expect FAIL.
  - [ ] 3. Implement both functions. Rerun. Expect PASS.
  - [ ] 4. Add the "Capture quote" dialog, built on `ModalFrame`:
    - **Opened from:** a "Capture quote" button at the top of the Sources tab, and "Add quote" on each source card. The card button preselects that source.
    - **Fields:** Source (`Dropdown` of sources, required), Quotation (textarea, cleaned with `cleanPastedQuote` on paste), and Page.
    - **Buttons:** "Save to source" adds the `ResearchNote`. "Save and insert" adds it and then calls `onInsertNote`. "Cancel" closes.
    - **Rules:** Escape closes. Focus returns to the opening button.
  - [ ] 5. Write and run the e2e test "captured quote inserts with its citation and one undo removes both" (Review Focus 4):
    1. Capture a quote with page "48" and choose Save and insert.
    2. Assert the editor contains the quote in curly quotes and `.footnote-area` contains ", 48."
    3. Press Cmd/Ctrl+Z once.
    4. Assert both the quote and the reference are gone.
    5. Then run export `documentBlocks` through the existing PDF preview button and assert it shows no error.
  - [ ] 6. Commit, only if authorized: `feat: capture quotes with pages and insert them with citations`.
- Acceptance check: `npx vitest run src/research && npx playwright test tests/research.spec.ts` → all pass.
- Fail-first: step 2. For the undo behaviour, run the step 5 test before changing `onInsertNote`, and record whether it already passes.
- Stop and ask if: one undo doesn't remove both after the change. That would suggest Tiptap history grouping differs from what this plan assumes.
- Default if unanswered: none. You must ask.

### T6 -- Writing goals
- Files: create `src/goals.ts` and `src/goals.test.ts`. Modify `src/model.ts` (Project type and validation), `src/App.tsx` (status line at about lines 1668-1680, and a new Settings section after General at about line 1376), and `tests/features.spec.ts`.
- Interfaces produced:
  - `Project.goals?: { totalWords?: number; dailyWords?: number; deadline?: string }`. The deadline is `yyyy-mm-dd`, and every number is a positive integer.
  - `export function manuscriptWords(p: Project): number` sums `entryWords` over sections only.
  - `export function goalStatus(p: Project, today: string, baseline: number): { total?: {done:number; target:number}; daily?: {done:number; target:number}; daysLeft?: number; perDayNeeded?: number }`.
    - `daily.done` is `max(0, manuscriptWords - baseline)`.
    - `daysLeft` counts today, so a deadline of today gives 1.
    - `perDayNeeded` is `ceil((totalWords - done) / daysLeft)`. It only appears when both the total goal and the deadline are set.
  - The daily baseline is stored in localStorage under `personal-word.goal-baseline.<projectId>` as `{date, words}`. It's set to the current total the first time the project opens on a new local date.
- Steps:
  - [ ] 1. Write the failing tests in `goals.test.ts`:
    - "counts manuscript sections only, not fragments";
    - "daily progress never goes negative after deleting text";
    - "days left counts today and per-day need rounds up";
    - "a past deadline reports zero days left and no per-day figure".
  - [ ] 2. Run `npx vitest run src/goals.test.ts`. Expect FAIL.
  - [ ] 3. Implement the functions. Add the `goals` validation to `model.ts`: an invalid value throws `Error("Invalid writing goals")`. Rerun. Expect PASS.
  - [ ] 4. Add a "Goals" section to the Settings page with three inputs:
    - "Manuscript word goal", a number.
    - "Daily word goal", a number.
    - "Deadline", a date.

    Clearing a field removes that goal. All writes go through `mutate`.
  - [ ] 5. Add the status line text after the word count, using `--` between parts. Show only the parts whose goals are set, for example: "412 of 500 today -- 8,140 of 10,000 -- 6 days left, 310 a day". The span's `aria-label` is "Writing goals".
  - [ ] 6. Write and run the e2e test "daily goal shows progress in the status line": set the daily goal to 10, type 12 words, and assert "12 of 10 today".
  - [ ] 7. Commit, only if authorized: `feat: manuscript, daily, and deadline writing goals`.
- Acceptance check: `npx vitest run src/goals.test.ts && npx playwright test tests/features.spec.ts` → all pass.
- Fail-first: step 2.
- Stop and ask if: the status line overflows at the 850-pixel width used in `tests/accessibility.spec.ts`.
- Default if unanswered: hide the daily and deadline parts below 1000 pixels and keep the total.

### T7 -- Prose check engine
- Files: create `src/editor/proseCheck.ts` and `src/editor/proseCheck.test.ts`.
- Interfaces produced:
  - `export type ProseIssue = { from: number; to: number; kind: "repeat" | "passive" | "filler" | "long"; message: string }`. Offsets are string offsets into the text passed in.
  - `export function findProseIssues(text: string): ProseIssue[]`.
- Rules:
  - **Repeat:** the same word twice in a row, ignoring case ("the the"). Or the same non-stopword of four or more letters appearing again within the next eight words.
  - **Passive:** a form of "be" (am, is, are, was, were, be, been, being) followed by a word ending in "ed", or by an irregular participle from a list of about 40 entries. Adverbs may sit between them, up to two words ending in "ly". Excluded: "is based on", "is related to", and "is used to".
  - **Filler:** a word from a fixed list of 15: very, really, just, quite, basically, actually, simply, somewhat, rather, totally, literally, definitely, certainly, extremely, "in order to".
  - **Long:** a sentence over 40 words. Sentences split on `.`, `?`, and `!` followed by a space or the end of the text. The split skips "e.g.", "i.e.", "et al.", "Mr.", "Dr.", "Ms.", and "St.", and also skips decimals.
  - **Exclusions (Review Focus 3):** text between “ and ”, or between a pair of straight double quotes, is never flagged.
- Steps:
  - [ ] 1. Write the failing tests in `proseCheck.test.ts`, one or more per rule and per exclusion:
    - "flags the the";
    - "flags a repeated content word within eight words but not the";
    - "flags was written and was quickly written";
    - "does not flag is based on";
    - "flags very and in order to";
    - "flags a 41-word sentence and not a 40-word one";
    - "does not split at et al. or e.g.";
    - "never flags inside quotation marks".
  - [ ] 2. Run `npx vitest run src/editor/proseCheck.test.ts`. Expect FAIL.
  - [ ] 3. Implement the rules. Rerun. Expect PASS.
  - [ ] 4. Commit, only if authorized: `feat: local prose check heuristics`.
- Acceptance check: `npx vitest run src/editor/proseCheck.test.ts` → all pass.
- Fail-first: step 2.
- Stop and ask if: you want to add a dependency.
- Default if unanswered: no dependency.

### T8 -- Focus mode and prose check in the editor
- Files:
  - Create `src/editor/writingAids.ts`, `src/editor/writingAids.test.ts`, and `tests/writing-aids.spec.ts`.
  - Modify `src/Writer.tsx` (the editor `extensions` passed to `useEditor`, `ToolbarGroup`/`TOOLBAR_ORDER`/`OVERFLOW_ORDER`, `groupBody`, and `handleKeyDown`).
  - Modify `src/editor/editor.css`.
  - Modify `src/App.tsx` for the global preferences, using the `readPreference` plus `useEffect` pattern.
- Interfaces produced:
  - `export const FocusMode = Extension.create<{ enabled: () => boolean }>`. It adds the class `focus-dim` with `Decoration.node` to every top-level block except the one holding the selection head. It adds nothing when `enabled()` is false.
  - `export const ProseCheck = Extension.create<{ enabled: () => boolean }>`. It runs `findProseIssues` on each textblock's `textContent` and maps the offsets to document positions with `pos + 1 + offset`. It adds `Decoration.inline` with the class `prose-<kind>` and a `title` set to the message. It skips textblocks inside a `blockquote` or `codeBlock` (Review Focus 3).
  - Recomputing runs on doc changes only, debounced 300 ms, and on toggle. Decorations are mapped through transactions in between.
  - Global preferences: `personal-word.focus-mode` and `personal-word.prose-check`, both booleans and both false by default.
  - Both extensions go only into the Writer `useEditor` extensions list. `documentExtensions()` doesn't change.
- Steps:
  - [ ] 1. Write the failing tests in `writingAids.test.ts`, using a headless `Editor` from `@tiptap/react`, which re-exports it (do not import the undeclared `@tiptap/core`) with `documentExtensions()` plus the extensions:
    - "focus mode dims every top-level block except the cursor's";
    - "prose decorations land on the right characters": for "The the cat.", the decoration covers "the" at doc positions 5-8;
    - "decorations never change the saved JSON": `getJSON()` is unchanged with the aids on or off.
    - "prose check skips block quotations and code blocks": "The the" inside a blockquote gets no decoration.
  - [ ] 2. Run `npx vitest run src/editor/writingAids.test.ts`. Expect FAIL.
  - [ ] 3. Implement both extensions. Rerun. Expect PASS.
  - [ ] 4. Add the toolbar group `"aids"`:
    - **Placement:** after `"view"` in `TOOLBAR_ORDER`, and first in `OVERFLOW_ORDER`, so it folds into More first.
    - **Focus mode button:** an icon button, `Focus` from lucide-react, labelled "Focus mode", with `aria-pressed`.
    - **Prose check button:** a `PanelButton` labelled "Prose check". It holds an "On" toggle, a count for each kind, and a list of issues. Each issue is a button showing its text excerpt and message. Choosing one selects that range in the editor and scrolls to it, which gives keyboard access in place of hover tooltips.
  - [ ] 5. Add the Cmd/Ctrl+Shift+F shortcut in `handleKeyDown` to toggle focus mode.
  - [ ] 6. Add the CSS:
    - `.focus-dim { opacity: .35 }`, with a transition that is turned off under `prefers-reduced-motion`.
    - `.prose-repeat`, `.prose-passive`, `.prose-filler`, and `.prose-long` as dotted underlines in distinct colours that meet contrast rules in light and dark mode.
    - Use the existing CSS variables, and add one variable per kind to both theme blocks in `styles.css`.
  - [ ] 7. Write and run `tests/writing-aids.spec.ts`:
    - "focus mode dims other paragraphs and the shortcut toggles it";
    - "prose check lists issues and Enter on an issue selects it";
    - "aids stay off for a new session by default".
  - [ ] 8. Take light and dark screenshots of focus mode and prose check at 1440 by 900. Save them to `test-results/writing-aids/`, which git ignores, and look at them.
  - [ ] 9. Commit, only if authorized: `feat: focus mode and prose check in the editor`.
- Acceptance check: `npm test && npx playwright test tests/writing-aids.spec.ts tests/editor-toolbar.spec.ts tests/accessibility.spec.ts` → all pass.
- Fail-first: step 2.
- Stop and ask if: decorations noticeably slow typing. The test is the existing Writing view in Chromium with a 1,200-word paragraph. Measure the median time per keystroke the same way `docs/validation.md` describes. Stop if it goes above 25 ms, when today's figure is about 17 ms.
- Default if unanswered: limit the prose check to the 20 textblocks around the cursor.

### T9 -- Whole-project Markdown and plain-text export
- Files: create `src/export/textExport.ts` and `src/export/textExport.test.ts`. Modify `src/export/ExportPanel.tsx`, add the filter labels "Markdown" and "Plain text" to `src/export/document.ts:210`, and add a case to `tests/features.spec.ts`.
- Interfaces produced:
  - `export function projectMarkdown(p: ExportProject): string`.
  - `export function projectPlainText(p: ExportProject): string`.
  - Both use `footnoteIdsInOrder`, `resolveNoteForms`, `footnoteText`, and `bibliography` from T1 and the existing code.
- Output order:
  1. Project title.
  2. Each section, in `project.order`, as a heading with its title, then its body.
  3. Notes.
  4. Bibliography, if `documentSettings.bibliography` isn't false.
  5. Fragments.
  6. Research notes.
- Markdown details:
  - The project title is `# `, and section titles are `## `.
  - Heading levels shift down one, capped at `######`.
  - Marks: bold `**`, italic `*`, strike `~~`, code `` ` ``, and links `[text](href)`. Underline is plain text.
  - Lists use `-` and `1.`, nested with two spaces, and honour the start number.
  - Blockquotes use `> `. A page break becomes `---`.
  - A footnote reference becomes `[^n]`, and the notes are `[^n]: text`.
  - Section titles and text escape `\ * _ [ ] # `` ` ``.
  - Fragments go under `## Fragments` and research notes under `## Research notes`. A quote shows as `> text` followed by its source and page.
- Plain text details:
  - Same order, with titles underlined by `=` and `-`, and references written as `[n]`.
  - Notes are listed as `n. text` under "Notes".
- Steps:
  - [ ] 1. Write the failing tests in `textExport.test.ts`:
    - "exports sections in order with titles and numbered notes";
    - "auto short notes match DOCX numbering": reuse T3's two-citation project and assert note 2 is short;
    - "escapes Markdown characters in section titles" (Review Focus 5): the title "#1 [draft] *notes*" survives a `parseManuscript` re-import as one heading;
    - "includes bibliography, fragments, and research notes";
    - "plain text has no Markdown syntax".
  - [ ] 2. Run `npx vitest run src/export/textExport.test.ts`. Expect FAIL.
  - [ ] 3. Implement both functions. Rerun. Expect PASS.
  - [ ] 4. Add the buttons "Export Markdown" and "Export plain text" to `ExportPanel` beside "Export DOCX". They call `saveExport(new Blob([text], {type}), safeFilename(title) + ".md" or ".txt")`. Extend the filter in `saveExport` so `.md` reads "Markdown" and `.txt` reads "Plain text". Leave the read-mode "Export plain text" button as it is.
  - [ ] 5. Write and run the e2e test "exports the project as Markdown": click the button, `waitForEvent("download")`, and assert the file contains `## Introduction` and `[^1]`.
  - [ ] 6. Commit, only if authorized: `feat: export the whole project as Markdown or plain text`.
- Acceptance check: `npx vitest run src/export && npx playwright test tests/features.spec.ts` → all pass.
- Fail-first: step 2.
- Stop and ask if: the existing DOCX/PDF tests change, because they shouldn't.
- Default if unanswered: none. You must ask.

### T10 -- Documentation and native check
- Files: modify `docs/personal-word-v2.md` (Delivered workflows and Important boundaries), `docs/validation.md` (a new dated section), `README-draft.md` (workflow and limitations), and `ROADMAP.md`. Do not edit `README.md`, which belongs to the other agent's pass.
- Steps:
  - [ ] 1. Document each feature and its limits. The limits to state:
    - Only CSL JSON is supported, never BibTeX.
    - Short notes don't restart per chapter, and "ibid." is never used.
    - The prose check uses simple word rules and makes mistakes.
    - Goals count manuscript sections only.
    - Markdown export doesn't round-trip footnotes.
  - [ ] 2. Run the native smoke build and script exactly as listed under "Reproduce" in `docs/validation.md`, and record the outcome. If macOS blocks the GUI the way it did on 2026-10-17, record that and skip it. Don't claim native verification.
  - [ ] 3. Commit, only if authorized: `docs: record writer features and their limits`.
- Acceptance check: `grep -n "CSL JSON" docs/personal-word-v2.md README-draft.md` → at least one line in each file.
- Fail-first: n/a. This task is documentation only.
- Stop and ask if: native smoke fails for a reason other than the known macOS service errors.
- Default if unanswered: record the failure as is, and stop.

## Validation (after all tasks, in order)

1. `npm run build` → exits 0.
2. `npm test` → all pass, with the count above the T0 baseline.
3. `npx playwright install chromium && npm run test:e2e` → all pass.
4. `cargo test --manifest-path src-tauri/Cargo.toml` → all pass. No Rust files changed, so this guards persistence of the new metadata through the existing flatten test.
5. `npm run render:export-fixtures`. Then open the DOCX and PDF fixtures and confirm that projects without `autoShortNotes` render exactly as before. Use the same QuickLook inspection as `docs/agent-work/2026-10-18-completion/export-log.md`.
6. Look at the light and dark screenshots from T8 step 8.
7. `npm run tauri build` → report the resulting `Personal Word.app` path.
8. Run `independent-review` to produce `REVIEW.md`, then `review-repair`.

## Risks and rollback

- **Silent export change for existing projects.** Mitigation: `autoShortNotes` is absent, and therefore off, in existing projects. T3's stop condition guards it, and Validation step 5 checks it.
- **Typing speed with decorations.** Mitigation: the T8 stop condition and its fallback.
- **New project metadata (`goals`, `form`, `shortTitle`, `cslId`, `autoShortNotes`).** Every field is additive and optional and passes through Rust `extra`. Rollback is to revert the TypeScript changes. Old builds ignore the new fields, and the `shortened` flag still works.
- **No destructive operations anywhere.** The import only appends sources, and Cancel changes nothing.

## Open questions for the user

1. **Existing projects:** should "shorten repeat citations" stay off in existing projects until you turn it on? Default: yes, off, so their exports don't change.
2. **Markdown export scope:** should it include fragments and research notes after the manuscript? Default: yes, as appendices, because this export is about not being locked in.
3. **Prose check categories:** repeated words, passive voice, filler words, and long sentences. Add or drop any? Default: all four, with the check off until you turn it on.
4. **Daily goal reset:** the daily goal resets at local midnight. Default: midnight.

## Notes for the implementer (traps, things NOT to do)

- Don't add `FocusMode` or `ProseCheck` to `documentExtensions()`. That function also builds the import-validation schema.
- Don't rename the `shortened` field or remove its handling. Old projects still use it.
- Don't touch `src-tauri/src/store.rs`. Nothing in this plan needs a new node or mark.
- Notes stay numbered by first appearance across sections only. `project.order` never holds fragments, so the editor and export walks already agree.
- Never rewrite punctuation inside the user's text. Only `cleanPastedQuote` touches text, and only on paste into the capture dialog.
- Use `--` for UI separators. Every new hover tooltip needs a keyboard path: the T8 issue list covers the prose check.
- Each Playwright spec defines its own `create` helper. Copy the one in `tests/features.spec.ts:2`.
- Model choice per task: offer the `pick-model` skill before starting.
