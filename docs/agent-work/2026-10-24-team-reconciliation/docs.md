# T020 -- Beta documentation from current evidence

Agent: agent-ac43 (Claude Sonnet worker), 2026-10-25. Status: **CLAIMED** (documentation only; no product code, test, `HANDOFF.md` or `REVIEW.md` file changed; nothing committed). Start hashes and mtimes of the registered paths: `node_modules/.cache/personal-word-beta/team-t020/start-state.txt`.

## Method

Evidence read: `wp1.md`-`wp8.md`, `wave3-integration.md`, `keyboard.md`, `gate-a.md`, `gate-b.md`, `gate-b-repairs.md`, `feasibility.md`, `gate-c.md`, `wp11-matrix.md`, `artifact-acceptance.md`, `T003/T004/T005_REVIEW.md`, `zotero-status.md`, `team/DECISIONS.md`, `team/QUESTIONS.md` (Q001-Q004 open), the coordinator `CHECKPOINT.md`, and the task logs on the board. Four files were already edited outside the board (`docs/validation.md`, `docs/architecture.md`, and also `README.md` and `docs/recovery.md`, which the task did not list); each was diffed against `git show HEAD:<path>`, and the draft text was kept only where a board report supports it. No number was taken from a draft.

## Per file

| File | What changed | Why / evidence |
|---|---|---|
| `docs/validation.md` | The off-board section "Beta Durability & Verification Qualification" (from line ~256) was replaced by "2026-10-25 beta board -- evidence by kind". Removed: "qualified", "print probe integration" as a passed item, 818/44, 38 Rust, 18 + 8 native, "evidence manifest verified" and "clean release build" as passed, the unmeasured 119.71/128.39/149.94 ms figures. Added: tsc 0; 858 in 46 files; Rust 48 / 1 ignored; native baseline 13 + 5 (`20261025T084201Z-0cea2da3`), beta 19 + 42 (`20261025T084244Z-642b9c8a`), review rerun `20261025T084746Z-dadedb9c`; per-suite browser counts with task IDs and an explicit statement that no consolidated final-tree browser count exists; rendered artifacts (T019); the WP8 STOP with probe run IDs; the release benchmark; a "Still pending" list (T021, T022, T023, T043, owner). Four evidence kinds are separated at the top. | `wp11-matrix.md` sections 5-6, T042 note on T018, `gate-b.md`, `wave3-integration.md`, `gate-b-repairs.md`, `keyboard.md`, `gate-a.md`, `artifact-acceptance.md`, `wp8.md`, `feasibility.md`, `gate-c.md` (F2 asked for exactly this). Earlier dated sections left untouched. |
| `README.md` | "Alpha status" rewritten as dated subsections (beta board 2026-10-25, not done yet, earlier October checks kept as history). Limitations: page-break bullet now says no parity and describes the Preview PDF and the print-probe STOP (Q004); PDF bullet gains table header row, image gap and T043; import bullet rewritten per format (text/Markdown 5 MB literal images and tables; HTML/DOCX/zip 20 MB; pre-inflation checks; Q003; XML DOCTYPE; the "up to 20 MB" label wording); Zotero bullet gains Jr., refresh limits and the unapproved browser fetch path; Markdown footnote bullet points at T043; new bullets for omitted titles and small known issues; saving bullet uses T018's numbers and drops "guaranteed". Workflow steps mention BibTeX and the bundle export. | Off-board README text claimed "~125 / ~147 ms", 400-500 ms, and "Imports preserve structure and assets" without per-format limits. Sources: `wp11-matrix.md`, `gate-b.md` B3-B6, `artifact-acceptance.md`, `feasibility.md`, `wp6.md` (C3 gaps), `src/import/manuscript.ts:7,67`, `src/import/importLimits.ts:4-5`, `src/components/ProjectLibrary.tsx`. |
| `docs/architecture.md` | Off-board mirror and benchmark text kept in structure, wording corrected: "guarantees" replaced by the Rust test and native scenario that cover it; latency replaced by T018's numbers; "excluded by design" replaced by "not claimed". Added rich-import, BibTeX/Zotero, exporter (images, tables, bundle, omitted titles) and native-print-STOP paragraphs. "advanced tables/images" and "native hard-kill" in the risks paragraph made precise. | `store.rs` schema lines 22-30 (assets table columns confirmed), D1 finding 6, `wp11-matrix.md`, `gate-b.md`, `gate-c.md`. |
| `docs/recovery.md` | Backup step corrected: the button writes a version 2 `.json` archive with embedded images (the draft named a `.personal-word` archive the app does not produce, `src/App.tsx:1671-1680`); the Markdown bundle is not a full backup. Limits section rewritten: checkpoint kills described as narrower than a real shutdown, T018's measured numbers, "guaranteeing durable persistence" removed. | `wp11-matrix.md` sections 3-5, 8. |
| `docs/publication-readiness.md` | Dated "2026-10-25 beta board note" inserted; the October 19-20 qualification stays as history and is labelled as such. | `gate-c.md`, `wp11-matrix.md`; T021/T022 still open. |
| `docs/personal-word-v2.md` | Import bullet, PDF preview wording ("in-app PDF preview" now the legacy Preview PDF), boundary 2 (STOP, no parity), PDF/DOCX known issues, network-use sentence (optional loopback Zotero), Zotero and "Markdown does not round-trip footnotes" bullets corrected with dates; dated "Beta board -- 2026-10-25" section appended. | `wp4.md`/`T004_REVIEW.md`, `wp5.md`, `wp6.md`, `wp7.md`, `gate-c.md` section 3. |
| `ROADMAP.md` | Item 2 and 3 and the Oct 18 BibTeX sentence amended (history kept); dated "2026-10-25 beta board" section added with what is done and what is open. | as above. |
| `docs/agent-work/2026-10-20-beta-roadmap/IMPLEMENTATION_LOG.md` | Dated board-outcome section appended. | all board reports; earlier entries not edited. |
| `docs/agent-work/2026-10-20-beta-roadmap/06-durability/IMPLEMENTATION_LOG.md` | Dated T020 section appended (what durability wording changed and why). | `wp11-matrix.md`; the T018 section above it is untouched. |

