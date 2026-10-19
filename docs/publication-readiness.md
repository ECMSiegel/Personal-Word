# Source publication readiness

Review date: 2026-10-19. Scope: a local source alpha, version `0.1.0`, intended tag `v0.1.0-alpha.1`. No remote, push, hosted release, or binary distribution is authorized.

## Prepared locally

- GPL-3.0-only license and matching npm/Cargo metadata. The npm package remains private to prevent accidental npm publication.
- Public README promoted from the reviewed draft, with synthetic browser screenshots, setup, workflows, and explicit alpha limitations. Contribution/security guidance, issue forms, and roadmap are included.
- GitHub Actions workflow exists for macOS build, unit/browser tests, and Rust tests, with read-only permissions and pinned actions. It has not run on GitHub.
- Dependency license inventory and regeneration script are included. A distributed app still needs complete bundled notices, including Noto OFL texts; see [THIRD_PARTY.md](../THIRD_PARTY.md). This alpha is source only.
- `AGENTS.md` and `docs/agent-work/` remain public. Machine-specific paths were scrubbed from the current tracked text. `HANDOFF.md` remains local and ignored.
- Owner authorized rewriting local commit identities to the supplied GitHub noreply address before any first push. Local configuration now uses that address; a recoverable pre-rewrite Git bundle was verified. Git delivery follows validation recording; inspect the local tag and handoff for actual commit/rewrite results.

## Evidence and boundaries

The writer-feature baseline (`f43c09d`, before identity rewriting) had 149 passing unit tests, 45 passing Chromium scenarios, and 17 passing Rust tests with one ignored benchmark. Those are earlier results, not this pass's qualification. Fresh source-alpha results: full `npm test` passed 163/163 tests in 17 files; Rust passed 17 tests with one ignored benchmark. The targeted deadline browser regression passed after failing with its mutation guard removed. The exact-final-source `npm run tauri build` passed: 15.25 MiB, version 0.1.0, historical identifier retained; executable newer than all 77 source files, smoke diagnostic symbols absent. Full browser qualification is blocked: privileged commands were not executed due to automatic approval review timeouts, then model-capacity failure even after owner-approved retry. A sandboxed attempt failed localhost binding with EPERM before tests. No full-browser pass or product failure is inferred.

Earlier native harness runs exercised isolated SQLite save/recovery. A later native run stalled before UI injection with macOS system-service errors. Browser tests do not prove native WebKit rendering or SQLite persistence. Owner confirmation, quiet-desktop native review, VoiceOver/IME, and Microsoft Word/LibreOffice export rendering remain open. See [validation](validation.md) for dated evidence.

Historical clean-source-copy installs, credential-pattern scans, and fixture inspection are bounded checks from the earlier publication preparation. They have not been repeated against all rewritten history in this pass. Removing local agent state from the current tree does not remove historical copies from earlier commits. Author identity rewriting changes commit metadata, not historical file contents.

## Before any public push

1. Owner supplies an empty repository URL and explicitly authorizes adding a remote and pushing. This session stops locally.
2. Review the complete intended public history as well as the current tree. Historical agent files and earlier text remain reachable even when removed from the current tree.
3. Enable the host's private vulnerability-reporting route and verify the conditional instructions in `SECURITY.md`.
4. Observe the first hosted CI run and resolve host-specific failures; set the repository description/topics.

Before distributing binaries, separately complete bundled license notices and GPL corresponding-source delivery, native qualification, export review, and signing/notarization. A local successful app build does not close those gates.
