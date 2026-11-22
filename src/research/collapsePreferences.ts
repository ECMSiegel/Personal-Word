export const RESEARCH_COLLAPSE_KEY = "personal-word.researchCollapsed";

export type ResearchCollapseState = Record<
  "note" | "short" | "bibliography" | "usedIn",
  boolean
>;

const defaults: ResearchCollapseState = {
  note: false,
  short: false,
  bibliography: false,
  usedIn: false,
};

export function readCollapsed(
  store: Pick<Storage, "getItem">,
): ResearchCollapseState {
  try {
    const raw: unknown = JSON.parse(store.getItem(RESEARCH_COLLAPSE_KEY) ?? "{}");
    const saved = raw && typeof raw === "object" ? raw as Record<string, unknown> : {};
    return {
      note: typeof saved.note === "boolean" ? saved.note : false,
      short: typeof saved.short === "boolean" ? saved.short : false,
      bibliography: typeof saved.bibliography === "boolean" ? saved.bibliography : false,
      usedIn: typeof saved.usedIn === "boolean" ? saved.usedIn : false,
    };
  } catch {
    return { ...defaults };
  }
}

export function writeCollapsed(
  store: Pick<Storage, "setItem">,
  value: ResearchCollapseState,
): void {
  try {
    store.setItem(RESEARCH_COLLAPSE_KEY, JSON.stringify(value));
  } catch {
    // Storage can be unavailable; the preference still works for this session.
  }
}
