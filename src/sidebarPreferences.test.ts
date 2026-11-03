import { describe, expect, it } from "vitest";
import {
  SIDEBAR_KEY,
  readSidebarPreferences,
  writeSidebarPreferences,
} from "./sidebarPreferences";

const store = (value: string | null) => ({ getItem: () => value });

/** A store backed by one mutable string, so reads see earlier writes. */
const memoryStore = (initial: string | null = null) => {
  let raw = initial;
  const written: Record<string, string> = {};
  return {
    written,
    getItem: () => raw,
    setItem: (_k: string, v: string) => {
      raw = v;
      written[SIDEBAR_KEY] = v;
    },
  };
};

describe("sidebar preferences", () => {
  it("uses the historical key", () => {
    expect(SIDEBAR_KEY).toBe("folio.workspace.sidebar");
  });
  it("defaults to 270 / pinned / hover on / floating off", () => {
    expect(readSidebarPreferences(store(null))).toEqual({
      width: 270,
      pinned: true,
      hover: true,
      floating: false,
    });
  });
  it("falls back per field on partial JSON", () => {
    expect(readSidebarPreferences(store('{"hover":false}'))).toEqual({
      width: 270,
      pinned: true,
      hover: false,
      floating: false,
    });
    expect(readSidebarPreferences(store('{"width":320,"pinned":false}'))).toEqual({
      width: 320,
      pinned: false,
      hover: true,
      floating: false,
    });
  });
  it("reads an old value without 'floating' as off, and a bad type as off", () => {
    // An object written before the field existed: floating must default to false.
    expect(
      readSidebarPreferences(store('{"width":300,"pinned":false,"hover":true}')).floating,
    ).toBe(false);
    expect(readSidebarPreferences(store('{"floating":"yes"}')).floating).toBe(false);
    expect(readSidebarPreferences(store('{"floating":1}')).floating).toBe(false);
    expect(readSidebarPreferences(store('{"floating":true}')).floating).toBe(true);
  });
  it("round-trips floating", () => {
    const s = memoryStore();
    writeSidebarPreferences(s, { floating: true });
    expect(readSidebarPreferences(s).floating).toBe(true);
    writeSidebarPreferences(s, { floating: false });
    expect(readSidebarPreferences(s).floating).toBe(false);
  });
  it("merges into the stored object so a caller that omits 'floating' keeps it", () => {
    // ProjectSidebar only knows { width, pinned } and writes them on every mount.
    const s = memoryStore(
      '{"width":300,"pinned":true,"hover":true,"floating":true,"future":42}',
    );
    writeSidebarPreferences(s, { width: 320, pinned: false, hover: false });
    const stored = JSON.parse(s.written[SIDEBAR_KEY]);
    expect(stored.floating, "floating survives a legacy-shaped write").toBe(true);
    expect(stored.future, "an unknown field is preserved").toBe(42);
    expect(stored.width).toBe(320);
    expect(stored.pinned).toBe(false);
    expect(stored.hover).toBe(false);
  });
  it("ignores garbage and wrong types", () => {
    const fallback = { width: 270, pinned: true, hover: true, floating: false };
    expect(readSidebarPreferences(store("not json"))).toEqual(fallback);
    expect(readSidebarPreferences(store("null"))).toEqual(fallback);
    expect(readSidebarPreferences(store('{"width":"wide","pinned":1,"hover":"no"}'))).toEqual(
      fallback,
    );
    expect(readSidebarPreferences({ getItem: () => { throw new Error("blocked"); } })).toEqual(
      fallback,
    );
  });
  it("writes the fields under the key and survives a blocked store", () => {
    const s = memoryStore();
    writeSidebarPreferences(s, { width: 300, pinned: false, hover: false, floating: true });
    expect(JSON.parse(s.written[SIDEBAR_KEY])).toEqual({
      width: 300,
      pinned: false,
      hover: false,
      floating: true,
    });
    // A store that cannot be read still gets the fields it was given.
    const blocked = {
      getItem: () => { throw new Error("blocked"); },
      setItem: (k: string, v: string) => { expect(k).toBe(SIDEBAR_KEY); expect(JSON.parse(v).floating).toBe(true); },
    };
    expect(() => writeSidebarPreferences(blocked, { floating: true })).not.toThrow();
    expect(() =>
      writeSidebarPreferences({ getItem: () => null, setItem: () => { throw new Error("full"); } }, {
        width: 1,
        pinned: true,
        hover: true,
        floating: false,
      }),
    ).not.toThrow();
  });
});
