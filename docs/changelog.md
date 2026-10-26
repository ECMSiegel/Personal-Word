# Personal Word changelog

Dated history, newest first, built from `git log --date=short` and [app history](app-history.md). [app-history.md](app-history.md) already gives a fuller narrative for 2026-10-14 to 2026-10-18 (including what each pass did and did not verify), so this file links to it rather than repeating it. Fixed issues are listed with dates in [limitations](limitations.md). Verification details are in the [validation record](validation.md).

## 2026-10-26

- UI polish wave (tasks T071-T096, each independently reviewed; CLAIMED, final validation pending T082): native screenshot tool (`scripts/native-screens.py`), type-scale and spacing tokens, complete hover/focus/pressed/disabled states, `docs/design-system.md`, Appearance (System, Light, Dark; Cmd/Ctrl+Shift+L) and Palette (Plain, Color) settings with the Mac title bar following the choice, helper captions removed, Projects screen search, the Start new project button growing into a panel (templates, Import a file…, Recover from a project.json file…), drag-and-drop import onto the Projects screen.
- Critique pass and its fixes: create-panel items no longer fade in, short Projects lists centred, sidebar entry title/count hierarchy, move arrows no longer cover the count, remaining captions replaced by a tooltip, Goals selects use the app dropdown, sidebar labels fit at 190 px. Plain-dark primary button contrast (2.45:1) is recorded, not changed.
- README, design system, architecture, limitations and validation record updated.

## 2026-10-25

- Cheap-fixes wave (T050-T057, each independently reviewed): import size label, "newer version of Folio" error text, notice toast position and auto-dismiss, PDF image gap, Word and PDF exports now print project and section titles, BibTeX "Jr." suffix, browser-preview Zotero fetch, import cancel test coverage; full validation list rerun and the app rebuilt (commit `4659847`).
- Quick start added below the project description in the README (`72732d8`).
- Owner acceptance: the owner confirmed all nine real-use checks; Personal Word marked **beta** (`d499b88`).
- README refreshed for the completed beta board and owner decisions; owner answers to board questions Q001-Q004 recorded (`6f3027c`, `d95b6d0`). Q005 (Chicago first-page title) answered the same day.
- Beta board completed: waves 3-5, Gates B-D, fresh normal app build; native print probe stopped and the legacy PDF exporter kept; T043 multi-paragraph footnotes in Word and PDF export.

## 2026-10-24

- Wave 0 work (image assets, tables, BibTeX, Markdown notes) checkpointed as unreviewed, and the delegation baseline pointed at that checkpoint.
- D1 native durability run completed and stale portable copies repaired.

## 2026-10-23

- Beta roadmap work checkpointed after independent review. Signing and downloadable distribution removed from beta scope by the owner.

## 2026-10-20

- Current source alpha qualified and release evidence refreshed.

## 2026-10-19

- Local source alpha prepared; deadline, citation and text export edge cases repaired.
- Alpha URL handling and sidebar selection hardened; DOCX hyperlinks restricted to http, https and mailto links.
- Reviewed source-alpha evidence and privacy audit finalized; PDF font format wording in THIRD_PARTY corrected.

## 2026-10-18

- Writer features: short notes, Zotero CSL JSON import, quote capture, writing goals, prose check, whole-project text export.
- Completion pass: Markdown import with preview, bundled Noto font subsets for PDF, DOCX XML checks, keyboard-focusable dropdown, three-phase isolated native smoke harness; writing workflow qualified and source release prepared.

## 2026-10-17

- Sidebar reorganized: collapse chevrons, features at the bottom, no switch arrow or placeholder. Bounded save scheduling, plain-text import, list/strike export support and an advisory single-instance lock.

## 2026-10-16

- Workspace update: project tabs, page view, templates, research with Chicago citations, DOCX/PDF export, comments, fragments, revision comparison.
- One-row toolbar, flat dropdowns, Word-style indent, research rework with citation lookup.
- Editable footnotes, fragment split view, visual polish.
- Durability: recovery lockouts fixed, project delete and rename added, Personal Word UI; saves now write only changed entries, projects rebuild from entry rows, history is time-bucketed; per-section saves merged.

## 2026-10-14

- Initial Folio local-first writing workspace and durability checks: projects, sections, rich-text editing, SQLite persistence, recovery journaling, snapshots, portable copies.
