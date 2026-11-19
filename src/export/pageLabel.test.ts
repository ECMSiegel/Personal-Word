import { describe, it, expect } from "vitest";
import { pageLabel, pageLabelPosition } from "./pageLabel";

const on = { pageNumbers: true };

describe("pageLabel", () => {
  it("numbers only: page index + 1", () => {
    expect(pageLabel(on, undefined, 0)).toBe("1");
    expect(pageLabel(on, undefined, 10)).toBe("11");
  });
  it("nothing when numbers are off and there is no text", () => {
    expect(pageLabel({ pageNumbers: false }, undefined, 3)).toBeNull();
    expect(pageLabel({ pageNumbers: false, pageHeaderText: "   " }, undefined, 3)).toBeNull();
  });
  it("text then number joined by one space", () => {
    expect(pageLabel({ ...on, pageHeaderText: "Siegel" }, undefined, 10)).toBe("Siegel 11");
    expect(pageLabel({ ...on, pageHeaderText: "  Siegel  " }, undefined, 0)).toBe("Siegel 1");
  });
  it("text with numbers off shows the text alone", () => {
    expect(pageLabel({ pageNumbers: false, pageHeaderText: "Siegel" }, undefined, 4)).toBe("Siegel");
  });
  it("different first page hides page one only", () => {
    const s = { ...on, pageHeaderText: "Siegel", pageFirstDifferent: true };
    expect(pageLabel(s, undefined, 0)).toBeNull();
    expect(pageLabel(s, undefined, 1)).toBe("Siegel 2");
  });
  it("Chicago: page one blank, page two is 1", () => {
    expect(pageLabel(on, "chicago", 0)).toBeNull();
    expect(pageLabel(on, "chicago", 1)).toBe("1");
    expect(pageLabel({ ...on, pageHeaderText: "Siegel" }, "chicago", 2)).toBe("Siegel 2");
  });
  it("Chicago with numbers off and no text draws nothing", () => {
    expect(pageLabel({ pageNumbers: false }, "chicago", 1)).toBeNull();
  });
});

describe("pageLabelPosition", () => {
  it("defaults to bottom-right", () => {
    expect(pageLabelPosition({})).toBe("bottom-right");
    expect(pageLabelPosition({ pageNumberPosition: "top-left" })).toBe("top-left");
  });
});
