# PAGES-DIAGNOSIS -- UI wave 4, G1 (T171)

Agent agent-00e1, 2026-10-28 evening. Status words: CLAIMED (nothing here is owner-confirmed). Board state: Q019 answered by PLAN.md "Amendment 1" (G1 accepted on this evidence: fail-first = pages-zoom.spec in Chromium at 1.1495 + native gate pixels; pages-gap.spec is a passing guard; gap clicks keep the shipped behaviour). T171 turned in for review. No `src/` file was edited.

## Short answer

- **Item 1 (1.png, breaks lost when zoomed out): the plan's inferred cause is WRONG for the Mac app.** In WebKit the page breaks (spacers) are in the right place at every zoom (page starts within 1 px, no crossings). What is wrong is the **drawn paper**: WebKit paints the paper's `repeating-linear-gradient` (`.is-paged .editor-paper`, `src/editor/editor.css` ~line 452) with its px colour stops NOT multiplied by CSS `zoom`. The grey gap is therefore drawn every 1056 / 1088 *screen* px from the paper's top whatever the zoom, while pages are 1088 x zoom apart. Below 100 % the gap is drawn below the page's real end (page 2's first lines appear on a long "page 1" -- exactly 1.png); above 100 % (125 % and 150 %, both fit-scaled to 1.1495 in a 1240 px window) the gap is drawn about 158 px *above* the real page end, through page 1's text area.
- **Item 2 (3.png, caret in the gap): same cause, REPRODUCED natively.** No caret or empty paragraph was ever found in a page's *real* gap, in Chromium (3 seeds x 200 steps, six targeted cases) or in WebKit (100-position caret sweep + 150-step fuzz at 100 % and 75 %). But 3.png is not at 100 %: its paper is about 1354 device px = 677 CSS px wide (the 32 px grey band is 64 device px, so the shot is 2x), i.e. a fit zoom of about 0.83 (a narrow window or a split pane). At that zoom WebKit draws the first grey band 1056 screen px below the paper top, which is about three lines into page 2's real text area. The native probe squeezed the pane to 710 px (fit zoom 0.826), put the caret on the empty paragraph whose real position is page 2's text area (invariant: page 2, zone "text", 1180.65-1201.11) and snapshotted it: the caret is drawn inside the grey band, under a short line at the foot of the drawn page -- the 3.png picture (`ui4-g1/native-screens2/gap-caret-a.png`; caret screen 400.7-417.7 inside drawn band 396-428).
- **Chromium has a different, smaller zoom problem**: at the non-round fit zoom 1.1495 (toolbar 125 % / 150 % at 1240 px) page starts drift by up to 4 px by page 13 and 10 text lines cross a page end. Round zooms (50 %, 75 %) are exact. This one does match the plan's "measurement mixes zoom spaces" mechanism, but only in Chromium; WebKit at the same zoom is within 1 px.
- 150 % at 1240 px is fit-capped to the same 1.1495 as 125 %, so a true 1.25 / 1.5 zoom was not tested in either engine.
- Consequence for G2 (plan Approach item 1, "measure with zoom 1"): **it would break WebKit.** WebKit lays text out in zoomed space and its line heights change with zoom (24 px at 100 %, 26 px at 50 %, 23.49 px at 1.1495 for the same paragraph; 16 pages at 50 % vs 14 at 100 %). Measuring unzoomed would plan pages for 24 px lines while the screen shows 26 px lines. Stop rule hit: "the native probe at zoom 75 shows correct starts on the untouched tree (item 1's diagnosis is wrong: ask before G2)".

## Native WebKit numbers (Mac smoke app, WKWebView, AppleWebKit/605.1.15)

Runs (two; the second adds the 3.png repro and filters toolbar bands): `python3 node_modules/.cache/personal-word-beta/ui4-g/native-gate.py --binary g1=".../ui4-g1/bin/folio-g1" --runs 1 --out ".../ui4-g1/native-zoom-results.json"`, screen unlocked, window visible. The app was in dark mode (paper colour 32,32,35), so the PNGs look darker than 1.png; geometry is unaffected. Logs `ui4-g1/native-gate2.log` (2x display) and `ui4-g1/native-gate3.log` (1x display), reports `ui4-g1/report-pages-zoom.json`, `ui4-g1/report-pages-zoom-2.json`, snapshots `ui4-g1/native-screens/`, `ui4-g1/native-screens2/`. The `textRowsInGrey` number in the first log counts the toolbar's bands too: the pictures are the evidence, not that number. Smoke binary built 21:24 from the tree in `ui4-g1/src-state-at-smoke-build.txt` (other lanes' edits to `App.tsx`, `split.css`, `styles.css`; `editor.css` and `pagination.ts` untouched). Document: the owner's shape twice (a word, 26 empty lines, five short lines) + 90 long paragraphs.

