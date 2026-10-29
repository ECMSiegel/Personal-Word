import { describe, expect, it } from "vitest";
import { planPages, sameBoundaries, type BlockBox, type Boundary } from "./pagination";

// Letter page at 100%: 1056 px tall, 96 px margins, 32 px gap.
const geometry = { pageHeight: 1056, gap: 32, margin: 96, reserve: 0 };
const pitch = 1088;
const content = 864;

type Spec = { h?: number; lines?: number; heading?: boolean; pageBreak?: boolean };
const lh = 24;
/** Lays blocks out continuously (no spacers) with 16 px collapsed margins. */
function blocks(specs: Spec[]): BlockBox[] {
  let y = 16;
  return specs.map((spec, i) => {
    const h = spec.lines ? spec.lines * lh : spec.h!;
    const box: BlockBox = {
      pos: i * 10,
      top: y,
      height: h,
      mt: 16,
      mb: 16,
      spacer: false,
      pageBreak: !!spec.pageBreak,
      heading: !!spec.heading,
      lines: spec.lines
        ? () => Array.from({ length: spec.lines! }, (_, k) => k * lh)
        : undefined,
    };
    y += h + 16;
    return box;
  });
}
/** Where the plan puts block `index`: top of the page its boundary starts. */
const topAfter = (all: BlockBox[], plan: ReturnType<typeof planPages>, index: number) => {
  const boundary = plan.boundaries.find((b) => b.pos === all[index].pos)!;
  const prev = all[index - 1];
  // the paginated bottom of the previous block equals its natural bottom
  // when it sits on the first page (all tests below keep it there)
  return prev.top + prev.height + prev.mb + boundary.height + all[index].mt;
};

describe("planPages", () => {
  it("keeps a short document on one page", () => {
    const plan = planPages(blocks([{ h: 100 }, { h: 100 }]), geometry);
    expect(plan).toEqual({ boundaries: [], pageCount: 1 });
  });

  it("moves a block that does not fit whole to the next page's first line", () => {
    const all = blocks([{ h: 700 }, { h: 200 }]);
    const plan = planPages(all, geometry);
    expect(plan.boundaries.map((b) => b.pos)).toEqual([10]);
    expect(topAfter(all, plan, 1)).toBe(pitch);
    expect(plan.pageCount).toBe(2);
    // the split marks page 1's lower paper edge, measured from the spacer top
    const spacerTop = all[0].top + all[0].height + all[0].mb;
    expect(plan.boundaries[0].split).toBe(content + 96 - spacerTop);
  });

  it("subtracts the footnote reserve from the space on a page", () => {
    const all = blocks([{ h: 700 }, { h: 100 }]);
    expect(planPages(all, geometry).boundaries).toHaveLength(0);
    expect(planPages(all, { ...geometry, reserve: 100 }).boundaries).toHaveLength(1);
  });

  it("starts a page with a block taller than a page and lets it run across the gap", () => {
    const all = blocks([{ h: 100 }, { h: 1500 }, { h: 50 }]);
    const plan = planPages(all, geometry);
    // the tall block starts page 2 and is the only boundary it needs; the
    // next block follows it on the page that holds its bottom
    expect(plan.boundaries.map((b) => b.pos)).toEqual([10]);
    expect(topAfter(all, plan, 1)).toBe(pitch);
    expect(plan.pageCount).toBe(3);
  });

  it("keeps a heading with the block that follows it", () => {
    const all = blocks([{ h: 600 }, { h: 40, heading: true }, { h: 200 }]);
    const plan = planPages(all, geometry);
    expect(plan.boundaries.map((b) => b.pos)).toEqual([10]);
    expect(topAfter(all, plan, 1)).toBe(pitch);
  });

  it("does not strand or loop when a heading and its block are taller than a page", () => {
    const all = blocks([{ h: 300 }, { h: 40, heading: true }, { h: 850 }, { h: 30 }]);
    const plan = planPages(all, geometry);
    // the heading moves to page 2 and its block stays directly under it
    // (running across the gap); no boundary separates the two
    expect(plan.boundaries[0].pos).toBe(10);
    expect(plan.boundaries.some((b) => b.pos === 20)).toBe(false);
    expect(topAfter(all, plan, 1)).toBe(pitch);
  });

  it("never separates a block from a heading that starts its page", () => {
    const all = blocks([{ h: 40, heading: true }, { h: 1000 }]);
    expect(planPages(all, geometry).boundaries).toEqual([]);
  });

  it("moves a run of headings together and keeps an all-heading page whole", () => {
    const run = blocks([
      { h: 600 },
      { h: 40, heading: true },
      { h: 30, heading: true },
      { h: 200 },
    ]);
    expect(planPages(run, geometry).boundaries.map((b) => b.pos)).toEqual([10]);
    const only = blocks([
      { h: 40, heading: true },
      { h: 30, heading: true },
      { h: 900 },
    ]);
    expect(planPages(only, geometry).boundaries).toEqual([]);
  });

  it("starts a new page after a page break", () => {
    const all = blocks([{ h: 100 }, { h: 0, pageBreak: true }, { h: 100 }]);
    const plan = planPages(all, geometry);
    expect(plan.boundaries.map((b) => b.pos)).toEqual([20]);
    expect(plan.pageCount).toBe(2);
  });

  it("reproduces the same plan from a layout that already has its spacers", () => {
    const all = blocks([{ h: 700 }, { h: 200 }, { h: 500 }, { h: 400 }]);
    const plan = planPages(all, geometry);
    // render the spacers: every block from a boundary on shifts down
    let shift = 0;
    const rendered = all.map((b) => {
      const boundary = plan.boundaries.find((x) => x.pos === b.pos);
      if (boundary) shift += boundary.height + Math.min(16, 16);
      return { ...b, top: b.top + shift, spacer: !!boundary };
    });
    expect(planPages(rendered, geometry)).toEqual(plan);
  });
});

