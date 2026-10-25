//! Native WebKit print-to-PDF for layout L1 (feasibility probe).
//!
//! `render_pdf` validates an immutable project snapshot, bounds the markup, accepts image
//! sources only when they are inline copies of that snapshot's own assets, and prints an
//! isolated WKWebView through `NSPrintOperation` (save-to-file job, real paper pages).
//! The print view has no app IPC bridge, content JavaScript is off, every navigation other
//! than the initial in-memory load is cancelled, and a host-injected CSP (`default-src 'none'`)
//! precedes the markup. Fonts and images are proved ready by a host script in an isolated
//! content world before printing. L1 registers the command only in native-smoke builds.

use crate::{assets, store};
use base64::Engine;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use sha2::{Digest, Sha256};
use std::collections::HashSet;

pub const MAX_HTML_BYTES: usize = 8 * 1024 * 1024;
pub const MAX_PDF_BYTES: usize = 64 * 1024 * 1024;
pub const MAX_PAGES: usize = 10_000;
pub const PRINT_CSP: &str =
    "default-src 'none'; style-src 'unsafe-inline'; font-src data:; img-src data:";

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct PrintGeometry {
    pub paper: String,
    pub margin_inches: f64,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct PrintRequest {
    pub snapshot: store::Project,
    pub pages_html: String,
    pub geometry: PrintGeometry,
    pub layout_version: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RenderedPdf {
    pub bytes_base64: String,
    pub page_count: usize,
    pub warnings: Vec<String>,
    pub source_revision: i64,
    pub diagnostics: Value,
}

#[derive(Debug, Clone, Copy, PartialEq)]
pub struct Paper {
    pub width: f64,
    pub height: f64,
}

/// A validated print job: the final document and its native page geometry.
#[derive(Debug, Clone)]
pub struct PrintJob {
    pub html: String,
    pub paper: Paper,
    pub margin_pt: f64,
}

pub fn parse_paper(name: &str) -> Result<Paper, String> {
    match name {
        "letter" => Ok(Paper { width: 612.0, height: 792.0 }),
        "a4" => Ok(Paper { width: 595.28, height: 841.89 }),
        other => Err(format!("Unsupported paper '{other}'; use 'letter' or 'a4'")),
    }
}

/// Every image asset id that the snapshot's own documents reference.
pub fn snapshot_asset_ids(project: &store::Project) -> HashSet<String> {
    fn walk(node: &Value, out: &mut HashSet<String>) {
        if node.get("type").and_then(Value::as_str) == Some("image") {
            if let Some(id) = node.pointer("/attrs/assetId").and_then(Value::as_str) {
                out.insert(id.to_string());
            }
        }
        if let Some(children) = node.get("content").and_then(Value::as_array) {
            for child in children {
                walk(child, out);
            }
        }
    }
    let mut out = HashSet::new();
    for entry in &project.entries {
        walk(&entry.content, &mut out);
    }
    out
}

/// Attributes of every start tag, skipping comments and raw-text element bodies.
/// Escaped text never contains `<`, so attribute-like text in prose is not a tag.
fn start_tags(html: &str) -> Vec<(String, Vec<(String, String)>)> {
    let b = html.as_bytes();
    let lower = html.to_ascii_lowercase();
    let mut tags = Vec::new();
    let mut i = 0;
    while i < b.len() {
        if b[i] != b'<' {
            i += 1;
            continue;
        }
        if lower[i..].starts_with("<!--") {
            i = lower[i + 4..].find("-->").map_or(b.len(), |p| i + 4 + p + 3);
            continue;
        }
        if i + 1 >= b.len() || !b[i + 1].is_ascii_alphabetic() {
            i += 1;
            continue;
        }
        let mut j = i + 1;
        while j < b.len() && !b[j].is_ascii_whitespace() && b[j] != b'>' && b[j] != b'/' {
            j += 1;
        }
        let name = lower[i + 1..j].to_string();
        let mut attrs = Vec::new();
        loop {
            while j < b.len() && (b[j].is_ascii_whitespace() || b[j] == b'/') {
                j += 1;
            }
            if j >= b.len() || b[j] == b'>' {
                j += 1;
                break;
            }
            let start = j;
            while j < b.len() && !b[j].is_ascii_whitespace() && !b"=>/".contains(&b[j]) {
                j += 1;
            }
            let attr = lower[start..j].to_string();
            while j < b.len() && b[j].is_ascii_whitespace() {
                j += 1;
            }
            let mut value = String::new();
            if j < b.len() && b[j] == b'=' {
                j += 1;
                while j < b.len() && b[j].is_ascii_whitespace() {
                    j += 1;
                }
                if j < b.len() && (b[j] == b'"' || b[j] == b'\'') {
                    let quote = b[j];
                    let end = b[j + 1..].iter().position(|c| *c == quote).map_or(b.len(), |p| j + 1 + p);
                    value = html[j + 1..end].to_string();
                    j = (end + 1).min(b.len());
                } else {
                    let start = j;
                    while j < b.len() && !b[j].is_ascii_whitespace() && b[j] != b'>' {
                        j += 1;
                    }
                    value = html[start..j].to_string();
                }
            }
            if attr.is_empty() {
                j += 1;
            } else {
                attrs.push((attr, value));
            }
        }
        if ["style", "script", "textarea", "title", "xmp", "noscript"].contains(&name.as_str()) {
            let close = format!("</{name}");
            j = lower[j.min(b.len())..].find(&close).map_or(b.len(), |p| j + p);
        }
        tags.push((name, attrs));
        i = j;
    }
    tags
}

/// Image sources must be inline copies of this snapshot's approved assets: `data:` PNG/JPEG
/// whose bytes hash to an asset id referenced by the snapshot. `srcset` is refused outright.
pub fn check_image_sources(html: &str, approved: &HashSet<String>) -> Result<usize, String> {
    let mut count = 0;
    for (tag, attrs) in start_tags(html) {
        for (attr, value) in attrs {
            if attr == "srcset" {
                return Err(format!("Print markup may not use srcset (<{tag}>)"));
            }
            if attr != "src" {
                continue;
            }
            let value = value.trim();
            let (mime, data) = if let Some(rest) = value.strip_prefix("data:image/png;base64,") {
                ("image/png", rest)
            } else if let Some(rest) = value.strip_prefix("data:image/jpeg;base64,") {
                ("image/jpeg", rest)
            } else {
                return Err(format!(
                    "Print markup references an image source that is not an approved asset of this snapshot (<{tag}>)"
                ));
            };
            let bytes = base64::engine::general_purpose::STANDARD
                .decode(data)
                .map_err(|_| "Print markup has an image with invalid base64 data".to_string())?;
            let meta = assets::inspect(&bytes)?;
            let id = format!("{:x}", Sha256::digest(&bytes));
            if meta.mime != mime || !approved.contains(&id) {
                return Err(format!(
                    "Print markup references an image that is not an approved asset of this snapshot ({})",
                    &id[..12]
                ));
            }
            count += 1;
        }
    }
    Ok(count)
}

/// The host-owned document prefix: the CSP is the first policy-bearing element, so it
/// governs everything the supplied markup contains.
pub fn wrap_document(pages_html: &str, with_csp: bool) -> String {
    let csp = if with_csp {
        format!("<meta http-equiv=\"Content-Security-Policy\" content=\"{PRINT_CSP}\">")
    } else {
        String::new()
    };
    format!("<!DOCTYPE html><html><head><meta charset=\"utf-8\">{csp}{pages_html}")
}

/// Validates the request without touching WebKit.
pub fn prepare(request: &PrintRequest, with_csp: bool) -> Result<PrintJob, String> {
    if request.layout_version != "native-v2" {
        return Err(format!(
            "Unsupported layout version '{}'; expected 'native-v2'",
            request.layout_version
        ));
    }
    store::validate(&request.snapshot)?;
    let paper = parse_paper(&request.geometry.paper)?;
    let margin = request.geometry.margin_inches;
    if !margin.is_finite() || !(0.25..=2.0).contains(&margin) {
        return Err("Print margins must be between 0.25 and 2 inches".into());
    }
    if request.pages_html.len() > MAX_HTML_BYTES {
        return Err(format!(
            "Print markup exceeds the {} MiB size limit",
            MAX_HTML_BYTES / 1024 / 1024
        ));
    }
    check_image_sources(&request.pages_html, &snapshot_asset_ids(&request.snapshot))?;
    Ok(PrintJob {
        html: wrap_document(&request.pages_html, with_csp),
        paper,
        margin_pt: margin * 72.0,
    })
}

/// Counts page objects (`/Type /Page`, not `/Pages`) and checks the page tree agrees.
pub fn pdf_page_count(bytes: &[u8]) -> Result<usize, String> {
    if bytes.len() > MAX_PDF_BYTES {
        return Err("Rendered PDF exceeds the output size limit".into());
    }
    if !bytes.starts_with(b"%PDF-") {
        return Err("Rendered output is not a PDF".into());
    }
    let mut pages = 0;
    let mut i = 0;
    while let Some(p) = find(&bytes[i..], b"/Type") {
        let mut j = i + p + 5;
        while j < bytes.len() && bytes[j].is_ascii_whitespace() {
            j += 1;
        }
        if bytes[j..].starts_with(b"/Page")
            && !bytes.get(j + 5).is_some_and(|c| c.is_ascii_alphanumeric())
        {
            pages += 1;
        }
        i = j;
    }
    if pages == 0 || pages > MAX_PAGES {
        return Err(format!("Rendered PDF has an unusable page count ({pages})"));
    }
    Ok(pages)
}

fn find(haystack: &[u8], needle: &[u8]) -> Option<usize> {
    haystack.windows(needle.len()).position(|w| w == needle)
}

/// Readiness and lockdown evidence reported by the isolated host script. Printing is refused
/// unless every declared font face and every image is loaded and decoded.
pub fn check_readiness(diagnostics: &Value) -> Result<(), String> {
    let status = diagnostics.get("fontsStatus").and_then(Value::as_str).unwrap_or("missing");
    let mut problems = Vec::new();
    if status != "loaded" {
        problems.push(format!("document fonts status is {status}"));
    }
    for face in diagnostics.get("faces").and_then(Value::as_array).into_iter().flatten() {
        let face_status = face.get("status").and_then(Value::as_str).unwrap_or("missing");
        if face_status != "loaded" {
            problems.push(format!(
                "font face {} is {face_status}",
                face.get("family").and_then(Value::as_str).unwrap_or("?")
            ));
        }
    }
    let images = diagnostics.get("images").and_then(Value::as_array);
    if images.is_none() {
        problems.push("image readiness was not reported".into());
    }
    for image in images.into_iter().flatten() {
        let ok = image.get("complete").and_then(Value::as_bool) == Some(true)
            && image.get("decoded").and_then(Value::as_bool) == Some(true)
            && image.get("naturalWidth").and_then(Value::as_u64).unwrap_or(0) > 0;
        if !ok {
            problems.push(format!(
                "image {} is not decoded",
                image.get("assetId").and_then(Value::as_str).unwrap_or("?")
            ));
        }
    }
    if problems.is_empty() {
        Ok(())
    } else {
        Err(format!("Print view is not ready: {}", problems.join("; ")))
    }
}

/// Runs once in the isolated client world at document start: records CSP violations.
pub const VIOLATION_RECORDER_JS: &str = r#"(() => {
  const violations = [];
  window.__pwPrint = { violations };
  document.addEventListener("securitypolicyviolation", (e) => {
    violations.push({ blockedURI: String(e.blockedURI), directive: String(e.violatedDirective) });
  }, true);
})();"#;

