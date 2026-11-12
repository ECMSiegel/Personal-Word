# Portable UI style guide

Give this whole file to a coding agent working on a different app, in any stack. It describes the look, the rules and the behaviour of a desktop app whose interface is calm, flat and typographic. Follow it for all interface chrome (menus, bars, lists, dialogs, settings). It does not govern the content the user is working on; leave that alone. Values are given as CSS; translate them to your stack's equivalent but keep the numbers.

## 1. Character

The app feels like a quiet sheet of paper with a few well-set lines of type around it. Surfaces are flat and square-cornered, separated by one-pixel hairlines rather than boxes, fills or shadows. Emphasis comes from text weight and colour, never from painted rectangles behind things. Controls are mostly plain words and thin icons; the interface recedes so the user's content is the loudest thing on screen. Motion is short, small and only there to explain a change. It deliberately avoids decoration of any kind: no gradients, no rounded cards, no coloured highlight boxes, no mascots or illustrations, no slogans, no heavy footer or status strips, no helper captions under controls.

## 2. Principles

1. **One rule per behaviour.** Hover, focus, pressed, selected and disabled each have exactly one definition, written once, applied to everything of that kind. Never add a second hover style, a second scale rule or a one-off weight change in a component. A new button, link, tab or menu row should get the correct look with no new CSS.
2. **Nothing decorative.** If an element does not carry information or an action, remove it. When you remove an ornament, do not fill the space with another ornament.
3. **State is shown by weight and colour, not by fills.** Hover, keyboard focus and selection never paint a background box. The only permitted fills are: a primary button, a destructive primary button, the open tab's surface, and a selected card in a card grid (a card is a surface, and weight alone cannot separate it from its neighbours). Any new fill needs a written justification.
4. **Nothing moves its neighbours.** Hover, focus and selection effects must not change layout. If text gets heavier, its width is reserved; if an icon grows, only the icon scales (by transform), never its button or its row.
5. **Every hover has a keyboard path.** Anything revealed on hover (a button that appears on a row, a toggle) must also appear on keyboard focus. A keyboard user gets the same cue a pointer user gets.
6. **Keyboard actions never animate.** A key press changes state at once. The single exception is a menu or panel that a keyboard opens: it still opens with its normal short reveal, because that reveal is the component's opening, not decoration of the key press.
7. **Animate only what is cheap and safe.** Only `transform`, `opacity`, `clip-path` and `visibility` ever transition, always with a named duration and a named easing. Never `all`, never width, height, margin, padding or top/left.
8. **Respect the system.** Light and dark follow the operating system live. Reduced motion is honoured everywhere, including in new components. Text contrast is at least 4.5:1 (3:1 for icons and borders) in every state, light and dark.
9. **Use tokens, not literals.** Sizes, spaces, colours, durations and easings come from the token block below. Do not invent in-between values; snap to the nearest token.
10. **Quiet by default, loud once.** Spend visual emphasis in one place per screen. Frequent actions stay quiet. If a control needs a sentence explaining how to use it, redesign the control.
11. **Safe actions.** Every destructive action is confirmed or undoable.
12. **Honest hints.** Show a keyboard-shortcut hint only where the shortcut really works, and keep the hint in sync if the user rebinds it.

## 3. Tokens

Copy this block as the single source of design values. Dark values must be identical in both the OS-media block and the explicit-theme block (keep them in parity; test for it if you can). Explicit Light overrides the OS dark setting.

