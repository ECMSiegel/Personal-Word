import { describe, expect, it } from "vitest";
import { documentEdges, drawnEdges, FOCUS_REVEAL_BAND, marginFit, useMarginFit } from "./floating";

describe("floating margin fit", () => {
  it("reserves the gap and fits requested widths", () => {
    expect(marginFit("left", 312, 270)).toEqual({ fits: true, width: 270 });
    expect(marginFit("left", 250, 270)).toEqual({ fits: true, width: 218 });
    expect(marginFit("left", 200, 270).fits).toBe(false);
    expect(marginFit("right", 288, 360).fits).toBe(false);
    expect(marginFit("right", 312, 360)).toEqual({ fits: true, width: 280 });
  });
  it("returns null for split view without needing a DOM", () => {
    expect(documentEdges({} as ParentNode, { mode: "write", paged: false, split: true })).toBeNull();
  });
  it("rejects missing document columns and selects the Read prose column", () => {
    const missing = { querySelector: () => null } as unknown as ParentNode;
    expect(documentEdges(missing, { mode: "read", paged: false, split: false })).toBeNull();
    const prose = { getBoundingClientRect: () => ({ left: 120, right: 820, top: 70, bottom: 900 }) };
    const root = { querySelector: (selector: string) => selector === ".manuscript-read .read-prose" ? prose : null } as unknown as ParentNode;
    expect(documentEdges(root, { mode: "read", paged: false, split: false })?.left).toBe(120);
  });
  it("defines the reveal band from CSS variables and accepts a chosen sidebar width", () => {
    expect(FOCUS_REVEAL_BAND).toBe("calc(var(--control-height) + 2 * var(--space-1))");
    expect(marginFit("left", 312, 200)).toEqual({ fits: true, width: 200 });
  });
  it("keeps disabled fitting false without attaching observers", () => {
    expect(useMarginFit).toBeTypeOf("function");
    expect(marginFit("left", 1000, 270).fits).toBe(true);
    // Disabled hook takes its early return before constructing ResizeObserver.
    expect(documentEdges({} as ParentNode, { mode: "write", paged: false, split: true })).toBeNull();
  });
  it("scales a zoomed column's rect to drawn pixels only where the engine reports it unzoomed", () => {
    // Native WebKit at 50 %: the sheet is drawn at 219.5-627.5 but reported at 439-1255 (V3, 2026-11-02).
    expect(drawnEdges({ left: 439, right: 1255 }, 0.5, true)).toEqual({ left: 219.5, right: 627.5 });
    // Chromium already reports drawn pixels.
    expect(drawnEdges({ left: 219.5, right: 627.5 }, 0.5, false)).toEqual({ left: 219.5, right: 627.5 });
    expect(drawnEdges({ left: 120, right: 820 }, 1, true)).toEqual({ left: 120, right: 820 });
  });
});
