# Mac distribution status

Personal Word has a local packaging-preparation path. A signed, notarized,
license-reviewed download is not ready. There is no paid Apple Developer
account available for this preparation, and only an Intel test machine is
currently available. No download link should be published until the binary,
license, signing, and install gates are complete.

The owner removed signing and downloadable distribution from beta scope on 2026-10-23. The preparation below is retained for possible future use; it is not active beta delivery work. Pushing source changes does not publish an app download.

## Candidate checks

The release verifier checks an app bundle's `com.folio.writing` identity,
version, executable name, single requested architecture, absence of native
smoke-test markers, bundled Noto OFL text, notices, and source manifest. It
requires a clean tracked checkout at the repository root, requires the plain
repo-path-to-SHA-256 map to cover exactly the safe Git-tracked regular files, verifies
those hashes, reports the current Git revision, and checks that `package.json`,
`package-lock.json` (both version fields), `tauri.conf.json`, `Cargo.toml`, and
the application package entry in `Cargo.lock` all match the requested version.
It also requires the executable to be newer
than the captured manifest and byte-compares the bundled notice and required
Noto license texts with their exact checked-out resource files. Candidate mode always reports
`distribution_ready: false`: structural checks do not establish signing,
notarization, independent review, or legal completeness, even if the current
blocker list is empty. The executable timestamp is a freshness signal only; it
is not cryptographic source-to-binary attestation. The source map and Git
revision establish the reviewed checkout contents, not a cryptographic build
attestation. Run the verifier with the clean checkout of the reviewed commit as
its working directory; it rejects a different working directory, unsafe
tracked names, symlinked tracked paths or ancestors, and tracked changes before
reading tracked source contents. The source-package output directory must be
new or empty. The source archive omits Git metadata, so the verifier cannot be
run from an extracted source archive; use the matching clean Git checkout.
The source tools require Python 3.11 or newer:

```sh
python3 scripts/package-source.py --revision <full-commit-sha> --out <new-output-directory>
npm run tauri build -- --config src-tauri/tauri.release.conf.json
python3 scripts/verify-release.py --app '<candidate.app>' --arch x86_64 --version 0.1.1 --source-manifest '<new-output-directory>/source-manifest.json'
```

Run these from the clean, reviewed revision in that order so the manifest is
captured before the candidate build. The local build uses the host architecture;
the preparation workflow builds each architecture on its matching runner.

The candidate check reports unresolved distribution blockers. A successful
structural check does not clear them. `--require-notarized` adds Developer ID,
Gatekeeper, and stapled-ticket checks and fails while source or notice blockers
remain. Only this strict path can report `distribution_ready: true`, and only
after every signature/notarization check and the exact-candidate independent
review pass. It also requires a sibling `release-review.json` record with
`decision: "approved"`, reviewer and review date, the exact app executable
SHA-256, the exact source-manifest SHA-256, the reported `source_revision`, and an empty
`distribution_blockers` list. This binds the human review to the candidate;
there is no command-line waiver for unresolved findings.

```sh
python3 scripts/verify-release.py --app '<candidate.app>' --arch x86_64 --version 0.1.1 --source-manifest '<new-output-directory>/source-manifest.json' --require-notarized
```

The source packager's `source-manifest.json` maps safe tracked Git blobs from
the exact public revision and can be used by the verifier from the matching
clean Git checkout when every tracked entry is a regular file. `archive-manifest.json` separately hashes the
files actually present in `personal-word-source.tar.gz`. These maps can differ:
the project archive checks paths before reading file contents, excludes
private/generated paths, omits tracked symlinks, and omits tracked documentation
containing personal machine paths. Any such omission is recorded in provenance
and leaves an explicit source-package completeness blocker. A tracked unsafe
path or symlink also prevents the verifier from accepting the checkout. A second
archive includes locally available, version-matched production npm package
trees and the union of normal/build Cargo dependency trees resolved offline for
Intel and Apple silicon. It records package versions, tree hashes, target scope,
cache availability, and blockers. The local npm trees are not verified against
`package-lock.json` integrity values, and Cargo trees are not verified against
`Cargo.lock` checksums or `.cargo-checksum.json`; name/version matching does not
authenticate cached source bytes. These unresolved checks are explicit source
package blockers. The package makes no offline reconstruction claim; no clean
independent reconstruction has been performed. No cache paths or
machine-specific source paths are recorded.

## Current release blockers

- The exact runtime and compiled dependency graph has not been established by
  inspecting the candidate binary. Lockfile/package metadata alone is not
  evidence of actual inclusion or license compliance.
- Cached npm and Cargo dependency source bytes have not been verified against
  their lockfile integrity values/checksums; the source package remains
  provisional until that correspondence is established.
- The cached `option-ext` 0.2.0 and `selectors` 0.38.0 sources declare
  MPL-2.0 but lack standalone license text in the local cache. Their exact
  source notices need resolution.
- Tauri, WebKit, bundled SQLite, target-specific features, and platform
  components still need candidate-specific notice and source review.
- No clean offline source reconstruction has been demonstrated.
- The source archives have not yet been retained and independently reviewed; the
  preparation workflow uploads metadata only and does not publish source archives.
- Intel-only availability leaves Apple silicon install and runtime
  qualification incomplete.
- No Developer ID signature, notarization ticket, or quarantined clean-machine
  install has been produced or checked.

The resource notices currently preserve exact locally sourced license text and
identify these open items. They are not a complete binary notice package. See
[THIRD_PARTY.md](../THIRD_PARTY.md) and the bundled
[`THIRD_PARTY_NOTICES.txt`](../src-tauri/resources/THIRD_PARTY_NOTICES.txt).
