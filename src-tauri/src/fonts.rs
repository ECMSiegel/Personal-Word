use serde::{Deserialize, Serialize};
use std::{fs, path::Path};
use tauri::State;

const MAX_FONT_BYTES: usize = 20 * 1024 * 1024;
const STYLES: [&str; 4] = ["regular", "bold", "italic", "boldItalic"];

type Result<T> = std::result::Result<T, String>;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct FontMeta {
    pub id: String,
    pub family: String,
    pub style: String,
    pub file_name: String,
    pub format: String,
}

fn font_dir(root: &Path) -> std::path::PathBuf {
    root.join("fonts")
}

fn read_index(dir: &Path) -> Result<Vec<FontMeta>> {
    let path = dir.join("index.json");
    match fs::read(path) {
        Ok(bytes) => {
            serde_json::from_slice(&bytes).map_err(|_| "Could not read the font list".into())
        }
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => Ok(Vec::new()),
        Err(_) => Err("Could not read the font list".into()),
    }
}

fn write_index(dir: &Path, fonts: &[FontMeta]) -> Result<()> {
    let data = serde_json::to_vec_pretty(fonts).map_err(|_| "Could not save the font list")?;
    crate::store::atomic(&dir.join("index.json"), &data)
}

fn id_for(family: &str, style: &str) -> String {
    format!("{}-{style}", family.trim().to_lowercase().replace(' ', "-"))
}

fn valid_family(family: &str) -> bool {
    let family = family.trim();
    let count = family.chars().count();
    (1..=64).contains(&count)
        && family
            .chars()
            .all(|c| c.is_alphabetic() || c.is_numeric() || matches!(c, ' ' | '_' | '-' | '.'))
}

fn add(root: &Path, file_name: &str, family: &str, style: &str, data: &[u8]) -> Result<FontMeta> {
    let extension = Path::new(file_name)
        .extension()
        .and_then(|ext| ext.to_str())
        .ok_or("Choose a .ttf or .otf font file")?;
    let format = match extension.to_ascii_lowercase().as_str() {
        "ttf" => "ttf",
        "otf" => "otf",
        _ => return Err("Choose a .ttf or .otf font file".into()),
    };
    if Path::new(file_name)
        .file_name()
        .and_then(|name| name.to_str())
        != Some(file_name)
        || file_name.contains('\\')
    {
        return Err("Choose a font file by its file name".into());
    }
    if !(1..=MAX_FONT_BYTES).contains(&data.len()) {
        return Err("Font files must be between 1 byte and 20 MB".into());
    }
    let valid_magic = match format {
        "ttf" => data.starts_with(&[0x00, 0x01, 0x00, 0x00]) || data.starts_with(b"true"),
        "otf" => data.starts_with(b"OTTO"),
        _ => false,
    };
    if !valid_magic {
        return Err("That file does not match its font format".into());
    }
    if !valid_family(family) {
        return Err(
            "Font family must be 1 to 64 letters, numbers, spaces, underscores, hyphens or periods"
                .into(),
        );
    }
    if !STYLES.contains(&style) {
        return Err("Choose a valid font style".into());
    }

    let family = family.trim();
    let dir = font_dir(root);
    fs::create_dir_all(&dir).map_err(|_| "Could not create the fonts folder")?;
    let mut fonts = read_index(&dir)?;
    if fonts
        .iter()
        .any(|font| font.family.eq_ignore_ascii_case(family) && font.style == style)
    {
        return Err("That font is already added".into());
    }
    let id = id_for(family, style);
    if fonts.iter().any(|font| font.id == id) {
        return Err("That font is already added".into());
    }
    let meta = FontMeta {
        id: id.clone(),
        family: family.to_owned(),
        style: style.to_owned(),
        file_name: file_name.to_owned(),
        format: format.to_owned(),
    };
    let file_path = dir.join(format!("{id}.{format}"));
    fs::write(&file_path, data).map_err(|_| "Could not store the font file")?;
    fonts.push(meta.clone());
    if let Err(error) = write_index(&dir, &fonts) {
        let _ = fs::remove_file(file_path);
        return Err(error);
    }
    Ok(meta)
}

