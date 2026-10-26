#[cfg(feature = "native-smoke")]
mod smoke;
mod lookup;
mod zotero;
mod assets;
mod dropped;
mod store;
// Layout L1 print probe: the command is registered only in native-smoke builds.
#[cfg_attr(not(feature = "native-smoke"), allow(dead_code))]
mod printing;
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
struct InstanceLock(std::fs::File);
impl Drop for InstanceLock {
    fn drop(&mut self) {
        #[cfg(unix)]
        unsafe { libc::flock(std::os::fd::AsRawFd::as_raw_fd(&self.0), libc::LOCK_UN); }
    }
}
/// Runs a mirror pass and returns the first failure, so callers can block on it.
fn sync_mirrors(state: &State, only: Option<&str>) -> Result<(), String> {
    store::sync_mirrors(&state.0, &state.1, only)
        .into_iter()
        .map(|(_, r)| r)
        .collect()
}
#[cfg(feature = "native-smoke")]
fn sync_mirrors_for_close(state: &State) -> Result<(), String> {
    store::sync_mirrors_for_close(&state.0, &state.1)
        .into_iter()
        .map(|(_, result)| result)
        .collect()
}
#[tauri::command]
fn finish_quit(
    app: tauri::AppHandle,
    state: tauri::State<State>,
    allowed: tauri::State<ExitAllowed>,
) -> Result<(), String> {
    #[cfg(feature = "native-smoke")]
    let mirror_result = sync_mirrors_for_close(&state);
    #[cfg(not(feature = "native-smoke"))]
    let mirror_result = sync_mirrors(&state, None);
    if let Err(error) = mirror_result {
        #[cfg(feature = "native-smoke")]
        if crate::smoke::take_fault(crate::smoke::Fault::BypassCloseGuard) {
            // Negative control: exit only after the normal close mirror path reports failure.
            allowed.0.store(true, Ordering::SeqCst);
            app.exit(0);
            return Ok(());
        }
        return Err(error);
    }
    // Like a failed save, a failed portable copy keeps the app open so Retry can repair it.
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
fn stage_assets(
    project_id: String,
    assets: Vec<assets::AssetUpload>,
    state: tauri::State<State>,
) -> Result<Vec<assets::AssetMeta>, String> {
    state.0.lock().map_err(|e| e.to_string())?.stage_assets(&project_id, &assets)
}
#[tauri::command]
fn create_project_with_assets(
    change: Change,
    assets: Vec<assets::AssetUpload>,
    state: tauri::State<State>,
) -> Result<(), String> {
    state
        .0
        .lock()
        .map_err(|e| e.to_string())?
        .create_project_with_assets(&change, &assets)
}
/// Raw image bytes, without JSON number arrays.
#[tauri::command]
fn read_asset(
    project_id: String,
    asset_id: String,
    state: tauri::State<State>,
) -> Result<tauri::ipc::Response, String> {
    let bytes = state
        .0
        .lock()
        .map_err(|e| e.to_string())?
        .read_asset(&project_id, &asset_id)?;
    Ok(tauri::ipc::Response::new(bytes))
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
            std::fs::create_dir_all(&root)?;
            let lock_path = root.join(".personal-word-instance.lock");
            let lock = std::fs::OpenOptions::new()
                .write(true)
                .create(true)
                .truncate(false)
                .open(&lock_path)
                ?;
            #[cfg(unix)]
            let lock_result = unsafe { libc::flock(std::os::fd::AsRawFd::as_raw_fd(&lock), libc::LOCK_EX | libc::LOCK_NB) };
            #[cfg(not(unix))]
            let lock_result = 0;
            if lock_result != 0 {
                return Err(std::io::Error::other("Another Personal Word process is already using this writing library. Close it before opening another copy." ).into());
            }
            app.manage(InstanceLock(lock));
            app.manage(State(
                Mutex::new(Store::new(root).map_err(std::io::Error::other)?),
                Mutex::new(()),
            ));
            app.manage(ExitAllowed(AtomicBool::new(false)));
            app.manage(dropped::DroppedPaths::default());
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
            #[cfg(all(feature = "native-smoke", target_os = "macos"))]
            if std::env::var_os("FOLIO_SMOKE_DIR").is_some() {
                let config = app
                    .config()
                    .app
                    .windows
                    .iter()
                    .find(|window| window.label == "main")
                    .cloned()
                    .ok_or_else(|| std::io::Error::other("Native diagnostics require the configured main window"))?;
                let identifier = smoke::required_data_store_identifier().map_err(std::io::Error::other)?;
                tauri::WebviewWindowBuilder::from_config(app.handle(), &config)?
                    .data_store_identifier(identifier)
                    .build()?;
            }
            Ok(())
        });
    #[cfg(feature = "native-smoke")]
    let builder = smoke::configure(builder).invoke_handler(tauri::generate_handler![
        list_projects,
        load_project,
        save_changes,
        flush_mirrors,
        stage_assets,
        create_project_with_assets,
        read_asset,
        create_snapshot,
        list_versions,
        load_version,
        storage_path,
        finish_quit,
        export_file,
        export_bytes,
        delete_project,
        lookup::lookup_fetch,
        zotero::zotero_read,
        dropped::read_dropped_file,
        smoke::smoke_report,
        smoke::diagnostic_profile_identity,
        smoke::smoke_close_window,
        smoke::smoke_progress,
        smoke::smoke_snapshot,
        smoke::arm_fault,
        smoke::arm_checkpoint,
        smoke::seed_durability_metadata,
        smoke::verify_safety_snapshot,
        smoke::sqlite_sync_settings,
        smoke::mark_mirrors_pending,
        smoke::smoke_beta_fixture,
        printing::render_pdf
    ]);
    #[cfg(not(feature = "native-smoke"))]
    let builder = builder.invoke_handler(tauri::generate_handler![
        list_projects,
        load_project,
        save_changes,
        flush_mirrors,
        stage_assets,
        create_project_with_assets,
        read_asset,
        create_snapshot,
        list_versions,
        load_version,
        storage_path,
        finish_quit,
        export_file,
        export_bytes,
        delete_project,
        lookup::lookup_fetch,
        zotero::zotero_read,
        dropped::read_dropped_file
    ]);
    // The one window-event handler for both builds: remember the latest drop's
    // paths so read_dropped_file can read only those.
    let builder = builder.on_window_event(|window, event| {
        if let tauri::WindowEvent::DragDrop(tauri::DragDropEvent::Drop { paths, .. }) = event {
            if let Ok(mut dropped) = window.state::<dropped::DroppedPaths>().0.lock() {
                *dropped = paths.clone();
            }
        }
        #[cfg(feature = "native-smoke")]
        if matches!(event, tauri::WindowEvent::CloseRequested { .. }) {
            smoke::record_window_close();
        }
    });
    // Only native diagnostics adjust the generated window configuration.
    #[allow(unused_mut)]
    let mut context = tauri::generate_context!();
    #[cfg(feature = "native-smoke")]
    if std::env::var_os("FOLIO_SMOKE_DIR").is_some() {
        if context.config().identifier != "com.folio.smoke" {
            panic!("Native diagnostics require the com.folio.smoke app identifier");
        }
        // Tauri does not carry a window config's data_store_identifier into the
        // webview, so setup creates the main window with the isolated store.
        #[cfg(target_os = "macos")]
        {
            smoke::required_data_store_identifier()
                .expect("Native diagnostics require an isolated WebKit data-store identifier");
            context
                .config_mut()
                .app
                .windows
                .iter_mut()
                .find(|window| window.label == "main")
                .expect("Native diagnostics require the configured main window")
                .create = false;
        }
    }
    builder
        .build(context)
        .expect("Could not launch Personal Word")
        .run(|app, event| {
            let _instance_lock = &app.state::<InstanceLock>().0;
            if let tauri::RunEvent::ExitRequested { api, .. } = event {
                if !app.state::<ExitAllowed>().0.load(Ordering::SeqCst) {
                    api.prevent_exit();
                    let _ = app.emit("folio:quit-requested", ());
                }
            }
        });
}

#[cfg(all(test, unix))]
mod instance_lock_tests {
    use std::os::fd::AsRawFd;

    #[test]
    fn advisory_lock_rejects_a_second_handle_and_releases_on_drop() {
        let temp = tempfile::tempdir().unwrap();
        let path = temp.path().join(".personal-word-instance.lock");
        let first = std::fs::OpenOptions::new().write(true).create(true).truncate(false).open(&path).unwrap();
        assert_eq!(unsafe { libc::flock(first.as_raw_fd(), libc::LOCK_EX | libc::LOCK_NB) }, 0);
        let second = std::fs::OpenOptions::new().write(true).create(true).truncate(false).open(&path).unwrap();
        assert_ne!(unsafe { libc::flock(second.as_raw_fd(), libc::LOCK_EX | libc::LOCK_NB) }, 0);
        drop(first);
        assert_eq!(unsafe { libc::flock(second.as_raw_fd(), libc::LOCK_EX | libc::LOCK_NB) }, 0);
    }
}
