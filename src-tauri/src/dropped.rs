//! Reads a file the user dropped onto the window. Only paths from the window's
//! latest drop can be read, so the page cannot use this to open arbitrary files.
use std::io::Read;
use std::path::{Path, PathBuf};

pub const MAX_DROPPED_BYTES: u64 = 20 * 1024 * 1024;
pub const DROPPED_EXTENSIONS: [&str; 7] = ["txt", "md", "markdown", "docx", "html", "htm", "zip"];

/// The paths of the most recent drop onto the main window.
#[derive(Default)]
pub struct DroppedPaths(pub std::sync::Mutex<Vec<PathBuf>>);

/// Reads `path` only if it was in the latest drop, has an importable extension,
/// is a regular file (not a folder or symlink) and is at most MAX_DROPPED_BYTES.
pub fn read_capped(path: &Path, allowed: &[PathBuf]) -> Result<Vec<u8>, String> {
    if !allowed.iter().any(|p| p == path) {
        return Err("Drop the file again.".into());
    }
    let extension = path
        .extension()
        .and_then(|e| e.to_str())
        .map(|e| e.to_ascii_lowercase())
        .unwrap_or_default();
    if !DROPPED_EXTENSIONS.contains(&extension.as_str()) {
        return Err("Personal Word can import .txt, .md, .docx, .html or .zip files.".into());
    }
    let not_a_file = || "Drop a file, not a folder or alias.".to_string();
    let link = std::fs::symlink_metadata(path).map_err(|e| e.to_string())?;
    if !link.file_type().is_file() {
        return Err(not_a_file());
    }
    let file = std::fs::File::open(path).map_err(|e| e.to_string())?;
    let meta = file.metadata().map_err(|e| e.to_string())?;
    if !meta.is_file() {
        return Err(not_a_file());
    }
    let too_big = || "Files must be 20 MB or smaller.".to_string();
    if meta.len() > MAX_DROPPED_BYTES {
        return Err(too_big());
    }
    let mut bytes = Vec::with_capacity(meta.len() as usize);
    file.take(MAX_DROPPED_BYTES + 1)
        .read_to_end(&mut bytes)
        .map_err(|e| e.to_string())?;
    // The file grew after the size check.
    if bytes.len() as u64 > MAX_DROPPED_BYTES {
        return Err(too_big());
    }
    Ok(bytes)
}

#[tauri::command]
pub async fn read_dropped_file(
    path: String,
    state: tauri::State<'_, DroppedPaths>,
) -> Result<tauri::ipc::Response, String> {
    let allowed = state.0.lock().map_err(|e| e.to_string())?.clone();
    read_capped(Path::new(&path), &allowed).map(tauri::ipc::Response::new)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn listed(dir: &tempfile::TempDir, name: &str) -> PathBuf {
        dir.path().join(name)
    }

    #[test]
    fn reads_a_listed_markdown_file() {
        let dir = tempfile::tempdir().unwrap();
        let path = listed(&dir, "Draft.md");
        std::fs::write(&path, b"# Dropped\n\nBody").unwrap();
        assert_eq!(read_capped(&path, &[path.clone()]).unwrap(), b"# Dropped\n\nBody");
    }

    #[test]
    fn refuses_a_path_that_was_not_dropped() {
        let dir = tempfile::tempdir().unwrap();
        let dropped = listed(&dir, "Dropped.md");
        let other = listed(&dir, "Other.md");
        std::fs::write(&dropped, b"a").unwrap();
        std::fs::write(&other, b"b").unwrap();
        assert_eq!(read_capped(&other, &[dropped]).unwrap_err(), "Drop the file again.");
    }

    #[test]
    fn refuses_an_extension_the_importer_cannot_read() {
        let dir = tempfile::tempdir().unwrap();
        let path = listed(&dir, "Paper.pdf");
        std::fs::write(&path, b"%PDF-1.7").unwrap();
        let error = read_capped(&path, &[path.clone()]).unwrap_err();
        assert!(error.contains("can import"), "{error}");
    }

    #[test]
    fn refuses_a_folder_or_a_symlink() {
        let dir = tempfile::tempdir().unwrap();
        let folder = listed(&dir, "Folder.md");
        std::fs::create_dir(&folder).unwrap();
        assert!(read_capped(&folder, &[folder.clone()]).is_err());
        #[cfg(unix)]
        {
            let target = listed(&dir, "Target.md");
            std::fs::write(&target, b"secret").unwrap();
            let link = listed(&dir, "Link.md");
            std::os::unix::fs::symlink(&target, &link).unwrap();
            assert!(read_capped(&link, &[link.clone()]).is_err());
        }
    }

    #[test]
    fn refuses_a_file_over_the_cap() {
        let dir = tempfile::tempdir().unwrap();
        let path = listed(&dir, "Huge.md");
        let file = std::fs::File::create(&path).unwrap();
        file.set_len(MAX_DROPPED_BYTES + 1).unwrap();
        assert_eq!(
            read_capped(&path, &[path.clone()]).unwrap_err(),
            "Files must be 20 MB or smaller."
        );
    }

    #[test]
    fn reads_a_file_of_exactly_the_cap() {
        let dir = tempfile::tempdir().unwrap();
        let path = listed(&dir, "Full.zip");
        let file = std::fs::File::create(&path).unwrap();
        file.set_len(MAX_DROPPED_BYTES).unwrap();
        let bytes = read_capped(&path, &[path.clone()]).unwrap();
        assert_eq!(bytes.len() as u64, MAX_DROPPED_BYTES);
    }
}
