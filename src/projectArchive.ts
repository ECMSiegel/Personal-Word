import type { Project } from "./model";
import { validateProject } from "./model";
import {
  collectAssetIds,
  fromBase64,
  isAssetId,
  toBase64,
  verifyPendingAsset,
} from "./assets/assets";
import type { AssetId, AssetMeta, AssetResolver, PendingAsset } from "./assets/types";

export type ProjectArchive = {
  format: "personal-word";
  version: 2;
  project: Project;
  assets: { id: AssetId; meta: AssetMeta; data: string }[];
};

/** JSON text of the project plus every image its content references. Never partial. */
export async function createProjectArchive(project: Project, resolve: AssetResolver): Promise<string> {
  const assets: ProjectArchive["assets"] = [];
  for (const id of [...collectAssetIds(project)].sort()) {
    let asset: PendingAsset;
    try {
      asset = await resolve(id);
    } catch (e) {
      throw new Error(`Image ${id.slice(0, 8)} could not be loaded: ${e instanceof Error ? e.message : String(e)}`);
    }
    if (!asset || asset.id !== id) throw new Error(`Image ${id.slice(0, 8)} could not be loaded`);
    await verifyPendingAsset(asset);
    assets.push({ id, meta: asset.meta, data: toBase64(asset.bytes) });
  }
  const archive: ProjectArchive = { format: "personal-word", version: 2, project, assets };
  return JSON.stringify(archive, null, 2);
}

/**
 * Reads either a legacy plain Project JSON (no images) or a v2 archive.
 * Images in the archive that no entry references are dropped and listed in `ignoredAssetIds`.
 */
export async function readProjectArchive(
  text: string,
): Promise<{ project: Project; assets: PendingAsset[]; ignoredAssetIds: AssetId[] }> {
  const parsed: unknown = JSON.parse(text);
  const isArchive =
    !!parsed && typeof parsed === "object" && !Array.isArray(parsed) &&
    (parsed as { format?: unknown }).format === "personal-word";
  if (!isArchive) {
    validateProject(parsed);
    return { project: parsed, assets: [], ignoredAssetIds: [] };
  }
  const a = parsed as Partial<ProjectArchive>;
  if (a.version !== 2) throw new Error("This project archive version is not supported.");
  if (!Array.isArray(a.assets)) throw new Error("Project archive has no image list.");
  validateProject(a.project);
  const project = a.project as Project;
  const byId = new Map<AssetId, PendingAsset>();
  for (const row of a.assets) {
    if (!row || !isAssetId(row.id) || typeof row.data !== "string")
      throw new Error("Project archive contains an invalid image entry.");
    if (byId.has(row.id)) throw new Error("Project archive lists the same image twice.");
    const asset: PendingAsset = { id: row.id, meta: row.meta, bytes: fromBase64(row.data) };
    await verifyPendingAsset(asset);
    byId.set(row.id, asset);
  }
  const needed = collectAssetIds(project);
  for (const id of needed)
    if (!byId.has(id)) throw new Error(`Project archive is missing image ${id.slice(0, 8)}.`);
  const ignoredAssetIds = [...byId.keys()].filter((id) => !needed.has(id));
  return { project, assets: [...needed].map((id) => byId.get(id)!), ignoredAssetIds };
}
