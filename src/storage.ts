import { invoke, isTauri } from "@tauri-apps/api/core";
import {
  type Project,
  type Summary,
  type Version,
  validateProject,
} from "./model";
import type { Change } from "./save-queue";
export const desktop = isTauri();
const prefix = "folio.preview.";
function read<T>(key: string, fallback: T): T {
  const data = localStorage.getItem(prefix + key);
  return data ? (JSON.parse(data) as T) : fallback;
}
function write(key: string, value: unknown) {
  localStorage.setItem(prefix + key, JSON.stringify(value));
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
};
