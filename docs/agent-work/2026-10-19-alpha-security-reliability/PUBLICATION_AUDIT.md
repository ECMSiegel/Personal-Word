# Publication and dependency audit (T1)

Audit date: 2026-10-19. This report is limited to the approved source-alpha review. It records the main/tag baseline before any separately authorized history cleanup. The report does not change application code, dependencies, Git refs, the index, or the pre-existing owner evidence documents.

## Baseline and scope

- `main` and `v0.1.0-alpha.1` resolved to `f324a7a5ee19a2fa06375dd50108dfaee9e7cb9c`: 11 commits, 158 tracked paths, and 326 unique non-empty blobs (305 UTF-8 blobs in the independent root scan). No remote was configured.
- The worktree already contained four modified owner evidence/readiness documents. They were preserved. The T1 plan was already present; this report is the only file added by T1. Diagnostics and the sanitized blob-ID record live under the ignored `node_modules/.cache/personal-word-alpha-review/` directory.
- History review followed `main` only. It did not use `--all`, inspect other branches/internal snapshot refs, or read contents of secret-named paths. The secret-name inventory found no matching paths.
- Text pattern checks were run on the current main tree, the four pre-existing modified owner documents, the T1 plan, and unique non-empty blobs reachable from main. The checks did not print or retain matched source values.

## Findings

**P2 — two historical local-path disclosures.** The corrected, independently repeated scan found exactly two unique blobs containing a local `/Users/` prefix:

| Repository file | Line | Blob |
| --- | ---: | --- |
| `docs/agent-work/2026-10-18-writer-features/REVIEW.md` | 5 | `6bfa1198777095b583aedd8f2401b15af33df9b5` |
| `HANDOFF.md` | 245 | `7f5cf06288ad45233f0495a92c4c4ca33468b7fd` |

These are historical privacy indicators, not evidence of a credential. The current main tree and the four pre-existing modified owner documents had no matching local-path prefix. `HANDOFF.md` is absent at the baseline tip but occurs in its reachable history. `docs/agent-work/2026-10-18-completion/PLAN.md` and `ui-log.md`, which were included in an earlier four-hit estimate, have no matching prefix in any version reachable from main. The earlier four-hit estimate is discarded; the two-blob count above is the verified result. T1 made no history edits. The owner separately authorized root-owned surgical replacement of the confirmed two indicators only; a follow-up scan must verify all resulting refs and the alpha tag before publication.

**No detected credential or secret rule match.** Gitleaks 8.30.1 scanned main history with ignore suppression disabled and 100% redaction: exit 0, zero findings. A fail-first synthetic repository with a generated fake GitHub PAT produced one `github-pat` finding and exit 1; the marker was absent from captured output. A separate redacted heuristic scanner passed synthetic cases for local paths, email-shaped strings, private-key headers, credential assignments, and URL userinfo, then scanned the bounded main history. It found no key/token/URL-userinfo pattern. That heuristic scanner is not equivalent to Gitleaks. The heuristic email-shaped hit in `src-tauri/tauri.conf.json:36` is the icon filename `icon@2x.png`, not an email address.

**Dependency advisories.** `npm audit --json` returned zero vulnerabilities across informational, low, moderate, high, and critical severities; the lockfile metadata reports 254 packages. The successful request queried registry advisory metadata only and did not upload application source. It ran with host Node 25.5.0 and npm 11.8.0 after the sandbox blocked DNS; the separately approved isolated Node 22.23.3 runtime was not used for this audit.

`cargo-audit 0.22.2` reported zero vulnerability entries. It did report two non-vulnerability warnings that should remain visible in release review:

- `glib 0.18.5`, `RUSTSEC-2024-0429` (unsoundness): the all-target dependency graph reaches it through the GTK/WebKit platform stack; an offline `x86_64-apple-darwin` inverse-tree query printed no path.
- `proc-macro-error 1.0.4`, `RUSTSEC-2024-0370` (unmaintained): it is pulled through the same platform-conditional macro/GTK graph; the `x86_64-apple-darwin` inverse-tree query printed no path.

These are not cleared as harmless. Only the x86_64 macOS target was checked explicitly; aarch64 macOS reachability was not queried. No dependency was upgraded or changed.

## Publication controls and notices

