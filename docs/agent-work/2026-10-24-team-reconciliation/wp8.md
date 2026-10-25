# WP8 / L1 -- native print feasibility probe (team task T013)

Agent: agent-2f7c (Claude Opus worker), 2026-10-25. Plan: `docs/agent-work/2026-10-20-beta-roadmap/05-layout/PLAN.md`
L1 (lines 30-38); DELEGATION.md WP8.

**Verdict: STOP (status CLAIMED).** The real WKWebView `NSPrintOperation` save-to-PDF path works
on this Mac for pagination, page boxes, explicit breaks, header/footer geometry, a flowing long
note, tables, images, font/image readiness, and lockdown (zero external loads), and most scripts
are searchable. It **cannot produce searchable Arabic**: the mandatory lam-alef ligature (any لا
sequence, common in Arabic text, e.g. السلام, لا, إلا; tested on السلام) extracts as `'`, and the
tested word with it is not found by PDFKit
(Preview's search engine) or pdftotext, with any of 8 installed Arabic fonts. That is the plan's
stop condition ("native print cannot satisfy ... searchable shaping"). Legacy pdf-lib export stays
the only public PDF path; nothing was switched. Owner decision needed before WP9/WP10 (section 8).

## 1. What I inherited (untrusted off-board draft)

Written 2026-10-24 19:01-19:26 EDT by an orchestrator outside the board; adopted by T013 per the
DECISIONS entry "Off-board WP8/WP11 files adopted by their board tasks". Start hashes (all
unchanged from the coordinator's description when I began, 2026-10-25 01:29 EDT):

| Path | Lines | SHA-256 at start |
|---|---|---|
| src-tauri/src/printing.rs | 413 | 86424223b9e584984410a1a6bb2cb25cf989e2d2e46cc1fc7707a3a04290ab2e |
| src/print/nativePdf.ts | 446 | 1718ff8a3ec794ed9d0755e4175cc9aa7a2f96ccbde56514180a767adae137e4 |
| src/print/printProbe.ts | 555 | 8620f158222396c047cc5fdf15730e8e97a238603d945c4afb91af0412360712 |
| tests/native-print.js | 426 | cf3ff67f713cd527f26e5102e185139021f985572f2208d0ff560d75f0f5d6b3 |
| scripts/native-print-smoke.py | 402 | 7dc8ec9c3b1c6b846a5752386066440b22c02865b4977fa3ceb019c850da7f40 |
| src-tauri/src/lib.rs | 343 | 8ad94633cb0edee0db0545a0c7dce5e50e40e558b37f4cfb437858efdffa8df0 |
| src-tauri/src/smoke.rs | 422 | e4cd7f77d3e5cceb48b9298b79162740496e5f492584e8be18928e234e0c7a5b |
| src-tauri/Cargo.toml | 57 | 218b47ba9a2cb0ad8e3f4f590b19ff841bd77a216579ac4c0a53e10bac057602 |
| src-tauri/Cargo.lock | 4808 | e877f71bf1d2c699b3fd50b0a72cee7d085d81b25b1f4e9bef427fc11ff0670c |
| src-tauri/capabilities/default.json | 6 | df445a89455eb1be3c72a4585a9e24be8f64151b6d5d36329252089530e4a51a (untouched) |

Byte-identical copies of every draft file are kept in
`node_modules/.cache/personal-word-beta/team-t013/draft-backup/` (same SHA-256 as above). Honest
note: I overwrote `printing.rs` before copying it; I rebuilt the backup copy from my full read of
the file made minutes earlier, and its SHA-256 matches the start hash exactly (86424223...), so
the draft is preserved byte for byte.

### Draft defects found (each one fixed; fail-first evidence in section 4)
1. No real page count anywhere. `render_pdf` returned bare bytes; `renderNativePdf` defaulted
   `pageCount = 1`; `native-print.js` reported `pageCount || 2`, `|| 1`, `|| 3`. Every page-count
   "result" was a hard-coded fallback.
2. The snapshot was `Option<serde_json::Value>` and never validated; a flat
   `html/page_format/margins_pt` IPC form bypassed even the layout-version check. No asset binding.
3. The CSP gate was a substring match (`Content-Security-Policy` and `default-src 'none'`
   anywhere in the text, prose included). The CSP was the caller's, not the host's.
4. No font or image readiness: it printed on `didFinishNavigation`.
5. `native-print.js` security controls were vacuous: the script-isolation check read
   `window.__SMOKE_EVIL_EXECUTED__` in the smoke app's own window (a different JS context from the
   print view), and the remote-resource control set `passed = true` on both success and failure.
6. Probe markup was hand-written HTML in `native-print.js`, not schema-generated
   (`buildPrintHtml`/`printProbe.ts` were never executed by anything; `runPrintProbe` asserted
   against the fabricated page count).
7. Escaping hole: `id="fn-${note.id}"` put an imported note id into markup unescaped (proved
   below: a crafted id produced a live `<script>` element).
8. Harness fail-first "controls" were synthetic dicts and strings, never real artifacts; two of
   the four plan controls (missing font readiness, external resource) did not exist. The
   `PROBE_RESULT: PASS` banner printed claims (media, fonts, lockdown) that nothing asserted.
9. `render_pdf` was registered in the normal app's handler too (L1 is an isolated probe route).
10. Probe fixture ids (`probe-letter-project`, `probe-asset-1`) were not valid UUIDs / SHA-256
    asset ids, so a real snapshot validation would have rejected them.
11. No window for the WKWebView, synchronous `runOperation`, 10 s navigation timeout under
    load averages of 100-600.

## 2. Bridge proposal (dependencies)

Owner decision 2026-10-23 (roadmap PLAN.md, "Owner decisions" item 3): L1 may add a direct
dependency on `objc2-web-kit` 0.3.2 / matching objc2 crates already in Cargo.lock and the
offline cache. Used, all already locked at these exact versions through wry/tao (no new
`[[package]]` entries, no version changes; only feature flags and dependency edges):

| Crate | Version | Why |
|---|---|---|
| objc2 | 0.6.5 | class definition, message sends |
| block2 | 0.6.2 | WebKit completion handlers and the navigation decision block (objc2 project crate; already a dependency of objc2-web-kit in the lock) |
| objc2-web-kit | 0.3.2 | WKWebView, configuration, content world, user script, navigation delegate |
| objc2-app-kit | 0.3.2 | NSPrintInfo, NSPrintOperation, NSWindow, NSView |
| objc2-foundation | 0.3.2 | NSString, NSURL, NSURLRequest, NSRunLoop, NSDate, NSError, NSDictionary |

Cargo.lock change vs HEAD: five lines in folio's own dependency list (`block2`, `objc2`,
`objc2-app-kit`, `objc2-foundation`, `objc2-web-kit`). The draft had added four; T013 added
`block2`. `tempfile` 3 (already locked, previously dev-only) is now also a normal dependency for
the temporary PDF path. `cargo metadata --locked --offline` exits 0.

