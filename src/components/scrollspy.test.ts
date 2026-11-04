import { afterEach, describe, expect, it, vi } from "vitest";
import { activeIndex, easedScrollTo, previewText, quartic, scrollProgress, sectionProgress, spyMagnify, SPY_RADIUS } from "./scrollspy";
import { DOCK_PEAK, dockScale } from "./dock";

describe("activeIndex", () => {
  it("is 0 for an empty list", () => expect(activeIndex([], 900, false)).toBe(0));
  it("is 0 when every section is below the one-third line", () =>
    expect(activeIndex([400, 900, 1500], 900, false)).toBe(0));
  it("picks the last section whose top is above one third of the viewport", () => {
    expect(activeIndex([-1200, -300, 250, 800], 900, false)).toBe(2);
    expect(activeIndex([-1200, -300, 300, 800], 900, false)).toBe(2);
    expect(activeIndex([-1200, -300, 301, 800], 900, false)).toBe(1);
  });
  it("picks the last section at the bottom of the scroll", () =>
    expect(activeIndex([-1200, -600, 500, 700], 900, true)).toBe(3));
  it("atBottom with an empty list is still 0", () => expect(activeIndex([], 900, true)).toBe(0));
});

describe("quartic", () => {
  it("fixes 0, 0.5 and 1", () => {
    expect(quartic(0)).toBe(0);
    expect(quartic(0.5)).toBeCloseTo(0.5, 10);
    expect(quartic(1)).toBe(1);
  });
  it("is monotonic", () => {
    let prev = -1;
    for (let i = 0; i <= 100; i++) {
      const v = quartic(i / 100);
      expect(v).toBeGreaterThanOrEqual(prev);
      prev = v;
    }
  });
  it("clamps outside 0..1", () => {
    expect(quartic(-1)).toBe(0);
    expect(quartic(2)).toBe(1);
  });
});

describe("easedScrollTo", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("instant sets the final scrollTop synchronously", () => {
    const el = { scrollTop: 40 } as HTMLElement;
    const cancel = easedScrollTo(el, 500, { instant: true });
    expect(el.scrollTop).toBe(500);
    expect(typeof cancel).toBe("function");
  });

  it("eases over the duration and lands exactly", () => {
    let t = 0;
    const queue: FrameRequestCallback[] = [];
    vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => (queue.push(cb), queue.length));
    vi.stubGlobal("cancelAnimationFrame", () => {});
    vi.stubGlobal("performance", { now: () => t });
    const el = { scrollTop: 0 } as HTMLElement;
    const onDone = vi.fn();
    easedScrollTo(el, 1000, { duration: 600, onDone });
    const seen: number[] = [];
    for (const ms of [150, 300, 450, 600]) {
      t = ms;
      queue.shift()!(t);
      seen.push(el.scrollTop);
      if (ms < 600) expect(onDone).not.toHaveBeenCalled();
    }
    expect(onDone).toHaveBeenCalledTimes(1);
    expect(seen[0]).toBeGreaterThan(0);
    expect(seen[0]).toBeLessThan(seen[1]);
    expect(seen[1]).toBeCloseTo(500, 5);
    expect(seen[3]).toBe(1000);
    expect(queue.length).toBe(0);
  });

  it("Reduce Motion lands at once with no animation frame (matchMedia stub)", () => {
    const frames: FrameRequestCallback[] = [];
    vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => (frames.push(cb), frames.length));
    vi.stubGlobal("cancelAnimationFrame", () => {});
    vi.stubGlobal("performance", { now: () => 0 });
    vi.stubGlobal("window", { matchMedia: (query: string) => ({ matches: query === "(prefers-reduced-motion: reduce)", media: query }) });
    const el = { scrollTop: 40 } as HTMLElement;
    const cancel = easedScrollTo(el, 700);
    expect(el.scrollTop).toBe(700);
    expect(frames.length).toBe(0);
    expect(() => cancel()).not.toThrow();
  });

  it("without Reduce Motion the same call animates (the stub is what changes it)", () => {
    const frames: FrameRequestCallback[] = [];
    vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => (frames.push(cb), frames.length));
    vi.stubGlobal("cancelAnimationFrame", () => {});
    vi.stubGlobal("performance", { now: () => 0 });
    vi.stubGlobal("window", { matchMedia: (query: string) => ({ matches: false, media: query }) });
    const el = { scrollTop: 40 } as HTMLElement;
    easedScrollTo(el, 700);
    expect(el.scrollTop).toBe(40);
    expect(frames.length).toBe(1);
  });

  it("cancel stops the loop", () => {
    const queue: FrameRequestCallback[] = [];
    vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => (queue.push(cb), queue.length));
    vi.stubGlobal("cancelAnimationFrame", () => {});
    vi.stubGlobal("performance", { now: () => 0 });
    const el = { scrollTop: 0 } as HTMLElement;
    const cancel = easedScrollTo(el, 1000);
    cancel();
    queue.shift()!(100);
    expect(el.scrollTop).toBe(0);
    expect(queue.length).toBe(0);
  });
});

