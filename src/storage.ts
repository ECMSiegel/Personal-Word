import { invoke, isTauri } from "@tauri-apps/api/core";
import {
  type Project,
  type Summary,
  type Version,
  validateProject,
} from "./model";
import { type Change, headerOf } from "./save-queue";
import { type AssetMeta, type PendingAsset } from "./assets/types";
import {
  browserAssetStore,
  collectAssetIds,
  inspectImage,
  isAssetId,
  toBase64,
  verifyPendingAsset,
} from "./assets/assets";
import { type PendingPdf, inspectPdf, verifyPendingPdf } from "./assets/pdf";
export let desktop = isTauri();
export function setDesktopForTesting(val: boolean) {
  desktop = val;
}
const prefix = "folio.preview.";
function read<T>(key: string, fallback: T): T {
  const data = localStorage.getItem(prefix + key);
  return data ? (JSON.parse(data) as T) : fallback;
}
function write(key: string, value: unknown) {
  localStorage.setItem(prefix + key, JSON.stringify(value));
}
async function requireBrowserAssets(project: Project): Promise<void> {
  for (const id of collectAssetIds(project)) {
    if (!(await browserAssetStore.get(project.id, id)))
      throw new Error(
        "An image in this edit is missing from the project's storage; nothing was saved. Your recovery journal has been kept.",
      );
  }
}
export type Listing = { projects: Summary[]; damaged: string[] };
export const storage = {
  async list(): Promise<Listing> {
    if (desktop) return invoke("list_projects");
    const projects = Object.keys(localStorage)
      .filter((k) => k.startsWith(prefix + "project."))
      .map((k) => JSON.parse(localStorage.getItem(k)!) as Project)
      .map(({ id, title, createdAt, updatedAt }) => ({
        id,
        title,
        createdAt,
        updatedAt,
      }))
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    return { projects, damaged: [] };
  },
  async delete(id: string): Promise<void> {
    if (desktop) return invoke("delete_project", { id });
    for (const k of ["project.", "history.", "snapshots."])
      localStorage.removeItem(prefix + k + id);
  },
  async load(id: string): Promise<Project> {
    const p = desktop
      ? await invoke<Project>("load_project", { id })
      : read<Project | null>("project." + id, null);
    validateProject(p);
    return p;
  },
  async save(change: Change): Promise<void> {
    if (desktop) return invoke("save_changes", { change });
    const { header, entries } = change;
    // Browser preview keeps one whole-project blob; only the desktop app stores entries separately.
    const old = read<Project | null>("project." + header.id, null);
    const byId = new Map(old?.entries.map((e) => [e.id, e]));
    for (const e of entries) byId.set(e.id, e);
    const { entryIds, ...rest } = header;
    const project = { ...rest, entries: entryIds.map((id) => byId.get(id)!) };
    validateProject(project);
    if (
      old &&
      (old.revision > project.revision ||
        (old.revision === project.revision &&
          JSON.stringify(old) !== JSON.stringify(project)))
    )
      throw new Error("Conflicting revision. Recovery journal retained.");
    await requireBrowserAssets(project);
    if (old && old.revision < project.revision) {
      const history = read<Project[]>("history." + project.id, []);
      write("history." + project.id, [old, ...history].slice(0, 100));
    }
    write("project." + project.id, project);
  },
  /** Writes project.json and text copies now instead of waiting for the background pass. */
  async flushMirrors(id: string): Promise<void> {
    if (desktop) return invoke("flush_mirrors", { id });
  },
  async snapshot(id: string, name: string): Promise<string> {
    if (desktop) return invoke("create_snapshot", { id, name });
    const key = crypto.randomUUID();
    const p = await this.load(id);
    const versions = read<(Version & { project: Project })[]>(
      "snapshots." + id,
      [],
    );
    write("snapshots." + id, [
      { id: key, name, createdAt: new Date().toISOString(), project: p },
      ...versions,
    ]);
    return key;
  },
  async versions(id: string, history: boolean): Promise<Version[]> {
    if (desktop) return invoke("list_versions", { id, history });
    if (history)
      return read<Project[]>("history." + id, []).map((p) => ({
        id: String(p.revision),
        name: "Automatic recovery",
        createdAt: p.updatedAt,
      }));
    return read<Version[]>("snapshots." + id, []);
  },
  async version(id: string, key: string, history: boolean): Promise<Project> {
    if (desktop) return invoke("load_version", { id, key, history });
    const p = history
      ? read<Project[]>("history." + id, []).find(
          (p) => String(p.revision) === key,
        )
      : read<(Version & { project: Project })[]>("snapshots." + id, []).find(
          (v) => v.id === key,
        )?.project;
    if (!p) throw new Error("Version not found");
    return p;
  },
  async path(): Promise<string> {
    return desktop
      ? invoke("storage_path")
      : "Browser preview storage -- use the desktop app for SQLite and portable files.";
  },
  async stageAssets(
    projectId: string,
    assets: PendingAsset[],
  ): Promise<AssetMeta[]> {
    if (desktop) {
      const uploads = assets.map((a) => ({
        id: a.id,
        meta: a.meta,
        data: toBase64(a.bytes),
      }));
      return invoke<AssetMeta[]>("stage_assets", {
        projectId,
        assets: uploads,
      });
    }
    for (const asset of assets) {
      await browserAssetStore.put(projectId, asset);
    }
    return assets.map((a) => a.meta);
  },
  async readAsset(projectId: string, id: string): Promise<PendingAsset> {
    if (desktop) {
      const buf = await invoke<ArrayBuffer | Uint8Array>("read_asset", {
        projectId,
        assetId: id,
      });
      const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
      const meta = inspectImage(bytes);
      const asset: PendingAsset = { id, meta, bytes };
      await verifyPendingAsset(asset);
      return asset;
    }
    if (!isAssetId(id)) {
      throw new Error("Invalid image identifier");
    }
    const asset = await browserAssetStore.get(projectId, id);
    if (!asset) {
      throw new Error("This image is not stored in the project.");
    }
    return asset;
  },
  /** Stores a source PDF through the image asset path (desktop: stage_assets). */
  async stagePdf(projectId: string, pdf: PendingPdf): Promise<void> {
    await verifyPendingPdf(pdf);
    if (desktop) {
      await invoke("stage_assets", {
        projectId,
        assets: [{ id: pdf.id, meta: pdf.meta, data: toBase64(pdf.bytes) }],
      });
      return;
    }
    await browserAssetStore.putPdf(projectId, pdf);
  },
  async readPdf(projectId: string, id: string): Promise<PendingPdf> {
    if (desktop) {
      const buf = await invoke<ArrayBuffer | Uint8Array>("read_asset", {
        projectId,
        assetId: id,
      });
      const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
      const pdf: PendingPdf = { id, meta: inspectPdf(bytes), bytes };
      await verifyPendingPdf(pdf);
      return pdf;
    }
    if (!isAssetId(id)) {
      throw new Error("Invalid image identifier");
    }
    const pdf = await browserAssetStore.getPdf(projectId, id);
    if (!pdf) {
      throw new Error("This PDF is not stored in this project.");
    }
    return pdf;
  },
  async createProjectWithAssets(
    project: Project,
    assets: PendingAsset[],
  ): Promise<void> {
    validateProject(project);
    if (desktop) {
      const change: Change = {
        header: headerOf(project),
        entries: project.entries,
        baseRevision: null,
      };
      const uploads = assets.map((a) => ({
        id: a.id,
        meta: a.meta,
        data: toBase64(a.bytes),
      }));
      return invoke("create_project_with_assets", {
        change,
        assets: uploads,
      });
    }
    const existing = read<Project | null>("project." + project.id, null);
    if (existing) {
      throw new Error(
        "A project with this identity already exists; nothing was replaced.",
      );
    }
    for (const asset of assets) {
      await browserAssetStore.put(project.id, asset);
    }
    await requireBrowserAssets(project);
    write("project." + project.id, project);
  },
};
