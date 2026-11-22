# REVIEW-4 -- T331 (FB13) and the "Home does not move the caret in page view" diagnosis

Reviewer: Claude Opus reviewer (agent-9185), 2026-11-19. Read-only: no source or test file changed.
Probe specs lived in `test-results/review4-probe/` (git-ignored) and were deleted afterwards.

## Job 1 -- T331 / FB13 review

**Verdict: APPROVE.**

### App change (src/App.tsx)
- New project: `mode: template.id === "chicago" ? "pages" : "continuous"` -> `mode: "pages"` (App.tsx ~1530). Exactly FB13 step 1.
- `confirmImport` (~1604-1610): adds `{ mode: "pages", paper: "letter", margin: (documentSettings.marginInches ?? 1) * 96, zoom: 100 }` only when the import has no `pageLayout`. Matches the plan.
- `importProject` and `defaultPageLayout` (src/editor/formatting.ts:121) are untouched: `git diff -U0 -- src` has no hunk on either. The two `project.pageLayout ?? { ...defaultPageLayout, mode: "pages" }` hunks at App.tsx 2754/2882 are FB12 (Read/Bibliography page view), not FB13.
- A stored project with no `pageLayout` stays continuous: proved by the new features.spec.ts test (passes; fail-first recorded in notes/FB13.md).

### Test edits: audit
Read the diffs of: accessibility, pages, pages-helpers, pages-gap, pages-zoom, page-break, of3-rulers, sb-page-header, split-view, research, footnotes, ci-indent, editor-toolbar, layout, layout-invariants, layout-gallery, hover-emphasis, comments, motion, markdown-roundtrip, scrollspy, performance, writing-aids, features, w9-blank-click, readme-shots (floating, sidebar-context-menu, w9-projects-page skimmed: their hunks belong to FB8/FB12/FB1).

No assertion was removed, loosened, or made conditional. Every FB13 change replaces a blind "Page view" click with `setPageView(page, on)`, or states the view once in a shared create helper. Details:
- motion.spec.ts:87 `3 -> 4` items: correct, since FB2 added Custom to the Sort list.
- comments.spec.ts:135 `getByLabel("Page", { exact: true })`: stricter, not looser.
- editor-toolbar "scissor": adds a wait until the toolbar item list is stable before the "at rest" measurement. It adds a precondition and keeps every assertion.
- writing-aids X1b: `editor.click()` now also runs in the continuous branch. This is harmless.
- accessibility "editor identity" now sets continuous first and then pages, so the continuous -> pages transition is still exercised. pages.spec "Back to continuous", features:120, footnotes:240, sb-page-header (e) and split-view still exercise both directions.

Coverage of the new default: the helpers that put specs back in continuous view are editor-toolbar, footnotes, research, split-view, and ci-indent/layout for non-Chicago templates. Even so, pages.spec, pages-gap, pages-zoom, of3-rulers, sb-page-header, w9-blank-click (page), performance and the new features test all run on a fresh project that is already paged: `setPageView(true)` is a no-op there. So a fresh paged project is well exercised.

### Findings
- **Low -- import default untested.** Nothing asserts that an import opens paged. markdown-roundtrip's `setPageView(page, false)` passes whether or not the import opened paged. The import path is present and matches the plan, but no test proves it. Suggested follow-up: one assertion of `aria-pressed="true"` right after the import dialog closes in markdown-roundtrip, before the helper call. FB13 step 4 did not require this, so it does not block approval.
- **Info -- re-imported packages.** `confirmImport` also gives a pages layout to a re-imported Personal Word package or project.json that has no `pageLayout`. That follows the plan's wording ("when it has none"), but it means such a package does not come back continuous. Recovery through `importProject` is unaffected.
- **Info -- pages.spec local helper.** `pages.spec.ts` keeps a local `setPageView` that does not wait for `.is-paged`/`.is-continuous`. Every caller asserts the class or the page count next, so this is fine.

### Runs (dev server, serial lock, --workers=1)
- `tests/features.spec.ts`, `tests/editor-toolbar.spec.ts`, `tests/ci-indent.spec.ts`: **32 passed**.
- `tests/editor-toolbar.spec.ts:24 --repeat-each=8`: **8/8 passed**. The worker's 2-in-6 flake was not reproduced. That spec now runs in continuous view, where the scroller has nothing to scroll (see Job 2).
- Full-suite log `node_modules/.cache/personal-word-beta/fb13-b.log` tail: 738 passed, 1 failed (floating.spec.ts:933, the citation card keyboard test), 76 skipped. This matches the notes.

## Job 2 -- "Home leaves the caret at the end in a fresh paged project"

