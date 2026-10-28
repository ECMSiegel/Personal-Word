// Shortcut overrides live in one global key (historical folio.* prefix).
import { isChord, formatChord, parseChord, sameChord, type Chord } from "./chords";
import { ACTIONS, RESERVED, type ActionId } from "./registry";

export const SHORTCUTS_KEY = "folio.workspace.shortcuts";
export type ShortcutOverrides = Partial<Record<ActionId, Chord>>;

const IDS = new Set<string>(ACTIONS.map((a) => a.id));

/** Overrides from storage; anything corrupt, unknown, read-only or now refused is dropped. */
export function readShortcuts(store: Pick<Storage, "getItem">): ShortcutOverrides {
  try {
    const raw: unknown = JSON.parse(store.getItem(SHORTCUTS_KEY) ?? "{}");
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
    const out: ShortcutOverrides = {};
    for (const [id, value] of Object.entries(raw)) {
      const action = ACTIONS.find((a) => a.id === id);
      if (IDS.has(id) && !action?.readOnly && isChord(value)) {
        out[id as ActionId] = value;
      }
    }
    // Drop what chordProblem would now refuse (bare keys, reserved or clashing
    // chords). Checked against the other stored overrides, so a valid pair
    // that moved chords around is kept.
    for (const [id, chord] of Object.entries(out) as [ActionId, Chord][]) {
      if (chordProblem(id, chord, out)) delete out[id];
    }
    return out;
  } catch {
    return {};
  }
}

export function writeShortcuts(
  store: Pick<Storage, "setItem">,
  overrides: ShortcutOverrides,
): void {
  try {
    store.setItem(SHORTCUTS_KEY, JSON.stringify(overrides));
  } catch {
    // Storage can be unavailable; the shortcuts still work for this session.
  }
}

export function chordFor(id: ActionId, overrides: ShortcutOverrides): Chord {
  const action = ACTIONS.find((a) => a.id === id);
  return overrides[id] ?? action!.default;
}

/** The action a key press triggers, or null. Ctrl counts as Command, as the
 * app's handlers always did. */
export function resolveChord(
  event: Parameters<typeof parseChord>[0],
  overrides: ShortcutOverrides,
): ActionId | null {
  const pressed = parseChord(event);
  const folded: Chord = pressed.ctrl && !pressed.meta
    ? { ...pressed, ctrl: undefined, meta: true }
    : pressed;
  for (const action of ACTIONS) {
    const chord = chordFor(action.id, overrides);
    if (sameChord(chord, pressed) || sameChord(chord, folded)) return action.id;
  }
  return null;
}

export function hintFor(id: ActionId, overrides: ShortcutOverrides): string {
  return formatChord(chordFor(id, overrides));
}

/** Ctrl counts as Command when a press is matched (see resolveChord). */
function folded(chord: Chord): Chord {
  return chord.ctrl && !chord.meta ? { ...chord, ctrl: undefined, meta: true } : chord;
}

/** Why a chord cannot be given to an action, or null when it can. A chord
 * needs Command, Control or Option (function keys excepted): without one it
 * would swallow ordinary typing. */
export function chordProblem(
  id: ActionId,
  chord: Chord,
  overrides: ShortcutOverrides,
): string | null {
  if (!chord.meta && !chord.ctrl && !chord.alt && !/^F\d{1,2}$/.test(chord.key)) {
    return "Add Command, Control or Option to that shortcut.";
  }
  const f = folded(chord);
  if (RESERVED.some((r) => sameChord(folded(r), f))) {
    return "That shortcut is reserved by macOS.";
  }
  const other = ACTIONS.find(
    (a) => a.id !== id && sameChord(folded(chordFor(a.id, overrides)), f),
  );
  return other ? `That shortcut is taken by ${other.label}.` : null;
}
