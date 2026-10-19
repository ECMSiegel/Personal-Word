# REVIEW — Writer features (automatic short notes, Zotero import, quote capture, goals, prose check, whole-project text export)

Reviewer: OpenCode (DeepSeek V4.1 Flash) — independent sub-agent, read-only | Range: `d8aa72c` (`Complete writing workflow qualification and prepare source release`) .. working tree, uncommitted | Date: 2026-10-18

Artifacts read: `docs/agent-work/2026-10-18-writer-features/PLAN.md` (519 lines), `IMPLEMENTATION_LOG.md` (whole file, incl. "Resume pass"), `HANDOFF.md`, `the workspace AGENTS.md`, project `AGENTS.md`, and the real diff (`git status --porcelain=v1`, `git diff d8aa72c --stat`, per-file diffs, plus every untracked new file read directly).

## Verdict: APPROVE (ready to commit locally; D1 and R1 should go straight into `review-repair`)

Both claimed resume-pass fixes hold, verified by fresh runs and by runtime probes, not just by the log:

- **Fix 1a (decoration spec)** — `npm run build` exits 0 (was `TS2339`), and the runtime behaviour is genuinely preserved: an independent Chromium probe drove the running dev server and read the DOM, which contains `<span class="prose-repeat" title="Repeated word: the">the</span>` and a panel entry "the" / "Repeated word: the". `prosemirror-view`'s `InlineType` keeps `attrs` and `spec` separate (`node_modules/prosemirror-view/dist/index.js:4008-4012`), so `attrs = {class, title}` still becomes the DOM class/title and `spec = issue` carries kind/message to `src/Writer.tsx:886`.
- **Fix 2 (validateProject type checks)** — the three fail-first cases are real (`/tmp/pw-writer-metadata-before.log`: 3 failed / 14 passed, failing exactly the three new tests), the checks are present-only and additive, and no other field shape exists in the tree that they would now reject (grep over all `.json`/`.ts`/`.tsx`/`.rs`: no fixture stores `shortTitle`/`cslId`/`autoShortNotes` in any other shape; `cslImport.ts:105` coerces ids through `String()`). Legacy projects with the fields absent still load — the two fallback literals and `mergeMissingResearch` were deliberately left absent-flag.

All four re-run validation commands pass on this machine. No plan rule was broken: zero deletions in any test/spec file, no new Tiptap node or mark, `src-tauri/` untouched, `package.json` untouched, `README.md` untouched, no `folio.*`/`com.folio.writing` identifier renamed in `src/`.

Two non-blocking findings (one Medium defect, one Medium risk) and several Low observations are listed below; none of them invalidate a re-run.

## Findings

### Defects

| # | Severity | Where (file:line) | Finding | Evidence | Required action |
|---|---|---|---|---|---|
| D1 | **Medium** (implementation defect) | `src/research/citations.ts:61` + `:118-126` | A **shortened** note for a source with an **empty title** renders as a bare ".". T2 introduced `shortTitle(s)`, which returns `s.title` (="") when there is no `": "`/`"? "` break, bypassing the `s.title \|\| "[Untitled source]"` fallback that line 60 builds. Full notes still print `[Untitled source]`; short notes print nothing, then the locator part, leaving "." | Reachable in 4 UI actions on a brand-new project (auto-short is ON by default): Start new project → Blank → Research → "Enter manually" (creates `{title: ""}`, see `ResearchPanel.tsx:237-245`) → "Cite here" ×2 → Close research. My independent Chromium probe read `.footnote-area` as: `"1\n[Untitled source] ().\nSource details\n2\n.\nSource details"` — note 2 is just ".". Not covered by any test (`citations.test.ts` only uses titled sources) | One line: `const noteTitle = short ? (shortTitle(s) \|\| title) : title;` (line 61). Add a fail-first case: untitled book, `formatCitation(s,"short","48")`. (Note: pre-existing, unrelated oddity — the *full* note prints `[Untitled source] ().`) |

Nothing else in the diff produces wrong output that I could reach or read. In particular, no path drops or rewrites project/entry/research metadata: every mutation spreads the previous object (`App.tsx:1111-1143`, `:1280-1293`, `:1681-1687`, `:1993-2006`; `operations.ts:59`), and CSL ids/titles/authors are always strings.

### Risks / observations

