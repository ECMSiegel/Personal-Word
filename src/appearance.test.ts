import { describe, it, expect } from "vitest";
import {
  APPEARANCE_KEY,
  applyAppearance,
  defaultAppearance,
  nextTheme,
  parseAppearance,
  readAppearance,
  writeAppearance,
} from "./appearance";

describe("appearance preference", () => {
  it("uses the folio.workspace.appearance key", () => {
    expect(APPEARANCE_KEY).toBe("folio.workspace.appearance");
  });

  it("parses valid, partial, garbage and missing values", () => {
    expect(parseAppearance('{"theme":"dark","palette":"color"}')).toEqual({
      theme: "dark",
      palette: "color",
    });
    expect(parseAppearance('{"theme":"light"}')).toEqual({
      theme: "light",
      palette: "plain",
    });
    expect(parseAppearance('{"theme":"purple","palette":"color"}')).toEqual({
      theme: "system",
      palette: "color",
    });
    expect(parseAppearance("not json")).toEqual(defaultAppearance);
    expect(parseAppearance("[1,2]")).toEqual(defaultAppearance);
    expect(parseAppearance("null")).toEqual(defaultAppearance);
    expect(parseAppearance(null)).toEqual(defaultAppearance);
  });

  it("reads and writes through a store and survives a broken store", () => {
    const data: Record<string, string> = {};
    const store = {
      getItem: (k: string) => data[k] ?? null,
      setItem: (k: string, v: string) => {
        data[k] = v;
      },
    };
    writeAppearance(store, { theme: "dark", palette: "plain" });
    expect(JSON.parse(data[APPEARANCE_KEY])).toEqual({
      theme: "dark",
      palette: "plain",
    });
    expect(readAppearance(store)).toEqual({ theme: "dark", palette: "plain" });
    const broken = {
      getItem: () => {
        throw new Error("blocked");
      },
      setItem: () => {
        throw new Error("blocked");
      },
    };
    expect(readAppearance(broken)).toEqual(defaultAppearance);
    expect(() => writeAppearance(broken, defaultAppearance)).not.toThrow();
  });

  it("applies and clears data-theme and data-palette", () => {
    const root = { dataset: {} as DOMStringMap };
    applyAppearance(root, { theme: "dark", palette: "color" });
    expect(root.dataset).toEqual({ theme: "dark", palette: "color" });
    applyAppearance(root, { theme: "light", palette: "plain" });
    expect(root.dataset).toEqual({ theme: "light" });
    applyAppearance(root, defaultAppearance);
    expect(root.dataset).toEqual({});
  });

  it("switches to the opposite of the effective theme", () => {
    expect(nextTheme("system", true)).toBe("light");
    expect(nextTheme("system", false)).toBe("dark");
    expect(nextTheme("light", true)).toBe("dark");
    expect(nextTheme("dark", false)).toBe("light");
  });
});
