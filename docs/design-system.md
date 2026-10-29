# Personal Word design system

The approved [UI polish plan](agent-work/2026-10-25-ui-polish/PLAN.md) defines this contract.
Implemented 2026-10-26 (tasks T071-T096), extended 2026-10-27 by UI wave 2 (T098-T129) and 2026-10-28 by UI wave 3 (T131-T149), then 2026-10-29 by UI wave 4 (T171-T193); this document is not evidence of behaviour. Status: CLAIMED pending final validation and owner real use.

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
Futura has no tabular figures. Where a number changes in place, request `font-variant-numeric: tabular-nums` anyway (see Separator), but do not promise steady digit widths: the fallback font decides, and Futura's proportional digits keep their own widths. Recorded in [limitations](limitations.md).

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

An icon button draws a 16 px icon but reaches a 24 x 24 px target: a pseudo-element centred on the button is `max(24px, 100%)` wide and tall, so a 24 px button is untouched and a smaller one still takes a full-size press. Do not grow the padding to fake it; padding moves the row's layout, the pseudo-element does not. The hit-area rule is `:where()`, so it can never outrank a component that positions its own button: the cards-view trash and the Open beside button stay absolutely placed. Only the `::after` box itself uses `:is()`.

## Separator

A separator is one pixel of `--line`. `.separator` draws it: vertical (`role="separator"` with `aria-orientation="vertical"`) stretches to its row and takes no fixed height; the horizontal rule keeps its 17 px length. Never draw a separator as a border on the neighbouring element, because the neighbour then owns its colour and its hover.

The live separators are the toolbar's decorative group dividers (`.toolbar-divider`, 1 px, 16 px tall, 3 px side margins, `aria-hidden`), the create panel's rule (`.create-rule`), and the three draggable splitters: the sidebar width handle, the split-view divider and the side-panel resizer. Each splitter carries `role="separator"`, `aria-orientation="vertical"`, `aria-valuemin`/`aria-valuemax`/`aria-valuenow` and `tabIndex={0}`, so the arrow keys move it. A separator is never the only way to see a boundary: the split divider's 6 px hit area is documented under Split view.

Numbers that change in place -- the footer's page counter and the save status -- request `font-variant-numeric: tabular-nums`. The rule is applied; whether it is honoured depends on the font (see Type scale).

## Motion

Motion tokens live on `:root` in `src/styles.css`: durations `--duration-press: 80ms`, `--duration-fast: 120ms`, `--duration-base: 180ms`, `--duration-morph: 220ms`; easings `--ease-out: cubic-bezier(0.2, 0, 0, 1)`, `--ease-in: cubic-bezier(0.4, 0, 1, 1)`, `--ease-spring: cubic-bezier(0.34, 1.4, 0.64, 1)`. `--duration-morph` with `--ease-spring` governs the search reveal and create-panel opening.
Stylesheets may transition only `transform`, `opacity`, `clip-path` and `visibility` (never `all`, never layout properties), with a duration token and an easing token (visibility may omit the easing); there are no `@keyframes`. `src/motion.test.ts` enforces this.
The projects search reveals by clip-path: `.library-search` is a fixed 32 px slot (`var(--control-height)`) and `.library-search-field` (220 px, absolutely positioned) is clipped to the magnifier when closed, so it grows leftwards without moving layout.
Scripted motion goes through `src/motion.ts` (Web Animations, no packages): `play`, `presence`/`usePresence` (keeps an element mounted until its exit finishes) and `staggerIn`. Enter uses `--ease-out`, exit `--ease-in`, and `--ease-spring` only for size changes. Keyframes may touch only `transform`, `opacity` and `clip-path` (`checkKeyframes` throws otherwise). Every animation is interruptible: reopening or reclosing reverses the running animation from its current frame instead of starting a new one. Under reduced motion the engine creates no animation at all and exits resolve at once, so unmounts are synchronous (no timers). Nothing runs longer than 220 ms; item stagger is 15 ms per item capped at a 90 ms delay plus 120 ms, and moves `transform` only. `tests/motion.spec.ts` samples `document.getAnimations()` during real interactions to prove the allowed properties and zero animations under reduced motion.
The hover emphasis tokens are `--emph-stroke: 0.04em` and `--emph-scale: 1.04` (see States). The emphasis moves by `transform` only, so the transition rule above still holds; the stroke is not animated. Under reduced motion `--emph-scale` becomes 1: the scale is dropped and the stroke stays.
`slideHighlight` is still exported and unit-tested, but no component calls it: wave 3 removed every sliding highlight box (sidebar, Segmented, Popover). Do not reintroduce it; a selection is shown by weight and colour (see States).
The `prefers-reduced-motion: reduce` block in `src/styles.css` removes all transitions and smooth scrolling. Reduced motion must also apply to new components.
The create menu is a Popover anchored to its button (`morph="anchor"`): it grows out of the button and covers it, the trigger fades while covered, the header does not move, and closing reverses toward the button. Items have no fade-in: they are opaque from the first frame and the clip-path morph alone reveals them, so no menu or panel item may start at reduced opacity (T086). Escape closes from any focus inside the control and returns focus to the trigger. Reduced motion makes the whole morph instant.
Never animate a keyboard action except for one documented exception: a menu or panel that a keyboard opens still grows by its clip-path morph, because the morph is the component's opening, not a decoration of the key press. Nothing else may move or fade because a key was pressed; a value change reached by keyboard changes at once. This is the recorded answer to checklist item R7.

