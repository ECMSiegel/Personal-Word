import { bench, describe } from "vitest";
import { SaveQueue, type Journal } from "./save-queue";
import {
  entryWords,
  newProject,
  now,
  words,
  type Entry,
  type Project,
} from "./model";

// 100 sections x 1,000 words = 100,000 words.
function bigProject(): Project {
  const p = newProject("Benchmark");
  const sentence =
    "The quiet river carried every word we wrote far downstream.";
  const entries: Entry[] = Array.from({ length: 100 }, (_, s) => {
    const paragraphs = Array.from({ length: 100 }, (_, i) =>
      sentence.replace("river", `river${s}.${i}`),
    );
    return {
      id: crypto.randomUUID(),
      kind: "section",
      title: "Section " + s,
      content: {
        type: "doc",
        content: paragraphs.map((text) => ({
          type: "paragraph",
          content: [{ type: "text", text }],
        })),
      },
      text: paragraphs.join("\n"),
      updatedAt: now(),
      origin: null,
    };
  });
  return { ...p, entries, order: entries.map((e) => e.id) };
}
const memory = (): Journal => {
  const map = new Map<string, string>();
  return {
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => void map.set(k, v),
    removeItem: (k) => void map.delete(k),
  };
};

describe("100k-word project", () => {
  const base = bigProject();
  const total = base.entries.reduce((n, e) => n + words(e.text), 0);
  if (total < 100_000) throw new Error("benchmark project too small: " + total);
  let current = base;
  let payload = 0;
  // Persist stands in for IPC: serializing the change is the frontend's share of a save.
  const queue = new SaveQueue(
    async (change) => {
      payload = JSON.stringify({ change }).length;
    },
    memory(),
    () => {},
  );
  queue.open(base.id, base);
  const target = base.entries[50].id;
  const type = () => {
    const p = current;
    const entries = p.entries.map((e) =>
      e.id === target ? { ...e, text: e.text + "x", updatedAt: now() } : e,
    );
    current = { ...p, entries, revision: p.revision + 1, updatedAt: now() };
    queue.enqueue(current);
  };
  // One keystroke: App.mutate/apply + SaveQueue.enqueue + sidebar word totals.
  bench("keystroke (mutate + journal + sidebar)", () => {
    type();
    current.order
      .map((id) => current.entries.find((e) => e.id === id)!)
      .reduce((sum, e) => sum + entryWords(e), 0);
  });
  // Frontend half of one autosave after a keystroke: diff + the payload that crosses IPC.
  bench(
    "save (diff + JSON for IPC)",
    async () => {
      type();
      await queue.flush();
    },
    { teardown: () => console.log(`IPC payload: ${payload} bytes`) },
  );
});