```css
:root {
  color-scheme: light dark;

  /* Surfaces and text (light) */
  --paper: #ffffff;        /* main working surface, popovers, dialogs */
  --surface: #f5f5f7;      /* panel surface */
  --sidebar: #eeeff2;      /* side navigation background */
  --line: #dcdde2;         /* every hairline, border and divider */
  --text: #242428;
  --muted: #6c6c74;        /* secondary text, resting icons, resting list rows */
  --selection: #dceaff;    /* text-selection colour */
  --shadow: #00000018;

  /* Accent and danger (Plain palette) */
  --accent-plain: #0069d9;
  --accent: var(--accent-plain);
  --danger-plain: #b42318;
  --danger: var(--danger-plain);

  /* Type scale: sizes */
  --type-small: 12px;      /* labels, metadata, compact controls; the minimum UI size */
  --type-body: 13px;       /* root interface text and normal controls */
  --type-large: 15px;      /* larger controls */
  --type-title: 19px;      /* panel headings */
  --type-display: 28px;    /* page, dialog and empty-state headings */

  /* Font stack: one setting, used everywhere in the chrome */
  --ui-font: Futura, "Avenir Next", -apple-system, BlinkMacSystemFont, sans-serif;

  /* Spacing scale (the only paddings, margins and gaps; 0-3 px nudges are allowed) */
  --space-1: 4px;
  --space-2: 8px;
  --space-3: 12px;
  --space-4: 16px;
  --space-5: 24px;
  --space-6: 32px;

  /* Sizes */
  --control-height: 32px;  /* header rows, menu rows, buttons in bars */
  --icon-size: 16px;
  --icon-chevron: 14px;
  /* Radius: none. Every corner is square (border-radius: 0). Only true circles
     (a round status dot, a radio) use 50%. */

  /* Elevation: only two levels of lift above the flat page */
  --elevation-page: var(--paper);
  --elevation-surface: var(--surface);
  --elevation-raised: var(--paper);          /* menus, popovers, floating cards */
  --shadow-raised: 0 6px 18px var(--shadow);
  /* Modal dialog shadow: 0 20px 80px var(--shadow), over a backdrop of
     var(--shadow) with backdrop-filter: blur(3px). */

  /* Motion */
  --duration-press: 80ms;    /* press feedback */
  --duration-fast: 120ms;    /* hover, small reveals, closing a menu */
  --duration-base: 180ms;    /* opening a menu or panel, bar slide */
  --duration-morph: 220ms;   /* the longest anything runs (size changes) */
  --ease-out: cubic-bezier(0.2, 0, 0, 1);       /* entering, hover */
  --ease-in: cubic-bezier(0.4, 0, 1, 1);        /* exiting */
  --ease-spring: cubic-bezier(0.34, 1.4, 0.64, 1); /* size changes only */

  /* States */
  --focus-ring: 2px solid var(--accent);
  --focus-offset: 1px;
  --pressed: var(--line);
  --disabled-opacity: 0.35;

  /* Hover emphasis on text (see section 5) */
  --emph-bold: 0.3px;
  --emph-scale: 1;

  font-family: var(--ui-font);
  font-size: var(--type-body);
  color: var(--text);
  background: var(--paper);
  font-synthesis: none;
}

/* Dark: follow the OS unless the user chose Light explicitly... */
@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) {
    --paper: #202023;
    --surface: #28282c;
    --sidebar: #252529;
    --line: #404046;
    --text: #ededf0;
    --muted: #a5a5af;
    --accent-plain: #64a8ff;
    --selection: #263e5d;
    --danger-plain: #ff958d;
    --shadow: #00000055;
  }
}
/* ...and the same values when the user chose Dark explicitly. */
:root[data-theme="dark"] {
  color-scheme: dark;
  --paper: #202023;
  --surface: #28282c;
  --sidebar: #252529;
  --line: #404046;
  --text: #ededf0;
  --muted: #a5a5af;
  --accent-plain: #64a8ff;
  --selection: #263e5d;
  --danger-plain: #ff958d;
  --shadow: #00000055;
}
:root[data-theme="light"] { color-scheme: light; }

/* Optional "Color" palette: swaps the neutral blue for stronger semantic
   colours. Plain (the default) keeps the tokens above. Same dark-parity rule. */
:root[data-palette="color"] {              /* light */
  --accent: #0062cd;  --accent-fill: #0072ef;  --on-accent: #ffffff;
  --danger: #cc0a00;  --danger-fill: #ed0d00;
  --success: #1e7434; --warning: #7b6300;
}
:root[data-palette="color"][data-theme="dark"] {   /* also in the OS-dark media block */
  --accent: #41a0ff;  --accent-fill: #0074e8;  --on-accent: #ffffff;
  --danger: #ff6d65;  --danger-fill: #ec0d00;
  --success: #30d158; --warning: #ffd60a;
}
```

Notes on the tokens:

