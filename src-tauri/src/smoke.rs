//! Opt-in native WebView integration harness. Never included in release builds by default.
use crate::store::{Change, Header, Project};
use serde_json::{json, Value};
use std::{
    fs::{self, OpenOptions},
    io::Write,
    path::PathBuf,
    thread,
    time::Duration,
};
use tauri::{Manager, Runtime};
use uuid::Uuid;

const DIAGNOSTIC_PROTOCOL: &str = "d1-profile-isolation-v1";

#[derive(Clone, Copy, Debug)]
pub enum Fault {
    DropMetadata,
    SkipSafetySnapshot,
    PrematureSqlAck,
    MirrorWrite,
    CloseFlush,
    BypassCloseGuard,
    FullFsyncOff,
    SqlRollback,
    SqlDiskFull,
    SqlPermissionDenied,
}
impl Fault {
    fn parse(value: &str) -> Option<Self> {
        Some(match value {
            "drop-metadata" => Self::DropMetadata,
            "skip-safety-snapshot" => Self::SkipSafetySnapshot,
            "premature-sql-ack" => Self::PrematureSqlAck,
            "mirror-write" => Self::MirrorWrite,
            "close-flush" => Self::CloseFlush,
            "bypass-close-guard" => Self::BypassCloseGuard,
            "fullfsync-off" => Self::FullFsyncOff,
            "sql-rollback" => Self::SqlRollback,
            "sql-disk-full" => Self::SqlDiskFull,
            "sql-permission-denied" => Self::SqlPermissionDenied,
            _ => return None,
        })
    }
    fn name(self) -> &'static str {
        match self {
            Self::DropMetadata => "drop-metadata",
            Self::SkipSafetySnapshot => "skip-safety-snapshot",
            Self::PrematureSqlAck => "premature-sql-ack",
            Self::MirrorWrite => "mirror-write",
            Self::CloseFlush => "close-flush",
            Self::BypassCloseGuard => "bypass-close-guard",
            Self::FullFsyncOff => "fullfsync-off",
            Self::SqlRollback => "sql-rollback",
            Self::SqlDiskFull => "sql-disk-full",
            Self::SqlPermissionDenied => "sql-permission-denied",
        }
    }
}

fn work_dir() -> Result<PathBuf, String> {
    std::env::var_os("FOLIO_SMOKE_DIR")
        .map(PathBuf::from)
        .ok_or_else(|| "FOLIO_SMOKE_DIR is required for native diagnostics".into())
}

pub fn required_data_store_identifier() -> Result<[u8; 16], String> {
    let value = std::env::var("FOLIO_SMOKE_DATA_STORE_ID")
        .map_err(|_| "FOLIO_SMOKE_DATA_STORE_ID is required for native diagnostics".to_string())?;
    if value.len() != 32 || !value.bytes().all(|byte| byte.is_ascii_hexdigit()) {
        return Err("FOLIO_SMOKE_DATA_STORE_ID must be exactly 32 hexadecimal characters".into());
    }
    let mut identifier = [0u8; 16];
    for (index, byte) in identifier.iter_mut().enumerate() {
        *byte = u8::from_str_radix(&value[index * 2..index * 2 + 2], 16)
            .map_err(|error| error.to_string())?;
    }
    Ok(identifier)
}

fn identifier_hex(identifier: [u8; 16]) -> String {
    identifier.iter().map(|byte| format!("{byte:02x}")).collect()
}

/// Closes the window natively, raising the same CloseRequested event as the title-bar button.
#[tauri::command]
pub fn smoke_close_window(window: tauri::Window) -> Result<(), String> {
    window.close().map_err(|error| error.to_string())
}

