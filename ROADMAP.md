# Personal Word roadmap

## Current status -- 2026-10-25 owner acceptance

**Beta: all nine owner real-use gates passed, confirmed directly by the owner.** See [owner results](docs/agent-work/2026-10-24-team-reconciliation/OWNER_TEST_RESULTS.md). Earlier dated statements below about pending owner testing or an unopened app describe the pre-acceptance state. Q001-Q004 were also resolved; the legacy PDF exporter remains, and signing/download distribution remains outside beta scope.

Personal Word is an experimental Mac-first writing workspace. These are priorities, not promised delivery dates. The detailed [application improvement plan](docs/plans/application-improvement-plan.md) records implementation progress and incomplete acceptance criteria.

## Reliability and interchange first

1. Autosave deadlines and native forced-termination recovery are covered by unit tests and an isolated three-phase native run (quit flush, journal recovery after deliberate termination, snapshot restore). Interactive second-instance verification remains open.
2. DOCX XML and rendered DOCX/PDF artifacts have been inspected for formatting, lists, notes, bibliography, and overflow. PDF font coverage now uses bundled subsets for Latin, Latin Extended, Greek, and Cyrillic; complex-script shaping and long-note overflow remain open. A native WebKit print path for an exact PDF preview was investigated on 2026-10-25 and stopped (Arabic lam-alef text was not searchable with 26 of 28 installed fonts); the legacy PDF exporter remains the only path and the decision is with the owner (question Q004).
3. Markdown import is delivered: UTF-8 `.md`/`.markdown` up to 5 MB through a sanitized preview that never fetches remote images. JSON recovery remains a separate full-project operation. Since the 2026-10-25 beta board, HTML, Word (.docx) and Markdown-with-images (.zip) bundle import and export are also implemented and tested (CLAIMED); see below.
4. Complete native keyboard, VoiceOver, IME, window-size/zoom, and light/dark checks. Improve small controls and discoverability based on observed problems.
5. Extract App/Writer lifecycle and layout responsibilities without introducing competing project state or breaking undo and save behavior. Footnote layout and dialog rendering have moved out of `Writer`/`App`; the wider orchestration is unchanged.

## Writer workflows -- October 18 implementation

CSL JSON source import, manuscript-order automatic short notes and short titles, quote capture, word goals/deadline, optional focus/prose decorations, and whole-project Markdown/plain-text export are implemented (CLAIMED; qualification and owner confirmation tracked in the writer-features implementation log). BibTeX/live sync, automatic grammar correction, and per-chapter note restarts remained outside that pass (BibTeX and an optional local Zotero refresh were added later; see below).

## 2026-10-25 beta board

Implemented and tested by automated and isolated-harness checks, all CLAIMED until the owner confirms them in real use: images and tables in the editor, reading view and every exporter; HTML, Word and Markdown-bundle import with bounded decompression; Markdown note round trips; Markdown bundle export and import with manifest and hash checks; BibTeX import; an optional local, read-only Zotero refresh (off by default); keyboard-only Home and indent; and a native durability matrix. Evidence: [validation record](docs/validation.md).

Still open: owner real use (Intel and Apple silicon), Microsoft Word rendering, VoiceOver and input methods, long sessions, owner first launch of the freshly built normal app (built and inspected 2026-10-25, see Gate D below; the final qualification and Gate D review are done as automated acceptance only), Zotero refresh polling and real-Zotero testing, a streaming zip size cap (question Q003), PDF table header repeat, and an exact PDF preview (question Q004; the native print probe is a documented STOP).

### Gate D, 2026-10-25
Final qualification (T021, T046) and the independent Gate D review (T022) finished with the verdict **PASS for automated acceptance; beta readiness pending owner real use** (CLAIMED, not beta ready, nothing VERIFIED). Final-source numbers: `tsc` 0; 865 unit tests in 47 files; production-preview Playwright 112/112 across 23 spec files (Chromium only); Rust 48 passed, 1 ignored; isolated native baseline `20261025T093854Z-eb139b9b` 13 + 5 and beta `20261025T093937Z-7c31d8de` 19 + 42 (Gate D rerun `20261025T100024Z-93ccb1f1` 19 + 42); save benchmark p95 117.98 ms. Normal app: `src-tauri/target/release/bundle/macos/Personal Word.app`, `com.folio.writing` 0.1.1, binary sha256 `66da1177a6b0063c88a34a8b4c6e58459f657d55bf2271d424582d121cb932f2`; unsigned, never opened. Still open for the owner: keyboard-only editing and the duplicate-comment jump in the real app; blocked-close retry; the recovered image and its hash; reopening the pre-restore safety copy; Microsoft Word rendering of the exported DOCX; an Apple silicon run; VoiceOver and input methods; a long real writing session; native WebKit light/dark visuals; and questions Q001-Q004. Record: [validation record](docs/validation.md).

## Bounded starter contributions

- Report a reproducible keyboard/focus or native WebKit layout problem with a small synthetic project.
- Extend native coverage to VoiceOver, IME, window-size/zoom, and light/dark review.
- Correct documentation against observed behavior, naming the browser/native environment.

Read [CONTRIBUTING.md](CONTRIBUTING.md) before changing persistence or editor schema. Coordinate larger features in an issue before implementation.

## Before a downloadable general-user release

Complete native durability and artifact qualification, long-session and large-document checks, binary dependency notices/corresponding-source packaging, and signed/notarized distribution. A passing browser suite or a successful bundle build does not close these gates.

Cloud sync, accounts, subscriptions, collaboration, and full Word compatibility are outside the current roadmap. The source can be shared as an explicitly experimental alpha while these release gates remain open.
