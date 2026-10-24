import { describe, expect, it, vi } from "vitest";
import { findProseIssues } from "./proseCheck";
import { createProseWorkerHandler } from "../derived/prose.worker";

describe("findProseIssues", () => {
  it("flags the the", () => {
    expect(findProseIssues("The the cat.").some((issue) => issue.kind === "repeat")).toBe(true);
  });
  it("flags a repeated content word within eight words but not the", () => {
    const issues = findProseIssues("the river crossed a quiet field beside the river bank");
    expect(issues.some((issue) => issue.kind === "repeat" && issue.message.includes("river"))).toBe(true);
    expect(findProseIssues("the path led to the river").some((issue) => issue.kind === "repeat")).toBe(false);
  });
  it("flags was written and was quickly written", () => {
    expect(findProseIssues("The letter was written. It was quickly written.").filter((issue) => issue.kind === "passive")).toHaveLength(2);
  });
  it("does not flag is based on", () => {
    expect(findProseIssues("The answer is based on evidence.").some((issue) => issue.kind === "passive")).toBe(false);
    expect(findProseIssues("The answer is related to evidence. It is used to working.").some((issue) => issue.kind === "passive")).toBe(false);
    expect(findProseIssues("The answer is based around evidence.").some((issue) => issue.kind === "passive")).toBe(true);
  });
  it("flags very and in order to", () => {
    expect(findProseIssues("It is very useful in order to learn.").filter((issue) => issue.kind === "filler")).toHaveLength(2);
  });
  it("flags a 41-word sentence and not a 40-word one", () => {
    const sentence = (count: number) => Array.from({ length: count }, (_, i) => `word${i}`).join(" ") + ".";
    expect(findProseIssues(sentence(40)).some((issue) => issue.kind === "long")).toBe(false);
    expect(findProseIssues(sentence(41)).some((issue) => issue.kind === "long")).toBe(true);
  });
  it("does not split at et al. or e.g.", () => {
    const text = "Smith et al. and e.g. are examples followed by " + Array.from({ length: 37 }, () => "words").join(" ") + ".";
    expect(findProseIssues(text).some((issue) => issue.kind === "long")).toBe(true);
  });
  it("never flags inside quotation marks", () => {
    const issues = findProseIssues('"the the very words" and “the the very words”');
    expect(issues).toEqual([]);
  });
  it("keeps offsets in UTF-16 units after quoted emoji", () => {
    const text = "“😀” The the cat.";
    const repeated = findProseIssues(text).find((issue) => issue.kind === "repeat")!;
    expect(repeated.from).toBe(text.lastIndexOf("the"));
    expect(repeated.to).toBe(text.lastIndexOf("the") + 3);
  });
  it("does not make an issue range cross quoted text", () => {
    const passive = findProseIssues("It was “very” quickly written.");
    expect(passive.some((issue) => issue.kind === "passive")).toBe(false);
    const long = "A " + Array.from({ length: 22 }, () => "word").join(" ") + " “quoted words here” " + Array.from({ length: 20 }, () => "word").join(" ") + ".";
    expect(findProseIssues(long).some((issue) => issue.kind === "long")).toBe(false);
  });

  it("preserves issue order, ranges, and messages across overlapping rule types", () => {
    expect(findProseIssues("The the. It was written. It is very useful in order to learn.")).toEqual([
      { from: 4, to: 7, kind: "repeat", message: "Repeated word: the" },
      { from: 12, to: 23, kind: "passive", message: "Possible passive voice" },
      { from: 31, to: 35, kind: "filler", message: "Consider removing “very”" },
      { from: 43, to: 54, kind: "filler", message: "Consider replacing “in order to” with “to”" },
    ]);
  });

  it("keeps all 9,999 distinct adjacent-repeat ranges in a large repeated-word block", () => {
    const text = Array.from({ length: 10_000 }, () => "the.").join(" ");
    const issues = findProseIssues(text);
    const repeats = issues.filter(issue => issue.kind === "repeat");
    expect(repeats).toHaveLength(9_999);
    expect(repeats[0]).toMatchObject({ from: 5, to: 8, kind: "repeat" });
    expect(repeats.at(-1)).toMatchObject({ from: 49_995, to: 49_998, kind: "repeat" });
    expect(issues.some(issue => issue.kind === "long")).toBe(false);
  });
});

