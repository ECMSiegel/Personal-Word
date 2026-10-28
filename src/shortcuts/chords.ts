// Keyboard chords: parsing a key event, showing a chord, comparing two chords.
export type Chord = {
  key: string;
  meta?: boolean;
  shift?: boolean;
  alt?: boolean;
  ctrl?: boolean;
};

const KEY_NAMES: Record<string, string> = {
  Enter: "↩",
  Tab: "⇥",
  Escape: "⎋",
  Backspace: "⌫",
  Delete: "⌦",
  ArrowUp: "↑",
  ArrowDown: "↓",
  ArrowLeft: "←",
  ArrowRight: "→",
  " ": "Space",
};

const MODIFIER_KEYS = new Set(["Meta", "Shift", "Alt", "Control"]);

type KeyLike = Pick<
  KeyboardEvent,
  "key" | "code" | "metaKey" | "shiftKey" | "altKey" | "ctrlKey"
>;

/** The pressed key, lower-cased; with Alt held, read from the physical key
 * because macOS turns Alt+letter into a symbol. */
function eventKey(event: KeyLike): string {
  const code = event.code ?? "";
  if (event.altKey && /^Key[A-Z]$/.test(code)) return code.slice(3).toLowerCase();
  if (event.altKey && /^Digit[0-9]$/.test(code)) return code.slice(5);
  if (event.shiftKey && /^Digit[0-9]$/.test(code)) return code.slice(5);
  return event.key.length === 1 ? event.key.toLowerCase() : event.key;
}

/** True while only a modifier key is down (nothing to record yet). */
export function isModifierOnly(event: Pick<KeyboardEvent, "key">): boolean {
  return MODIFIER_KEYS.has(event.key);
}

export function parseChord(event: KeyLike): Chord {
  const chord: Chord = { key: eventKey(event) };
  if (event.metaKey) chord.meta = true;
  if (event.shiftKey) chord.shift = true;
  if (event.altKey) chord.alt = true;
  if (event.ctrlKey) chord.ctrl = true;
  return chord;
}

/** "⇧⌘F": modifier order is control, option, shift, command. */
export function formatChord(c: Chord): string {
  const key = KEY_NAMES[c.key] ?? (c.key.length === 1 ? c.key.toUpperCase() : c.key);
  return `${c.ctrl ? "⌃" : ""}${c.alt ? "⌥" : ""}${c.shift ? "⇧" : ""}${c.meta ? "⌘" : ""}${key}`;
}

export function sameChord(a: Chord, b: Chord): boolean {
  return (
    a.key.toLowerCase() === b.key.toLowerCase() &&
    !!a.meta === !!b.meta &&
    !!a.shift === !!b.shift &&
    !!a.alt === !!b.alt &&
    !!a.ctrl === !!b.ctrl
  );
}

/** Shape check for a chord read from storage. */
export function isChord(value: unknown): value is Chord {
  if (!value || typeof value !== "object") return false;
  const c = value as Record<string, unknown>;
  if (typeof c.key !== "string" || c.key.length === 0) return false;
  return (["meta", "shift", "alt", "ctrl"] as const).every(
    (m) => c[m] === undefined || typeof c[m] === "boolean",
  );
}