- **Type.** Interface text is always sans serif, in the one user-selectable `--ui-font`. Every font declaration in the chrome reads `var(--ui-font)`. Root text is 13 px; 12 px is the smallest size allowed. Use the size tokens in both `font-size` and `font` shorthands. Where a number changes in place (page counter, save status) ask for `font-variant-numeric: tabular-nums`; the font may ignore it, so do not promise steady digit widths.
- **Spacing.** Any padding, margin or gap in the chrome snaps to the 4, 8, 12, 16, 24, 32 scale. Keep tiny nudges (0-3 px), negative offsets, values above 32 px, widths and heights as they are.
- **Colour.** Text is `--text`; secondary text and resting icons are `--muted`. Accent is for the active state, focus and primary actions. Danger is red text, never a red box unless it is a destructive primary button. Do not use pure black.
- **Plain versus Color.** The default (Plain) is almost monochrome with one blue accent. The optional Color palette adds semantic tints (success green, warning amber, section tints) chosen so each reaches 4.5:1 on the surface it sits on; re-check contrast whenever you change one. In Color, a primary button is `--accent-fill` with `--on-accent` text and a destructive primary is `--danger-fill`; in Plain both use the plain accent or text colour. Meaning must never depend on colour alone.
- **Accent handling.** `--accent` is used for: focus rings, the pressed/selected state of a toggle (weight 600 plus accent colour), the focused text field's bottom border, drop-target outlines and drag insertion lines. It is not used for large areas.
- **Separators.** A separator is exactly one pixel of `--line`, drawn as its own element (vertical ones stretch to their row), never as a border on a neighbouring element, because the neighbour would then own its colour and hover. A separator is never the only way to see a boundary that the user must hit.
- **Shadows.** Only raised things (menus, popovers, floating cards, dialogs) have a shadow. Flat panels, sidebars, bars and lists have none.

## 4. Components and patterns

**Toolbar / bar.** A single row at `--control-height` (32 px). Icons only (16 px glyph drawn on a 28 px wide button), each with an accessible name that includes its shortcut, for example "Bold (Cmd+B)". Groups abut with no gap and a 1 px `--line` divider (16 px tall, 3 px side margins, decorative) marks each boundary; inside a group icons sit 2 px apart. Icons rest in `--muted`, go to `--text` on hover, and to `--accent` when toggled on (`aria-pressed="true"`). Keyboard focus shows the focus ring. When the bar is too narrow, whole groups move into a "More" menu in a fixed priority order; the most essential groups never move.

**Buttons (text).** Transparent, no border, no radius, no fill, `gap: var(--space-2)` between an icon and its label. Hover and focus use the shared text emphasis (section 5). Pressed scales to 0.99 over `--duration-press`. A toggle or segmented choice shows its on state with weight 600 plus accent colour, not a fill. Name buttons for their action ("Start new project"), not "OK". A text-and-icon button is an ordinary button; do not give it a box.

**Primary button.** The only strongly filled control. Plain: accent fill with white text, 12 px type, weight 500, padding `--space-3 --space-4`; hover brightness 0.95, pressed brightness 0.88. Square corners. At most one per view.

**Icon buttons.** 16 px Lucide-style icons at the library's default 2 px stroke (do not set stroke width). Muted at rest, `--text` on hover and focus, `--accent` when toggled. The visual size stays small but the hit area is at least 24 x 24 px, made by a centred pseudo-element (`width: max(24px, 100%); height: max(24px, 100%)`), not by padding, so layout does not change. If an icon's ink sits visibly off-centre, nudge it with `--optical-x/--optical-y` as a `translate()` on the icon (round to half a pixel, only when the offset is 1 px or more); measure the drawn pixels, not the SVG box.

**Menus, dropdowns, popovers.** One shared popover component for every menu and panel. Raised surface (`--elevation-raised`), 1 px `--line` border, `--shadow-raised`, square corners, `overscroll-behavior: contain`, capped height that scrolls. It opens just below its trigger (2 px gap), flips upward if there is more room above, flips to the trigger's right edge if it would leave the window, and respects the nearest scrolling container (width capped to that container, long labels wrap). Opening grows it from the trigger edge by `clip-path` with a fade of the surface (`--duration-base`, `--ease-out`); closing is `--duration-fast` `--ease-in`; reopening mid-close reverses from the current frame. Items are opaque from the first frame (no item fade-in); a fresh opening may stagger items by transform only, 15 ms each, capped. There is no highlight box: the keyboard-highlighted row and the hovered row are shown with the text emphasis (weight), and the highlighted row is exposed with a data attribute so it shares the one emphasis rule. Shortcut hints sit right-aligned in `--muted` at 12 px on one line. Escape closes and returns focus to the trigger. Arrow keys, Home and End move through items. A menu opened from a trigger may "morph": it grows out of the trigger and covers it while the trigger fades. A menu sized by its content is at most 320 px wide.