## 3. What the repaired code does

| File | Change |
|---|---|
| `src-tauri/src/printing.rs` (rewritten) | `render_pdf(request)` only: deserializes `{snapshot, pagesHtml, geometry, layoutVersion}` strictly (unknown fields refused); requires `native-v2`; runs `store::validate` on the snapshot; paper letter/a4; margins 0.25-2 in; markup <= 8 MiB; every `src` must be an inline `data:image/png|jpeg` whose SHA-256 is an asset id referenced by the snapshot, `srcset` refused (small tag scanner skips escaped prose, comments and style/script bodies); host CSP `default-src 'none'; style-src 'unsafe-inline'; font-src data:; img-src data:` is prepended before the markup. On the main thread: non-persistent data store, content JavaScript off, `WKPreferences.inactiveSchedulingPolicy = None`, a navigation delegate that allows only the first navigation (reported; asserted `about:blank`) and cancels everything else, a client-world user script recording CSP violations, an offscreen borderless window never ordered front. After load, a host `callAsyncJavaScript` in the isolated client world forces every font face to load, awaits `document.fonts.ready`, decodes every image, and returns a report; printing is refused unless every face is `loaded` and every image decoded. Then `NSPrintOperation` (window-modal form; smoke builds can select `runOperation` with `FOLIO_SMOKE_PRINT_RUN=sync`) saves via `NSPrintInfo` (`NSPrintSaveJob`, `NSPrintJobSavingURL` constants) into a temp folder. Returns `{bytesBase64, pageCount (counted from PDF page objects, <= 10000), warnings, sourceRevision, diagnostics}`; PDF <= 64 MiB. Stage breadcrumbs go to stderr. 6 unit tests. |
| `src-tauri/src/lib.rs` | `mod printing` kept (dead-code allowed outside smoke builds); `render_pdf` registered **only** in the native-smoke handler (removed from the normal app's handler). zotero lines untouched. |
| `src-tauri/src/smoke.rs` | Only the `native-print` arm of `configure()`: injects `window.__SMOKE_PRINT_FIXTURES__` from the JSON file named by `FOLIO_SMOKE_PRINT_FIXTURES`. The other uncommitted smoke.rs edits are WP11's (T018) and were not touched. |
| `src-tauri/Cargo.toml` / `Cargo.lock` | Section 2. Feature flags only, plus the `block2` edge. |
| `src/print/nativePdf.ts` | `buildPrintHtml`: CSP meta directly after charset; note ids no longer in markup; every text block `dir="auto"`; images carry `data-asset-id`; one `.sheet` per explicit break, sized to the content box, with running header/footer; optional embedded licensed font; no `@page` rule (NSPrintInfo owns paper/margins); `html { zoom: 0.9375 }` (finding F2). `renderNativePdf`: strict response validation (bytes, positive page count, matching revision, `%PDF`), no fabricated values. |
| `src/print/printProbe.ts` | `buildProbeFixtures()`: schema-valid projects (UUIDs, SHA-256 asset ids, built by `buildPrintHtml`) for Letter, A4, note-flow; a hand-written hostile markup fixture; a readiness control (undecodable approved PNG + broken data: font); 7 boundary rejections. A small stored-deflate PNG encoder makes real images. |
| `src/print/nativePdf.test.ts` (new) | 6 unit tests: escaping, CSP placement, fixture validity/asset binding, response validation. |
| `tests/native-print.js` | Loops over injected fixtures, calls `render_pdf`, writes each PDF into the run folder, reports raw results. No assertions in-page. |
| `scripts/native-print-fixtures.mjs` (new) | Bundled by esbuild and run with Node: `fixtures`, plus control generators `tall` (all pages stacked on one tall page, pdf-lib) and `raster` (page PNGs in a PDF, no text). |
| `scripts/native-print-smoke.py` | `--probe`: refuses a binary older than its embedded/compiled sources; loopback request counter; file:// canary folder; launch A (all fixtures, lockdown) and launch B (hostile fixture with the smoke-only `FOLIO_SMOKE_PRINT_CONTROL=unlocked` switch); poppler inspection (per-page boxes, per-page text, `-bbox-layout`, pdffonts, pdfimages); renders every page to PNG; four checker controls; `result.json`. |
| `src/print/probeFixtures.node.ts` | Registered early, never created (the generator lives in `scripts/native-print-fixtures.mjs`). |
| `src-tauri/capabilities/default.json` | Untouched (app commands need no capability entry). |

## 4. Fail-first evidence (logs under `node_modules/.cache/personal-word-beta/team-t013/`)

- **TS on the draft**: `vitest-failfirst-draft.log` -- the new test file against the untouched draft: 5 of 6 fail (`<script` reached the markup via the note id; CSP not first in head; no fixture builder; bare byte array accepted with pageCount 1; wrong revision accepted). After repair: `vitest-print-3.log` 6/6.
- **Rust doctored copy**: `rust-failfirst-doctored.log` -- with the asset-id check, the face-status check and the CSP prefix disabled, exactly `image_sources_must_be_this_snapshots_assets`, `readiness_requires_loaded_fonts_and_decoded_images`, `host_csp_precedes_supplied_markup` fail (3 failed / 3 passed). File restored byte-identically (`doctor-hashes.txt`: 71da6a2f... before and after, ed6be63e... doctored).
- **Checker controls on real artifacts** (run 20261025T070701Z-642a1146, `controls/`): each detected by its target assertion -- one-tall-page (612x2376 page made from the real Letter PDF) -> `page-count` (also page-boxes, explicit-breaks, margins); missing-font-readiness (real Letter PDF, readiness report doctored to `loading`/`error`) -> `readiness`; raster-only (Letter pages as images, no text) -> `searchable-text` (also embedded-fonts, media); external-resource (launch B, lockdown off: 8 loopback requests incl. `GET /link.css`, `/print-bg.png`, `/inline-style.png`) -> `zero-external-loads`. The same assertions pass on the real artifacts except Arabic (below).
- **Native fail-closed**: the readiness-control fixture is refused natively: "Print view is not ready: font face PW Broken Font is error"; all 7 boundary fixtures are refused with their specific errors.

## 5. Commands and result lines

```
export PATH="$PWD/node_modules/.cache/personal-word-alpha-review/tools/node-v22.23.3-darwin-x64/bin:$PATH"   # node v22.23.3
cargo metadata --locked --offline --format-version 1 --manifest-path src-tauri/Cargo.toml       -> exit 0
cargo check --locked --offline --manifest-path src-tauri/Cargo.toml --jobs 1 --features native-smoke -> exit 0, 0 warnings (rust-checks-1.log)
cargo check --locked --offline --manifest-path src-tauri/Cargo.toml --jobs 1                    -> exit 0
cargo test  --locked --offline --manifest-path src-tauri/Cargo.toml --jobs 1 -- --test-threads=1 -> 47 passed; 0 failed; 1 ignored (final-checks.log)
npx tsc --noEmit -p .                                                                          -> exit 0 (final-checks.log)
npx vitest run src/print                                                                       -> Tests 6 passed (6)
npm run tauri build -- --debug --features native-smoke --no-bundle --config '{"identifier":"com.folio.smoke"}' -> exit 0 (tauri-smoke-build-5.log), binary sha256 a15f40b3...
python3 scripts/native-print-smoke.py --probe --timeout 420                                    -> PROBE_RESULT: STOP -- failing: letter:searchable-text, a4:searchable-text (probe-8.log)
```
Final probe run folder: `node_modules/.cache/personal-word-beta/print-smoke/runs/20261025T070701Z-642a1146/`
(`result.json` with source/binary identity hashes, `launch-a/*.pdf`, `pages/*.png`, `controls/`).
Earlier runs (kept, same folder): 20261025T062034Z-bcdc0be2 and T063627Z-6276d26c (hung: web
process suspended, `sample-hang-1.txt`/`-2.txt`); T064429Z-39a7f0e6 (window-modal print never
finished) and T065146Z-93c5cc2c / T070005Z-07144570 (sync: modal Save PDF panel, `sample-sync.txt`);
T070345Z-c7557b86 (first full output: pages doubled); T070544Z-0e29b2fd (612 -> 624 px view
width: identical output, disproving a view-width cause).

## 6. Probe results (run 20261025T070701Z-642a1146, macOS 15.7.9, Intel x86_64)

| Fixture | Paper | Pages (native = pdfinfo) | Breaks | Text search | Media | Direction | Readiness | External / file loads |
|---|---|---|---|---|---|---|---|---|
| letter | 612x792 pt, margins 72 pt | 3 = 3 (expected 3) | each marker only on its page | FAIL: Arabic; Latin, Greek, Cyrillic, Hebrew, CJK, Korean, Japanese, code, caption found | 1 image (160x48 swatch), table | Hebrew/Arabic right-aligned, correct order (visual) | Noto Serif web font `loaded`, image decoded, before print | 0 resource entries, page script not run |
| a4 | 595.28x841.89 pt, margins 54 pt | 2 = 2 (expected 2) | yes | FAIL: Arabic (SF Arabic: lossy + stray `#`); Hebrew, Latin found | none | RTL-first paragraph right-aligned | no faces, `loaded` | 0 |
| note-flow | Letter | 2 = 2 (>= 2) | n/a | all 120 note sentences once, in order, page 1 -> page 2 | none | LTR | web font `loaded` | 0 |
| hostile | Letter | 1 = 1 | n/a | body text found | 4 WebKit "Blocked Plug-in" chrome images (not gated) | n/a | `loaded` | **0 loopback requests**; 6 CSP violations recorded (http link.css, preload.png, import.css, svg-image.png, poster.png, inline-style.png); navigations cancelled: `about:blank` (iframe srcdoc), `http://127.0.0.1:.../meta-refresh`; inline page script did not run |
| readiness-control | Letter | refused | | | | | "font face PW Broken Font is error" | |
| 7 boundary fixtures | | refused | | | | | | layout version, paper, margins, invalid snapshot id, unapproved image, remote `img src`, 8 MiB+ markup |

Header/footer geometry (gated, passes): running-header top within 70-102 pt and footer bottom within
690-722 pt (Letter) / 52-84 and 758-790 pt (A4) on every page; first-marker left edge exactly 72.0
(Letter) / 54.0 (A4) pt on every page. Each fixture rendered in 0.26-0.56 s.

PDFKit search (`findString`, the engine behind Preview) on the Letter PDF: found -- Ελευθερία,
Красота, שלום עולם, עליכם (also inside the pointed line), सत्यमेव जयते, 吾輩は猫である, 모든 인간은,
PWNOTE-1; NOT found -- السلام عليكم, السلام, عليكم (fallback font Times New Roman emits
presentation forms), office, affine (ffi ligature of the embedded web font), the pointed Hebrew
string exactly, 天地玄黃 (pdftotext does extract it; PDFKit tokenization, not investigated).

Font diagnostic (`font-experiment-1.log`, one isolated launch, 12 one-variant pages): Arabic in Geeza
Pro, SF Arabic, Al Nile, Baghdad, Damascus (and Noto Naskh -> fallback) extracts as "الس'م عليكم":
عليكم becomes searchable, but the lam-alef ligature always becomes `'`, so السلام is never found;
Times New Roman / Arial give presentation forms (not searchable). Latin "office affine": embedded
Noto Serif with ligatures on -> "o!ce a!ne"; with `font-variant-ligatures: none`, Georgia or Times
New Roman -> searchable.

## 7. Rendered-page inspection (pages/*.png at 80 dpi, plus a 200 dpi crop)

Hebrew lines are right-aligned and read right to left in the correct order; pointed Hebrew shows
its niqqud attached correctly. Arabic is properly joined, with the lam-alef ligature drawn
correctly (the problem is only the text layer). Devanagari conjunct त्य and the matras render
correctly. The mixed line "Chapter 12: עברית 2026 and العربية 42!" is displayed per the Unicode
bidi algorithm (numbers placed beside the RTL runs, "!" at the end). The ffi ligature is drawn in
"office affine". The table, swatch image, caption, blockquote, code block, CJK and Korean lines
render correctly. Letter page 3 shows the rule and "1. PWNOTE-1 ..." under the page-3 text, footer
"Sheet 3 of 3". Note-flow page 2 continues mid-sentence from page 1 ("continues with ordinary prose
... PWS069") through PWS120 with no gap, overlap or repeated line (no header by design). A4 page 2
shows its marker and Latin line with header and "Sheet 2 of 2" footer. All 8 pages viewed.

Expectation changed after seeing output (one place): the hostile fixture's `images: 0` became
`null` (not gated) because WebKit draws its own "Blocked Plug-in" chrome for the blocked `<object>`
as four 12x27 px image/smask pairs (viewed on hostile-1.png). It is not a security property; the
lockdown assertions (zero loopback requests, no resource entries, page script not run, CSP
violations recorded) are unchanged and pass. The headers and footers sit
in the margins on every page. A4 heading in Futura shows "--" as an en dash, a font ligature
changing how user punctuation looks (finding F5). The hostile page shows WebKit's "Blocked
Plug-in" pill, an empty iframe box, a live-looking link and a form button; no remote content.

## Findings for T014 / L2

- F1 (STOP): Arabic text with lam-alef is not searchable in WebKit-printed PDFs with installed fonts. Not fixable by CSS (the ligature is mandatory). Untested: bundling a different OFL Arabic font, which needs separate owner approval.
- F2: WebKit prints 1 CSS px as 0.8 pt (not 0.75); without compensation every sheet overflowed and page counts doubled. The view's frame width does not affect print layout (612 vs 624 px gave identical output, run T070544Z). `html { zoom: 0.9375 }` restores true size; it is an observed constant, so L2/L3 must keep measuring it.
- F3: a hidden WKWebView's web process is suspended unless `inactiveSchedulingPolicy = None` (macOS 14+ API).
- F4: with a literal `"NSPrintJobSavingURL"` key (draft) AppKit ignores the URL and runs a modal Save PDF panel (`NSSavePanel runModal`, sampled in `sample-sync.txt`): the real key is "NSJobSavingURL"; use the exported constants. During two diagnostic runs (before the fix) that invisible-or-visible save panel may have appeared on screen for up to 150-480 s before the harness killed its own process.
- F5: the embedded web font's ligatures and Futura's `--` ligature change the text layer or the look of user punctuation; L2's font policy should set `font-variant-ligatures` deliberately.
- F6: hostile `<a href>` in markup becomes a live link annotation in the PDF (no load during printing). The builder escapes all imported text, so only a builder bug could emit one.
- F7: file:// lockdown evidence is indirect: the opaque `about:blank` origin plus zero resource-timing entries; WebKit reported no CSP violations for the file:// canary URLs (blocked earlier by its local-resource rule), and no counter observes file reads.
- After a failed window-modal print (before F4's fix) the IPC result never reached the page; L2 should not rely on recovery from a stuck print operation.

Smoke-only switches compiled into the native-smoke binary only (normal builds never read them):
`FOLIO_SMOKE_PRINT_CONTROL=unlocked` (drops host CSP and allows content JS, used only for the
counter-liveness launch B) and `FOLIO_SMOKE_PRINT_RUN=sync` (diagnostic `runOperation` form).

Drift: after the work, `diff` of smoke.rs, lib.rs and Cargo.lock against the start copies shows
only T013's own edits; no registered path changed under T013 from outside.

## 8. Not covered / what remains

- Other macOS versions, Apple Silicon, other installed font sets: only macOS 15.7.9 Intel was run.
- `inactiveSchedulingPolicy` needs macOS 14+; older systems untested.
- Owner real use: none. Status is CLAIMED, never VERIFIED.
- No normal (non-smoke) app build was made or offered; the command is not in the normal app.
- Per-page footnote allocation (L3), preview/save byte identity and font policy (L2) are out of L1.
- The STOP needs an owner decision (plan line 36, "Stop and ask"): either accept "Arabic is displayed correctly but not searchable" as a documented limitation and continue to WP9/WP10, or cancel WP9/WP10 and keep the legacy exporter (which refuses Arabic entirely). Until then the default applies: legacy PDF stays, native path experimental/unavailable.
