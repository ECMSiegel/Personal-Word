import { describe, expect, it } from "vitest";
import { entry, newProject } from "./model";
import { goalStatus, manuscriptWords } from "./goals";

function project() {
  const p = newProject("Goals");
  const section = { ...p.entries[0], text: "one two three four five" };
  const fragment = { ...entry("fragment", "Saved"), text: "six seven eight" };
  return { ...p, entries: [section, fragment] };
}

describe("writing goals", () => {
  it("counts manuscript sections only, not fragments", () => {
    expect(manuscriptWords(project())).toBe(5);
  });
  it("daily progress never goes negative after deleting text", () => {
    expect(goalStatus({ ...project(), goals: { dailyWords: 10 } }, "2026-10-18", 8).daily)
      .toEqual({ done: 0, target: 10 });
  });
  it("days left counts today and per-day need rounds up", () => {
    const p = { ...project(), goals: { totalWords: 10, deadline: "2026-10-20" } };
    expect(goalStatus(p, "2026-10-18", 0)).toEqual({
      total: { done: 5, target: 10 }, daysLeft: 3, perDayNeeded: 2,
    });
    expect(goalStatus(p, "2026-10-20", 0).daysLeft).toBe(1);
  });
  it("a past deadline reports zero days left and no per-day figure", () => {
    const result = goalStatus({ ...project(), goals: { totalWords: 10, deadline: "2026-10-17" } }, "2026-10-18", 0);
    expect(result.daysLeft).toBe(0);
    expect(result.perDayNeeded).toBeUndefined();
  });
  it("a total goal already met reports no negative per-day figure", () => {
    const result = goalStatus({ ...project(), goals: { totalWords: 1, deadline: "2026-10-20" } }, "2026-10-18", 0);
    expect(result.total).toEqual({ done: 5, target: 1 });
    expect(result.perDayNeeded).toBeUndefined();
  });
});
