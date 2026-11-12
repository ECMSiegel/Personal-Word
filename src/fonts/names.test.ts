import { describe, expect, it } from "vitest";
import { fontValue, primaryFamily, sameFont } from "./names";

describe("primaryFamily", () => {
  it("strips double quotes from a quoted family", () => {
    expect(primaryFamily('"Times New Roman", serif')).toBe("Times New Roman");
  });
  it("returns an unquoted family as is", () => {
    expect(primaryFamily("Georgia")).toBe("Georgia");
  });
  it("strips single quotes", () => {
    expect(primaryFamily("'Gill Sans', sans-serif")).toBe("Gill Sans");
  });
  it("takes the first family of a multi-family value", () => {
    expect(
      primaryFamily('Futura, "Avenir Next", -apple-system, sans-serif'),
    ).toBe("Futura");
  });
  it("keeps a digit-leading or digit-ending family whole", () => {
    expect(primaryFamily('"Source Sans 3", sans-serif')).toBe("Source Sans 3");
    expect(primaryFamily('"3 Dimensions", serif')).toBe("3 Dimensions");
  });
  it("removes extra spaces", () => {
    expect(primaryFamily('  "  Times   New Roman " ,  serif')).toBe(
      "Times New Roman",
    );
    expect(primaryFamily("  Avenir   Next  , sans-serif")).toBe("Avenir Next");
  });
  it("keeps a comma inside a quoted family", () => {
    expect(primaryFamily('"Odd, Name", serif')).toBe("Odd, Name");
  });
});

describe("sameFont", () => {
  it("matches the same family written differently, ignoring case", () => {
    expect(sameFont('"Times New Roman", serif', "times new roman")).toBe(true);
    expect(sameFont("'Georgia'", '"Georgia", serif')).toBe(true);
  });
  it("does not match different families", () => {
    expect(sameFont("Georgia, serif", "Futura, sans-serif")).toBe(false);
  });
});

describe("fontValue", () => {
  it("always double-quotes the family", () => {
    expect(fontValue("Source Sans 3")).toBe('"Source Sans 3", sans-serif');
    expect(fontValue("Georgia")).toBe('"Georgia", sans-serif');
  });
  it("round-trips through primaryFamily", () => {
    expect(primaryFamily(fontValue("Source Sans 3"))).toBe("Source Sans 3");
  });
});