describe("planPages splits paragraphs like Word", () => {
  const cuts = (plan: ReturnType<typeof planPages>) =>
    plan.boundaries.map((b) => [b.pos, b.line ?? null]);

  it("splits a paragraph between lines so its next line starts page 2", () => {
    const all = blocks([{ h: 700 }, { lines: 10 }]);
    const plan = planPages(all, geometry);
    // the paragraph starts at 732; five 24 px lines fit above 864
    expect(cuts(plan)).toEqual([[10, 5]]);
    expect(732 + 5 * lh + plan.boundaries[0].height).toBe(pitch);
    expect(plan.boundaries[0].split).toBe(content + 96 - (732 + 5 * lh));
    expect(plan.pageCount).toBe(2);
  });

  it("leaves at least two lines for the next page (widow control)", () => {
    expect(cuts(planPages(blocks([{ h: 700 }, { lines: 6 }]), geometry))).toEqual([[10, 4]]);
  });

  it("moves the paragraph whole rather than leave one line behind (orphan control)", () => {
    expect(cuts(planPages(blocks([{ h: 800 }, { lines: 6 }]), geometry))).toEqual([[10, null]]);
    expect(cuts(planPages(blocks([{ h: 820 }, { lines: 6 }]), geometry))).toEqual([[10, null]]);
  });

  it("moves a paragraph of three lines whole", () => {
    expect(cuts(planPages(blocks([{ h: 770 }, { lines: 3 }]), geometry))).toEqual([[10, null]]);
  });

  it("keeps a heading above a paragraph that splits, and moves it with one that cannot", () => {
    const split = blocks([{ h: 600 }, { h: 40, heading: true }, { lines: 10 }]);
    expect(cuts(planPages(split, geometry))).toEqual([[20, 7]]);
    const moved = blocks([{ h: 760 }, { h: 40, heading: true }, { lines: 6 }]);
    expect(cuts(planPages(moved, geometry))).toEqual([[10, null]]);
  });

  it("splits a paragraph taller than a page as often as it needs", () => {
    const plan = planPages(blocks([{ lines: 80 }]), geometry);
    expect(cuts(plan)).toEqual([
      [0, 35],
      [0, 71],
    ]);
    // each continuation starts exactly at its page's first line
    const [first, second] = plan.boundaries;
    expect(16 + 35 * lh + first.height).toBe(pitch);
    expect(16 + 71 * lh + first.height + second.height).toBe(2 * pitch);
    expect(plan.pageCount).toBe(3);
  });

  it("counts the footnote reserve when it decides which lines fit", () => {
    const plan = planPages(blocks([{ h: 700 }, { lines: 10 }]), { ...geometry, reserve: 48 });
    expect(cuts(plan)).toEqual([[10, 3]]);
  });

  it("places the block after a split paragraph below its last line on the new page", () => {
    const all = blocks([{ h: 700 }, { lines: 10 }, { h: 100 }]);
    const plan = planPages(all, geometry);
    expect(cuts(plan)).toEqual([[10, 5]]);
    expect(plan.pageCount).toBe(2);
  });
});

describe("sameBoundaries", () => {
  const list = (heights: number[]): Boundary[] =>
    heights.map((height, i) => ({ pos: i * 10, height, split: 20 }));
  it("treats sub-pixel noise on one spacer as unchanged", () => {
    expect(sameBoundaries(list([224, 224, 224]), list([224.3, 224, 224]))).toBe(true);
  });
  it("re-places spacers when small differences add up across pages", () => {
    // Each spacer 0.3 px off (Chromium at fit zoom 1.1495): pages 3 on drift.
    expect(sameBoundaries(list([224, 224, 224]), list([223.7, 223.7, 223.7]))).toBe(false);
  });
  it("compares count, position and kind", () => {
    expect(sameBoundaries(list([224]), list([224, 224]))).toBe(false);
    expect(sameBoundaries(list([224]), [{ pos: 1, height: 224, split: 20 }])).toBe(false);
    expect(sameBoundaries(list([224]), [{ pos: 0, height: 224, split: 20, inline: true }])).toBe(false);
  });
});
