# WP8 / L1 feasibility review and layout gate (team task T014)

Reviewer: agent-f459 (Claude Opus, independent; authored none of the WP8 work), 2026-10-25.
Plan: `docs/agent-work/2026-10-20-beta-roadmap/05-layout/PLAN.md` L1 (lines 30-38); team
`team/PLAN.md` Non-goals ("Layout implementation beyond WP8 is conditional on WP8 passing").
Worker report under review: `docs/agent-work/2026-10-24-team-reconciliation/wp8.md` (T013,
agent-2f7c). T013 was approved by this reviewer under the record task T039 before T014 began.

**Gate verdict: STOP (status CLAIMED).** The native WebKit print path is not accepted as a
replacement PDF engine. The legacy pdf-lib exporter stays the only public PDF route. WP9 (T015)
and WP10 (T016) are cancelled as not applicable. The owner can reopen through Q004 (see the
last section).

## 1. What I inspected

- Every T013 registered path, diffed against HEAD (tracked files) or against the byte-identical
  draft copies in `node_modules/.cache/personal-word-beta/team-t013/draft-backup/` (untracked
  files; the backup hashes match `team-t013/start-hashes.txt`).
- The draft defects the worker listed are real; I found each one in the draft files: page counts
  defaulted to 1 or `|| 2` / `|| 1` / `|| 3`; an unvalidated `Option<serde_json::Value>` snapshot
  plus a flat `html` / `page_format` IPC form that skipped the layout-version check; a substring
  CSP check; printing on navigation finish with no readiness proof; a remote-resource control that
  set `passed = true` on both branches; an unescaped `fn-${note.id}`; non-UUID fixture ids
  (`probe-letter-project`, `probe-asset-1`); `render_pdf` in the normal app's handler; the literal
  `"NSPrintJobSavingURL"` key.
- The repaired code: `src-tauri/src/printing.rs` (strict request, `store::validate`, asset-bound
  `data:` images only, host CSP before the markup, content JS off, navigation lock, readiness proved
  in an isolated content world, `NSPrintOperation` save-to-PDF with AppKit's own constants, page
  count from the PDF), `src/print/nativePdf.ts`, `src/print/printProbe.ts`, `tests/native-print.js`,
  `scripts/native-print-smoke.py`, `scripts/native-print-fixtures.mjs`.
- No export route uses the new path: `render_pdf` is registered only in the native-smoke
  `generate_handler!` (`src-tauri/src/lib.rs` line 263); a grep of `src/` finds no reference to
  `render_pdf`, `nativePdf` or `printProbe` in `src/export/*` or `ExportPanel.tsx`.

## 2. My own probe rerun and page inspection

- Identity: `result.json` of the worker's final run `20261025T070701Z-642a1146` lists the same
  SHA-256 as the current sources and the diagnostic binary `src-tauri/target/debug/folio`
  (`a15f40b3...`), so I reran without rebuilding.
- `python3 scripts/native-print-smoke.py --probe --timeout 420` (isolated `com.folio.smoke`,
  pinned Node v22.23.3) -> run `20261025T072108Z-e51b1619`:
  `PROBE_RESULT: STOP -- failing: letter:searchable-text, a4:searchable-text`. Every other
  assertion passed and all four checker controls were detected. Full log:
  `node_modules/.cache/personal-word-beta/team-t013-review/probe-rerun.log`. No Save panel
  appeared; each render took about 0.2 s.
- The pdftotext text layers of letter, a4, note-flow and hostile are byte-identical between the
  worker's run and mine.
- I viewed all 8 page images of the worker's final run (`pages/*.png`) plus a 200 dpi crop, and
  page 1 of my rerun:
  - Latin, Greek, Cyrillic, Hebrew (with pointing), Devanagari, Chinese, Japanese and Korean all
    render correctly.
  - Arabic is joined, with the lam-alef ligature drawn correctly.
  - The mixed-direction line follows the Unicode bidi order.
  - Header and footer bands appear on every Letter/A4 page ("Sheet n of N").
  - The table (Hebrew/Arabic/Devanagari rows) and the colour swatch image with its caption render.
  - The 120-sentence note flows from page 1 to page 2 (PWS068 to PWS069) with no gap or
    repeated line.
  - The hostile page shows only inert WebKit chrome: the "Blocked Plug-in" pill, an empty iframe
    box, a link and a form button.