/// Host-injected (isolated content world) readiness proof, run after the load finishes.
pub const READINESS_JS: &str = r#"
void document.body.offsetHeight;
const faces = [];
document.fonts.forEach((f) => faces.push(f));
await Promise.all(faces.map((f) => f.load().catch(() => null)));
await document.fonts.ready;
const imgs = Array.from(document.images);
const decoded = await Promise.all(imgs.map((i) => i.decode().then(() => true, () => false)));
void document.body.offsetHeight;
return JSON.stringify({
  fontsStatus: document.fonts.status,
  faces: faces.map((f) => ({ family: f.family, status: f.status })),
  images: imgs.map((i, k) => ({
    assetId: i.getAttribute("data-asset-id"),
    complete: i.complete,
    naturalWidth: i.naturalWidth,
    decoded: decoded[k],
  })),
  violations: window.__pwPrint ? window.__pwPrint.violations : null,
  resources: performance.getEntriesByType("resource").map((e) => e.name),
  pageScriptRan: document.documentElement.hasAttribute("data-pw-page-script"),
  location: String(document.location.href),
  screenLayout: {
    innerWidth: window.innerWidth,
    devicePixelRatio: window.devicePixelRatio,
    sheetHeights: Array.from(document.querySelectorAll(".sheet"), (e) => Math.round(e.getBoundingClientRect().height)),
  },
  textLength: document.body ? document.body.innerText.length : 0,
});
"#;