**Right-click menu.** The same row look as a dropdown, opened at the pointer (or below the row on Shift+F10 / the context-menu key), clamped 8 px inside the window. Arrows, Home, End move over enabled items; Enter or Space runs; Escape closes and restores focus; Tab, an outside press, resize or scroll closes it. Destructive items are in the danger colour and go through the normal confirmation.

**Command palette.** A raised, non-modal dialog 12vh from the top, centred, `min(560px, 100vw - 2 x 24px)` wide and at most `min(420px, 70vh)` tall, above all menus but below modal dialogs. A search field above a grouped list; each row shows its current shortcut at the right. Up/Down move the active row (wrapping), Enter runs and closes, Escape closes, and focus returns to where it was. The active row is shown by colour plus text emphasis, never a fill.

**Dialogs.** Modal dialogs are 420 px wide, `--paper`, 1 px `--line` border, `--space-6` padding, the large soft shadow and a blurred dimmed backdrop. Title at `--type-display`. Actions are right-aligned with a `--space-4` gap, text buttons with the primary last. Escape closes; focus returns to the opener. A modal sits above the command palette, which closes when one opens.

**Settings pages.** Fields are rows: a 180 px label column and a control column (260 px in a dialog, which is 560 px wide). Segmented rows for small choices (Appearance: System, Light, Dark; Palette: Plain, Color). No helper captions under controls. Use a placeholder, an inline error, or a keyboard-reachable tooltip instead. A sticky strip of section names sits at the top of long settings pages: names are `--muted`, `--text` on hover and focus, and weight 600 plus accent for the section in view, with a 1 px `--line` below. The same settings block is defined once and shown wherever needed; do not build a smaller second copy.

**Sidebars and lists.**
- Rows: a 16 px leading icon, an `--space-2` gap, then a single-line label that ellipsizes at every width (never wraps). Labels of different row types line up at the same x. A nested row steps in by one icon width.
- Row look: weight 400 in `--muted` at rest; hover, keyboard focus and "currently open" take it to `--text`. Rows are never bold and never filled, selected or not.
- Section headings: 13 px, weight 500 at rest. A heading whose section holds what is on screen turns bold (700) in `--text`, with its icon keeping any section tint. The heading is allowed to widen a little when it turns bold; rows never change weight, so no row jumps. On a destination page that is not part of any section (Settings, Comments), nothing is lit.
- Heading layout: label, then hover-revealed view toggle and add button (also shown on keyboard focus; the toggle sits left of add), then the chevron at the far right, all chevrons in one column. Header action buttons stay in flow and never overlay the label.
- Minimum width 190 px. Width is a global setting; list versus card view is per project. Cards stay in the sidebar and shrink to its width, titles on one line with an ellipsis.
- Fixed bottom rows (utility destinations) are `--control-height` high, do not reorder and carry no hover icons.
- Search field: icon-only clear button (16 px X) that is hidden (`opacity: 0`, `visibility: hidden`, out of the tab order) when empty and fades in over `--duration-fast` when there is text. Escape clears a non-empty query and stays in the field.
- Reordering: press then move 5 px to start a drag (less is a click). The lifted row follows the pointer by `translateY` only, neighbours step aside by transform, and a 2 px accent line marks the landing spot. No shadow, rotation or scale. Escape cancels. Keyboard: Option+Up / Option+Down moves the focused row one place at once with no animation, focus stays on the moved row, and a polite live region announces "Moved <title> to position N of M" (or "already first / last"). Provide the same moves in the context menu.
- A thin position rail of short lines (one per item, 2 px tall, 6 px idle, 12 px open elsewhere, 16 px and accent when active) is an optional, restrained way to show where you are; it magnifies toward the pointer, has no hover card, and uses transform only.

**Resize edges and splitters.** Draggable edges paint nothing on hover or drag; only the cursor changes. They have a 6-7 px hit area around a 1 px centre line that is always visible. Each is `role="separator"` with `aria-orientation`, `aria-valuemin/max/now` and `tabindex="0"` so arrow keys move it (about 2 percent per press). Keyboard focus shows the standard focus ring; a mouse click shows none.

