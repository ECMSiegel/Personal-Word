# FB6 — Backspace removes a Tab indent

## Changed

- `indentKeys()` now handles Backspace outside Screenplay projects only when the selection is an empty caret at the start of a paragraph or heading, outside a list item, and the block has an explicit positive left or first-line indent.
- It applies the same one-step Shift+Tab indentation change; otherwise it returns `false` so ProseMirror's normal Backspace behavior runs.
- Added unit coverage for first-line and left-indent removal, inherited document indentation, mid-paragraph input, and list items. Added a browser regression proving the indent clears before the next Backspace joins paragraphs.

## Fail-first

Before implementing the shortcut:

```text
npx vitest run src/editor/indent.test.ts
Test Files  1 failed (1)
Tests       5 failed | 7 passed (12)
```

The five new cases failed on their behavior assertions: the Backspace shortcut was absent (`expected undefined to be true` for removal and `expected undefined to be false` for non-intercepted cases).

## Passing verification

- `npx tsc -b` — passed with no output.
- `npx vitest run src/editor/indent.test.ts` — 1 file, 12 tests passed.
- Under the serial lock, `npm run build` — passed (`tsc -b` and Vite build).
- Under the serial lock, `PLAYWRIGHT_PREVIEW=1 PLAYWRIGHT_PORT=1420 npx playwright test tests/ci-indent.spec.ts --workers=1 --trace off --output test-results/fb-T324` — 6 tests passed, including the new regression.

The browser test exercised the Chromium preview, not native macOS WebKit or real project persistence. Manual confirmation in the app remains open.