## Retained limitations recorded (with pointers)

PDF tables do not repeat the header row (`artifact-acceptance.md` section 3, 8); BibTeX "Jr." only in raw `cslData` (`bibtexImport.test.ts:95-104`); XML check blocks only external DOCTYPEs (Gate B B3); understated zip headers rejected only after inflation (B4, Q003 open); Zotero C3 gaps, unapproved browser fetch path, refresh off by default / loopback / read-only / reviewed (`wp6.md`, B5, B6); mid-parse cancel: wired by T032, a signal-ignoring parse only wastes work and leaving the screen is not covered (`gate-b-repairs.md`); Chromium-only browser evidence; no hosted CI; no WebKit rendering qualification; owner real use pending.

## Observations from T019 recorded as known issues

DOCX and PDF omit project and section titles; PDF images stack with no gap; a toast can cover Export PDF; `src-tauri/src/store.rs:174` says "newer version of Folio" (product name mismatch; not edited). Also noted, not edited: the import button label says "up to 20 MB" for all formats while text/Markdown are capped at 5 MB.

## T043

`python3 team/team.py show T043` was run last: status **done** (repaired by agent-0743, independently approved by agent-7cc8). The documents word it as "repaired and independently reviewed" and give the residual notes: Word rendering unchecked, DOCX continuation paragraphs unindented while PDF's are indented. The counts 858 / 48 predate T043; its own reviewer run (180 passed in the export files, tsc 0, build 0) is cited in `docs/validation.md`.

## Verification

- Stale-phrase sweep (`grep -n -i` for print preview, native typography, exact pdf, beta ready, text-only, text only, no images, BibTeX, does not handle images, in-app PDF over README, ROADMAP and the five docs): every remaining hit is either new board text or an accurate statement (for example plain `.md` import still keeps images and tables as literal text, `src/import/manuscript.ts:67`; its 5 MB cap is reached through the `previewWriting` fallback, `docxImport.ts:895`).
- No placeholder markers remain (`grep -rn "@@"` over the edited paths is empty). HTML notes are claimed on the strength of `htmlImport.ts:155-161` (footnote section detection) only; DOCX (T019 screenshot 06) and bundle (8 notes) are executed evidence.
- The one long dash in `docs/architecture.md` additions is the inherited off-board "SQLite is the source of truth" line (also in HEAD), not authored by T020.
- End state (hashes, line counts): `node_modules/.cache/personal-word-beta/team-t020/end-state.txt`; start state beside it.

## Deliberately left

- `HANDOFF.md` (still carries the stale 347/499 ms line; T023 owns it) and all `REVIEW.md` files.
- `docs/distribution.md`, `CONTRIBUTING.md`, and every dated historical section in the edited files.
- The `projectArchive.test.ts` stale `vi.mock("./model")` (wp11-matrix section 9) -- test code, not documentation.
- `team/PLAN.md` Definition-of-done boxes.
- Nothing was built or tested: no build, test, probe or benchmark. All numbers are quoted from the reports named above. I ran read-only inspection (grep, git diff/show, stat, shasum) and Python string replacements on the registered paths.

## Could not evidence

- No consolidated final-tree browser suite count exists anywhere on the board; documented as absent, not summed.
- The "Settings > Advanced" Zotero menu label in the Connect hint is unverified (`gate-b-repairs.md` T033).
- Whether the counts 858 / 48 still hold after T043's export edits: not run by this task.
- The README's "Tested on macOS 15" row and "Apple silicon not hand-tested" are inherited, not re-checked.
