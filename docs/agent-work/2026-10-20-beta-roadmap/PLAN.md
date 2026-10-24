# PLAN -- Downloadable Personal Word and staged removal of alpha limitations
Date: 2026-10-20 | Architect: Codex | Project: Personal Word | Status: APPROVED -- owner: “Run the plan as cheap is as feasible utilizing luna as much as possible” (2026-10-20)

## Goal
Writers can download a trustworthy Mac app, preserve richer writing and research, review reliable document output, and recover their work with clearly tested limits.

## Request
“Write a plan to fix all of these” refers to the missing download and every bullet in the attached README limitations screenshot. Owner clarification: “Try to cover as much as possible (Ideally both).” Prioritize a downloadable app and CI, while planning the broader improvements in independently testable stages. This request authorizes planning only.

## Definition of done
- First milestone: reliable CI and a reviewable, licensed, signed/notarized Intel and Apple silicon download candidate, with clean-machine install evidence before publication.
- Subsequent milestones: safe images/tables and DOCX/HTML/Markdown imports; Markdown note round trips; broader research records, BibTeX and opt-in local Zotero updates; correct block-quote citation placement; responsive writing aids, word-level comparison and persistent comment anchors; native typography, PDF print preview and flowing long footnotes.
- Every screenshot item has a disposition in the coverage table below. “Fix” means reachable implementation plus passing negative/positive tests and appropriate native/artifact checks; deleting a warning is not a fix.
- Unsupported/unproven behavior remains visible. Citation suggestions remain fallible; hardware can fail; editable DOCX can reflow in Word. Neither the plan nor implementation may claim universal correctness, identical Word pagination or a power-loss guarantee.
- Each completed stage has IMPLEMENTATION_LOG.md, an independent REVIEW.md, explicit owner real-use checks, and an accurate README/validation update. The existing source alpha remains recoverable.

## Non-goals
Windows/Linux/mobile; collaboration/accounts; cloud or bidirectional Zotero sync; Word-compatible tracked-change acceptance/rejection; arbitrary executable HTML, macros or embedded OLE; bundling commercial fonts; changing persistence identity; deleting recovery/history; replacing already published tags. No implementation, installation, commits, GitHub settings changes or publication in this planning turn.

