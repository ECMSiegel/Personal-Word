# PLAN -- Word and section counts on the Projects page
Date: 2026-11-16 | Architect: Claude Code / Fable | Project: Project 13 - Word Processor | Status: APPROVED (owner chose "Word and section counts", 2026-11-16)

## Goal
Each project on the Projects page shows how many words and sections it holds, in list and cards view, in the browser preview and in the real app.

## Request
Owner picked, from the parked wave-8 Projects ideas: "Word and section counts" -- rows read like "12,400 words -- 6 sections -- edited Nov 4".

## Definition of done
- A project row and card show "Edited <date>", then "12,400 words", then "6 sections", then "Added <date>". Singular forms "1 word", "1 section".
- Counts cover manuscript sections only (entries of kind "section", which includes those under custom headers); fragments and research are not counted.
- Counts are right after any save, without reopening the app.
- A project saved before this change shows no counts (no "0 words", no blank gap) until it is next saved.
- Nothing else on the Projects page moves; existing Projects specs pass.

## Non-goals
Sorting by word count; counts for fragments or research; backfilling old projects at launch; a column layout or tabular figures; relative dates; the "Continue writing" row.

## Context (verified unless marked)
- `Summary` is `Pick<Project, "id" | "title" | "updatedAt"> & { createdAt? }` -- `src/model.ts` near the `Summary` export (reported at `:65`; line moved, find by name: inferred).
- Browser list parses every stored project and maps it to `{ id, title, createdAt, updatedAt }` -- `src/storage.ts:41-54` (verified).
- Desktop list returns Rust `Summary { created_at, id, title, updated_at }` built from `read_header` -- `src-tauri/src/store.rs:82-89`, `:214-222` (verified).
- Rust `Header` carries `#[serde(flatten)] extra: serde_json::Map<String, Value>` -- `src-tauri/src/store.rs:58-70` (verified). So a `wordCount` / `sectionCount` number the frontend puts on the header is stored and comes back in `h.extra` (inferred).
- A save sends `Change { header, entries, base_revision }` -- `src-tauri/src/store.rs:73-79`; the frontend builds the header somewhere in the save path (`src/storage.ts:67-70` uses `change.header`): where exactly is unknown, T2 finds it.
- Row markup: title, then `.project-dates` with `.project-edited` "Edited ..." and a plain span "Added ..." -- `src/components/ProjectLibrary.tsx:368-371` (verified).
- Rust `Entry` has a plain `text` field beside `content` -- `src-tauri/src/store.rs:36-42` (verified); whether the TS `Entry` has the same plain text and whether a word counter already exists (word goals feature) is unknown: T1 greps.
- `tests/w9-projects-page.spec.ts` pins "Edited leads"; `tests/projects-screen.spec.ts` pins toolbar position and trash (reported by research: inferred).

## Rules in force
- Project metadata must survive native serialization, incremental saves, recovery journals, snapshots, imports and exports; additive fields ride the flattened maps -- `AGENTS.md` (Preserve writing).
- Run native cargo tests for affected persistence -- `AGENTS.md`.
- No new margin/padding/gap/height declarations; `src/layoutBudget.json` only goes down -- `AGENTS.md`.
- UI dash separators are "--"; all interface text follows the existing type tokens -- `AGENTS.md`.
- Never delete user projects or recovery data; isolated test storage only -- `AGENTS.md`.
- Shared files are edited in small regions; fail-first for new tests; serial lock for Playwright -- `HANDOFF.md`, workspace `AGENTS.md`.

## Approach
The frontend computes the two numbers with one pure function. The browser list calls it directly; the desktop save stamps them on the header, and the Rust list copies them out of the header into its summary. No migration, no extra database reads.
- Rejected: Rust counting words at list time -- reads every entry of every project on each visit.
- Rejected: a backfill pass at launch -- touches every project file for a cosmetic number.

## Tasks
### T1 -- The counting function
- Files: create `src/projectCounts.ts`, `src/projectCounts.test.ts`; modify `src/model.ts` (the `Summary` type only).
- Interfaces: provides `export function projectCounts(project: Pick<Project, "entries">): { wordCount: number; sectionCount: number }`; `Summary` gains `wordCount?: number; sectionCount?: number`.
- Steps:
  1. Grep `src` for an existing word counter (the word-goal feature has one); reuse it if it takes plain text. Otherwise count with `text.trim().split(/\s+/).filter(Boolean).length`.
  2. `sectionCount` = entries whose `kind === "section"`; `wordCount` = words in those entries' plain text.
  3. Tests: empty project -> 0 / 0; two sections and a fragment -> only sections counted; whitespace-only section -> 0 words, 1 section.
- Acceptance check: `npx vitest run src/projectCounts.test.ts` -> pass; `npx tsc -b` -> exit 0.
- Fail-first: run the test before the file exists -> import failure.
- Stop and ask if: TS entries have no plain-text field and counting needs a walk of the rich-text JSON with no existing helper.
- Default if unanswered: none -- must ask.

