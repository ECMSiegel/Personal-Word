# Wave 5 coordinator state (agent-2a1b)
Updated: 2026-11-02 08:25 UTC (03:25 EST)

- Joined board as agent-2a1b "Coordinator (wave 5)". Announcement msg #917 posted to all.
- Wave-4 leftovers T183/T185/T186: all closed (done).
- Ready: T194 A1, T197 B1, T198 B2, T200 C1. Waiting for arriving agents to claim first (deadline for own workers ~00:45 UTC).
- Own workers: Sonnet default, max one Opus at a time, Fable only for final review.

## Assignments
| Task | Plan | Owner | State | Reviewer |
|---|---|---|---|---|
| T194 | A1 | agent-e586 OpenCode DeepSeek | DONE (approved 01:18) | agent-ff7a |
| T195 | A2 | agent-8594 own Opus | DONE (approved 02:2x, agent-85a1); repeat-announcement fix carried into A3 | agent-85a1 |
| T196 | A3 | agent-c49f own Opus | DONE (approved 03:43) | agent-d1d3 |
| T201 | C2 | agent-d1d3 OpenCode | DONE (approved) | own Sonnet reviewer |
| T197 | B1 | own Sonnet worker | DONE (approved c2 01:22) | agent-9e84/4e15 |
| T198 | B2 | e586 then agent-d1d3 | DONE (approved c2) | own Sonnet reviewer c2 |
| T199 | B3 gate | coordinator closes after T208 approved; nobody claims | gate | - |
| T208 | B3 work | Codex then agent-029c (own Sonnet) | DONE (approved) | agent-97c0 |
| T200 | C1 | agent-4857 Codex | DONE (approved cycle 2) | agent-2a1b |
- Strong-model (Opus) slot: free (A3 worker done 03:17). Next Opus: C3 after C2.
- Known flake (pre-existing): research.spec.ts:176 fails ~4/10 pre-B2 (agent-e586, ui5-b2-review/attribution-pre.log). split-view.spec.ts:155 failed once under load.
- For D1: design-system.md must say spy gutter 14 px on all three groups (decision by agent-c49f), progress ::after, hit area ::before.
- For the owner hand-check: at 190 px the group action icons cover the "Manuscript" label on hover (pre-existing, T096), word counts hidden at narrow width.
- For D1: bounded popovers wrap instead of sizing to content (design-system.md:63 deviation, B2).
- Known pre-existing: hover-emphasis 2 failures (Snapshot dialog Cancel 1.04) reproduce WITHOUT A3 (agent-d1d3 proof); split-view.spec.ts:155 flake.

## Parallel early starts (owner asked 2026-11-01 ~22:48 EST)
| Task | Gate it replaces | Worker | Port |
|---|---|---|---|
| T209 C3 early | T202 | DONE (approved by agent-2de6) | 1860 |
| T210 C4 early | T203 | own Sonnet -- DONE (approved by agent-97c0) | 1862 |
| T211 N1 early | T205 | own Sonnet -- DONE (approved by coordinator) | none |
| T212 D1 draft | T206 (final pass later) | own Sonnet -- DONE (approved) | none |
Gates T199, T202, T203, T205, T206: coordinator claims+closes each after its copy is approved (closing a gate releases dependents; do it only when the real work is approved). D1 final pass = T206 at the end.
- 04:00 load ~400: rule now EVERY vite build/Playwright takes serial-check.lock. N1 (T211) rejected by coordinator for rework: no Rust; floating shots always at end of native-screens (decision "N1 floating flag without Rust").
- OpenCode agents go idle when their turn ends; they only act when the owner prompts them. Default to own Sonnet reviewers.
- For D1 final (T206): also fix docs/user-guide.md:8 (still says arrow buttons reorder) -- register it with files add. TODO list: node_modules/.cache/personal-word-beta/ui5-d1/TODO-final-pass.md
- Gates to close after C3 (T209) releases App.tsx: T199 (B3), then T202 (C3), T203 (C4), T205 (N1).
- For C5 (from C4 review): card is ~770 px tall unscrolled -> must set --card-max-height from floatFit; pass animateIn=true for pointer opens only; aria-label stays "Add a citation" when heading says "Edit citation" (consider aria-label follows heading); Note form dropdown mapping duplicated from ResearchPanel (drift risk); card shows ISBN for books (beyond plan list, fine). C5 starts when C3 (T209) releases App.tsx.
- Process slip (minor): reviewer agent-97c0 used rm -rf on its own lock owner.txt once.
- For C3 review (after patch applied): handoff ui5-c3/handoff-note.txt; real tree 7/11 floating specs (4 = stale measure, fixed by patch); scratch+patch 108/109 (1 = Settings>Goals dropdown hover-emphasis crawl, fails WITHOUT C3 too -- pre1-hover-pw.log; cause unknown -> check in V); contrast ui5-c3/contrast.md all >= 4.5 on --paper (min --muted 4.78 on grey desk); fail-first is a doctored copy (not literal pre-C3); unverified: native WebKit, Versions fallback spec, non-floating overlay focus-on-reveal gap, --float-top on project-tabs toggle. DO NOT run ui5-c3/refresh-scratch.sh or scratch-run.sh.
- Owner hand-check: floating at <=240 px sidebar width, group hover buttons sit over the label with no backing (no-surface rule).
| T213 C5 early | T204 | DONE (approved by agent-8d29) | 1866 |
- Opus slot: C5 (T213). C3 reviewer: own Sonnet (port 1864), also hunting the hover-crawl :99 cause.

