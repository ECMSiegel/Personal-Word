// Global sidebar preferences. Stored under a historical key; keep it compatible.
export const SIDEBAR_KEY = "folio.workspace.sidebar";
export type SidebarPreferences = { width: number; pinned: boolean; hover: boolean };
export const defaultSidebarPreferences: SidebarPreferences = {
  width: 270,
  pinned: true,
  hover: true,
};

export function readSidebarPreferences(
  store: Pick<Storage, "getItem">,
): SidebarPreferences {
  try {
    const raw: unknown = JSON.parse(store.getItem(SIDEBAR_KEY) ?? "{}");
    const saved = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
    const { width, pinned, hover } = defaultSidebarPreferences;
    return {
      width: typeof saved.width === "number" && Number.isFinite(saved.width) ? saved.width : width,
      pinned: typeof saved.pinned === "boolean" ? saved.pinned : pinned,
      hover: typeof saved.hover === "boolean" ? saved.hover : hover,
    };
  } catch {
    return { ...defaultSidebarPreferences };
  }
}

export function writeSidebarPreferences(
  store: Pick<Storage, "setItem">,
  prefs: SidebarPreferences,
): void {
  try {
    store.setItem(SIDEBAR_KEY, JSON.stringify(prefs));
  } catch {
    // Storage can be unavailable; the sidebar still works for this session.
  }
}