#[tauri::command]
pub async fn diagnostic_profile_identity(app: tauri::AppHandle) -> Result<Value, String> {
    if app.config().identifier != "com.folio.smoke" {
        return Err("Native diagnostic app identifier is not com.folio.smoke".into());
    }
    #[cfg(target_vendor = "apple")]
    {
        let expected = required_data_store_identifier()?;
        let active = app
            .fetch_data_store_identifiers()
            .await
            .map_err(|error| format!("Could not query active WebKit data stores: {error}"))?;
        if !active.contains(&expected) {
            return Err("Configured isolated WebKit data store is not active".into());
        }
        return Ok(json!({
            "appIdentifier": app.config().identifier,
            "protocol": DIAGNOSTIC_PROTOCOL,
            "dataStoreIdentifier": identifier_hex(expected),
            "activeDataStoreIdentifiers": active.iter().copied().map(identifier_hex).collect::<Vec<_>>(),
        }));
    }
    #[cfg(not(target_vendor = "apple"))]
    Err("Native reliability profile validation requires an Apple WebKit runtime".into())
}

/// Arms a one-shot, named defect entirely inside the harness-owned directory.
#[tauri::command]
pub fn arm_fault(fault: String) -> Result<(), String> {
    let fault = Fault::parse(&fault).ok_or_else(|| format!("Unknown native fault: {fault}"))?;
    fs::write(work_dir()?.join(format!("fault-armed-{}", fault.name())), b"armed")
        .map_err(|e| e.to_string())
}

/// Returns true once for an armed fault. The marker makes concurrent mirror and save
/// paths deterministic without changing process-wide state or touching other files.
pub fn take_fault(fault: Fault) -> bool {
    let Ok(dir) = work_dir() else { return false };
    if !dir.join(format!("fault-armed-{}", fault.name())).is_file() {
        return false;
    }
    OpenOptions::new()
        .write(true)
        .create_new(true)
        .open(dir.join(format!("fault-used-{}", fault.name())))
        .is_ok()
}

/// Requests a checkpoint at a named persistence boundary. The harness kills only its
/// own process after reading the checkpoint file.
#[tauri::command]
pub fn arm_checkpoint(point: String) -> Result<(), String> {
    if !["pre-commit", "post-commit-pre-mirror", "post-mirror"].contains(&point.as_str()) {
        return Err(format!("Unknown native checkpoint: {point}"));
    }
    fs::write(work_dir()?.join(format!("checkpoint-request-{point}")), b"armed")
        .map_err(|e| e.to_string())
}

pub fn checkpoint(point: &str, revision: i64) -> Result<(), String> {
    let Ok(dir) = work_dir() else { return Ok(()) };
    if !dir.join(format!("checkpoint-request-{point}")).is_file() {
        return Ok(());
    }
    let claimed = dir.join(format!("checkpoint-claimed-{point}"));
    if OpenOptions::new()
        .write(true)
        .create_new(true)
        .open(claimed)
        .is_err()
    {
        return Ok(());
    }
    fs::write(
        dir.join(format!("checkpoint-{point}.json")),
        serde_json::to_vec_pretty(&json!({
            "point": point,
            "revision": revision,
            "pid": std::process::id(),
        }))
        .map_err(|e| e.to_string())?,
    )
    .map_err(|e| e.to_string())?;
    loop {
        if dir.join(format!("checkpoint-resume-{point}")).exists() {
            return Ok(());
        }
        thread::sleep(Duration::from_millis(20));
    }
}

pub fn record_window_close() {
    let Ok(dir) = work_dir() else { return };
    let result = OpenOptions::new()
        .create(true)
        .append(true)
        .open(dir.join("window-close-events.log"))
        .and_then(|mut file| writeln!(file, "{}", std::process::id()));
    if let Err(error) = result {
        eprintln!("Could not record native close event: {error}");
    }
}

fn header(project: &Project) -> Header {
    Header {
        id: project.id.clone(),
        title: project.title.clone(),
        created_at: project.created_at.clone(),
        updated_at: project.updated_at.clone(),
        revision: project.revision,
        order: project.order.clone(),
        entry_ids: project.entries.iter().map(|entry| entry.id.clone()).collect(),
        extra: project.extra.clone(),
    }
}

