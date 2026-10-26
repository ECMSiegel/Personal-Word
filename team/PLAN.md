Edit this file only through a logged decision (`decide`) or as the user.

# Personal Word beta

The single source of truth for this project. Every agent reads it before working (see
`team/PROTOCOL.md`). Agents propose changes with `propose`; they never edit it silently.

## Goal
Complete the remaining Personal Word beta roadmap, pass its review gates, and prepare it for owner testing.

## Scope
Follow WP1-WP11 and review gates A-D in `docs/agent-work/2026-10-24-delegation/DELEGATION.md`, with the referenced beta roadmap and child plans governing behaviour as specified there. Inspect the current working tree, existing implementation reports, and review evidence before assigning tasks; preserve newer work and do not redo completed tasks. Use the delegation plan's file ownership and dependency order when registering tasks.

Addendum 2026-10-25 (owner approved): also execute `docs/agent-work/2026-10-25-cheap-fixes/PLAN.md` tasks T1-T8 (eight small known limitations), one board task each, with its file ownership, fail-first rules and validation list. Defaults chosen by the owner for that plan's open questions: remove the browser-preview Zotero fetch path; Word and PDF print section titles always and the project title except on the Chicago template.

Addendum 2026-10-25 (owner approved, UI polish): also execute `docs/agent-work/2026-10-25-ui-polish/PLAN.md` tasks T0-T11 and its Validation list, one board task each, following that plan's files, interfaces, fail-first checks, acceptance commands and the five answered open questions; the chain T1 -> T2 -> T4 -> T5 -> T7 -> T8 -> T9 runs serially because each edits `src/styles.css` or `ProjectLibrary.tsx`; T0, T3 and T6 may run alongside.

Addendum 2026-10-26 (owner approved, UI wave 2): also execute `docs/agent-work/2026-10-26-ui-wave-2/PLAN.md` tasks U1-U21 (board T098-T118) and its Validation list, one board task each, with its files, fail-first checks, acceptance commands and the seven answered open questions; U1-U14 and U16-U21 run as a serial chain, U15 and U17 may run alongside.

## Non-goals
No signing or distribution work, publishing or pushing, new packages, unrelated redesign, or changes to real user data. Layout implementation beyond WP8 is conditional on WP8 passing its feasibility check; follow its stop rules if the probe fails.

## Architecture notes
Retain the existing React/TypeScript/Tiptap frontend and Rust/SQLite persistence boundaries described in `docs/architecture.md`; follow the workspace and project `AGENTS.md` and the delegation plan's Common rules. Preserve `com.folio.writing`, `folio.*` storage keys, native event names, additive project/entry metadata, increasing revisions, SaveQueue semantics, safety snapshots, and recovery data. Keep image bytes out of the localStorage recovery journal.

Register each task's owned paths through the team tool before editing; never edit paths registered to another live task. Preserve existing uncommitted work and inspect it before assigning or implementing changes. Native tests must use isolated `com.folio.smoke` storage and must never touch the real writing library. Browser tests do not prove native persistence or WebKit rendering.

Keep the existing Personal Word UI conventions: sans-serif interface, flat surfaces, square corners, live system light/dark and reduced-motion behaviour, keyboard access for hover actions, and `--` UI separators. Do not silently resolve contradictions between plans and the current implementation; report them for a decision.

## How to verify
Verification happens throughout implementation, not as a full-suite prerequisite to every edit:

1. Before implementation, inspect the current changes and existing evidence, identify unfinished work, and reproduce bugs before fixing them. Do not redo completed work. Demonstrate new or changed checks failing against the old implementation or a safely doctored isolated copy before trusting their passing result; retain the evidence and restore any doctored files exactly.
2. After each task, run its acceptance checks from `docs/agent-work/2026-10-24-delegation/DELEGATION.md` and the applicable child plan.
3. At review gates A-D, independently review and test the applicable wave before starting the next. Respect the WP8 feasibility stop rules.
4. At final qualification, run the full build, unit suite, production-preview Playwright suite, offline serial Rust tests, isolated native baseline/beta suites, light/dark screenshot inspection, exported-artifact inspection, and a fresh normal app build.

