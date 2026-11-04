import { describe, expect, it } from "vitest";
import { documentEdges, drawnColumnMax, drawnEdges, FOCUS_REVEAL_BAND, jointFit, marginFit, useMarginFit } from "./floating";

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
  it("expresses the column's max width in drawn pixels (zoomed paper)", () => {
    // 816 css px paper with 72 px padding at 150 %: drawn 1224 wide, column 1116 drawn; unzoomed it is 816 / 744.
    expect(drawnColumnMax(816, 1.5, 1224, 1116)).toBe(1116);
    // Squeezed to a 1000 drawn pane at 150 %: the column (892) can still grow to 1116, not to the unzoomed 744.
    expect(drawnColumnMax(816, 1.5, 1000, 892)).toBe(1116);
    expect(drawnColumnMax(816, 1, 700, 592)).toBe(708);
  });
  it("decides the sidebar and the card together, from the row alone (T229 r2 page view 100 %)", () => {
    // Page view 100 %: 816 sheet, 32 px viewport padding, pinned sidebar 270, research panel 390 + 3 px resizer.
    const page = (row: number, colMax = 816) => ({ row, colMax, pad: 32, skew: 0 });
    const research = { sidebar: 270, aside: 393, asideStays: false };
    // 1600: both float (margins 392 each): sidebar 360, card 360 -- the reviewer's steady state C.
    expect(jointFit(page(1600), research, 520)).toEqual({ left: { fits: true, width: 360 }, right: { fits: true, width: 360 } });
    // 1400: both floating leaves 292 (card needs 312); sidebar only, with the panel docked, 95;
    // card only, with the sidebar docked, 157. Nothing floats: no state can cover the sheet.
    expect(jointFit(page(1400), research, 520)).toEqual({ left: { fits: false, width: 0 }, right: { fits: false, width: 0 } });
    // 1240 at 75 % (612 sheet): margins 314, so the sidebar floats and Research opens the card.
    expect(jointFit(page(1240, 612), research, 520)).toEqual({ left: { fits: true, width: 282 }, right: { fits: true, width: 282 } });
    // 1100 page view: 142 margins; neither side floats.
    expect(jointFit(page(1100), research, 520).left.fits).toBe(false);
    // The fragment library stays whatever the card does: at 1600 it leaves 195 beside the sheet, too
    // little for the sidebar, so the sidebar must not float over the sheet.
    expect(jointFit(page(1600), { sidebar: 270, aside: 393, asideStays: true }, 520).left.fits).toBe(false);
    // No aside, sidebar unpinned (never docks): only the margins of the full row count.
    expect(jointFit(page(1600), { sidebar: 0, aside: 0, asideStays: true }, 270).left).toEqual({ fits: true, width: 270 });
  });
  it("lets a squeezed column take the room back and keeps a fixed column fixed", () => {
    // Continuous view, 1100 row: column can grow to 624 with 192 of paper padding, so it stops at 624 (margins 238).
    expect(jointFit({ row: 1100, colMax: 624, pad: 192, skew: 0 }, { sidebar: 270, aside: 0, asideStays: true }, 270).left).toEqual({ fits: true, width: 206 });
    // 1040: margins 208 leave 176 < 190, so the sidebar docks.
    expect(jointFit({ row: 1040, colMax: 624, pad: 192, skew: 0 }, { sidebar: 270, aside: 0, asideStays: true }, 270).left.fits).toBe(false);
    // Read prose (no pad): the column keeps its width in every candidate.
    expect(jointFit({ row: 1300, colMax: 700, skew: 0 }, { sidebar: 270, aside: 0, asideStays: true }, 270).left).toEqual({ fits: true, width: 268 });
    // A skew (scrollbar on the right) moves room from one margin to the other.
    expect(jointFit({ row: 1600, colMax: 816, pad: 32, skew: 10 }, { sidebar: 0, aside: 0, asideStays: true }, 520)).toEqual({ left: { fits: true, width: 370 }, right: { fits: true, width: 350 } });
  });
  it("never floats less with more room", () => {
    for (const asideStays of [false, true]) {
      const room = { sidebar: 270, aside: 393, asideStays };
      let prev = -1;
      for (let row = 800; row <= 2400; row += 5) {
        const fit = jointFit({ row, colMax: 816, pad: 32, skew: 0 }, room, 520);
        const n = Number(fit.left.fits) + Number(fit.right.fits);
        expect(n).toBeGreaterThanOrEqual(prev);
        prev = n;
      }
    }
  });
});
