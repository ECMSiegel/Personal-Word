# 05-layout implementation log

## 2026-10-25 -- L1 native print feasibility (team task T013, agent-2f7c) -- STOP, CLAIMED

Full record: `docs/agent-work/2026-10-24-team-reconciliation/wp8.md`.

- Started from an untrusted off-board draft (printing.rs, nativePdf.ts, printProbe.ts,
  native-print.js, native-print-smoke.py, Cargo/lib/smoke lines). Byte-identical copies:
  `node_modules/.cache/personal-word-beta/team-t013/draft-backup/`. Its page counts were
  hard-coded fallbacks, the snapshot was never validated, the CSP check was a substring match,
  readiness did not exist, its security controls could not fail, and its markup was hand-written.
  All repaired with fail-first evidence (wp8.md section 4).
- Bridge: objc2 0.6.5, block2 0.6.2, objc2-web-kit / objc2-app-kit / objc2-foundation 0.3.2, all
  already locked; Cargo.lock gains only folio dependency edges. `--locked --offline` passes.
- Implemented: `render_pdf` (smoke builds only) -- validated snapshot, asset-bound inline images,
  host CSP, content JS off, navigation lock, no IPC bridge in the print view, proved font/image
  readiness, `NSPrintOperation` save-to-PDF on the main thread, real page count.
- Native probe (run 20261025T070701Z-642a1146, macOS 15.7.9 Intel): Letter 3/3 and A4 2/2 pages
  with exact page boxes, explicit breaks, margins and header/footer bands; a 120-sentence note
  flows across pages with nothing missing or repeated; table and image present; readiness proved;
  zero loopback requests and no page script with hostile markup; 7 boundary rejections and a
  native readiness refusal; all four checker controls detected by their own assertion.
- STOP capability: Arabic with the mandatory lam-alef ligature is not searchable (text layer gives
  `'`), with every installed Arabic font tried (8). Also recorded: WebKit prints 1 CSS px as 0.8 pt
  (compensated with zoom 0.9375); hidden views need `inactiveSchedulingPolicy = None`; the
  saving-URL key must be AppKit's constant ("NSJobSavingURL"), otherwise a modal Save panel runs;
  embedded-font ligatures lose text (mitigable with `font-variant-ligatures`).
- Legacy pdf-lib export remains the only public PDF route; no export switch was made. Next step
  is the owner's call (accept the Arabic search limitation or cancel WP9/WP10), via T014.
