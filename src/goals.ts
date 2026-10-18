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
export function goalStatus(p: Project, today: string, baseline: number): GoalStatus {
  const goals = p.goals;
  if (!goals) return {};
  const done = manuscriptWords(p);
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