#[cfg(target_os = "macos")]
mod macos {
    use super::*;
    use block2::{DynBlock, RcBlock};
    use std::cell::{Cell, RefCell};
    use std::ffi::c_void;
    use std::rc::Rc;
    use std::time::{Duration, Instant};

    use objc2::{
        define_class, msg_send,
        rc::Retained,
        runtime::{AnyObject, Bool, NSObject, ProtocolObject},
        sel, DefinedClass, MainThreadMarker, MainThreadOnly,
    };
    use objc2_app_kit::{
        NSBackingStoreType, NSPrintInfo, NSPrintJobSavingURL, NSPrintOperation, NSPrintSaveJob,
        NSPrintingPaginationMode, NSWindow, NSWindowStyleMask,
    };
    use objc2_foundation::{
        ns_string, NSCopying, NSDate, NSError, NSObjectProtocol, NSPoint, NSRect, NSRunLoop,
        NSSize, NSString, NSURL,
    };
    use objc2_web_kit::{
        WKContentWorld, WKInactiveSchedulingPolicy, WKNavigation, WKNavigationAction,
        WKNavigationActionPolicy, WKNavigationDelegate, WKPreferences, WKUserScript, WKUserScriptInjectionTime, WKWebView,
        WKWebViewConfiguration, WKWebpagePreferences, WKWebsiteDataStore,
    };

