# T006 -- keyboard-only Home and indent qualification

Date: 2026-10-25 | Agents: agent-c436 (Codex; wrote the two test cases, went stale before rerunning
them), agent-1a38 (Claude Code; reclaimed at 22:05 EDT, executed and qualified). Status: CLAIMED.

## The open edge, as recorded
The editing log and review (`docs/agent-work/2026-10-20-beta-roadmap/02-editing/`) recorded that
when the editor had only just received *keyboard* focus (no pointer click, ProseMirror's
"recent focus" window of roughly 170 ms), one Home key press moved the DOM caret to offset 0 while
the ProseMirror selection stayed at the paragraph end, and the DOM observer then put the DOM caret
back to the end without any transaction. The R1 tests only ever qualified the pointer-click entry
path. HANDOFF.md kept "keyboard-only Home/indent observer edge" open.

## What was already there
`tests/ci-indent.spec.ts` had three pointer-entry cases (Blank, Chicago, Screenplay) that click
the paragraph before typing. No production code touches Home; `src/editor/indent.ts` only binds Tab
and Shift-Tab.

## Changes (tests only; no production code changed)
`tests/ci-indent.spec.ts` (+108 lines, by agent-c436): helper `enterEditorByKeyboard` focuses the
"Bold (⌘B)" toolbar button and presses Tab until `document.activeElement` is the writing editor
(the focus journey is attached to the test), with no click or programmatic editor focus. Two new
cases, "Keyboard focus: Blank ..." and "Keyboard focus: Chicago ...", then type, press Home once,
and poll until DOM `anchorOffset` is 0 and the ProseMirror selection is empty at `parentOffset` 0,
before pressing Tab. The original style, focus, undo, redo, acknowledged-save and reload assertions
are kept verbatim. No sleeps, no retries. agent-c436's first run failed only on a wrong locator
("Bold" instead of "Bold (⌘B)", `team-t006/baseline.log`); that is a harness setup error, not
product evidence, and was corrected before any passing run.

## Commands and results (agent-1a38, pinned Node v22.23.3, serial slot held)
Logs in `node_modules/.cache/personal-word-beta/team-t006/`; production preview on isolated ports.

| Log | Command | Result |
|---|---|---|
| `rerun.log` | `npm run build` | exit 0, 9.93s |
| `rerun.log` | `npx playwright test -c team-t006/rerun.config.mjs tests/ci-indent.spec.ts --workers=1` (port 1455) | 5 passed (14.8s), both keyboard cases included |
| `qualify.log` | same, `--grep "Keyboard focus" --repeat-each=10` | 20 passed (1.2m), 10 runs of each keyboard case, 0 failures |
| `qualify.log` | `tests/editor-toolbar.spec.ts tests/comments.spec.ts --workers=1` | 6 passed (9.9s) |
| `qualify.log` | `control.log`: doctored control, a type-stripped `.mjs` copy of the spec with every `Home` replaced by `End`, keyboard cases only (`team-t006/control/ci-indent-control.spec.mjs`, port 1456) | 2 failed, both at the offset-0 poll (received ProseMirror offset 27 and 31), exit 1 |

## Fail-first evidence
The shared spec was never doctored. The control copy under `team-t006/control/` replaces Home with
End; its two keyboard cases fail at the DOM/ProseMirror offset-0 poll (received 27 and 31 instead
of 0), which shows the new assertions are live and would catch a Home that leaves the selection at
the paragraph end, the exact symptom recorded for the observer edge. Two earlier control attempts
did not run at all and are kept honestly in `qualify.log` / the first `control.log`: a `.ts` copy
under node_modules cannot be type-stripped by Node, and a copy in the session scratchpad cannot
resolve `@playwright/test`; neither produced a test result.

## What this does and does not establish
- Keyboard-only entry (Tab from the toolbar), one Home, then Tab indent now passes repeatedly in
  Chromium on the production preview for Blank and Chicago templates, with DOM and ProseMirror
  selection both asserted at offset 0 before the indent.
- No production repair was needed because no defect reproduced on the current build; the earlier
  observer trace stays as history, not as a current failure.
- Not covered: native WebKit keyboard behaviour (no native run in this task), hosted CI (not
  available without external authorization; nothing dispatched or pushed), owner real-use.
Status CLAIMED pending independent review and owner confirmation.
