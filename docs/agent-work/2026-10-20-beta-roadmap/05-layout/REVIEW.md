# 05-layout review

## 2026-10-25 -- L1 / WP8 native print feasibility gate (team task T014, reviewer agent-f459)

**Verdict: STOP** (status CLAIMED; Q004 unanswered, so the plan's default applies).

- Evidence: `docs/agent-work/2026-10-24-team-reconciliation/feasibility.md` (full review),
  `docs/agent-work/2026-10-24-team-reconciliation/wp8.md` (worker report, T013, approved by this
  reviewer).
- Independent rerun: `python3 scripts/native-print-smoke.py --probe --timeout 420` without
  rebuilding (binary and source identity matched). Run `20261025T072108Z-e51b1619`:
  `PROBE_RESULT: STOP -- failing: letter:searchable-text, a4:searchable-text`. Every other L1
  assertion passed:
  - Letter 3/3 and A4 2/2 pages, with exact page boxes, explicit breaks and margins
  - header/footer bands on every page
  - the long note flows across pages
  - table and image present
  - font and image readiness proved
  - zero external loads with hostile markup
  - 7 boundary rejections and a native readiness refusal
  - all four checker controls detected
- Failing capability (plan L1 stop rule, "searchable shaping"): Arabic words containing the
  mandatory lam-alef ligature are not findable by PDFKit or pdftotext in WebKit-printed PDFs.
  The glyphs render correctly; only the text layer is wrong. This depends on the font:
  - every body-text Arabic font installed (26 of 28 tried, including the system SF Arabic and
    Geeza Pro) loses the ligature;
  - only the decorative display faces Diwan Kufi and Diwan Thuluth keep it.
- Fail-first spot check: on a doctored copy, `cargo test ... --lib printing` failed the 3 targeted
  tests; on the current tree, 6/6 pass. `tsc` is clean; `vitest src/print` 6/6.
- Consequences (plan default "retain legacy PDF and label new path experimental/unavailable"):
  - The legacy pdf-lib exporter (`src/export/pdf.ts`, unchanged vs HEAD) stays the only public
    PDF route.
  - `render_pdf` exists only in the native-smoke diagnostic build.
  - Script/long-note warnings stay.
  - No parity claim is made.
  - WP9/WP10 (T015/T016) are cancelled as not applicable (see the `decide` record "WP9/WP10
    cancelled: WP8 feasibility STOP").
  - Gate C (T017) reviews the preserved legacy behaviour and documents WP9/WP10 as not applicable.
- Reopen only if the owner answers Q004 with A (accept the documented Arabic-search limitation)
  or C (an approved bundled OFL Arabic font), followed by a new reviewed probe that passes (or,
  under A, records the accepted limitation).

## 2026-10-25 -- Review Gate C, layout wave (team task T017, reviewer agent-c57f)

**Verdict: PASS as a documented STOP** (status CLAIMED). Full report:
`docs/agent-work/2026-10-24-team-reconciliation/gate-c.md`; logs
`node_modules/.cache/personal-word-beta/team-t017/`.

- The L1 STOP above is reproduced without rebuilding (all 10 identity hashes still match):
  run `20261025T074258Z-7930e721`, `PROBE_RESULT: STOP -- failing: letter:searchable-text,
  a4:searchable-text`; every other assertion passes; all four checker controls detected.
- Legacy behaviour preserved:
  - `src/export/pdf.ts` is byte-identical to HEAD (`ffef585b...`).
  - Its script refusal (`pdf.ts:78-93`) and overlong-note refusal (`pdf.ts:369-373`) are present.
  - Both were exercised by the reviewer with a negative control.
  - `vitest src/export` passes: 138 tests in 5 files; 167 in 6 files with
    `adversarial-wp3-exports`.
  - A fresh legacy PDF (3 pages; notes, table, image, explicit break, bibliography) was rendered
    and viewed with no clipping or overlap. A DOCX was checked by XML (3 native footnotes, table,
    drawing, 2 page breaks).
- No public route to native print:
  - Nothing outside `src/print/` references `render_pdf`, `nativePdf` or `printProbe`.
  - `render_pdf` is only in the native-smoke handler.
  - `cargo check --locked --offline` passes, normal and `--features native-smoke`, 0 warnings.
- Preservation: no deletions; `capabilities/default.json` is unchanged; `Cargo.lock` adds only the
  5 `folio` dependency edges.
- User-facing wording: the ExportPanel help, README, architecture, ROADMAP and validation text
  accurately state the legacy limits, and nothing promises an exact or native PDF preview.
- WP9/WP10 (L2/L3) do not apply under the plan default while Q004 is open:
  - T015 and T016 were closed "not needed" and reviewed.
  - No L2/L3 file exists.
- Findings (none blocks this gate):
  - F1: the overlong-note refusal has no repo test; filed as T041.
  - F2: `docs/validation.md:258` (off-board WP11 text) lists "print probe integration" as a
    qualified beta feature; this is for T020/T018/T021.
  - F3: legacy PDF hashes are timestamped (for T019).
- Boundaries: Node/vitest, Poppler and QuickLook only (no Word or LibreOffice); macOS 15.7.9 Intel
  with this Mac's fonts; no normal app build; no owner real use.
