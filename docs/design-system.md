# Personal Word design system

The approved [UI polish plan](agent-work/2026-10-25-ui-polish/PLAN.md) defines this contract.
Implemented 2026-10-26 (tasks T071-T096) and extended 2026-10-27 by UI wave 2 (tasks T098-T129); this document is not evidence of behaviour. Status: CLAIMED pending final validation (T127) and owner real use.

## Type scale

Interface text uses Futura, then Avenir Next, then the system sans-serif stack. Document type is independently configurable.

| Token | Size | Use |
| --- | --- | --- |
| `--type-small` | 12 px | Labels, metadata, compact controls; minimum UI size |
| `--type-body` | 13 px | Root interface text and normal controls |
| `--type-large` | 15 px | Larger controls, including the project switch |
| `--type-title` | 19 px | Brand and panel headings |
| `--type-display` | 28 px | Projects, dialog and empty-editor headings |

Use tokens in both `font-size` and `font` shorthands. Preserve document sizes, line height and letter spacing.

## Spacing scale

| Token | Value | Existing positive px values snapped to it |
| --- | --- | --- |
| `--space-1` | 4 px | 4-5 |
| `--space-2` | 8 px | 6-9 |
| `--space-3` | 12 px | 10-13 |
| `--space-4` | 16 px | 14-19 |
| `--space-5` | 24 px | 20-27 |
| `--space-6` | 32 px | 28-32 |

Snapping applies to UI padding, margin and gap in `src/styles.css` and `src/components/dropdown.css`.
Keep 0-3 px nudges, negatives, values above 32 px, auto, percentages, calculated expressions, offsets, widths and heights. Document selectors are excluded.

## Elevation and sizes