/// Adds representative flattened metadata to a harness-created project through one
/// sparse save, then changes only one entry in another sparse save. Returns the current
/// canonical project and the metadata-bearing revision as read back from SQLite.
#[tauri::command]
pub fn seed_durability_metadata(
    app: tauri::AppHandle,
    project_id: String,
) -> Result<Value, String> {
    let state = app.state::<crate::State>();
    let mut store = state.0.lock().map_err(|e| e.to_string())?;
    let mut project = store.read(&project_id)?;
    if project.entries.is_empty() {
        return Err("The native metadata fixture has no entries".into());
    }
    let base_revision = project.revision;
    let mut unchanged = project.entries[0].clone();
    unchanged.id = Uuid::new_v4().to_string();
    unchanged.kind = "section".into();
    unchanged.title = "Unchanged metadata entry".into();
    unchanged.text = "Unchanged native entry content.".into();
    unchanged.content = json!({
        "type":"doc",
        "content":[{"type":"paragraph","content":[{"type":"text","text":unchanged.text.clone()}]}]
    });
    unchanged.updated_at = chrono::Utc::now().to_rfc3339();
    unchanged.origin = None;
    unchanged.extra.clear();
    unchanged.extra.insert("tags".into(), json!(["d1","untouched"]));
    unchanged.extra.insert(
        "synopsis".into(),
        json!("Unchanged entry metadata survives a later sparse save"),
    );
    project.order.push(unchanged.id.clone());
    project.entries.push(unchanged.clone());
    project.extra.insert(
        "research".into(),
        json!({
            "sources":[{"id":"source-d1","kind":"book","title":"Bounded durability","authors":[]}],
            "notes":[{"id":"note-d1","text":"Research note survives sparse save"}],
            "footnotes":[{"id":"footnote-d1","text":"Footnote survives sparse save","form":"short"}]
        }),
    );
    project.extra.insert(
        "annotations".into(),
        json!([{"id":"comment-d1","entryId":project.entries[0].id,"quote":"Keep this.","text":"Annotation survives sparse save","resolved":false}]),
    );
    project.extra.insert(
        "documentSettings".into(),
        json!({"fontFamily":"serif","fontSize":12,"lineSpacing":2}),
    );
    project.extra.insert(
        "pageLayout".into(),
        json!({"mode":"pages","paper":"letter","margin":96,"zoom":100}),
    );
    project.extra.insert("goals".into(), json!({"dailyWords":500}));
    project.extra.insert(
        "sidebarOrder".into(),
        json!(["research","manuscript","comments"]),
    );
    project.extra.insert(
        "additiveD1Field".into(),
        json!({"kept":true,"nested":["alpha","beta"]}),
    );
    project.entries[0]
        .extra
        .insert("tags".into(), json!(["d1","source-alpha"]));
    project.entries[0]
        .extra
        .insert("synopsis".into(), json!("Entry metadata before second sparse save"));
    project.revision += 1;
    let first_sparse_revision = project.revision;
    let changed = project.entries[0].clone();
    store.save_changes(&Change {
        header: header(&project),
        entries: vec![changed, unchanged],
        base_revision: Some(base_revision),
    })?;

    project.revision += 1;
    project.extra["goals"] = json!({"dailyWords":750,"deadline":"2026-12-31"});
    project.entries[0]
        .extra
        .insert("tags".into(), json!(["d1","source-alpha","revised"]));
    let changed = project.entries[0].clone();
    store.save_changes(&Change {
        header: header(&project),
        entries: vec![changed],
        base_revision: Some(first_sparse_revision),
    })?;

    let current = store.read(&project_id)?;
    let history = store.version(&project_id, &first_sparse_revision.to_string(), true)?;
    Ok(json!({
        "current": current,
        "history": history,
        "firstSparseRevision": first_sparse_revision,
    }))
}