## Amendment 1 (owner approved ~01:30 EST): E1=T214 search clear DONE, E3=T215 palette component (now), E2=T216 scroll fade (after C5), E3w=T217 palette wiring (after C5 AND T215 -- manual), E4=T218 right-click menu (after T214, T217).
- C3 approved 06:44 UTC. Hover crawl :99 root cause = C2's extra Settings row shifts Goal scope dropdown under .pane-footer; crawler doesn't scroll; control itself fine. Test fix task T219 DONE (approved by coordinator).
- OWNER QUESTION (non-blocking): floating mode keeps the 1px --line hairlines between Read/Comments/History and above Settings (wave-4 row separators). Keep or strip?
- Open unverified from C3: Versions/History fallback spec; --float-top only updates on fit change.
- E3 (T215) in review (own Sonnet). For E3w: also register src/designTokens.test.ts and add src/components/command-palette.css to SWEPT; add close-on-outside-click; pass animateIn only for pointer opens.
- Stray empty folder /Users/ethansiegel/Local%20Projects (8 KB, empty dirs from a %20 path bug in E3/C4 harness specs) -- outside workspace; delete only with owner OK.
- C5 focus after Cite here = option A (follows panel; footnote text field focused). Owner hand-check item + D1 limitations.
- E3 (T215) APPROVED. For E3w: modal z-index 70 vs palette 60 (palette must not sit under an open modal -- decide: close palette when a modal opens, or raise it); active-row hint shifts ~21px right (shared 4% grow) -- check; add command-palette.css to designTokens SWEPT; outside-click close; animateIn only for pointer opens. E3w waits for C5 (App.tsx).
- C5 known limits for hand-check/D1: panel doesn't hand back to the card on widening until Research reopened (hysteresis); toast can overlap tall card bottom; Cite here after reload without clicking the editor inserts at document start (same as panel); card z-index 39 (bar/popovers are 40); Note form mapping duplicated. Slip: rm -rf on own ui5-c5/shots-prev.
- C5 approved ~08:00 UTC. Folded into E2: keep Cite here visible in the card preview (pinned action row / footer) -- reviewer found it below the fold at 900 px. Hand-check: hysteresis, toast overlap 7-12 px. E3w adds BOTH command-palette.css and scroll-fade.css to designTokens SWEPT (E2 must not touch designTokens.test.ts).
- 03:00 EST owner to bed. Stray folder deleted. Floating dividers: STRIP (in E4). D1 final = T220. V overnight without native; native NOT RUN + morning commands.
- T220 D1 final in review (docs for approved tasks); remaining TODOs for T216/T217/T218/V in ui5-d1f/TODO.md. PLAN: after E2/E3w/E4 approved, resume the D1-final worker to fill TODOs, then ONE docs review.
- Owner (03:2x EST): log the coordinator off the board when done -> at the end: handoff any live task, team.py check-exit --agent agent-2a1b, team.py leave --agent agent-2a1b.
- 08:25 UTC: E2 (T216) and E3w (T217) in review (own Sonnet reviewers). E2 note: fade dropped while .popover/.modal-backdrop inside (capture-quote modal broke under mask). Next: E4 after T217 approved; then resume D1-final worker for TODOs; then V.
- 09:0x UTC: E3w (T217) APPROVED c2 (caret restore). E4 (T218) started on Opus incl. floating divider strip. E2 (T216) in review.
- E2 (T216) APPROVED (agent-837e). Suggestions for V/Fable: add a 560 px 'Cite here inside card' check to tests/scroll-fade.spec.ts (current assertions weak at 900 px). Floating list clipping behind bottom rows at 560 px -> sent to E4.
- E4 (T218) in review (own Sonnet). Hand-check: PDF row menu Move items move its source unit (author's reading); floating-only list fade at short windows; dividers stripped above Comments/History/Settings in floating mode. D1 worker resumed to fill TODOs.
- 09:3x UTC: ALL BUILD TASKS DONE (13 original + E1-E4 + T219). Coordinator removed 'pending review' wording (4 docs). Next: T220 docs review + V (T221) in parallel; then Fable review; repairs; VALIDATION.md final; gates; leave board.
- 09:2x UTC: T220 docs APPROVED c2. Only V (T221) running. Next: Fable review after V.
- 09:4x UTC: V (T221) done -> review by Fable. 1124 unit, PW 405/3 fail (motion (e) failed twice -> Fable investigating; motion (a) + writing-aids:21 passed rerun), cargo 63/1, exports identical x12, release app sha256 6704f6e2...2457 (rebuild if repairs). Fable also checking: floating Research row peeking above Read (V shot), Full-citation dropdown selected row weight.
- 10:2x UTC Fable: SHIP AFTER REPAIRS. Must fix 1,2,3,5 (T222 repairs); 4 = motion (e) wave-5 regression (HEAD 0/33 vs wave5 11/63; not B2) -> bounded Opus bisect; owner/wave6: 6,7,8,9a-p.
- 10:5x UTC: Fable repairs T222 + test race T223 approved. Gates T199,T202-T206 closed; T207 waits for V2 (T224) to release VALIDATION.md, then resume bookkeeper (agent-a610 still on board) to claim/done T207 -> coordinator approves. V2 running (rerun steps 1-4 + release rebuild).
- 11:2x UTC (06:2x EST): coordinator signed off; left the board.
