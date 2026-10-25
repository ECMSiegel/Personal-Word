# T023 -- owner hand-off and Definition-of-done check

Agent: agent-d5a8 (Claude Sonnet worker T023), 2026-10-25. Status of everything: **CLAIMED** (automated evidence only). Documentation and record-keeping only: no code, test, build, commit, install, or real-library access.

## 1. What I did
1. **EVIDENCE.json review field.** `shasum -a 256 06-durability/REVIEW.md` = `0065be67a7b12980cdeec5b5c303d1d65736c5168de3829c374ba7c679c582e2` (matches). Edited only the `review` field by hand to `{"state":"passed","reviewer":"agent-9e61","reviewFile":"docs/agent-work/2026-10-20-beta-roadmap/06-durability/REVIEW.md","reviewFileSha256":"0065be67..."}` (copy of the file before: `node_modules/.cache/personal-word-beta/team-t023/EVIDENCE.before.json`). Did not rerun `make_evidence.py` (it resets the field). Verifier `python3 scripts/verify-beta-evidence.py --evidence .../EVIDENCE.json --source-manifest .../SOURCE_MANIFEST.json` -> **exit 2**, no FAIL, `[PASS] review by agent-9e61 ... (file sha256 matches)`, exactly the 9 owner items pending (keyboardAndCommentAnchors, closeRetry, recoveredImage, preRestoreSafetyCopy, wordRendering, appleSilicon, voiceOverAndIme, longSession, webkitVisuals). Output: `node_modules/.cache/personal-word-beta/team-t023/verifier-after-review.log`. Rerun after my doc edits: still "207 source files match the manifest exactly" (docs I edited are outside the manifest).
2. **Stale digest mentions.** The digest is the `manifestSha256` field inside `SOURCE_MANIFEST.json` (the same definition T021 used; the verifier recomputes it): `24fa1a86893ba3a6cf4cc08471b222949c5b7ec9eaf34840e0bed5720928e97c`, 207 files (verifier printed "manifest 24fa1a86893ba3a6"). It is not the `shasum -a 256` of the JSON file (`ff756375...`). Appended "superseded by 24fa1a86... after T048" to `docs/validation.md` (Gate D section, which now records the current digest), `06-durability/IMPLEMENTATION_LOG.md` (T046 entry) and `evidence.md` section 7. The old digest also appears in `06-durability/REVIEW.md` lines 3 and 43; I left it because that file is the hash-pinned Gate D review (editing it would break the recorded review sha).
3. **OWNER_TEST_CHECKLIST.md** written (sections A-I; every item `Outcome: pending owner`; nothing pre-marked; steps no agent can run marked **[NO AGENT]**).
4. **HANDOFF.md** rewritten to current truth, keeping owner decisions, rules and traps.

## 2. What the board did
Board: 49 tasks, all done except T023 (this one, going to review). Q001-Q004 open. Commits: none (`team/config.json` `git_commit` is false; HEAD still `ee2fe3a`).

| Stage | Tasks | Verdict / evidence |
|---|---|---|
| Reconcile | T001 | `REPORT.md` |
| Waves 1-3 | T002 WP1, T003 WP2, T004 WP4, T005 WP3, T006 keyboard, T008 WP5, T009 WP6, T010 WP7, T011 integration; reviews T024-T031 | each approved after independent review (`T003/4/5_REVIEW.md`, `wp*.md`) |
| Gate A | T007 | `gate-a.md` |
| Gate B | T012 (+T036, T038), repairs T032-T035, T037 | PASS (limited), limits B1-B7 in `gate-b.md` |
| WP8 | T013 probe, T014 review, T039, T040 | **STOP** (Arabic lam-alef not searchable in WebKit PDFs); probe runs `20261025T070701Z-642a1146`, `20261025T072108Z-e51b1619`, `20261025T074258Z-7930e721` |
| WP9/WP10 | T015, T016 | cancelled by decision after STOP |
| Gate C | T017 | PASS as documented STOP (`gate-c.md`); T041 regression test |
| WP11 | T018 (+T042 review) | native baseline and beta suites, save benchmark |
| Artifacts | T019 (+T044), T043 (+T045) | rich-export inspection; multi-paragraph footnote repair in PDF and DOCX |
| Docs | T020, T049 | docs brought to Gate D state |
| Final qualification | T021, T046 (+T047), T048 | verifier, fresh normal app, verdict-heading fix |
| Gate D | T022 | **PASS (automated acceptance); beta readiness pending owner real use** (`06-durability/REVIEW.md` sha `0065be67...`; `gate-d.md`) |
| Hand-off | T023 | this task |

Final qualification (T021, load about 2, Node v22.23.3): tsc exit 0; build ok; units 865 passed in 47 files; production-preview Playwright 112 passed (23 specs, Chromium only); cargo 48 passed, 1 ignored; save benchmark median 108.12 ms, p95 117.98 ms (bound 150); native baseline run `20261025T093854Z-eb139b9b` 13 passed + 5 negative controls; native beta run `20261025T093937Z-7c31d8de` 19 passed + 42 negative controls; Gate D rerun `20261025T100024Z-93ccb1f1` same result. Source identity `7e07795970ee8195...` (143 inputs), diagnostic binary `9d4c24fe...`. Not run: native print matrix (WP8 STOP) and `verify-release.py` (needs clean git and a DMG; distribution descoped).

