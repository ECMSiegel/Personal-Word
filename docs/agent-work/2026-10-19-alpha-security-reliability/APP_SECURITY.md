# T2 -- App security review

Date: 2026-10-19
Reviewed baseline: `f324a7a`
Scope: native commands and storage, import/schema/link rendering, and citation lookup. Static review plus a focused Rust regression cycle. The only source change is the minimal URL-prefix guard repair and its two regression cases in `src-tauri/src/lookup.rs`.

## Result

One concrete input-handling defect was present in the native citation lookup scheme check: a malformed Unicode URL could panic before the request was sent. A focused regression reproduced the panic, passed with the minimal guard repair, failed again when the original guard was restored, and passed after restoring the repair. Network destination policy and an unbounded recovery-file import remain documented source-alpha behavior or hardening risks; they were not dynamically probed. No executable HTML sink was found in the reviewed import and link flows.

## Findings

### APP-1 -- Malformed Unicode can panic the native lookup guard

**Severity:** P3 native IPC robustness defect; repair and a fail-first regression are recommended before final qualification.
**Status:** Confirmed by a direct native-guard regression. The ordinary Research UI canonicalizes the tested examples, so this does not establish a crash through normal user-typed Research input.

`check_url` indexes `url[..8]` and `url[..7]` after checking byte length (`src-tauri/src/lookup.rs:13-17`). Those offsets are safe for ordinary ASCII prefixes, but length alone does not guarantee a UTF-8 character boundary. The registered native command accepts a raw string (`src-tauri/src/lookup.rs:53-59`, `src-tauri/src/lib.rs:179-193`). The ordinary Research UI first runs the value through `new URL(value).href` (`src/research/lookup.ts:80-84`), which normalizes the malformed-looking examples below to valid URL strings; this review therefore does not establish a user-typed Research-panel crash.

**Exact reproducer:** call `check_url("https:/é")` directly, or invoke the registered `lookup_fetch` command with the raw argument `https:/é`. Its UTF-8 byte length passes the `>= 8` condition, while byte offset 8 lies inside `é`; evaluating `url[..8]` panics before any network request. `http:/é` reaches the analogous offset-7 case. These raw native inputs should return the existing invalid-address error, not panic. The new Rust regression is specifically for this native boundary, not a reproduction through the normal Research UI.

**Repair applied:** `check_url` now uses boundary-safe `get(..N)` prefix checks before slicing. The accepted schemes and subsequent URL validation are unchanged. Regression cases for both malformed inputs require `Err`, and a mixed-case HTTPS URL with a Unicode hostname and path remains accepted. The tests call `check_url` directly and do not invoke `fetch`.

### APP-2 -- Opt-in lookup can reach private destinations and follow redirects

**Severity:** P3 accepted policy for source alpha; no policy change authorized.
**Status:** Owner decided on 2026-10-19 to retain and document the existing opt-in private/local HTTP(S) and redirect behavior. No private, loopback, LAN, or metadata endpoint was contacted.

The Research panel requires the user to enter a DOI, ISBN, or web address and press **Look up**. It sends the value to Crossref/Open Library or fetches that address (`src/research/ResearchPanel.tsx:668-695`, `src/research/lookup.ts:66-112`). The Rust guard only checks the textual scheme and whitespace/control characters. `ureq` is then configured to follow up to five redirects, with no app-level destination check on the initial host or redirect target (`src-tauri/src/lookup.rs:13-24`, `:27-50`). The app-layer policy therefore does not prevent HTTP(S) addresses that resolve to private or loopback destinations, or a public address redirecting to one; actual routing was not probed. Embedded credentials are not explicitly rejected by the frontend parser or native guard; whether this `ureq` version transmits or forwards them was not established here.

This is an opt-in desktop lookup rather than a background fetch, and the README documents that a DOI found in a page can cause a follow-up Crossref request (`README.md:91`). No data from the manuscript is passed to the fetcher in the reviewed path. The accepted source-alpha behavior should be described as a user-triggered request to the entered HTTP(S) destination, including redirects and local/private destinations.

No app-level change is authorized. Do not probe live LAN/metadata endpoints or change the accepted lookup policy as part of T4.

