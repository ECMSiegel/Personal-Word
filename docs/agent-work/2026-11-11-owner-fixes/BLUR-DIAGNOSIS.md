# Blurry hover text -- diagnosis (2026-11-11, agent-db77, Claude Opus)

Owner's report: "text still is blurry. we fixed this already with the magnifying top bar." Screenshots 5, 10-14
(hovered text soft), 15 (hovered toolbar icon crisp). His report is the ground truth; everything below explains it.

Status: diagnosis MEASURED in the real WebKit app (smoke build); recommended fix NOT made (no app source changed
in this job) and therefore not yet seen by the owner.

## 1. Answer in plain English

The soft look comes from the hover effect itself: the faux bold is drawn with `-webkit-text-stroke`. On this Mac,
WebKit draws stroked text differently from normal text (measured). It paints a thin outline, about half a pixel, around
every letter edge, and the font-smoothing setting stops having any effect on it. The likely reason, inferred and not
read in WebKit's code, is that stroked text skips macOS font smoothing. The owner's screenshots are 1x pixels and both
external monitors on this Mac are 1x (non-Retina), so he most likely uses the app on one of them (inferred). On a 1x
screen that half-pixel outline cannot line up with the pixel grid. So every crisp one-pixel stem turns
into two or three columns of grey. The grow (scale) that wave 9 removed was not the cause: an identity transform and
a removed transform give pixel-identical results. A thinner stroke does not help either: it is still soft and also
looks washed out. The fix is to draw the faux bold as a second copy of the text, shifted 0.3 px to the right
(`text-shadow: 0.3px 0 0 currentColor`). That copy is drawn as ordinary smoothed text. It stays sharp, it looks about
as heavy as today's stroke, it never changes layout, and it takes the text colour, so danger stays red.

## 2. History: what "the toolbar fix" actually was

- Wave 6 owner request 8 (`docs/agent-work/2026-11-02-ui-wave-6/REQUEST.md:12`): "the magnifying top bar blurs the
  hovered thing, not just magnifys". Fix (T3/T227, `docs/agent-work/2026-11-02-ui-wave-6/notes/T3.md`;
  `src/editor/toolbar-motion.css:4-11`; design-system "Dock 24 px"): the toolbar SVG artwork is drawn at 24 px and
  scaled DOWN at rest (`scale(calc(var(--dock-scale, 1) / 1.5))`), so at full magnification the transform is exactly
  `scale(1)` and the icon is painted at its drawn size with no resampling. Measured here: the icon's computed
  transform at rest `matrix(0.666667, ...)` (16 px box); fully magnified (`--dock-scale: 1.5`) `matrix(1, 0, 0, 1, 0, 0)`
  (24 px box). Crops: `node_modules/.cache/personal-word-beta/blur/cmp-icon.png` (8x; left rest, right magnified).
  The icon captured is the first toolbar icon, Undo, which is disabled (light grey) in an empty document, not the dark
  hovered Image icon of 15.png; it shows the transform, not the owner's exact pixels.
- So that fix was about a SCALED BITMAP of vector art. It is apples to oranges with the text problem: the icon is SVG
  geometry (no font smoothing, no stroke-on-text). Hover text has not been scaled since wave 9. It is blurred by how
  the stroke itself is painted.
- Wave 9 A1 (`docs/agent-work/2026-11-10-ui-wave-9/notes/A1.md`) set `--emph-scale: 1` on the theory that the
  4 percent grow caused the fuzz, and asked for a hand check: "If it still looks fuzzy, report that; do not change
  the stroke here." The owner has now reported exactly that. The theory was wrong: see V0/V2 below.

## 3. What the owner's own pixels show (his screenshots, 1x)

His PNGs are 72 dpi with 13 px text about 13 px tall, so they are 1x pixels. This Mac has two 2560x1440 external
displays at backing scale 1 and a Retina built-in (`NSScreen`: 1x, 1x, 2x). Same text, rest vs hovered, luminance
along one scanline (36 = full ink, 255 = paper):

