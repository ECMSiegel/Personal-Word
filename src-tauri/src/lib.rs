#[cfg(feature = "native-smoke")]
mod smoke;
mod store;
use std::sync::{
    atomic::{AtomicBool, Ordering},
    Mutex,
};
use store::{Project, Store, Summary, Version};
use tauri::{Emitter, Manager};
struct State(Mutex<Store>);
struct ExitAllowed(AtomicBool);
#[tauri::command]
fn finish_quit(app: tauri::AppHandle, allowed: tauri::State<ExitAllowed>) {
    allowed.0.store(true, Ordering::SeqCst);
    app.exit(0);
}
#[tauri::command]
fn list_projects(state: tauri::State<State>) -> Result<Vec<Summary>, String> {
    state.0.lock().map_err(|e| e.to_string())?.list()
}
#[tauri::command]
fn load_project(id: String, state: tauri::State<State>) -> Result<Project, String> {
    state.0.lock().map_err(|e| e.to_string())?.load(&id)
}
#[tauri::command]
fn save_project(project: Project, state: tauri::State<State>) -> Result<(), String> {
    state.0.lock().map_err(|e| e.to_string())?.save(&project)
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
            app.manage(State(Mutex::new(
                Store::new(root).map_err(std::io::Error::other)?,
            )));
            app.manage(ExitAllowed(AtomicBool::new(false)));
            Ok(())
        });
    #[cfg(feature = "native-smoke")]
    let builder = smoke::configure(builder).invoke_handler(tauri::generate_handler![
        list_projects,
        load_project,
        save_project,
        create_snapshot,
        list_versions,
        load_version,
        storage_path,
        finish_quit,
        export_file,
        smoke::smoke_report
    ]);
    #[cfg(not(feature = "native-smoke"))]
    let builder = builder.invoke_handler(tauri::generate_handler![
        list_projects,
        load_project,
        save_project,
        create_snapshot,
        list_versions,
        load_version,
        storage_path,
        finish_quit,
        export_file
    ]);
    builder
        .build(tauri::generate_context!())
        .expect("Could not launch Folio")
        .run(|app, event| {
            if let tauri::RunEvent::ExitRequested { api, .. } = event {
                if !app.state::<ExitAllowed>().0.load(Ordering::SeqCst) {
                    api.prevent_exit();
                    let _ = app.emit("folio:quit-requested", ());
                }
            }
        });
}
