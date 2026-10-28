import { describe, expect, it } from "vitest";
import { formatChord, parseChord, sameChord } from "./chords";
import { ACTIONS, RESERVED } from "./registry";
import {
  SHORTCUTS_KEY,
  chordProblem,
  hintFor,
  readShortcuts,
  resolveChord,
  writeShortcuts,
} from "./store";

const ev = (o: Partial<KeyboardEvent> & { key: string }) =>
  ({ code: "", metaKey: false, shiftKey: false, altKey: false, ctrlKey: false, ...o }) as KeyboardEvent;
const memory = (initial?: string) => {
  let v = initial ?? null;
  return {
    getItem: () => v,
    setItem: (_k: string, x: string) => { v = x; },
  };
};

describe("chords", () => {
  it("round-trips parse and format, modifiers in control-option-shift-command order", () => {
    const c = parseChord(ev({ key: "F", metaKey: true, shiftKey: true }));
    expect(c).toEqual({ key: "f", meta: true, shift: true });
    expect(formatChord(c)).toBe("⇧⌘F");
    expect(formatChord({ key: "k", ctrl: true, alt: true, shift: true, meta: true })).toBe("⌃⌥⇧⌘K");
    expect(formatChord(parseChord(ev({ key: "Enter", shiftKey: true })))).toBe("⇧↩");
  });
  it("reads Alt chords from the physical key", () => {
    expect(parseChord(ev({ key: "¬", code: "KeyL", altKey: true, metaKey: true })).key).toBe("l");
  });
  it("compares ignoring case and unset modifiers", () => {
    expect(sameChord({ key: "S", meta: true }, { key: "s", meta: true, shift: false })).toBe(true);
    expect(sameChord({ key: "s", meta: true }, { key: "s", meta: true, shift: true })).toBe(false);
  });
});

describe("store", () => {
  it("uses the folio.workspace.shortcuts key", () => {
    expect(SHORTCUTS_KEY).toBe("folio.workspace.shortcuts");
  });
  it("gives defaults when the store is empty or corrupt", () => {
    for (const raw of [undefined, "not json", "[]", "null", '{"focusMode":5,"bogus":{"key":"a"}}']) {
      const o = readShortcuts(memory(raw));
      expect(o).toEqual({});
      expect(hintFor("focusMode", o)).toBe("⇧⌘F");
    }
  });
  it("drops overrides for read-only actions", () => {
    expect(readShortcuts(memory('{"insertPageBreak":{"key":"p"}}'))).toEqual({});
  });
  it("writes and reads back overrides", () => {
    const s = memory();
    writeShortcuts(s, { focusMode: { key: "g", meta: true, shift: true } });
    expect(readShortcuts(s).focusMode).toEqual({ key: "g", meta: true, shift: true });
  });
  it("resolveChord uses defaults and prefers overrides", () => {
    const press = ev({ key: "f", metaKey: true, shiftKey: true });
    expect(resolveChord(press, {})).toBe("focusMode");
    expect(resolveChord(ev({ key: "s", ctrlKey: true }), {})).toBe("save");
    const o = { focusMode: { key: "g", meta: true, shift: true } };
    expect(resolveChord(press, o)).toBeNull();
    expect(resolveChord(ev({ key: "g", metaKey: true, shiftKey: true }), o)).toBe("focusMode");
    expect(hintFor("focusMode", o)).toBe("⇧⌘G");
  });
  it("maps Cmd+Shift+S to snapshot, not save", () => {
    expect(resolveChord(ev({ key: "s", metaKey: true, shiftKey: true }), {})).toBe("snapshot");
    expect(resolveChord(ev({ key: "S", metaKey: true, shiftKey: true }), {})).toBe("snapshot");
    expect(resolveChord(ev({ key: "s", metaKey: true }), {})).toBe("save");
  });
  it("refuses reserved chords and duplicates", () => {
    expect(chordProblem("save", { key: "c", meta: true }, {})).toBe("That shortcut is reserved by macOS.");
    expect(chordProblem("save", { key: "k", meta: true }, {})).toBe("That shortcut is taken by Find in project.");
    expect(chordProblem("save", { key: "s", meta: true }, {})).toBeNull();
    expect(chordProblem("focusMode", { key: "g", meta: true, shift: true }, {})).toBeNull();
  });
  it("keeps defaults unique and unreserved", () => {
    for (const a of ACTIONS) {
      expect(RESERVED.some((r) => sameChord(r, a.default))).toBe(false);
      expect(ACTIONS.filter((b) => sameChord(b.default, a.default))).toHaveLength(1);
    }
  });
});

describe("chordProblem: modifiers and folding (T162)", () => {
  const msg = "Add Command, Control or Option to that shortcut.";
  it("refuses chords with no Command, Control or Option", () => {
    for (const chord of [
      { key: "g" },
      { key: "g", shift: true },
      { key: "Enter" },
      { key: " " },
      { key: "Backspace" },
      { key: "Tab" },
      { key: "ArrowLeft" },
    ]) {
      expect(chordProblem("save", chord, {})).toBe(msg);
    }
  });
  it("still accepts Option chords and function keys", () => {
    expect(chordProblem("save", { key: "j", alt: true }, {})).toBeNull();
    expect(chordProblem("save", { key: "F5" }, {})).toBeNull();
    expect(chordProblem("save", { key: "g", meta: true, shift: true }, {})).toBeNull();
  });
  it("compares Control chords folded into Command", () => {
    expect(chordProblem("newSection", { key: "s", ctrl: true }, {})).toBe(
      "That shortcut is taken by Save.",
    );
    expect(chordProblem("newSection", { key: "c", ctrl: true }, {})).toBe(
      "That shortcut is reserved by macOS.",
    );
  });
});

describe("readShortcuts drops stored overrides that are now refused (T162 repair)", () => {
  it("drops a stored bare-letter override", () => {
    expect(readShortcuts(memory('{"save":{"key":"g"}}'))).toEqual({});
  });
  it("drops a stored Control chord that collides with another action or a reserved chord", () => {
    expect(readShortcuts(memory('{"newSection":{"key":"s","ctrl":true}}'))).toEqual({});
    expect(readShortcuts(memory('{"newSection":{"key":"c","ctrl":true}}'))).toEqual({});
  });
  it("keeps valid overrides next to dropped ones, including function keys", () => {
    const raw = '{"save":{"key":"g"},"newSection":{"key":"j","alt":true},"focusMode":{"key":"F5"}}';
    expect(readShortcuts(memory(raw))).toEqual({
      newSection: { key: "j", alt: true },
      focusMode: { key: "F5" },
    });
  });
  it("never throws on corrupt storage", () => {
    expect(readShortcuts(memory("{not json"))).toEqual({});
    expect(readShortcuts(memory('{"save":null,"newSection":5}'))).toEqual({});
  });
});