## 3. The Arabic finding, and why it is the stop condition

What fails: words that contain the mandatory lam-alef ligature (for example السلام) cannot be
found by search in the printed PDF. I checked this myself:
- PDFKit `findString` (the engine behind Preview's search) finds 0 hits for السلام عليكم, السلام,
  عليكم and لا in both the letter and the A4 PDF. Hebrew, Greek and the note marker are found.
- pdftotext gives presentation forms in the Letter PDF (Times New Roman fallback: U+FEFC for
  lam-alef, U+FBFF Farsi yeh for yeh). In the A4 PDF (SF Arabic) the word comes out lossy, with a
  stray `#`.

Fonts tried (28 in all, every Arabic-capable family `fc-list :lang=ar` reports plus the fallbacks):
- By the worker (`team-t013/font-experiment-1.log`): Geeza Pro, SF Arabic, Al Nile, Baghdad,
  Damascus, Times New Roman, Arial, and Noto Naskh Arabic (not installed, so it fell back).
- By me (`team-t013-review/font-untried.log`; one isolated launch through `render_pdf` with
  lockdown on, one font per page, PDFKit search run per page):
  - Fail the same way (lam-alef becomes `'`, or comes out as presentation forms/Farsi yeh, or as
    garbage): Al Bayan, Arial Unicode MS, Courier New, Tahoma, Microsoft Sans Serif,
    KufiStandardGK, Nadeem, Beirut, Al Tarikh, Sana, Farisi, Farah, Muna, Mishafi, Mishafi Gold,
    DecoType Naskh, Waseem, Noto Nastaliq Urdu. Geeza Pro with ligature features switched off
    also fails, so CSS cannot avoid the problem.
  - Searchable السلام: **Diwan Kufi** and **Diwan Thuluth**, two decorative calligraphic display
    faces. Diwan Thuluth also loses the space between the words ("السلامعليكم").

Correction to the worker's wording: wp8.md says WebKit "cannot produce searchable Arabic", and
the IMPLEMENTATION_LOG says this was true with "every installed Arabic font tried (8)". Both
overstate it. The accurate statement is: **whether the lam-alef survives in WebKit's PDF text
layer depends on the font. Every body-text Arabic font installed here loses it (26 of 28 tried);
two display fonts keep it.**

Why it is still the L1 stop condition: the plan stops if native print "cannot satisfy pagination
/ searchable shaping without unsafe privileges". Searchable shaping fails with every font fit to
set a document body on this Mac, including the system default (SF Arabic) and the app's own
fallbacks. Writing body text in Kufi or Thuluth calligraphy is no fix. Lam-alef appears in most
Arabic sentences, so Arabic documents would not be searchable. It cannot be fixed without
installing a font; whether a bundled OFL Arabic font would work is unknown, and bundling one needs
the owner's separate approval (plan "Rules in force").

## 4. Negative controls verified

- Rust fail-first, re-executed: I made a doctored copy of `src-tauri/` in
  `node_modules/.cache/personal-word-beta/team-t013-review/doctored/`. In it, the asset-id
  binding, the font-face readiness check and the CSP-before-markup order were disabled.
  `cargo test --locked --offline --jobs 1 --lib printing -- --test-threads=1` gave exactly
  `host_csp_precedes_supplied_markup`, `image_sources_must_be_this_snapshots_assets` and
  `readiness_requires_loaded_fonts_and_decoded_images` FAILED (3 failed / 3 passed), matching
  `team-t013/rust-failfirst-doctored.log`. On the current tree, 6/6 pass. The real `printing.rs`
  (`0ac9a4d6...`) and the binary (`a15f40b3...`) were unchanged afterwards.
- `npx tsc --noEmit -p .` exit 0; `npx vitest run src/print` 6/6
  (`team-t013-review/tsc-vitest.log`).
- Checker controls on my rerun, each detected by its target assertion:
  - one-tall-page -> page-count
  - missing-font-readiness -> readiness
  - raster-only -> searchable-text. Its pages have no text at all (0 characters), so this
    detection does not depend on the Arabic failure.
  - external-resource -> zero-external-loads. Launch B with the lockdown off made 8 loopback
    requests.
- Native fail-closed checks:
  - The readiness control was refused ("font face PW Broken Font is error").
  - All 7 boundary fixtures were refused: layout version, paper, margins, invalid snapshot,
    unapproved image, remote image, oversize markup.
- Lockdown on the hostile fixture: 0 loopback requests and 0 resource entries; 6 CSP violations
  were recorded; navigations were cancelled (iframe `about:blank` and `meta-refresh`); the inline
  page script did not run.
- The one expectation T013 changed after seeing output (hostile-fixture images set to "not gated",
  because WebKit's blocked-plug-in chrome is drawn as images) is accepted: the lockdown assertions
  above are unchanged and pass.

## 5. Boundaries (what this does not prove)

- Only macOS 15.7.9 on Intel x86_64, and only with this Mac's installed fonts.
- `inactiveSchedulingPolicy` needs macOS 14 or later.
- No normal (non-smoke) app build was made. The command is not compiled into the normal app's
  handler.
- file:// lockdown evidence is indirect: an opaque `about:blank` origin and zero resource entries.
- A hostile `<a href>` becomes a live PDF link annotation (worker finding F6). Today only a
  markup-builder bug could emit one.
- Preview/save byte identity, font policy (L2) and per-page footnote allocation (L3) were never
  started.
- No owner real-use test. Everything here is CLAIMED, not VERIFIED.

## 6. Verdict and what follows

- **STOP.** Q004 (agent-2f7c's owner question with options A/B/C) is still open on the board. The
  plan's "default if unanswered" applies: retain the legacy PDF exporter, label the native path
  experimental/unavailable (it is reachable only in the native-smoke diagnostic build), do not
  remove script/long-note warnings and do not claim parity.
- WP9 (T015) and WP10 (T016) are cancelled by `decide` ("WP9/WP10 cancelled: WP8 feasibility
  STOP"). T015 depends on T014 and T016 depends on T015, so neither can be claimed until T014 is
  approved. After T014 is approved, the next agent runs, in order:
  1. `claim T015`
  2. `done T015 --note "not needed: WP8 STOP per feasibility.md; legacy exporter retained; reopen only on Q004 A/C with a reviewed PASS"`
  3. another agent approves T015
  4. the same steps for T016

  Nothing in `src/print/*` beyond the L1 probe may be implemented.
- **Gate C (T017)** must review the preserved legacy behaviour:
  - `src/export/pdf.ts` is unchanged vs HEAD (`ffef585b...`).
  - Script/long-note refusals are still in place.
  - No public route reaches `render_pdf`.
  - WP9/WP10 non-applicability is documented.
- **WP11 (T018)** should know:
  - `src-tauri/src/smoke.rs` carries T013's native-print arm alongside the WP11 checkpoint drift.
  - `printing.rs` is compiled into normal builds as dead code (`allow(dead_code)`).
  - `tempfile` is now a normal dependency.
  - The print probe writes into `node_modules/.cache/personal-word-beta/print-smoke/runs/`.
- **How to reopen:**
  - The owner answers Q004 with **A** (accept "Arabic displays correctly but is not searchable"
    as a documented limitation) or **C** (approve a bundled OFL Arabic font; given the result
    above, it may work, depending on the font).
  - Then a new reviewed probe run must show `PROBE_RESULT: PASS`, or, under A, the accepted
    limitation recorded in the gate. Only after that may T015/T016 be reopened as new tasks.
