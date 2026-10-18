import { describe, expect, it } from "vitest";
import { cleanPastedQuote, isBlockQuote, pasteIntoQuote, quoteTextForStorage } from "./quoteText";

describe("captured quote text", () => {
  it("joins hyphenated line breaks from PDF copy", () => expect(cleanPastedQuote("evi-\ndence across\nlines")).toBe("evidence across lines"));
  it("strips one pair of surrounding quotation marks only", () => {
    expect(cleanPastedQuote("  “A quoted line.”  ")).toBe("A quoted line.");
    expect(cleanPastedQuote('"One" and "two"')).toBe('One" and "two');
  });
  it("treats 100 words as a block quotation and 99 as inline", () => {
    expect(isBlockQuote(Array(100).fill("word").join(" "))).toBe(true);
    expect(isBlockQuote(Array(99).fill("word").join(" "))).toBe(false);
  });
  it("replaces the selected text with cleaned pasted text", () => {
    expect(pasteIntoQuote("before selected after", 7, 15, "evi-\ndence")).toEqual({
      text: "before evidence after",
      caret: 15,
    });
  });
  it("preserves punctuation in text entered manually", () => {
    expect(quoteTextForStorage("  evi-\ndence, as written!  ")).toBe("evi-\ndence, as written!");
  });
});
