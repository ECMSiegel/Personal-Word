import { describe, it, expect } from "vitest";
import {
  APPEARANCE_KEY,
  SWATCHES,
  applyAppearance,
  defaultAppearance,
  defaultSectionColours,
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
      sections: defaultSectionColours,
    });
    expect(parseAppearance('{"theme":"light"}')).toEqual({
      theme: "light",
      palette: "plain",
      sections: defaultSectionColours,
    });
    expect(parseAppearance('{"theme":"purple","palette":"color"}')).toEqual({
      theme: "system",
      palette: "color",
      sections: defaultSectionColours,
    });
    expect(parseAppearance("not json")).toEqual(defaultAppearance);
    expect(parseAppearance("[1,2]")).toEqual(defaultAppearance);
    expect(parseAppearance("null")).toEqual(defaultAppearance);
    expect(parseAppearance(null)).toEqual(defaultAppearance);
  });

  it("keeps section swatches additive and defaults invalid or missing keys", () => {
    expect(SWATCHES).toEqual([
      "red", "orange", "yellow", "green", "teal", "blue", "indigo", "purple",
    ]);
    expect(defaultSectionColours).toEqual({
      manuscript: "blue",
      fragments: "green",
      research: "orange",
    });
    expect(parseAppearance('{"palette":"color","sections":{"manuscript":"purple","fragments":"bad"}}')).toEqual({
      theme: "system",
      palette: "color",
      sections: { manuscript: "purple", fragments: "green", research: "orange" },
    });
    expect(parseAppearance('{"sections":{"manuscript":"bad","fragments":null,"research":5}}').sections).toEqual(defaultSectionColours);
  });

  it("reads and writes through a store and survives a broken store", () => {
    const data: Record<string, string> = {};
    const store = {
      getItem: (k: string) => data[k] ?? null,
      setItem: (k: string, v: string) => {
        data[k] = v;
      },
    };
    writeAppearance(store, { theme: "dark", palette: "plain", sections: defaultSectionColours });
    expect(JSON.parse(data[APPEARANCE_KEY])).toEqual({
      theme: "dark",
      palette: "plain",
      sections: defaultSectionColours,
    });
    expect(readAppearance(store)).toEqual({ theme: "dark", palette: "plain", sections: defaultSectionColours });
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

  it("applies and clears theme, palette and section tint attributes", () => {
    const root = { dataset: {} as DOMStringMap };
    applyAppearance(root, {
      theme: "dark",
      palette: "color",
      sections: { manuscript: "purple", fragments: "green", research: "teal" },
    });
    expect(root.dataset).toEqual({
      theme: "dark",
      palette: "color",
      tintManuscript: "purple",
      tintResearch: "teal",
    });
    applyAppearance(root, { ...defaultAppearance, theme: "light" });
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
