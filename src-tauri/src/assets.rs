//! Content-addressed image assets: identity, type and dimension checks.
use base64::Engine;
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};

type Result<T> = std::result::Result<T, String>;

pub const MAX_ASSET_BYTES: usize = 25 * 1024 * 1024;
const MAX_DIMENSION: u32 = 20_000;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct AssetMeta {
    pub mime: String,
    pub byte_length: u64,
    pub width: u32,
    pub height: u32,
}

/// An image sent by the editor or an importer, with its bytes as base64.
#[derive(Debug, Clone, Deserialize)]
pub struct AssetUpload {
    pub id: String,
    pub meta: AssetMeta,
    pub data: String,
}

/// An image whose identity, type and dimensions match its bytes.
#[derive(Debug, Clone)]
pub struct Asset {
    pub id: String,
    pub meta: AssetMeta,
    pub bytes: Vec<u8>,
}

/// Asset ids are the lowercase hex SHA-256 of the bytes.
pub fn is_asset_id(id: &str) -> bool {
    id.len() == 64 && id.bytes().all(|b| b.is_ascii_digit() || (b'a'..=b'f').contains(&b))
}

pub fn verify(upload: &AssetUpload) -> Result<Asset> {
    let bytes = base64::engine::general_purpose::STANDARD
        .decode(&upload.data)
        .map_err(|_| "Image data is not valid base64".to_string())?;
    verify_bytes(&upload.id, &upload.meta, bytes)
}

pub fn verify_bytes(id: &str, claimed: &AssetMeta, bytes: Vec<u8>) -> Result<Asset> {
    if !is_asset_id(id) {
        return Err("Invalid image identifier".into());
    }
    if bytes.is_empty() || bytes.len() > MAX_ASSET_BYTES {
        return Err("Image is empty or larger than 25 MB".into());
    }
    if hex(&Sha256::digest(&bytes)) != id {
        return Err("Image bytes do not match their identifier".into());
    }
    let meta = inspect(&bytes)?;
    if &meta != claimed {
        return Err("Image type or size does not match its contents".into());
    }
    Ok(Asset { id: id.into(), meta, bytes })
}

/// Reads type and pixel size from the file header; only PNG, JPEG and (for sources) PDF are accepted.
pub fn inspect(bytes: &[u8]) -> Result<AssetMeta> {
    // Source PDFs share the asset path; they have no pixel size.
    if bytes.starts_with(b"%PDF-") {
        return Ok(AssetMeta {
            mime: "application/pdf".into(),
            byte_length: bytes.len() as u64,
            width: 0,
            height: 0,
        });
    }
    let (mime, (width, height)) = if bytes.starts_with(b"\x89PNG\r\n\x1a\n") {
        ("image/png", png_size(bytes)?)
    } else if bytes.starts_with(&[0xFF, 0xD8, 0xFF]) {
        ("image/jpeg", jpeg_size(bytes)?)
    } else {
        return Err("Only PNG and JPEG images are supported".into());
    };
    if width == 0 || height == 0 || width > MAX_DIMENSION || height > MAX_DIMENSION {
        return Err("Image dimensions are outside the supported range".into());
    }
    Ok(AssetMeta {
        mime: mime.into(),
        byte_length: bytes.len() as u64,
        width,
        height,
    })
}

fn png_size(b: &[u8]) -> Result<(u32, u32)> {
    if b.len() < 24 || &b[12..16] != b"IHDR" {
        return Err("PNG header is incomplete".into());
    }
    let read = |at: usize| u32::from_be_bytes([b[at], b[at + 1], b[at + 2], b[at + 3]]);
    Ok((read(16), read(20)))
}

fn jpeg_size(b: &[u8]) -> Result<(u32, u32)> {
    let mut i = 2;
    while i + 4 <= b.len() {
        if b[i] != 0xFF {
            return Err("JPEG structure is invalid".into());
        }
        let marker = b[i + 1];
        if marker == 0xFF {
            i += 1;
            continue;
        }
        if marker == 0x01 || (0xD0..=0xD8).contains(&marker) {
            i += 2;
            continue;
        }
        if marker == 0xD9 || marker == 0xDA {
            break;
        }
        let length = u16::from_be_bytes([b[i + 2], b[i + 3]]) as usize;
        if length < 2 {
            return Err("JPEG structure is invalid".into());
        }
        // Start-of-frame markers, excluding DHT, JPG and DAC.
        if (0xC0..=0xCF).contains(&marker) && ![0xC4, 0xC8, 0xCC].contains(&marker) {
            if i + 9 > b.len() {
                return Err("JPEG frame header is incomplete".into());
            }
            let height = u16::from_be_bytes([b[i + 5], b[i + 6]]) as u32;
            let width = u16::from_be_bytes([b[i + 7], b[i + 8]]) as u32;
            return Ok((width, height));
        }
        i += 2 + length;
    }
    Err("JPEG has no frame size".into())
}