    #[derive(Default)]
    pub struct State {
        finished: Cell<bool>,
        failed: RefCell<Option<String>>,
        allowed: RefCell<Option<String>>,
        blocked: RefCell<Vec<String>>,
        printed: Cell<Option<bool>>,
        script: RefCell<Option<Result<String, String>>>,
    }

    define_class!(
        #[unsafe(super(NSObject))]
        #[thread_kind = MainThreadOnly]
        #[ivars = Rc<State>]
        pub struct PrintDelegate;

        unsafe impl NSObjectProtocol for PrintDelegate {}

        unsafe impl WKNavigationDelegate for PrintDelegate {
            #[unsafe(method(webView:decidePolicyForNavigationAction:decisionHandler:))]
            unsafe fn decide_policy(
                &self,
                _web_view: &WKWebView,
                action: &WKNavigationAction,
                handler: &DynBlock<dyn Fn(WKNavigationActionPolicy)>,
            ) {
                let url = action
                    .request()
                    .URL()
                    .and_then(|u| u.absoluteString())
                    .map(|s| s.to_string())
                    .unwrap_or_default();
                let state = self.ivars();
                // Only the first navigation (the in-memory document) may load; its URL is
                // reported so the harness can assert it was the opaque about:blank origin.
                if state.allowed.borrow().is_none() {
                    *state.allowed.borrow_mut() = Some(url);
                    handler.call((WKNavigationActionPolicy::Allow,));
                } else {
                    state.blocked.borrow_mut().push(url);
                    handler.call((WKNavigationActionPolicy::Cancel,));
                }
            }

            #[unsafe(method(webView:didFinishNavigation:))]
            unsafe fn did_finish(&self, _web_view: &WKWebView, _navigation: Option<&WKNavigation>) {
                self.ivars().finished.set(true);
            }

            #[unsafe(method(webView:didFailNavigation:withError:))]
            unsafe fn did_fail(
                &self,
                _web_view: &WKWebView,
                _navigation: Option<&WKNavigation>,
                error: &NSError,
            ) {
                *self.ivars().failed.borrow_mut() = Some(error.localizedDescription().to_string());
            }

            #[unsafe(method(webView:didFailProvisionalNavigation:withError:))]
            unsafe fn did_fail_provisional(
                &self,
                _web_view: &WKWebView,
                _navigation: Option<&WKNavigation>,
                error: &NSError,
            ) {
                *self.ivars().failed.borrow_mut() = Some(error.localizedDescription().to_string());
            }
        }

        impl PrintDelegate {
            #[unsafe(method(printOperationDidRun:success:contextInfo:))]
            fn print_did_run(&self, _operation: &NSPrintOperation, success: Bool, _context: *mut c_void) {
                self.ivars().printed.set(Some(success.as_bool()));
            }
        }
    );