Run commands from the project root unless explicitly noted. Use the pinned Node v22.23.3 under `node_modules/.cache/personal-word-alpha-review/tools/node-v22.23.3-darwin-x64/bin` for npm/npx commands. Core commands:

```sh
export PATH="$PWD/node_modules/.cache/personal-word-alpha-review/tools/node-v22.23.3-darwin-x64/bin:$PATH"
node --version
npx tsc --noEmit -p .
npm run build
npm test
npx playwright test -c node_modules/.cache/personal-word-beta/c2r-full.config.mjs --workers=1
cargo test --manifest-path src-tauri/Cargo.toml --offline --jobs 1 -- --test-threads=1
npm run tauri build -- --debug --features native-smoke --no-bundle --config '{"identifier":"com.folio.smoke"}'
python3 scripts/native-reliability.py --suite baseline
python3 scripts/native-reliability.py --suite beta
npm run tauri build
```

Inspect the production-preview configuration before use; if the recorded cache configuration is absent or stale, report the gap and use an equivalent production-preview configuration with isolated results, following the delegation plan. The beta native suite is a WP11 deliverable: its absence before WP11 is unfinished work, not a passing check.

Run expensive builds, Playwright, cargo, and native checks one at a time, in the background with retained logs under `node_modules/.cache/personal-word-beta/`; read their full logs and do not rerun merely because a foreground wait timed out. Coordinate the serial check slot across agents. Inspect actual light/dark screenshots and rendered export artifacts. Record blocked or failed checks honestly; browser results do not establish native WebKit/SQLite behaviour. Confirm the final normal `Personal Word.app` path and metadata and absence of smoke markers before offering it. Automated implementation evidence remains CLAIMED; only the owner's real-use confirmation establishes VERIFIED behaviour.

## Definition of done
- [x] Existing implementation and review evidence have been reconciled with the current working tree, preserving newer work and avoiding duplicate tasks.
- [x] All in-scope work packages and review gates A-D are complete, with layout beyond WP8 performed only if its feasibility check passes; any stop outcome is documented according to the plan.
- [x] All required applicable checks pass with retained logs and fail-first evidence; blocked checks are not counted as passes.
- [x] Known limitations and evidence boundaries are documented honestly in the applicable project documentation.
- [x] A fresh normal Personal Word.app has been built and inspected for the correct identity and absence of smoke markers, and its current path is recorded.
- [x] The owner's manual real-use test checklist is prepared, with implementation status CLAIMED pending owner confirmation.
- [x] Every task on the team board is done and required independent reviews are complete.
- [x] Cheap-fixes plan (2026-10-25) tasks T1-T8 are done with independent reviews, the plan's validation list has run, and README/validation.md no longer list the fixed items.
- [x] UI polish plan (2026-10-25) tasks T0-T11 are done with independent reviews, its validation list has run, native screenshots were viewed, and the owner hand checks are prepared with status CLAIMED.
- [ ] UI wave 2 plan (2026-10-26) tasks U1-U21 are done with independent reviews, its validation list has run, native screenshots were viewed, and the owner hand checks are prepared with status CLAIMED.

## Milestones
1. Reconcile the current working tree and existing implementation/review reports before assigning remaining work.
2. Complete remaining waves 1-2 and review gate A, including review of wave 0.
3. Complete remaining wave 3 and review gate B.
4. Run WP8 feasibility; continue with WP9-WP10 only if it passes, then complete review gate C or document the prescribed stop outcome.
5. Complete WP11 final durability/evidence work and review gate D; prepare the fresh normal app and owner real-use test checklist.
6. Cheap fixes (2026-10-25 addendum): T1-T8 of the cheap-fixes plan, then its validation list and evidence regeneration.