The response is capped at 3 MiB and the request has a 12-second timeout and five-redirect limit. The body reader silently returns the first 3 MiB (`lookup.rs:7-9`, `:44-50`), so a large page may yield incomplete metadata without a truncation warning. This is a data-quality limitation, not an unbounded response allocation.

### APP-3 -- Recovery import has no file-size bound

**Severity:** P3 accepted compatibility risk; runtime impact is inferred and unmeasured.
**Status:** Missing bound is confirmed statically. Owner decided on 2026-10-19 to preserve large project JSON compatibility for source alpha; no large-file import was attempted.

The Projects screen accepts a `.json` recovery file without a size limit (`src/components/ProjectLibrary.tsx:182-197`). `App.importProject` reads the entire file with `file.text()`, parses it, and validates it (`src/App.tsx:948-968`). Unlike this path, manuscript and CSL imports check the file size against 5 MiB before reading (`App.tsx:969-972`, `src/research/ResearchPanel.tsx:654-665`). Thus a selected recovery file of arbitrary size is fully materialized and parsed in the UI before native validation. The Rust rich-text validator limits nesting to 100 (`src-tauri/src/store.rs:775-840`), but that check runs after the frontend has already read and parsed the file.

**Reproducer:** from Projects, choose **Recover from a project.json file** and select a valid project JSON larger than 5 MiB. The current code has no size rejection before `file.text()`/`JSON.parse`; whether a particular size freezes or exhausts memory depends on the machine and was not tested.

**Direction:** no size cap is authorized for source alpha because recovery compatibility is being preserved. The large-file memory/CPU risk remains unmeasured and should be documented. Any future cap or item-count limit needs a product decision and must not silently reuse the manuscript's 5 MiB limit; recovery JSON contains serialization overhead and may represent larger manuscripts.

## Boundary trace and controls

| Surface | Reachable path | Observed controls / limits |
| --- | --- | --- |
| Native project storage | `src/storage.ts` calls `list_projects`, `delete_project`, `load_project`, `save_changes`, `flush_mirrors`, `create_snapshot`, `list_versions`, `load_version`, and `storage_path`; `App.tsx` calls `finish_quit`. `src-tauri/src/lib.rs:30-115` defines handlers and `:179-193` registers them. | Project IDs are parsed as UUIDs before being joined to the store root (`store.rs:153-163`). SQL values are bound parameters in project, entry, snapshot, history, and version queries (`store.rs:301-373`, `:378-461`, `:464-468`). Project, entry, order, rich-text node types, marks, and nesting are validated (`store.rs:735-840`). Project, entry, and header structs use flattened metadata maps, and mirrors/snapshots/history serialize the full project/entry values (`store.rs:27-65`, `:713-733`); no additive metadata loss was found in this trace. Delete renames a project folder to a `.deleted` set-aside path rather than removing it (`store.rs:215-230`). |
| Native export | `App.download` and `src/export/document.ts:206-225` obtain a path from the native save dialog, then invoke `export_file` or `export_bytes`; Rust writes via `store::atomic` (`lib.rs:99-105`, `store.rs:842-851`). | Current UI flows use an explicit save dialog and stop on cancel. The Rust commands themselves accept an arbitrary path string and do not constrain it to a save-dialog result. This is defense-in-depth exposure if the renderer is compromised, not a demonstrated path traversal in the normal UI flow. Consider moving path selection and writing into one native operation if the owner wants a narrower IPC boundary; do not add broad filesystem permissions. |
| Markdown/plain-text import | Projects file input -> `App.importWriting` -> `previewManuscript` -> `ImportPreview` -> `confirmImport` (`ProjectLibrary.tsx:199-214`, `App.tsx:969-986`, `src/import/manuscript.ts:5-89`). | Checks 5 MiB before reading, requires valid UTF-8, uses MarkdownIt with `html: false`, disables tables, limits links to `http`, `https`, and `mailto`, and keeps images/raw HTML as literal text with warnings. Preview values render as React text (`ImportPreview.tsx:7-12`); no HTML is inserted or executed. |
| Project recovery import | Projects file input -> `App.importProject` -> shared `validateProject` -> `SaveQueue`/`storage.save` (`ProjectLibrary.tsx:182-197`, `App.tsx:948-968`, `src/model.ts:116-225`). | Uses the shared Tiptap document schema and validates project/entry IDs and section order. The frontend's full-file read has no size cap (APP-3). |
| CSL JSON import | Research file input -> 5 MiB check -> `parseCslJson` -> `CslImportPreview` -> explicit **Add sources** (`ResearchPanel.tsx:648-665`, `src/research/cslImport.ts:67-137`, `CslImportPreview.tsx:4-18`, `App.tsx:1995-2011`). | JSON errors are caught; unknown source types are skipped; the preview shows at most ten titles. URL and citation values remain text/input data, not anchors or HTML. Import can add every valid item in the bounded file; there is no item-count limit. This is a lower-priority bounded-input concern, not a demonstrated security defect. |
| Editor and read view links | Writer uses Tiptap StarterKit's Link extension (`src/editor/extensions.ts:9-18`); read view renders marks in `ReadDocument.tsx:10-25`. | `openOnClick` is false in the editor. The installed Link extension validates URI protocols and strips a disallowed `href` when rendering (`node_modules/@tiptap/extension-link/src/link.ts:176-198`, `:346-359`). Read view creates anchors only for lower-case `http(s)://` values and uses `rel="noreferrer"`. Markdown import filters link schemes. Source URLs are editable fields, not active anchors. No script-URL execution path was found. |

