# Source alpha independent review

Reviewer: Codex | Range: `f43c09d` to the current working tree | Date: 2026-10-19 | Read-only

## Verdict: APPROVE the reviewed changes; source-alpha qualification remains pending

I reviewed the changed citation and deadline logic, the source-alpha README and publication notes, the current source-alpha decision/evidence records, and the staged and unstaged tree against the local handoff decisions. The earlier exporter review has been extended for the late CommonMark `>literal` and lone `>` cases. I found no remaining code or documentation finding within the reviewed scope.

The alpha is not ready for a public push yet. Final full-unit, e2e, and exact-final-source release-build results are being completed by the integrating agent. The agreed commit-identity rewrite and local alpha tag are also still pending: the current HEAD still has the prior author and committer email, no remote is configured, and `v0.1.0-alpha.1` is not present. The handoff prohibits a push without an owner-supplied repository URL and explicit authorization; no push was attempted.

## Reviewed changes

- Goal deadlines share one strict `YYYY-MM-DD` calendar validator between project loading and the UI mutation. The UI rejects invalid nonempty dates before mutation and continues to allow clearing. The focused model tests cover leap dates, invalid calendar days, five-digit years, and year zero. The integration evidence records a browser fail-first and a passing fixed UI rerun that checked rejection, preservation, reload, and clearing.
- Short citation punctuation now handles both book and non-book titles ending in `?` or `!`. Supplied page and chapter locator prefixes remain intact. This includes the book edge found in integration review and its fail-first plus defect-restoration cycle.
- Markdown and plain-text list nesting use the rendered parent marker width, including ordered starts 1 and 10. Markdown text escapes line-leading `-`, `+`, `>`, and ordered markers. The exporter now escapes `>literal` and a lone `>` as required by CommonMark, in addition to `> literal`. Research-note export keeps existing `p.`, `pp.`, and `ch.` prefixes in both formats.
- The README describes local writing separately from optional external citation lookup, including a possible Crossref follow-up when a DOI is found in page metadata. The limitations and publication-readiness notes keep source-alpha claims separate from native, export-rendering, binary-distribution, and historical-content qualification.
- The local handoff is ignored and removed from the public tree; `AGENTS.md` and `docs/agent-work/` remain. The workspace path in the earlier writer-features review was replaced with generic wording. The README no longer links to `README-draft.md`; older agent notes retain historical plain-text references to that filename.

## Verification run in this review

- `npm test -- src/research/citations.test.ts src/model.test.ts src/export/textExport.test.ts` — passed, 3 files and 50 tests (2026-10-19).
- `git diff --check HEAD` — passed.
- Searched `README.md`, `docs`, and `.github` for Markdown links to `README-draft.md`; none found.
- Inspected Git status, remotes, current HEAD identity, and the intended alpha tag. Work remains uncommitted; no remote or alpha tag exists, and the identity rewrite has not yet occurred.
- Fail-first and defect-restoration records are in `docs/agent-work/2026-10-18-source-alpha/EVIDENCE.md`. They include the added book punctuation and no-space/lone blockquote cases.

## Remaining qualification boundaries

The focused tests exercise the changed model, citation, and text-export behavior. They do not establish native WebKit behavior, native SQLite persistence, real-use confirmation, or Word/LibreOffice rendering. The final full unit suite, full e2e suite, and release build against the exact final source remain integrating-agent gates; no duplicate runs were started here. Hosted CI and public-history review also remain open. Keep the writer-feature owner checks CLAIMED until the owner confirms them in real use.


## Integrating qualification addendum

After the independent source review, the integrator inspected the complete command logs: full unit163 passed, Rust17 passed/1ignored, final Tauri rebuild passed and fresh bundle metadata checked (BUILD_EVIDENCE.json). The full browser gate remains BLOCKED before execution by automatic-review timeout/capacity errors; the sandbox cannot bind localhost. This limits qualification without implying a product-test failure. The passing targeted deadline browser case and historical baseline browser run do not substitute for the full final suite. Owner/native and public-history gates remain open.


## Owner-reported browser qualification follow-up -- October 19

Owner-reported Terminal run on October 19: `npm run test:e2e -- --workers=1` passed all 46 Chromium scenarios in 1.7 minutes. The owner supplied the complete passing output in chat. This closes the blocked browser gate; the integrating agent did not independently rerun it. Browser storage does not establish native WebKit or SQLite behavior. The earlier review and blocked-run notes above describe their point in time and are superseded for browser qualification by this owner report. Local noreply history rewriting and the initial alpha tag were completed at `f324a7a`; this documentation-only follow-up records the browser result. Native owner checks, historical-content privacy review and hosted CI remain open.


## Dated follow-up -- October 19, 2026 security/reliability pass

This historical source-alpha record and the owner's 46/46browser output remain point-in-time evidence. A later approved pass repairs native raw-argument Unicode prefix handling and accidental sidebar chrome selection, with fresh 163 unit/49 browser/19 Rust passes (1existing ignored benchmark), a 3-phase isolated native recovery pass, normal release rebuild, and clean-source Node 22 npm ci/build/unit rehearsal. The owner explicitly accepts the pending manual native-sidebar check for this source-only alpha; it remains unverified. See [the current log](../2026-10-19-alpha-security-reliability/IMPLEMENTATION_LOG.md) and [independent review](../2026-10-19-alpha-security-reliability/REVIEW.md) for current scope, findings, audit and local commit/tag delivery state. No push or binary distribution is authorized.