#[tauri::command]
pub fn verify_safety_snapshot(app: tauri::AppHandle, project_id: String) -> Result<Value, String> {
    let state = app.state::<crate::State>();
    let store = state.0.lock().map_err(|e| e.to_string())?;
    let versions = store.versions(&project_id, false)?;
    let version = versions
        .iter()
        .find(|version| version.name == "Before restoring D1 baseline")
        .ok_or_else(|| "The generated pre-restore safety snapshot is missing".to_string())?;
    let project = store.version(&project_id, &version.id, false)?;
    Ok(json!({"name": version.name, "project": project}))
}

#[tauri::command]
pub fn sqlite_sync_settings(app: tauri::AppHandle, project_id: String) -> Result<Value, String> {
    let state = app.state::<crate::State>();
    let store = state.0.lock().map_err(|e| e.to_string())?;
    store.sqlite_sync_settings(&project_id)
}

#[tauri::command]
pub fn mark_mirrors_pending(app: tauri::AppHandle, project_id: String) -> Result<(), String> {
    let state = app.state::<crate::State>();
    let mut store = state.0.lock().map_err(|e| e.to_string())?;
    let project = store.read(&project_id)?;
    store.save_changes(&Change {
        header: header(&project),
        entries: project.entries.clone(),
        base_revision: Some(project.revision),
    })
}

#[tauri::command]
pub fn smoke_report(app: tauri::AppHandle, mut report: Value) -> Result<(), String> {
    let dir = work_dir()?;
    let phase = std::env::var("FOLIO_SMOKE_PHASE").unwrap_or_else(|_| "1".into());
    report["diagnosticAppIdentifier"] = json!(app.config().identifier);
    report["diagnosticProtocol"] = json!(DIAGNOSTIC_PROTOCOL);
    report["diagnosticDataStoreIdentifier"] = json!(
        required_data_store_identifier().map(identifier_hex).ok()
    );
    fs::write(
        dir.join(format!("report-{phase}.json")),
        serde_json::to_vec_pretty(&report).map_err(|e| e.to_string())?,
    )
    .map_err(|e| e.to_string())?;
    // Phase 2 stays open for harness-owned termination or an actual window-close test.
    // Other phases exit through the real ExitRequested path.
    if phase != "2" {
        app.exit(0);
    }
    Ok(())
}

/// Appends a harness breadcrumb so a stalled run names the step it reached.
#[tauri::command]
pub fn smoke_progress(message: String) -> Result<(), String> {
    let dir = work_dir()?;
    let path = dir.join("progress.log");
    let mut file = OpenOptions::new()
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
        let scenario = std::env::var("FOLIO_SMOKE_SCENARIO").unwrap_or_default();
        let run = std::env::var("FOLIO_SMOKE_RUN").unwrap_or_default();
        let invocation = std::env::var("FOLIO_SMOKE_INVOCATION").unwrap_or_default();
        let script = if std::env::var("FOLIO_SMOKE_SCRIPT").unwrap_or_default()
            == "native-reliability"
        {
            include_str!("../../tests/native-reliability.js")
        } else {
            include_str!("../../tests/native-smoke.js")
        };
        let script = format!(
            "window.__SMOKE_PHASE__={};window.__SMOKE_SCENARIO__={};window.__SMOKE_RUN__={};window.__SMOKE_INVOCATION__={};window.__SMOKE_DATA_STORE_ID__={};{}",
            serde_json::to_string(&phase).unwrap(),
            serde_json::to_string(&scenario).unwrap(),
            serde_json::to_string(&run).unwrap(),
            serde_json::to_string(&invocation).unwrap(),
            serde_json::to_string(&std::env::var("FOLIO_SMOKE_DATA_STORE_ID").unwrap_or_default()).unwrap(),
            script
        );
        if let Err(error) = webview.eval(&script) {
            eprintln!("Native smoke injection failed: {error}");
            webview.app_handle().exit(1);
        }
    })
}
