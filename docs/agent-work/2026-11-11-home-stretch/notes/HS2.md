# HS2 line-spacing popover
Changed: src/Writer.tsx `case "spacing"` (removed "pt" text and `toolbar-field-unit` wrappers; all three NumberInputs width 64; labels "Space before, points" / "Space after, points"; values still written as `${n}pt`). src/editor/editor.css: removed unused `.toolbar-field-unit`. New tests/hs2-spacing.spec.ts.
Owner sees: Custom, Space before, Space after boxes identical width and right edge, no "pt".
Fail-first: old code fails (label "Space before, points" not found); fixed code passes. Note: the fail-first fails on the new label first, so width/pt assertions were not independently proven failing.
Limits: Chromium only. Hand check: open the spacing button, look at the three boxes.
