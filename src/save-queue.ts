import { type Project, validateProject } from "./model";
export type SaveStatus = {
  state: "saved" | "pending" | "saving" | "error";
  message?: string;
};
export interface Journal {
  getItem(key: string): string | null;
  setItem(key: string, data: string): void;
  removeItem(key: string): void;
}
const canonical = (value: unknown): string =>
  JSON.stringify(value, (_key, v) =>
    v && typeof v === "object" && !Array.isArray(v)
      ? Object.fromEntries(
          Object.entries(v).sort(([a], [b]) => a.localeCompare(b)),
        )
      : v,
  );
export const journalKey = (id: string) => "folio.recovery." + id;
export class RecoveryConflict extends Error {
  constructor(
    public disk: Project,
    public journal: Project,
  ) {
    super("Conflicting recovery copy retained. Export it before continuing.");
  }
}
export class DamagedJournal extends Error {
  constructor(
    public key: string,
    public raw: string,
    reason: unknown,
  ) {
    super("Recovery journal is damaged: " + String(reason));
  }
}
export function parseJournal(key: string, raw: string): Project {
  try {
    const candidate: unknown = JSON.parse(raw);
    validateProject(candidate);
    return candidate;
  } catch (e) {
    throw new DamagedJournal(key, raw, e);
  }
}
export function scanJournals(pairs: [key: string, raw: string][]): {
  recovered: Project[];
  damaged: DamagedJournal[];
} {
  const recovered: Project[] = [];
  const damaged: DamagedJournal[] = [];
  for (const [key, raw] of pairs) {
    try {
      recovered.push(parseJournal(key, raw));
    } catch (e) {
      damaged.push(e as DamagedJournal);
    }
  }
  return { recovered, damaged };
}
export function recover(p: Project, journal: Journal): Project {
  const raw = journal.getItem(journalKey(p.id));
  if (!raw) return p;
  const candidate = parseJournal(journalKey(p.id), raw);
  if (candidate.id !== p.id)
    throw new Error("Recovery journal belongs to another project.");
  if (
    candidate.revision === p.revision &&
    canonical(candidate) !== canonical(p)
  )
    throw new RecoveryConflict(p, candidate);
  return candidate.revision > p.revision ? candidate : p;
}
export class SaveQueue {
  private pending: Project | null = null;
  private running: Promise<void> | null = null;
  private timer: ReturnType<typeof setTimeout> | undefined;
  constructor(
    private persist: (p: Project) => Promise<void>,
    private journal: Journal,
    private status: (s: SaveStatus) => void,
  ) {}
  enqueue(p: Project) {
    this.pending = structuredClone(p);
    try {
      this.journal.setItem(journalKey(p.id), JSON.stringify(p));
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
      this.status({ state: "saving" });
      try {
        await this.persist(p);
        const raw = this.journal.getItem(journalKey(p.id));
        if (raw && (JSON.parse(raw) as Project).revision === p.revision)
          this.journal.removeItem(journalKey(p.id));
      } catch (error) {
        if (!this.pending) this.pending = p;
        this.status({ state: "error", message: String(error) });
        throw error;
      }
    }
    this.status({ state: "saved" });
  }
}