**Conclusion: reproducible in Playwright, but not an app defect.** The failure needs two harness behaviours on this Mac to coincide. It is not specific to page view or to the 720 px height.

### Reproduction (Chromium, Playwright, macOS)
1. Create a Blank project and do not wait. Click `editor.locator("p").first()` while the 180 ms sheet "rise" animation is still running.
2. Type a line and press Home. The caret stays at the end, 4/4 at 1280x720 **and 4/4 at 1280x800** (this contradicts the worker's "800 works"; what matters is timing, not height).

### Cause (two parts, both proven by probes)
1. **Playwright, not the app, scrolls the page by 112 px.** On pointer open, `useProjectSwapMotion` (`src/research/pageMotion.ts:14-25`, unchanged since commit 3ac28af) runs a WAAPI rise (translateY 4 px + opacity) on `.editor-paper`. Playwright's locator click sees "element is not stable" (pw:api log: 3 retries). Its retry path then force-scrolls the target into view (`scrollOptions[retry % scrollOptions.length]` in playwright-core's coreBundle.js), which here aligns the paragraph to the scroller's top: `.writer-scroll` scrollTop 0 -> 112 (paragraph top 224 minus scroller top 112). Hooks on scrollTop, scrollIntoView, scrollTo, scrollBy and focus caught no app call. With `click({ force: true })` or `page.mouse.click(x, y)` during the same animation, scrollTop stays 0 and Home works. With Reduce Motion (no animation), scrollTop stays 0 and Home works.
2. **On macOS Playwright sends Home/End as Mac scroll commands.** playwright-core maps `"Home": "scrollToBeginningOfDocument:"` and `"End": "scrollToEndOfDocument:"` (`"Shift+Home"` goes to moveToBeginningOfDocumentAndModifySelection). The app has no Home/End keymap: no handler in src/editor, `src/caretScroll.ts:28` only listens. Chromium moves the caret to the line start only when nothing scrolls. Probe results:
   - Paged and **continuous**, scroller at 60 px: the first Home scrolls to the top and the caret stays; the second Home moves to the start of the line. Identical in both views.
   - Paged, at rest after 3 s: End scrolls the page down 512 px and the caret stays.
   - `Meta+ArrowLeft` always moves to the line start.
   - Keys affected: Home and End only. ArrowLeft, ArrowUp, Shift+Home and Meta+ArrowLeft work. The editor-state selection never moves; nothing puts it back (no selection transaction and no selectionchange after the key).

So it fails only when the scroller is scrolled at the moment of Home (End: whenever there is room to scroll down). The paged sheet (1056 px) is taller than the 576/656 px scroller, so it can scroll. A continuous one-line document cannot scroll, which is why continuous "works". The flaky ci-indent:59/:171 and editor-toolbar:21 failures in the first full run were paged specs that clicked during the rise animation.

### Pre-existing or new
Pre-existing, and FB13 made it more frequent. Chicago projects were already paged and reproduce it: scrollTop 304 and 32 after the click, Home fails 2/2. pageMotion.ts is unchanged in this batch. This is inferred, because no run was made against HEAD. FB13 only puts more tests on the scrollable paged sheet.

### Real-user impact (inferred)
None as a defect. Users do not click through Playwright's scroll-on-retry; a real mouse click during the animation does not scroll (probe). On a Mac, Home/End scrolling the document without moving the caret is the platform convention (WKWebView receives the same scrollToBeginningOfDocument/scrollToEndOfDocument commands; Cmd+Left/Right move to the line ends). So a Mac user in the app would see Home/End scroll in both views, as before this batch. Not checked in native WebKit.

### Recommended fix (tests only; no app change)
- Editor tests that mean "line start/end" should press `Meta+ArrowLeft` / `Meta+ArrowRight` on darwin, or set the selection with `editor.commands.setTextSelection`, instead of relying on Home/End. 47 `press("Home"|"End")` calls exist across 24 spec files. Some are menu or listbox keys and are fine; only the editor-caret ones need changing (ci-indent, editor-toolbar:24 and similar).
- Or, smaller: make the shared create helpers wait for `document.getAnimations().length === 0` (or emulate Reduce Motion) before the first click, so Playwright never scroll-retries. This removes the 112 px scroll but not End's scroll.
- Failing-first proof: a probe that scrolls `.writer-scroll` to 60 px with the caret visible, then presses Home and expects parentOffset 0. It fails today in both views. With `Meta+ArrowLeft` it passes.
- If the owner instead wants Home/End to move the caret like Windows/Linux, that is a product decision (a ProseMirror keymap for Home/End). Ask first; it departs from the macOS convention.