| Owner crop | "H" left stem | "l" stem |
|---|---|---|
| 12.png (rest) | `94 36` | `36 85` |
| 13.png (hovered) | `67 36 163` | `66 38 192` |

At rest the stem is one solid pixel with a faint edge. Hovered, it spreads into a third column with mid greys on both
sides. 12.png and 13.png are the Projects page row title "Hello Angela" (15 px), at rest and hovered: they match
this run's Projects-row snapshots pixel for pixel (section 5). Edge metric (section 5) on his crops: fringe pixels per glyph run 2.04 -> 2.38 (12->13), 1.83 -> 2.74 (10->11),
1.97 (5.png "Opening", lit, not hovered) vs 3.00 (5.png "I love Angela", hovered).

## 4. Computed-style facts (native WebKit, keyboard focus)

Each control was focused by `element.focus()` and `matches(':focus-visible')` was true for all seven (the window
was key, `document.hasFocus()` true). Computed styles for the text element and every ancestor up to `<html>`
(report `runs/blur-8pxb_c9e/report-blur-probe.json`, `probe.blur.screens.*.facts`):

- The ONLY non-default value in any chain is the control's own `transform: matrix(1, 0, 0, 1, 0, 0)` (identity, from
  the shared rule's `scale(calc(var(--emph-s,1)*var(--press-s,1)))`), with `transition-property: transform 0.12s`.
- Everywhere: `will-change: auto`, `-webkit-font-smoothing: auto`, `text-rendering: auto`, `opacity: 1`,
  `filter: none`, `backdrop-filter: none`, `backface-visibility: visible`, `contain: none`, `zoom: 1`,
  `perspective: none`, `isolation: auto`, `mix-blend-mode: normal`. No ancestor transform, will-change or zoom.
- Stroke width on focus: 0.52 px (13 px sidebar row), 0.48 px (12 px tab, Projects tab, toolbar menu), 0.6 px
  (15 px Projects row title and sidebar project title). Font: Futura (interface font), weights 400-600.
- Whether WebKit gave any element its own compositing layer cannot be read from page JS: UNKNOWN. Nothing in the
  computed styles would trigger one, and forcing a layer on the parent (V8) changed no pixel in the snapshot.
- Positions: some text sits at fractional CSS px (tab x 66.58; toolbar menu y 77.5; Projects row x 223.98).
  A forced +0.5 px offset also softens text at REST (V8 rest-halfpx, sidebar fringe 1.95 -> 2.65). That is a
  separate, smaller effect and is not caused by the hover rule.
- Futura on this Mac has only Medium (w6) and Bold (w9) (plus Condensed). "One step heavier" is a jump to Futura
  Bold: `font-weight` 600 and 700 render identically (V4). The sidebar project title (15 px) is already weight 600, which is Bold; the Projects row title is 15 px weight 500 (Medium).

## 5. Method

