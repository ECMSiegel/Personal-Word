/** Space between the bottom of a page's text column and its first note row. */
export const FOOTNOTE_RESERVE_PADDING = 12;

/**
 * Page index for each reference. `refOffsets` and `origin` share one axis
 * (page view stacks pages vertically, so these are tops); `scale` converts
 * them back to unzoomed layout pixels. A page occupies `pageSize` plus
 * `pageGap` along that axis.
 */
export function assignPages(
  refOffsets: number[],
  origin: number,
  pageSize: number,
  pageGap: number,
  scale = 1,
): number[] {
  const pitch = pageSize + pageGap;
  return refOffsets.map((offset) => {
    const layout = (offset - origin) / (scale || 1);
    return Math.max(0, Math.floor(layout / pitch));
  });
}

/**
 * Height to reserve at the bottom of every page: the tallest page's notes plus
 * the rule gap, capped. Pages without notes do not contribute.
 */
export function computeReserve(heights: number[], cap: number): number {
  const tallest = Math.max(0, ...heights);
  if (tallest <= 0) return 0;
  return Math.min(cap, tallest + FOOTNOTE_RESERVE_PADDING);
}
