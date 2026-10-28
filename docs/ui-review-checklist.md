# UI review checklist

Checklist for reviewing Personal Word interface changes. Cite item ids (F1, R4, P2) in findings so authors can answer precisely. Status: CLAIMED (written for UI wave 3; not evidence of behaviour).

## How to use

1. Review from real renders (light and dark, Plain and Color, reduced motion on and off), not from the diff alone. Browser results do not establish native WebKit rendering.
2. Give every item one verdict: `PASS`, `FAIL`, `N/A` (the change does not touch it), or `OVERRIDE` (a Reflex or Finish default is broken on purpose; the reason is written in the Why column).
3. Floor: any `FAIL` blocks the change. Reflex: a `FAIL` blocks unless it becomes an `OVERRIDE` with a stated reason. Finish: never blocks; list as a suggestion.
4. Record only items that are FAIL or OVERRIDE in the review table. Say `All other items PASS or N/A` under it.
5. Project rules win over any source: `AGENTS.md` and `docs/design-system.md` (sentence case, square corners, 2 px Lucide stroke, existing motion tokens and easing, no new packages, document typography untouched). If an item below disagrees with `docs/design-system.md`, the design doc is the current contract until its owner changes it; see "Known conflicts".

## Review table

Copy this table into the review. One row per FAIL or OVERRIDE.

| Item | Verdict | Before | After | Why |
| --- | --- | --- | --- | --- |
| R4 | FAIL | Long project title pushes the pin button out of the row (screenshot, 190 px sidebar) | Title ellipsizes; pin stays in the row | Flex child lacks `min-width: 0` |

Before = what the screen or code did before the change; After = what it does now; Why = the item id's reason plus the evidence (screenshot path, selector, measurement).

## Floor -- never ships failing

- F1. Text and control contrast meets 4.5:1 (3:1 for icons and borders) in light and dark, in both palettes, including hover, pressed, disabled-adjacent text and keyboard focus. Measure the rendered colours; FAIL if any state is under.
- F2. Every interactive control has a visible `:focus-visible` treatment, and every removed outline has a replacement; compound controls also show focus within the group (`:focus-within`). FAIL if Tab leaves no visible position.
- F3. Every icon-only button has an accessible name (`aria-label` or labelled-by). FAIL if a role query by name cannot find it.
- F4. Actions are real `<button>` elements and navigation is a real link; no clickable `div` or `span`. FAIL otherwise.
- F5. Reduced motion creates no animation or smooth scroll, and every state change is still understandable without it. Check with the reduced-motion setting on.
- F6. Animation touches only `transform`, `opacity`, `clip-path` (and `visibility`), with a duration token and an easing token; never `all`, never a layout property. FAIL otherwise.
- F7. Every destructive action is confirmed or undoable, and nothing is deleted to make a check pass.

## Reflex -- defaults to override only with a reason

- R1. Hover and pressed states do not use a grey box fill; use icon or label weight and colour, and keep selected state visible without relying on colour alone. Wave-3 owner target; see "Known conflicts".
- R2. Interactive hit areas are at least 24 x 24 CSS px (WCAG 2.5.8), enlarged with a pseudo-element if needed, and never overlap a neighbour's area.
- R3. Numbers that change while visible (word count, page number, time) use `font-variant-numeric: tabular-nums`; confirm Futura supports it (`width("111") === width("888")`) or note the fallback.
- R4. Flex and grid children that hold text have `min-width: 0` so long content truncates instead of pushing controls out; nothing is clipped silently.
- R5. Use the real ellipsis character "…" in UI text, and non-breaking spaces in values like "10 MB" and "⌘ K"; format numbers and dates with `Intl.*`.
- R6. Popovers and menus set `overscroll-behavior: contain` so scrolling them does not move the page behind.
- R7. High-frequency keyboard actions (shortcuts, arrow navigation) trigger no animation; the final state and focus are identical to the pointer path. Menu open and close morphs stay as the design system defines them.
- R8. Tooltips open after one delay (about 125 ms, `--ease-out`), and neighbouring tooltips then open immediately while the pointer stays among them.
- R9. Press feedback is `scale(0.99)` over `--duration-press`; no larger scale.
- R10. Every animated state change is paired with a static cue (text, weight, shape or icon change) that remains when motion is off.
- R11. Icons and glyphs are aligned by visible ink, not by the SVG box: measure the ink rectangle first (assert centre within 0.5 px), then record any nudge once as a shared token or fixed asset, never as a per-use magic number.
- R12. `text-wrap: balance` or `pretty` is used on short UI headings and copy only, never on document typography (`.writing-surface`, `.read-prose`, `.manuscript-read`, `.preview-content`).
- R13. A sticky toolbar or header never covers the focused control or the caret when content scrolls (`scroll-padding` or equivalent).
- R14. Every control has all its states drawn: hover, pressed, focus-visible, disabled, selected, plus empty and inline-error states where the control can have them.
- R15. Meaning never depends on colour alone, especially for Color-palette section tints; add text, icon or weight.
- R16. A rapid repeat of an interaction may cancel the running animation, but the final state, focus and scroll position must be right.

