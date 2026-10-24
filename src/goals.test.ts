import { describe, expect, it } from "vitest";
import { entry, newProject, validateProject } from "./model";
import { goalStatus, manuscriptWords, goalDate, goalBaselineKey } from "./goals";

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


describe("explicit goal scope", () => {
  it("includes fragments only when selected", () => {
    const p = { ...project(), goals: { totalWords: 20, dailyWords: 10, scope: "manuscript-and-fragments" as const } };
    expect(goalStatus(p, "2026-10-22", 6)).toEqual({total:{done:8,target:20},daily:{done:2,target:10}});
  });
  it("keeps old projects on manuscript scope", () => {
    expect(goalStatus({...project(),goals:{totalWords:20}},"2026-10-22",0).total?.done).toBe(5);
  });
});


describe("goal calendar and baseline identity", () => {
  it("uses explicit UTC or local dates through DST boundaries", () => {
    const date = new Date("2026-11-01T03:30:00Z");
    expect(goalDate(date,"utc","America/New_York")).toBe("2026-11-01");
    expect(goalDate(date,"local","America/New_York")).toBe("2026-10-31");
    expect(goalDate(new Date("2026-11-01T06:30:00Z"),"local","America/New_York")).toBe("2026-11-01");
    expect(goalDate(date,"local","Asia/Tokyo")).toBe("2026-11-01");
  });
  it("retains legacy local baseline keys and separates opt-in modes", () => {
    const p=project();
    const legacy=`personal-word.goal-baseline.${p.id}`;
    expect(goalBaselineKey(p)).toBe(legacy);
    expect(goalBaselineKey({...p,goals:{scope:"manuscript",dayMode:"local"}})).toBe(legacy);
    expect(goalBaselineKey({...p,goals:{dayMode:"utc"}})).toBe(legacy+".manuscript.utc");
    expect(goalBaselineKey({...p,goals:{scope:"manuscript-and-fragments"}})).toBe(legacy+".manuscript-and-fragments.local");
  });
});


it("validates opt-in goal enums without losing old project defaults", () => {
  const p=project();
  expect(()=>validateProject({...p,goals:{scope:"manuscript-and-fragments",dayMode:"utc"}})).not.toThrow();
  expect(()=>validateProject({...p,goals:{scope:"everything"} as any})).toThrow(/scope/i);
  expect(()=>validateProject({...p,goals:{dayMode:"solar"} as any})).toThrow(/day mode/i);
});
