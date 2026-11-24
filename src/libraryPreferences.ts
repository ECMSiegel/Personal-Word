// Projects-page display preferences. Stored under a historical key; keep it compatible.
export const LIBRARY_KEY = "folio.workspace.library";
export const LIBRARY_SORTS = ["name", "added", "edited", "words", "sections", "custom"] as const;
export type LibrarySort = (typeof LIBRARY_SORTS)[number];
/** The sorts Custom falls back to until the owner sets a hand-made order. */
export const LIBRARY_FALLBACK_SORTS = ["name", "added", "edited", "words", "sections"] as const;
export type LibraryFallbackSort = (typeof LIBRARY_FALLBACK_SORTS)[number];
export const LIBRARY_COLUMNS = ["edited", "words", "sections", "added"] as const;
export type LibraryColumn = (typeof LIBRARY_COLUMNS)[number];
export type LibraryPreferences = {
  sort: LibrarySort;
  fallbackSort: LibraryFallbackSort;
  reverse: boolean;
  foldersFirst: boolean;
  columns: LibraryColumn[];
};
export const defaultLibraryPreferences: LibraryPreferences = {
  sort: "edited",
  fallbackSort: "edited",
  reverse: false,
  foldersFirst: true,
  columns: [...LIBRARY_COLUMNS],
};

export function readLibraryPreferences(
  store: Pick<Storage, "getItem">,
): LibraryPreferences {
  try {
    const raw: unknown = JSON.parse(store.getItem(LIBRARY_KEY) ?? "{}");
    const saved = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
    const { sort, fallbackSort, reverse, foldersFirst, columns } = defaultLibraryPreferences;
    return {
      sort: LIBRARY_SORTS.find((s) => s === saved.sort) ?? sort,
      fallbackSort:
        LIBRARY_FALLBACK_SORTS.find((s) => s === saved.fallbackSort) ??
        fallbackSort,
      reverse: typeof saved.reverse === "boolean" ? saved.reverse : reverse,
      foldersFirst: typeof saved.foldersFirst === "boolean" ? saved.foldersFirst : foldersFirst,
      columns: Array.isArray(saved.columns)
        ? [...new Set(saved.columns)].filter((c): c is LibraryColumn => LIBRARY_COLUMNS.some((k) => k === c))
        : [...columns],
    };
  } catch {
    return { ...defaultLibraryPreferences, columns: [...LIBRARY_COLUMNS] };
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
