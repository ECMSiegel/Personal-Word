# Contributing to Personal Word

Thanks for helping improve Personal Word. It is an early Mac-first application, and some workflows still need native macOS qualification. Please describe observed behavior and the environment where it occurred; do not present browser-preview results as proof of native persistence or WebKit behavior.

## Set up

Development targets macOS and requires Node.js 22 LTS (the CI version), Rust/Cargo, and Apple's Xcode Command Line Tools. From the repository root:

```sh
npm ci
npm run tauri dev
```

`npm run dev` starts the browser preview on `http://localhost:1420`. It uses browser storage. It is useful for interface work, but does not exercise native SQLite persistence.

## Before proposing a change

Read [the architecture](docs/architecture.md), [the feature and limitation guide](docs/personal-word-v2.md), and [the validation record](docs/validation.md). Keep changes focused and update user-facing documentation when behavior or limitations change. Do not add generated bundles, test reports, real manuscripts, or personal project data to a contribution.

When running tests or persistence experiments, use isolated temporary data. Never delete or repurpose a user's projects, recovery journals, or snapshots to make a test pass. Browser preview storage and native application data are separate; a passing browser test does not establish native behavior.

## Compatibility and data safety

- Preserve the native application identifier `com.folio.writing`, `folio.*` storage keys, and native event names. They are persistence interfaces. Any necessary change needs an explicit migration and compatibility coverage.
- Preserve project and entry metadata through serialization, incremental saves, recovery, snapshots, import, and export. Prefer additive changes and keep the shared editor schema aligned with import validation and the Rust rich-text allowlist.
- Keep project mutations immutable, revisions increasing, and writes on the existing SaveQueue path. Flush before switching or closing projects; take a safety snapshot before restoration or destructive edits.
- Do not silently reset, discard, or overwrite data when input is malformed or persistence fails. Keep recovery information available and report actionable errors.
- Keep browser-preview behavior clearly distinct from native persistence. Document whether evidence comes from unit tests, Chromium, native WebKit, or exported-artifact inspection.

## Local checks

The GitHub Actions workflow runs these checks on macOS. It is configured locally and has not yet run on a hosted repository:

```sh
npm run build
npm test
npx playwright install chromium
npm run test:e2e
cargo test --manifest-path src-tauri/Cargo.toml
```

Choose checks relevant to the change and report the exact commands and outcomes. For persistence changes, include Rust tests. For editor or layout changes, browser checks alone cannot establish macOS WebKit behavior. For export changes, distinguish file-generation tests from inspection in Word or a PDF renderer. Do not claim a check passed if it did not run.

## Pull requests

Explain the user-visible problem, the resulting behavior, and any data-format or compatibility impact. Include verification performed and material limitations. Do not include real writing in screenshots or fixtures; use synthetic content. The project is licensed under GPL-3.0-only; see [LICENSE](LICENSE). Confirm third-party terms before adding bundled material.
