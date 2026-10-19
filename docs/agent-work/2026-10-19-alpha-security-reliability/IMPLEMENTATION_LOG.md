# Implementation log -- Alpha security and reliability
Plan: PLAN.md | Base: f324a7a | Integrator: Codex | Started: 2026-10-19

## Status
| Task | Status | Evidence |
|---|---|---|
| T0 | DONE | main f324a7a; existing tag7f5a758d; no remote; four pre-existing docs copied and SHA256 checked |
| T1 | DONE | PUBLICATION_AUDIT.md; scoped scans/advisory results reviewed; sanitation pending T8 |
| T2 | DONE | APP_SECURITY.md;52frontend+2Rust passed; findings reachability corrected by integrator |
| T3 | DONE | RELIABILITY.md; 53frontend and14Rust passed,1benchmarkignored; no reproduced writing-loss defect |
| T4 | DONE | APP-1 guard repair retested; remaining policy findings explicitly accepted; gate integration pending |
| T5 | DONE (browser) | Fail/restore proof,3focused and49fullbrowser pass; native confirmation pendingT6 |
| T6 | DONE | Final full gates/native recovery/normal bundle/clean-source pass; manual sidebar gap explicitly accepted |
| T7 | DONE | APPROVE for localT8;4lookup/13browser independent reruns and finalscope/doc review complete |
| T8 | DONE | Reviewedcommit and scoped history sanitation; final docs/tag transaction checked against frozen source |

## T0 -- baseline preservation
- Owner approved execution in chat; plan status recorded APPROVED.
- Commands: git status --short; git log -3 --oneline; git rev-parse v0.1.0-alpha.1; git remote -v.
- Actual HEAD f324a7a; tag object7f5a758d17c94b46028486d657c1735c0016f021; no remote. Four dirty documentation files preserved byte-for-byte in ignored node_modules/.cache/personal-word-alpha-review/baseline/ with SHA256 comparisons. Tracked inventory and exact refs in baseline-state.json; existing doc diff in baseline-diff.patch.
- Existing noreply configuration retained. No Git refs/index/config changed.
- Runtime node25.5.0/npm11.8.0. Node22 not found in the two conventional Homebrew locations inspected; broader installed-runtime inventory pending. cargo-audit/gitleaks absent on PATH.
- Baseline owner-reported46/46 browser pass remains valid for baseline source, not new repairs.
- Required skill guidance read: pickup, plan-execution, fail-first-verification, independent-review, review-repair. Expensive validation ownership follows this plan's single-run T6 plus focused independent T7 reruns.

## Tool permission checkpoint -- resolved
Owner explicitly authorized cargo-audit0.22.2, Gitleaks8.30.1 and Node22.23.3 in the ignored project audit cache plus locked npm ci in an isolated source copy. No global installation or project dependency change authorized. Downloads and checksum verification completed; see approved local tooling below.

## Final validation
Pending. No native/owner qualification inferred from browser results.

## Approved local tooling
Owner explicitly allowed exact pinned local tools and isolated npm ci. Official GitHub release asset SHA256 digests matched downloaded cargo-audit0.22.2 and Gitleaks8.30.1; Gitleaks checksum manifest also matched. Node22.23.3 archive matched official Node SHASUMS256. Extracted under ignored project cache only, no globals or project dependencies changed. Installation details: tools/installation-evidence.json in ignored diagnostic cache.

## T2/T3 acceptance logs inspected by integrator
T2 npm:4files/52passed,916ms; Rustlookup2passed. T3 npm:3files/53passed,2.80s; Ruststore14passed/1ignored. Complete log files inspected in ignored cache (t2-npm.log,t2-rust-lookup.log,t3-npm.log,t3-cargo-store.log). Reliability report traces persisted-state boundaries and marks metadata/safety-snapshot/native-close coverage gaps without asserting actual loss. No source edits for T3.

## Review claim correction
B initially described raw malformed Unicode as a Research UI reproducer. Integrator checked `new URL("https:/é").href` and the actual parseLookup caller: it canonicalizes to an ASCII scheme/punycode host before invoke. APP-1 therefore concerns direct native command arguments, not a reproduced ordinary typing crash. B corrected its report. The minimum guard repair remains explicitly prescribed by T4. No network requests were made by this check.

