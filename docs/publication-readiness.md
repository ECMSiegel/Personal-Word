# Source publication readiness

Updated October 19, 2026. Scope: local source alpha, application version `0.1.0`, intended annotated tag `v0.1.0-alpha.1`. No remote, push, hosted release or binary distribution is authorized.

## Prepared locally

- GPL-3.0-only source licensing and matching npm/Cargo metadata; npm package remains private. README, synthetic screenshots, contribution/security guidance, issue forms, roadmap and dependency license inventory are included.
- GitHub Actions macOS build/unit/browser/Rust workflow exists with read-only permissions and pinned actions. Hosted execution is still untested.
- Public `AGENTS.md` and `docs/agent-work/` are retained. `HANDOFF.md` stays local, untracked and ignored. Existing noreply identities remain in force.
- Security/reliability reports, fail-first regressions and qualification are recorded in the [follow-up evidence](agent-work/2026-10-19-alpha-security-reliability/IMPLEMENTATION_LOG.md). Reviewed source/evidence is committed locally; the two authorized historical strings were sanitized with verified private backups. The annotated local `v0.1.0-alpha.1` targets the final evidence HEAD; final identity/source/privacy checks are recorded in that log and the local handoff.

## Current qualification

The final repaired code passed a fresh Node 22.23.3 build, all 163 unit tests in 17 files, all 49 Chromium scenarios, and 19 Rust tests with 1 existing ignored benchmark. Before and after light/dark sidebar screenshots were inspected. The accidental text-selection regression failed with the original and restored-defect CSS and passed with the scoped repair; field/editor/prose selection, reorder, resize, pin/hover and keyboard behavior passed browser checks. Direct native malformed-Unicode argument handling likewise completed a fail/pass/restored-defect/final-pass cycle. Normal Research UI canonicalizes those URL examples; no ordinary typing crash or exploit was demonstrated.

One isolated native macOS WebKit/SQLite rehearsal passed all 3 phases: normal quit/reopen, acknowledged SQLite checkpoint, harness-owned forced termination, journal recovery and snapshot restoration, with integrity and JSON mirror checks. It used only synthetic temporary storage. This is not physical power-loss proof or exhaustive close/error-branch coverage.

A normal `npm run tauri build` followed the diagnostic run and produced `src-tauri/target/release/bundle/macos/Personal Word.app` (15.25MiB), name Personal Word, version 0.1.0, identifier `com.folio.writing`. Actual executable freshness versus 77 source files, absence of `FOLIO_SMOKE`, and all 115 frozen source hashes were checked. A 166-file isolated candidate matched its source manifest and passed redacted Gitleaks before installation; explicitly approved locked `npm ci`, build and 163 unit tests then passed there with Node 22. All 115 tested source files still match both copies. These are local checks, not a hosted CI result or distributed binary approval.

The owner explicitly accepted the pending manual native-sidebar check for this source-only alpha. Actual native label/prose selection, light/dark appearance, drag reorder and related physical interactions remain unverified; browser evidence does not silently close them. Independent focused review is recorded in [REVIEW.md](agent-work/2026-10-19-alpha-security-reliability/REVIEW.md).

## Security and reliability boundaries

- Bounded main-history/privacy review covered 326 unique baseline blobs (305 UTF-8), synthetic fixture context and all 6 main-history screenshot versions. The initial four-path estimate was discarded; two independent checks confirmed exactly 2 old documentation home-prefix strings. Those 2 were replaced through backup-backed main-only sanitation, preserving all code, chronology and identities. The post-sanitation checkpoint covered 341 blobs/320 UTF-8 with 0 home-prefix matches and 0 Gitleaks findings; final main/tag equality and audit are checked after the final evidence commit. Current and candidate redacted Gitleaks scans found 0 credentials; the scanner detected a synthetic credential fixture first. No scanner result proves the absence of every secret or vulnerability. Internal backup refs remain local and outside the intended public main/tag scope.
- npm audit returned 0 advisories across 254 lockfile entries. RustSec returned 0 vulnerability entries and retained glib/proc-macro-error warnings (RUSTSEC-2024-0429 and RUSTSEC-2024-0370). Neither package appears in the resolved x86_64 or aarch64 Apple Darwin inverse tree. Reassess the all-platform warnings if platform support changes; no blanket suppression or dependency upgrade was applied.
- Citation lookup is explicitly initiated by the writer and retains HTTP(S), private/local destinations and redirects. The owner accepted this scope for source alpha; it is not a public-destination-only network policy. Use only destinations you intend the app to contact.
- Recovery-project JSON retains compatibility without a new size cap. Unusually large files can consume substantial memory or block the interface; no large-file failure was reproduced. The owner accepted that resource risk for alpha.
- No writing-loss defect was reproduced. Sparse-save/history/mirror metadata combinations, reopening a generated pre-restore safety copy, and actual window-close during mirror failure lack complete end-to-end assertions. Passing tests/native rehearsal do not prove those additional combinations.
- Font-format erratum: PDF source imports `.woff` assets and embeds font subsets through pdf-lib. `THIRD_PARTY.md` previously called these inputs WOFF2; that wording has since been corrected. This clarification does not complete bundled Noto OFL notices or establish binary license compliance.
- Native sidebar real use, VoiceOver/IME, long writing sessions, native file-dialog export and Microsoft Word/LibreOffice rendering remain open. Editor and exported-document pagination use different layout engines; exact page parity is not promised.

## Earlier source-alpha baseline -- retained evidence

Earlier source-alpha qualification passed 163 unit tests and 17 Rust tests with 1 ignored benchmark. The prior writer-feature baseline had 149 unit/45 browser/17 Rust passes. These are historical results, distinct from the current 19 Rust/49 browser follow-up.

Owner-reported Terminal run on October 19: `npm run test:e2e -- --workers=1` passed all 46 Chromium scenarios in 1.7 minutes. The owner supplied the complete passing output in chat. Browser preview storage is separate from native SQLite. That owner run closes the older browser gate; the current49scenario run above independently qualifies the repaired source.

## Before any public push

1. Owner supplies an empty repository URL and explicitly authorizes adding a remote and pushing main plus the alpha tag. This session stops locally; do not publish internal backup refs.
2. Inspect the final local delivery/audit record and annotated tag. A backup or ignored path is not itself a privacy scrub.
3. Enable the host's private vulnerability-reporting route and verify the conditional instructions in `SECURITY.md`.
4. Observe the first hosted CI run and resolve host-specific failures; set repository description/topics.

Binary distribution separately requires complete bundled notices/GPL corresponding-source delivery, native qualification, export review and signing/notarization. A successful local app build does not close those gates.
