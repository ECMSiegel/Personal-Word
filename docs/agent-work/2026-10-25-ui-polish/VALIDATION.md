# UI polish final validation (T082)

Date: 2026-10-26. Run by agent-b0c5 on the final tree (after T071-T096), pinned Node v22.23.3, serial slot held throughout, no code changed, nothing committed.

**Status: CLAIMED.** Everything below is an automated or viewed check. Nothing is VERIFIED; only the owner's real use in the Mac app does that (see the hand-check sheet).

Logs and artifacts live in `node_modules/.cache/personal-word-beta/ui-final/` (called `LOGS/` below).

## Results, plan Validation steps 1-8

| Step | Check | Result | Exit | Log |
|---|---|---|---|---|
| 1 | `node --version`; `npx tsc --noEmit -p .` | v22.23.3; no errors | 0 | `LOGS/step1-tsc.log` |
| 2 | `npm test -- --no-file-parallelism --maxWorkers=1` | 51 files, **899 passed**, 0 failed (872 before + 27 from designTokens, appearance, palette, dropImport) | 0 | `LOGS/step2-vitest.log` |
| 3 | `npm run build` | built in 7.76 s (chunk-size warning only, as before) | 0 | `LOGS/step3-build.log` |
| 4 | Playwright, whole `tests/` folder, production preview, 1 worker, no retries, port 1550 | **166 passed**, 0 failed, 0 skipped, 0 flaky, 4.5 min | 0 | `LOGS/step4-playwright.log`, `LOGS/browser-report.json` |
| 5 | `cargo test --locked --offline --manifest-path src-tauri/Cargo.toml --jobs 1 -- --test-threads=1` | **55 passed, 0 failed, 1 ignored** | 0 | `LOGS/step5-cargo.log` |
| 6a | Smoke rebuild `npm run tauri build -- --debug --features native-smoke --no-bundle --config '{"identifier":"com.folio.smoke"}'` | built `src-tauri/target/debug/folio` (sha256 `62ed849b0416250adb99ac29758dc6e4a7138732b155e289854a276f75957afe`) | 0 | `LOGS/step6-smoke-build.log` |
| 6b | `python3 scripts/native-reliability.py --suite baseline` | run `20261026T060417Z-1233af68`: status passed; **13 scenarios passed + 5 controls detected** | 0 | `LOGS/step6-baseline.log` |
| 6c | `python3 scripts/native-reliability.py --suite beta` | run `20261026T060516Z-9d1bb0f0`: status passed; **19 scenarios passed + 42 controls detected** | 0 | `LOGS/step6-beta.log` |
| 7 | `python3 scripts/native-screens.py --out LOGS/native-plain` and `--out LOGS/native-color --palette color` | 8 + 8 = **16 PNGs**, all viewed (list below) | 0, 0 | `LOGS/step7-plain.log`, `LOGS/step7-color.log` |
| 8 | `npm run tauri build` (normal app) + marker scan | app built, zero smoke markers (below) | 0 | `LOGS/step8-app-build.log`, `LOGS/step8-scan.log` |

Step 4 command (exact): `NOTICE_SHOTS=<LOGS>/notice-shots npx playwright test --config node_modules/.cache/personal-word-beta/ui-final/browser.config.mjs`. The config (`LOGS/browser.config.mjs`) serves `./dist` with `npm run preview -- --outDir "./dist" --host 127.0.0.1 --port 1550 --strictPort`, `testDir` = the real `tests/` folder, `workers: 1`, `retries: 0`. `./dist` was the build from step 3 minutes earlier (so `markdown-roundtrip.spec.ts` read the same build). The plan's named specs (`appearance`, `projects-screen`, `research`, `import`, `import-cancel`, `rich-import`, `markdown-roundtrip`, `notice`, `layout`, `accessibility`, `editor-toolbar`, `features`, `sidebar-selection`, `research-library`, `zotero`) are all in the 166.

No step needed a rerun and none failed. Step 6b/6c passed on the first run (no close-retry flake). Both native-screens runs print `cleanup: killpg refused (Errno 1 Operation not permitted); continuing`; it is a cleanup warning inside the tool, exit stayed 0 and the captures were written.

Not proven by any of this: the Finder drag path, `read_dropped_file` with a real dropped file, the Mac title bar following the app theme, Cmd+Shift+L in the Mac app, reduced-motion in the Mac app, and sidebar drag-reorder by hand. Browser localStorage tests prove nothing about native storage.

## Step 7: the 16 native PNGs (viewed one by one)

All 1240x840 (1x), from the `com.folio.smoke` build, fixture project "Screens fixture". The create panel, search and drop highlight are not captured (known limit of the tool). Folder `LOGS/native-plain/` (Plain) and `LOGS/native-color/` (Color).

Plain:
1. `native-plain/projects-light.png` -- empty Projects screen, white; blue "Start new project" button with chevron; search, Sort "Last edited", direction and view icons on the right; "No projects yet."; no stray captions.
2. `native-plain/projects-dark.png` -- same layout on dark grey; the primary button is the light blue (Plain dark), white text on it is the known low-contrast item (T087, recorded only).
3. `native-plain/writing-light.png` -- "Screens fixture / Opening", toolbar visible, two plain paragraphs, "Saved", 16 words; Manuscript is blue and semibold in the sidebar, selected entry is blue semibold.
4. `native-plain/writing-dark.png` -- same on dark; text and selected blue readable; "Saved"; a slightly different band is visible under the last 28 px of the window (outside the page area), not seen in light.
5. `native-plain/research-light.png` -- Research panel open at right, Sources/Notes tabs, one source form ("A synthetic source", Book) with labeled fields, no helper captions; Research is blue in the sidebar; "Saved".
6. `native-plain/research-dark.png` -- same on dark; header shows "Saving..." (captured mid-save, a timing artifact, not a defect).
7. `native-plain/settings-light.png` -- Project settings, General block shows Appearance (System / **Light** / Dark) and Palette (**Plain** / Color) segmented rows, no captions; Settings blue in the sidebar.
8. `native-plain/settings-dark.png` -- same on dark with Dark selected and Plain selected, blue selections.