- One smoke build (plus one identical rebuild without the window position, for the repeat run; it also opened at 1x): `npm run tauri build -- --debug --features native-smoke --no-bundle --config` with the
  `com.folio.smoke` identifier, the main window placed on a 1x external screen (`x 1000, y -1300`), and
  `build.frontendDist` = a copy of `dist/` built 14:21 (`node_modules/.cache/personal-word-beta/blur/dist-1421`).
  That is the same frontend as the release app the owner tested (built 14:23). The live tree did not compile at the
  time (`src/App.tsx(3021)`, another agent's in-progress `onDeleteTextOnlyFootnote`). `src/styles.css` sha256 at
  run time: `c3d7af14...f94b`. Smoke binary sha256 `35509bd4...2607`, then `0cb11a0f...bc2` for the repeat run.
- New measure-only phase `blur-probe` in `tests/native-smoke.js` (function `blurProbe`). Blank throwaway project
  "Hello Angela" in an isolated data dir and WebKit store. Controls: sidebar entry row ("Opening", 13 px), sidebar
  project title (15 px, 600), project tab (12 px, 600), Projects tab button (plain button, 12 px), toolbar text menu
  (zoom dropdown "100%", 12 px), and on the Projects screen the Projects row title (15 px).
  Emphasis is forced through the rule's own `.is-highlighted` hook, so it is the real hover paint. Real `:hover`
  cannot be synthesised. Variants are painted from an injected `<style>`. The hover text colour (`--text`) is forced
  in every variant, rest included, so the muted-vs-dark colour change cannot confound the numbers. Each variant is
  captured with the WKWebView snapshot (`smoke_snapshot`) after two animation frames and 350 ms.
- `devicePixelRatio` was 1 in both runs, so these are the owner's 1x conditions.
- Screen-compositor capture (`screencapture`) was attempted and is NOT available: the shell has no Screen
  Recording permission (captures show only wallpaper). Everything is from WebKit's snapshot. Evidence that the
  snapshot shows what the owner sees: template matching his crops against this run's Projects-row crops gives a
  mean absolute luminance difference (0-255) of 2.6 for his 12.png against our rest capture (13.0 against our
  hovered one) and 3.3 for his 13.png against our current-rule capture (13.0 against rest). His screen pixels and
  the snapshot are therefore the same image to within a few grey levels, and 12/13 are rest/hovered. (The fringe
  numbers in section 3 differ from section 6 only because his crops are cut tighter.) The compositing variants
  (V8 layers) could only be checked through the snapshot, so "no effect" for them is measured in the snapshot only.
- Metric (stated): crop the text box, luminance, ink = (L - paper) / (full ink - paper). On every horizontal
  scanline, a glyph run is a stretch of pixels with ink > 0.1. **Fringe per run** = run pixels with ink < 0.85
  (grey edge pixels; lower = sharper; a crisp hinted stem has about 2). **noCore** = share of runs that never reach
  ink 0.85. **Ink** = total ink (how heavy it looks). Implementation: `blur/png.py` (`runs`, `metrics`).
- Repeat: the second launch (`runs/blur-h6wk9lhx`) gave identical numbers for every control.

## 6. Variants (native WebKit, 1x). Fringe per run / noCore / ink

| Variant | Sidebar row 13px | Projects row 15px | Project title 15px/600 | Tab 12px/600 | Projects tab 12px | Toolbar menu 12px | What it looks like (4x/5x crops) |
|---|---|---|---|---|---|---|---|
| V0 rest (hover colour, no emphasis) | 1.95 / .18 / 210 | 1.96 / .07 / 413 | 2.41 / .10 / 601 | 3.11 / .33 / 427 | 2.63 / .49 / 153 | 2.35 / .47 / 115 | crisp one-pixel stems |
| V0 rest, transform none + ancestors | identical to V0 | identical | identical | identical | identical | identical | pixel-identical to V0 |
| **V1 current rule** (stroke 0.04em, identity transform) | **3.77** / .24 / 251 | **3.37** / .20 / 484 | **3.52** / .24 / 709 | **4.51** / .55 / 478 | **3.35** / .65 / 194 | **3.39** / .50 / 149 | bolder but fuzzy grey halo; thin parts go lighter |
| V2 stroke, every transform/transition/will-change removed | identical to V1 | identical | identical | identical | identical | identical | pixel-identical to V1: the transform is not the cause |
| V3 stroke 0.02em | 3.11 / .22 / 212 | 2.96 / .21 / 414 | 3.01 / .20 / 633 | 3.78 / .48 / 427 | 3.29 / .62 / 163 | 2.89 / .59 / 125 | no heavier than rest (ink same) yet soft and washed out |
| V3 stroke 0.25px | 3.05 / .21 / 211 | 2.85 / .20 / 402 | 2.75 / .18 / 620 | 3.86 / .49 / 430 | 3.39 / .62 / 165 | 2.89 / .59 / 126 | as 0.02em |
| V3 stroke 0.5px (whole half device px) | 3.85 / .24 / 249 | 3.04 / .19 / 459 | 3.74 / .22 / 685 | 4.49 / .55 / 483 | 3.26 / .66 / 197 | 3.39 / .50 / 151 | as V1 |
| V3 stroke 1px | 2.91 / .16 / 316 | 3.11 / .12 / 577 | 2.86 / .21 / 805 | 3.99 / .53 / 576 | 2.85 / .60 / 251 | 2.57 / .34 / 196 | heavy and still haloed |
| V4 real weight 700 (= 600: Futura Bold) | 2.97 / .11 / 313 | 2.30 / .10 / 600 | = rest (already Bold) | 2.84 / .33 / 426 | 2.91 / .46 / 249 | 2.52 / .29 / 173 | crisp real bold, but text 12-13 percent wider (Projects tab 66.6 -> 75.1 px, Start new project 147.1 -> 165.3 px): moves neighbours |
| V5 text-shadow 0 0 0 | identical to V0 | identical | identical | identical | identical | identical | no visible change |
| **V5 text-shadow 0.3px 0 0 currentColor** | **1.77** / .07 / 258 | **1.29** / .03 / 488 | **1.85** / .06 / 683 | **2.80** / .37 / 492 | **2.45** / .48 / 189 | **1.95** / .27 / 144 | bolder AND crisp: solid cores, edges as clean as rest; layout width unchanged on every control |
| V5 text-shadow 0.5px | 2.24 / .06 / 269 | 1.58 / .04 / 506 | 2.26 / .07 / 696 | 3.54 / .42 / 509 | 2.40 / .48 / 192 | 1.96 / .27 / 145 | crisp, slightly heavier, faint right-edge grey |
| V5 text-shadow 1px (one device px at 1x) | 2.92 / .06 / 304 | 2.58 / .06 / 580 | 3.38 / .08 / 762 | 4.01 / .48 / 554 | 3.11 / .57 / 222 | 2.42 / .27 / 174 | crisp edges (each stem = rest stem doubled), heavy; small counters start to fill |
| V6 paint-order: stroke fill (0.04em) | 3.49 / .15 / 270 | 2.82 / .11 / 518 | 3.33 / .22 / 728 | 4.60 / .52 / 506 | 2.97 / .56 / 202 | 3.07 / .34 / 155 | slightly less fuzzy than V1, still haloed |
| V6 paint-order + 1px | 2.53 / .16 / 323 | 3.00 / .13 / 594 | 2.76 / .21 / 813 | 3.80 / .52 / 587 | 2.83 / .60 / 253 | 2.49 / .34 / 197 | heavy, haloed |
| V7 stroke + font-smoothing antialiased | identical to V1 | identical | identical | identical | identical | identical | identical to V1 |
| V7 stroke + subpixel-antialiased | identical to V1 | identical | identical | identical | identical | identical | identical to V1 |
| V7 stroke + font-smoothing none | 0.00 / 0 / 341 | 0.00 / 0 / 587 | 0.00 / 0 / 808 | 1.23 / .28 / 593 | 1.21 / .40 / 261 | 0.36 / .13 / 211 | aliased, jagged staircase (not a fix) |
| V7 REST + antialiased (control) | 1.98 / .26 / 189 | 1.87 / .06 / 374 | 2.16 / .10 / 560 | 2.90 / .30 / 399 | 2.83 / .60 / 138 | 2.33 / .58 / 102 | lighter than V0: smoothing IS active on unstroked text |
| V8 parent `will-change: transform` | identical to V1 | identical | identical | identical | identical | identical | identical to V1 (snapshot) |
| V8 parent `translateZ(0)` | identical to V1 | identical | identical | identical | identical | identical | identical to V1 (snapshot) |
| V8 element at +0.5px (stroke) | 3.92 / .25 / 251 | 3.22 / .20 / 492 | 3.73 / .24 / 711 | 3.76 / .46 / 473 | 5.02 / .42 / 192 | 2.67 / .48 / 153 | as V1 |
| V8 element at +0.5px (rest) | 2.65 / .16 / 210 | 2.05 / .06 / 414 | 2.49 / .10 / 602 | 2.86 / .33 / 425 | 3.55 / .14 / 149 | 1.97 / .41 / 117 | slightly softer than V0 (fractional position) |

("identical" = every metric equal to the named row, and the scanlines match.) The "Start new project" primary button
was also captured. Its crop is mostly the filled button, so the metric does not apply to it, and it is left out.

Scanline proof, sidebar row "Opening", same row and columns (36 = full ink):

```
V0 rest            205  36 143 245 ... 245  63  78 245 100  99  97  46  77 199
V1 stroke 0.52px   172  38  86 234 ... 172  50  76 224 176 142 167 115 126 193
V3 stroke 0.26px   202  38 110 240 ... 206  54  92 235 202 175 202 148 158 218
V5 shadow 0.3px    173  36  90 245 ... 243  39  44 245  73  46  62  36  40 124
V5 shadow 1px      205  36  36 143 ... 244  63  41  78 100  55  54  39  38  67
V4 Futura Bold     204  36  36  59 227 245 245 229  62  36  36 199 202  86  86
```

With the stroke, the thin parts of "p" get LIGHTER than at rest (100 99 97 -> 176 142 167), so the stroked drawing
is not the smoothed one. With the 0.3 px shadow they get darker and reach full ink (73 46 62 36).

Reading the metric honestly: the 0.3 px shadow scores BELOW rest because drawing the glyph twice darkens the existing
edge pixels (left edge of "O" 205 -> 173) and fills cores. It does not add new grey columns. That makes it
"as sharp as rest, a little heavier", not "sharper than rest". The probe set the shadow directly on the text
element; the real rule will set it on the control and the text inherits it, so the first post-fix `v1-current` run is
the first test of that exact path.

Crops (all under `node_modules/.cache/personal-word-beta/blur/`):
- `runs/blur-8pxb_c9e/crops/<screen>-<control>-<variant>-snap.png` (1x crop) and `...-snap-x4.png` (4x nearest
  neighbour) for every control and variant; `sheet-snap-<screen>-<control>.png` stacks all 24 variants per control
  in table order.
- `cmp-sidebar.png`, `cmp-projects.png` (5x, top to bottom: rest, current, stroke 0.02em, shadow 0.3px, shadow
  0.5px, shadow 1px, Futura Bold); `cmp-icon.png` (toolbar icon rest vs magnified, 8x).
- `owner/*.png` and `owner/*-x6.png`: the owner's own screenshots cropped and enlarged.
- Metrics: `runs/blur-8pxb_c9e/metrics.tsv` / `metrics.json`; report `runs/blur-8pxb_c9e/report-blur-probe.json`.

## 7. Cause, and how sure

| Candidate | Verdict | Evidence |
|---|---|---|
| The stroke itself: WebKit paints stroked text as an outline path with NO font smoothing, so a fractional-width line straddles pixel edges on both sides of every stem | **CAUSE** | MEASURED: every stroke width tried (0.25 px to 1 px, 0.02em, 0.04em, paint-order) adds fringe on every control; `-webkit-font-smoothing` has no effect on stroked text (V7 antialiased = subpixel = auto, pixel-identical), while it does change unstroked text (V7 rest control); thin strokes get lighter, not darker (scanlines). The mechanism ("stroke mode bypasses CoreGraphics font smoothing") is INFERRED from those measurements, not read in WebKit source. |
| Fractional stroke width at 1x | contributes, not the root | MEASURED: 0.5 px and 1 px strokes (whole half and whole device pixel) are as soft as 0.04em. A whole-pixel stroke does not fix it. |
| Transform / scale / compositing layer | **NOT the cause** | MEASURED: V0 = V0-no-transform and V1 = V2 pixel-identical; V8 forced layers pixel-identical (snapshot path only). Wave 9's removal of the grow was harmless but irrelevant. |
| A transition caught mid-frame | NOT the cause | Only `transform` transitions, and its value does not change on hover (identity both ways). The stroke is not transitioned. |
| Font-smoothing change | NOT the cause (but see row 1) | Computed `-webkit-font-smoothing: auto` everywhere, and changing it does nothing to stroked text. |
| Why the owner sees it more than earlier checks | 1x screens | His screenshots are 1x and match our 1x captures pixel for pixel (MEASURED); that he works on a 1x external monitor is INFERRED. On a 1x screen the outline adds about a quarter pixel to each side of every edge. The wave 6-9 native screenshots of hover states were also 1240 px wide (1x), but nobody enlarged them or measured edges. 2x: section 8. |

Confidence: high that the stroke is the cause (measured on six controls, repeated on two launches, matches the
owner's own pixels). Medium on the internal WebKit reason (inferred).

## 8. 2x (Retina) check

NOT MEASURED. Both runs opened at devicePixelRatio 1: the default window also landed on an external screen. A third
build that pins the window to the Retina built-in screen (`"x":100,"y":40`) waited 25 minutes for the serial lock
and was cancelled, so the owner-fixes review batch could have the lock. Nothing was built or launched for it.
What is known: the recommended 0.3 px offset is 0.6 device pixels at 2x. At 2x the stroke is about 1 device pixel
wide, so it is probably less soft there; that is inferred and fits the fact that earlier checks did not notice.
Whether 0.3 px still reads as a clear cue at 2x is the open question. The worker's verification step 9 includes the
2x look.

## 9. RECOMMENDED FIX -- work order (Sonnet worker)

Goal: the shared text-control emphasis becomes a 0.3 px text-shadow copy instead of `-webkit-text-stroke`. One rule,
same selectors, same keyboard path, no layout shift, danger red, Reduce Motion unaffected, standalone-icon 25 percent
grow untouched (`src/components/icon-magnify.css` is not edited), toolbar dock untouched.

Files and exact edits (line numbers as of `src/styles.css` sha256 `c3d7af14...`; other agents are editing this file,
so re-read it first and anchor on the quoted text):

1. `src/styles.css` `:root`, lines 38-39, comment "Text-control emphasis (the one hover/focus rule, ...)":
   replace `--emph-stroke: 0.04em;` with `--emph-bold: 0.3px;`. `--emph-stroke` is deleted. No other file uses it
   except the tests and docs listed below. Keep `--emph-scale` and `--emph-duration` as they are.
2. `src/styles.css` the emphasised block, lines 466-471, currently
   `-webkit-text-stroke: var(--emph-stroke) currentColor;` followed by `--emph-s: var(--emph-scale);`. Replace the
   first line with `text-shadow: var(--emph-bold) 0 0 currentColor;`. Keep `--emph-s` and the selector list exactly
   as they are. `currentColor` keeps danger red and follows dark mode.
3. `src/styles.css` lines 472-475, comment "The stroke is inherited: keep typed text in a hovered label un-stroked.":
   text-shadow is inherited too. Change the declaration `-webkit-text-stroke: 0;` to `text-shadow: none;` and the
   comment to "The faux bold is inherited: keep typed text in a hovered label plain."
4. `src/styles.css` block comment at lines 401-406: replace "(-webkit-text-stroke, --emph-stroke: owner decision, no
   layout shift)" with "(a 0.3 px text-shadow copy in the text colour, --emph-bold: owner decision, no layout shift;
   never -webkit-text-stroke, which macOS WebKit paints without font smoothing and blurs on 1x screens, see
   docs/agent-work/2026-11-11-owner-fixes/BLUR-DIAGNOSIS.md)". Leave the transform/scale lines alone: they carry the
   press scale and are measured harmless.
5. `src/hoverEmphasis.test.ts`:
   - (a) line 33: the one rule sets `--emph-s` together with `/text-shadow\s*:\s*var\(--emph-bold\)\s+0\s+0\s+currentColor/`.
   - (c) lines 64-68: `emphStroke` becomes the same regex on `text-shadow: var(--emph-bold)`, still exactly one rule
     and the same rule as `--emph-s`. Add: no rule anywhere may set `-webkit-text-stroke` to anything but `0`
     (it is banned outright now). Add: no other rule sets `text-shadow` except `text-shadow: none`.
   - (d) lines 85-90: expect `--emph-bold:\s*0\.3px` and expect NO `--emph-stroke` anywhere in `ALL`. Keep the
     `--emph-scale: 1` and no `--emph-weight` checks. Rename the test title to match.
   - (e) lines 92-99: the reduced-motion blocks must not mention `text-shadow` or `--emph-bold`.
   - Fail-first: run the edited test file BEFORE the CSS change (it must fail on (a), (c) and (d)), then after.
6. `tests/hover-emphasis.spec.ts` and `tests/hover-helpers.ts`: every read of `webkitTextStrokeWidth` /
   `webkitTextStrokeColor` becomes a read of `text-shadow`. Add one helper in `tests/hover-helpers.ts` and use it in
   both files: `emph = (cs) => cs.textShadow === "none" ? 0 : parseFloat(/(-?[\d.]+)px/.exec(cs.textShadow)?.[1] ?? "0")`
   plus `emphColor = cs.textShadow.match(/rgba?\([^)]*\)/)?.[0]`. Keep the `HoverSample` field names `stroke` and
   `strokeColor` only if renaming is too wide. Otherwise rename them to `emph` / `emphColor`.
   Places: `hover-emphasis.spec.ts` 30-40 (readEmphasis), 309/316-320/331/336-341 (crawler: "no stroke" becomes
   "no faux bold"; the threshold `> 0.2` still fits 0.3), 377-383 (H2 assert: `emph > 0.2` and `emphColor === color`),
   398-404 (the crop reference sets `text-shadow: none` instead of `-webkit-text-stroke: 0`), 457-459 (checkbox
   label), 488-500 (H5: document links have `emph` 0), 540-577 (H4: Reduce Motion keeps `emph > 0.2`; the danger
   control's shadow colour must equal its red text colour, so `emphColor === color` on the danger sample).
   `hover-helpers.ts` 20-21, 125, 145.
7. Other specs that read the stroke. Their NEGATIVE checks would silently pass after the change, so each must switch
   to `text-shadow`: `tests/editor-toolbar.spec.ts:222` (`not.toHaveCSS("text-shadow", "none")`),
   `tests/motion.spec.ts:154,162`, `tests/sidebar-selection.spec.ts:519,532`, `tests/scrollspy.spec.ts:173`
   (expects none), `tests/sidebar-search.spec.ts:76` (weight + shadow unchanged), `tests/w9-projects-page.spec.ts:70`
   (expects none). Then grep `tests/` and `src/` for `TextStroke|text-stroke|emph-stroke`: the only hits left should
   be the ban in hoverEmphasis.test.ts and `tests/native-smoke.js` (the probe's variants, leave them).
8. `AGENTS.md` "Product and UI", the hover sentence: replace "a width-neutral faux bold (`-webkit-text-stroke`,
   `--emph-stroke`) and nothing else" with "a width-neutral faux bold drawn as a 0.3 px `text-shadow` copy in the
   text colour (`--emph-bold`) and nothing else; never `-webkit-text-stroke` (macOS WebKit draws it unsmoothed and
   it blurs on 1x screens)". `docs/design-system.md` line 65 (tokens) and line 119 ("Text emphasis") get the same
   change. In line 119, "it thickens the glyphs without changing their advance widths" stays true for the shadow.
9. Verification:
   - `npx vitest run src/hoverEmphasis.test.ts` (fails first, then passes); `npm test`.
   - Playwright (serial lock): `tests/hover-emphasis.spec.ts` plus the seven specs in step 7. Chromium only proves
     the computed styles and no-shift; it does not prove sharpness.
   - NATIVE CHECK (fails today, must pass after): under the serial lock, `touch src-tauri/src/lib.rs`, then the
     standard SMOKE command, built from the LIVE tree with the window pinned to a 1x external screen:
     `npm run tauri build -- --debug --features native-smoke --no-bundle --config '{"identifier":"com.folio.smoke","app":{"windows":[{"title":"Personal Word","width":1240,"height":840,"minWidth":850,"minHeight":600,"x":1000,"y":-1300}]}}'`.
     Do NOT reuse `node_modules/.cache/personal-word-beta/blur/build.sh`: it bakes a frozen copy of the 14:21
     `dist/` (no `beforeBuildCommand`), so it would test the OLD stroke rule and fail a correct fix. Check that the
     binary sha256 changed. Then
     `python3 node_modules/.cache/personal-word-beta/blur/blur-run.py` (prints the run dir) and
     `python3 node_modules/.cache/personal-word-beta/blur/blur-check.py <run dir>`.
     It compares each control at rest with the REAL rule and FAILS when the emphasised text has more than 0.5 extra
     grey-fringe pixels per glyph run, or when devicePixelRatio is not 1.
     Today's rule: FAIL on all five (sidebar row +1.82, project title +1.11, tab +1.40, toolbar menu +0.81,
     Projects row +1.41), measured on two launches. The proposed paint, scored on the same build as a probe variant
     (`blur-check.py <run dir> v5-shadow-03px`): PASS (-0.18, -0.56, -0.31, -0.31, -0.67). After the fix,
     `v1-current` IS the new rule, so the plain command must print `RESULT PASS`. Also open the
     `sheet-snap-*` / `*-x4.png` crops and look: stems must stay solid with no grey halo.
   - 2x look (not measured in this diagnosis): one more smoke build with `"x":100,"y":40` in the window config,
     which puts it on the Retina built-in screen. Confirm `dpr` 2 in the report (snapshots 2480 px wide), then run
     `analyze.py <run dir>`. It scales the crops by dpr. Compare `v0-rest`, `v1-current` (the new rule),
     `v5-shadow-05px` and `v5-shadow-1px` for the sidebar row and the Projects row. `blur-check.py` is 1x-only.
     If 0.3 px is too faint at 2x, the fallback's per-resolution token (section 10) is the answer.
   - Owner hand check (the real proof): in the rebuilt app on the external monitor, hover a sidebar row, a Projects
     row title, the project title, a tab and the toolbar zoom menu, and Tab to them. The text should look bolder and
     as sharp as at rest, and nothing beside it should move.

## 10. Fallback option

If the owner finds 0.3 px too light or still soft: use exactly one device pixel. Add `--emph-bold: 1px` at 1x and
`@media (min-resolution: 2dppx) { :root { --emph-bold: 0.5px; } }` (same single rule, one token). The copy is
then an exact pixel-shifted duplicate, so every edge keeps its rest profile (scanline `36 143` -> `36 36 143`).
Measured at 1x: noCore 0.06 (crisp cores), but ink +45 percent (about real Futura Bold's +49 percent) against +23
percent for 0.3 px and +20 percent for today's stroke. At 12-13 px small counters (e, a) start to fill. Not chosen as
the default because it is clearly heavier than what the owner approved as "no-shift bold".

Rejected: a thinner stroke (measured still soft and washed out). Real `font-weight` (Futura has only Medium and Bold.
Bold is 12-13 percent wider (measured), so it needs a hidden bold twin per control to hold width, which is not one CSS rule,
and the interface font is user-selectable and may lack a bold face). `paint-order` (still haloed).
`-webkit-font-smoothing` (no effect on stroked text).

## 11. Owner choices

1. Weight of the hover bold: 0.3 px (recommended; about as heavy as today, crisp) or one device pixel (heavier,
   close to real bold, crisp). Crops to compare: `cmp-sidebar.png` / `cmp-projects.png` rows 4 and 6.
2. Real Futura Bold is the crispest of all, but it changes text width, so neighbours would move unless every control
   gets a hidden-twin trick. He chose "no shift" before. Recommend keeping that choice.
