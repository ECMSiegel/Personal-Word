import { describe, expect, it } from "vitest";
import { findProseIssues } from "./proseCheck";

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
});
