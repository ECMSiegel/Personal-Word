import { describe, expect, it } from "vitest";
import { documentFontStack } from "./documentFont";
import { primaryFamily } from "../fonts/names";

describe("documentFontStack", () => {
  it("sans follows the interface font", () => {
    const stack = documentFontStack("sans", '"Avenir Next", -apple-system, sans-serif');
    expect(primaryFamily(stack)).toBe("Avenir Next");
    expect(stack.startsWith('"Avenir Next"')).toBe(true);
  });
  it("sans with a bare family name still gets fallbacks", () => {
    const stack = documentFontStack("sans", "Source Sans 3");
    expect(primaryFamily(stack)).toBe("Source Sans 3");
    expect(stack).toMatch(/sans-serif$/);
  });
  it("sans with an empty interface font falls back to Futura", () => {
    expect(primaryFamily(documentFontStack("sans", ""))).toBe("Futura");
    expect(primaryFamily(documentFontStack(undefined, "  "))).toBe("Futura");
  });
  it("serif and mono do not change", () => {
    expect(documentFontStack("serif", "Verdana, sans-serif")).toBe("Times New Roman, serif");
    expect(documentFontStack("mono", "Verdana, sans-serif")).toBe("Courier New, monospace");
  });
});
