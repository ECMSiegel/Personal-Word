# FB3 -- library store

## Changes

- Added the immutable, pure `src/library/folders.ts` model and unit coverage for parsing/repair, folder operations, project placement, ordering, and reordering.
- Added browser-preview storage at `folio.preview.library` and native IPC methods that preserve `null` for a missing file and reject malformed JSON.
- Added Rust `read_library` / `write_library` store methods and commands in both handler lists. Writes validate JSON and the 1 MiB limit, atomically replace the file, and copy an existing library to `library.backup.json` first. The project listing continues to ignore the library file.

## Fail-first

Before implementing the model and storage methods, ran:

```text
npx vitest run src/library/folders.test.ts src/storage.test.ts
```

It failed for the expected missing behavior: the new folders suite could not resolve `./folders`; three storage tests failed because `storage.readLibrary` / `storage.writeLibrary` were not functions. Existing storage tests passed (22 passed, 3 failed; one suite failed to load).

## Acceptance checks

Commands run from the project root unless noted:

```text
npx vitest run src/library/folders.test.ts src/storage.test.ts
Test Files  2 passed (2)
Tests       33 passed (33)

npx tsc -b
clean (no output)

cd src-tauri && cargo test --offline library
3 passed, 0 failed (73 filtered out)

cd src-tauri && cargo test --offline
75 passed, 0 failed, 1 ignored (76 tests total)

git diff --check -- <FB3 registered implementation and test paths>
clean (no output)
```

The Rust tests exercised round-trip and missing-file behavior, invalid/oversized write preservation, backup of the first version, and that `list()` still returns the same project when `library.json` exists. These are automated tests only; no native app or real project data was opened.
