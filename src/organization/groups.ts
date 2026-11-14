import type { Entry, Project } from "../model";
import type { Swatch } from "../appearance";

/**
 * Top-level sidebar sections (HS9). Custom sections sit beside Manuscript and are part of the
 * manuscript: their entries are ordinary `kind: "section"` entries in `project.order`, tagged
 * with `Entry.group`. Every rule about them lives here; the stored `project.order` is kept
 * grouped by sidebar order (`normalizeOrder`) so Read, exports, footnote numbering and the
 * native manuscript mirror follow the sidebar with no change of their own.
 */
export const builtInGroups = ["manuscript", "fragments", "research"] as const;
export type BuiltInGroup = (typeof builtInGroups)[number];
export const defaultGroupTitles: Record<BuiltInGroup, string> = {
  manuscript: "Manuscript",
  fragments: "Fragments",
  research: "Research",
};
const isBuiltIn = (id: string): id is BuiltInGroup =>
  (builtInGroups as readonly string[]).includes(id);

/** Ids of the custom top-level sections, in the order they were added. */
export const customGroupIds = (p: Project): string[] => (p.groups ?? []).map((g) => g.id);

/** True for Manuscript and every custom section (the sections whose entries are manuscript). */
export const isManuscriptGroup = (p: Project, id: string): boolean =>
  id === "manuscript" || customGroupIds(p).includes(id);

/** The display name of a top-level section heading. */
export function groupTitle(p: Project, id: string): string {
  if (isBuiltIn(id)) return p.groupTitles?.[id] ?? defaultGroupTitles[id];
  return p.groups?.find((g) => g.id === id)?.title ?? id;
}

/** The top-level section an entry is listed under. Unknown or missing ids are Manuscript. */
export function groupOf(p: Project, e: Entry): string {
  return e.group && customGroupIds(p).includes(e.group) ? e.group : "manuscript";
}

/** The sidebar's top sections: `sidebarOrder` where it names them, then missing built-ins,
 *  then missing custom sections. */
export function topGroupOrder(p: Project): string[] {
  const known = [...builtInGroups, ...customGroupIds(p)];
  const listed = (p.sidebarOrder ?? []).filter((id, i, all) => known.includes(id) && all.indexOf(id) === i);
  return [...listed, ...known.filter((id) => !listed.includes(id))];
}

/** Manuscript and the custom sections, in sidebar order. */
export const manuscriptGroupOrder = (p: Project): string[] =>
  topGroupOrder(p).filter((id) => isManuscriptGroup(p, id));

/** `project.order` grouped by sidebar order, keeping the order inside each section. The same
 *  array comes back when nothing moves (always, for a project with no custom sections). */
export function normalizeOrder(p: Project): string[] {
  if (!p.groups?.length) return p.order;
  const byId = new Map(p.entries.map((e) => [e.id, e]));
  const buckets = new Map(manuscriptGroupOrder(p).map((id) => [id, [] as string[]]));
  for (const id of p.order) {
    const e = byId.get(id);
    buckets.get(e ? groupOf(p, e) : "manuscript")!.push(id);
  }
  const next = [...buckets.values()].flat();
  return next.every((id, i) => id === p.order[i]) ? p.order : next;
}

/** The project with its order normalised (the same object when nothing changes). */
export function normalized(p: Project): Project {
  const order = normalizeOrder(p);
  return order === p.order ? p : { ...p, order };
}

const setGroup = (e: Entry, groupId: string): Entry => {
  const { group: _old, ...rest } = e;
  return groupId === "manuscript" ? rest : { ...rest, group: groupId };
};

export function addGroup(p: Project, title: string, id: string = crypto.randomUUID()): Project {
  return normalized({ ...p, groups: [...(p.groups ?? []), { id, title }] });
}

/** Custom sections take the new name; built-ins store it in groupTitles, and an empty name or
 *  the default name restores the default. */