## Popover

Every menu and toolbar panel renders through `src/components/Popover.tsx` (`popover.css`): Dropdown (and so Sort), the toolbar panels (spacing, setup, aids, table, image alt text) and the More menu. Surface `--elevation-raised`, 1 px `--line` border, `--shadow-raised`, square corners. It sits below its anchor, flips up when it fits better above, flips to the anchor's right edge when it would leave the viewport, and caps its height (toolbar panels keep `overflow: visible` so nested menus can spill out). Opening grows it from the anchor edge by `clip-path` with a fade of the surface (`--duration-base`, `--ease-out`); closing runs `--duration-fast` `--ease-in`; a reopen mid-close reverses from the current frame without remounting. While closing it carries `data-state="closing"`, inert and `aria-hidden`, and drops its role and label, so role queries see it gone at once. Items (`[data-popover-item]`) are opaque from the first frame; a fresh opening staggers them by `transform` only (15 ms per item). There is no highlight box: the keyboard-highlighted item is `[data-popover-item][data-highlighted]` and is shown by weight 600 alone, and hovered rows go semibold the same way. `PopoverItem` presses to `scale(0.99)` over `--duration-press`. Shortcut hints (`.popover-shortcut`, from `src/editor/shortcuts.ts`) sit right-aligned in `--muted` at `--type-small` on one line, only where the editor really installs the shortcut, and follow the user's rebinds. Dropdown menus size to their content (max 320 px).

## Toolbar

The format bar is icons only at every width. The width-based label switch, its threshold constant and its attribute are gone; so are the width cache and the re-measure when crossing a threshold. Icons keep their `aria-label` as the accessible name, for example "Bold (Cmd+B)".

The bar's own gap between groups is 0: groups abut and a 1 px `--line` divider (3 px margins) marks each boundary. Inside a group icons sit 2 px apart. Toolbar icons are 28 px wide at `--control-height`, default to `--muted`, go to `--text` on hover, and to `--accent` when pressed (`aria-pressed="true"`); keyboard focus shows the focus ring, not a colour change. Weight and colour, never a fill (see States).

**Toolbar dock.** Toolbar icons do not use the text emphasis; they magnify like a dock (`src/components/dock.ts`, `useDock` called from `src/Writer.tsx`, styles in `src/editor/toolbar-motion.css`). The icon nearest the pointer grows to 1.5 times its size and its neighbours follow a cosine curve out to 84 px away (`DOCK_PEAK`, `DOCK_RADIUS`). The pointer writes `--dock-scale` on each icon and the CSS scales the icon's `svg` by `transform` only (`--duration-fast`), so the bar's layout never moves and the 24 px hit area is untouched. Keyboard equivalent: a `:focus-visible` icon peaks at 1.5 and its neighbours step down by index (1.25, then 1.1), and that change is instant (a key press never animates). Reduce Motion: no magnification at all, pointer or keyboard. Touch pointers do nothing. Icons inside popover rows (`[data-popover-item]`, for example the More menu) are text rows and use the text emphasis instead. The curve is the standard dock cosine with the plan's constants; the reference page (bencho.dev) was free to use but its source was not readable, so this is a re-implementation.

| Control | Hover and focus cue |
| --- | --- |
| Icon-only toolbar buttons | magnifying dock |
| Other icon-only buttons (chevrons, close, reorder arrows, pin) | colour change, see States |
| Anything that shows text, including More-menu rows | text emphasis, see States |

