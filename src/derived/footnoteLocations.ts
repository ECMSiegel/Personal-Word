import type { JSONContent } from "@tiptap/react";
import type { Project } from "../model";

export type FootnoteLocation = { entryId: string; title: string };

const cache = new WeakMap<Project, ReadonlyMap<string, FootnoteLocation>>();

function collect(node: JSONContent, found: string[]) {
  if (node.type === "footnoteReference" && typeof node.attrs?.id === "string")
    found.push(node.attrs.id);
  node.content?.forEach((child) => collect(child, found));
  return found;
}

/** Where each footnote's marker sits: the first entry (in project order) that holds it. */
export function footnoteLocations(project: Project): ReadonlyMap<string, FootnoteLocation> {
  const known = cache.get(project);
  if (known) return known;
  const map = new Map<string, FootnoteLocation>();
  for (const entry of project.entries) {
    for (const id of collect(entry.content, []))
      if (!map.has(id)) map.set(id, { entryId: entry.id, title: entry.title });
  }
  cache.set(project, map);
  return map;
}
