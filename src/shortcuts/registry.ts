// Every shortcut the app itself owns, with its default chord. Browser and
// macOS chords in RESERVED can never be assigned.
import type { Chord } from "./chords";

export type ActionId =
  | "focusMode"
  | "keepAsFragment"
  | "insertPageBreak"
  | "save"
  | "snapshot"
  | "newSection"
  | "findInProject"
  | "toggleSidebar"
  | "toggleAppearance";

export type ActionDef = {
  id: ActionId;
  label: string;
  scope: "app" | "editor";
  default: Chord;
  /** Bound inside the editor library, so it is listed but cannot change. */
  readOnly?: boolean;
};

export const ACTIONS: ActionDef[] = [
  { id: "focusMode", label: "Focus mode", scope: "editor", default: { key: "f", meta: true, shift: true } },
  { id: "keepAsFragment", label: "Keep as fragment", scope: "editor", default: { key: "x", meta: true, shift: true } },
  { id: "insertPageBreak", label: "Insert page break", scope: "editor", default: { key: "Enter", shift: true }, readOnly: true },
  { id: "save", label: "Save", scope: "app", default: { key: "s", meta: true } },
  { id: "snapshot", label: "Take snapshot", scope: "app", default: { key: "s", meta: true, shift: true } },
  { id: "newSection", label: "New section", scope: "app", default: { key: "n", meta: true, shift: true } },
  { id: "findInProject", label: "Find in project", scope: "app", default: { key: "k", meta: true } },
  { id: "toggleSidebar", label: "Toggle sidebar", scope: "app", default: { key: "\\", meta: true } },
  { id: "toggleAppearance", label: "Switch light or dark", scope: "app", default: { key: "l", meta: true, shift: true } },
];

const cmd = (key: string, shift = false): Chord => ({ key, meta: true, ...(shift ? { shift } : {}) });

export const RESERVED: Chord[] = [
  cmd("c"), cmd("v"), cmd("x"), cmd("z"), cmd("z", true), cmd("a"), cmd("q"),
  cmd("w"), cmd("h"), cmd("m"), cmd(","), cmd("n"), cmd("o"), cmd("p"),
  cmd("t"), cmd("b"), cmd("i"), cmd("u"),
];

export function actionLabel(id: ActionId): string {
  return ACTIONS.find((a) => a.id === id)?.label ?? id;
}