Overflowing groups move into More in `OVERFLOW_ORDER` (`aids`, `setup`, `view`, `spacing`, `indent`, `insert`, `lists`, `link`, `marks`, `size`, `font`, `paragraph`, `zoom`); `history` and `right` never move. More is a vertical list of labelled rows (`var(--control-height)`) with the muted shortcut right-aligned, and it scrolls when taller than the window. Measured in a split view at 1440 x 900 with the default 254 px sidebar (bar width includes the two panes' shared bar):

| Window | Bar width | In More |
| --- | --- | --- |
| 1440 | 1170 px | nothing -- the whole toolbar fits, so there is no More button |
| 1280 | 1010 px | line and paragraph spacing, page view, focus mode, prose check, page setup |
| 1240 | 970 px | adds decrease/increase indent |
| 1180 | 910 px | adds insert image, insert table |
| 1100 | 830 px | adds bullet list, numbered list, block quote |
| 1040 | 770 px | adds add link |
| 980 | 710 px | adds bold, italic, underline, strikethrough |
| 920 | 650 px | the same set |

At 1240 the More panel therefore holds spacing, view, aids and indent. A test that needs a specific group inside More must set a width where that group has overflowed; the marks group only reaches More below about 1040 px.

## States

Wave 3 removed every grey box. Hover, focus and selection never paint a fill. Wave 4 then replaced the mixed cues with one rule: anything that shows text gets the same emphasis, icon-only controls keep a colour change, toolbar icons get the dock. This rewrites the wave-2 and wave-3 hover, pressed and selected text (checklist item R1).

- Hover: icon buttons go from `--muted` to `--text`. Every control that shows text -- button, `a[href]`, tab, `menuitem`, `option`, `summary`, a `label` that wraps a checkbox or radio (a label around a text or number input is not emphasised: scaling it would grow the input box), `.text-action` -- gets the **text emphasis** described below. Sidebar rows stay flat and transparent. Text fields show the muted border.
- Focus: `--focus-ring: 2px solid var(--accent)` with `--focus-offset: 1px`; text inputs keep their accent bottom-border focus. Every control shows `:focus-visible`: icon buttons take the hover colour as well as the ring, toolbar icons take the ring and the dock's keyboard peak, and text controls take the same emphasis as hover (also on `[data-highlighted]`, the keyboard-highlighted menu row), so a keyboard user never loses the cue a pointer user gets.
- Pressed: every button scales to `0.99` over `--duration-press` (never a fill). A toggle or segmented choice shows its state through `aria-pressed`, which is weight 600 plus `--accent` (or the section tint). A primary button's brightness is 0.88 while pressed. Flat sidebar rows stay transparent and turn accent-coloured. The press scale and the emphasis scale multiply (`scale(calc(var(--emph-s) * var(--press-s)))`), so a pressed, hovered button is about 0.99 times its grown size; menu rows and labels press too.
- Disabled: `--disabled-opacity: 0.35` and the default cursor for buttons, inputs, textareas and dropdown triggers; hover and pressed rules exclude disabled controls.
- Selected: weight 600 plus colour. For the sidebar see Sidebar selection below (the section header carries the colour, open entries are semibold in `--text`). A segmented choice is semibold in `--accent` on the plain surface, with roving `tabindex` (Left/Right/Up/Down step and select, Home/End jump). Checkboxes use the accent.

**Text emphasis (the one hover and focus rule, wave 4).** One block in `src/styles.css` (after `button:focus-visible`, "Text-control emphasis") is the only place that sets a hover or focus cue on a text control. On `:hover`, `:focus-visible` and `[data-highlighted]` it sets `-webkit-text-stroke: var(--emph-stroke) currentColor` and `--emph-s: var(--emph-scale)`; the control's `transform` is `scale(--emph-s * --press-s)` with a `--duration-fast` `--ease-out` transition. The stroke is a faux bold: it thickens the glyphs without changing their advance widths, so the control's layout width and every neighbour stay exactly where they are (the owner chose this "no-shift bold" after a real weight change moved neighbours by 10 to 13 px). The grow is 4 percent by `transform`, so it does not reflow either; left-aligned full-width rows grow from their left edge (`--emph-origin`). While a text control is pressed its transition runs over `--duration-press` (`--emph-duration`, set by the `:active` rule). A checkbox or radio label gets the emphasis from the keyboard when its input is `:focus-visible`. The user's document is never emphasised: links inside `.ProseMirror`, `.writing-surface`, `.manuscript-read` and `.preview-content` are in the exclusion list. Because the stroke is `currentColor`, danger controls stay red. Inputs inside a hovered label are reset to no stroke. Reduce Motion sets `--emph-scale` to 1: no grow, the stroke stays.

Icon-only controls, `.toolbar-icon` (outside popover rows), disabled controls and a short list of named exceptions (in the block's `:not(...)`; `.spy-line` is one) are excluded. A new button, link, tab, menu row or summary gets the emphasis with no new CSS. **Do not add any other rule that sets `font-weight`, a hover scale or a text stroke on hover or focus**: `src/hoverEmphasis.test.ts` fails if one appears, and `tests/hover-emphasis.spec.ts` crawls about twenty screens and fails if a text control shows no stroke or moves a neighbour. The Snapshot button is an ordinary text-and-icon control with no border.

The stroke width (0.04em) was tuned against a true 600 weight in Chromium's fallback font. How it looks in Futura in the Mac app is not yet confirmed (see [limitations](limitations.md)).

The old "doubling rule" (group title stepping back to 500 when an entry is selected) is gone; the section header is now the louder cue (see Sidebar selection).

The fills that remain, and the only ones allowed:

| Where | Fill | Why it is not a hover box |
| --- | --- | --- |
| Primary button | `--accent` in Plain; `--accent-fill` with `--on-accent` text in Color | it is the action's identity, not a state |
| Destructive primary | the same as a primary in Plain; `--danger-fill` in Color | same |
| Active project tab | `--paper` | it is the tab's surface, standing for the open document |
| Selected entry in cards view | `--paper` with a `--muted`-mixed border | a card is a surface; weight alone does not separate it from the cards beside it |

The cards-view selected card is a recorded exception to the no-fill rule, not a precedent: it is a bordered card in a grid, and the border alone reads as hover. Any new fill needs the same justification written down here.

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

The light Color values above were darkened (2026-10-26, T085) so each is at least 4.5:1 on the surfaces it is drawn on. The selected-row wash they were first measured against (`#E2E3E6`, 6% text over the sidebar) no longer exists: wave 3 removed the fill, so the tints now sit directly on the sidebar's `--surface`. Their values are unchanged, and any future tint change must be re-checked against `--surface`, not against the old wash.
Color document areas (`.writer-scroll`, `.manuscript-read`, `.preview-content`) pin `--accent` to `--accent-plain` and `--danger` to `--danger-plain`. Never change `--prose-*` colours.
The pre-existing Plain-dark primary button (white on `#64A8FF`, about 2.45:1) is outside this plan's repair scope; record it in the critique, not as passing AA.
Sidebar selection uses weight and colour with no fill, and the section header carries the colour (see Sidebar selection). This supersedes Q007, the wave-2 "selected-row fill" wording and the wave-3 rule that the selected entry itself took the section tint.

## Theme and palette

`src/appearance.ts` owns the global `folio.workspace.appearance` JSON preference: `{ theme: "system" | "light" | "dark", palette: "plain" | "color" }`. Defaults are System and Plain; invalid values fall back per field.
Apply it in `src/main.tsx` before React renders, then in the `src/App.tsx` effect when settings change; persist the same preference there. This does not alter project data or the SQLite schema.
On `<html>`, System removes `data-theme`; Light and Dark set `data-theme="light"` or `data-theme="dark"`. Plain removes `data-palette`; Color sets `data-palette="color"`.
System follows macOS live. Explicit Light overrides the system dark media query. Dark declarations in the media block and `[data-theme="dark"]` block must match, ignoring `color-scheme`; `src/designTokens.test.ts` enforces parity.
Settings > General provides Appearance (System, Light, Dark) and Palette (Plain, Color) segmented rows without helper captions. Cmd/Ctrl+Shift+L switches to the opposite effective Light/Dark appearance.
There is one General block, defined once in `src/settings/GeneralSettings.tsx` and shown in two places: the Settings destination and a Settings dialog opened from the gear at the right of the Projects screen's display row. The dialog reuses the destination's field rules rather than a second layout, so the two cannot drift; it is 560 px wide to hold the 180 px label column and the 260 px control column, hides the block's own heading because the dialog title carries it, and drops the section's top rule and the page padding. The dialog carries the whole block, Shortcuts included, because Shortcuts is part of General; it is not a second, smaller settings screen. Escape or Close returns focus to the gear. Project settings -- Sidebar and Goals -- stay in the destination and never appear in the dialog.
In Color, Section colours provides Manuscript, Fragments and Research swatch pickers. The eight swatches are stored additively in `folio.workspace.appearance`; their contrast-safe values follow the active light or dark mode, while the default blue, green and orange assignments preserve today's section tints. Plain hides the row and keeps the default interface colours.
The owner's answered question 2 requires the Mac title bar to follow the choice through `getCurrentWindow().setTheme()` with `core:window:allow-set-theme`; System passes `null`. Browser builds do nothing for the title bar. Only native checks establish this behaviour.

## Sidebar

The sidebar starts with the project title row (there is no brand line); the title renames in place (click, Enter or Escape) and the pin shows on hover or focus. Going back to All projects is the Projects tab. "Reveal sidebar on hover" is a global switch in Settings > General (`folio.workspace.sidebar`, `src/sidebarPreferences.ts`). The sidebar has three reorderable top groups (Manuscript, Fragments, Research) and four fixed bottom rows (Read manuscript, Comments, Snapshots & history, Settings) that never reorder and carry no hover icons; each bottom feature can be switched off per project in Settings > Sidebar (`sidebarHidden` in `src/model.ts`), and Settings itself is never hidden.

### Sidebar selection (wave 4, replaces the wave-3 rule)

Selection is weight and colour, never a box. `App.tsx` computes `openIds`: the main pane's entry, or both split panes' entries (a source PDF is `pdf:<sourceId>`), and nothing at all while Settings, Comments, Bibliography or Read is on screen. `ProjectSidebar.tsx` marks every row in that set `data-open`, and every Manuscript, Fragments or Research section that is the open destination or holds one of those rows (collapsing or searching does not change it). The CSS then does this:

- A lit **section header** (`.sidebar-group[data-open] > .group-heading .group-title`) is semibold (600) and coloured: `--accent` (the accent blue) in Plain, its section tint in Color.
- A lit **entry** (`.sidebar .entry-row[data-open]`) is semibold in `--text`, never tinted; in Color its icon keeps the section tint. An entry open in a split pane is lit the same way, so both panes' entries are bold and both sections show a coloured header.
- The **bottom rows** (Read, Comments, History, Settings) are unchanged from wave 3 and are not lit by `data-open`.
- On a destination page (Settings, Comments, Bibliography, Read) no section header or entry is lit.
- Hover and keyboard focus emphasis (see States) sits on top of a lit row. A lit header keeps its colour while pressed.
- In cards view the open card keeps the `--paper` surface; its title is bold, its details stay regular weight.

The old sliding highlight box is gone (`.entry-row.selected::before` is `content: none`). Measured accent contrast: light 4.79 on `--surface` and 4.54 on `--sidebar`; dark 6.0 and 6.24. Two behaviours differ from the wave-4 plan text and are flagged for the owner's hand check: the bottom rows keep today's look (in Plain that is 600 in `--text`, not 600 in accent), and destination pages light nothing in the three sections (wave 3 kept the entry bold there).

### Scrollspy lines

Each Manuscript row in list view has a small line in a 20 px gutter at the right of the list (`.spy-line`, `src/components/scrollspy.css`; the gutter is `.sidebar-group[data-group="manuscript"].list-view .entry-list { padding-right: 20px }`; cards view draws no lines). A line is a 16 px by 2 px bar drawn by `transform: scaleX` only (idle 0.375, row hover or focus 0.75, active 1 and `--accent`). Its `data-state` is `idle`, `open` (the section is open in a pane) or `active`. In Write mode the active line is the selected entry. In Read mode (`useReadSpy` in `src/components/scrollspy.ts`) it follows scrolling: the active section is the last whose top is at or above one third of the viewport, or the last section when scrolled to the bottom (`activeIndex`). Clicking a line selects that section, or in Read mode scrolls the Read view to it with a 600 ms ease-in-out quartic (`easedScrollTo`, `requestAnimationFrame` on `scrollTop`; instant under Reduce Motion or a keyboard-originated click). The line is a pointer-only mirror (`tabIndex=-1`, `aria-hidden`); the row button stays the keyboard path. No tooltip: the row title sits beside the line. The idea and the curve come from the cue design scrollspy line component (an MIT repo; the owner said it is free to use).

**Wiring (R1, landed).** `App.tsx` passes `openIds`, `readActiveId` and `onScrollToSection` to the sidebar. States: in Write mode the line of the focused pane's section is `active` (full length, `--accent` in both palettes) and the section open in the other split pane is `open` (drawn half-expanded, the same length as hover); everything else is `idle`. In Read mode `useReadSpy` watches `.manuscript-read` and the section being read is `active`. A line click in Read mode calls `scrollToSection`: it eases the Read view to a point 100 px above that section's heading (600 ms, `easedScrollTo`); a click from the keyboard (no pointer detail) is instant, and a wheel or touch by the reader cancels a scroll in progress. A line click in Write mode just opens that section. A click on the row itself in Read mode returns to Write mode; only a line click scrolls. The 20 px gutter exists only in the Manuscript group's list view. Covered by `tests/scrollspy.spec.ts` (Chromium only, CLAIMED): Read-mode following and click-to-scroll with Reduce Motion instant, Write-mode active and half-expanded lines, hover and keyboard expansion without animation, lines hiding with a hover-reveal sidebar, drag and collapse, the 190 px sidebar width, cards view with no lines, and Plain/Color light/dark screenshots.

Groups and manuscript entries drag to reorder (`src/components/useDragReorder.ts`, `drag-reorder.css`): a press must move 5 px before a drag starts, so a press that barely moves is still a click. The lifted row follows the pointer by `transform: translateY` only, its siblings step aside by their own height with `transform` only, and a 2 px `--accent` line (`[data-drag-edge]::after`) marks where it will land. No shadow, no rotation, no scale. Escape cancels and puts the row back. `prefers-reduced-motion` removes the shift transition. The arrow buttons (`Move Manuscript up` and so on, and the per-entry arrows) stay the keyboard path and remain in place, so reordering never requires a pointer. Only the three collapsible groups reorder; the bottom rows do not.

## Sidebar width

The sidebar minimum is 190 px. Inside the narrow-width container query (240 px or less) labels stay on one line and ellipsize only as a last resort: the group headings Manuscript, Fragments and Research and the footer labels show in full at 190 px. The group action buttons are overlaid on hover or focus instead of reserving width (T096).

## Rules

- Keep flat, restrained surfaces and square corners. No decorative folders, quills, curved connectors, slogans or heavy footer strips.
- Sidebar selection is weight and colour, never a fill: the lit section header is semibold in the accent (Plain) or its tint (Color), open entries are semibold in `--text` (see Sidebar selection).
- Hover and keyboard focus on text controls use the one shared text emphasis; toolbar icons use the dock. No second hover weight, scale or stroke rule (see States).
- Do not add helper captions under controls. Use placeholders, existing error messages, or keyboard-reachable tooltips with `title`, `aria-describedby` and a focus-visible tip. Preserve the browser-only storage notice and the research file error messages.
- Use `--` for UI dash separators. Never rewrite punctuation in documents, citations, code or paths.
- Never alter document typography: `.writing-surface`, `.read-prose`, `.manuscript-read`, `.read-title`, `.preview-content`, editor footnote/page rules and `--prose-*` values stay outside the UI sweep. Reading preferences must not change export formatting.
- Keep hover controls keyboard-accessible, appearance live throughout, sidebar width global and list/card views per project.
- Never animate a keyboard action, except the documented menu-opening morph (see Motion).

## Split view

Split view puts two panes side by side in the writing area; one formatting bar above both acts on the focused pane. The left pane is a permanent structure -- `.split-panes > section.split-pane[data-side="left"]` -- in both modes, with `data-single` on `.split-panes` when unsplit; the shared toolbar, the divider and the right pane are conditional siblings. Opening or closing a split therefore never remounts the left Writer: its undo history and its scroll position survive, and every node from `.split-panes` down to `.ProseMirror` keeps its identity.

When split, both panes carry a `.split-pane-header` at control height: the left one holds the entry title, the right one the title and the Close right pane button, so the two panes' `.ProseMirror` tops line up within a pixel in both continuous and page view. A fragment's origin line ("Kept from X -- date") renders as `.split-pane-origin` inside its pane header. The "Give these words a home" restore strip is not drawn in a split pane at all (wave 4); it stays when a fragment is open alone, as that pane's footer slot. The `.split-pane-footer` wrapper from wave 2 is gone.

The divider is a 7 px hit area showing a 1 px centre line (wave 4: its margins put that line exactly on the right pane's left edge, and both pane headers are a fixed `--control-height` border-box, so the header rules, the divider and the footer rules meet with no 1 px step), accent on hover and keyboard focus; arrow keys move it 2 percent. The 7 px target (6 px before wave 4) is deliberate and is the recorded answer to checklist item R2: a 1 px line alone would be unhittable. The width ratio is global (`personal-word.splitRatio`, 25-75 percent) and the pane layout is per project (`personal-word.split.<projectId>`), both in `src/split.ts`. Square corners, no shadows, no animation. Each section and fragment row carries an Open beside button (16 px, two-column icon) at the right of the row, left of the reorder arrows, shown on hover or keyboard focus like the arrows; it does the same as Cmd/Ctrl+click. Jumps (new section or fragment, Read manuscript titles, Go to passage, Reattach, passage restore) open the target in the focused pane or focus the pane already showing it; restoring a whole snapshot closes the split. Each pane has its own footer (below).

### Footer

`src/components/PaneFooter.tsx` with `src/components/pane-footer.css` is the strip under every writing pane. It mirrors the pane header: a 1 px `--line` rule above, `--control-height` minimum height, `--muted` text at `--type-small`, side padding matching the header (`--space-5` when single). The page status ("Section page N of M", `aria-live="polite"`, only in page view) is on the left and the word count (characters in its `title`) is on the right. In a split each pane's footer shows that pane's own entry and page status. The writing goals line (`.writing-goals`) is shown once, in the left pane's footer. The old single `.document-statistics` strip is gone. The footer is flat: no heavy strip, no fill.

## Pages

Page view stacks pages vertically in one ProseMirror flow (`src/editor/pagination.ts`): the plugin measures top-level blocks and inserts a spacer widget before the first block of each new page, or inside a paragraph before the first character of the line that starts the next page, so the editor keeps one DOM, one undo history and normal caret movement. Paragraphs split between lines as in Word's default widow and orphan control: at least two lines stay on each page, so a paragraph of three lines or fewer moves whole; a heading moves with the paragraph after it when that paragraph moves whole. Other blocks (lists, quotes, tables, images, code) that do not fit move whole, and one taller than a whole page starts a page and runs straight across the page gap and margins. That overflow is the documented limit, not a bug. Up and Down across a gap are moved by the plugin, because WebKit's own line movement skips the last line above a gap. A manual page break (Shift-Enter) starts a page. Every page reserves the same footnote space, sized for the page with the most notes. A pane narrower than the page shows the page scaled down (`--page-scale`), never reflowed and never scrolled sideways.

**How pages are drawn (wave 4).** The earlier look came from a `repeating-linear-gradient` on `.editor-paper`. The grey gaps were wrong at zoom in WebKit because WebKit does not apply CSS `zoom` to px stops in a gradient, so the bands were drawn every 1056 screen px at any zoom. The page breaks themselves (the spacers) were always correct. Now `src/Writer.tsx` draws one real `div.page-sheet` per page (`aria-hidden`, `position: absolute`, `top = page * (page height + gap)`, `--paper` background, `pointer-events: none`) as the first children of `.editor-paper`, so the sheets and the gaps scale with the paper's zoom in both engines. Sheets sit outside ProseMirror, so they are not in the document, undo, saves, exports, selection or word counts, and print CSS hides them. A Chromium-only drift at non-round fit zooms (for example 1.1495, up to 4 px by page 13) is fixed in `pagination.ts`: `sameBoundaries` compares spacer heights as a running total so sub-pixel differences cannot pile up unnoticed. Measurement itself is unchanged (not done at zoom 1), so WebKit's numbers did not move.

**Backspace and Delete at a page break.** In page view, Backspace at the start of the paragraph after a manual page break, or Delete at the end of the paragraph before it, removes the break (as in Word) and keeps the caret there; undo restores the break (`deleteAcrossBreak` in `pagination.ts`). Before this, ProseMirror selected the break node, which page view draws as nothing, so the caret seemed to vanish. Continuous view is unchanged (it draws the break). In the checks run (Chromium, three seeds) no caret or empty line was painted in the gap between pages; the earlier "one stale frame after Enter" reading came from the test sampler, not the app. That is Chromium evidence only; the owner's hand check in the Mac app is still open. The footer shows "Section page N of M" for the focused pane.

Page view and the exports use different layout engines: PDF and Word pagination have their own line-splitting rules, so exact page parity is not promised (see [limitations](limitations.md)).

The owner chose Word's behaviour on 2026-10-28 (board question Q018); the line-splitting rule is CLAIMED, not VERIFIED, until the owner has used it. Where a paragraph breaks across pages, the end of one page and the start of the next are the same position in the text: the caret there is drawn at the top of the next page, so a click in the page's bottom margin or an Up move to that line places it one character before the line's end.

## Focus mode

Focus mode hides the sidebar (as before; in split view the sidebar was seen to stay visible, not traced) and, from wave 4, also the formatting bar of a single pane (`src/Writer.tsx`, `src/editor/toolbar-motion.css`). While hidden the bar is an overlay that takes no layout space (`data-focus-hidden`, moved up by `translateY(-100%)`, transparent, not clickable) but stays focusable, so Tab reaches it. It appears when: the pointer comes within 56 px of the top of the writing area, keyboard focus enters the bar, or the rebindable shortcut "Show formatting bar" (`focusToolbar` in `src/shortcuts/registry.ts`, default Cmd+Alt+T) is used. A pointer reveal slides in over `--duration-base`; a keyboard or shortcut reveal is instant (`data-reveal="key"`); Reduce Motion is always instant. It hides again 600 ms after the pointer leaves, unless a toolbar panel is open or focus is inside the bar. Escape in the bar hides it and returns focus to the editor. Space for the bar is reserved at the top of the scroll area (`.writer[data-focus-toolbar] > .writer-scroll` padding of one control height plus two `--space-1`), so turning focus mode on or off, or revealing the bar, never moves the text and a revealed bar does not cover the first line. In page view the reserved band is the grey desk (the paged viewport's own surface), not white. Split view's shared bar is never hidden: in split view it stays visible in focus mode (`hidesBar` in `src/Writer.tsx` is false when the bar is portalled), so neither pane jumps and the bar never covers the pane headers. The dimming of other paragraphs still applies in both panes.

## Shortcuts

`src/shortcuts/registry.ts` owns every shortcut the app itself binds: Focus mode, Keep as fragment, Insert page break, Save, Take snapshot, New section, Find in project, Toggle sidebar and Switch light or dark, each with a default chord and a scope. Show formatting bar (Cmd+Alt+T) reveals the formatting bar in focus mode. `src/shortcuts/store.ts` stores only the user's overrides, as `folio.workspace.shortcuts`; corrupt, unknown and read-only entries are dropped on read. `src/shortcuts/chords.ts` parses and formats them, and `resolveChord` treats Ctrl as Command, as the app's handlers always did. Browser and macOS chords (`Cmd+C`, `Cmd+V`, `Cmd+Z` and the rest of `RESERVED`) can never be assigned.

Settings > Shortcuts lists each action with its chord in a quiet `kbd`; Change records the next chord and Escape cancels the recording; a reserved or duplicate chord is refused with an inline status rather than an alert. Reset restores one action, Reset all restores every action. Insert page break is listed read-only because the editor library binds it. Menu hints follow the user's rebinds. Shortcut hints appear only where the editor really installs the shortcut -- a hint that is not installed is worse than no hint.

Shift-Enter inserts a manual page break; Cmd-Enter is the soft line break. Inside a table cell Shift-Enter stays a soft break, because a page break has no meaning inside a cell.

## Optical alignment

An icon whose ink does not sit in the centre of its box is nudged with `--optical-x` and `--optical-y` on the button, applied as a `translate()` on the `svg`; never pad the button, because padding changes the row's layout and the hit area.

Measure by ink, not by box: rasterise the icon, take the bounding box of the drawn pixels, and compare its centre with the button's centre. Nudge only when the offset is at least 1 px, and round to the nearest half pixel. Re-measure when an icon changes or a control's size changes.

| Control | `--optical-x` | `--optical-y` | Why |
| --- | --- | --- | --- |
| Toolbar icons (18 measured) | none (0) | none (0) | largest ink offset 0.33 px (Bold, Numbered list), under the 1 px threshold |
| Sidebar icon buttons | none (0) | none (0) | verified by the 24 x 24 hit-area test, not by ink measurement |
| Menu and dropdown items | none (0) | none (0) | text rows, no icon centring question |

The hook stays available and costs nothing when unset. The honest coverage limit: the measurement script saw the toolbar's 18 icons, while the sidebar icon arrays came back empty on the page it visited, so the sidebar rows are verified by the hit-area test alone.

## Drop targets

A drop target is the region that will take a file, wrapped in `src/components/DropTarget.tsx`. While a file drag is over the window the region draws a 1 px inset outline -- `--accent` when it can take the item, `--danger` when it cannot -- and one line of label in the same colour; refused items show the reason as that label. Nothing else on the page changes: no backdrop, no dimming, no moving layout. The outline and label disappear the moment the drag leaves or ends.

The keyboard path is a real button, not a hidden input: it opens the system picker and the chosen file goes through exactly the same acceptance check as a dropped one, with the same refusal message. Its label and accessible name are the target's own ("Import writing" on the Projects screen, the source's PDF slot in Research), never a bare "Select files". It is a text button at `--control-height` with the icon-button recipe's colour behaviour, placed where the region's other actions live.

In the browser the target receives `File` objects; in the Mac app drops arrive as paths and are read with `readDroppedPath`, and a drop only counts when it lands inside the region. The Projects screen accepts the importer's types (`.txt`, `.md`, `.markdown`, `.docx`, `.html`, `.htm`, `.zip`) and not `.json`; a `project.json` comes back through Recover, not by dropping it. A PDF dropped on a source's PDF slot in the Mac app is read by its own command (`read_dropped_pdf`) under the same guards -- the path must come from the latest drop, be a regular file and not a symlink, have a `.pdf` extension, and be 25 MB or smaller -- so the importer's allow-list does not grow and its refusal test stays true; the slot then calls the same attach path as the picker. Native Finder drops and PDF drops into the PDF slot were not run tonight, so both are owner hand-checks: this section records the code's guards, not a tested native drop.

## Section colours and templates

In Color, Settings > General shows the Section colours row (Manuscript, Fragments, Research swatch pickers); the row is hidden in Plain. Templates carry a `hidden` flag (`src/templates.ts`): Blank, Chicago and Screenplay are offered in the create menu and in Settings > Templates; Essay and Story are hidden but still openable by id, so projects created from them keep working.

## Bibliography and PDFs

Research in the sidebar lists Bibliography when it applies, then every source (lead author -- title (year)) with the source's PDF listed under it, then the project's research notes (`src/App.tsx:1931-1943`). Clicking a note opens the Research panel's Notes tab, which groups notes attached to a source separately from loose notes. Bibliography is conditional (`showBibliography` in `src/App.tsx`): the row appears for a project started from the Chicago template, or once the project has a source or a footnote that cites one, and otherwise the destination falls back to the manuscript. The Bibliography page (`src/research/BibliographyPage.tsx`) is read-only: an order menu (Alphabetical by author, Order first cited, By source type) and an Include uncited sources checkbox, saved per project as `bibliographyOrder` and `bibliographyScope` in the document settings (`src/research/types.ts`) and used by every export (`src/research/bibliography.ts`); entries have a hanging indent and type headings are semibold. Clicking a source opens the Research panel with that source expanded. Read manuscript ends with the same Bibliography after Notes. A source may carry one PDF (25 MB cap, `src/assets/pdf.ts`); it is drawn in a right-pane iframe (`src/research/PdfPane.tsx`) from a local blob URL that is revoked on unmount, and it is never fetched from the network. A missing PDF shows an alert instead.

## How to check

Use the pinned Node v22.23.3 from `team/PLAN.md`. Coordinate the serial check slot before builds, browser or native checks; retain full logs.
Run `npx vitest run src/designTokens.test.ts src/appearance.test.ts src/palette.test.ts` as those tasks land: token/floor/state checks, dark-block parity, preference logic and Color contrast. Wave 3 adds `src/components/dragReorder.test.ts`, `src/components/dropTarget.test.ts` and `src/shortcuts/shortcuts.test.ts`.
Run the production-preview Playwright suite, one worker, with a fresh private build and isolated synthetic data. See the approved plan's PREVIEW recipe and final Validation list for exact commands and ports. Wave 3 adds `tests/drag-reorder.spec.ts`, `tests/drop-target.spec.ts`, `tests/alignment.spec.ts`, `tests/motion-u7.spec.ts`, `tests/shortcuts.spec.ts` and `tests/editor-toolbar.spec.ts` (icons only at every width).
Build the isolated `com.folio.smoke` diagnostic app, then run `python3 scripts/native-screens.py --out <isolated-cache-dir>` in Plain and Color; view every Projects, Writing, Research and Settings PNG in both appearances. Never open the real writing library from an agent session.
Browser checks do not establish native WebKit rendering, native persistence, Finder drops or title-bar behaviour. Record pending native checks honestly and prepare the plan's owner hand checks. Only the owner's real-use report establishes VERIFIED behaviour.

Native smoke and native screenshots need an unlocked, visible desktop session with the app window in front (T129): a locked or fully covered window throttles WebKit requestAnimationFrame and the harness never reports. Native GUI runs must come from a session that owns the visible desktop; a sandboxed process that cannot drive a window will fail the same way (T125).
