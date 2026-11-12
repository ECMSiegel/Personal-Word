# OF2 (T285): floating sidebar, project title in a fragment

What was wrong: measured in floating page view, the title (x 12, y 130) and the sidebar top (114)
are identical in a section and in a fragment. The difference was the background: the fragment's
"Kept from" strip sits in the white scroll area above the grey desk, so the title and the
first rows sat on a white band (rgb 255) instead of the grey (rgb 245,245,247) under them.

Change: src/components/floating.css, one rule: with the floating sidebar on, a paged
`.writer-scroll` takes the desk colour (`--surface`), so the strip sits on the desk. The strip
and every position stay as they were.

Evidence: OF2-fail-first.txt (background white vs grey), OF2-pass.txt (tests/of2-fragment-title.spec.ts
plus tests/floating.spec.ts, 40 passed).

Limit: only while the sidebar is actually floating in page view; the docked panel is unchanged.

Hand check: Settings > floating sidebar on, page view, open a fragment: the area behind the title
and the strip is the same grey as beside the page.
