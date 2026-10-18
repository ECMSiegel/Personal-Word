import type { Project } from "../model";
import type { ResearchData } from "./types";

export function footnoteIdsInOrder(
  project: Pick<Project, "order" | "entries">,
): string[] {
  const ids: string[] = [];
  const seen = new Set<string>();
  const walk = (node: unknown) => {
    if (!node || typeof node !== "object") return;
    const value = node as { type?: unknown; attrs?: { id?: unknown }; content?: unknown[] };
    if (value.type === "footnoteReference" && typeof value.attrs?.id === "string" && !seen.has(value.attrs.id)) {
      seen.add(value.attrs.id);
      ids.push(value.attrs.id);
    }
    value.content?.forEach(walk);
  };
  for (const id of project.order) {
    const entry = project.entries.find((candidate) => candidate.id === id && candidate.kind === "section");
    if (entry) walk(entry.content);
  }
  return ids;
}

export function resolveNoteForms(
  ids: string[],
  data: ResearchData,
): Record<string, "full" | "short"> {
  const result: Record<string, "full" | "short"> = {};
  const seenSources = new Set<string>();
  for (const id of ids) {
    const note = data.footnotes.find((candidate) => candidate.id === id);
    if (!note) continue;
    let form: "full" | "short" = "full";
    if (!note.sourceId) form = "full";
    else if (note.form === "full" || note.form === "short") form = note.form;
    else if (note.shortened) form = "short";
    else if (note.sourceId && data.autoShortNotes && seenSources.has(note.sourceId)) form = "short";
    Object.defineProperty(result, id, {
      value: form,
      enumerable: true,
      configurable: true,
      writable: true,
    });
    if (note.sourceId) seenSources.add(note.sourceId);
  }
  return result;
}
