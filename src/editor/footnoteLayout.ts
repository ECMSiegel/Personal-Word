/** Space between the bottom of a page's text column and its first note row. */
export const FOOTNOTE_RESERVE_PADDING = 12;

/**
 * Column index for each reference. `refLefts` and `surfaceLeft` are viewport
 * coordinates; `scale` converts them back to unzoomed layout pixels.
 */
export function assignPages(
  refLefts: number[],
  surfaceLeft: number,
  columnWidth: number,
  columnGap: number,
  scale = 1,
): number[] {
  const pitch = columnWidth + columnGap;
  return refLefts.map((left) => {
    const offset = (left - surfaceLeft) / (scale || 1);
    return Math.max(0, Math.floor(offset / pitch));
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
