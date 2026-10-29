# Developing Personal Word


- [Architecture and how saving works](architecture.md)
- [Feature guide](personal-word-v2.md)
- [Validation record](validation.md)
- [Contributing](../CONTRIBUTING.md) and [security reporting](../SECURITY.md)
- [Third-party licenses](../THIRD_PARTY.md)

The app uses Tauri 2, React, TypeScript, the Tiptap editor, and Rust with SQLite. Run the checks with:

```sh
# Recorded qualification used Node v22.23.3. If available locally:
export PATH="$PWD/node_modules/.cache/personal-word-alpha-review/tools/node-v22.23.3-darwin-x64/bin:$PATH"
node --version
npm run build
npm test -- --no-file-parallelism --maxWorkers=1
PLAYWRIGHT_PREVIEW=1 npm run test:e2e -- --workers=1
cargo test --locked --offline --manifest-path src-tauri/Cargo.toml --jobs 1 -- --test-threads=1
```

Without `PLAYWRIGHT_PREVIEW=1`, `npm run test:e2e` starts the development server. The board qualified the production preview only; build first as above. The pinned Node path is a local cache, not included in a fresh clone; otherwise install Node v22.23.3 separately to reproduce that runtime.

For the isolated native beta checks, build the diagnostic app first, then run the two suites serially:

```sh
npm run tauri build -- --debug --features native-smoke --no-bundle --config '{"identifier":"com.folio.smoke"}'
python3 scripts/native-reliability.py --suite baseline
python3 scripts/native-reliability.py --suite beta
python3 scripts/verify-beta-evidence.py --evidence docs/agent-work/2026-10-20-beta-roadmap/06-durability/EVIDENCE.json --source-manifest docs/agent-work/2026-10-20-beta-roadmap/06-durability/SOURCE_MANIFEST.json
```

The evidence verifier checks recorded evidence and source identity; it does not run the suites. Exit 0 means the recorded evidence and owner reports are consistent; exit 2 means required outcomes are incomplete. Local evidence/build artifacts are required and are not shipped in Git. Rebuild the normal app without diagnostic features before owner testing.

Some internal names still say `folio`, from the app's earlier name. They keep existing projects readable. Do not rename them without a data migration.

