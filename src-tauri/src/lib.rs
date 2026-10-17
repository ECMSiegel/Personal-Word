#[cfg(feature = "native-smoke")]
mod smoke;
mod lookup;
mod store;
use std::sync::{
    atomic::{AtomicBool, Ordering},
    Mutex,
};
use store::{Change, Listing, Project, Store, Version};
use tauri::{Emitter, Manager};
/// How often saved projects get their project.json and text copies rewritten.
const MIRROR_INTERVAL: std::time::Duration = std::time::Duration::from_secs(3);
/// The store, plus a lock that keeps portable-copy passes in order.
struct State(Mutex<Store>, Mutex<()>);
struct ExitAllowed(AtomicBool);
/// Runs a mirror pass and returns the first failure, so callers can block on it.
fn sync_mirrors(state: &State, only: Option<&str>) -> Result<(), String> {
    store::sync_mirrors(&state.0, &state.1, only)
        .into_iter()
        .map(|(_, r)| r)
        .collect()
}
#[tauri::command]
fn finish_quit(
    app: tauri::AppHandle,
    state: tauri::State<State>,
    allowed: tauri::State<ExitAllowed>,
) -> Result<(), String> {
    // Like a failed save, a failed portable copy keeps the app open so Retry can repair it.
    sync_mirrors(&state, None)?;
    allowed.0.store(true, Ordering::SeqCst);
    app.exit(0);
    Ok(())
}
#[tauri::command]
fn list_projects(state: tauri::State<State>) -> Result<Listing, String> {
    state.0.lock().map_err(|e| e.to_string())?.list()
}
#[tauri::command]
fn delete_project(id: String, state: tauri::State<State>) -> Result<(), String> {
    state.0.lock().map_err(|e| e.to_string())?.delete(&id)
}
#[tauri::command]
fn load_project(id: String, state: tauri::State<State>) -> Result<Project, String> {
    state.0.lock().map_err(|e| e.to_string())?.load(&id)
}
#[tauri::command]
fn save_changes(change: Change, state: tauri::State<State>) -> Result<(), String> {
    state
        .0
        .lock()
        .map_err(|e| e.to_string())?
        .save_changes(&change)
}
#[tauri::command]
fn flush_mirrors(id: String, state: tauri::State<State>) -> Result<(), String> {
    sync_mirrors(&state, Some(&id))
}
#[tauri::command]
fn create_snapshot(id: String, name: String, state: tauri::State<State>) -> Result<String, String> {
    state
        .0
        .lock()
        .map_err(|e| e.to_string())?
        .snapshot(&id, &name)
}
#[tauri::command]
fn list_versions(
    id: String,
    history: bool,
    state: tauri::State<State>,
) -> Result<Vec<Version>, String> {
    state
        .0
        .lock()
        .map_err(|e| e.to_string())?
        .versions(&id, history)
}
#[tauri::command]
fn load_version(
    id: String,
    key: String,
    history: bool,
    state: tauri::State<State>,
) -> Result<Project, String> {
    state
        .0
        .lock()
        .map_err(|e| e.to_string())?
        .version(&id, &key, history)
}
#[tauri::command]
fn export_file(path: String, data: String) -> Result<(), String> {
    store::atomic(std::path::Path::new(&path), data.as_bytes())
}
#[tauri::command]
fn export_bytes(path: String, data: Vec<u8>) -> Result<(), String> {
    store::atomic(std::path::Path::new(&path), &data)
}
#[tauri::command]
fn storage_path(state: tauri::State<State>) -> Result<String, String> {
    Ok(state
        .0
        .lock()
        .map_err(|e| e.to_string())?
        .root
        .display()
        .to_string())
}
pub fn run() {
    let builder = tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .setup(|app| {
            let root = app.path().app_data_dir()?.join("projects");
            #[cfg(feature = "native-smoke")]
            let root = std::env::var("FOLIO_SMOKE_DIR")
                .map(|dir| std::path::PathBuf::from(dir).join("projects"))
                .unwrap_or(root);
            app.manage(State(
                Mutex::new(Store::new(root).map_err(std::io::Error::other)?),
                Mutex::new(()),
            ));
            app.manage(ExitAllowed(AtomicBool::new(false)));
            let handle = app.handle().clone();
            std::thread::spawn(move || loop {
                std::thread::sleep(MIRROR_INTERVAL);
                let state = handle.state::<State>();
                for (id, result) in store::sync_mirrors(&state.0, &state.1, None) {
                    let _ = handle.emit(
                        "folio:mirror-status",
                        serde_json::json!({ "id": id, "error": result.err() }),
                    );
                }
            });
            Ok(())
        });
    #[cfg(feature = "native-smoke")]
    let builder = smoke::configure(builder).invoke_handler(tauri::generate_handler![
        list_projects,
        load_project,
        save_changes,
        flush_mirrors,
        create_snapshot,
        list_versions,
        load_version,
        storage_path,
        finish_quit,
        export_file,
        export_bytes,
        delete_project,
        lookup::lookup_fetch,
        smoke::smoke_report
    ]);
    #[cfg(not(feature = "native-smoke"))]
    let builder = builder.invoke_handler(tauri::generate_handler![
        list_projects,
        load_project,
        save_changes,
        flush_mirrors,
        create_snapshot,
        list_versions,
        load_version,
        storage_path,
        finish_quit,
        export_file,
        export_bytes,
        delete_project,
        lookup::lookup_fetch
    ]);
    builder
        .build(tauri::generate_context!())
        .expect("Could not launch Personal Word")
        .run(|app, event| {
            if let tauri::RunEvent::ExitRequested { api, .. } = event {
                if !app.state::<ExitAllowed>().0.load(Ordering::SeqCst) {
                    api.prevent_exit();
                    let _ = app.emit("folio:quit-requested", ());
                }
            }
        });
}
