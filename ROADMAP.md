# Personal Word roadmap

Personal Word is an experimental Mac-first writing workspace. These are priorities, not promised delivery dates. The detailed [application improvement plan](docs/plans/application-improvement-plan.md) records implementation progress and incomplete acceptance criteria.

## Reliability and interchange first

1. Autosave deadlines and native forced-termination recovery are covered by unit tests and an isolated three-phase native run (quit flush, journal recovery after deliberate termination, snapshot restore). Interactive second-instance verification remains open.
2. DOCX XML and rendered DOCX/PDF artifacts have been inspected for formatting, lists, notes, bibliography, and overflow. PDF font coverage now uses bundled subsets for Latin, Latin Extended, Greek, and Cyrillic; complex-script shaping and long-note overflow remain open.
3. Markdown import is delivered: UTF-8 `.md`/`.markdown` up to 5 MB through a sanitized preview that never fetches remote images. JSON recovery remains a separate full-project operation.
4. Complete native keyboard, VoiceOver, IME, window-size/zoom, and light/dark checks. Improve small controls and discoverability based on observed problems.
5. Extract App/Writer lifecycle and layout responsibilities without introducing competing project state or breaking undo and save behavior. Footnote layout and dialog rendering have moved out of `Writer`/`App`; the wider orchestration is unchanged.

## Writer workflows -- October 18 implementation

CSL JSON source import, manuscript-order automatic short notes and short titles, quote capture, word goals/deadline, optional focus/prose decorations, and whole-project Markdown/plain-text export are implemented (CLAIMED; qualification and owner confirmation tracked in the writer-features implementation log). BibTeX/live sync, automatic grammar correction, and per-chapter note restarts remain outside this pass.

## Bounded starter contributions

- Report a reproducible keyboard/focus or native WebKit layout problem with a small synthetic project.
- Extend native coverage to VoiceOver, IME, window-size/zoom, and light/dark review.
- Correct documentation against observed behavior, naming the browser/native environment.

Read [CONTRIBUTING.md](CONTRIBUTING.md) before changing persistence or editor schema. Coordinate larger features in an issue before implementation.

## Before a downloadable general-user release

Complete native durability and artifact qualification, long-session and large-document checks, binary dependency notices/corresponding-source packaging, and signed/notarized distribution. A passing browser suite or a successful bundle build does not close these gates.

Cloud sync, accounts, subscriptions, collaboration, and full Word compatibility are outside the current roadmap. The source can be shared as an explicitly experimental alpha while these release gates remain open.
