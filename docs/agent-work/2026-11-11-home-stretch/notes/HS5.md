# HS5 -- text after a page break keeps font and size
Changed: src/editor/pageBreakKeys.ts (new `insertPageBreak(editor)` helper, used by Shift-Enter), src/Writer.tsx
("Insert page break" button now `editor.commands.focus(); insertPageBreak(editor)` + import), src/editor/pageBreakKeys.test.ts (new).
The helper carries the stored/active marks (font, size, bold...) to the new paragraph as stored marks, and copies a
body paragraph's attrs (alignment, line spacing, indents, spacing, paragraph style); headings carry marks only.
Limits: undo history does not run in the headless test editor, so the test checks the insert is ONE doc-changing
transaction and that inverting it restores the original doc. Mid-paragraph test is weak (typed text lands before the
tail text, which has the same marks); the end-of-paragraph test is the one that fails without the fix.
Hand check: set a font and size, type, Shift+Enter (and Page setup > Insert page break), type -- same font and size;
Cmd+Z once removes the break.
