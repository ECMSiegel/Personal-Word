import { describe, expect, it } from "vitest";
import { placePopover, type RectLike } from "./Popover";

// Placement rules (docs/design-system.md, Popover): window logic when no
// scroll container is found, boundary logic otherwise, never moving a
// toolbar popover. All numbers come from the plan's ### B2 examples.

const rect = (left: number, top: number, width: number, height: number): RectLike => ({
  left,
  top,
  width,
  height,
  right: left + width,
  bottom: top + height,
});

const VIEWPORT = { width: 1440, height: 900 };

describe("placePopover without a boundary (today's window rules)", () => {
  it("keeps a mid-screen menu start-aligned and open downward", () => {
    const out = placePopover({
      trigger: rect(100, 400, 200, 30),
      popupWidth: 250,
      popupHeight: 120,
      viewport: VIEWPORT,
      boundary: null,
      align: "start",
    });
    expect(out).toEqual({ end: false, up: false, maxWidth: null, maxHeight: 120 });
  });

  it("flips to the end at the window's right edge", () => {
    const out = placePopover({
      trigger: rect(1250, 400, 100, 30),
      popupWidth: 250,
      popupHeight: 120,
      viewport: VIEWPORT,
      boundary: null,
      align: "start",
    });
    expect(out.end).toBe(true);
    expect(out.up).toBe(false);
    expect(out.maxWidth).toBeNull();
  });

  it("honours align end unconditionally", () => {
    const out = placePopover({
      trigger: rect(100, 400, 200, 30),
      popupWidth: 250,
      popupHeight: 120,
      viewport: VIEWPORT,
      boundary: null,
      align: "end",
    });
    expect(out.end).toBe(true);
  });

  it("flips up and clamps the height near the window's bottom", () => {
    const out = placePopover({
      trigger: rect(100, 700, 200, 30),
      popupWidth: 250,
      popupHeight: 800,
      viewport: VIEWPORT,
      boundary: null,
      align: "start",
    });
    expect(out.up).toBe(true);
    expect(out.maxHeight).toBe(692); // trigger.top - 8
  });

  it("keeps the natural height when the below-space is larger", () => {
    const out = placePopover({
      trigger: rect(100, 700, 200, 30),
      popupWidth: 250,
      popupHeight: 120,
      viewport: VIEWPORT,
      boundary: null,
      align: "start",
    });
    expect(out.up).toBe(false);
    expect(out.maxHeight).toBe(120); // min(popupHeight, below = 162)
  });
});

describe("placePopover with a scroll-container boundary", () => {
  // The research aside: 390 px wide, flush with the window's right edge.
  const ASIDE = rect(1050, 34, 390, 866);

  it("flips to the end when start would cross the boundary's right edge", () => {
    const out = placePopover({
      trigger: rect(1311.8, 640, 112.2, 23),
      popupWidth: 156.6,
      popupHeight: 113,
      viewport: VIEWPORT,
      boundary: ASIDE,
      align: "start",
    });
    expect(out.end).toBe(true);
    expect(out.up).toBe(false);
    expect(out.maxWidth).toBe(390 - 16);
  });

  it("keeps start alignment when it fits inside the boundary", () => {
    const out = placePopover({
      trigger: rect(25, 200, 219, 23),
      popupWidth: 227,
      popupHeight: 102,
      viewport: VIEWPORT,
      boundary: rect(0, 137, 270, 615),
      align: "start",
    });
    expect(out.end).toBe(false); // 25 + 227 = 252 fits inside 270 - 8
    expect(out.up).toBe(false); // below-space 521 fits the 102 px menu
    expect(out.maxWidth).toBe(270 - 16);
  });

  it("clamps maxWidth to the boundary width minus 16 even when neither side fits", () => {
    const out = placePopover({
      trigger: rect(20, 100, 140, 20),
      popupWidth: 227,
      popupHeight: 102,
      viewport: VIEWPORT,
      boundary: rect(0, 0, 174, 600),
      align: "start",
    });
    expect(out.end).toBe(false); // neither side fits: keep start
    expect(out.maxWidth).toBe(174 - 16);
  });

  it("flips up when the menu would cross the boundary's bottom edge", () => {
    const out = placePopover({
      trigger: rect(25, 640, 219, 23),
      popupWidth: 227,
      popupHeight: 102,
      viewport: VIEWPORT,
      boundary: rect(0, 137, 270, 615),
      align: "start",
    });
    expect(out.up).toBe(true);
    expect(out.maxHeight).toBe(102);
  });

  it("clamps maxHeight to the above-space when flipping up inside the boundary", () => {
    const out = placePopover({
      trigger: rect(25, 640, 219, 23),
      popupWidth: 227,
      popupHeight: 700,
      viewport: VIEWPORT,
      boundary: rect(0, 137, 270, 615),
      align: "start",
    });
    expect(out.up).toBe(true);
    expect(out.maxHeight).toBe(640 - 137 - 8); // trigger.top - boundary.top - 8
  });

  it("still honours align end inside a boundary (maxWidth does the capping)", () => {
    const out = placePopover({
      trigger: rect(40, 100, 100, 23),
      popupWidth: 227,
      popupHeight: 102,
      viewport: VIEWPORT,
      boundary: rect(0, 0, 174, 600),
      align: "end",
    });
    expect(out.end).toBe(true);
    expect(out.maxWidth).toBe(174 - 16);
  });

  it("falls back to window rules when the boundary is outside the viewport", () => {
    const out = placePopover({
      trigger: rect(100, 400, 200, 30),
      popupWidth: 250,
      popupHeight: 120,
      viewport: VIEWPORT,
      boundary: rect(2000, 0, 100, 100),
      align: "start",
    });
    expect(out).toEqual({ end: false, up: false, maxWidth: null, maxHeight: 120 });
  });
});