## Finish -- never blocks

- P1. Image and PDF thumbnails get a 1 px outline at about 10% opacity (`outline-offset: -1px`) when it clarifies their edge.
- P2. Shortcut hints use a restrained `<kbd>` treatment when it improves recognition; no pure black.
- P3. If a control needs a sentence on how to operate it, redesign the control instead of adding helper text.
- P4. At critique, remove one element before adding any decoration; space left by removed ornament is not refilled with another ornament.
- P5. Spend visual emphasis in one place per screen; keep high-frequency actions quiet.
- P6. Buttons name their action ("Start new project", "Close right pane"), not "OK" or "Submit".
- P7. In icon plus label buttons the icon side may take slightly less padding (for example 16 px against 14 px) because glyphs carry blank margin; confirm against the measured ink (R11).

## Known conflicts with `docs/design-system.md`

Listed, not resolved here. The design doc is not edited by this checklist; D2 owns that update.

- R1 versus `## States`: the design doc still says hover uses the surface background, pressed uses `--pressed` (`--line`), pressed segmented buttons add a surface background, and `## Popover` slides a `.popover-highlight` fill behind items. The owner's wave-2 hand check asked to remove the grey box highlight "across the board" and let icons and labels go bold instead (RESEARCH section 1). Until D2 reconciles the text, cite R1 as the wave-3 target and the design doc as the current contract; do not mark existing fills as regressions on their own.
- R1 versus `## Colour tokens` (selected sidebar row): "semibold on the selected-row fill (6% text)" is a grey box fill. The same owner decision applies; same handling.
- R2 versus `## Split view`: the divider is a 6 px hit area. A thin separator may justify `OVERRIDE`; say so in the Why column.
- R7 versus `## Popover` and `## Motion`: menus open by clip-path morph even when opened from the keyboard. Treat the documented morph as the exception to R7.
- Sources versus project rules (the project rule wins): title case for buttons (Vercel), 1.5 px icon stroke and 800 ms blur enters (make-interfaces-feel-better), "never ease-in" (emil-design-eng; the repo's exits use `--ease-in`).

## Sources

Adapted from the source survey in [UI wave 3 research](agent-work/2026-10-28-ui-wave-3/RESEARCH.md), sections 4 and 5.

- Integrated: emil-design-eng (frequency decides motion, tooltips, press scale, interruptibility); make-interfaces-feel-better (optical alignment, hit areas, tabular figures, text wrap, image outline, static cue); web-design-guidelines (Vercel: focus-visible, aria-label, real buttons, truncation, non-breaking spaces, destructive confirmation, overscroll, sticky bars).
- Skimmed, one to three lines each: frontend-design, taste-skill, hallmark (Floor/Reflex/Finish tiers), redesign-existing-projects, ux-ui-agent-skills, ui-ux-pro-max, design-system-patterns, minimalist-ui.
- Skipped: high-end-visual-design, designer-skills, industrial-brutalist-ui, stitch-skills, appllama-skills, mono-color-skill, ip-as-logo-skill.
- Optical alignment (R11, P7): UI/UX Atlas optical-versus-geometric lesson; jakub.kr, "Details that make interfaces feel better"; Chrome blog on `text-box-trim`; Figma forum thread on optical centring; Material system icons.
- Standards: WCAG 2.2 success criteria 1.4.3, 1.4.11, 2.4.7 and 2.5.8.