| # | Severity | Where | Finding | Evidence | Required action |
|---|---|---|---|---|---|
| R1 | **Medium risk** | `src/editor/writingAids.ts:20-38`; `src/Writer.tsx:883-917` | The prose check has **no cap on decoration count**, and the plan's named fallback ("limit the prose check to the 20 textblocks around the cursor") was **not implemented**. Cost is driven by the number of issues, not document length | Independent Chromium measurements against the running dev server (aids off vs on, same session, dev server, heavily loaded machine ≈ load avg 30-58 — the *delta* is the signal, absolute ms are inflated): 1,000-word block with ~1,000 filler/repeat hits → off ≈ 155 ms, on ≈ **1,007 ms** per keystroke; 5,000-word block with 9,995 decoration spans → off ≈ 122 ms, on ≈ **7,700 ms**; 12,000 words with 1 issue (`Long 1`) → off 183 ms, on 151 ms (no measurable added cost). The implementer's measurement could not have seen this: `scripts/tmp-writer-aids-measure.mjs` builds a 12-word repeating vocabulary that yields ~0 issues (the log's own panel probe on that text reports `Long 1`) | Either implement the plan's 20-textblock fallback, or record the limitation explicitly in `docs/validation.md` (the plan's 25 ms stop condition was tested only with issue-free text). Not reachable by ordinary prose; reachable by pasting/typing a rough draft dense with filler |
| R2 | Low (evidence/process) | `IMPLEMENTATION_LOG.md:112` | The log's headline suite total is stale: it reports `npm test` **143/143** as a post-fix result, but the 3 resume-pass `model.test.ts` cases were written at 16:48, after that 16:43 run. The current tree is **146** tests, and no log entry records a full-suite run after the metadata tests were added | Fresh run: 146 passed / 17 files. File mtimes: `src/model.test.ts` 16:48:24 vs `/tmp/pw-writer-final-unit.log` 16:43 | Correct the log figure (or add the fresh full-suite line) |
| R3 | Low (pre-existing) | `src/App.tsx:1138-1141`; `src/research/quoteText.ts:13-15` | A **manually typed** multi-line quotation inserts a literal `"\n"` inside a text node. Only paste is cleaned (`cleanPastedQuote`); `quoteTextForStorage` trims only, so Enter inside the Quotation textarea keeps the newline | Probe `textContent` of `.writing-surface`: `"Evidence here.“first line\nsecond line”1"`; no page error, no validation failure. The old note textarea had the same property, so this is not introduced here — but DOCX/PDF runs now receive a raw newline and the capture dialog makes multi-line typing more likely | Split on newlines into `hardBreak` nodes when building `insertion` in `insertResearchNote`, or state the limitation |
| R4 | Low | `src/goals.ts:22-23` | When the total goal is already exceeded, `perDayNeeded = ceil((totalWords - done)/daysLeft)` goes negative and the status line can show e.g. "-3 a day" (`App.tsx:1797`) | Code reading; no test covers `done > total` | Clamp at 0 or omit when `done >= totalWords` |
| R5 | Low (a11y) | `src/research/CaptureQuote.tsx:35` | `<label htmlFor="capture-source">Source</label>` points at no element id (`Dropdown` ignores it), so that label association is broken. The flow is still keyboard-reachable via the dropdown's own `aria-label="Source"` | e2e `tests/research.spec.ts:189-190` uses `getByRole("button", { name: "Source" })` and passes | Pass an id through to `Dropdown`, or drop the stray `htmlFor` |
| R6 | Info | `src/research/quoteText.ts:13,17`; `CslImportPreview.tsx:4`; `operations.ts:59` | Minor scope beyond the plan's named interfaces: two extra exports (`quoteTextForStorage`, `pasteIntoQuote`), a `busy` prop, and the `operations.ts` one-line fix. Only `operations.ts` leaves the plan's file list, and that is justified, tested and logged (`IMPLEMENTATION_LOG.md:87`) | `git diff d8aa72c --stat`; log | None |
| R7 | Info | `src/research/ResearchPanel.tsx:25` | `emptyResearchData` is a module-level object used as a default prop (a shared mutable singleton). Safe today because every update spreads it, but `emptyResearch()` was previously a fresh object per call | Code reading; no mutation site found | Optionally freeze or factory it |

### Plan rules — checked, all respected

| Rule | Command / method | Result |
|---|---|---|
| No existing assertion or threshold changed | `git diff d8aa72c --unified=0 -- src/*/*.test.ts src/*.test.ts tests/*.spec.ts \| grep -E "^-[^-]"` | **no deletions at all**; only additions. `src/export/export-fixtures.ts` untouched |
| No new Tiptap node or mark | `grep -rn "Node.create\|Mark.create"` on every new/changed source file | none; both extensions are `Extension.create` + `addProseMirrorPlugins` only |
| `src-tauri/src/store.rs` + Rust allowlist untouched | `git diff --stat d8aa72c -- src-tauri/` | empty (no Rust change at all) |
| No `folio.*` / `com.folio.writing` rename | `git diff d8aa72c -- src/ \| grep folio` | empty (hits were only prose in `HANDOFF.md`/docs) |
| No new dependency | `git status` on `package.json`/`Cargo.toml`/`Cargo.lock` | unchanged |
| No edit to `README.md` | `git status --porcelain=v1` | absent (`README-draft.md` changed, as the plan required) |

### Plan vs diff

- **Claimed done but absent from the diff:** none of the feature tasks. T10 is explicitly incomplete in the log and in `HANDOFF.md`: the `docs/validation.md` dated section is not written, the native smoke is not attempted for this pass, the release bundle is not rebuilt. These are the known pending items, not findings.
- **In diff but not in the plan:** `src/organization/operations.ts` (`...a` in `mergeMissingResearch`, plus its test) — a metadata-preservation fix the plan's file list omitted, logged at `IMPLEMENTATION_LOG.md:87` with a real fail-first log. `HANDOFF.md` is the state file. `scripts/tmp-writer-aids-measure.mjs` is an untracked temporary helper that must be deleted before commit (known). Nothing else.
- **Every DONE task appears in the diff**, and every diff hunk maps to a plan task or to the two resume-pass fixes. T1 (`noteForms.ts`+tests+`types.ts`+`citations.ts`), T2 (`shortTitle`+form field+tests), T3 (renderer wiring, Note-form dropdown, auto-short checkbox, `document.test.ts`), T4 (`cslImport.ts`+preview+fixture+spec), T5 (`quoteText`+`CaptureQuote`+`insertResearchNote`), T6 (`goals.ts`+model validation+Settings+status line+spec), T7 (`proseCheck.ts`), T8 (`writingAids.ts`+toolbar group+shortcut+CSS+spec), T9 (`textExport.ts`+buttons+filter labels+spec) are all present.

### Review Focus (plan lines 142-146) — is each item pinned by a real test?

| # | Plan item | Pinned? | Test file : case |
|---|---|---|---|
| 1 | literal-only / no author must not produce "undefined" | **Yes** | `src/research/cslImport.test.ts:13` "keeps literal institutional authors and tolerates no author" (asserts `[["World Health Organization"], []]` and `JSON.stringify(result)` has no "undefined") |
| 2 | footnote moved earlier recomputes forms | **Yes** | `src/research/noteForms.test.ts:51` "recomputes forms when a later citation moves before the first" (`["a2","a1"]` → `{a2:"full", a1:"short"}`); the same resolver result is exercised end-to-end by `tests/research.spec.ts:138` |
| 3 | quoted text / block quotes never flagged | **Yes** | `src/editor/proseCheck.test.ts:33` "never flags inside quotation marks" (straight + curly) and `:43` (no issue range crosses quoted text); `src/editor/writingAids.test.ts:52` "prose check skips block quotations and code blocks" (incl. a nested-list blockquote) |
| 4 | one undo removes quote text and reference | **Yes** | `tests/research.spec.ts:176` "captured quote inserts with its citation and one undo removes both" — asserts both `not.toContainText` and `[data-footnote-id]` count 0, then that PDF preview still works |
| 5 | Markdown-significant characters in a section title survive | **Yes** | `src/export/textExport.test.ts:67` — title `#1 [draft] *notes*` is re-imported with `parseManuscript` and asserted as exactly one heading with the original text |

All five are genuinely load-bearing: each fails if the underlying behaviour is reverted (item 2 if form resolution becomes order-independent, item 4 if the insertion is split across transactions, item 3 if `maskedQuotes`/blockquote skipping is dropped, item 1 if literal handling changes, item 5 if `escapeMarkdown` is removed).

## Re-run validation (commands I ran, with real results)

| Command | Result |
|---|---|
| `git status --porcelain=v1` / `git diff d8aa72c --stat` | 23 modified + 13 untracked paths; 22 tracked files changed, +793/-331 (incl. docs/log) |
| `npm run build` | **exit 0** — `tsc -b && vite build`, "✓ built in 32.43s" (previously failed with `TS2339` at `Writer.tsx(886,42)`) |
| `npm test` | **exit 0** — 17 files, **146 passed / 146**, 17.14 s. (Log claims 143; see R2.) The log's earlier 2 PDF 5 s timeouts did **not** reproduce |
| `npx playwright test tests/writing-aids.spec.ts tests/research.spec.ts tests/features.spec.ts --workers=1` | **exit 0** — 15/15 passed in 2.3 m, including "second citation … shortened note", "captured quote … one undo", "prose check lists issues and Enter selects it" |
| `npm run test:e2e -- --workers=1` | **exit 0** — **45/45 passed** in 2.0 m (whole suite, reuses the running server on 1420; no test touched or restarted) |
| `cargo test --manifest-path src-tauri/Cargo.toml` | **exit 0** — 17 passed, 0 failed, 1 ignored |
| `diff /tmp/pw-repair-final.txt /tmp/pw-writer-final-fixtures.txt` | **identical** (both md5 `e013deabbdab2ee97e07eb7e68f89527`) — supports the "legacy fixtures unchanged" claim, on the retained artifacts (I did not regenerate them) |
| Independent Chromium probes via the already-running dev server (`node --input-type=module`, Playwright, no files written) | (a) decoration DOM class/title + panel kind/message confirmed; (b) the D1 untitled-source short note reproduced; (c) the R3 literal "\n"; (d) the R1 latency sweep |
| Read `/tmp/pw-writer-metadata-before.log` / `-after.log` | fail-first is real: 3 failed / 14 passed on exactly the three new tests, then 17 passed |

No test timeout occurred on this machine in any of my runs; nothing had to be re-run in isolation.

## Evidence level reached, and what the user must still verify by hand

- **Reached:** built (exit 0) → wired (all renderers share `resolveNoteForms`/`shortTitle`) → tested (146 unit, 45 browser, 17 Rust, all green on a fresh run) → **runtime-reached in Chromium** for the prose-check DOM class/title, the shortened-note path, the quote-insert/undo flow, the Zotero import and the goal status line (my own probes and the passing e2e). Everything remains **CLAIMED**, not owner-VERIFIED.
- **User must still confirm by hand (exact steps):**
  1. Open the app, create a Blank project, Research → "Enter manually" → "Cite here" twice → the second note should read "Halloway, Lamps and Ledgers, 48."-style short form.
  2. Settings → Goals: set "Daily word goal" 10, type 12 words, watch `412 of 500 today -- …` in the status line; reload and check the baseline persisted.
  3. Toolbar → Focus mode (or Cmd/Ctrl+Shift+F) and Prose check → On: confirm the dotted underlines and the dim scope look right in **light and dark**, and that typing in a normal-length document stays smooth.
  4. Settings → Export Markdown / Export plain text: open the files and confirm notes, bibliography, fragments and research notes are present.
  5. Native check in `Personal Word.app` for the new decorations, focus dim and Capture quote dialog (WebKit only; Chromium is not proof) — deliberately not done in this pass.

## Not reviewed / limits

- **Known-pending, not findings:** native smoke is blocked in this background session and was not attempted for this pass; the `docs/validation.md` dated section is not written; the release bundle has not been rebuilt; `scripts/tmp-writer-aids-measure.mjs` must be deleted before commit.
- I did **not** regenerate the DOCX/PDF fixtures (`npm run render:export-fixtures`) — that writes into the working tree, which this review is not allowed to do. I verified only that the two retained `pdftotext` extractions are byte-identical. The DOCX XML `diff -r -x core.xml` claim was not re-run.
- The light/dark screenshots the log refers to are **gone**: `test-results/` is Playwright's `outputDir` and is wiped at the start of every run (my own runs included). The screenshot-inspection claim therefore cannot be re-checked from artifacts; the screenshots were never kept outside the git-ignored directory. I did not inspect any image.
- Native WebKit rendering, real-app behaviour, VoiceOver/keyboard traversal of the new panels, and DOCX/PDF output for auto-short notes were not exercised by me.
- R1's absolute timings come from a dev-server Chromium run on a machine at load average 30-58, so only the off/on deltas are meaningful; I did not establish the decoration threshold at which ordinary prose becomes visibly slow.
