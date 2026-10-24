import { entryWords, type Project } from "./model";

export type GoalStatus = {
  total?: { done: number; target: number };
  daily?: { done: number; target: number };
  daysLeft?: number;
  perDayNeeded?: number;
};
export function manuscriptWords(p: Project): number {
  return p.entries.reduce((total, e) => total + (e.kind === "section" ? entryWords(e) : 0), 0);
}
export type GoalScope = "manuscript" | "manuscript-and-fragments";
export type GoalDayMode = "local" | "utc";
export function goalWords(p: Project): number {
  return p.goals?.scope === "manuscript-and-fragments"
    ? p.entries.reduce((total, e) => total + entryWords(e), 0) : manuscriptWords(p);
}
export function goalDate(date: Date, mode: GoalDayMode = "local", timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone): string {
  if (mode === "utc") return date.toISOString().slice(0, 10);
  const parts = new Intl.DateTimeFormat("en-US", {timeZone, year:"numeric", month:"2-digit", day:"2-digit"}).formatToParts(date);
  const get = (type: string) => parts.find(part => part.type === type)!.value;
  return `${get("year")}-${get("month")}-${get("day")}`;
}
export function goalBaselineKey(p: Project): string {
  const base = `personal-word.goal-baseline.${p.id}`;
  const scope = p.goals?.scope ?? "manuscript";
  const mode = p.goals?.dayMode ?? "local";
  // Legacy manuscript/local history keeps its exact key and interpretation.
  return scope === "manuscript" && mode === "local" ? base : `${base}.${scope}.${mode}`;
}
export function goalStatus(p: Project, today: string, baseline: number, summaryWords = goalWords(p)): GoalStatus {
  const goals = p.goals;
  if (!goals) return {};
  const done = summaryWords;
  const result: GoalStatus = {};
  if (goals.totalWords) result.total = { done, target: goals.totalWords };
  if (goals.dailyWords) result.daily = { done: Math.max(0, done - baseline), target: goals.dailyWords };
  if (goals.deadline) {
    // Date-only strings use UTC arithmetic, so local daylight-saving changes do not add a day.
    result.daysLeft = Math.max(0, Math.round((Date.parse(goals.deadline) - Date.parse(today)) / 86_400_000) + 1);
    if (goals.totalWords && result.daysLeft > 0 && goals.totalWords > done)
      result.perDayNeeded = Math.ceil((goals.totalWords - done) / result.daysLeft);
  }
  return result;
}