| Toolbar zoom | paper zoom | rect/offset ratio (surface) | max start error, layout / drawn (px) | crossings | line height (empty p) | pages |
|---|---|---|---|---|---|---|
| 100 | 1 | 1 | 0 / 0 | 0 | 24 | 14 |
| 75 | 0.75 | 1 | 0 / 0 | 0 | 24 | 14 |
| 50 | 0.5 | 1 | 0 / 0 | 0 | 26 | 16 |
| 125 | 1.14951 | 0.99998 | 1 / 0.13 | 0 | 23.49 (offsetHeight 23) | 14 |
| 150 | 1.14951 (fit-capped, same as 125) | 0.99998 | 1 / 0.13 | 0 | 23.49 | 14 |

- WebKit reports `getBoundingClientRect`, `offsetTop`/`offsetHeight` and `Range.getClientRects()` all in the **same unzoomed space** (rect width / offsetWidth = 1 at every zoom; block 27 at 75 %: offsetTop 648, rectTop 648, rectHeight 24). The `ratio`/`scale`/`precise` guess in `pagination.ts measure` picks scale 1 and is consistent. (The wave-3 585 px probe already showed this: rectRatio 1, drift <= 1 at zoom 0.678.)
- Spacer heights equal their style heights (e.g. 224 / 224 / 224 at 75 %; 242.42 style, 242.41 rect at 1.1495).

