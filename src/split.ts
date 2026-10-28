// Split view state: which entry each pane shows and which pane has focus.
// App's `active` is always activeOf(split) while a split is open.
export type Side = "left" | "right";
export type PaneContent =
  | { kind: "entry"; id: string }
  | { kind: "pdf"; sourceId: string };
export type Split = { left: string; right: PaneContent; focused: Side };

export const splitKey = (projectId: string) =>
  "personal-word.split." + projectId;
export const SPLIT_RATIO_KEY = "personal-word.splitRatio";

const clampRatio = (ratio: number) => Math.min(0.75, Math.max(0.25, ratio));

function parseContent(value: unknown): PaneContent | null {
  if (!value || typeof value !== "object") return null;
  const content = value as Record<string, unknown>;
  if (content.kind === "entry" && typeof content.id === "string")
    return { kind: "entry", id: content.id };
  if (content.kind === "pdf" && typeof content.sourceId === "string")
    return { kind: "pdf", sourceId: content.sourceId };
  return null;
}

export function readSplit(
  store: Pick<Storage, "getItem">,
  projectId: string,
  entryIds: string[],
  sourceIds: string[],
): Split | null {
  let value: unknown;
  try {
    value = JSON.parse(store.getItem(splitKey(projectId)) ?? "null");
  } catch {
    return null;
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const stored = value as Record<string, unknown>;
  const right = parseContent(stored.right);
  if (
    typeof stored.left !== "string" ||
    !right ||
    (stored.focused !== "left" && stored.focused !== "right")
  )
    return null;
  const split: Split = {
    left: stored.left,
    right,
    focused: right.kind === "pdf" ? "left" : stored.focused,
  };
  if (right.kind === "entry" && right.id === split.left) return null;
  return prune(split, entryIds, sourceIds);
}

export function writeSplit(
  store: Pick<Storage, "setItem" | "removeItem">,
  projectId: string,
  split: Split | null,
): void {
  try {
    if (split) store.setItem(splitKey(projectId), JSON.stringify(split));
    else store.removeItem(splitKey(projectId));
  } catch {
    // Pane layout is a convenience; losing it never touches writing.
  }
}

export function readSplitRatio(store: Pick<Storage, "getItem">): number {
  let ratio = NaN;
  try {
    ratio = Number(store.getItem(SPLIT_RATIO_KEY) ?? NaN);
  } catch {
    // Fall back to an even split.
  }
  return Number.isFinite(ratio) ? clampRatio(ratio) : 0.5;
}

export function writeSplitRatio(
  store: Pick<Storage, "setItem">,
  ratio: number,
): void {
  try {
    store.setItem(SPLIT_RATIO_KEY, String(clampRatio(ratio)));
  } catch {
    // Width is a convenience preference.
  }
}

/** Opens `target` in the right pane; the left pane keeps its entry. */
export function openBeside(
  split: Split | null,
  active: string,
  target: PaneContent,
): Split | null {
  const left = split ? split.left : active;
  if (!left || (target.kind === "entry" && target.id === left)) return split;
  return {
    left,
    right: target,
    focused: target.kind === "entry" ? "right" : "left",
  };
}

export function focusSide(split: Split, side: Side): Split {
  if (split.focused === side) return split;
  if (side === "right" && split.right.kind === "pdf") return split;
  return { ...split, focused: side };
}

const holds = (split: Split, side: Side, id: string) =>
  side === "left"
    ? split.left === id
    : split.right.kind === "entry" && split.right.id === id;

/** Sidebar navigation inside a split: never puts one entry in both panes. */
export function select(split: Split, id: string): Split {
  const other: Side = split.focused === "left" ? "right" : "left";
  if (holds(split, other, id)) return focusSide(split, other);
  if (holds(split, split.focused, id)) return split;
  return split.focused === "left"
    ? { ...split, left: id }
    : { ...split, right: { kind: "entry", id } };
}

export function activeOf(split: Split): string {
  return split.focused === "right" && split.right.kind === "entry"
    ? split.right.id
    : split.left;
}

export function prune(
  split: Split | null,
  entryIds: string[],
  sourceIds: string[],
): Split | null {
  if (!split || !entryIds.includes(split.left)) return null;
  const right = split.right;
  const present =
    right.kind === "entry"
      ? entryIds.includes(right.id)
      : sourceIds.includes(right.sourceId);
  return present ? split : null;
}

export function closeRight(split: Split): string {
  return split.left;
}
