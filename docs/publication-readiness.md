# Source publication readiness

Review date: 2026-10-17. Scope: the current working tree based on `c62332c`, including uncommitted application improvements. This is a source-alpha preparation record, not a signed-binary release certification.

## Prepared locally

- GPL-3.0-only license selected by the owner, with the complete official GPL v3 text in `LICENSE` and matching npm/Cargo metadata. The npm package remains private to prevent accidental npm publication; this does not prevent a public Git repository.
- Newcomer README, a freshly captured synthetic Chromium screenshot, contribution/security guidance, issue forms, and a prioritized roadmap.
- GitHub Actions workflow for macOS frontend build, unit/browser tests, and Rust tests, with read-only permissions and immutable action references. Hosted execution remains unverified until a repository exists and the workflow runs there. Native GUI smoke is a separate qualification step.
- Lockfile dependency license metadata and a regeneration script. See [THIRD_PARTY.md](../THIRD_PARTY.md) for inventory coverage and source-versus-binary limitations.
- Local agent state and common credential files excluded by `.gitignore`; no local agent files or user projects deleted.
- Contradictory current architecture claims corrected. Historical verification is retained separately. One machine-specific temporary directory was redacted from the old smoke evidence without changing its recorded outcomes.

## Verification and audit boundaries

- Frontend build and 64 unit tests passed in the working tree.
- Rust tests passed: 17 passed, 1 benchmark ignored (`cargo test --locked --offline --manifest-path src-tauri/Cargo.toml`). This does not replace native UI smoke testing.
- All 31 Chromium browser scenarios passed, including rename/delete/recovery. This supersedes the previous sandbox startup block for browser testing only.
- A temporary source copy was created from tracked files plus non-ignored candidate files, without `.git`, `node_modules`, build output, or `.claude`. Fresh `npm ci`, build, and all 64 unit tests passed there. This is a clean source-copy check, not a remote clone or a claim that the current work is committed. The initial local Node 25.5.0 run emitted a dependency engine warning. A second fresh install, build, and all 64 unit tests passed on Node 22.23.3, matching CI's major version. Hosted CI remains unverified.
- Credential-pattern scanning covered all 227 distinct historical blobs reachable from the eight current commits. No matches for the checked private-key, GitHub-token, AWS access-key, or OpenAI-style token patterns were found. This is a bounded pattern scan, not proof of absence of secrets or a security review of every line.
- The historical screenshot was visually checked and contains synthetic test prose; it depicts the older interface and is retained only as historical evidence. The README uses a new synthetic screenshot.
- The version-1 SQLite fixture was opened read-only and inspected; project, entry, and snapshot samples contain synthetic fixture prose. Historical binary content was not comprehensively classified.
- Current text was checked for machine-specific paths. Git author metadata exposes a personal email address. No email address is reproduced here, and no history was rewritten.

## Decisions/actions before making the repository public

1. Owner reviews whether to publish existing author-email metadata. If privacy changes are wanted, agree on the exact history treatment first; changing future Git configuration alone does not change existing commits.
2. Review and commit the complete intended source tree, including the pre-existing uncommitted improvements and new files. Do not publish only the existing HEAD and assume these files are included. This preparation pass did not stage or commit work.
3. Create the chosen remote and explicitly authorize the push. No remote, push, release, or public upload has occurred in this pass.
4. Enable a real private vulnerability-reporting route on the host and verify the conditional instructions in `SECURITY.md`. No private contact or hosting feature is invented by that document.
5. Observe the first hosted CI run and resolve host-specific failures. Keep alpha limitations visible; do not treat the incomplete application improvement plan as completed.

The 2026-10-18 completion pass changed two items on this list. PDF now embeds unmodified WOFF2 subsets of three OFL-1.1 Noto font packages, so a distributed binary must ship those fonts' OFL license texts and notices; the source tree documents the obligation in [THIRD_PARTY.md](../THIRD_PARTY.md) but does not yet place the notices in a bundle. Synthetic DOCX and PDF fixtures were generated and inspected (DOCX XML plus macOS QuickLook renders), which narrows but does not close Word-application rendering review: no Microsoft Word or LibreOffice pass was run.

Before distributing binaries, separately finish native qualification, actual export artifact review, complete license/copyright notices for bundled components, GPL corresponding-source delivery, and signing/notarization. See [ROADMAP.md](../ROADMAP.md). These are not represented as completed by source publication preparation.