describe("prose worker block cache", () => {
  it("reuses unchanged block analysis, repositions it, and rescans only changed text", () => {
    const analyze = vi.fn(findProseIssues);
    const handle = createProseWorkerHandler(analyze);
    const first = handle({ entryId: "entry", revision: 1, requestId: 1, changedBlocks: [
      { id: "a", from: 1, text: "The the cat." },
      { id: "b", from: 20, text: "Very quiet." },
    ], blockPositions: [{ id: "a", from: 1 }, { id: "b", from: 20 }] });
    expect(first.total).toBeGreaterThan(0);
    expect(analyze).toHaveBeenCalledTimes(2);

    const second = handle({ entryId: "entry", revision: 2, requestId: 2, changedBlocks: [
      { id: "b", from: 28, text: "Really quiet." },
    ], blockPositions: [{ id: "a", from: 9 }, { id: "b", from: 28 }] });
    expect(analyze).toHaveBeenCalledTimes(3);
    expect(second.issues.find((issue) => issue.blockId === "a")?.from).toBe(13);
    expect(second.issues.every((issue) => issue.id?.includes(":a:") || issue.id?.includes(":b:"))).toBe(true);
  });

  it("does not conflate identical prose in separate block identities and drops removed blocks", () => {
    const handle = createProseWorkerHandler();
    const result = handle({ entryId: "entry", revision: 1, requestId: 1, changedBlocks: [
      { id: "first", from: 1, text: "The the." },
      { id: "second", from: 12, text: "The the." },
    ], blockPositions: [{ id: "first", from: 1 }, { id: "second", from: 12 }] });
    expect(result.issues.map((issue) => issue.blockId)).toEqual(["first", "second"]);
    const afterRemoval = handle({ entryId: "entry", revision: 2, requestId: 2, changedBlocks: [
    ], blockPositions: [{ id: "second", from: 1 }] });
    expect(afterRemoval.issues).toHaveLength(1);
    expect(afterRemoval.issues[0].blockId).toBe("second");
  });

  it("reanalyzes a restored block after an earlier request removed it from the worker cache", () => {
    const analyze = vi.fn(findProseIssues);
    const handle = createProseWorkerHandler(analyze);
    handle({ entryId: "entry", revision: 1, requestId: 1, changedBlocks: [{ id: "restored", from: 1, text: "The the." }], blockPositions: [{ id: "restored", from: 1 }] });
    handle({ entryId: "entry", revision: 2, requestId: 2, changedBlocks: [], blockPositions: [] });
    const restored = handle({ entryId: "entry", revision: 3, requestId: 3, changedBlocks: [{ id: "restored", from: 1, text: "The the." }], blockPositions: [{ id: "restored", from: 1 }] });
    expect(analyze).toHaveBeenCalledTimes(2);
    expect(restored.total).toBeGreaterThan(0);
  });

  it("changes issue identity whenever its block text changes, even when the warning text stays the same", () => {
    const handle = createProseWorkerHandler();
    const first = handle({ entryId: "entry", revision: 1, requestId: 1, changedBlocks: [{ id: "block", from: 1, text: "The the cat." }], blockPositions: [{ id: "block", from: 1 }] });
    const edited = handle({ entryId: "entry", revision: 2, requestId: 2, changedBlocks: [{ id: "block", from: 1, text: "The the cats." }], blockPositions: [{ id: "block", from: 1 }] });
    expect(first.issues[0].message).toBe(edited.issues[0].message);
    expect(first.issues[0].id).not.toBe(edited.issues[0].id);
  });
});