## Context (verified unless labeled otherwise)
- `main` HEAD `2bb181bebb567b7dc35f66332ea905b5feab9262`, clean at investigation start; annotated `v0.1.0-alpha.1` object `b5f080fdf7d4c47e6b8f21544cbf716af5d03fd7`; GitHub origin ECMSiegel/Personal-Word. Source trees survived the approved contributor-trailer rewrite unchanged -- Git read-only inspection and `HANDOFF.md`, final contributor-credit section. Earlier hashes in evidence are historical.
- README has the requested missing-download statement and 13 limitation bullets -- `README.md:38`, `README.md:109-123`. Some statements are stale, not missing features.
- DOI prefix handling already exists -- `src/research/lookup.ts:38-43,66-70`; import dedup already checks CSL IDs and normalized DOI before title/author -- `src/research/cslImport.ts:63-84,104-111`. Do not reimplement these as absent.
- Hosted run 39375156244 failed Tab assertion: expected `text-indent`, received `margin-left: 0.5in`; 48/49 passed. Current-source run 39375801510 failed at the same assertion; run 39375801721 succeeded. Logs were read through GitHub CLI; see [failed run](https://github.com/ECMSiegel/Personal-Word/actions/runs/39375801510), [passing run](https://github.com/ECMSiegel/Personal-Word/actions/runs/39375801721). Root cause is UNKNOWN, not proven flaky infrastructure.
- Test uses DOM selection anchor offset after Home -- `tests/editor-toolbar.spec.ts:21-44`; production first-line versus left-indent logic uses ProseMirror parentOffset and inherited setting -- `src/editor/indent.ts:62-115`. Blank specifies no inherited first-line indent -- `src/templates.ts:24-35`.
- Shared schema has no images/tables -- `src/editor/extensions.ts:10-18`; native allowlist also lacks them -- `src-tauri/src/store.rs:775-808`. Import disables HTML/table parsing and retains images literally -- `src/import/manuscript.ts:5-7,29-65`.
- Annotation stores quote only -- `src/model.ts:43-50`; jump picks the first matching text node -- `src/App.tsx:133-154`. Snapshot comparison/restoration is positional -- `src/organization/RevisionComparison.tsx:35-74`, `src/App.tsx:1029-1055`.
- Citation scope is manuscript-wide -- `src/research/noteForms.ts:25-47`; the source kind union has three kinds -- `src/research/types.ts:1-22`. Block quote reference is inserted outside the block -- `src/App.tsx:1134-1143`.
- Project render traverses manuscript references and note forms -- `src/App.tsx:1094-1114`; goals sum all entries -- `src/goals.ts:9-18`; prose decorations are capped -- `src/editor/writingAids.ts:15,27-59`.
- Current PDF renderer uses font shards and refuses unsupported shaping and overlong notes -- `src/export/pdf.ts:27-88,253-300`; editor note space uses a uniform reserve -- `src/editor/footnoteLayout.ts:22-29`. Native printing feasibility for these exact fixtures is UNKNOWN.
- SQLite uses WAL/FULL -- `src-tauri/src/store.rs:173`; journal is WebView localStorage, not fsync-backed -- `docs/architecture.md`, Save/history/recovery. Existing native harness deliberately kills only its owned process after a checkpoint -- `scripts/native-smoke.py:116-157`.
- Bundle targets app only -- `src-tauri/tauri.conf.json`, bundle section. Binary OFL notices are explicitly incomplete -- `THIRD_PARTY.md:11-17`. Apple signing credentials, other test Macs and Word availability are UNKNOWN; do not read key material to discover them.

## Rules in force
- Workspace AGENTS.md Safety/Authority: no installs, destructive operations or external publication without appropriate owner authorization; never inspect secrets. Planning changes only PLAN.md files.
- Project AGENTS.md Preserve writing: retain `com.folio.writing`, `folio.*`, events, revision/SaveQueue semantics, metadata, snapshots and old-project compatibility. Native SQLite is authoritative.
- Project AGENTS.md Product/UI: Futura/Avenir/system sans-serif UI, live light/dark, reduced motion, keyboard alternatives, independent reading/export settings.
- Project AGENTS.md Verification: actual native WebKit and exported-artifact checks, normal release rebuild, no exact editor/Word pagination promise. Source-alpha manual waiver does not qualify a distributed binary.
- Expensive qualification is sequential. Do not spawn agents unless owner later requests delegation; if used, integrator alone owns shared model/schema/dependencies/App wiring and installs. Never use blanket staging or push private refs.

## Approach
Split independent subsystems into the six child PLAN.md files linked below. Their task IDs are unique and specify file ownership, interfaces and tests. Approval must explicitly identify the stage(s) to execute; this DRAFT does not silently approve implementation or publication.

The early download milestone uses current mature functionality plus CI/durability qualification; it does not wait for all new features. Later stages culminate in a beta candidate. Proposed new versions: first downloadable alpha `0.1.1` / `v0.1.1-alpha.1`; completed beta `0.2.0` / `v0.2.0-beta.1`. Approval of this plan adopts these defaults; existing `v0.1.0-alpha.1` never moves.

Reject removing warnings without tests, suppressing CI via retries, embedding image bytes in localStorage, automatically fetching imported resources, and replacing editable prose with page-sized pictures. Use native typography for a new opt-in print/PDF path after its feasibility gate; keep the legacy exporter for old projects until explicit migration.

## Coverage of the screenshots
| Item | Concrete target | Tasks | Honest boundary retained |
|---|---|---|---|
| No download | Signed/notarized DMGs, source/notices/checksums, install tests | R1-R3, D1 | No release without signing/owner gates |
| Different page breaks | PDF preview shows the exact exported PDF; consistent geometry/manual breaks across exports | L1-L3 | Editable editor/Word may reflow; universal Word equality is not feasible to promise |
| PDF fonts/scripts/long notes | Document font policy, native shaping, mixed-script fixtures, continuation pages | L1-L3 | Tested script matrix, not every font/script ever made |
| Three source kinds/inaccurate lookup | More structured kinds, missing-field checks, provenance and explicit review | C1-C2 | External metadata/instructor requirements still need review |
| Text-only imports/5MB limit | Bounded cancellable DOCX, tables/images and inert HTML import; larger text tier | I1-I3 | Unsupported constructs preserved with warnings, never executed |
| CSL-only/dedup/DOI/chapter/ibid | Shared identifier logic, stronger reviewed merging, BibTeX, local Zotero refresh, configurable scope/ibid | C1-C3 | Local one-way refresh, not cloud/bidirectional sync |
| Heuristics/goals/capped issues | Optional dismissed rules, selectable goal scope/day boundary, complete paged issue list | E2 | No automatic prose rewriting or claim of infallibility |
| Quote citation outside block | Reference inside final paragraph in one undoable edit | E1 | Verify rich-text and exports |
| Project recomputation | Per-entry summaries and explicit invalidation; measured typing budget | E2 | Quiet-machine measurement, not universal latency guarantee |
| Markdown notes do not round-trip | Read/write supported Markdown note definitions and references, including bundles | I3 | Arbitrary research metadata remains lossless only in project archive |
| Paragraph-only comparison | Aligned word/grapheme diff with safe range restore | E3 | Snapshot comparison, not Word Track Changes |
| Ambiguous comments | Transaction-mapped ranges and conservative legacy migration | E1 | Deleted/ambiguous anchors remain detached until manually reattached |
| Mac fonts | Licensed bundled document defaults, explicit local fallback/substitution, unchanged UI preference | R2, L2 | No commercial font redistribution |
| Save guarantee/untested shutdown | Native failure matrix, FULLFSYNC decision, safe archive/restore and backup guidance | D1-D2 | Do not deliberately power-cut owner's Mac or claim immunity to hardware loss |

## Tasks / execution order
### M0 -- Baseline and stage authorization
- Files: implementation only: create IMPLEMENTATION_LOG.md and REVIEW.md within each executing child-plan folder; update ignored HANDOFF.md. No source changes in M0.
- Interfaces: records approved stages, baseline tree/refs/dirty set, exact owner file leases and available tools; later stages consume this record.
- Steps: (1) Read this plan, child plan and current state. (2) Verify baseline and preserve unrelated edits. (3) Record separately approved package/tool and publishing actions; absent authority, mark those gates blocked and continue independent tasks. (4) Use plan-execution/fail-first-verification/independent-review for execution, not for this planning-only turn.
- Acceptance check: `git status --short; git log -3 --oneline; git rev-parse v0.1.0-alpha.1` -> observed state recorded, no unexplained overwrite or retag.
- Fail-first: n/a -- state capture; compare recorded refs against live values and stop on drift.
- Stop and ask if: source drift changes a task contract, unrelated dirty shared files, or stage not approved.
- Default if unanswered: no implementation; preserve state.

### M1 -- First downloadable alpha
- Files: [01-downloads/PLAN.md](01-downloads/PLAN.md), [06-durability/PLAN.md](06-durability/PLAN.md), exact owned files in R1-R3/D1.
- Interfaces: R1 green CI + D1 native evidence -> R2 complete bundle -> R3 signed candidate/owner installation result.
- Steps: (1) Execute R1 and D1. (2) Execute R2. (3) Execute R3 through local candidate checks. (4) Owner approves concrete binary release/publication only after gates; later feature stages do not delay this milestone.
- Acceptance check: child R/D commands plus artifact hashes/clean-machine signed installation report -> all release blockers closed, or candidate explicitly unpublished with named blocker.
- Fail-first: inherited child failure controls; never treat blocked signing as a pass.
- Stop and ask if: signing/test-hardware/publication authority missing.
- Default if unanswered: prepare everything locally; no unsigned public binary substitute.

### M2 -- Editing, research and safe rich imports
- Files: [02-editing/PLAN.md](02-editing/PLAN.md), [04-research/PLAN.md](04-research/PLAN.md), [03-imports/PLAN.md](03-imports/PLAN.md).
- Interfaces: integrator merges additive model contracts before dependent UI; I1 asset/schema contract precedes I2/I3, asset-aware E3 and L2. C1/C2 resolved note rendering precedes final import/export compatibility. C3 uses I2's approved worker/size-tier infrastructure.
- Steps: (1) Execute E1/E2 and C1/C2 under shared-file leases. (2) Execute I1, then I2, then C3 and I3, then asset-aware E3. (3) Run the relevant D2 persistence scenarios after each schema integration; reserve D2's final whole-beta readiness gate for after L1-L3. These subset checks do not prematurely claim the entire D2 task complete.
- Acceptance check: all child targeted unit/browser/native round trips -> features reachable and no data stripped by saves/history/journals/archives.
- Fail-first: each child regression/control must fail for the old behavior.
- Stop and ask if: package approval, unsafe import conversion, model conflict or unsupported schema is encountered.
- Default if unanswered: preserve literal data and existing projects; do not ship a partially migrated feature as complete.

### M3 -- Predictable output and beta qualification
- Files: [05-layout/PLAN.md](05-layout/PLAN.md), [06-durability/PLAN.md](06-durability/PLAN.md), repeat R2/R3 for the new beta version.
- Interfaces: merged E/C/I features -> L1 native proof -> L2/L3 -> D2 full qualification -> R3 reviewed beta artifacts.
- Steps: (1) Pass native print feasibility gate. (2) Integrate font policy, notes and identical PDF preview. (3) Complete full new-feature durability/artifact/native evidence. (4) Refresh actual remaining limitations and prepare new beta candidate; never overwrite earlier downloads.
- Acceptance check: child validation plus independent stage reviews -> no unresolved writing-loss, import-content-loss, citation-reference, export-clipping or signing blocker.
- Fail-first: inherited child controls; beta gate rejects any required check recorded as unknown/blocked.
- Stop and ask if: exact editable Word pagination is demanded, native print proof fails, or owner acceptance/hardware remains missing.
- Default if unanswered: keep legacy exports and current alpha available; do not call incomplete work beta-ready.

## Validation (after all tasks, in order)
1. Each stage's focused fail/fix/restored-defect/final-fix controls; no dropped tests, loosened assertions, sleep-based fixes or unexplained retries.
2. `npm run build`, `npm test`, `npm run test:e2e -- --workers=1`, `cargo test --locked --manifest-path src-tauri/Cargo.toml` sequentially. Baseline was 164 unit/49 browser/19 Rust plus one ignored benchmark; new tests increase totals. Explain any changed totals rather than pinning them blindly.
3. Expanded isolated native harness and new schema/asset crash matrix; actual light/dark/native sidebar, input methods, VoiceOver, install/upgrade and large-project checks. No real user library failure injection.
4. Actual DOCX XML + Word/LibreOffice pages, native PDF extraction/rendered pages and preview byte identity, archive/Markdown round trips and safety-source review.
5. Normal release rebuild after diagnostic builds; identity/version/architecture/signature/notary/notices/current-source manifest checked on actual artifacts. Final checks use actual outputs, not old paths or timestamps.
6. Independent stage REVIEW.md against request/plan/diff and fresh checks. A reviewer with no authorship of that stage must approve before owner release approval. No additional subagent requested in this planning turn.

## Risks and rollback
Use ordinary additive changes and bounded feature gates. Before schema migration, SQLite online backup; reject newer schema in old apps. For rollback, preserve upgraded data and restore a verified pre-migration copy into an isolated recovery location, never overwrite active writing with an older schema. Preserve old export setting/renderer; imported sources remain untouched; failed/cancelled preview creates no visible project. Never garbage-collect referenced assets/history as part of this work. Hold or withdraw a bad download through an owner-approved release action; do not force-push or retarget the existing alpha again.

## Open questions for the user
1. Approve the staged plan; M1 is first priority, M2/M3 address the remaining gaps. Model/effort allocation can be produced with pick-model before execution if desired.
2. R3 requires an Apple Developer ID/notarization setup and Intel/Apple silicon clean-machine testers. Availability is unknown. Never send signing keys/passwords in chat; owner configures protected secrets or uses local signing tools. Preparation continues without these; publication waits.
3. Proposed explicit defaults for approval: native PDF preview parity, editable DOCX reflow caveat retained; opt-in one-way Zotero desktop refresh; manuscript-only/local-day goals preserved for existing projects, configurable alternatives for new preferences; minimum new script matrix Latin/Greek/Cyrillic/Hebrew/Arabic/Devanagari/CJK. If these defaults are rejected, revise the affected child before implementation.
4. New third-party parser/native-bridge dependencies, if needed, need a separately reviewed exact-version/license proposal and owner installation permission. No software is installed by writing/approving this DRAFT.

## Notes for the implementer
This is a multi-milestone product effort, not a one-session cleanup. Do not translate “all limitations” into erasing truthful warnings. README's DOI and dedup statements are already contradicted by source; verify current behavior, consolidate helpers and correct docs. Preserve historical qualification/hash records as dated evidence; add new current records rather than editing history. No current plan stage is implemented by this document.

## Primary references checked for the design
- [Tauri distribution](https://v2.tauri.app/distribute/), [macOS signing/notarization](https://v2.tauri.app/distribute/sign/macos/) -- Developer ID/notary and actual DMG checks, not source-alpha qualification.
- [Apple WebKit print operation](https://developer.apple.com/documentation/webkit/wkwebview/printoperation(with:)) -- available primitive; the required pagination/footnote proof is still a task, not established capability.
- [Zotero local API](https://www.zotero.org/support/dev/web_api/v3/local_api) -- opt-in localhost API; read-only design does not require Zotero cloud credentials.
- [Chicago notes/bibliography](https://www.chicagomanualofstyle.org/tools_citationguide/citation-guide-1.html), [CSL developer references](https://citationstyles.org/developers/) -- expected-field/format fixtures; no claim of universal citation correctness.
- [SQLite pragmas](https://sqlite.org/pragma.html#pragma_fullfsync) -- platform-specific synchronization; no power-loss guarantee follows from a pragma alone.

## Plan self-review
Coverage mapped all screenshot bullets; independent subsystems split into six executable child plans. Native printing/signing/external dependencies are explicit gates, not assumed successes. Source-only waiver is not carried into binary approval. Only PLAN.md files were authored; implementation/release work is not started.

## Owner decisions -- 2026-10-23 (amend the stages below)
Given in chat after the 4f8e9ee checkpoint:
1. Native hold LIFTED: native WebView tests and UUID-backed isolated WebKit profiles may run (isolated `com.folio.smoke` storage only, never the real library). Leftover smoke WebKit data folders under macOS's WebKit area are acceptable.
2. Downloadable Mac app REMOVED from the plan: R2 (distributable candidate) and R3 (signing, notarization, install, publication) are descoped, along with M1's download milestone and the coverage row "No download". Already-committed R2 files (release workflow, packaging/verifier scripts, notices, 0.1.1 manifests) stay as they are, with no further work; their open review findings are not repaired. The beta is a source beta. A normal local `npm run tauri build` stays the way to produce an app for the owner.
3. Package decisions delegated to the integrator ("whatever you think is best"). Chosen: no new npm packages. Images/tables use custom Tiptap nodes built on the installed `@tiptap/pm/tables` (prosemirror-tables). I2 DOCX/HTML import uses the platform `DOMParser` (inert documents: no script execution, no resource loads) plus the existing `jszip`, not parse5; parsing runs on the main thread with AbortSignal checkpoints and hard size limits, because DOMParser is unavailable in workers (a deviation from the I2 worker interface). C3 BibTeX uses an in-house parser, not @retorquere/bibtex-parser (licence metadata conflict). L1 native PDF may add a direct dependency on `objc2-web-kit` 0.3.2 / matching objc2 crates already in Cargo.lock and the offline cargo cache; anything not already locked needs a recorded proposal first.
4. Owner real-use testing happens after everything is built. Stages proceed on automated, native-harness and artifact evidence and stay CLAIMED until the owner tests.
Execution order: D1 finish (native) -> I1 -> I2 -> I3 -> C3 -> L1 -> L2 -> L3 -> D2 final -> independent reviews -> owner testing.
