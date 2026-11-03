// Global sidebar preferences. Stored under a historical key; keep it compatible.
export const SIDEBAR_KEY = "folio.workspace.sidebar";
export type SidebarPreferences = {
  width: number;
  pinned: boolean;
  hover: boolean;
  /** Floating sidebar and research (wave 5 C2). Additive: old values read as false. */
  floating: boolean;
};
export const defaultSidebarPreferences: SidebarPreferences = {
  width: 270,
  pinned: true,
  hover: true,
  floating: false,
};

export function readSidebarPreferences(
  store: Pick<Storage, "getItem">,
): SidebarPreferences {
  try {
    const raw: unknown = JSON.parse(store.getItem(SIDEBAR_KEY) ?? "{}");
    const saved = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
    const { width, pinned, hover, floating } = defaultSidebarPreferences;
    return {
      width: typeof saved.width === "number" && Number.isFinite(saved.width) ? saved.width : width,
      pinned: typeof saved.pinned === "boolean" ? saved.pinned : pinned,
      hover: typeof saved.hover === "boolean" ? saved.hover : hover,
      floating: typeof saved.floating === "boolean" ? saved.floating : floating,
    };
  } catch {
    return { ...defaultSidebarPreferences };
  }
}

/**
 * Write sidebar preferences, MERGING into whatever is already stored. Callers
 * often know only part of the object (ProjectSidebar keeps `{ width, pinned }`
 * and rewrites it on every mount); merging means a field a caller does not know
 * about -- `floating` today, anything added later -- is never erased.
 */
export function writeSidebarPreferences(
  store: Pick<Storage, "getItem" | "setItem">,
  prefs: Partial<SidebarPreferences>,
): void {
  let merged: Partial<SidebarPreferences> = prefs;
  try {
    const raw: unknown = JSON.parse(store.getItem(SIDEBAR_KEY) ?? "{}");
    if (raw && typeof raw === "object")
      merged = { ...(raw as Record<string, unknown>), ...prefs };
  } catch {
    // Unreadable storage: write our own fields rather than nothing.
  }
  try {
    store.setItem(SIDEBAR_KEY, JSON.stringify(merged));
  } catch {
    // Storage can be unavailable; the sidebar still works for this session.
  }
}