### T2 -- Carry the counts through both storage paths
- Files: modify `src/storage.ts` (browser `list`, about `:43-52`), the frontend function that builds the save header (find the producer of `Change.header`; expected in the save queue or `src/storage.ts`), `src-tauri/src/store.rs` (`Summary` at `:82-89`, the list loop at `:214-222`, plus one test).
- Interfaces: uses `projectCounts`. Header JSON keys are exactly `wordCount` and `sectionCount` (numbers). Rust `Summary` gains `pub word_count: Option<u64>` and `pub section_count: Option<u64>`, each with `#[serde(skip_serializing_if = "Option::is_none")]`.
- Steps:
  1. Browser `list`: add `...projectCounts(project)` to each mapped summary.
  2. Save header: stamp `wordCount` and `sectionCount` from the project being saved, every save.
  3. Rust list: `word_count: h.extra.get("wordCount").and_then(Value::as_u64)`, same for sections.
  4. Rust test: a header saved with the two keys lists them; a header without them lists `None` and serializes without the keys.
  5. Confirm `load_project` then save round-trips cleanly: the two keys may appear on the loaded `Project`; `validateProject` must accept them and the next save must overwrite, not duplicate, them.
- Acceptance check: `cd src-tauri && cargo test` -> all pass, including the new test; `npx vitest run` -> all pass.
- Fail-first: write the Rust test and a storage unit test (browser list returns counts) first -> both fail.
- Stop and ask if: `validateProject` or the Rust header validation (`validate_header`, `store.rs` about `:1075`) rejects unknown keys; or stamping the header changes the revision or dirty logic so an unchanged project re-saves.
- Default if unanswered: none -- must ask.

### T3 -- Show the counts
- Files: modify `src/components/ProjectLibrary.tsx:368-371` (small region), `tests/w9-projects-page.spec.ts` (add tests).
- Interfaces: uses `Summary.wordCount`, `Summary.sectionCount`.
- Steps:
  1. Inside `.project-dates`, between the Edited span and the Added span, render `<span className="project-words">{n.toLocaleString("en-US")} words</span>` and `<span className="project-sections">{n} sections</span>` (singular at 1), each only when its number is defined. They take the same muted look as the Added span: no new CSS unless a rule is needed, and then no margin/padding/gap/height.
  2. Tests: a project with three sections and known text shows the exact strings in list and in cards view; a summary without counts (seed a stored project, then delete the keys is not possible in the browser path, so unit-test the row with an undefined count instead, or assert via a mocked listing) renders neither span; the "Edited leads" test still passes.
- Acceptance check: under the serial lock, each as its own command: `tests/w9-projects-page.spec.ts`, `tests/projects-screen.spec.ts` -> all pass; `npx vitest run src/layoutPrimitives.test.ts` -> pass.
- Fail-first: add the tests before step 1 -> they fail.
- Stop and ask if: the extra spans wrap the dates line or push the trash icon in list view at the default window width.
- Default if unanswered: keep the spans and let the line truncate with the existing ellipsis rule; report it with a screenshot.

## Validation (after all tasks, in order)
1. `npx tsc -b`; `npx vitest run`; `cd src-tauri && cargo test` -> all pass.
2. Under the lock: the two Projects specs, each alone.
3. Coordinator: Opus review, then the batch's single full-suite run and release rebuild.
4. Owner by hand in the real app: open Projects (old projects show no counts), open one, type a word, go back -> counts appear and are right.

## Risks and rollback
- The two keys become part of every saved header and may appear in JSON exports of a project: additive and ignorable.
- Old builds ignore the keys. Rollback is reverting the listed files; stored keys are harmless.

## Amendment 2026-11-16 (coordinator) -- counts computed at list time
The chosen approach (stamping `wordCount`/`sectionCount` on the saved header) is WITHDRAWN. The full browser suite failed four restore/re-save tests (research-library:130, :176; revisions:23; split-view:475): a re-send of an already-saved revision went out with a header that differed from the stamped copy on disk, and the save was refused as a conflicting revision. Replacement: the save path is restored to exactly what it was; the browser list computes counts from the stored project (as before), and the Rust list counts words in the `section` entries it reads from the project's database. Old projects therefore show counts at once. The "Rejected" note in Approach about Rust counting at list time no longer applies.

## Open questions for the user
none

## Notes for the implementer (traps, things NOT to do)
- Start only after the motion worker has finished with `src/components/ProjectLibrary.tsx` and the card-title worker with `tests/w9-projects-page.spec.ts` (the coordinator starts you).
- Never open the owner's real projects; never commit, stash, reset, clean or install. Record evidence in `IMPLEMENTATION_LOG.md` in this folder.
- `touch src-tauri/src/lib.rs` is only for smoke/release builds; `cargo test` needs nothing special.
