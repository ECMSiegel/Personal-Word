import { parseKey, type ItemKey, type LibraryState } from "./folders";

/** Pins that point at nothing: a folder that no longer exists, or a project that is neither in the
 *  listing nor damaged (a damaged project folder is absent from the listing but may come back).
 *  `listed` is false until the first successful project listing: then no project pin is stale. */
export function stalePins(
  state: LibraryState,
  projectIds: Iterable<string>,
  damaged: Iterable<string> = [],
  listed = true,
): ItemKey[] {
  const projects = new Set(projectIds);
  const hold = new Set(damaged);
  return (state.pins ?? []).filter((key) => {
    const { kind, id } = parseKey(key);
    if (kind === "folder") return !state.folders.some((f) => f.id === id);
    // Before the first successful project listing nothing is known about projects: never stale.
    return listed && !projects.has(id) && !hold.has(id);
  });
}

/** The library without the given pins; the same object when none of them is pinned. */
export function dropPins(state: LibraryState, keys: ItemKey[]): LibraryState {
  const pins = state.pins ?? [];
  const kept = pins.filter((key) => !keys.includes(key));
  if (kept.length === pins.length) return state;
  const { pins: _old, ...rest } = state;
  return kept.length ? { ...rest, pins: kept } : rest;
}
