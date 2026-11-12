// Installed (system) fonts, read through Core Text (wave 9 C6).
//
// The commands exist on every platform so the webview can always call them;
// the Core Text implementation is macOS only. Every error becomes an Err, and
// the webview side (src/fonts/system.ts) turns errors into [] and null.

use serde::{Deserialize, Serialize};

/// A font file the exporter can embed. Collections are reported with empty
/// `data` and `collection: true`; callers skip them.
#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SystemFontFile {
    pub data: Vec<u8>,
    pub postscript_name: String,
    pub collection: bool,
}

/// Ordinary system fonts stay far below this; a larger file is refused.
const MAX_FONT_FILE_BYTES: usize = 30 * 1024 * 1024;

#[cfg(target_os = "macos")]
mod imp {
    use super::{SystemFontFile, MAX_FONT_FILE_BYTES};
    use objc2_core_foundation::{CFArray, CFDictionary, CFString, CFURLPathStyle, CFURL};
    use objc2_core_text::{
        kCTFontFamilyNameAttribute, kCTFontURLAttribute, CTFont, CTFontDescriptor,
        CTFontManagerCopyAvailableFontFamilyNames, CTFontSymbolicTraits,
    };

    /// The available family names from Core Text, sorted, without the
    /// system-private faces whose names start with `.`.
    pub fn families() -> Result<Vec<String>, String> {
        // SAFETY: no special requirements; Core Text documents the return as
        // an array of CFStrings, which justifies the cast below.
        let names = unsafe { CTFontManagerCopyAvailableFontFamilyNames() };
        // SAFETY: the array holds CFStrings (Core Text's own documentation).
        let typed: &CFArray<CFString> = unsafe { names.cast_unchecked() };
        let mut out = Vec::new();
        for name in typed.iter() {
            let name = name.to_string();
            if name.starts_with('.') {
                continue;
            }
            out.push(name);
        }
        out.sort();
        Ok(out)
    }

    /// The face of `family` whose bold and italic traits match the request,
    /// read through the file URL Core Text gives, never a built path.
    pub fn file(family: &str, bold: bool, italic: bool) -> Result<Option<SystemFontFile>, String> {
        let family_cf = CFString::from_str(family);
        // SAFETY: Core Text documents this exported key as a CFString reference.
        let family_key = unsafe { &*kCTFontFamilyNameAttribute };
        let attributes = CFDictionary::from_slices(&[family_key], &[&*family_cf]);
        // SAFETY: the dictionary contains a Core Text CFString key and a CFString value.
        let descriptor = unsafe { CTFontDescriptor::with_attributes(attributes.as_opaque()) };
        // SAFETY: no special requirements; Core Text documents the return as
        // an array of font descriptors, which justifies the cast below.
        let matches = unsafe { descriptor.matching_font_descriptors(None) };
        let Some(matches) = matches else {
            return Ok(None);
        };
        // SAFETY: the array holds CTFontDescriptors (Core Text's own
        // documentation for CTFontDescriptorCreateMatchingFontDescriptors).
        let typed: &CFArray<CTFontDescriptor> = unsafe { matches.cast_unchecked() };
        for matched in typed.iter() {
            // SAFETY: `matched` is a live CTFontDescriptor from Core Text; a null
            // matrix requests the standard identity transform.
            let font = unsafe { CTFont::with_font_descriptor(&matched, 0.0, std::ptr::null()) };
            let traits = unsafe { font.symbolic_traits() };
            let is_bold = traits.intersects(CTFontSymbolicTraits::TraitBold);
            let is_italic = traits.intersects(CTFontSymbolicTraits::TraitItalic);
            if is_bold != bold || is_italic != italic {
                continue;
            }
            return file_of_font(&font);
        }
        Ok(None)
    }

    /// Read the requested font through its Core Text file URL.
    fn file_of_font(font: &CTFont) -> Result<Option<SystemFontFile>, String> {
        let url = unsafe { font.attribute(kCTFontURLAttribute) }
            .and_then(|value| value.downcast::<CFURL>().ok());
        let Some(url) = url else {
            return Ok(None);
        };
        let Some(path) = url.file_system_path(CFURLPathStyle::CFURLPOSIXPathStyle) else {
            return Ok(None);
        };
        let Ok(bytes) = std::fs::read(path.to_string()) else {
            return Ok(None);
        };
        if bytes.len() > MAX_FONT_FILE_BYTES {
            return Ok(None);
        }
        let collection = bytes.starts_with(b"ttcf");
        let data = if collection { Vec::new() } else { bytes };
        let postscript_name = unsafe { font.post_script_name() }.to_string();
        Ok(Some(SystemFontFile {
            data,
            postscript_name,
            collection,
        }))
    }
}

#[cfg(not(target_os = "macos"))]
mod imp {
    use super::SystemFontFile;

    pub fn families() -> Result<Vec<String>, String> {
        Err("Installed fonts are listed only in the macOS app".into())
    }

    pub fn file(
        _family: &str,
        _bold: bool,
        _italic: bool,
    ) -> Result<Option<SystemFontFile>, String> {
        Err("Installed font files are read only in the macOS app".into())
    }
}

#[tauri::command]
pub fn system_font_families() -> Result<Vec<String>, String> {
    imp::families()
}

#[tauri::command]
pub fn system_font_file(
    family: String,
    bold: bool,
    italic: bool,
) -> Result<Option<SystemFontFile>, String> {
    imp::file(&family, bold, italic)
}

#[cfg(all(test, target_os = "macos"))]
mod tests {
    use super::*;

    #[test]
    fn family_list_contains_georgia() {
        let families = system_font_families().unwrap();
        assert!(
            families.iter().any(|f| f == "Georgia"),
            "families: {:?}",
            &families[..families.len().min(40)]
        );
    }

    fn regular_and_bold(family: &str) -> (Option<SystemFontFile>, Option<SystemFontFile>) {
        (
            system_font_file(family.into(), false, false).unwrap(),
            system_font_file(family.into(), true, false).unwrap(),
        )
    }

    #[test]
    fn georgia_regular_is_true_type_and_bold_is_other_bytes() {
        let (regular, bold) = regular_and_bold("Georgia");
        let regular = regular.expect("Georgia regular found");
        assert_eq!(&regular.data[..4], &[0x00, 0x01, 0x00, 0x00]);
        assert!(!regular.collection);
        let bold = bold.expect("Georgia bold found");
        assert_ne!(regular.data, bold.data);
    }

    #[test]
    fn futura_is_a_collection_with_no_bytes() {
        let file = system_font_file("Futura".into(), false, false)
            .unwrap()
            .expect("Futura found");
        assert!(file.collection);
        assert!(file.data.is_empty());
        assert!(!file.postscript_name.is_empty());
    }

    #[test]
    fn unknown_family_is_none() {
        assert!(
            system_font_file("No Such Writing Family".into(), false, false)
                .unwrap()
                .is_none()
        );
    }
}