    fn pump_until(done: impl Fn() -> bool, timeout: Duration, what: &str) -> Result<(), String> {
        let start = Instant::now();
        let run_loop = NSRunLoop::currentRunLoop();
        let modes = [ns_string!("kCFRunLoopDefaultMode"), ns_string!("NSModalPanelRunLoopMode")];
        let mut turn = 0usize;
        while !done() {
            if start.elapsed() > timeout {
                return Err(format!("{what} did not finish within {} s", timeout.as_secs()));
            }
            let until = NSDate::dateWithTimeIntervalSinceNow(0.05);
            if !run_loop.runMode_beforeDate(modes[turn % 2], &until) {
                // That mode had no input sources; avoid spinning.
                std::thread::sleep(Duration::from_millis(5));
            }
            turn += 1;
        }
        Ok(())
    }

    /// How the print operation is run. Smoke builds may select the synchronous form for
    /// diagnosis; the default is the documented window-modal form.
    fn synchronous_run() -> bool {
        #[cfg(feature = "native-smoke")]
        {
            std::env::var("FOLIO_SMOKE_PRINT_RUN").as_deref() == Ok("sync")
        }
        #[cfg(not(feature = "native-smoke"))]
        {
            false
        }
    }

    pub fn render_on_main(job: PrintJob, lockdown: bool) -> Result<(Vec<u8>, Value), String> {
        let mtm = MainThreadMarker::new()
            .ok_or_else(|| "Native printing must run on the macOS main thread".to_string())?;
        let state = Rc::new(State::default());
        let t0 = Instant::now();
        // Stage breadcrumbs on stderr (the harness captures it per launch).
        let mark = |stage: &str| eprintln!("[render_pdf {:>7} ms] {stage}", t0.elapsed().as_millis());
        mark("start");
        // WebKit re-lays the document out for printing independently of this view size (probe
        // runs 20261025T070345Z and 20261025T071* gave identical output at 612 and 624 px).
        let frame = NSRect::new(NSPoint::new(0.0, 0.0), NSSize::new(job.paper.width, job.paper.height));

        let (web_view, window, delegate) = unsafe {
            let config = WKWebViewConfiguration::new(mtm);
            config.setWebsiteDataStore(&WKWebsiteDataStore::nonPersistentDataStore(mtm));
            let page_prefs = WKWebpagePreferences::new(mtm);
            page_prefs.setAllowsContentJavaScript(!lockdown);
            config.setDefaultWebpagePreferences(Some(&page_prefs));
            // The print view is never on screen; without this WebKit suspends its web
            // process as an inactive view and loading, readiness and printing stall.
            let prefs = WKPreferences::new(mtm);
            prefs.setInactiveSchedulingPolicy(WKInactiveSchedulingPolicy::None);
            config.setPreferences(&prefs);
            let world = WKContentWorld::defaultClientWorld(mtm);
            let recorder = WKUserScript::initWithSource_injectionTime_forMainFrameOnly_inContentWorld(
                mtm.alloc(),
                &NSString::from_str(VIOLATION_RECORDER_JS),
                WKUserScriptInjectionTime::AtDocumentStart,
                true,
                &world,
            );
            config.userContentController().addUserScript(&recorder);

            let web_view = WKWebView::initWithFrame_configuration(mtm.alloc(), frame, &config);
            let delegate: Retained<PrintDelegate> = {
                let this = mtm.alloc::<PrintDelegate>().set_ivars(state.clone());
                msg_send![super(this), init]
            };
            web_view.setNavigationDelegate(Some(ProtocolObject::from_ref(&*delegate)));

            // Offscreen, never ordered front; the print view needs a window to lay out in.
            let window = NSWindow::initWithContentRect_styleMask_backing_defer(
                mtm.alloc(),
                frame,
                NSWindowStyleMask::Borderless,
                NSBackingStoreType::Buffered,
                false,
            );
            window.setReleasedWhenClosed(false);
            window.setContentView(Some(&web_view));
            web_view.loadHTMLString_baseURL(&NSString::from_str(&job.html), None);
            (web_view, window, delegate)
        };

        let result = (|| {
            pump_until(
                || state.finished.get() || state.failed.borrow().is_some(),
                Duration::from_secs(90),
                "Print view load",
            )?;
            if let Some(error) = state.failed.borrow().clone() {
                return Err(format!("Print view failed to load: {error}"));
            }
            mark("loaded");

            let world = unsafe { WKContentWorld::defaultClientWorld(mtm) };
            let sink = state.clone();
            let completion = RcBlock::new(move |value: *mut AnyObject, error: *mut NSError| {
                let outcome = if !error.is_null() {
                    Err(unsafe { &*error }.localizedDescription().to_string())
                } else if value.is_null() {
                    Err("readiness script returned nothing".to_string())
                } else {
                    match unsafe { &*value }.downcast_ref::<NSString>() {
                        Some(text) => Ok(text.to_string()),
                        None => Err("readiness script returned a non-string value".to_string()),
                    }
                };
                *sink.script.borrow_mut() = Some(outcome);
            });
            unsafe {
                web_view.callAsyncJavaScript_arguments_inFrame_inContentWorld_completionHandler(
                    &NSString::from_str(READINESS_JS),
                    None,
                    None,
                    &world,
                    Some(&completion),
                );
            }
            pump_until(|| state.script.borrow().is_some(), Duration::from_secs(90), "Font and image readiness")?;
            let report = state.script.borrow_mut().take().unwrap_or_else(|| Err("missing".into()));
            let report = report.map_err(|e| format!("Print view readiness is unobservable: {e}"))?;
            let mut diagnostics: Value =
                serde_json::from_str(&report).map_err(|e| format!("Readiness report is not JSON: {e}"))?;
            mark("readiness reported");
            check_readiness(&diagnostics)?;

            let temp = tempfile::tempdir().map_err(|e| format!("Temporary folder error: {e}"))?;
            let pdf_path = temp.path().join("print.pdf");
            let file_url = NSURL::fileURLWithPath(&NSString::from_str(&pdf_path.to_string_lossy()));
            let print_info = NSPrintInfo::sharedPrintInfo().copy();
            print_info.setPaperSize(NSSize::new(job.paper.width, job.paper.height));
            print_info.setTopMargin(job.margin_pt);
            print_info.setBottomMargin(job.margin_pt);
            print_info.setLeftMargin(job.margin_pt);
            print_info.setRightMargin(job.margin_pt);
            unsafe {
                let _: () = msg_send![&*print_info, setOrientation: 0isize];
            }
            print_info.setHorizontalPagination(NSPrintingPaginationMode::Automatic);
            print_info.setVerticalPagination(NSPrintingPaginationMode::Automatic);
            print_info.setHorizontallyCentered(false);
            print_info.setVerticallyCentered(false);
            // AppKit's exported constants: the saving-URL key's value is "NSJobSavingURL", so a
            // literal "NSPrintJobSavingURL" is ignored and AppKit opens a modal Save PDF panel.
            unsafe {
                print_info.setJobDisposition(NSPrintSaveJob);
                let key: &ProtocolObject<dyn NSCopying> = ProtocolObject::from_ref(NSPrintJobSavingURL);
                print_info.dictionary().setObject_forKey(&file_url, key);
            }

            let operation: Retained<NSPrintOperation> =
                unsafe { web_view.printOperationWithPrintInfo(&print_info) };
            operation.setShowsPrintPanel(false);
            operation.setShowsProgressPanel(false);
            if let Some(view) = operation.view() {
                view.setFrame(web_view.frame());
            }
            let synchronous = synchronous_run();
            mark(if synchronous { "print start (sync)" } else { "print start (window-modal)" });
            if synchronous {
                let ok = operation.runOperation();
                state.printed.set(Some(ok));
            } else {
                unsafe {
                    operation.runOperationModalForWindow_delegate_didRunSelector_contextInfo(
                        &window,
                        Some(&delegate),
                        Some(sel!(printOperationDidRun:success:contextInfo:)),
                        std::ptr::null_mut(),
                    );
                }
                pump_until(|| state.printed.get().is_some(), Duration::from_secs(180), "Print operation")?;
            }
            mark("print finished");
            if state.printed.get() != Some(true) {
                return Err("NSPrintOperation reported failure".into());
            }
            let bytes = std::fs::read(&pdf_path)
                .map_err(|e| format!("The print operation wrote no PDF: {e}"))?;
            diagnostics["allowedNavigation"] = serde_json::json!(state.allowed.borrow().clone());
            diagnostics["blockedNavigations"] = serde_json::json!(state.blocked.borrow().clone());
            diagnostics["runMode"] = serde_json::json!(if synchronous { "sync" } else { "window-modal" });
            diagnostics["lockdown"] = serde_json::json!(lockdown);
            Ok((bytes, diagnostics))
        })();

        mark(match &result {
            Ok(_) => "cleanup after success".to_string(),
            Err(e) => format!("cleanup after error: {e}"),
        }
        .as_str());
        unsafe {
            web_view.stopLoading();
            web_view.setNavigationDelegate(None);
        }
        window.setContentView(None);
        window.close();
        drop(delegate);
        mark("done");
        result
    }
}

