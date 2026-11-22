# FB8 -- Delete source from the sidebar menu

## Change

- Added a `Delete source` danger item to research source rows only; PDF, note, and Bibliography rows keep their existing menus.
- App refuses deletion while a footnote or quote is linked. Otherwise it asks for confirmation, flushes saves, takes a `Before deleting source “…”` snapshot, then removes the source.
- Added browser coverage for linked-source refusal and the confirm/snapshot/delete path.

## Fail-first

Command:

```sh
PLAYWRIGHT_PREVIEW=1 PLAYWRIGHT_PORT=1420 npx playwright test tests/sidebar-context-menu.spec.ts --grep 'research rows|Delete source confirms' --workers=1 --trace off --output test-results/fb8-fail-first
```

Before implementation, both tests failed at the menu assertion because the source-row menu lacked `Delete source` (expected 4 menu items, received 3). This was the requested failure, not a setup failure.

## Verification

- `npx tsc -b` -- pass after the concurrent FB3 type error was resolved.
- `npx vitest run src/research/citationActions.test.ts` -- 5 passed.
- `npm run build` -- pass.
- First built-app run of `tests/sidebar-context-menu.spec.ts tests/research.spec.ts`: 30 passed, 3 failed, 4 skipped. The new FB8 test exposed an ambiguous confirmation-button locator (now scoped to the dialog); two `research.spec.ts` Read assertions saw empty footnotes/bibliography while FB12 was in progress. No FB8 implementation assertion failed.
- Second built-app run: the focused FB8 test reached the linked-source setup, then its `.source-toggle` locator matched nested collapse controls added by FB9 (four `.source-toggle` controls inside the source). The source-row selector now requires `[aria-controls]`. This was another test-harness ambiguity; no source-delete behavior assertion failed.
- After scoping the source-row toggle with `[aria-controls]`, the focused built-app test passed: `1 passed` (3.7s). Full `research.spec.ts` still needs to be rerun after FB12's Read changes settle; its two Read assertions failed in the earlier combined run.

## Takeover (agent-3d55)

Verified against FB8 steps: `deleteSource` in src/App.tsx follows `deleteTopSection`/`remove()` (refusal string via `setError`, destructive confirm "Delete source “<title>”?", `queue.flush()`, re-check on fresh data, `storage.snapshot` "Before deleting source …", then `mutate`). `removeSource` returns "error string or new data", as the plan expects. The sidebar item appears only on source rows (not Bibliography, PDF "beside" rows, or detail/note rows) and only when `onDeleteSource` is passed; App passes it. Spec updates present (menu list, new Delete source test). Nothing was missing; I changed no code.

Acceptance (serial lock, pinned Node, workers=1):
- `npx tsc -b` -- clean.
- `npx playwright test tests/sidebar-context-menu.spec.ts tests/research.spec.ts --workers=1 --trace off --output test-results/fb-FB8-final` -- 33 passed, 4 skipped (the 4 light/dark screenshot tests, skipped by design), 0 failed (1.5m). The earlier FB12-related Read failures no longer occur.
