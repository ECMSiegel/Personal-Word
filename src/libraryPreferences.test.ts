import { describe, expect, it } from "vitest";
import {
  LIBRARY_COLUMNS,
  LIBRARY_FALLBACK_SORTS,
  LIBRARY_KEY,
  LIBRARY_SORTS,
  readLibraryPreferences,
  writeLibraryPreferences,
} from "./libraryPreferences";

const store = (value: string | null) => ({ getItem: () => value });
const defaults = {
  sort: "edited",
  fallbackSort: "edited",
  reverse: false,
  foldersFirst: true,
  columns: ["edited", "words", "sections", "added"],
};

describe("library preferences", () => {
  it("uses the historical key", () => {
    expect(LIBRARY_KEY).toBe("folio.workspace.library");
  });
  it("lists the sorts and columns", () => {
    expect([...LIBRARY_SORTS]).toEqual(["name", "added", "edited", "words", "sections", "custom"]);
    expect([...LIBRARY_FALLBACK_SORTS]).toEqual(["name", "added", "edited", "words", "sections"]);
    expect([...LIBRARY_COLUMNS]).toEqual(["edited", "words", "sections", "added"]);
  });
  it("defaults to last edited / newest first / folders on top / all columns", () => {
    expect(readLibraryPreferences(store(null))).toEqual(defaults);
  });
  it("reads saved values", () => {
    const raw = JSON.stringify({ sort: "words", reverse: true, foldersFirst: false, columns: ["words", "edited"] });
    expect(readLibraryPreferences(store(raw))).toEqual({
      ...defaults, sort: "words", reverse: true, foldersFirst: false, columns: ["words", "edited"],
    });
  });
  it("ignores a saved view and never returns one", () => {
    const raw = JSON.stringify({ sort: "name", view: "cards" });
    const read = readLibraryPreferences(store(raw));
    expect(read).toEqual({ ...defaults, sort: "name" });
    expect("view" in read).toBe(false);
  });
  it("reads a saved Custom sort and the sort it falls back to", () => {
    const raw = JSON.stringify({ sort: "custom", fallbackSort: "added", reverse: false });
    expect(readLibraryPreferences(store(raw))).toEqual({ ...defaults, sort: "custom", fallbackSort: "added" });
  });
  it("falls back per field for bad values", () => {
    const raw = JSON.stringify({ sort: "size", reverse: "yes", foldersFirst: 1, columns: "words" });
    expect(readLibraryPreferences(store(raw))).toEqual(defaults);
  });
  it("keeps only known, distinct columns, and allows none", () => {
    const raw = JSON.stringify({ columns: ["words", "bogus", "words", "added"] });
    expect(readLibraryPreferences(store(raw)).columns).toEqual(["words", "added"]);
    expect(readLibraryPreferences(store(JSON.stringify({ columns: [] }))).columns).toEqual([]);
  });
  it("treats Custom as no fallback sort", () => {
    const raw = JSON.stringify({ sort: "name", fallbackSort: "custom", reverse: false });
    expect(readLibraryPreferences(store(raw))).toEqual({ ...defaults, sort: "name" });
  });
  it("survives unparseable, non-object and throwing storage", () => {
    expect(readLibraryPreferences(store("{nope"))).toEqual(defaults);
    expect(readLibraryPreferences(store("5"))).toEqual(defaults);
    expect(readLibraryPreferences(store("null"))).toEqual(defaults);
    expect(readLibraryPreferences({ getItem: () => { throw new Error("blocked"); } })).toEqual(defaults);
  });
  it("writes JSON under the key and swallows storage errors", () => {
    const prefs = { sort: "added", fallbackSort: "edited", reverse: true, foldersFirst: false, columns: ["words"] } as const;
    let wrote: [string, string] | null = null;
    writeLibraryPreferences({ setItem: (k, v) => { wrote = [k, v]; } }, { ...prefs, columns: [...prefs.columns] });
    expect(wrote).toEqual([LIBRARY_KEY, JSON.stringify(prefs)]);
    expect(() => writeLibraryPreferences({ setItem: () => { throw new Error("full"); } }, { ...defaults } as never)).not.toThrow();
  });
});
