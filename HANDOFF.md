# Personal Word -- writer-features delivery state
Updated: 2026-10-18 (evening) | Status: implementation + qualification complete in the working tree, **CLAIMED**, not owner-VERIFIED.

## Authority and scope
- Owner: "implement/commit everything uncommitted or unbuilt that is planned". Local commit/build authorized; **no push/publication** was requested.
- Approved plan: `docs/agent-work/2026-10-18-writer-features/PLAN.md`. Evidence: adjacent `IMPLEMENTATION_LOG.md` (incl. "Resume pass", "Repair pass", "Final qualification"). Independent review: adjacent `REVIEW.md` (verdict APPROVE).
- Baseline for this work: `d8aa72c` (`Complete writing workflow qualification and prepare source release`).

## What this delivery adds (six features, all local-only)
CSL JSON (Zotero) source import with preview; manuscript-order automatic short notes and per-source short titles; quote capture with page and one-undo citation insertion; word/daily goals with deadline and status line; optional local prose check plus focus mode; whole-project Markdown/plain-text export. Docs updated in `docs/personal-word-v2.md`, `README-draft.md`, `ROADMAP.md`, `docs/validation.md` (new dated section). `README.md` intentionally untouched.

## Final qualification (fresh, after all repairs)
- `npm run build`: exit 0.
- `npm test`: 149 passed in 17 files.
- `npm run test:e2e -- --workers=1`: 45 passed in Chromium (2.9 min) on the confirming rerun; first pass 44/45 with a load-only flake at `tests/accessibility.spec.ts:93` (ProseMirror 500 ms keystroke grouping), test and threshold unchanged. Browser storage only, not native WebKit.
- `cargo test --manifest-path src-tauri/Cargo.toml`: 17 passed, 1 ignored. No Rust/schema/dependency change.
- Light/dark focus+prose screenshots at 1440x900 regenerated and inspected (copies kept at `/tmp/pw-writer-screenshots/`; the ignored `test-results/` is wiped by every Playwright run).
- Typing cost: aids off 20.4 ms vs on 17.9 ms median (1,200-word paragraph, production build, in-page timing) -- under the plan's 25 ms limit. Realistic dense text unaffected. Absolute timings on this machine are noisy (load average 15-600); only within-run off/on deltas are trustworthy.
- Logs: `/tmp/pw-writer-final-qualification.log`, `/tmp/pw-writer-e2e-rerun.log`, `/tmp/pw-writer-native-smoke-run.log`.

## Build / native
- Fresh normal release bundle: `npm run tauri build` passed. `src-tauri/target/release/bundle/macos/Personal Word.app` (15.25 MiB); `Info.plist` = `com.folio.writing` / Personal Word / 0.1.0; executable built 2026-10-18 18:26 America/New_York, newer than all source; no smoke symbols. Log `/tmp/pw-writer-release-build.log`. Never offer an old baseline build as this one.
- Native smoke: attempted for this pass; environment-blocked at the known macOS stall (breadcrumbs stop at `ok native paragraph pagination`, 180 s timeout, `NSSpellServer` timeout). Log `/tmp/pw-writer-native-smoke-run.log`. A quiet-desktop re-run remains the owner's confirmation; no native behaviour is claimed.

## Fixes taken in this session (each with fail-first where practical)
- Decoration issue read via the public `spec` instead of runtime-only `attrs` (restored a broken `tsc` build: `TS2339`).
- `validateProject` present-only type checks for source `shortTitle`/`cslId` and research `autoShortNotes`.
- D1: untitled source's shortened note printed a bare "." → `shortTitle(s) || title`.
- R4: negative per-day goal figure → require `goals.totalWords > done`.
- R5: dangling `htmlFor="capture-source"` → `<span className="field-label">`.
- R1: bounded prose decoration cap `MAX_PROSE_DECORATIONS = 2000` nearest the cursor (owner-approved scope extension) + panel note; fail-first test added.
- Pushed back with evidence: R3 (typed newline in quote is preserved by design; recorded as a documented limitation), R7 (shared `emptyResearchData` default prop, Info).

## Still CLAIMED -- owner confirmation required (exact steps)
1. Blank project → Research → "Enter manually" → "Cite here" twice: the second note should be a shortened form (e.g. "Halloway, Lamps and Ledgers, 48."), not a full note or a bare ".".
2. Settings → Goals: set a daily goal, type past it, check the status line; reload and confirm the baseline persisted.
3. Toolbar → Focus mode (Cmd/Ctrl+Shift+F) and Prose check → On: confirm the dim scope and dotted underlines look right in light and dark, and that typing stays smooth in a normal-length document.
4. Settings → Export Markdown / Export plain text: open the files and confirm notes, bibliography, fragments, and research notes are present.
5. A native pass in `Personal Word.app` for the new decorations, focus dim, and Capture quote dialog (WebKit only; Chromium is not proof).

## Boundaries / limits to keep stated
- Typed multi-line quote text is stored exactly as typed; only pasting runs `cleanPastedQuote`. Documented limitation.
- Zotero import is CSL JSON only (no BibTeX/live sync); unsupported item types are counted, never silently dropped.
- Short notes do not restart per chapter and never use "ibid.".
- Prose check is a fallible local heuristic and never changes the document; off by default.
- Goals count manuscript sections only; daily baseline is a local preference, not cross-device history.
- Markdown footnotes do not round-trip through manuscript import.
- PDF export uses bundled Noto subsets (Latin/Greek/Cyrillic); other scripts refused with a message.
- Prose-check absolute performance is not verified; only the decoration-count cap is a hard bound.

## Rules / follow-ups
- Keep `com.folio.writing`, `folio.*` keys and native event names; additive metadata only; immutable revisioned SaveQueue writes. No Rust/schema/dependency change was made.
- Do not commit another session's files. Generated outputs (`dist/`, `test-results/`, `src-tauri/target/`) stay ignored.
- No graphify graph exists for this project.
- The currently committed/built app is the writer-features build only after this session's commit; until then, treat any earlier bundle as the baseline.
