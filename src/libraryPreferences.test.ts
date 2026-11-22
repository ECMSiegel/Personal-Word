import { describe, expect, it } from "vitest";
import {
  LIBRARY_KEY,
  readLibraryPreferences,
  writeLibraryPreferences,
} from "./libraryPreferences";

const store = (value: string | null) => ({ getItem: () => value });
const defaults = {
  sort: "edited",
  fallbackSort: "edited",
  reverse: false,
  view: "list",
};

describe("library preferences", () => {
  it("uses the historical key", () => {
    expect(LIBRARY_KEY).toBe("folio.workspace.library");
  });
  it("defaults to last edited / newest first / list", () => {
    expect(readLibraryPreferences(store(null))).toEqual(defaults);
  });
  it("reads saved values", () => {
    const raw = JSON.stringify({ sort: "name", reverse: true, view: "cards" });
    expect(readLibraryPreferences(store(raw))).toEqual({ ...defaults, sort: "name", reverse: true, view: "cards" });
  });
  it("reads a saved Custom sort and the sort it falls back to", () => {
    const raw = JSON.stringify({ sort: "custom", fallbackSort: "added", reverse: false, view: "list" });
    expect(readLibraryPreferences(store(raw))).toEqual({ ...defaults, sort: "custom", fallbackSort: "added" });
  });
  it("falls back per field for bad values", () => {
    const raw = JSON.stringify({ sort: "size", reverse: "yes", view: "cards" });
    expect(readLibraryPreferences(store(raw))).toEqual({ ...defaults, view: "cards" });
  });
  it("treats Custom as no fallback sort", () => {
    const raw = JSON.stringify({ sort: "name", fallbackSort: "custom", reverse: false, view: "list" });
    expect(readLibraryPreferences(store(raw))).toEqual({ ...defaults, sort: "name" });
  });
  it("survives unparseable, non-object and throwing storage", () => {
    expect(readLibraryPreferences(store("{nope"))).toEqual(defaults);
    expect(readLibraryPreferences(store("5"))).toEqual(defaults);
    expect(readLibraryPreferences(store("null"))).toEqual(defaults);
    expect(readLibraryPreferences({ getItem: () => { throw new Error("blocked"); } })).toEqual(defaults);
  });
  it("writes JSON under the key and swallows storage errors", () => {
    let wrote: [string, string] | null = null;
    writeLibraryPreferences({ setItem: (k, v) => { wrote = [k, v]; } }, { sort: "added", fallbackSort: "edited", reverse: true, view: "list" });
    expect(wrote).toEqual([LIBRARY_KEY, JSON.stringify({ sort: "added", fallbackSort: "edited", reverse: true, view: "list" })]);
    expect(() => writeLibraryPreferences({ setItem: () => { throw new Error("full"); } }, { ...defaults } as never)).not.toThrow();
  });
});