## Explicit owner decisions received
- Pinned project-local tooling and isolated locked npm ci approved; verified tooling installed.
- Surgical4historical personal-home-path replacements in main approved with verified backup, preserving code/history chronology and author identities. No other content rewrite/push authorized. Recorded narrow plan addendum; Git operation deferred until final source/gates.
- APP-2 current opt-in HTTP(S) behavior including private/local destinations and redirects accepted for source alpha with explicit documentation; no behavioral change.
- APP-3 existing recovery JSON size compatibility accepted with documented resource risk; no arbitrary cap introduced.

## T4 -- native URL guard
Only src-tauri/src/lookup.rs changed: safe get(..8)/get(..7) prefix checks plus two Rust tests. Actual command `cargo test --locked --offline --manifest-path src-tauri/Cargo.toml lookup::tests`: fail-first exit101 (3pass/1fail, UTF8 boundary panic); repaired exit0/4pass; original guard restored exit101/samepanic; fixed snapshot restored exit0/4pass. Complete t4-rust-{fail,pass,restored-defect,final-pass}.log inspected by integrator. Final source SHA25663163bc1a194bb93aa5eef4990d0c591df9ee882be9f1b5420fe45f4ea0394ee. Existing valid schemes, casing and Unicode paths retained; no network-policy change.

## Historical audit count correction
Initial T1 prose claimed4home-path blobs, but that count could not be reproduced and is discarded. Root independently enumerated326main blobs with batch cat-file,305UTF8 blobs, found exactly2home prefixes in2documentation blobs; A's targeted per-path main traversal confirmed those same2. Exact IDs/relative paths recorded in ignored history-home-paths-independent.json. Only these2confirmed blobs are eligible for owner-approved sanitation; completion PLAN/ui-log are not changed. Owner authorization for up to4identified strings is narrowed to confirmed2, never expanded to unrelated content. No privacy rewrite yet.

## T1 integration supplements
- Root inspected all6current documentation screenshot pixels: synthetic preview/library/example prose, no visible credentials, personal filesystem paths or OS-account details. Git rev-list image inventory shows exactly these same6doc screenshot blobs across intended main history; no extra historical screenshot versions. This is a bounded visual review, not an OCR/security certificate.
- Root additionally ran `cargo tree --locked --offline --manifest-path src-tauri/Cargo.toml --target aarch64-apple-darwin -i glib` and the same for proc-macro-error: exit0, both “nothing to print.” Combined with A's x86_64 inverse-tree results, neither warning package appears in either resolved Mac target. Warnings remain visible for all-platform graph/future platform changes; no blanket advisory suppression or dependency upgrade.
- A's T1 report metadata-only screenshot and fixture limits remain point-in-time evidence. Root screenshot supplement above and C's fixture-content supplement address actual data review separately. Tools/advisory snapshots are dated, not a permanent absence-of-vulnerabilities claim.

## T5 ownership clarification
Root explicitly extended A's lease to ProjectSidebar.tsx solely for the preview selection/drag boundary if needed, after CSS-only preservation failed. Existing draggable previews must be tested against the baseline before claiming a regression; no general event suppression or layout change authorized. Root inspected both actual before light/dark screenshots: real native text highlighting on the brand is visible while blue selected-entry styling remains distinct.

## T5 final behavioral evidence and T6 first build
Original brand drag and restored-defect drag both selected actual chrome; final3focused scenarios passed11.1s, including preview selection then same-row reorder. Scope includes ProjectSidebar.tsx preview-only drag restoration on pointerup/cancel/blur/hidden/unmount. Root inspected complete restored/final logs and both before/after light/dark images. First T6 Node22 build stopped at TS18047(row possiblynull in cleanupclosure), so qualification is incomplete. Original t6-build/results/115filemanifest saved as pre-type-repair-* in ignoredcache; A owns minimal typedcapture correction. No other T6 gate launched, no source/Git release claim.

