# Owner fixes (T284-T291) -- native run

Runner: agent-ad52 (Claude Opus), 2026-11-11 18:37-20:00 EST, on the owner's go for scripted native runs.
Status of everything here: CLAIMED, not VERIFIED. "Native" means the real macOS WebKit app built in its `com.folio.smoke`
debug form, with a throwaway data folder and a throwaway WebKit store for every launch. The owner's real projects were never
opened. The release app was built but not launched. Clicks and keys are synthetic events sent by script, not a real mouse,
keyboard or trackpad. No product code and no existing test was changed. Pinned Node 22.23.3. One serial lock was held for the
whole run and released at the end.

Logs: `notes/NAT-*.log`, step times in `notes/NAT-summary.txt`. Probe scripts (new, measure only) are in
`node_modules/.cache/personal-word-beta/of-n/`.

## What was built

| Build | What | Binary sha256 (`src-tauri/target/debug/folio`) | Log |
|---|---|---|---|
| A | standard smoke build from the live tree (`touch src-tauri/src/lib.rs`, then `npm run tauri build -- --debug --features native-smoke --no-bundle --config '{"identifier":"com.folio.smoke"}'`). Replaces the stale 16:18 binary `0cb11a0f...` | `e9b9ae8d2272cfcb8beb33e7b1a43edce4b2fe3d83ee15cff1c2d2c3c5ca7672` | `NAT-buildA.log` |
| B / B2 | Same, but its frontend is a COPY of build A's `dist/` with one extra script tag (`of-n/dist-B`, `of-probe.js`). That script turns both rulers on in the fresh store and runs the new `of/rulers` and `of/sanity` probes. B2 = B with the probe fixed (see "Probe mistake" below) | B `77e7482e...`, B2 `299226b1...` | `NAT-buildB.log`, `NAT-buildB2.log` |
| C | Live tree, window pinned to the built-in Retina screen (`"x":100,"y":40`), for the 2x blur look | `09ef606e...` | `NAT-buildC.log` |
| Release | `touch src-tauri/src/lib.rs`, `npm run tauri build` | see "Release app" | `NAT-release.log` |

The debug binary left on disk is B2 (it includes the probe script tag). Rebuild with build A's command before the next
native run that should use the plain live frontend.

## Standard suites (build A)

| Suite | Result | Earlier run (wave 9) |
|---|---|---|
| `scripts/native-smoke.py` | First run FAILED in phase 3 ("Timed out: journal recovery after deliberate process termination": after the harness kills the app, the last typed sentence was not recovered). Two reruns straight after: PASS, PASS (all 3 phases). Journal and storage code (`src/storage.ts`, `src/save-queue.ts`) is unchanged since HEAD, and `src/App.tsx` changes touch only the footnote-delete flush. Verdict: a new intermittent, 1 of 3, cause not investigated (likely the kill landing before WebKit writes local storage to disk). Logs `NAT-smoke.log`, `NAT-smoke-rerun1.log`, `NAT-smoke-rerun2.log` | PASS |
| `native-reliability.py --suite baseline` | PASS: 18 scenarios, 13 passed + 5 negative controls detected | identical when counted the same way (the earlier write-up said "14 + 5") |
| `native-reliability.py --suite beta` | PASS: 61 scenarios, 19 passed + 42 controls detected | identical (earlier write-up "20 + 42") |
| `native-screens.py` Plain and Color | 31/31 light and 31/31 dark in both | 31/31 |

Screenshots (`of-n/screens-plain`, `of-n/screens-color`) were spot-checked: the continuous-view ruler shows grey bands
outside both margins; Settings shows one line under the section strip and "Add font..." on the Interface font row.

## Batch probes

