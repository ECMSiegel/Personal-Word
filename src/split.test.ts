import { describe, expect, it } from "vitest";
import {
  activeOf,
  closeRight,
  focusSide,
  openBeside,
  prune,
  readSplit,
  readSplitRatio,
  select,
  SPLIT_RATIO_KEY,
  splitKey,
  writeSplit,
  writeSplitRatio,
  type Split,
} from "./split";

function memory(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  return {
    data,
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => void data.set(key, value),
    removeItem: (key: string) => void data.delete(key),
  };
}

const ids = ["a", "b", "c"];
const sources = ["s1"];
const pair: Split = { left: "a", right: { kind: "entry", id: "b" }, focused: "right" };

describe("split keys", () => {
  it("are per project for panes and global for the ratio", () => {
    expect(splitKey("p1")).toBe("personal-word.split.p1");
    expect(SPLIT_RATIO_KEY).toBe("personal-word.splitRatio");
  });
});

describe("openBeside", () => {
  it("opens an entry beside the active one and focuses the right pane", () => {
    expect(openBeside(null, "a", { kind: "entry", id: "b" })).toEqual(pair);
  });
  it("opens a pdf beside and keeps focus on the left", () => {
    expect(openBeside(null, "a", { kind: "pdf", sourceId: "s1" })).toEqual({
      left: "a",
      right: { kind: "pdf", sourceId: "s1" },
      focused: "left",
    });
  });
  it("does nothing for the entry already on the left", () => {
    expect(openBeside(null, "a", { kind: "entry", id: "a" })).toBeNull();
    expect(openBeside(pair, "b", { kind: "entry", id: "a" })).toBe(pair);
  });
  it("does nothing without an active entry", () => {
    expect(openBeside(null, "", { kind: "entry", id: "a" })).toBeNull();
  });
  it("replaces the right pane of an open split", () => {
    const left = { ...pair, focused: "left" as const };
    expect(openBeside(left, "a", { kind: "entry", id: "c" })).toEqual({
      left: "a",
      right: { kind: "entry", id: "c" },
      focused: "right",
    });
    expect(openBeside(pair, "b", { kind: "pdf", sourceId: "s1" })).toEqual({
      left: "a",
      right: { kind: "pdf", sourceId: "s1" },
      focused: "left",
    });
  });
});

describe("focusSide", () => {
  it("moves focus and keeps identity when nothing changes", () => {
    expect(focusSide(pair, "left")).toEqual({ ...pair, focused: "left" });
    expect(focusSide(pair, "right")).toBe(pair);
  });
  it("never focuses a pdf pane", () => {
    const pdf: Split = { left: "a", right: { kind: "pdf", sourceId: "s1" }, focused: "left" };
    expect(focusSide(pdf, "right")).toBe(pdf);
  });
});

describe("select", () => {
  it("moves focus to the pane that already shows the entry", () => {
    expect(select(pair, "a")).toEqual({ ...pair, focused: "left" });
    expect(select({ ...pair, focused: "left" }, "b")).toEqual(pair);
    expect(select(pair, "b")).toBe(pair);
  });
  it("replaces the focused pane's entry otherwise", () => {
    expect(select(pair, "c")).toEqual({ ...pair, right: { kind: "entry", id: "c" } });
    expect(select({ ...pair, focused: "left" }, "c")).toEqual({ ...pair, left: "c", focused: "left" });
  });
  it("replaces the left entry when the right pane holds a pdf", () => {
    const pdf: Split = { left: "a", right: { kind: "pdf", sourceId: "s1" }, focused: "left" };
    expect(select(pdf, "c")).toEqual({ ...pdf, left: "c" });
  });
});

describe("activeOf and closeRight", () => {
  it("returns the focused entry and the left entry on close", () => {
    expect(activeOf(pair)).toBe("b");
    expect(activeOf({ ...pair, focused: "left" })).toBe("a");
    expect(activeOf({ left: "a", right: { kind: "pdf", sourceId: "s1" }, focused: "left" })).toBe("a");
    expect(closeRight(pair)).toBe("a");
  });
});

