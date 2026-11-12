// Projects-page display preferences. Stored under a historical key; keep it compatible.
export const LIBRARY_KEY = "folio.workspace.library";
export const LIBRARY_SORTS = ["name", "added", "edited"] as const;
export type LibrarySort = (typeof LIBRARY_SORTS)[number];
export type LibraryPreferences = {
  sort: LibrarySort;
  reverse: boolean;
  view: "list" | "cards";
};
export const defaultLibraryPreferences: LibraryPreferences = {
  sort: "edited",
  reverse: false,
  view: "list",
};

export function readLibraryPreferences(
  store: Pick<Storage, "getItem">,
): LibraryPreferences {
  try {
    const raw: unknown = JSON.parse(store.getItem(LIBRARY_KEY) ?? "{}");
    const saved = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
    const { sort, reverse, view } = defaultLibraryPreferences;
    return {
      sort: LIBRARY_SORTS.find((s) => s === saved.sort) ?? sort,
      reverse: typeof saved.reverse === "boolean" ? saved.reverse : reverse,
      view: saved.view === "list" || saved.view === "cards" ? saved.view : view,
    };
  } catch {
    return { ...defaultLibraryPreferences };
  }
}

export function writeLibraryPreferences(
  store: Pick<Storage, "setItem">,
  prefs: LibraryPreferences,
): void {
  try {
    store.setItem(LIBRARY_KEY, JSON.stringify(prefs));
  } catch {
    // Storage can be unavailable; the page still works for this session.
  }
}