| # | Probe | Result | Numbers | Evidence |
|---|---|---|---|---|
| a | Blur (T291) at 1x, `blur-run.py` + `blur-check.py` on build A | **PASS** (RESULT PASS, dpr 1) | fringe per glyph run, rest -> real rule: sidebar row 2.00 -> 1.91 (-0.09), project title 2.62 -> 2.13 (-0.49), tab 3.26 -> 3.37 (+0.11), toolbar menu 2.00 -> 1.70 (-0.30), Projects row 2.17 -> 2.10 (-0.07); limit +0.5. Under the old stroke rule these were +0.81 to +1.82. Computed style on every focused control: `text-shadow: <text colour> 0.3px 0 0`, stroke 0. The 4x crops show bolder letters with clean edges. Run in dark appearance | `NAT-blur1x*.log`, `blur/runs/blur-1zozckhl/crops/` |
| a | Blur at 2x (build C, Retina built-in, dpr 2) | **measured, no pass/fail limit exists** | The real rule is pixel-identical to the 0.3 px probe variant. Fringe rest -> rule: sidebar 1.83 -> 1.91, project title 1.91 -> 1.88, tab 3.70 -> 3.96, toolbar menu 2.12 -> 1.96, Projects row 2.08 -> 1.91 (no new halo). Ink (heaviness) vs rest: +14 %, +10 %, +10 %, +18 %, +15 %. For comparison 0.5 px gives +21/+13/+15/+24/+20 %; real Futura Bold on the sidebar row +53 %. So at 2x the cue is lighter than at 1x but present. Whether it reads as "bold enough" on the Retina screen is for the owner's eyes | `NAT-blur2x-metrics.log` (computed by `of-n/blur2x-metrics.py`, same crop rule as `analyze.py` scaled by dpr), crops in `blur/runs/blur-p324xzbb/crops/` |
| b | S4 table right-click menu (T290) | **PASS** at 100/125/150 % (true zoom 1/1.25/1.5) | Menu opened at all three. ProseMirror's own posAtCoords still answers "outside the cell" at 125/150, so the new cell fallback is what makes it work. With rulers on (build B): same | `NAT-zoomA.log`, `NAT-zoomB-rulers.log` |
| b | S6 click under page 1's last line (T290) | **PASS** at 100/125/150 %, gap mid-window and gap low | Caret stays on page 1 (block 34) in all 6 cases. At 150 % with the gap low, the old arithmetic gives 150.4 against a split of 107.1 (page 2, as measured in r2); the drawn-consistent value is 5.3, so it now stays on page 1. Same with rulers on | same |
| c | Blank-page click matrix (24 cases) | **PASS** 24/24 rulers off (build A), 24/24 rulers on (build B) | zooms 1, 1.25, 1.5 (sidebar hidden) and 1, 1.18, 1.18 (sidebar shown). That the strip existed in the build B run is inferred: it uses the same loader that the rulers probe showed creating the strip in a fresh store | `NAT-blankA.log`, `NAT-blankB-rulers.log` |
| c | Click on the ruler strip, page view, rulers on | **PASS** at 100/125/150 %, scrolled (1500) and at rest | Hit `div.ruler-strip`; caret stays at 30 and the scroll position stays put; mousedown prevented; no text selected in the ruler | `NAT-of-rulers2.log` |
| d | Top ruler pinned while scrolled (T286) | **PASS** 100/125/150 % | strip top minus scroller top 0 px; strip height 24 px (100 %); topmost element at the ruler centre is the ruler | same |
| d | Never over a sheet at rest | **PASS** 100/125/150 % | strip bottom minus first sheet top 0.0 px; no overlap between the top ruler, the 4 side rulers or the strip and any sheet. Calibration with `elementFromPoint` hit the ruler and the paper where expected | same |
| d | Ticks, margin markers and grey bands align with the sheet, in drawn px | **PASS** 100/125/150 % | ruler edges vs sheet edges 0.0 px; all 9 inch ticks 0.0 px off; both marker centres 0.0 px off the margins; band edges and widths 0.0 px off; band colour rgb(64, 64, 70) at opacity 0.5 (dark appearance). (WebKit's unzoomed rects were multiplied by each element's own zoom: ruler 1/1.25/1.5, paper the same) | same |
| d | Two toggles independent | **PASS** | Ruler off + Side ruler on: no strip, 4 side rulers. Both off: nothing. Ruler on + Side off: strip, 0 side rulers. Both on: both | same |
| d | Caret after ArrowUp onto a page's first line, which was hidden under the strip | **PASS** 100/125/150 %, both paths (a key followed by a late selection change, and an immediate scroll-into-view) | line hidden before; after: line top clears the strip bottom by 4.5 / 3.1 / 3.8 px | same |
| d | Floating sidebar title and pin not covered by the strip | **PASS** (floats at 100 % in the 1240 px window) | `.project-switch` and `.sidebar-pin` topmost at their centres and inside the strip band, scrollTop 0 and 1500 | same |
| e | Fragment title band under the floating sidebar (T285) | **PASS** | Background behind the title row rgb(40, 40, 44) for both section and fragment; title at x 12, y 130 in both | same |
| e | Text-only note delete (T284), section open | **PASS** | Dialog "Delete this text-only footnote? It is in "Opening" ... A safety snapshot is kept first ..."; Cancel left 2 notes and 2 markers; confirm left 1 row ("Note B"), 1 marker labelled "Edit footnote 1"; Snapshots & history lists "Before deleting a footnote". The case where the note's section is NOT open was not run | `NAT-of-sanity.log` |
| e | Recent fonts (T289) | **PASS** | After applying Georgia then Arial: menu rows "#Recent", Arial, Georgia, divider, Futura, ... | same |
| e | Projects Sort position (T287) | **PASS** | Sort centre y 171.5 = Start new project centre y 171.5; no caption row; order Start, Import, Search, Sort, Reverse, View, Settings | same |
| e | Settings Add font row (T288) | **PASS** | Add font centre y 416.5 = Interface font menu 416.5, to its right; 1 file input, 0 visible; after adding Georgia through the hidden input, Remove is rgb(255, 149, 141) = the danger colour at rest and on keyboard focus | same |