**Floating panels.** A floating panel never overlaps the user's content: it appears only in margins wide enough (panel minimum width plus 16 px gap on each side) and otherwise the normal docked panel shows, with no visible difference. The decision depends only on window, zoom and view, so it cannot flicker back and forth. A floating list of plain text has no background, border or shadow. A floating panel that holds inputs (a card) is a raised surface: `--elevation-raised`, 1 px `--line`, `--shadow-raised`, square, 280-360 px wide, scrolling its body with a fixed footer, sitting above bars and below menus. It is a non-modal dialog named by its heading, closed by Escape, an X button or Done, and focus returns to where it came from. A pointer open fades and slides in using opacity and transform; a keyboard open is instant. Notifications move out of the way of floating panels.

**Focus ring.** `outline: 2px solid var(--accent); outline-offset: 1px` on `:focus-visible` for every interactive control (checkbox and button included). Never remove an outline without replacing it. Compound controls also show focus within the group. Text inputs and textareas drop the outline and instead draw a 1 px accent bottom border on focus. Text inputs show a `--muted` border on hover.

**Selection states.** Weight 600 plus accent colour for toggles and segmented choices (with roving tabindex, arrow keys step and select, Home/End jump); weight and `--text` colour for the open sidebar item; checkboxes and radios use the accent colour. Never rely on colour alone: weight or an icon change must accompany it.

**Disabled.** Opacity 0.35 and the default cursor; hover and pressed effects exclude disabled controls.

**Drop targets.** The region that will accept a file draws a 1 px inset outline while a file is dragged over the window: accent when it can take the item, danger when it cannot, plus one line of label in the same colour (refusals show the reason). Nothing else changes: no backdrop, no dimming, no layout movement. Always provide a real button with the target's own name ("Import writing"), not a hidden file input, as the keyboard path; it runs the same acceptance check as a drop.

**Scroll regions.** A scrolling region with content beyond an edge fades that edge with a 16 px `mask-image` gradient, never a fill. Hide the scrollbar on narrow lists where the fade is the cue. Skip the fade while a menu or dialog is open inside the region.

**Empty states.** Short, plain, in `--muted` or `--text`, using the display size for a page-level heading. No illustration, no mascot. Sort and view options live in the page's toolbar, on the same row as its main action, and stay there when the list is empty. Where a form is empty, use a placeholder rather than explanatory text.

**Status text.** Footers and status lines are flat: a 1 px `--line` rule above, `--control-height` minimum height, `--muted` text at 12 px, side padding matching the header. Counters and save state use tabular figures. Live status that matters is in a polite live region. Toasts sit bottom right (16 px from the edges), 12 px type, max 360 px wide, in a `--line` coloured box with a 1 px border; only their buttons take pointer events.

**Icons next to text.** Align by visible ink, not box. Chevrons are 14 px, all other icons 16 px. Icon-plus-label buttons may give the icon side slightly less padding because glyphs carry blank margin.

## 5. Interaction and motion rules

**Hover and focus emphasis on text.** Every control that shows text (button, link, tab, menu row, option, summary, a label around a checkbox or radio) gets one shared effect on hover, on keyboard focus and when it is the keyboard-highlighted menu row. The intent: the text gets heavier, without moving a single neighbour, and it stays sharp. Danger controls stay red. The technique is settled: a faux bold drawn as a second copy of the text in the same colour, offset a fraction of a pixel to the right (`text-shadow: var(--emph-bold) 0 0 currentColor`, with `--emph-bold: 0.3px`). It leaves every glyph advance unchanged, so nothing shifts. Do not use a text stroke (`-webkit-text-stroke`): WebKit paints it without font smoothing, which leaves a grey halo and blurry stems on 1x screens. The shadow copy is painted as ordinary smoothed text, so stems stay crisp. Keep it in exactly one rule, never scale text up, and keep it identical for pointer and keyboard. Rows with content on the right (a shortcut, dates, a delete icon) apply the emphasis to the label only, so the right-hand content never moves. Text inside the user's document is never emphasised. Reduced motion changes nothing about this effect, because it does not animate position. Check the offset on your own screens: if it reads too light, raise the one token (about 1 px at 1x, about 0.5 px at 2x was the planned fallback).

**Icon-only controls.** They do not get the text emphasis. In a toolbar they magnify like a dock; elsewhere they change colour only.

