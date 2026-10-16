import { describe, it, expect, vi } from "vitest";
import {
  SaveQueue,
  recover,
  journalKey,
  scanJournals,
  RecoveryConflict,
  DamagedJournal,
  type Journal,
} from "./save-queue";
import { newProject, type Project } from "./model";
function journal(): Journal {
  const map = new Map<string, string>();
  return {
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => {
      map.set(k, v);
    },
    removeItem: (k) => {
      map.delete(k);
    },
  };
}
describe("durable save coordinator", () => {
  it("journals rapid typing immediately and flushes latest state before restart", async () => {
    const j = journal();
    const p = newProject("Essay");
    const persist = vi.fn(async (_p: Project) => {});
    const q = new SaveQueue(persist, j, () => {});
    for (let i = 1; i <= 100; i++)
      q.enqueue({ ...p, revision: i, title: "Revision " + i });
    expect(recover(p, j).revision).toBe(100);
    await q.flush();
    expect(persist).toHaveBeenCalledTimes(1);
    expect(persist.mock.calls[0][0].revision).toBe(100);
    expect(j.getItem(journalKey(p.id))).toBeNull();
  });
  it("serializes in-flight writes and keeps later edits journaled", async () => {
    const j = journal();
    const p = newProject("Essay");
    let release: () => void = () => {};
    const barrier = new Promise<void>((resolve) => {
      release = resolve;
    });
    const writes: number[] = [];
    const q = new SaveQueue(
      async (p) => {
        writes.push(p.revision);
        if (p.revision === 1) await barrier;
      },
      j,
      () => {},
    );
    q.enqueue(p);
    const flush = q.flush();
    q.enqueue({ ...p, revision: 2, title: "New" });
    expect(recover(p, j).revision).toBe(2);
    release();
    await flush;
    expect(writes).toEqual([1, 2]);
    expect(j.getItem(journalKey(p.id))).toBeNull();
  });
  it("retains failed data for retry and never reports it saved", async () => {
    const j = journal();
    const p = newProject("Essay");
    let fail = true;
    const status = vi.fn();
    const q = new SaveQueue(
      async () => {
        if (fail) throw Error("disk full");
      },
      j,
      status,
    );
    q.enqueue(p);
    await expect(q.flush()).rejects.toThrow("disk full");
    expect(j.getItem(journalKey(p.id))).not.toBeNull();
    expect(status).toHaveBeenLastCalledWith({
      state: "error",
      message: "Error: disk full",
    });
    fail = false;
    await q.flush();
    expect(status).toHaveBeenLastCalledWith({ state: "saved" });
  });
  it("saves to disk even when the immediate journal cannot be written", async () => {
    const p = newProject("Essay");
    const saved: Project[] = [];
    const j = journal();
    j.setItem = () => {
      throw Error("quota");
    };
    const q = new SaveQueue(
      async (p) => {
        saved.push(p);
      },
      j,
      () => {},
    );
    q.enqueue(p);
    await q.flush();
    expect(saved).toEqual([p]);
  });
  it("does not discard malformed journals", () => {
    const p = newProject("Essay");
    const j = journal();
    j.setItem(journalKey(p.id), "{broken");
    expect(() => recover(p, j)).toThrow();
    expect(j.getItem(journalKey(p.id))).toBe("{broken");
  });
});

it("accepts an already-committed journal even when JSON object key order differs", () => {
  const p = newProject("Already committed");
  const j = journal();
  const reordered = {
    ...p,
    entries: p.entries.map((e) => ({
      ...e,
      content: { content: e.content.content, type: "doc" },
    })),
  };
  j.setItem(journalKey(p.id), JSON.stringify(reordered));
  expect(recover(p, j)).toEqual(p);
});
it("retains a conflicting journal at the same revision", () => {
  const p = newProject("Disk");
  const j = journal();
  j.setItem(journalKey(p.id), JSON.stringify({ ...p, title: "Recovery copy" }));
  expect(() => recover(p, j)).toThrow("Conflicting recovery copy");
  expect(j.getItem(journalKey(p.id))).toContain("Recovery copy");
});
it("exposes both copies of a same-revision conflict so the writer can choose", () => {
  const p = newProject("Disk");
  const j = journal();
  j.setItem(journalKey(p.id), JSON.stringify({ ...p, title: "Recovery copy" }));
  let caught: unknown;
  try {
    recover(p, j);
  } catch (e) {
    caught = e;
  }
  expect(caught).toBeInstanceOf(RecoveryConflict);
  const conflict = caught as RecoveryConflict;
  expect(conflict.disk).toEqual(p);
  expect(conflict.journal.title).toBe("Recovery copy");
  expect(j.getItem(journalKey(p.id))).toContain("Recovery copy");
});
it("reports a malformed journal with its key and raw text instead of a bare parse error", () => {
  const p = newProject("Disk");
  const j = journal();
  j.setItem(journalKey(p.id), "{broken");
  let caught: unknown;
  try {
    recover(p, j);
  } catch (e) {
    caught = e;
  }
  expect(caught).toBeInstanceOf(DamagedJournal);
  expect((caught as DamagedJournal).key).toBe(journalKey(p.id));
  expect((caught as DamagedJournal).raw).toBe("{broken");
});
describe("library journal scan", () => {
  it("lists healthy journals and keeps corrupt or invalid ones aside", () => {
    const good = newProject("Healthy");
    const invalid = { ...newProject("Invalid"), order: [] };
    const { recovered, damaged } = scanJournals([
      [journalKey(good.id), JSON.stringify(good)],
      ["folio.recovery.corrupt", "{not json"],
      [journalKey(invalid.id), JSON.stringify(invalid)],
    ]);
    expect(recovered.map((p) => p.title)).toEqual(["Healthy"]);
    expect(damaged.map((d) => d.key)).toEqual([
      "folio.recovery.corrupt",
      journalKey(invalid.id),
    ]);
    expect(damaged[0].raw).toBe("{not json");
    expect(damaged[0].message).toContain("damaged");
  });
});
