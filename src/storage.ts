import { invoke, isTauri } from "@tauri-apps/api/core";
import {
  type Project,
  type Summary,
  type Version,
  validateProject,
} from "./model";
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
      .map(({ id, title, updatedAt }) => ({ id, title, updatedAt }))
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
  async save(project: Project): Promise<void> {
    validateProject(project);
    if (desktop) return invoke("save_project", { project });
    const old = read<Project | null>("project." + project.id, null);
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
      : "Browser preview storage — use the desktop app for SQLite and portable files.";
  },
};