The Tauri window CSP permits local scripts, restricts image sources, and permits IPC connections; the default capability grants core defaults and save dialogs only (`src-tauri/tauri.conf.json:12-24`, `src-tauri/capabilities/default.json:1-6`). Custom commands are registered in the main window handler, so the frontend's callsite and Rust validation remain the relevant authority boundary. `src/storage.ts:9-16` uses `folio.preview.*` localStorage only in browser preview; that path does not prove native SQLite behavior.

## Verification performed

- `npm test -- src/model.test.ts src/import/manuscript.test.ts src/research/lookup.test.ts src/research/cslImport.test.ts` -- exit 0; 4 files, 52 tests passed. Full output: ignored `node_modules/.cache/personal-word-alpha-review/t2-npm.log`.
- `cargo test --locked --offline --manifest-path src-tauri/Cargo.toml lookup::tests` at the baseline -- exit 0; 2 lookup tests passed, 16 filtered. Full output: ignored `node_modules/.cache/personal-word-alpha-review/t2-rust-lookup.log`.
- T4 fail-first with the regression cases and original guard -- exit 101; 3 passed and the malformed-input test reproduced the panic at byte index 8 inside `é` in `https:/é`. Log: ignored `node_modules/.cache/personal-word-alpha-review/t4-rust-fail.log`.
- T4 repaired guard -- exit 0; 4 passed, 16 filtered. Log: ignored `node_modules/.cache/personal-word-alpha-review/t4-rust-pass.log`.
- T4 restored original guard with regression cases -- exit 101; 3 passed and the malformed-input test reproduced the same panic. Log: ignored `node_modules/.cache/personal-word-alpha-review/t4-rust-restored-defect.log`.
- T4 final repaired guard -- exit 0; 4 passed, 16 filtered. Log: ignored `node_modules/.cache/personal-word-alpha-review/t4-rust-final-pass.log`.
- The targeted Rust suite covers rejection of non-web schemes, ordinary HTTP(S), the two malformed UTF-8-boundary inputs, and mixed-case HTTPS with Unicode hostname/path. Redirect destinations, credential handling, and private-address policy were not dynamically tested. No network probes, installs, or broader suites were run.

## Owner decisions and remaining unknowns

- Owner accepted user-triggered private/local HTTP(S) lookup and redirects into those destinations for source alpha; this report records that documented behavior, and no network policy change was made.
- Owner chose to preserve recovery JSON compatibility without a new file-size cap for source alpha; large-file runtime behavior remains unmeasured.
- Actual `ureq` behavior for embedded URL credentials, redirect credential forwarding, and resolution/redirect handling; this review did not inspect live network behavior.
- The size at which project recovery import causes noticeable slowdown or memory pressure; no threshold was measured.
- Redirect credential forwarding and actual DNS/redirect destination behavior of this `ureq` version remain unverified.
- Large-file recovery import responsiveness and memory use remain unmeasured.