Use `--elevation-page` for the page, `--elevation-surface` for a panel surface, and `--elevation-raised` for menus and other raised controls. `--shadow-raised` supplies the shared raised shadow. Header rows use `--control-height` (32 px) and `--header-gap` (the spacing scale's 8 px gap). Lucide icons use 16 px; chevrons use 14 px. Keep Lucide's default 2 px stroke; do not set `strokeWidth` or `absoluteStrokeWidth`.

## Motion

Motion tokens live on `:root` in `src/styles.css`: durations `--duration-press: 80ms`, `--duration-fast: 120ms`, `--duration-base: 180ms`, `--duration-morph: 220ms`; easings `--ease-out: cubic-bezier(0.2, 0, 0, 1)`, `--ease-in: cubic-bezier(0.4, 0, 1, 1)`, `--ease-spring: cubic-bezier(0.34, 1.4, 0.64, 1)`. `--duration-morph` with `--ease-spring` governs the search reveal and create-panel opening.
Stylesheets may transition only `transform`, `opacity`, `clip-path` and `visibility` (never `all`, never layout properties), with a duration token and an easing token (visibility may omit the easing); there are no `@keyframes`. `src/motion.test.ts` enforces this.
The projects search reveals by clip-path: `.library-search` is a fixed 32 px slot (`var(--control-height)`) and `.library-search-field` (220 px, absolutely positioned) is clipped to the magnifier when closed, so it grows leftwards without moving layout.
Scripted motion goes through `src/motion.ts` (Web Animations, no packages): `play`, `presence`/`usePresence` (keeps an element mounted until its exit finishes), `slideHighlight` (one fill box moved by `translate()` + `scale()`) and `staggerIn`. Enter uses `--ease-out`, exit `--ease-in`, and `--ease-spring` only for size changes. Keyframes may touch only `transform`, `opacity` and `clip-path` (`checkKeyframes` throws otherwise). Every animation is interruptible: reopening or reclosing reverses the running animation from its current frame instead of starting a new one. Under reduced motion the engine creates no animation at all and exits resolve at once, so unmounts are synchronous (no timers). Nothing runs longer than 220 ms; item stagger is 15 ms per item capped at a 90 ms delay plus 120 ms, and moves `transform` only. `tests/motion.spec.ts` samples `document.getAnimations()` during real interactions to prove the allowed properties and zero animations under reduced motion.
The `prefers-reduced-motion: reduce` block in `src/styles.css` removes all transitions and smooth scrolling. Reduced motion must also apply to new components.
The create menu is a Popover anchored to its button (`morph="anchor"`, `highlight="follow"`): it grows out of the button and covers it, the trigger fades while covered, the header does not move, and closing reverses toward the button. Items have no fade-in: they are opaque from the first frame and the clip-path morph alone reveals them, so no menu or panel item may start at reduced opacity (T086). Escape closes from any focus inside the control and returns focus to the trigger. Reduced motion makes the whole morph instant.

## Popover

Every menu and toolbar panel renders through `src/components/Popover.tsx` (`popover.css`): Dropdown (and so Sort), the toolbar panels (spacing, setup, aids, table, image alt text) and the More menu. Surface `--elevation-raised`, 1 px `--line` border, `--shadow-raised`, square corners. It sits below its anchor, flips up when it fits better above, flips to the anchor's right edge when it would leave the viewport, and caps its height (toolbar panels keep `overflow: visible` so nested menus can spill out). Opening grows it from the anchor edge by `clip-path` with a fade of the surface (`--duration-base`, `--ease-out`); closing runs `--duration-fast` `--ease-in`; a reopen mid-close reverses from the current frame without remounting. While closing it carries `data-state="closing"`, inert and `aria-hidden`, and drops its role and label, so role queries see it gone at once. Items (`[data-popover-item]`) are opaque from the first frame; a fresh opening staggers them by `transform` only (15 ms per item). One `.popover-highlight` box slides behind the highlighted item (Dropdown) or follows hover and focus (`highlight="follow"`, the More menu). `PopoverItem` presses to `scale(0.99)` over `--duration-press`. Shortcut hints (`.popover-shortcut`, from `src/editor/shortcuts.ts`) sit right-aligned in `--muted` at `--type-small` on one line, only where the editor really installs the shortcut. Dropdown menus size to their content (max 320 px).

## Toolbar

The format bar shows a 12 px label beside every icon when its width is 1100 px or more (`data-labels` on `.format-bar`; `LABEL_MIN_WIDTH` in `src/Writer.tsx`). Below that threshold it shows icons only. Overflowing groups move into More in `OVERFLOW_ORDER` in both modes; widths are cached per mode and the bar re-measures when it crosses the threshold. More is a vertical list of labelled rows (`var(--control-height)`) with the muted shortcut right-aligned and one sliding highlight (Popover `highlight="follow"`; rows carry `data-popover-item`); it scrolls when taller than the window. Labels are `aria-hidden`: the accessible name stays the `aria-label` (for example "Bold (Cmd+B)"). Measured cliff to revisit (open question 3): at a 1440 px window the bar keeps about 6 of 13 groups in label mode, while icons-only mode keeps nearly all of them.

## States

- Hover: enabled buttons use the surface background; enabled text fields use the muted border. Flat sidebar rows retain their flat treatment.
- Focus: `--focus-ring: 2px solid var(--accent)` and `--focus-offset: 1px`; text inputs retain their accent bottom-border focus and separators retain their existing accent treatment.
- Pressed: `--pressed: var(--line)` for buttons, dropdowns and toolbar icons; primary brightness is 0.88. Flat sidebar rows stay transparent and turn accent-coloured.
- Disabled: `--disabled-opacity: 0.35` and default cursor for buttons, inputs, textareas and dropdown triggers; hover and pressed rules exclude disabled controls.
- Selected: accent text and weight 600; active tabs keep their treatment; pressed segmented buttons add a surface background. Checkboxes use the accent.

Every hover action needs a keyboard path. Existing component states take precedence where already defined; the shared recipe fills missing states.

## Colour tokens

Plain preserves the existing appearance. Color supplies semantic accents derived from Apple system colours, adjusted where required for 4.5:1 contrast on the plan's listed surfaces.

| Plain token | Light | Dark |
| --- | --- | --- |
| `--accent-plain` | `#0069D9` | `#64A8FF` |
| `--danger-plain` | `#B42318` | `#FF958D` |

`--accent` and `--danger` reference these Plain tokens by default.

| Color token | Light | Dark | Use |
| --- | --- | --- | --- |
| `--accent`, `--tint-manuscript` | `#0062CD` | `#41A0FF` | Accent text, active toolbar toggles, Manuscript |
| `--accent-fill` | `#0072EF` | `#0074E8` | Primary button fill |
| `--on-accent` | `#FFFFFF` | `#FFFFFF` | Text on filled buttons |
| `--danger` | `#CC0A00` | `#FF6D65` | Destructive text |
| `--danger-fill` | `#ED0D00` | `#EC0D00` | Destructive primary confirmation fill |
| `--success`, `--tint-fragments` | `#1E7434` | `#30D158` | Saved check, Fragments tint |
| `--warning` | `#7B6300` | `#FFD60A` | Import warnings |
| `--tint-research` | `#955600` | `#FF9F0A` | Research tint |

The light Color values above were darkened (2026-10-26, T085) so each is at least 4.5:1 on the real selected-row surface (`#E2E3E6`, 6% text over the sidebar) as well as the other listed light surfaces; fills and dark values are unchanged.
Color document areas (`.writer-scroll`, `.manuscript-read`, `.preview-content`) pin `--accent` to `--accent-plain` and `--danger` to `--danger-plain`. Never change `--prose-*` colours.
The pre-existing Plain-dark primary button (white on `#64A8FF`, about 2.45:1) is outside this plan's repair scope; record it in the critique, not as passing AA.
Selected sidebar entries are always semibold on the selected-row fill (6% text), which slides between rows: text colour in Plain; in Color the selected row and its icon take the section tint (--tint-manuscript, --tint-fragments, --tint-research), while Read, Comments, History and Settings stay --accent. This supersedes Q007.

## Theme and palette

`src/appearance.ts` owns the global `folio.workspace.appearance` JSON preference: `{ theme: "system" | "light" | "dark", palette: "plain" | "color" }`. Defaults are System and Plain; invalid values fall back per field.
Apply it in `src/main.tsx` before React renders, then in the `src/App.tsx` effect when settings change; persist the same preference there. This does not alter project data or the SQLite schema.
On `<html>`, System removes `data-theme`; Light and Dark set `data-theme="light"` or `data-theme="dark"`. Plain removes `data-palette`; Color sets `data-palette="color"`.
System follows macOS live. Explicit Light overrides the system dark media query. Dark declarations in the media block and `[data-theme="dark"]` block must match, ignoring `color-scheme`; `src/designTokens.test.ts` enforces parity.
Settings > General provides Appearance (System, Light, Dark) and Palette (Plain, Color) segmented rows without helper captions. Cmd/Ctrl+Shift+L switches to the opposite effective Light/Dark appearance.
In Color, Section colours provides Manuscript, Fragments and Research swatch pickers. The eight swatches are stored additively in `folio.workspace.appearance`; their contrast-safe values follow the active light or dark mode, while the default blue, green and orange assignments preserve today's section tints. Plain hides the row and keeps the default interface colours.
The owner's answered question 2 requires the Mac title bar to follow the choice through `getCurrentWindow().setTheme()` with `core:window:allow-set-theme`; System passes `null`. Browser builds do nothing for the title bar. Only native checks establish this behaviour.

## Sidebar

The sidebar starts with the project title row (there is no brand line); the title renames in place (click, Enter or Escape) and the pin shows on hover or focus. Going back to All projects is the Projects tab. "Reveal sidebar on hover" is a global switch in Settings > General (`folio.workspace.sidebar`, `src/sidebarPreferences.ts`). The sidebar has three reorderable top groups (Manuscript, Fragments, Research) and four fixed bottom rows (Read manuscript, Comments, Snapshots & history, Settings) that never reorder and carry no hover icons; each bottom feature can be switched off per project in Settings > Sidebar (`sidebarHidden` in `src/model.ts`), and Settings itself is never hidden.

## Sidebar width

The sidebar minimum is 190 px. Inside the narrow-width container query (240 px or less) labels stay on one line and ellipsize only as a last resort: the group headings Manuscript, Fragments and Research and the footer labels show in full at 190 px. The group action buttons are overlaid on hover or focus instead of reserving width (T096).

## Rules

- Keep flat, restrained surfaces and square corners. No decorative folders, quills, curved connectors, slogans or heavy footer strips.
- Selected sidebar entries are semibold on the selected-row fill: text colour in Plain, their section tint in Color.
- Do not add helper captions under controls. Use placeholders, existing error messages, or keyboard-reachable tooltips with `title`, `aria-describedby` and a focus-visible tip. Preserve the browser-only storage notice and the research file error messages.
- Use `--` for UI dash separators. Never rewrite punctuation in documents, citations, code or paths.
- Never alter document typography: `.writing-surface`, `.read-prose`, `.manuscript-read`, `.read-title`, `.preview-content`, editor footnote/page rules and `--prose-*` values stay outside the UI sweep. Reading preferences must not change export formatting.
- Keep hover controls keyboard-accessible, appearance live throughout, sidebar width global and list/card views per project.

## Split view

Split view puts two panes side by side in the writing area; one formatting bar above both acts on the focused pane (the focused pane's own bar is moved into a shared slot). The divider is a 6 px hit area showing a 1 px line, accent on hover and keyboard focus; arrow keys move it 2 percent. The width ratio is global (`personal-word.splitRatio`, 25-75 percent) and the pane layout is per project (`personal-word.split.<projectId>`), both in `src/split.ts`. The right pane has a quiet header (entry title, muted until focused) at control height with a Close right pane button. Square corners, no shadows, no animation. Each section and fragment row carries an Open beside button (16 px, two-column icon) at the right of the row, left of the reorder arrows, shown on hover or keyboard focus like the arrows; it does the same as Cmd/Ctrl+click. Jumps (new section or fragment, Read manuscript titles, Go to passage, Reattach, passage restore) open the target in the focused pane or focus the pane already showing it; restoring a whole snapshot closes the split.

## Section colours and templates

In Color, Settings > General shows the Section colours row (Manuscript, Fragments, Research swatch pickers); the row is hidden in Plain. Templates carry a `hidden` flag (`src/templates.ts`): Blank, Chicago and Screenplay are offered in the create menu and in Settings > Templates; Essay and Story are hidden but still openable by id, so projects created from them keep working, and Chicago's display name is "Chicago".

## Bibliography and PDFs

Research in the sidebar lists Bibliography and then every source (lead author -- title (year)); research notes live only in the Research panel's Notes tab. The Bibliography page (`src/research/BibliographyPage.tsx`) is read-only: an order menu (Alphabetical by author, Order first cited, By source type) and an Include uncited sources checkbox, saved per project as `bibliographyOrder` and `bibliographyScope` in the document settings (`src/research/types.ts`) and used by every export (`src/research/bibliography.ts`); entries have a hanging indent and type headings are semibold. Clicking a source opens the Research panel with that source expanded. Read manuscript ends with the same Bibliography after Notes. A source may carry one PDF (25 MB cap, `src/assets/pdf.ts`); it is drawn in a right-pane iframe (`src/research/PdfPane.tsx`) from a local blob URL that is revoked on unmount, and it is never fetched from the network. A missing PDF shows an alert instead.

## How to check

Use the pinned Node v22.23.3 from `team/PLAN.md`. Coordinate the serial check slot before builds, browser or native checks; retain full logs.
Run `npx vitest run src/designTokens.test.ts src/appearance.test.ts src/palette.test.ts` as those tasks land: token/floor/state checks, dark-block parity, preference logic and Color contrast.
Run the production-preview Playwright suite, one worker, with a fresh private build and isolated synthetic data. See the approved plan's PREVIEW recipe and final Validation list for exact commands and ports.
Build the isolated `com.folio.smoke` diagnostic app, then run `python3 scripts/native-screens.py --out <isolated-cache-dir>` in Plain and Color; view every Projects, Writing, Research and Settings PNG in both appearances. Never open the real writing library from an agent session.
Browser checks do not establish native WebKit rendering, native persistence, Finder drops or title-bar behaviour. Record pending native checks honestly and prepare the plan's owner hand checks. Only the owner's real-use report establishes VERIFIED behaviour.

Native smoke and native screenshots need an unlocked, visible desktop session with the app window in front (T129): a locked or fully covered window throttles WebKit requestAnimationFrame and the harness never reports. Native GUI runs must come from a session that owns the visible desktop; a sandboxed process that cannot drive a window will fail the same way (T125).