## Final source freeze after compile correction
A captured a non-null HTMLElement reference after its guard; behavior unchanged. Build passed and3sidebar tests passed10.5s. Root inspected both full logs. Component SHA25650a937babc08495fd674e6bae9b8a720074a26a26c0bd2e7cbca732f02b2bb40. Root renewed115file tested-source manifest; sequential Node22 T6 build/unit/browser/Rust runner restarted on correctedsource. Prior failing build preserved separately. Independent C is reviewing source/evidence, no concurrent test commands.

## T6 scope of export evidence
Export implementation, typography assets and settings are unchanged by these native URL/sidebar repairs. The font-format erratum corrects documentation only. Conditional export-fixture rendering is therefore not rerun; existing artifact evidence and Word/LibreOffice rendering limits remain explicit. No new export-rendering acceptance claim is made.

## T6 final automated qualification -- complete
On frozen115file source manifest, local Node22.23.3: build exit0(27.74s; Vite chunk/static-dynamic import warnings only); unit exit0,17files/163tests(3.70s Vitest); browser exit0,49/49scenarios(1.8m); locked offline Rust exit0,19passed/1existingignoredbenchmark. Root inspected complete four logs and t6-results.json. No skips or thresholds changed. Native diagnostic build now active; owner/native and freshcopy gates remain pending.

## T6 isolated native recovery -- complete
Debug native-smoke/com.folio.smoke build exit0(55.55s native compilation); one native runner attempt exit0 with all3phases ok. Root inspected complete build/runner logs, synthetic progress breadcrumbs and JSONsummary. Actual macOS WebKit/SQLite exercised rapid edits/section switch, extraction/restoration, named snapshot, normal quit/reopen, acknowledged SQLite checkpoint, harness-owned forced termination and newer-journal restart recovery, followed by snapshot restore. Runner asserted SQLite integrity and portable project.json equality after clean exits. Only harness-owned isolated stores/processes used. This does not close REL01/02/03 or physical power-loss guarantees; manual native sidebar light/dark selection/reorder remains pending. Normal release rebuild started afterdiagnosticrun.

## T6 candidate copy privacy checkpoint
Explicit166file candidate copied into owned temporary source directory, all SHA256comparisons matched; no HANDOFF/.git/node_modules/runtime/credentials. Before npmci, Gitleaks dirscan exit0/0findings,100%redaction and ignorefiledisabled; log reports1.49MB scanned. Sourcecopy lockedinstall/build/unit pending, final documentation scan remains required afterreconciliation.

## T6 normal release -- complete
After the diagnostic run, npm run tauri build exit0; release native compilation1m49s, normal bundle15.25MiB. Root inspected full log and actual Info.plist/binary: Personal Word,0.1.0,com.folio.writing; executable SHA2568708477022776c175ae6ca634d0b6cfa72fc0f825e7ffa47458b08bc1c547c4a, newer than all77sourcefiles; FOLIO_SMOKE marker absent. All115frozen source hashes unchanged. Actual bundle src-tauri/target/release/bundle/macos/Personal Word.app. Owner native-sidebar result or explicit source-alpha acceptance requested; no waiver inferred. Isolated npmci/build/unit started afterward, serially.

## Explicit native-sidebar acceptance
Owner replied: “Accept the documented native-sidebar gap for this source-only alpha.” This satisfies T6's explicit owner-acceptance option only for the pending manual native-sidebar check. Actual native recovery passed; browser sidebar evidence passed. Native sidebar real-use behavior remains unverified and must not be reported as an owner-confirmed fix. Remaining automated/independent/privacy/Git gates still apply.

## T6 clean-source rehearsal -- complete
Explicit166file candidate copied/hashchecked without runtime/credentials/HANDOFF; no copied or symlinked dependencies. Local Node22 locked npmci exit0(6.24s,194installed/195audited,0advisories), build exit0(18.53s), unit exit0(17files/163tests,4.27s Vitest). Root inspected full three logs/results. All115frozen source hashes match both root and freshcopy afterrehearsal. Later changes are documentation only; final candidate privacy scan follows reconciliation. T7 focusedtestlease granted C; no duplicatefull/nativebuild.

