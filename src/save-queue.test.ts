import { describe, it, expect, vi } from "vitest";
import {
  SaveQueue,
  recover,
  journalKey,
  entryKey,
  type Change,
  type Journal,
} from "./save-queue";
import { entry, newProject, type Project } from "./model";
function journal(): Journal & { map: Map<string, string>; writes: string[] } {
  const map = new Map<string, string>();
  const writes: string[] = [];
  return {
    map,
    writes,
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => {
      writes.push(k);
      map.set(k, v);
    },
    removeItem: (k) => {
      map.delete(k);
    },
  };
}
const edit = (p: Project, index: number, text: string): Project => ({
  ...p,
  revision: p.revision + 1,
  entries: p.entries.map((e, i) => (i === index ? { ...e, text } : e)),
});
function twoSections(): Project {
  const p = newProject("Essay");
  const second = entry("section", "Second");
  return {
    ...p,
    order: [...p.order, second.id],
    entries: [...p.entries, second],
  };
}
describe("durable save coordinator", () => {
  it("journals rapid typing immediately and flushes latest state before restart", async () => {
    const j = journal();
    const p = newProject("Essay");
    const persist = vi.fn(async (_c: Change) => {});
    const q = new SaveQueue(persist, j, () => {});
    for (let i = 1; i <= 100; i++)
      q.enqueue({ ...p, revision: i, title: "Revision " + i });
    expect(recover(p, j)!.revision).toBe(100);
    await q.flush();
    expect(persist).toHaveBeenCalledTimes(1);
    expect(persist.mock.calls[0][0].header.revision).toBe(100);
    expect(j.map.size).toBe(0);
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
      async (c) => {
        writes.push(c.header.revision);
        if (c.header.revision === 1) await barrier;
      },
      j,
      () => {},
    );
    q.enqueue(p);
    const flush = q.flush();
    q.enqueue({ ...p, revision: 2, title: "New" });
    expect(recover(p, j)!.revision).toBe(2);
    release();
    await flush;
    expect(writes).toEqual([1, 2]);
    expect(j.map.size).toBe(0);
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
    const saved: Change[] = [];
    const j = journal();
    j.setItem = () => {
      throw Error("quota");
    };
    const q = new SaveQueue(
      async (c) => {
        saved.push(c);
      },
      j,
      () => {},
    );
    q.enqueue(p);
    await q.flush();
    expect(saved).toHaveLength(1);
    expect(saved[0].entries).toEqual(p.entries);
  });
  it("does not discard malformed journals", () => {
    const p = newProject("Essay");
    const j = journal();
    j.setItem(journalKey(p.id), "{broken");
    expect(() => recover(p, j)).toThrow();
    expect(j.getItem(journalKey(p.id))).toBe("{broken");
  });
});