Pixels (column in the paper's left margin, grey band nearest the expected gap; CSS px of the web view; expected = paper top + (k x 1088 + 1056) x zoom):

| zoom | expected gap | drawn grey band | drawn distance from paper top |
|---|---|---|---|
| 100 | 451-483 | 449.5-483 | 1056 (correct) |
| 75 | 452-476 | 715.5-747.5 | 1055.5 screen px (should be 792) |
| 50 | 451-467 (second page end, k = 1) | 435.5-467.5 | the first drawn band, 1056.5 screen px below the paper top (the first page should end at 528) |
| 1.1495 | 451.9-488.7 | 293.5-325 | 1055.5 screen px (should be 1214) |

The drawn gap is always 1056 screen px below the previous page top, i.e. the gradient stops are not zoomed. `zoom-50-top.png` reproduces 1.png: page 1 drawn as one long sheet with no gap where it ends, the next page's lines on it. `zoom-125-gap-0.png` shows the grey band drawn about 158 px above the real page end, inside page 1's text area.

Caret / gap (WebKit): caret sweep of 100 seeded positions at 100 % and 75 %: 0 outside a text area. Fuzz (Enter, Enter x5, typing, Backspace, random repositioning; 150 steps each at 100 % and 75 %): 0 settled violations. Transient: 30 (100 %) and 60 (75 %) steps showed the caret or an empty line outside a text area for exactly 1 frame before the re-plan (candidate (a) of the plan: one stale frame after Enter; not a settled state).

## Chromium numbers (Playwright, production build of the same tree)

Config `node_modules/.cache/personal-word-beta/ui4-g1/browser.config.mjs` (port 1641, dist `ui4-g1/dist`). Command:
`npx playwright test -c node_modules/.cache/personal-word-beta/ui4-g1/browser.config.mjs tests/pages-gap.spec.ts tests/pages-zoom.spec.ts` -> exit 1 (log `ui4-g1/pw-both.log`, report `ui4-g1/report-both.json`; `python3 ui4-g1/report.py ui4-g1/report-both.json` prints it).

- `pages-zoom.spec.ts`: 100, 50, 75 % pass (starts 0 px, drawn gaps exactly where expected, e.g. 75 %: expected 465-489, drawn 465-489). 125 % and 150 % (fit zoom 1.14951) **fail**: starts drift -1 at page 5, -2 at pages 6-8, up to 4 px layout / 3.8 px drawn by page 13, 10 crossings. Chromium draws the gradient correctly (pixel checks pass at every zoom).
- `pages-gap.spec.ts`: all 9 pass. Fuzz seeds 4101 (100 %), 4175 (75 %), 4125 (125 %), 200 steps each: 0 settled violations; 92 / 109 / 96 steps out of a text area in some frame before settling (transient, one stale frame). Targeted: Enter at page 1's last line -> top of page 2; 25 Enters from a half-full page; Backspace at page 2's first paragraph -> page 1; margin/gap clicks; Shift+click across a gap; paste/undo/redo: all pass.
- One false positive was found and fixed in the invariant: Backspace at the start of a paragraph after a page break selects the page-break node (NodeSelection, no caret drawn; DOM range spans the spacer). The checker now uses the selected node's box. Seed 4175 step 129 and seed 4125 steps 52/127/138 were this. Picture: `ui4-g1/report-gap3-step-129.png` (no caret visible). An invisible selection after Backspace is arguably its own small bug, not 3.png.

## Acceptance check status

`pages-gap.spec.ts` on the untouched tree does NOT fail (3 seeds). Per the plan's stop rule this goes to the owner/coordinator. The failing, fail-first evidence that exists: `pages-zoom.spec.ts` (Chromium at 1.1495) and the native gate (`zero flags: False`: WebKit gap pixels at 75, 50, 125, 150).

## Not yet proven

- That the owner's 3.png was a narrow window or split pane (zoom ~0.83 is inferred from its paper width). Owner confirmation wanted, not discovery.

## Contradiction recorded

Plan G1 step 4 says "click in the gap's upper half -> end of page 1". `tests/pages.spec.ts` asserts a click at split + 16 (gap's upper half) -> start of page 2. The targeted case keeps the existing behaviour (margin -> page 1's end, anywhere in the gap -> page 2's start).

## Files

- `tests/pages-helpers.ts` (new): shared helpers, `measurePages`, `gapCheck`/`invariantSource`, `setZoom` (paper zoom = toolbar zoom x fit scale), `pngColumn`.
- `tests/pages-zoom.spec.ts`, `tests/pages-gap.spec.ts` (new).
- `tests/native-smoke.js`: new `pages-zoom` phase (`pagesZoomProbe`); `pages-probe` byte-identical (diffed).
- `node_modules/.cache/personal-word-beta/ui4-g/native-gate.py`: copy of the wave-3 gate with `--phase`, pure-Python PNG pixel scan. Rebuild the smoke binary after editing `native-smoke.js` (`ui4-g1/smoke-build.sh`).

## Suggested direction (for the coordinator / owner; not done here)

Items 1 and 2: draw page boxes so the drawing scales with zoom in WebKit -- e.g. gradient stops in a unit WebKit zooms, `background-size` with the period, or zoom-scaled custom properties for the gradient only -- and check with the native gate pixels. Leave measurement as is for WebKit. Chromium's 1.1495 drift is a separate, small measurement fix. G2 as written (measure at zoom 1) should not proceed.

## Stop rules hit (why T171 is blocked, not done)

1. "The native probe at zoom 75 shows correct starts on the untouched tree (item 1's diagnosis is wrong: ask before G2)" -- starts 0 px at 75 and 50 in WebKit.
2. "The fuzz cannot reproduce any caret-in-gap in Chromium after 3 seeds" -- 0 settled violations; the native gate reproduces the *picture* through the drawing bug, not a layout intrusion.
3. The acceptance line ("pages-gap.spec.ts fails on the untouched dist") cannot be met: the layout invariant holds in both engines. The failing checks are `pages-zoom.spec.ts` (Chromium 1.1495) and the native gate pixels.