## T7 independent focused evidence
C independently reran lookup4/4passed. Browserfirstattempt failed before tests with sandbox listenEPERM; unchangedcommand with approvedloopbackpermission passed all13sidebar/layout/editor-toolbar scenarios in1.1m. Root inspected all3complete logs, preserved initialenvironmentfailureseparately. C also independently inspected fullT6logs, nativeharness boundaries, actualreleasebinary/Info.plist/manifest and actualbefore/afterimages. Finalscope/docverdict pending. Frozen115file manifest SHA25675587e8f1b321f9d232935e846274f61f4576d5456144119dc50ce2d756d30da.

## T7 documentation reconciliation
C completed4/4Rust and13/13browser focused reruns, fullsource/scope audit and review of the narrowlyscoped sanitation script. Corrected stale APP1qualification and PUB-DOC1erratum rows in ledger. A updating its role-report point-in-time boundary to acknowledge root arm-target/image and Cfixture supplements; no source changes. Finalreviewverdict follows these documentation corrections.

## T7 approval and T8 entry
Independent Luna C verdict APPROVE -- proceed with T8 localdeliveryonly. No actionable source defect or unresolved release-blocking finding. Owner accepted only documentedsourcealphalimits; no push. Root rechecked mainf324a7a/tagobject7f5a758d, approvedemail, noremote/noreplacementrefs, exact15intendedpaths and115sourcehashes. T8 will preserve pre-finalization and pre-sanitation verifiedbundles inside private .git/source-alpha-backups/; oldtagobject remains recoverable.

## T8 staged check
Private pre-finalization bundle created and verified before staging. Staged-check first caught5Markdown hardbreak trailing-space lines in the previously untracked APP_SECURITY report; B removed whitespace only, root compared exact stripped bytes. No source/test/wording changes or commit yet. Staged source/evidence diff inspected; index source hashes must match115file frozenmanifest beforecommit.

## T8 delivery and privacy audit
- Reviewed15file source/test/evidence commit created as b162a02. Two fresh private bundles were created and verified before staging/history mutation; they preserve the previous main/tag and the reviewed commit. Backups are inside private .git/source-alpha-backups/, not tracked or intended for publication. The previous annotated tag object7f5a758d17c94b46028486d657c1735c0016f021 remains recoverable.
- Main-only sanitation rewrote exactly2eligible documentation blob prefixes, preserving every other byte in those blobs and all other file content. It preserved all12commit identities/dates/messages/topology, current-tree identity and unrelated refs. No reset, checkout, ref deletion or garbage collection occurred. No authorship rewrite was repeated.
- Post-sanitation checkpoint:341main blobs/320UTF8,0home-prefix matches; redacted Gitleaks scanned12commits and found0credentials. The known-positive2match pre-scan and synthetic Gitleaks detection demonstrate the gates can fail. Exact mapping and redacted local logs remain in the ignored cache.
- The final documentation-only evidence commit records completion and the local annotated v0.1.0-alpha.1 tag targets final HEAD. The final transaction checks tag/HEAD equality, approved new identities, all115tested source hashes in both committed/current trees, clean status,166tracked paths, ignored/untracked HANDOFF, no remote, unchanged unrelated refs, and a fresh main/tag privacy audit. Exact final object IDs and private backup locations are recorded in local HANDOFF after the transaction. No push/hosted release/binary distribution.
- Native-sidebar real-use behavior remains unverified under the owner's explicit source-alpha acceptance. REL01/02/03, font-inventory wording erratum, opt-in private/local HTTP(S), uncapped recovery JSON, hosted CI and binary/Word/VoiceOver limits remain documented; none is silently promoted to a test pass.

Independent Luna C also compared all12old/new rawcommit objects and parent mappings, exact2blob substitutions, currenttreeidentity,115sourcehashes and pre-sanitation bundle SHA/verification; allpassed. Redacted local note t8-independent-review.json. Final deliverycheck below remains scoped to the planned documentation commit/tag transaction, with no new sourcechanges.