**Toolbar dock magnify.** The icon nearest the pointer grows to 1.5 times its size and neighbours follow a cosine curve out to about 84 px from the pointer. The artwork is drawn at 24 px and scaled down to 16 px at rest (scale 1/1.5), so the peak draws at native size and stays sharp. Implementation: JavaScript writes a `--dock-scale` per icon; CSS scales only the icon's `svg` with `transform` (`--duration-fast`, `--ease-out`); the bar's layout and the 24 px hit area never change. Keyboard: a focused icon peaks at 1.5, its neighbours step down (1.25, then 1.1), and that change is instant. Touch does nothing. Reduced motion: no magnification at all.

**Standalone icon magnify.** Icons outside the toolbar that are real actions (a trash on a list row, a "reveal" or "open beside" icon, a search or gear icon) grow 25 percent on hover and focus. Only the icon scales; the button is never transformed.

```css
.icon-grow > svg, .icon-grow > span { transition: transform var(--duration-fast) var(--ease-out); }
.icon-grow > span { display: inline-block; }
.icon-grow:is(:hover, :focus-visible) > :is(svg, span) { transform: scale(1.25); }
@media (prefers-reduced-motion: reduce) {
  .icon-grow:is(:hover, :focus-visible) > :is(svg, span) { transform: none; transition: none; }
}
```

**Press.** Every button, link, tab, menu row and summary scales to 0.99 over `--duration-press` while pressed; no larger scale. A primary button also darkens (brightness 0.88).

**What animates.** Menu and panel openings (clip-path and opacity), small slides of panels and bars (transform and opacity, 16 px at most), hover icon magnify, press scale, drag following and neighbours stepping aside, a search field revealing by clip-path, a bar sliding in from the edge. Nothing runs longer than 220 ms. Enter uses `--ease-out`, exit `--ease-in`, spring only for size changes. Every animation is interruptible: reversing or repeating it continues from the current frame, and the final state, focus and scroll position are always right. Scripted animation should use the platform's native animation API with a guard that refuses properties outside the allowed four.

**What never animates.** Colour changes (the hover colour changes at once), text weight, layout properties, anything caused by a key press (except the menu opening), selection and highlight (they do not slide), drag-resize edges, the keyboard-reordered row, scroll-fade masks, any item inside an opening menu fading in from low opacity.

**Reduced motion.** When the user asks for reduced motion: all transitions are removed (`transition: none !important`), smooth scrolling is off, scripted animations are not created at all and exits resolve immediately, toolbar magnify and icon grow are dropped, menus and panels appear instantly. Every state change must still be understandable without motion (the static cue is the weight, colour or shape change).

**Keyboard and focus.**
- Every interactive element is a real button or link; no clickable div or span. Icon-only buttons have an accessible name.
- Every control shows `:focus-visible`; Tab never leaves the user without a visible position.
- Escape closes the topmost menu, dialog or palette and returns focus to what opened it (a closed dropdown first, then the card).
- Menus and lists support Arrow keys, Home, End, Enter/Space.
- Segmented controls and tab-like sets use a roving tabindex.
- A sticky bar must never cover the focused control or the caret (use scroll padding).
- Hover-only controls (add, view toggle, reveal) appear on keyboard focus too.

## 6. Hard "never" list

- Never paint a grey (or any) box behind a hovered, focused or selected item.
- Never add a second hover style, a second scale, or a second weight rule. One shared rule only.
- Never let hover, focus, selection or emphasis move or resize a neighbour or the row.
- Never round corners (except true circles), and never use gradients or decorative backgrounds.
- Never use a shadow on flat surfaces; shadow is for raised things only.
- Never add decorative icons, illustrations, mascots, slogans or heavy footer strips.
- Never put helper captions under controls.
- Never animate `all`, layout properties, or colours with transitions; never animate longer than 220 ms.
- Never animate a keyboard action (apart from the documented menu opening).
- Never fade menu items in from low opacity; they are opaque from the first frame.
- Never skip reduced-motion handling in a new component.
- Never remove a focus outline without replacing it; never show focus only by colour change.
- Never use a clickable div or span; never leave an icon-only button without an accessible name.
- Never rely on colour alone for meaning.
- Never use pure black text, never go below 12 px type, never go below 4.5:1 text contrast.
- Never use the stroke-width option on icons; keep the library default 2 px.
- Never pad a button to enlarge its hit area (use the pseudo-element) and never overlap neighbouring hit areas.
- Never hardcode a colour, size, spacing, duration or easing that has a token.
- Never overlap the user's content with a floating panel.
- Never let a destructive action run without confirmation or undo.
- Never show a shortcut hint for a shortcut that is not actually installed.
- Never rewrite punctuation or text inside the user's own content, citations, code or file paths.
- Never reintroduce a sliding highlight box once removed.

