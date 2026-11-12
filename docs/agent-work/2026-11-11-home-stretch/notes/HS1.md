# HS1 Export menu above the format bar
Changed: src/export/export-menu.css (`.export-menu.popover { z-index: 41 }`), new tests/hs1-export-menu.spec.ts.
Owner sees: every Export row (PDF through Complete project) is fully visible over the format bar.
Fail-first: before the fix "Word (.docx)" was not topmost at its centre (HS1-fail-first.txt). After: 1 passed.
Limits: Snapshot/Saved popovers not checked in the top bar; format-bar Dropdowns live inside the bar's own stacking context.
Hand check: open a document, click Export, confirm the top rows are not hidden.
