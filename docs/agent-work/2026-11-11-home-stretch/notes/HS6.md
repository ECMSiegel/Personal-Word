# HS6 Floating sidebar in Read manuscript

What changed: src/components/floating.ts `documentEdges()`. In Read there is no `.format-bar`, so the
top fell back to the first `.read-prose` block's top (far down, and it moves when the reader scrolls).
It now falls back to the top of `.manuscript-read` (the reading area). Nothing else changed; editor
mode is untouched (the bar still wins when it exists). floating.css and App.tsx were not touched.
Tests: two Read cases added to tests/floating.spec.ts (title within 60px of the reading area's top,
Manuscript heading visible and inside the sidebar list box, no overlap with `.read-prose`, bottom at
the footer, unchanged after scrolling the reader; narrow 1040px window falls back to the normal panel).

What the owner sees: in Read with Floating sidebar on and a wide window, the sidebar starts at the top
of the reading area with the project title, the "Manuscript" heading and its rows, and stays put
while the text scrolls.

The stray dash: not an artefact. It is a scroll-spy rail line (`.spy-rail > .spy-line`,
src/components/scrollspy.css), one per Manuscript row, drawn at the right edge of that list. It looked
stray only because the squeezed list hid the heading. With the heading visible it is a legitimate
marker; left as is. Screenshots: HS6-after-top.png, HS6-after-scrolled.png (no "before" screenshot was
taken; the fail-first output shows the title 355px too low).

Limits: horizontal fit still judged by the first `.read-prose` column. Not checked in native WebKit.
Hand check: Settings > floating sidebar on, wide window, Read manuscript, scroll; also narrow the
window below ~1100px and confirm the normal panel returns.
