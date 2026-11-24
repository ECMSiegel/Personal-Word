import { describe, expect, it } from "vitest";
import { emptyLibrary, togglePin, type ItemKey, type LibraryState } from "./folders";
import { dropPins, stalePins } from "./pins";

const lib = (pins: ItemKey[]): LibraryState => ({ ...emptyLibrary, folders: [{ id: "f1", name: "F", parent: null }], pins });

describe("stalePins", () => {
  it("lists a pinned project that is gone, not live ones", () => {
    expect(stalePins(lib(["p:a", "p:b", "f:f1"]), ["a"])).toEqual(["p:b"]);
  });
  it("lists a pinned folder that no longer exists", () => {
    expect(stalePins(lib(["f:f1", "f:gone"]), [])).toEqual(["f:gone"]);
  });
  it("keeps a damaged project's pin (it is missing from the listing but may come back)", () => {
    expect(stalePins(lib(["p:bad"]), [], ["bad"])).toEqual([]);
  });
  it("before the first listing nothing is stale if the caller passes every id it knows", () => {
    expect(stalePins(lib(["p:a"]), ["a"])).toEqual([]);
  });
});

describe("stalePins before the first successful listing (listed = false)", () => {
  it("never counts a project pin as stale, even with an empty list", () => {
    expect(stalePins(lib(["p:a", "p:b"]), [], [], false)).toEqual([]);
  });
  it("still counts a pinned folder that no longer exists as stale", () => {
    expect(stalePins(lib(["f:f1", "f:gone", "p:a"]), [], [], false)).toEqual(["f:gone"]);
  });
  it("pinning with an unlisted library keeps every project pin (the N1 sequence)", () => {
    const s = lib(["p:a", "f:f1"]);
    expect(togglePin(dropPins(s, stalePins(s, [], [], false)), "f:f1").pins).toEqual(["p:a"]);
    expect(togglePin(dropPins(s, stalePins(s, [], [], false)), "p:b").pins).toEqual(["p:a", "f:f1", "p:b"]);
  });
  it("once listed, the same empty list does make them stale", () => {
    expect(stalePins(lib(["p:a"]), [], [], true)).toEqual(["p:a"]);
  });
});

describe("dropPins", () => {
  it("removes only the named pins, and the field when none is left", () => {
    expect(dropPins(lib(["p:a", "p:b"]), ["p:a"]).pins).toEqual(["p:b"]);
    expect("pins" in dropPins(lib(["p:a"]), ["p:a"])).toBe(false);
  });
  it("returns the same object when nothing changes", () => {
    const s = lib(["p:a"]);
    expect(dropPins(s, ["p:zzz"])).toBe(s);
  });
  it("a pin freed from a dead project lets a new one in (the B1 sequence)", () => {
    const full = lib(["p:a", "p:b", "p:c"]);
    expect(togglePin(full, "p:d")).toBe(full);
    const freed = togglePin(dropPins(full, stalePins(full, ["a", "b", "d"])), "p:d");
    expect(freed.pins).toEqual(["p:a", "p:b", "p:d"]);
  });
});
