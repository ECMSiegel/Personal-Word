# FB7 — Remove the personal-name placeholder

## Changes

- Removed the `Siegel` placeholder from both Page header text inputs: Page setup and Export settings.
- Updated the `DocumentSettings.pageHeaderText` comment example to `Lastname`.
- Added a browser regression test asserting neither input has a placeholder.

## Fail-first

Command:

```sh
npx playwright test tests/sb-page-header.spec.ts --grep 'personal-name placeholder' --workers=1 --trace off --output test-results/fb-FB7-fail-first
```

Before the implementation, the test failed for the intended reason: Page setup's Page header text input unexpectedly had `placeholder="Siegel"`.

## Verification

- `npx playwright test tests/sb-page-header.spec.ts --grep 'personal-name placeholder' --workers=1 --trace off --output test-results/fb-FB7-pass` — 1 passed.
- `npx playwright test tests/sb-page-header.spec.ts --workers=1 --trace off --output test-results/fb-FB7-full` — 9 passed.
- `grep -R 'placeholder="Siegel"' src` — no matches.

These browser checks cover the settings fields in the browser preview; they do not establish native WebKit behaviour.
