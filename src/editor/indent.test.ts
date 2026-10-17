import { describe, it, expect } from "vitest";
import { parseInches, stepIndent } from "./indent";

describe("indent values", () => {
  it("parses empty, zero and unit-bearing values", () => {
    expect(parseInches(null)).toBe(0);
    expect(parseInches("")).toBe(0);
    expect(parseInches("0")).toBe(0);
    expect(parseInches("0.5in")).toBe(0.5);
    expect(parseInches("36pt")).toBe(0.5);
    expect(parseInches("48px")).toBe(0.5);
  });

  it("steps by half an inch and returns attribute strings", () => {
    expect(stepIndent(null, 1)).toBe("0.5in");
    expect(stepIndent("0.5in", 1)).toBe("1in");
    expect(stepIndent("1in", -1)).toBe("0.5in");
    expect(stepIndent("0.5in", -1)).toBe("0");
    expect(stepIndent(null, -1)).toBe("0");
    expect(stepIndent("36pt", 0)).toBe("0.5in");
  });

  it("never goes below zero or above four inches", () => {
    expect(stepIndent("0in", -1)).toBe("0");
    expect(stepIndent("4in", 1)).toBe("4in");
    expect(stepIndent("3.8in", 1)).toBe("4in");
  });
});
