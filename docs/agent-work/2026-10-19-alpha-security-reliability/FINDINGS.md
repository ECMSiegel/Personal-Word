# Findings -- source-alpha security and reliability
Reviewed scope: baseline main f324a7a and intended session changes. Updated 2026-10-19.

## Current disposition

| ID | Severity/type | Evidence and boundary | Disposition |
|---|---|---|---|
| APP-1 | Low native argument robustness | Raw malformed Unicode HTTP-prefix arguments panic at an unchecked UTF8 byte slice. Ordinary UI canonicalizes the example first; no ordinary typing crash or exploit reproduced. | RETESTED: minimal get(..N) guard, two regressions, fail/pass/restored-defect/final-pass with4lookup tests. Full build/163unit/49browser/19Rust and3phase native recovery passed; independent4lookup/13browser reruns passed. |
| SIDEBAR-1 | UI defect | Real mouse drag selects brand chrome on original CSS; original and restored-defect screenshots/assertions show actual selection. Selected blue entries are separate. | RETESTED:3focused and49full browser scenarios pass, real before/after images inspected; native WebKit confirmation gap explicitly OWNER ACCEPTED for source-only alpha; remains unverified. |
| PUB-PRIV-1 | Privacy release gate | Exactly2main-reachable documentation blobs contain personal home prefixes: historical writer-features REVIEW and HANDOFF. Root326blob/305UTF8 enumeration and A independent traversal agree. | CLOSED: backup-verified main-only sanitation of exactlythese2blobs; post-sanitized341blob audit0home-prefix hits and Gitleaks0findings. |
| DEP-NPM | Dated advisory evidence | Registry audit across254entries returns0advisories; complete JSON inspected. | No dependency change indicated. Not proof of all-code security. |
| DEP-RUST | All-platform warnings | Audit returns0vulnerability entries; RUSTSEC-2024-0429(glib0.18.5,unsound) and RUSTSEC-2024-0370(proc-macro-error1.0.4,unmaintained) warnings. Inverse trees contain neither package for x86_64/aarch64 Apple Darwin. | Documented target-specific assessment; no blanket suppression or dependency change. Reassess for other platforms. |
| APP-2 | Existing network policy | Explicit citation lookup permits HTTP(S), private/local destinations and redirects; bounded timeout/body limits remain. No private endpoints contacted in review. | OWNER ACCEPTED for source alpha; document opt-in behavior. No policy change. |
| APP-3 | Availability hardening, unmeasured | Recovery JSON reads the selected file without a size cap; large files may consume substantial resources. No failure/loss reproduced. | OWNER ACCEPTED compatibility for source alpha; document risk. No arbitrary cap. |
| REL-01 | Coverage gap | Additive metadata full-save/restart is tested, but sparse-save/history/mirror combination lacks an assertion. | OPEN documented evidence gap, no reproduced loss or required code repair. |
| REL-02 | Coverage gap | Safety snapshot is taken before restore; current UI test does not reopen that generated pre-restore copy. | OPEN documented evidence gap, no reproduced loss. |
| REL-03 | Native coverage gap | Existing harness exercises run-event quit, not actual window-close with mirror failure. Lower-level mirror retry tests pass. | OPEN documented evidence gap; T6 native rehearsal does not claim to cover every close branch. |
| PUB-DOC-1 | Low documentation accuracy | THIRD_PARTY.md formerly said WOFF2; fonts.ts imports .woff and pdf.ts embeds PDF subsets. | Corrected in 5e67d58 and independently inspected; no exporter/legal conclusion or scope expansion. |

## Audit controls and claim corrections

- Initial four-home-path count was not reproducible and is discarded. Two independent methods confirm2matches in2blobs. Owner authorization is narrowed to exactlythese2; completion PLAN/ui-log are untouched. Eligible blob IDs/relative paths are in ignored history-home-paths-independent.json. T8 main-only sanitation completed with current tree/identities/dates/messages/unrelated refs preserved.
- Gitleaks8.30.1 main-only scan exit0/0findings,100%redaction, ignore suppression disabled. Synthetic fake credential detected exit1 without marker leakage. Explicit166file candidate scan passed; post-sanitized main scan passed. Final tag is checked against final audited HEAD. Internal backup refs are retained locally and outside intended public scope.
- APP-1 was initially described too broadly as a typing crash. Integrator checked actual frontend URL canonicalization; report corrected. Rust direct-command argument reproduction remains real. Final fixed lookup SHA25663163bc1a194bb93aa5eef4990d0c591df9ee882be9f1b5420fe45f4ea0394ee.
- Root inspected all6current/main-history documentation screenshot pixels as demo/synthetic material without obvious personal paths, credentials or OS-account details. This supplements T1 metadata review; it is not OCR certification or native UI qualification.
- Read-only committed v1 SQLite fixture review matched expected synthetic prose/history/snapshot assertions. One short unasserted title was not classified by the reviewer's bounded vocabulary; no personal/identifying inference follows. Only one fixture blob exists in main. See RELIABILITY.md for precise bounds; no real application storage was read.
- Reports: PUBLICATION_AUDIT.md, APP_SECURITY.md, RELIABILITY.md. Full local logs and redacted summaries remain ignored under node_modules/.cache/personal-word-alpha-review/. Missing native/owner checks remain incomplete, not inferred from Chromium.

## Owner native acceptance
Owner explicitly accepted the documented manual native-sidebar check gap for this source-only alpha. Actual isolated WebKit/SQLite recovery passed all3phases; the browser sidebar fix is retested, while native sidebar real-use confirmation stays open. This is a bounded release decision, not a test pass or general beta/binary-distribution waiver.


October 20 continuation: DOCX hyperlink export guard in aad4c12 independently reviewed, fail/fix/restored-defect/final-fix proven; full164unit/49browser/19Rust passed. Generated DOCX confirms HTTP/HTTPS/mailto relationships and plain text for unsafe targets; rendered fixture inspection passed. Qualification review Q1 (stale source evidence) is addressed by current dated readiness/validation/log records. Q2 is a low future unit-fixture coverage suggestion for plain HTTP, already verified by the current actual artifact assertion; no reproduced behavior defect or release blocker.
