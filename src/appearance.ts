export type Theme = "system" | "light" | "dark";
export type Palette = "plain" | "color";
export type Appearance = { theme: Theme; palette: Palette };

export const APPEARANCE_KEY = "folio.workspace.appearance";
export const defaultAppearance: Appearance = {
  theme: "system",
  palette: "plain",
};

export function parseAppearance(raw: string | null): Appearance {
  let data: unknown = null;
  try {
    data = raw === null ? null : JSON.parse(raw);
  } catch {
    data = null;
  }
  const value =
    data && typeof data === "object" && !Array.isArray(data)
      ? (data as Record<string, unknown>)
      : {};
  return {
    theme:
      value.theme === "light" || value.theme === "dark" || value.theme === "system"
        ? value.theme
        : defaultAppearance.theme,
    palette:
      value.palette === "plain" || value.palette === "color"
        ? value.palette
        : defaultAppearance.palette,
  };
}

export function readAppearance(store: Pick<Storage, "getItem">): Appearance {
  try {
    return parseAppearance(store.getItem(APPEARANCE_KEY));
  } catch {
    return { ...defaultAppearance };
  }
}

export function writeAppearance(
  store: Pick<Storage, "setItem">,
  value: Appearance,
): void {
  try {
    store.setItem(APPEARANCE_KEY, JSON.stringify(value));
  } catch {
    // Storage can be blocked; the choice then lasts until the app closes.
  }
}

export function applyAppearance(
  root: { dataset: DOMStringMap },
  value: Appearance,
): void {
  if (value.theme === "system") delete root.dataset.theme;
  else root.dataset.theme = value.theme;
  if (value.palette === "plain") delete root.dataset.palette;
  else root.dataset.palette = value.palette;
}

export function nextTheme(
  current: Theme,
  systemDark: boolean,
): "light" | "dark" {
  const effective = current === "system" ? (systemDark ? "dark" : "light") : current;
  return effective === "dark" ? "light" : "dark";
}