/// Smoke builds can disable the lockdown for one negative control run that proves the
/// harness's external-load counter observes WebKit. Normal builds never read this.
fn lockdown_enabled() -> bool {
    #[cfg(feature = "native-smoke")]
    {
        std::env::var("FOLIO_SMOKE_PRINT_CONTROL").as_deref() != Ok("unlocked")
    }
    #[cfg(not(feature = "native-smoke"))]
    {
        true
    }
}

/// Renders a validated snapshot's print markup to PDF bytes with WebKit's paginated printer.
#[tauri::command]
pub async fn render_pdf(app: tauri::AppHandle, request: PrintRequest) -> Result<RenderedPdf, String> {
    let lockdown = lockdown_enabled();
    let job = prepare(&request, lockdown)?;
    let source_revision = request.snapshot.revision;

    #[cfg(target_os = "macos")]
    {
        let (tx, rx) = std::sync::mpsc::sync_channel(1);
        app.run_on_main_thread(move || {
            let _ = tx.send(macos::render_on_main(job, lockdown));
        })
        .map_err(|e| format!("Could not reach the macOS main thread: {e}"))?;
        let (bytes, diagnostics) = rx
            .recv()
            .map_err(|e| format!("The print operation ended without a result: {e}"))??;
        let page_count = pdf_page_count(&bytes)?;
        let mut warnings = Vec::new();
        if let Some(blocked) = diagnostics.get("blockedNavigations").and_then(Value::as_array) {
            if !blocked.is_empty() {
                warnings.push(format!("Blocked {} navigation attempt(s) in print markup", blocked.len()));
            }
        }
        if let Some(violations) = diagnostics.get("violations").and_then(Value::as_array) {
            if !violations.is_empty() {
                warnings.push(format!("Blocked {} resource request(s) in print markup", violations.len()));
            }
        }
        Ok(RenderedPdf {
            bytes_base64: base64::engine::general_purpose::STANDARD.encode(&bytes),
            page_count,
            warnings,
            source_revision,
            diagnostics,
        })
    }

    #[cfg(not(target_os = "macos"))]
    {
        let _ = (app, job, source_revision);
        Err("Native PDF printing is available only on macOS".to_string())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    const ENTRY: &str = "7a2c9e44-1b3d-4f55-8c66-9d7e0f1a2b3c";

    fn png() -> Vec<u8> {
        crate::assets::tests::png(3, 2)
    }

    fn snapshot(image: Option<&str>) -> store::Project {
        let mut content = vec![json!({"type": "paragraph", "content": [{"type": "text", "text": "Body"}]})];
        if let Some(id) = image {
            content.push(json!({"type": "image", "attrs": {"assetId": id, "alt": "a"}}));
        }
        serde_json::from_value(json!({
            "id": "6f1b8f0e-2d7c-4c62-9a0e-2b8e8c1d4a10",
            "title": "Probe",
            "createdAt": "2026-10-25T00:00:00Z",
            "updatedAt": "2026-10-25T00:00:00Z",
            "revision": 4,
            "order": [ENTRY],
            "entries": [{
                "id": ENTRY, "kind": "section", "title": "S", "text": "Body",
                "updatedAt": "2026-10-25T00:00:00Z", "origin": null,
                "content": {"type": "doc", "content": content}
            }]
        }))
        .unwrap()
    }

    fn request(snapshot: store::Project, html: &str) -> PrintRequest {
        PrintRequest {
            snapshot,
            pages_html: html.into(),
            geometry: PrintGeometry { paper: "letter".into(), margin_inches: 1.0 },
            layout_version: "native-v2".into(),
        }
    }

    fn data_uri(bytes: &[u8]) -> String {
        format!("data:image/png;base64,{}", base64::engine::general_purpose::STANDARD.encode(bytes))
    }

    #[test]
    fn papers_and_margins_are_bounded() {
        assert_eq!(parse_paper("letter").unwrap(), Paper { width: 612.0, height: 792.0 });
        assert_eq!(parse_paper("a4").unwrap(), Paper { width: 595.28, height: 841.89 });
        assert!(parse_paper("tabloid").is_err());
        let mut r = request(snapshot(None), "<p>x</p>");
        r.geometry.margin_inches = 5.0;
        assert!(prepare(&r, true).unwrap_err().contains("margins"));
        r.geometry.margin_inches = f64::NAN;
        assert!(prepare(&r, true).is_err());
    }

    #[test]
    fn rejects_wrong_layout_version_invalid_snapshot_and_oversize_markup() {
        let mut r = request(snapshot(None), "<p>x</p>");
        r.layout_version = "legacy-v1".into();
        assert!(prepare(&r, true).unwrap_err().contains("layout version"));
        let mut bad = snapshot(None);
        bad.id = "not-a-uuid".into();
        assert!(prepare(&request(bad, "<p>x</p>"), true).is_err());
        let big = "x".repeat(MAX_HTML_BYTES + 1);
        assert!(prepare(&request(snapshot(None), &big), true).unwrap_err().contains("size limit"));
    }

    #[test]
    fn image_sources_must_be_this_snapshots_assets() {
        let bytes = png();
        let id = format!("{:x}", Sha256::digest(&bytes));
        let ok = format!("<p>a</p><img src=\"{}\" data-asset-id=\"{id}\">", data_uri(&bytes));
        assert!(prepare(&request(snapshot(Some(&id)), &ok), true).is_ok());
        // Same bytes, but the snapshot does not reference them.
        assert!(prepare(&request(snapshot(None), &ok), true).unwrap_err().contains("approved"));
        for hostile in [
            "<img src=\"http://127.0.0.1:9/x.png\">",
            "<IMG SRC='file:///etc/hosts'>",
            "<iframe src=about:blank></iframe>",
            "<img srcset=\"x.png 1x\">",
        ] {
            assert!(prepare(&request(snapshot(Some(&id)), hostile), true).is_err(), "{hostile}");
        }
        // Escaped prose and CSS bodies are not tags.
        let prose = "<p>&lt;img src=&quot;http://x/&quot;&gt; src=http://x</p><style>.a{src:url(x)} /* <img src=x> */</style>";
        assert!(prepare(&request(snapshot(None), prose), true).is_ok());
    }

    #[test]
    fn host_csp_precedes_supplied_markup() {
        let html = wrap_document("<!DOCTYPE html><html><head><img src=x>", true);
        let csp = html.find("Content-Security-Policy").unwrap();
        assert!(csp < html.find("<img").unwrap());
        assert!(html.contains("default-src 'none'"));
        assert!(!wrap_document("<p>x</p>", false).contains("Content-Security-Policy"));
    }

    #[test]
    fn counts_pdf_page_objects_not_the_page_tree() {
        let pdf = b"%PDF-1.3\n1 0 obj << /Type /Pages /Count 2 >>\n2 0 obj << /Type /Page >>\n3 0 obj <</Type/Page/Parent 1 0 R>>\n";
        assert_eq!(pdf_page_count(pdf).unwrap(), 2);
        assert!(pdf_page_count(b"%PDF-1.3\n<< /Type /Pages /Count 0 >>").is_err());
        assert!(pdf_page_count(b"PNG").is_err());
    }

    #[test]
    fn readiness_requires_loaded_fonts_and_decoded_images() {
        let ready = json!({"fontsStatus": "loaded", "faces": [{"family": "F", "status": "loaded"}],
            "images": [{"assetId": "a", "complete": true, "decoded": true, "naturalWidth": 3}]});
        assert!(check_readiness(&ready).is_ok());
        let mut font = ready.clone();
        font["faces"][0]["status"] = json!("error");
        assert!(check_readiness(&font).unwrap_err().contains("font face F is error"));
        let mut loading = ready.clone();
        loading["fontsStatus"] = json!("loading");
        assert!(check_readiness(&loading).is_err());
        let mut image = ready.clone();
        image["images"][0]["decoded"] = json!(false);
        assert!(check_readiness(&image).unwrap_err().contains("not decoded"));
        assert!(check_readiness(&json!({"fontsStatus": "loaded"})).is_err());
    }
}
