# Personal Word design system

The approved [UI polish plan](agent-work/2026-10-25-ui-polish/PLAN.md) defines this contract.
Implemented 2026-10-26 (tasks T071-T096); this document is not evidence of behaviour. Status: CLAIMED pending final validation (T082) and owner real use.

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

## Motion

`--ease-spring: cubic-bezier(0.34, 1.4, 0.64, 1)` and `--duration-morph: 220ms` govern the search expansion and create-panel opening.
The `prefers-reduced-motion: reduce` block in `src/styles.css` removes all transitions and smooth scrolling. Reduced motion must also apply to new components.
The create panel closes instantly. Panel items have no fade-in: they are opaque from the first frame and the clip-path morph alone reveals them, so no menu or panel item may start at reduced opacity (T086). If native WebKit does not animate `@starting-style`, an immediate opening is acceptable; record the observed result.

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
Selected sidebar entries are always semibold: blue in Plain; in Color the selected row and its icon take the section tint (--tint-manuscript, --tint-fragments, --tint-research); Read, Comments, History and Settings stay --accent (Q007).

## Theme and palette

`src/appearance.ts` owns the global `folio.workspace.appearance` JSON preference: `{ theme: "system" | "light" | "dark", palette: "plain" | "color" }`. Defaults are System and Plain; invalid values fall back per field.
Apply it in `src/main.tsx` before React renders, then in the `src/App.tsx` effect when settings change; persist the same preference there. This does not alter project data or the SQLite schema.
On `<html>`, System removes `data-theme`; Light and Dark set `data-theme="light"` or `data-theme="dark"`. Plain removes `data-palette`; Color sets `data-palette="color"`.
System follows macOS live. Explicit Light overrides the system dark media query. Dark declarations in the media block and `[data-theme="dark"]` block must match, ignoring `color-scheme`; `src/designTokens.test.ts` enforces parity.
Settings > General provides Appearance (System, Light, Dark) and Palette (Plain, Color) segmented rows without helper captions. Cmd/Ctrl+Shift+L switches to the opposite effective Light/Dark appearance.
The owner's answered question 2 requires the Mac title bar to follow the choice through `getCurrentWindow().setTheme()` with `core:window:allow-set-theme`; System passes `null`. Browser builds do nothing for the title bar. Only native checks establish this behaviour.

## Sidebar width

The sidebar minimum is 190 px. Inside the narrow-width container query (240 px or less) labels stay on one line and ellipsize only as a last resort: group headings Manuscript, Fragments and Research and the footer labels show in full at 190 px, and only the brand heading ("Personal Word") may truncate. The group action buttons are overlaid on hover or focus instead of reserving width (T096).

## Rules

- Keep flat, restrained surfaces and square corners. No decorative folders, quills, curved connectors, slogans or heavy footer strips.
- Selected sidebar entries are semibold: blue in the Plain palette, their section tint in Color.
- Do not add helper captions under controls. Use placeholders, existing error messages, or keyboard-reachable tooltips with `title`, `aria-describedby` and a focus-visible tip. Preserve the browser-only storage notice and the research file error messages.
- Use `--` for UI dash separators. Never rewrite punctuation in documents, citations, code or paths.
- Never alter document typography: `.writing-surface`, `.read-prose`, `.manuscript-read`, `.read-title`, `.preview-content`, editor footnote/page rules and `--prose-*` values stay outside the UI sweep. Reading preferences must not change export formatting.
- Keep hover controls keyboard-accessible, appearance live throughout, sidebar width global and list/card views per project.

## How to check

Use the pinned Node v22.23.3 from `team/PLAN.md`. Coordinate the serial check slot before builds, browser or native checks; retain full logs.
Run `npx vitest run src/designTokens.test.ts src/appearance.test.ts src/palette.test.ts` as those tasks land: token/floor/state checks, dark-block parity, preference logic and Color contrast.
Run the production-preview Playwright suite, one worker, with a fresh private build and isolated synthetic data. See the approved plan's PREVIEW recipe and final Validation list for exact commands and ports.
Build the isolated `com.folio.smoke` diagnostic app, then run `python3 scripts/native-screens.py --out <isolated-cache-dir>` in Plain and Color; view every Projects, Writing, Research and Settings PNG in both appearances. Never open the real writing library from an agent session.
Browser checks do not establish native WebKit rendering, native persistence, Finder drops or title-bar behaviour. Record pending native checks honestly and prepare the plan's owner hand checks. Only the owner's real-use report establishes VERIFIED behaviour.