describe("prune", () => {
  it("keeps a split whose panes still exist", () => {
    expect(prune(pair, ids, sources)).toBe(pair);
    expect(prune(null, ids, sources)).toBeNull();
  });
  it("closes the split when either pane's content is gone", () => {
    expect(prune(pair, ["a"], sources)).toBeNull();
    expect(prune(pair, ["b"], sources)).toBeNull();
    expect(prune({ left: "a", right: { kind: "pdf", sourceId: "s1" }, focused: "left" }, ids, [])).toBeNull();
  });
});

describe("split storage", () => {
  it("round-trips and removes", () => {
    const store = memory();
    writeSplit(store, "p", pair);
    expect(readSplit(store, "p", ids, sources)).toEqual(pair);
    writeSplit(store, "p", null);
    expect(store.data.has(splitKey("p"))).toBe(false);
    expect(readSplit(store, "p", ids, sources)).toBeNull();
  });
  it("rejects garbage", () => {
    for (const raw of [
      "not json",
      "null",
      "42",
      "[]",
      JSON.stringify({ left: 1, right: { kind: "entry", id: "b" }, focused: "left" }),
      JSON.stringify({ left: "a", right: { kind: "video", id: "b" }, focused: "left" }),
      JSON.stringify({ left: "a", right: { kind: "entry", id: "b" }, focused: "middle" }),
      JSON.stringify({ left: "a", right: "b", focused: "left" }),
    ])
      expect(readSplit(memory({ [splitKey("p")]: raw }), "p", ids, sources)).toBeNull();
  });
  it("rejects missing ids and the same entry twice", () => {
    const read = (split: unknown) =>
      readSplit(memory({ [splitKey("p")]: JSON.stringify(split) }), "p", ids, sources);
    expect(read({ ...pair, left: "gone" })).toBeNull();
    expect(read({ ...pair, right: { kind: "entry", id: "gone" } })).toBeNull();
    expect(read({ ...pair, right: { kind: "pdf", sourceId: "gone" } })).toBeNull();
    expect(read({ ...pair, right: { kind: "entry", id: "a" } })).toBeNull();
  });
  it("never restores focus onto a pdf pane", () => {
    const stored = { left: "a", right: { kind: "pdf", sourceId: "s1" }, focused: "right" };
    expect(readSplit(memory({ [splitKey("p")]: JSON.stringify(stored) }), "p", ids, sources)).toEqual({
      ...stored,
      focused: "left",
    });
  });
  it("survives a storage that throws", () => {
    const broken = {
      getItem: () => {
        throw new Error("denied");
      },
      setItem: () => {
        throw new Error("denied");
      },
      removeItem: () => {
        throw new Error("denied");
      },
    };
    expect(readSplit(broken, "p", ids, sources)).toBeNull();
    expect(() => writeSplit(broken, "p", pair)).not.toThrow();
    expect(readSplitRatio(broken)).toBe(0.5);
    expect(() => writeSplitRatio(broken, 0.4)).not.toThrow();
  });
});

describe("split ratio", () => {
  it("defaults to a half and clamps to a quarter and three quarters", () => {
    expect(readSplitRatio(memory())).toBe(0.5);
    expect(readSplitRatio(memory({ [SPLIT_RATIO_KEY]: "garbage" }))).toBe(0.5);
    expect(readSplitRatio(memory({ [SPLIT_RATIO_KEY]: "0.1" }))).toBe(0.25);
    expect(readSplitRatio(memory({ [SPLIT_RATIO_KEY]: "0.9" }))).toBe(0.75);
    expect(readSplitRatio(memory({ [SPLIT_RATIO_KEY]: "0.6" }))).toBe(0.6);
  });
  it("writes a clamped value", () => {
    const store = memory();
    writeSplitRatio(store, 2);
    expect(readSplitRatio(store)).toBe(0.75);
    writeSplitRatio(store, 0.3);
    expect(store.data.get(SPLIT_RATIO_KEY)).toBe("0.3");
  });
});
