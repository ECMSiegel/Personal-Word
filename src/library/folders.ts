export type LibraryFolder = {
  id: string;
  name: string;
  parent: string | null;
  colour?: string;
  collapsed?: boolean;
};

export type LibraryState = {
  version: 1;
  folders: LibraryFolder[];
  placement: Record<string, string>;
  order: Record<string, string[]>;
};

export type Summary = { id: string };

export const ROOT = "root";
export const emptyLibrary: LibraryState = {
  version: 1,
  folders: [],
  placement: {},
  order: {},
};

const record = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value);

function copyState(state: LibraryState): LibraryState {
  return {
    version: 1,
    folders: state.folders.map((folder) => ({ ...folder })),
    placement: { ...state.placement },
    order: Object.fromEntries(
      Object.entries(state.order).map(([key, ids]) => [key, [...ids]]),
    ),
  };
}

/** A library object written by another version of the app: callers treat it as a read error and
 *  never write over it (reading it as empty would lose its folders on the next save). */
export class LibraryVersionError extends Error {
  constructor(version: unknown) {
    super(`Unknown library version: ${JSON.stringify(version) ?? "none"}`);
    this.name = "LibraryVersionError";
  }
}

/** Throws `LibraryVersionError` for a library object whose `version` is not 1; anything else
 *  that is not a usable library (nothing saved, not an object, no folder list) reads as empty. */
export function parseLibrary(raw: unknown): LibraryState {
  if (record(raw) && raw.version !== 1) throw new LibraryVersionError(raw.version);
  if (!record(raw) || !Array.isArray(raw.folders))
    return { ...emptyLibrary, folders: [], placement: {}, order: {} };
  // A missing or damaged placement map or order map costs only itself; the folders survive.
  const rawPlacement = record(raw.placement) ? raw.placement : {};
  const rawOrder = record(raw.order) ? raw.order : {};

  const folders: LibraryFolder[] = [];
  const ids = new Set<string>();
  for (const candidate of raw.folders) {
    if (
      !record(candidate) ||
      typeof candidate.id !== "string" || !candidate.id || ids.has(candidate.id) ||
      typeof candidate.name !== "string" ||
      !(typeof candidate.parent === "string" || candidate.parent === null) ||
      (candidate.colour !== undefined && typeof candidate.colour !== "string") ||
      (candidate.collapsed !== undefined && typeof candidate.collapsed !== "boolean")
    )
      // One bad entry costs only itself: its projects and child folders fall back to the
      // top level below, and the rest of the library survives.
      continue;
    ids.add(candidate.id);
    folders.push({
      id: candidate.id,
      name: candidate.name,
      parent: candidate.parent as string | null,
      ...(candidate.colour === undefined ? {} : { colour: candidate.colour as string }),
      ...(candidate.collapsed === undefined ? {} : { collapsed: candidate.collapsed as boolean }),
    });
  }

  const byId = new Map(folders.map((folder) => [folder.id, folder]));
  for (const folder of folders) {
    if (folder.parent !== null && !byId.has(folder.parent)) folder.parent = null;
  }
  // Break each parent cycle at its first repeated node. This retains the folders
  // and makes the repaired hierarchy safe to traverse.
  for (const folder of folders) {
    const chain = [folder.id];
    const seen = new Map<string, number>([[folder.id, 0]]);
    let parent = folder.parent;
    while (parent !== null) {
      const cycleStart = seen.get(parent);
      if (cycleStart !== undefined) {
        for (const id of chain.slice(cycleStart)) {
          const cyclic = byId.get(id);
          if (cyclic) cyclic.parent = null;
        }
        break;
      }
      seen.set(parent, chain.length);
      chain.push(parent);
      parent = byId.get(parent)?.parent ?? null;
    }
  }

  const placement: Record<string, string> = {};
  for (const [projectId, folderId] of Object.entries(rawPlacement)) {
    if (typeof folderId === "string") placement[projectId] = folderId;
  }
  const order: Record<string, string[]> = {};
  for (const [container, idsForContainer] of Object.entries(rawOrder)) {
    if (Array.isArray(idsForContainer) && idsForContainer.every((id) => typeof id === "string"))
      order[container] = [...idsForContainer];
  }
  return { version: 1, folders, placement, order };
}

export function containerOf(state: LibraryState, projectId: string): string {
  const folderId = state.placement[projectId];
  return folderId && state.folders.some((folder) => folder.id === folderId)
    ? folderId
    : ROOT;
}

export function childFolders(state: LibraryState, parent: string | null): LibraryFolder[] {
  return state.folders.filter((folder) => folder.parent === parent);
}

export function addFolder(
  state: LibraryState,
  name: string,
  parent: string | null,
): { state: LibraryState; id: string } {
  const id = crypto.randomUUID();
  return {
    state: { ...copyState(state), folders: [...state.folders.map((folder) => ({ ...folder })), { id, name: name.trim(), parent }] },
    id,
  };
}

