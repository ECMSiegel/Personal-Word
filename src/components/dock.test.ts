import { describe, expect, it } from "vitest";
import { dockScale, keyboardScale } from "./dock";

describe("dockScale", () => {
  it("peaks at 0 and is 1 at and beyond the radius", () => {
    expect(dockScale(0)).toBeCloseTo(1.5, 5);
    expect(dockScale(84)).toBe(1);
    expect(dockScale(200)).toBe(1);
  });
  it("falls off monotonically and never below 1", () => {
    let prev = Infinity;
    for (const d of [0, 15, 30, 45, 60, 75, 84, 200]) {
      const s = dockScale(d);
      expect(s).toBeGreaterThanOrEqual(1);
      expect(s).toBeLessThanOrEqual(prev);
      prev = s;
    }
    expect(dockScale(30)).toBeGreaterThan(1.3);
    expect(dockScale(30)).toBeLessThan(1.4);
    expect(dockScale(60)).toBeLessThan(1.15);
  });
  it("treats negative distance like positive", () => {
    expect(dockScale(-30)).toBe(dockScale(30));
  });
});

describe("keyboardScale", () => {
  it("steps 1.5, 1.25, 1.1 then 1", () => {
    expect([0, 1, -1, 2, -2, 3].map(keyboardScale)).toEqual([1.5, 1.25, 1.25, 1.1, 1.1, 1]);
  });
});
