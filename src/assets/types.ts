/** Lowercase hex SHA-256 of the image bytes. */
export type AssetId = string;
export type AssetMime = "image/png" | "image/jpeg";
export type AssetMeta = { mime: AssetMime; byteLength: number; width: number; height: number };
/** An image held in memory before or after storage. */
export type PendingAsset = { id: AssetId; meta: AssetMeta; bytes: Uint8Array };
/** Loads stored image bytes for rendering and export. */
export type AssetResolver = (id: AssetId) => Promise<PendingAsset>;
/**
 * Shared schema contract (TypeScript, Rust and exports must agree):
 * - "image": block atom node, attrs { assetId: AssetId; alt: string; title: string | null;
 *   width: number | null; height: number | null } (width/height are display pixels).
 * - "table" > "tableRow" > ("tableHeader" | "tableCell"), rectangular, colspan/rowspan 1,
 *   cells contain one or more blocks (no nested tables). Names match prosemirror-tables.
 */