export function renameFolder(state: LibraryState, id: string, name: string): LibraryState {
  const trimmed = name.trim();
  if (!trimmed || !state.folders.some((folder) => folder.id === id)) return state;
  const next = copyState(state);
  next.folders = next.folders.map((folder) => folder.id === id ? { ...folder, name: trimmed } : folder);
  return next;
}

export function setFolderColour(state: LibraryState, id: string, colour: string | undefined): LibraryState {
  if (!state.folders.some((folder) => folder.id === id)) return state;
  const next = copyState(state);
  next.folders = next.folders.map((folder) => {
    if (folder.id !== id) return folder;
    const updated = { ...folder };
    if (colour === undefined) delete updated.colour;
    else updated.colour = colour;
    return updated;
  });
  return next;
}

export function setFolderCollapsed(state: LibraryState, id: string, collapsed: boolean): LibraryState {
  if (!state.folders.some((folder) => folder.id === id)) return state;
  const next = copyState(state);
  next.folders = next.folders.map((folder) => folder.id === id ? { ...folder, collapsed } : folder);
  return next;
}

export function moveFolder(state: LibraryState, id: string, parent: string | null): LibraryState {
  const folder = state.folders.find((item) => item.id === id);
  if (!folder || (parent !== null && !state.folders.some((item) => item.id === parent))) return state;
  if (parent === id) return state;
  let ancestor = parent;
  while (ancestor !== null) {
    if (ancestor === id) return state;
    ancestor = state.folders.find((item) => item.id === ancestor)?.parent ?? null;
  }
  const next = copyState(state);
  next.folders = next.folders.map((item) => item.id === id ? { ...item, parent } : item);
  return next;
}

const folderOrderKey = (parent: string | null) => `folders:${parent ?? ROOT}`;

export function orderedFolders(state: LibraryState, parent: string | null, shown: LibraryFolder[]): LibraryFolder[] {
  const order = state.order[folderOrderKey(parent)];
  if (!order) return shown;
  const rank = new Map(order.map((id, index) => [id, index]));
  return [...shown].sort((a, b) => {
    const ar = rank.get(a.id);
    const br = rank.get(b.id);
    if (ar === undefined && br === undefined) return shown.indexOf(a) - shown.indexOf(b);
    if (ar === undefined) return -1;
    if (br === undefined) return 1;
    return ar - br;
  });
}

export function reorderFolder(
  state: LibraryState,
  parent: string | null,
  shownFolderIds: string[],
  id: string,
  toIndex: number,
): LibraryState {
  const rest = shownFolderIds.filter((item) => item !== id);
  rest.splice(Math.max(0, Math.min(toIndex, rest.length)), 0, id);
  const next = copyState(state);
  next.order[folderOrderKey(parent)] = rest;
  return next;
}

export function deleteFolder(state: LibraryState, id: string): LibraryState {
  const folder = state.folders.find((item) => item.id === id);
  if (!folder) return state;
  const next = copyState(state);
  next.folders = next.folders.map((item) => item.parent === id ? { ...item, parent: folder.parent } : item).filter((item) => item.id !== id);
  for (const [projectId, folderId] of Object.entries(next.placement)) {
    if (folderId !== id) continue;
    // Top level is "no entry", never a literal ROOT placement.
    if (folder.parent === null) delete next.placement[projectId];
    else next.placement[projectId] = folder.parent;
  }
  delete next.order[id];
  delete next.order[folderOrderKey(id)];
  return next;
}

export function fileProject(state: LibraryState, projectId: string, folder: string | null): LibraryState {
  const next = copyState(state);
  if (folder === null) delete next.placement[projectId];
  else next.placement[projectId] = folder;
  for (const key of Object.keys(next.order))
    next.order[key] = next.order[key].filter((id) => id !== projectId);
  return next;
}

export function orderedProjects<T extends Summary>(state: LibraryState, container: string, shown: T[]): T[] {
  const order = state.order[container];
  if (!order) return shown;
  const shownById = new Map(shown.map((project) => [project.id, project]));
  const listed = new Set(order);
  return [
    ...shown.filter((project) => !listed.has(project.id)),
    ...order.flatMap((id) => shownById.has(id) ? [shownById.get(id)!] : []),
  ];
}

export function hasCustomOrder(state: LibraryState, container: string): boolean {
  return Object.prototype.hasOwnProperty.call(state.order, container);
}

export function moveProject(
  state: LibraryState,
  container: string,
  shownIds: string[],
  projectId: string,
  toIndex: number,
): LibraryState {
  const order = shownIds.filter((id) => id !== projectId);
  order.splice(Math.max(0, Math.min(toIndex, order.length)), 0, projectId);
  const next = copyState(state);
  next.order[container] = order;
  return next;
}