describe("per-entry journal and saves", () => {
  it("journals only the edited entry plus a small header on each keystroke", () => {
    const j = journal();
    const p = twoSections();
    const q = new SaveQueue(
      async () => {},
      j,
      () => {},
    );
    q.open(p.id, p);
    j.writes.length = 0;
    q.enqueue(edit(p, 1, "typed"));
    expect(j.writes).toEqual([
      entryKey(p.id, p.entries[1].id),
      journalKey(p.id),
    ]);
    const header = j.getItem(journalKey(p.id))!;
    expect(header).not.toContain("typed");
    expect(JSON.parse(header).journaled).toEqual([p.entries[1].id]);
  });
  it("sends only changed entries with the revision they build on", async () => {
    const j = journal();
    const p = twoSections();
    const sent: Change[] = [];
    const q = new SaveQueue(
      async (c) => void sent.push(c),
      j,
      () => {},
    );
    q.open(p.id, p);
    const next = edit(p, 0, "first");
    q.enqueue(next);
    await q.flush();
    q.enqueue(edit(next, 1, "second"));
    await q.flush();
    expect(sent.map((c) => c.entries.map((e) => e.text))).toEqual([
      ["first"],
      ["second"],
    ]);
    expect(sent.map((c) => c.baseRevision)).toEqual([1, 2]);
    expect(sent[1].header.entryIds).toEqual(p.entries.map((e) => e.id));
  });
  it("sends a brand-new project whole", async () => {
    const sent: Change[] = [];
    const q = new SaveQueue(
      async (c) => void sent.push(c),
      journal(),
      () => {},
    );
    const p = twoSections();
    q.enqueue(p);
    await q.flush();
    expect(sent[0].entries).toHaveLength(2);
    expect(sent[0].baseRevision).toBeNull();
  });
  it("after a failed save, the retry sends every entry", async () => {
    const p = twoSections();
    const sent: Change[] = [];
    let fail = true;
    const q = new SaveQueue(
      async (c) => {
        sent.push(c);
        if (fail) throw Error("IPC lost");
      },
      journal(),
      () => {},
    );
    q.open(p.id, p);
    q.enqueue(edit(p, 0, "maybe saved"));
    await expect(q.flush()).rejects.toThrow();
    fail = false;
    await q.flush();
    expect(sent[0].entries).toHaveLength(1);
    expect(sent[1].entries).toHaveLength(2);
    expect(sent[1].baseRevision).toBeNull();
  });
  it("recovers by combining the saved project with journaled entries", () => {
    const j = journal();
    const p = twoSections();
    const q = new SaveQueue(
      () => new Promise(() => {}),
      j,
      () => {},
    );
    q.open(p.id, p);
    const a = edit(p, 0, "unsaved one");
    const b = edit(a, 1, "unsaved two");
    q.enqueue(a);
    q.enqueue(b);
    expect(recover(p, j)).toEqual(b);
    // A fresh queue (app restart) picks the journal up and clears it once saved.
    const sent: Change[] = [];
    const restarted = new SaveQueue(
      async (c) => void sent.push(c),
      j,
      () => {},
    );
    expect(restarted.open(p.id, p)).toEqual(b);
    restarted.enqueue(b);
    return restarted.flush().then(() => {
      expect(sent[0].entries.map((e) => e.text)).toEqual([
        "unsaved one",
        "unsaved two",
      ]);
      expect(j.map.size).toBe(0);
    });
  });
  it("rebuilds a never-saved project entirely from the journal", () => {
    const j = journal();
    const p = twoSections();
    new SaveQueue(
      () => new Promise(() => {}),
      j,
      () => {},
    ).enqueue(p);
    expect(recover(null, j, p.id)).toEqual(p);
  });
  it("keeps an incomplete journal instead of guessing", () => {
    const j = journal();
    const p = twoSections();
    new SaveQueue(
      () => new Promise(() => {}),
      j,
      () => {},
    ).enqueue(p);
    j.removeItem(entryKey(p.id, p.entries[1].id));
    expect(() => recover(null, j, p.id)).toThrow("incomplete");
    expect(j.getItem(journalKey(p.id))).not.toBeNull();
  });
  it("keeps journaled entries until the newest revision is on disk", async () => {
    const j = journal();
    const p = twoSections();
    let release: () => void = () => {};
    const barrier = new Promise<void>((resolve) => (release = resolve));
    const q = new SaveQueue(
      async (c) => {
        if (c.header.revision === 2) await barrier;
      },
      j,
      () => {},
    );
    q.open(p.id, p);
    const a = edit(p, 0, "in flight");
    q.enqueue(a);
    const flush = q.flush();
    const b = edit(a, 1, "typed meanwhile");
    q.enqueue(b);
    expect(JSON.parse(j.getItem(journalKey(p.id))!).journaled).toEqual(
      p.entries.map((e) => e.id),
    );
    release();
    await flush;
    expect(j.map.size).toBe(0);
  });
});

it("accepts an already-committed whole-project journal even when JSON object key order differs", () => {
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