export function renameGroup(p: Project, id: string, title: string): Project {
  const name = title.trim();
  if (!isBuiltIn(id))
    return name ? { ...p, groups: (p.groups ?? []).map((g) => (g.id === id ? { ...g, title: name } : g)) } : p;
  const { [id]: _old, ...rest } = p.groupTitles ?? {};
  const titles = name && name !== defaultGroupTitles[id] ? { ...rest, [id]: name } : rest;
  const { groupTitles: _gone, ...without } = p;
  return Object.keys(titles).length ? { ...without, groupTitles: titles } : without;
}

/** Sets or clears (undefined) a built-in header's colour in this project (T12); other ids are ignored. */
export function setHeaderColour(p: Project, id: string, colour: Swatch | undefined): Project {
  if (!(builtInGroups as readonly string[]).includes(id)) return p;
  const { [id as BuiltInGroup]: _old, ...rest } = p.headerColours ?? {};
  const next = colour ? { ...rest, [id]: colour } : rest;
  const { headerColours: _gone, ...without } = p;
  return Object.keys(next).length ? { ...without, headerColours: next } : without;
}

/** Sets or clears (undefined) a custom header's colour. Built-in headers use setHeaderColour. */
export function setGroupColour(p: Project, id: string, colour: Swatch | undefined): Project {
  if (!p.groups?.some((g) => g.id === id)) return p;
  return {
    ...p,
    groups: p.groups.map((g) => {
      if (g.id !== id) return g;
      const { colour: _old, ...rest } = g;
      return colour ? { ...rest, colour } : rest;
    }),
  };
}

/** Removes a custom section; its entries move to Manuscript (nothing is deleted). */
export function deleteGroup(p: Project, id: string): Project {
  if (isBuiltIn(id)) return p;
  const groups = (p.groups ?? []).filter((g) => g.id !== id);
  const { groups: _old, ...rest } = p;
  const next: Project = {
    ...rest,
    ...(groups.length ? { groups } : {}),
    entries: p.entries.map((e) => (e.group === id ? setGroup(e, "manuscript") : e)),
    ...(p.sidebarOrder ? { sidebarOrder: p.sidebarOrder.filter((x) => x !== id) } : {}),
  };
  return normalized(next);
}

/** Moves a section entry into another top-level section, as its last entry. */
export function moveEntryToGroup(p: Project, entryId: string, groupId: string): Project {
  const target = isManuscriptGroup(p, groupId) ? groupId : "manuscript";
  return normalized({
    ...p,
    entries: p.entries.map((e) => (e.id === entryId ? setGroup(e, target) : e)),
    order: [...p.order.filter((x) => x !== entryId), entryId],
  });
}

/** Adds a new section entry to a top-level section: below `afterId`, or last in the section. */
export function addSectionEntry(p: Project, item: Entry, groupId = "manuscript", afterId?: string): Project {
  const target = isManuscriptGroup(p, groupId) ? groupId : "manuscript";
  const at = afterId ? p.order.indexOf(afterId) : -1;
  const order = at < 0 ? [...p.order, item.id] : [...p.order.slice(0, at + 1), item.id, ...p.order.slice(at + 1)];
  return normalized({ ...p, entries: [...p.entries, setGroup(item, target)], order });
}

/** Moves a section entry to index `to` among the entries of its own top-level section. */
export function reorderInGroup(p: Project, entryId: string, to: number): Project {
  const e = p.entries.find((x) => x.id === entryId);
  if (!e) return p;
  const group = groupOf(p, e);
  const byId = new Map(p.entries.map((x) => [x.id, x]));
  const inGroup = p.order.filter((id) => id !== entryId && byId.get(id) && groupOf(p, byId.get(id)!) === group);
  const index = Math.max(0, Math.min(to, inGroup.length));
  const order = p.order.filter((id) => id !== entryId);
  const at = index < inGroup.length ? order.indexOf(inGroup[index]) : order.indexOf(inGroup[inGroup.length - 1]) + 1;
  order.splice(inGroup.length ? at : order.length, 0, entryId);
  return normalized({ ...p, order });
}
