import type { Entry, Project } from "../model";
import type { ResearchData } from "../research/types";

/** Import only notes referenced by the fragment, remapping IDs to avoid cross-project collisions. */
export function importFragment(
  target: Project,
  source: Project,
  fragment: Entry,
): Project {
  const copied: Entry = {
    ...structuredClone(fragment),
    id: crypto.randomUUID(),
    uses: [],
    updatedAt: new Date().toISOString(),
  };
  const research: ResearchData = structuredClone(
    target.research ?? { sources: [], notes: [], footnotes: [] },
  );
  const noteIds = new Map<string, string>();
  const sourceIds = new Map<string, string>();
  function visit(node: any) {
    if (node.type === "footnoteReference" && node.attrs?.id) {
      const oldId = node.attrs.id;
      if (!noteIds.has(oldId)) {
        const old = source.research?.footnotes.find((n) => n.id === oldId);
        if (old) {
          const note = { ...old, id: crypto.randomUUID() };
          noteIds.set(oldId, note.id);
          if (old.sourceId) {
            const oldSource = source.research?.sources.find(
              (s) => s.id === old.sourceId,
            );
            if (oldSource) {
              if (!sourceIds.has(old.sourceId)) {
                const id = crypto.randomUUID();
                sourceIds.set(old.sourceId, id);
                research.sources.push({ ...structuredClone(oldSource), id });
              }
              note.sourceId = sourceIds.get(old.sourceId);
            }
          }
          research.footnotes.push(note);
        }
      }
      node.attrs.id = noteIds.get(oldId) ?? oldId;
    }
    node.content?.forEach(visit);
  }
  visit(copied.content);
  return { ...target, entries: [...target.entries, copied], research };
}

export function mergeMissingResearch(
  current?: ResearchData,
  snapshot?: ResearchData,
): ResearchData {
  const a = current ?? { sources: [], notes: [], footnotes: [] };
  const b = snapshot ?? { sources: [], notes: [], footnotes: [] };
  return {
    sources: [
      ...a.sources,
      ...b.sources.filter((x) => !a.sources.some((y) => y.id === x.id)),
    ],
    notes: a.notes,
    footnotes: [
      ...a.footnotes,
      ...b.footnotes.filter((x) => !a.footnotes.some((y) => y.id === x.id)),
    ],
  };
}