fn listed_font(root: &Path, id: &str) -> Result<(std::path::PathBuf, FontMeta)> {
    let dir = font_dir(root);
    let font = read_index(&dir)?
        .into_iter()
        .find(|font| font.id == id)
        .ok_or_else(|| "That font is not in the font list".to_owned())?;
    let path = dir.join(format!("{}.{}", font.id, font.format));
    Ok((path, font))
}

fn list(root: &Path) -> Result<Vec<FontMeta>> {
    read_index(&font_dir(root))
}

fn read(root: &Path, id: &str) -> Result<Vec<u8>> {
    let (path, _) = listed_font(root, id)?;
    fs::read(path).map_err(|_| "Could not read the font file".into())
}

fn remove(root: &Path, id: &str) -> Result<()> {
    let (path, meta) = listed_font(root, id)?;
    let dir = font_dir(root);
    let mut fonts = read_index(&dir)?;
    fonts.retain(|font| font.id != meta.id);
    write_index(&dir, &fonts)?;
    match fs::remove_file(path) {
        Ok(()) => Ok(()),
        Err(_) => Err("Could not remove the font file".into()),
    }
}

fn root(state: &State<crate::State>) -> Result<std::path::PathBuf> {
    state
        .0
        .lock()
        .map(|store| store.root.clone())
        .map_err(|_| "Could not access the writing library".into())
}

#[tauri::command]
pub fn font_add(
    file_name: String,
    family: String,
    style: String,
    data: Vec<u8>,
    state: State<crate::State>,
) -> Result<FontMeta> {
    add(&root(&state)?, &file_name, &family, &style, &data)
}

#[tauri::command]
pub fn font_list(state: State<crate::State>) -> Result<Vec<FontMeta>> {
    list(&root(&state)?)
}

#[tauri::command]
pub fn font_read(id: String, state: State<crate::State>) -> Result<Vec<u8>> {
    read(&root(&state)?, &id)
}

#[tauri::command]
pub fn font_remove(id: String, state: State<crate::State>) -> Result<()> {
    remove(&root(&state)?, &id)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn ttf() -> Vec<u8> {
        [0x00, 0x01, 0x00, 0x00, 1, 2, 3].to_vec()
    }

    #[test]
    fn add_list_read_remove_and_accept_multiple_styles() {
        let temp = tempfile::tempdir().unwrap();
        let regular = add(
            temp.path(),
            "Example.ttf",
            "Example Sans",
            "regular",
            &ttf(),
        )
        .unwrap();
        let bold = add(
            temp.path(),
            "Example-Bold.ttf",
            "Example Sans",
            "bold",
            &ttf(),
        )
        .unwrap();
        assert_eq!(regular.id, "example-sans-regular");
        assert_eq!(list(temp.path()).unwrap(), vec![regular.clone(), bold.clone()]);
        assert_eq!(read(temp.path(), &regular.id).unwrap(), ttf());
        remove(temp.path(), &regular.id).unwrap();
        assert_eq!(list(temp.path()).unwrap(), vec![bold]);
        assert!(read(temp.path(), &regular.id).is_err());
    }

    #[test]
    fn rejects_duplicates_bad_magic_size_names_styles_and_unknown_ids() {
        let temp = tempfile::tempdir().unwrap();
        add(
            temp.path(),
            "Example.ttf",
            "Example Sans",
            "regular",
            &ttf(),
        )
        .unwrap();
        assert_eq!(
            add(temp.path(), "other.ttf", "example sans", "regular", &ttf()).unwrap_err(),
            "That font is already added"
        );
        assert!(add(temp.path(), "bad.ttf", "Bad", "regular", b"OTTO").is_err());
        assert!(add(temp.path(), "bad.otf", "Bad", "regular", b"true").is_err());
        assert!(add(
            temp.path(),
            "large.ttf",
            "Bad",
            "regular",
            &vec![0; MAX_FONT_BYTES + 1]
        )
        .is_err());
        assert!(add(temp.path(), "empty.ttf", "Bad", "regular", b"").is_err());
        assert!(add(temp.path(), "bad.ttf", "Bad", "unknown", &ttf()).is_err());
        assert!(add(temp.path(), "../x.ttf", "Bad", "regular", &ttf()).is_err());
        assert!(read(temp.path(), "../x").is_err());
        assert!(remove(temp.path(), "../x").is_err());
    }
}