Color (`--palette color`; the Palette row shows Color selected, confirming the flag applied):
9. `native-color/projects-light.png` -- same empty Projects layout; the button is a slightly brighter blue than Plain light.
10. `native-color/projects-dark.png` -- the button is a saturated blue with white text (higher contrast than Plain dark).
11. `native-color/writing-light.png` -- sidebar icons coloured per feature (blue Manuscript, green Fragments, brown/orange Research); green "Saved" check.
12. `native-color/writing-dark.png` -- brighter feature colours (blue, green, orange) on dark; green "Saved".
13. `native-color/research-light.png` -- Research label and icon in dark orange (selected), Manuscript/Fragments icons coloured; panel as in Plain.
14. `native-color/research-dark.png` -- Research label orange and bold, tab and links light blue, "Saved".
15. `native-color/settings-light.png` -- Palette row shows **Color** selected (blue), Appearance Light; coloured sidebar icons.
16. `native-color/settings-dark.png` -- Palette **Color** and Dark selected in blue; everything readable.

## Step 8: normal app

- Path: `/Users/ethansiegel/Local Projects/VC Projects/Project 13 - Word Processor/src-tauri/target/release/bundle/macos/Personal Word.app` (15.54 MiB)
- `Info.plist`: `CFBundleIdentifier` = `com.folio.writing`, version 0.1.1 (short and build), executable `folio`.
- sha256 of `Contents/MacOS/folio`: `af849a85582797ab1440acfd8cddf6af79fa1c979e42e3b7b4f6d587778052f4`.
- Marker scan (`grep -c -a` on the binary):

| Marker | Normal app | Smoke debug binary (proves the scan works) |
|---|---|---|
| `smoke_snapshot` | 0 | 10 |
| `native-screens` | 0 | 2 |
| `com.folio.smoke` | 0 | 8 |
| `FOLIO_SMOKE` | 0 | 12 |
| `read_dropped_file` (allowed) | 2 | 5 |

Zero hits for the four smoke markers in the normal app.

## README screenshots (plan task T11 follow-up)

Regenerated `docs/evidence/readme/{projects-light,research-light,writing-light,writing-dark}.png`, all 2880x1800 (Playwright deviceScaleFactor 2 at 1440x900), from the production preview of `./dist` (port 1550), Plain palette, spec `LOGS/readme-capture.spec.mjs` with config `LOGS/readme.config.mjs`, run log `LOGS/readme-capture.log`. Sample: "Lighthouse Ledgers" (Chicago student paper template: Title page, Introduction, Main text, Conclusion; Introduction holds three paragraphs about lighthouse keepers' logs and one footnote citing Marguerite Halloway, "Lamps and Ledgers: Keeping the Coastal Lights", Harbor Street Press, 2019) and "Field notes". All four were viewed: no fixture names, no dialogs. writing-* show "Saved" (not "Unsaved edits"). Limit: the footnote marker 1 shows in the text, but the footnote text sits at the bottom of the page below the visible area. The tab strip lists both open projects; the Projects screen shows the browser-preview footer line "Browser preview -- writing is stored in this browser only." because these are browser captures.

## OWNER HAND-CHECK sheet (Personal Word.app, new build above)

Run these in the new app, then write the result. Agents may not fill these in.

1. Settings > General > Appearance: click Dark, Light, System. Each applies at once. Quit and reopen: the last choice is still set. Result: ____
2. Settings > General > Palette: click Color, then Plain. Each applies at once and survives quit and reopen. Result: ____
3. Press Cmd+Shift+L on the Projects screen and in a project: it flips Light and Dark. Result: ____
4. Title bar: with the app set to Dark while macOS is Light (and the reverse), does the title bar match the app? Result: ____
5. Projects screen: click the magnifier, type part of a project title: the list filters; Escape closes it. Result: ____
6. Click the magnifier again while the search is open: note what happens (expected: it closes or keeps focus, no error). Result: ____
7. Click "Start new project": the panel opens with the templates, "Import a file..." and "Recover from a project.json file...". Each item works (import preview opens; recover opens its file picker). Result: ____
8. System Settings > Accessibility > Display > Reduce motion on: the Start new project panel opens instantly with no animation. Result: ____
9. Drag one `.md` file from Finder onto the Projects screen: the screen highlights, then "Import writing" preview opens; click Cancel: no project is created. Result: ____
10. Drag a `.pdf` onto the Projects screen: a clear error, nothing imported. Result: ____
11. Drag two files at once: a clear error, nothing imported. Result: ____
12. Writing screen: drag a section in the sidebar to a new position: reorder works as it did before this work. Result: ____
13. Anything that looks wrong or different from the screenshots above: ____

## Evidence status

CLAIMED for every item. Owner confirmation of the sheet above is what would move any of it to VERIFIED.
