import type { Summary } from "../model";
import {
  ROOT,
  containerOf,
  itemKey,
  parseKey,
  savedItems,
  type ItemKey,
  type LibraryFolder,
  type LibraryState,
} from "./folders";
import type { LibraryFallbackSort, LibrarySort } from "../libraryPreferences";

export type OutlineRow = {
  key: ItemKey;
  kind: "folder" | "project";
  id: string;
  depth: number;
  /** The folder id (or "root") the row lives in. Kept on pinned rows too. */
  container: string;
  /** True when the row's own key is pinned (also true inside a pinned folder). */
  pinned: boolean;
  folder?: LibraryFolder;
  project?: Summary;
  /** Folders only: counts over the whole subtree, pinned or not. */
  totals?: { words: number; projects: number; edited?: string };
  /** Pinned rows that live in a folder: that folder's name path ("Essays / Drafts"). */
  path?: string;
};

type Item = { key: ItemKey; name: string; edited?: string; added?: string; words: number; sections: number };

export function buildOutline(input: {
  projects: Summary[];
  lib: LibraryState;
  sort: LibrarySort;
  fallbackSort: LibraryFallbackSort;
  reverse: boolean;
  foldersFirst: boolean;
}): { pinned: OutlineRow[]; rows: OutlineRow[] } {
  const { projects, lib, sort, fallbackSort, reverse, foldersFirst } = input;
  const folderById = new Map(lib.folders.map((f) => [f.id, f]));
  const projectById = new Map(projects.map((p) => [p.id, p]));
  const parentOf = (container: string) => (container === ROOT ? null : container);

  const projectsIn = new Map<string, Summary[]>();
  for (const p of projects) {
    const at = containerOf(lib, p.id);
    projectsIn.set(at, [...(projectsIn.get(at) ?? []), p]);
  }
  const foldersIn = (container: string) => lib.folders.filter((f) => f.parent === parentOf(container));

  const totals = new Map<string, { words: number; projects: number; edited?: string }>();
  const totalsOf = (id: string, seen = new Set<string>()): { words: number; projects: number; edited?: string } => {
    const known = totals.get(id);
    if (known) return known;
    const sum: { words: number; projects: number; edited?: string } = { words: 0, projects: 0, edited: undefined };
    if (seen.has(id)) return sum;
    seen.add(id);
    for (const p of projectsIn.get(id) ?? []) {
      sum.words += p.wordCount ?? 0;
      sum.projects += 1;
      if (sum.edited === undefined || p.updatedAt > sum.edited) sum.edited = p.updatedAt;
    }
    for (const f of foldersIn(id)) {
      const sub = totalsOf(f.id, seen);
      sum.words += sub.words;
      sum.projects += sub.projects;
      if (sub.edited !== undefined && (sum.edited === undefined || sub.edited > sum.edited)) sum.edited = sub.edited;
    }
    totals.set(id, sum);
    return sum;
  };

  const itemOf = (key: ItemKey): Item | null => {
    const { kind, id } = parseKey(key);
    if (kind === "folder") {
      const f = folderById.get(id);
      if (!f) return null;
      const t = totalsOf(id);
      return { key, name: f.name, edited: t.edited, added: undefined, words: t.words, sections: t.projects };
    }
    const p = projectById.get(id);
    if (!p) return null;
    return { key, name: p.title, edited: p.updatedAt, added: p.createdAt, words: p.wordCount ?? 0, sections: p.sectionCount ?? 0 };
  };

  // Newest and biggest first; a missing value sorts last; ties fall back to the name.
  const compareBy = (by: LibraryFallbackSort) => (a: Item, b: Item) => {
    const byName = a.name.localeCompare(b.name);
    if (by === "name") return byName;
    if (by === "words") return b.words - a.words || byName;
    if (by === "sections") return b.sections - a.sections || byName;
    const av = by === "added" ? a.added : a.edited;
    const bv = by === "added" ? b.added : b.edited;
    if (av === undefined && bv === undefined) return byName;
    if (av === undefined) return 1;
    if (bv === undefined) return -1;
    return bv.localeCompare(av) || byName;
  };

  const ordered = (container: string): ItemKey[] => {
    const keys: ItemKey[] = [
      ...foldersIn(container).map((f) => itemKey("folder", f.id)),
      ...(projectsIn.get(container) ?? []).map((p) => itemKey("project", p.id)),
    ];
    const items = keys.map((k) => itemOf(k)!);
    let result: ItemKey[];
    if (sort === "custom") {
      const fallback = items.sort(compareBy(fallbackSort)).map((i) => i.key);
      const saved = savedItems(lib, container);
      if (saved) {
        const here = new Set(fallback);
        const listed = new Set(saved);
        result = [...fallback.filter((k) => !listed.has(k)), ...[...new Set(saved)].filter((k) => here.has(k))];
      } else result = fallback;
    } else {
      result = items.sort(compareBy(sort)).map((i) => i.key);
      if (reverse) result.reverse();
    }
    if (!foldersFirst) return result;
    return [...result.filter((k) => k.startsWith("f:")), ...result.filter((k) => k.startsWith("p:"))];
  };

  const folderPath = (id: string): string => {
    const names: string[] = [];
    const seen = new Set<string>();
    let at = folderById.get(id);
    while (at && !seen.has(at.id)) {
      seen.add(at.id);
      names.unshift(at.name);
      at = at.parent === null ? undefined : folderById.get(at.parent);
    }
    return names.join(" / ");
  };

  const pins = new Set(lib.pins ?? []);
  const rowFor = (key: ItemKey, depth: number, container: string): OutlineRow => {
    const { kind, id } = parseKey(key);
    return kind === "folder"
      ? { key, kind, id, depth, container, pinned: pins.has(key), folder: folderById.get(id), totals: totalsOf(id) }
      : { key, kind, id, depth, container, pinned: pins.has(key), project: projectById.get(id) };
  };

  const walk = (container: string, depth: number, out: OutlineRow[], liftPins: boolean) => {
    for (const key of ordered(container)) {
      if (liftPins && pins.has(key)) continue;
      out.push(rowFor(key, depth, container));
      const { kind, id } = parseKey(key);
      if (kind === "folder" && !folderById.get(id)?.collapsed) walk(id, depth + 1, out, liftPins);
    }
  };

  const rows: OutlineRow[] = [];
  walk(ROOT, 0, rows, true);

  // A pin inside a pinned folder stays in that folder and is not lifted again.
  const insidePinnedFolder = (container: string): boolean => {
    const seen = new Set<string>();
    let at = container === ROOT ? undefined : folderById.get(container);
    while (at && !seen.has(at.id)) {
      if (pins.has(itemKey("folder", at.id))) return true;
      seen.add(at.id);
      at = at.parent === null ? undefined : folderById.get(at.parent);
    }
    return false;
  };
  const pinned: OutlineRow[] = [];
  for (const key of lib.pins ?? []) {
    const { kind, id } = parseKey(key);
    const container = kind === "folder" ? (folderById.get(id)?.parent ?? ROOT) : containerOf(lib, id);
    if (kind === "folder" ? !folderById.has(id) : !projectById.has(id)) continue;
    if (insidePinnedFolder(container)) continue;
    const row = rowFor(key, 0, container);
    if (container !== ROOT) row.path = folderPath(container);
    pinned.push(row);
    if (kind === "folder" && !folderById.get(id)?.collapsed) walk(id, 1, pinned, false);
  }
  return { pinned, rows };
}

/** The keys of one container's rows, in the order shown. */
export function siblings(rows: OutlineRow[], container: string): ItemKey[] {
  return rows.filter((row) => row.container === container).map((row) => row.key);
}
