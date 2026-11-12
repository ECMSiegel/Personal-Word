import { describe, expect, it } from "vitest";
import {
  MAX_RECENT_FONTS,
  RECENT_FONTS_KEY,
  loadRecentFonts,
  pushRecentFont,
  recentFontOptions,
  saveRecentFonts,
} from "./recent";

function fakeStorage(initial?: string) {
  const data = new Map<string, string>();
  if (initial !== undefined) data.set(RECENT_FONTS_KEY, initial);
  return {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
  };
}

describe("pushRecentFont", () => {
  it("puts the newest first", () => {
    expect(pushRecentFont(["Georgia"], "Arial")).toEqual(["Arial", "Georgia"]);
  });
  it("de-duplicates with sameFont and moves the font to the front", () => {
    expect(pushRecentFont(["Arial", '"Times New Roman", serif'], "Times New Roman")).toEqual([
      "Times New Roman",
      "Arial",
    ]);
  });
  it("keeps at most five", () => {
    let list: string[] = [];
    for (const f of ["A", "B", "C", "D", "E", "F", "G"]) list = pushRecentFont(list, f);
    expect(list).toEqual(["G", "F", "E", "D", "C"]);
    expect(list).toHaveLength(MAX_RECENT_FONTS);
  });
});

describe("load and save", () => {
  it("round-trips", () => {
    const s = fakeStorage();
    saveRecentFonts(["Arial", "Georgia"], s);
    expect(loadRecentFonts(s)).toEqual(["Arial", "Georgia"]);
  });
  it("is empty when nothing is stored", () => {
    expect(loadRecentFonts(fakeStorage())).toEqual([]);
  });
  it("tolerates bad stored data", () => {
    expect(loadRecentFonts(fakeStorage("{not json"))).toEqual([]);
    expect(loadRecentFonts(fakeStorage('{"a":1}'))).toEqual([]);
    expect(loadRecentFonts(fakeStorage('["Arial", 3, null, "", "Arial", "Georgia"]'))).toEqual([
      "Arial",
      "Georgia",
    ]);
  });
  it("caps oversized stored lists", () => {
    const many = JSON.stringify(["a", "b", "c", "d", "e", "f", "g"]);
    expect(loadRecentFonts(fakeStorage(many))).toHaveLength(5);
  });
  it("survives storage that throws", () => {
    const bad = {
      getItem: () => {
        throw new Error("denied");
      },
      setItem: () => {
        throw new Error("denied");
      },
    };
    expect(loadRecentFonts(bad)).toEqual([]);
    expect(() => saveRecentFonts(["Arial"], bad)).not.toThrow();
  });
});

describe("recentFontOptions", () => {
  const options = [
    { value: "Arial", label: "Arial" },
    { value: '"Times New Roman", serif', label: "Times New Roman" },
    { value: "Georgia", label: "Georgia" },
  ];
  it("returns the available options in recent order", () => {
    expect(recentFontOptions(["Georgia", "Times New Roman"], options)).toEqual([
      options[2],
      options[1],
    ]);
  });
  it("drops recent fonts that are no longer available", () => {
    expect(recentFontOptions(["Gone Font", "Arial"], options)).toEqual([options[0]]);
  });
  it("is empty with no recents", () => {
    expect(recentFontOptions([], options)).toEqual([]);
  });
});