Not run: hover over Remove (no real pointer); the not-open-section delete case; reload persistence of the
toggles and of Recent; a physical drag of any ruler marker.

### Probe mistake, found and fixed (not a product finding)
The first `of/rulers` run reported the caret check as FAIL at every zoom (line 4.5-32 px under the strip). Cause: the probe
never focused the editor, and ProseMirror only scrolls to the caret when the page's text selection is inside the editor
(`prosemirror-view` `scrollToSelection`). The probe now focuses the editor first and records `focusOk`. The rerun (B2)
passes. The same first run also stopped at the fragment step because it used an editor handle that went stale after visiting Settings; fixed the same way.
First-run log kept as `NAT-of-rulers.log`; the result above is `NAT-of-rulers2.log`.

### Other notes
- `blur-check.py` on the 2x run prints FAIL only because it refuses dpr 2 by design (and its crops are not scaled
  for 2x); `NAT-blur2x-check.log` is not a result. The full `analyze.py` pass on the 2x run was stopped by me after 47
  minutes (it had written the crops; the slow part was matching screen captures). The numbers above come from
  `of-n/blur2x-metrics.py`.
- `screencapture` captures still fail (no Screen Recording permission), as in the diagnosis: everything is from WebKit's own
  snapshot.

## Release app

`touch src-tauri/src/lib.rs`, `npm run tauri build`, 19:54-19:56, exit 0 (fresh `dist/` from the live tree; no probe
script in it or in the binary).
- Path: `src-tauri/target/release/bundle/macos/Personal Word.app` (15.65 MiB)
- Binary `Contents/MacOS/folio` built 2026-11-11 19:56:30 EST
- sha256 `18d3e20aab900dbc5b27d7e92e0339659a968388f310abcff9377d477b4d743f` (supersedes `2586aeee...` of 14:23)
- Not launched (rule).

## What only the owner can still confirm (real hands and eyes)

1. Hover sharpness by eye on the external 1x monitor AND on the Retina screen: sidebar row, Projects row title, project
   title, a tab, the zoom menu; hover and Tab. Bolder, as sharp as at rest, nothing moves. At 2x the cue is lighter
   (about +10-18 % ink). If too light there, the fallback is in BLUR-DIAGNOSIS.md section 10.
2. A real right-click in a table cell at 125/150 %, and a real click just under a page's last line at 150 % with the
   gap low in the window.
3. Real ArrowUp/ArrowDown keys at 100/125/150 % with the ruler on: the caret never sits under the strip.
4. Physical drag of the top ruler's margin markers at 100/150 %, and scrolling with a trackpad while the strip stays pinned.
5. A real mouse click on the grey strip (scripted clicks pass).
6. Text-only note delete when the note's section is not open, then reload; Escape on the dialog.
7. Add font through the real file picker in both Settings places; Remove red on mouse hover.
8. Recent fonts and the ruler toggles surviving a relaunch.
9. Typing after a blank-page click at 150 % (the original symptom).
10. First launch of the new release app on his real storage.
11. Whether the native-smoke journal-recovery miss (1 in 3) shows up again (an engineer task, not a hand check).
