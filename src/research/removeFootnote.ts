import type { JSONContent } from "@tiptap/react";
import type { Project } from "../model";

/** Drops every footnote marker with this id from a document. Returns the same object when there is none. */
export function removeFootnoteMarkers(node: JSONContent, id: string): JSONContent {
  if (!node.content) return node;
  let changed = false;
  const content: JSONContent[] = [];
  for (const child of node.content) {
    if (child.type === "footnoteReference" && child.attrs?.id === id) {
      changed = true;
      continue;
    }
    const next = removeFootnoteMarkers(child, id);
    if (next !== child) changed = true;
    content.push(next);
  }
  if (!changed) return node;
  const { content: _old, ...rest } = node;
  return content.length ? { ...rest, content } : rest;
}

/**
 * Deletes a text-only footnote: its record and its marker in every entry (sections and
 * fragments). Entries in `skipEntryIds` keep their content: an open editor removes its own
 * marker so its next save cannot bring it back. A footnote that cites a source, or that does
 * not exist, is never removed (returns null). A record with no marker is removed alone.
 */
export function removeTextOnlyFootnote(
  project: Project,
  id: string,
  skipEntryIds: ReadonlySet<string> = new Set(),
  stamp: string = new Date().toISOString(),
): Project | null {
  const record = project.research?.footnotes.find((n) => n.id === id);
  if (!project.research || !record || record.sourceId) return null;
  return {
    ...project,
    entries: project.entries.map((entry) => {
      if (skipEntryIds.has(entry.id)) return entry;
      const content = removeFootnoteMarkers(entry.content, id);
      return content === entry.content ? entry : { ...entry, content, updatedAt: stamp };
    }),
    research: { ...project.research, footnotes: project.research.footnotes.filter((n) => n.id !== id) },
  };
}
