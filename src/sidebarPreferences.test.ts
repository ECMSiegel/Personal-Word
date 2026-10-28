import { describe, expect, it } from "vitest";
import {
  SIDEBAR_KEY,
  readSidebarPreferences,
  writeSidebarPreferences,
} from "./sidebarPreferences";

const store = (value: string | null) => ({ getItem: () => value });

describe("sidebar preferences", () => {
  it("uses the historical key", () => {
    expect(SIDEBAR_KEY).toBe("folio.workspace.sidebar");
  });
  it("defaults to 270 / pinned / hover on", () => {
    expect(readSidebarPreferences(store(null))).toEqual({ width: 270, pinned: true, hover: true });
  });
  it("falls back per field on partial JSON", () => {
    expect(readSidebarPreferences(store('{"hover":false}'))).toEqual({ width: 270, pinned: true, hover: false });
    expect(readSidebarPreferences(store('{"width":320,"pinned":false}'))).toEqual({ width: 320, pinned: false, hover: true });
  });
  it("ignores garbage and wrong types", () => {
    const fallback = { width: 270, pinned: true, hover: true };
    expect(readSidebarPreferences(store("not json"))).toEqual(fallback);
    expect(readSidebarPreferences(store("null"))).toEqual(fallback);
    expect(readSidebarPreferences(store('{"width":"wide","pinned":1,"hover":"no"}'))).toEqual(fallback);
    expect(readSidebarPreferences({ getItem: () => { throw new Error("blocked"); } })).toEqual(fallback);
  });
  it("writes the three fields under the key and survives a blocked store", () => {
    const written: Record<string, string> = {};
    writeSidebarPreferences({ setItem: (k, v) => { written[k] = v; } }, { width: 300, pinned: false, hover: false });
    expect(JSON.parse(written[SIDEBAR_KEY])).toEqual({ width: 300, pinned: false, hover: false });
    expect(() => writeSidebarPreferences({ setItem: () => { throw new Error("full"); } }, { width: 1, pinned: true, hover: true })).not.toThrow();
  });
});