## 7. Writing style for UI text

- **Sentence case** everywhere: "Start new project", "Import writing", "Close right pane". Never Title Case on buttons or headings.
- **Buttons name the action**, with a verb and the thing: "Take snapshot", "Add note", "Delete source". Never "OK" or "Submit".
- **Short labels.** Labels are a word or a few words. Menus show the label on the left and the shortcut, muted, on the right.
- **No helper text under controls.** Prefer a placeholder ("Write a note", "Find in project"), an existing inline error, or a tooltip that is reachable by keyboard. If a control needs a sentence, simplify the control. A single quiet muted line is allowed only where a fact would otherwise surprise the user (for example "Lookup needs the internet").
- **Use `--` (two hyphens) as the dash separator** in interface text ("Section page 2 of 5 -- Letter"). Use the real ellipsis character "…" for truncation and for labels that open something. Use non-breaking spaces in values like "10 MB".
- **Counts and positions are plain:** "1 footnote, 0 quotes", "Section page 2 of 5", "Moved <title> to position 3 of 8".
- **Errors say what happened and what is refused.** For a refused item, the reason is shown as the label itself; keep it plain and show it inline rather than in an alert popup. Duplicate or reserved input is refused with an inline status.
- **Dates and numbers** are formatted with the platform's locale formatting ("Edited <date>"), not hand-built.
- **Every icon-only control has a spoken name** that matches what it does, with the shortcut in brackets where there is one: "Bold (Cmd+B)".
- **Tone:** calm and factual; no slogans.

## 8. How to check your work

A reviewer can run these by eye, in light and dark, with and without reduced motion:

1. Hover and Tab across every control. Does text get heavier (and stay sharp) without any neighbour moving? Do icon-only controls change colour (or magnify, if in a toolbar)? Is there exactly one kind of hover cue?
2. Is there any filled rectangle behind a hovered, focused or selected item that is not on the permitted-fills list?
3. Are all corners square and all separators one pixel? Are there shadows on anything that is not raised?
4. Tab through the whole screen: is there always a visible focus position? Does Escape close the top layer and return focus?
5. Turn on reduced motion: does everything still make sense with nothing animating?
6. Press and hold a button: does it shrink by about 1 percent and nothing more? Press a key to trigger an action: nothing animates?
7. Open a menu: does it grow from its trigger, with every item fully opaque from the first frame? Does it stay inside the window and its container?
8. Narrow the window and the sidebar to the minimum: do labels ellipsize and controls stay in the row?
9. Read all text for sentence case, action-named buttons, no helper captions, `--` dashes.
10. Check contrast of muted text and the accent in light and dark, including in hover and focus states.
11. Search the stylesheets: no literal px that should be a spacing token, no literal colours outside the token block, no `transition: all`, no `border-radius` other than 0 or 50%, no second `font-weight` or scale rule on hover.
12. Drag a file over the window and check the drop target: outline and label only, nothing else changes.

## 9. Specific to a word processor - adapt or drop

Everything below only makes sense for a document editor. Adapt it to your app's content area or drop it.

- The user's document typography (typeface, size, line height, paper colour, prose colours) is configured independently of the interface and is never touched by interface styling, including hover emphasis (links in the document are excluded).
- Page view draws real page sheets (separate elements, not gradients) with a gap between pages, scaled with zoom; continuous view is an unpaged column. Footnote space is reserved equally on every page.
- A toggleable ruler across the top and a side ruler down the left of each page, with margin markers that are keyboard-operable sliders (arrow keys, Shift for a bigger step, Home/End for the limits).
- Focus mode hides the sidebar and the format bar; the bar returns when the pointer is within about 56 px of the top, when focus enters it, or by a shortcut, and space for it stays reserved so text never moves.
- Split view puts two panes side by side with one shared format bar, a divider with a 1 px centre line, and a header and footer per pane.
- A footer shows page status and word count; a format bar offers marks, lists, links, tables, images and page setup; a prose-check aid and citation/footnote tools exist.
- Exact page parity between on-screen pages and exported PDF or Word files is not promised; say so honestly.