**Normal app:** `/Users/ethansiegel/Local Projects/VC Projects/Project 13 - Word Processor/src-tauri/target/release/bundle/macos/Personal Word.app`; `Contents/MacOS/folio` sha256 `66da1177a6b0063c88a34a8b4c6e58459f657d55bf2271d424582d121cb932f2` (re-hashed by me: equal), `com.folio.writing`, 0.1.1, x86_64, unsigned, 0 of 11 smoke markers (T021, Gate D). Never opened. Not Folio.app.

## 3. Known limitations (current)
- Save latency: release-mode p95 116.57 / 130.43 / 124.37 ms (T018) and 117.98 ms (T021) at load about 2 on one Intel Mac. The earlier 347 and 499 ms were taken on a heavily loaded host and are history only. Apple silicon unmeasured.
- PDF tables do not repeat the header row on continuation pages (DOCX marks it; unverified in Word); PDF images stack with no gap; DOCX and PDF omit project and section titles; DOCX continuation paragraphs are not indented while PDF's are; PDF refuses Arabic/Hebrew/CJK (use DOCX).
- BibTeX "Jr." suffix only in raw `cslData`.
- Gate B limits: Chromium only, no WebKit or native run of import/Zotero paths (B1); internal DOCTYPE entities not blocked by our code (B3); understated zip headers caught only after inflating (B4, Q003); Zotero C3 gaps -- no polling, no `since`, no remote-deletion marking, no distinct 403/down messages, any `/api/` path accepted, no resumable cancel (B5); browser-preview Zotero fetch is an unapproved C3 difference (B6); `zoteroOrigin` persistence untested (B7).
- Import dialog label says "up to 20 MB" while the plain-text cap is 5 MB.
- Native print, exact PDF preview and flowing per-page footnotes: not built (WP8 STOP).
- Evidence boundaries: test kills are process kills in an isolated store, not power loss; no hosted CI; no VoiceOver, IME, Word or Apple silicon evidence.

## 4. Open questions for the owner
- **Q001** (T013): off-board WP8 files. Decide (a) the off-board agent joins and claims T013, or (b) treat the files as unowned stray work. The coordinator adopted them under the board (decision 2026-10-25T03:37, agent-b8ae); a recorded answer closes it.
- **Q002** (T005): off-board Codex "teamwork" orchestrator editing store.rs, smoke.rs, tests/native-reliability.js. Decide (a) stop it or (b) have it join the board. Its edits were adopted under T018. Also decide what to do with the untracked `.agents/teamwork/` folder (keep, archive, delete).
- **Q003** (T012): zip header limit B4. (a) accept as a documented limit (current), or (b) open a task for a streaming byte cap during inflation (no new package).
- **Q004** (T013): native print STOP. (A) accept non-searchable Arabic and build WP9/WP10, (B) keep the legacy pdf-lib exporter and leave WP9/WP10 cancelled (current state), or (C) try a bundled OFL Arabic font first.

## 5. The off-board orchestrator problem
An off-board Codex "teamwork" orchestrator (folder `.agents/teamwork/`, untracked, with `ORIGINAL_REQUEST.md` and many auditor/worker/explorer subfolders) edited store.rs, smoke.rs, tests/native-reliability.js, sourceMerge, and rewrote `06-durability/REVIEW.md` and EVIDENCE.json drafts while the board was running. T005 had to be rejected once because of it. The coordinator adopted those files under T018 and T021; Gate D discarded the off-board "PASSED" rewrite of REVIEW.md (backups in `node_modules/.cache/personal-word-beta/team-t022/draft-backup/`). Details: `team/DISCOVERIES.md`, Q001, Q002.

## 6. Uncommitted state
Nothing committed or pushed. HEAD `ee2fe3a`; roughly 96 modified or untracked paths (source, tests, docs, `.agents/`, scripts, report folders). `scripts/__pycache__/` is reviewer bytecode: keep out of commits. The reviewer/owner commits after review, with no Claude Co-Authored-By trailer (project memory rule), and does not push without your say-so.

## 7. `team.py doctor`
```
$ python3 team/team.py doctor --agent agent-d5a8
OK
```
(followed by the informational line "123 unread message(s)".)

## 8. Definition of done -- my judgement (I ticked nothing in `team/PLAN.md`; the coordinator does that after reviewing T023)
1. Reconciled with the working tree -- **met** (T001 approved; Gate D review section 8).
2. All in-scope WPs and gates A-D complete, WP8 stop documented -- **met** (gates A-D approved including T022; WP9/WP10 cancelled per the STOP rule; `gate-c.md`, `feasibility.md`).
3. Required checks pass with retained logs and fail-first evidence; blocked not counted -- **met** for the automated scope (verifier exit 2, no failed check; print matrix and `verify-release.py` recorded not-run, not passed).
4. Limitations and evidence boundaries documented honestly -- **met** (T020 and T049 approved; section 3 above; T023 fixed the digest mentions and the HANDOFF.md latency line). `docs/recovery.md` still cites 347 to 499 ms, but explicitly as an earlier loaded-host figure, which is accurate.
5. Fresh normal app built, inspected, path recorded -- **met** (section 2).
6. Owner checklist prepared, status CLAIMED -- **met once T023 is approved** (`OWNER_TEST_CHECKLIST.md`, nothing pre-marked).
7. Every board task done and required reviews complete -- **not met until T023 is reviewed and approved**; the other 48 tasks are done.

After T023 approval, `team.py complete` should print COMPLETE. The beta is still **not ready**: the nine owner gates and Q001-Q004 remain, and the Definition of done does not require them.
