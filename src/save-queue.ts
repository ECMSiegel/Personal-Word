import { type Entry, type Project, validateProject } from "./model";
export type SaveStatus = {
  state: "saved" | "pending" | "saving" | "error";
  message?: string;
};
export interface Journal {
  getItem(key: string): string | null;
  setItem(key: string, data: string): void;
  removeItem(key: string): void;
}
/** Everything about a project except entry bodies: small enough to write per keystroke. */
export type Header = Omit<Project, "entries"> & { entryIds: string[] };
/**
 * One save: the full header plus the entries that changed since `baseRevision`,
 * the last state known to be on disk (null sends every entry).
 */
export type Change = {
  header: Header;
  entries: Entry[];
  baseRevision: number | null;
};
type JournalHeader = Header & { journaled: string[] };
const canonical = (value: unknown): string =>
  JSON.stringify(value, (_key, v) =>
    v && typeof v === "object" && !Array.isArray(v)
      ? Object.fromEntries(
          Object.entries(v).sort(([a], [b]) => a.localeCompare(b)),
        )
      : v,
  );
export const journalKey = (id: string) => "folio.recovery." + id;
// Deliberately not prefixed by "folio.recovery." so library scans only see headers.
export const entryKey = (id: string, entryId: string) =>
  `folio.recovery-entry.${id}.${entryId}`;
export const headerOf = ({ entries, ...rest }: Project): Header => ({
  ...rest,
  entryIds: entries.map((e) => e.id),
});
/** Rebuilds the project from a journal header, its journaled entries and the saved copy. */
function journaled(
  id: string,
  saved: Project | null,
  journal: Journal,
): { project: Project; ids: string[] } | null {
  const raw = journal.getItem(journalKey(id));
  if (!raw) return null;
  const parsed = JSON.parse(raw) as JournalHeader | Project;
  // Journals written before per-entry journaling hold the whole project.
  if ("entries" in parsed) return { project: parsed, ids: [] };
  const { journaled: ids, entryIds, ...header } = parsed;
  if (!Array.isArray(ids) || !Array.isArray(entryIds))
    throw new Error("Recovery journal is malformed. It has been kept.");
  const byId = new Map(saved?.entries.map((e) => [e.id, e]));
  for (const entryId of ids) {
    const data = journal.getItem(entryKey(id, entryId));
    if (data) byId.set(entryId, JSON.parse(data) as Entry);
  }
  const entries = entryIds.map((entryId) => byId.get(entryId));
  if (entries.some((e) => !e))
    throw new Error("Recovery journal is incomplete. It has been kept.");
  return { project: { ...header, entries: entries as Entry[] }, ids };
}
export function recover(
  saved: Project | null,
  journal: Journal,
  id = saved?.id ?? "",
): Project | null {
  const found = journaled(id, saved, journal);
  if (!found) return saved;
  const candidate: unknown = found.project;
  validateProject(candidate);
  if (candidate.id !== id)
    throw new Error("Recovery journal belongs to another project.");
  if (!saved) return candidate;
  if (
    candidate.revision === saved.revision &&
    canonical(candidate) !== canonical(saved)
  )
    throw new Error(
      "Conflicting recovery copy retained. Export it before continuing.",
    );
  return candidate.revision > saved.revision ? candidate : saved;
}
/**
 * Serializes saves. Each edit journals only the changed entries plus the header,
 * synchronously; each save sends only entries that differ (by object identity)
 * from the last state known to be on disk. Projects are treated as immutable.
 */
export class SaveQueue {
  private pending: Project | null = null;
  private running: Promise<void> | null = null;
  private timer: ReturnType<typeof setTimeout> | undefined;
  /** Last state written to the journal; per-keystroke diffs are against it. */
  private journaledState: Project | null = null;
  /** Last state confirmed on disk; save deltas are against it. Null means send everything. */
  private saved: Project | null = null;
  /** Entry ids with journal keys that have not been cleared yet. */
  private dirty = new Set<string>();
  constructor(
    private persist: (change: Change) => Promise<void>,
    private journal: Journal,
    private status: (s: SaveStatus) => void,
  ) {}
  /** Starts a project from its on-disk copy (or null) and returns what to show, journal included. */
  open(id: string, saved: Project | null): Project | null {
    const project = recover(saved, this.journal, id);
    this.saved = saved;
    this.journaledState = saved;
    this.dirty = new Set(journaled(id, saved, this.journal)?.ids);
    return project;
  }
  enqueue(p: Project) {
    const previous =
      this.journaledState?.id === p.id ? this.journaledState : null;
    if (!previous) this.dirty = new Set();
    if (this.saved?.id !== p.id) this.saved = null;
    this.pending = p;
    this.journaledState = p;
    try {
      const before = new Map(previous?.entries.map((e) => [e.id, e]));
      for (const e of p.entries)
        if (before.get(e.id) !== e) {
          this.journal.setItem(entryKey(p.id, e.id), JSON.stringify(e));
          this.dirty.add(e.id);
        }
      const header: JournalHeader = {
        ...headerOf(p),
        journaled: [...this.dirty],
      };
      this.journal.setItem(journalKey(p.id), JSON.stringify(header));
      this.status({ state: "pending" });
    } catch {
      this.status({
        state: "error",
        message:
          "Recovery journal is full or unavailable. Saving directly to disk…",
      });
    }
    clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      void this.flush().catch(() => {});
    }, 250);
  }
  async flush(): Promise<void> {
    clearTimeout(this.timer);
    if (this.running) {
      await this.running;
      if (this.pending) return this.flush();
      return;
    }
    this.running = this.drain();
    try {
      await this.running;
    } finally {
      this.running = null;
    }
  }
  private async drain() {
    while (this.pending) {
      const p = this.pending;
      this.pending = null;
      const base = new Map(this.saved?.entries.map((e) => [e.id, e]));
      const change: Change = {
        header: headerOf(p),
        entries: p.entries.filter((e) => base.get(e.id) !== e),
        baseRevision: this.saved?.revision ?? null,
      };
      this.status({ state: "saving" });
      try {
        await this.persist(change);
        this.saved = p;
        const raw = this.journal.getItem(journalKey(p.id));
        if (raw && (JSON.parse(raw) as Header).revision === p.revision) {
          for (const entryId of this.dirty)
            this.journal.removeItem(entryKey(p.id, entryId));
          this.dirty.clear();
          this.journal.removeItem(journalKey(p.id));
        }
      } catch (error) {
        // Unknown disk state: the next attempt sends every entry.
        this.saved = null;
        if (!this.pending) this.pending = p;
        this.status({ state: "error", message: String(error) });
        throw error;
      }
    }
    this.status({ state: "saved" });
  }
}