pub fn extension(mime: &str) -> &'static str {
    if mime == "image/png" {
        "png"
    } else if mime == "application/pdf" {
        "pdf"
    } else {
        "jpg"
    }
}

fn hex(bytes: &[u8]) -> String {
    bytes.iter().map(|b| format!("{b:02x}")).collect()
}

#[cfg(test)]
pub mod tests {
    use super::*;

    /// A valid 2x3 PNG (one IDAT, no compression concerns for header parsing).
    pub fn png(width: u32, height: u32) -> Vec<u8> {
        let mut b = b"\x89PNG\r\n\x1a\n\0\0\0\x0dIHDR".to_vec();
        b.extend(width.to_be_bytes());
        b.extend(height.to_be_bytes());
        b.extend([8, 2, 0, 0, 0, 0, 0, 0, 0]);
        b
    }
    pub fn id_of(bytes: &[u8]) -> String {
        hex(&Sha256::digest(bytes))
    }
    pub fn meta_of(bytes: &[u8]) -> AssetMeta {
        inspect(bytes).unwrap()
    }

    #[test]
    fn asset_identity_type_and_size_are_checked() {
        let bytes = png(2, 3);
        let id = id_of(&bytes);
        let meta = meta_of(&bytes);
        assert_eq!((meta.mime.as_str(), meta.width, meta.height), ("image/png", 2, 3));
        assert!(verify_bytes(&id, &meta, bytes.clone()).is_ok());
        let mut wrong = bytes.clone();
        wrong.push(0);
        assert!(verify_bytes(&id, &meta, wrong).unwrap_err().contains("do not match"));
        let mut claimed = meta.clone();
        claimed.width = 9;
        assert!(verify_bytes(&id, &claimed, bytes.clone()).unwrap_err().contains("type or size"));
        assert!(verify_bytes(&id.to_uppercase(), &meta, bytes).is_err());
        assert!(inspect(b"GIF89a....").unwrap_err().contains("PNG and JPEG"));
    }

    pub fn pdf(extra: &str) -> Vec<u8> {
        format!("%PDF-1.4\n{extra}\n%%EOF").into_bytes()
    }

    #[test]
    fn pdf_assets_are_accepted_without_dimensions() {
        let bytes = pdf("1 0 obj <<>> endobj");
        let id = id_of(&bytes);
        let meta = meta_of(&bytes);
        assert_eq!(
            meta,
            AssetMeta { mime: "application/pdf".into(), byte_length: bytes.len() as u64, width: 0, height: 0 }
        );
        assert!(verify_bytes(&id, &meta, bytes.clone()).is_ok());
        assert_eq!(extension("application/pdf"), "pdf");
        assert_eq!(extension("image/png"), "png");
        assert_eq!(extension("image/jpeg"), "jpg");
        let mut forged = bytes.clone();
        forged.push(b' ');
        assert!(verify_bytes(&id, &meta, forged).unwrap_err().contains("do not match"));
        assert!(inspect(b"%PDX-1.4").is_err());
        let mut big = b"%PDF-".to_vec();
        big.resize(MAX_ASSET_BYTES + 1, b'x');
        assert!(verify_bytes(&id_of(&big), &meta, big).unwrap_err().contains("25 MB"));
        // Images still need real dimensions.
        assert!(inspect(&png(0, 3)).is_err());
        assert!(inspect(&png(2, 3)).is_ok());
    }

    #[test]
    fn jpeg_frame_size_is_read_after_other_segments() {
        // SOI, APP0 (length 4), SOF0 with height 5 and width 7.
        let jpeg = [
            0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x04, 0x00, 0x00, 0xFF, 0xC0, 0x00, 0x0B, 0x08, 0x00,
            0x05, 0x00, 0x07, 0x01, 0x01, 0x11, 0x00,
        ];
        let meta = inspect(&jpeg).unwrap();
        assert_eq!((meta.mime.as_str(), meta.width, meta.height), ("image/jpeg", 7, 5));
        assert!(inspect(&jpeg[..10]).is_err());
    }
}
