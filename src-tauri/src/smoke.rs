//! Opt-in native WebView integration harness. Never included in release builds by default.
use tauri::{Manager, Runtime};
#[tauri::command]
pub fn smoke_report(app: tauri::AppHandle, report: serde_json::Value) -> Result<(), String> {
    let dir = std::env::var("FOLIO_SMOKE_DIR").map_err(|e| e.to_string())?;
    let phase = std::env::var("FOLIO_SMOKE_PHASE").unwrap_or_else(|_| "1".into());
    std::fs::write(
        std::path::Path::new(&dir).join(format!("report-{phase}.json")),
        serde_json::to_vec_pretty(&report).map_err(|e| e.to_string())?,
    )
    .map_err(|e| e.to_string())?;
    // Phase 2 stays open for the Python harness to terminate it after the SQLite checkpoint.
    // Other phases exit through the real ExitRequested guard, which asks the frontend to
    // flush its save queue before finish_quit syncs mirrors and allows the exit.
    if phase != "2" {
        app.exit(0);
    }
    Ok(())
}
/// Appends a harness breadcrumb so a stalled run names the step it reached.
#[tauri::command]
pub fn smoke_progress(message: String) -> Result<(), String> {
    use std::io::Write;
    let dir = std::env::var("FOLIO_SMOKE_DIR").map_err(|e| e.to_string())?;
    let path = std::path::Path::new(&dir).join("progress.log");
    let mut file = std::fs::OpenOptions::new()
        .create(true)
        .append(true)
        .open(&path)
        .map_err(|e| e.to_string())?;
    writeln!(file, "{message}").map_err(|e| e.to_string())?;
    file.flush().map_err(|e| e.to_string())
}
pub fn configure<R: Runtime>(builder: tauri::Builder<R>) -> tauri::Builder<R> {
    builder.on_page_load(|webview, event| {
        if event.event() != tauri::webview::PageLoadEvent::Finished
            || std::env::var("FOLIO_SMOKE_DIR").is_err()
        {
            return;
        }
        let phase = std::env::var("FOLIO_SMOKE_PHASE").unwrap_or_else(|_| "1".into());
        let script = format!(
            "window.__SMOKE_PHASE__={};{}",
            serde_json::to_string(&phase).unwrap(),
            include_str!("../../tests/native-smoke.js")
        );
        if let Err(error) = webview.eval(&script) {
            eprintln!("Native smoke injection failed: {error}");
            webview.app_handle().exit(1);
        }
    })
}