// Wave 5 A3: proximity magnify and scroll progress.
describe("spyMagnify", () => {
  it("is 1 at zero distance and 0 at or beyond the radius", () => {
    expect(SPY_RADIUS).toBe(84);
    expect(spyMagnify(0)).toBeCloseTo(1, 10);
    expect(spyMagnify(84)).toBe(0);
    expect(spyMagnify(200)).toBe(0);
    expect(spyMagnify(-84)).toBe(0);
  });
  it("is symmetric and follows the dock curve rescaled to 0..1", () => {
    for (const d of [5, 20, 34, 42, 68]) {
      expect(spyMagnify(d)).toBeCloseTo(spyMagnify(-d), 10);
      expect(spyMagnify(d)).toBeCloseTo((dockScale(d, 84) - 1) / (DOCK_PEAK - 1), 10);
    }
    expect(spyMagnify(42)).toBeCloseTo(0.5, 10);
  });
  it("falls monotonically and stays inside 0..1", () => {
    let prev = 2;
    for (let d = 0; d <= 100; d += 2) {
      const v = spyMagnify(d);
      expect(v).toBeLessThanOrEqual(prev);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(1);
      prev = v;
    }
  });
  it("takes a custom radius", () => {
    expect(spyMagnify(20, 40)).toBeCloseTo(0.5, 10);
    expect(spyMagnify(40, 40)).toBe(0);
  });
});

describe("scrollProgress", () => {
  it("is 0 at the top, 1 at the bottom and linear between", () => {
    expect(scrollProgress(0, 500, 1500)).toBe(0);
    expect(scrollProgress(500, 500, 1500)).toBeCloseTo(0.5, 10);
    expect(scrollProgress(1000, 500, 1500)).toBe(1);
  });
  it("is 1 when nothing scrolls", () => {
    expect(scrollProgress(0, 500, 500)).toBe(1);
    expect(scrollProgress(0, 500, 300)).toBe(1);
  });
  it("clamps overscroll", () => {
    expect(scrollProgress(-20, 500, 1500)).toBe(0);
    expect(scrollProgress(1100, 500, 1500)).toBe(1);
  });
});

describe("sectionProgress", () => {
  // viewport 900: the one-third line is at 300
  it("is 0 while the section's top is at or below the one-third line", () => {
    expect(sectionProgress(300, 1000, 900, false)).toBe(0);
    expect(sectionProgress(450, 1000, 900, false)).toBe(0);
  });
  it("is the fraction of the section above the one-third line", () => {
    expect(sectionProgress(-200, 1000, 900, false)).toBeCloseTo(0.5, 10);
    expect(sectionProgress(200, 400, 900, false)).toBeCloseTo(0.25, 10);
  });
  it("clamps at 1 once the section has passed the line", () => {
    expect(sectionProgress(-2000, 1000, 900, false)).toBe(1);
  });
  it("is 1 at the bottom of the scroll (the caller passes atBottom for the last section)", () => {
    expect(sectionProgress(100, 1000, 900, true)).toBe(1);
  });
  it("a zero-height section counts as read once its top passes the line", () => {
    expect(sectionProgress(0, 0, 900, false)).toBe(1);
    expect(sectionProgress(400, 0, 900, false)).toBe(0);
  });
});

describe("previewText", () => {
  it("returns short text as it is, whitespace collapsed", () => {
    expect(previewText("Dear  Anna,\n the sea")).toBe("Dear Anna, the sea");
    expect(previewText("")).toBe("");
    expect(previewText(undefined)).toBe("");
  });
  it("cuts at 120 characters and marks the cut", () => {
    const long = "x".repeat(300);
    expect(previewText(long)).toBe("x".repeat(120) + "…");
    expect(previewText("y".repeat(120))).toBe("y".repeat(120));
  });
});
