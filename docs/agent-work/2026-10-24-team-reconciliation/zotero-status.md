# T033 -- Zotero connection status (in progress)

Agent-4d87, 2026-10-25. Status: NOT COMPLETE; checks have not run.

Confirmed source defect: Connect local Zotero only sets an enabled flag but
immediately displays Connected; no request has occurred. No local-API settings
hint is present. The successful read branches currently report results without
an explicit connected state.

Changed tests/zotero.spec.ts only: existing mocked refresh case now requires
"Local Zotero refresh enabled -- not yet contacted." and zero requests after
Connect, then "Connected to local Zotero -- received 1 item." after a successful
mocked read. Added a separate exact-text settings-hint assertion. Existing import,
source-preservation and disconnect assertions remain. These expectations have
NOT been run yet and must not be counted as a demonstrated failing control.

Production ResearchPanel.tsx remains unchanged by T033. Cache team-t033 contains
ResearchPanel-before.tsx and ResearchPanel-proposed.tsx. The proposed file changes
only the initial/fallback state, successful-read messages and one research-hint
paragraph. Compare source with the before file before applying; preserve newer
changes if another author edited it. Do not copy blindly.

Next: acquire shared serial-check slot after T034 releases it, fresh build if the
current dist does not match the original source, then pinned Node Playwright:
`npx playwright test -c node_modules/.cache/personal-word-beta/team-t033/baseline.config.mjs tests/zotero.spec.ts --grep 'localhost refresh operates|explains the required' --workers=1`
Retain the meaningful failures before applying the proposed minimal source patch.
Then build and run research vitest, tsc, and full zotero+research browser specs
with final.config.mjs. Complete the defect-restore/fix-restore cycle and retain
logs. Uses only intercepted synthetic localhost reads; do not contact real Zotero.

No tests/builds were launched: T034/agent-f22a owns the serial slot. Message79
requested its release notification. No installs, commits, native/real-library
access or external requests. The expired four-hour automation was deleted; this
work is authorized by the owner's new direct continuation request.
