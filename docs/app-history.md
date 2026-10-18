# Personal Word application history

This is a short guide to the checked-in milestones; Git contains the complete source history. Dates and commit references below come from `git log --date=short` in this checkout. Historical verification is labeled by what the existing validation record says; it is not a fresh result from this implementation pass.

## 2026-10-14 -- local-first writing and durability (`6f1e6e9`)

The initial workspace established projects, sections, rich-text editing, SQLite persistence, immediate WebView recovery journaling, snapshots, and portable project copies. SQLite remained the desktop source of truth; the browser preview was explicitly separate. Existing persistence identifiers (`com.folio.writing`, `folio.*`, and native event names) were retained so existing projects remain discoverable. The checked-in validation record describes native smoke coverage for create/edit/switch/fragment/snapshot/quit/reopen, but not forced termination, power loss, or complete WebKit qualification.

## 2026-10-16 -- durability corrections (`f3638bc`, `6caf35e`, `0811bb7`)

Recovery lockouts and project rename/delete behavior were corrected. Saves moved to changed-entry deltas and time-bucketed recovery history; portable mirrors moved off the SQLite commit path. The architecture records revision/base-revision checks, WAL/FULL sync, journal limitations, and mirror failure handling. Historical unit, Rust, browser, and native smoke results appear in [validation](validation.md); the old 100,000-word measurements are Node and Rust costs, not WebKit input latency.

## 2026-10-16 -- expanded writing workflows (`c5d8647`)

The app added project tabs, templates, page view, research and Chicago citation assistance, DOCX/PDF export, comments, fragments, and revision comparison. The architectural decision was additive project/entry metadata with flattened Rust metadata maps and no database schema rename. Export pagination remained independent from editor pagination. The existing validation record reports Chromium workflows and native smoke, but not Word application rendering or exact pagination parity.

## 2026-10-16 -- interface, research, footnotes, and fragments (`3fb5abe`, `f292dfc`)

The toolbar and dropdowns were simplified, research lookup added opt-in web requests, and later work added editable footnotes and a fragment split view. Chromium screenshots and tests are recorded in `validation.md`; native smoke covered some WebKit page fragmentation, while native screenshot, VoiceOver, IME, and broad accessibility review remained outstanding.

## 2026-10-17 -- sidebar and improvement pass (`c62332c` plus current working changes)

Sidebar navigation was reorganized. This implementation pass adds bounded save scheduling, plain-text import, semantic list/strike export support, and an advisory single-instance lock; Markdown parsing was still incomplete at that point. Fresh unit, production frontend build, Rust tests, and a normal desktop bundle were produced; browser E2E was blocked by sandbox `listen EPERM`, and native smoke did not reach its UI checkpoint because the macOS service returned connection-invalid errors. See the dated section in `validation.md` for exact results.

## 2026-10-18 -- completion pass (working tree, uncommitted)

A follow-up pass completed the local work that the 2026-10-17 attempt left open: Markdown import with a preview step, bundled OFL Noto font subsets for PDF with range checks, real DOCX XML and generated-artifact inspection, a keyboard-focusable listbox dropdown, the extracted footnote-layout hook, and a three-phase isolated native smoke harness. The shared document representation now keys native list numbering to one instance per source list. Repository documentation (README, architecture, feature guide, third-party notices) was reconciled with the new behavior. Exact results and the checks that remain open are in the dated `validation.md` section; the pass is recorded as CLAIMED until the owner confirms it in real use.

## Deliberate boundaries

Personal Word stays local-first and does not need an account or sync service. The historical Folio identifier and storage keys remain compatibility data, not visible branding. Browser preview is a separate storage adapter, so browser tests cannot prove SQLite behavior. Editor page layout, DOCX, and PDF use separate layout engines; matching pagination is not promised. The project does not claim production durability certification or public-distribution readiness.