- `.github/workflows/ci.yml` runs on push, pull request, and manual dispatch on `macos-15`; workflow token permissions are `contents: read`. Checkout, setup-node, and artifact-upload actions are pinned to full commit SHAs.
- `LICENSE` contains GPL-3.0 text. `THIRD_PARTY.md` links to the generated dependency inventory. `docs/dependency-licenses.json` contains 254 npm and 456 Cargo package records, all with a license field. This verifies identifiers are inventoried; it does not establish legal compatibility or prove that every required full license text and attribution is included in each distributed artifact. Confirm bundled notices before publication.
- The tracked image set contains app icons and six documentation screenshots. Available metadata inspection found no GPS, author, creator, device-serial, or copyright metadata keys. `tesseract` and `exiftool` were unavailable, so screenshot pixels and visible writing were not OCR-reviewed; this is an open privacy-review limit, not a clean visual-content finding.
- The SQLite fixture was opened read-only and contained four tables with six total rows. Counts alone do not establish that its prose is synthetic; fixture text was not reviewed for that classification. Tracked JSON fixture/metadata files were scanned for local-path prefixes, email-shaped strings, and URL userinfo; the only email-shaped match was the icon-name false positive described above. Fixture prose/values were not printed.

## Tool source and install options

These pinned official releases were confirmed by root and installed into the ignored project cache with release checksums; T1 did not install tools or modify global environments:

- `cargo-audit 0.22.2`: the [official RustSec README](https://github.com/rustsec/rustsec/blob/main/cargo-audit/README.md) documents a versioned Cargo install and Homebrew. A project-local `cargo install cargo-audit --version 0.22.2 --locked --root <ignored-cache-root>` is suitable when Rust sources are available; the official README also documents `--file` for auditing a lockfile without entering the project directory.
- `Gitleaks 8.30.1`: the [official release](https://github.com/gitleaks/gitleaks/releases/tag/v8.30.1) provides versioned binaries and checksums; the [official README](https://github.com/gitleaks/gitleaks) documents release binaries, Homebrew, Go, and Docker installation options.
- `Node.js 22.23.3`: the [official version archive](https://nodejs.org/en/download/archive/v22.23.3) provides the versioned installers and checksums. The approved isolated runtime was installed under the ignored project cache.

## Evidence limits and follow-up

This is a bounded static publication/dependency review. It did not run a build, tests, native app, complete license compatibility analysis, screenshot OCR, or a scan of refs outside main. It did not change project code, plan, shared log, dependency files, or Git history. No raw secret values, private paths, or manuscript prose are included here. Root should complete the owner-authorized two-indicator history cleanup, preserve the other historical content, and rerun path/Gitleaks scans over the intended publishable refs and tag. Screenshot-content review and distributed third-party notice verification remain open before calling publication privacy/legal review complete.

## Post-T1 integration supplement — 2026-10-19

This supplement records later read-only integration evidence from the root review log ([`IMPLEMENTATION_LOG.md`](IMPLEMENTATION_LOG.md)). The findings above remain a snapshot of T1; this section supersedes only the specific follow-up limits described here.

- **Apple target advisory reachability:** the later offline inverse dependency queries for `glib` and `proc-macro-error` on `aarch64-apple-darwin` both exited 0 and printed no dependency path. Combined with T1's no-path result for `x86_64-apple-darwin`, neither warning has an inverse-tree path on the two checked macOS targets in the locked graph. The RustSec warning records remain visible; this reachability check is not a blanket advisory suppression or a dependency change.
- **Screenshot pixels:** root manually reviewed the pixels of the six tracked documentation screenshots. This closes the initial T1 pixel-review gap for those six images only. OCR was not performed, and this does not cover every historical image or establish a general privacy/legal clearance.
- **SQLite fixture context:** the later bounded fixture review encountered a short title field without an asserted synthetic-provenance claim. It was treated as context, not as a privacy finding. No title or prose value is reproduced here; this does not establish that all fixture contents are synthetic or fully privacy-reviewed.

The earlier statements that aarch64 had not been queried, screenshot pixels had not yet been reviewed, and fixture prose had not been classified describe the initial T1 timepoint. The six-image visual review does not constitute OCR or general visual/privacy clearance, and the bounded SQLite context does not classify all fixture contents. Remaining limits, including full fixture-content classification, OCR, license compatibility, bundled notice completeness, and native-app review, remain open unless separately closed in the root integration log.
