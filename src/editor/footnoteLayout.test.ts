import { describe, it, expect } from "vitest";
import { assignPages, computeReserve } from "./footnoteLayout";

describe("assignPages", () => {
  const pitch = 816 - 96 * 2 + 2 * 96 + 32;

  it("maps reference positions to column indices", () => {
    expect(
      assignPages([100, 100 + pitch, 100 + 2 * pitch], 100, 624, pitch - 624),
    ).toEqual([0, 1, 2]);
  });

  it("subtracts the surface origin before dividing", () => {
    expect(
      assignPages([1000 + 96, 1000 + pitch + 96], 1000, 624, pitch - 624),
    ).toEqual([0, 1]);
  });

  it("uses the zoom scale to convert viewport offsets to layout pixels", () => {
    expect(
      assignPages([50 + pitch, 50 + 2 * pitch - 1], 50, 624, pitch - 624, 0.5),
    ).toEqual([2, 3]);
  });

  it("clamps references left of the surface to the first page", () => {
    expect(assignPages([-40], 0, 624, 176)).toEqual([0]);
  });

  it("returns an empty array for no references", () => {
    expect(assignPages([], 0, 624, 176)).toEqual([]);
  });
});

describe("computeReserve", () => {
  it("reserves nothing when no page has notes", () => {
    expect(computeReserve([], 500)).toBe(0);
    expect(computeReserve([0, 0], 500)).toBe(0);
  });

  it("uses the tallest page plus the rule gap", () => {
    expect(computeReserve([20, 60, 0], 500)).toBe(72);
  });

  it("caps the reserve", () => {
    expect(computeReserve([900], 432)).toBe(432);
  });
});
