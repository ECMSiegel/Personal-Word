import type { Entry, Project } from "../model";
import type { ResearchData } from "../research/types";
import { collectAssetIds } from "../assets/assets";
import type { PendingAsset } from "../assets/types";

export type FragmentAssetStorage = {
  readAsset(projectId: string, id: string): Promise<PendingAsset>;
  stageAssets(projectId: string, assets: PendingAsset[]): Promise<unknown>;
};

export async function copyFragmentAssets(
  targetId: string,
  sourceId: string,
  fragment: Entry,
  storage: FragmentAssetStorage,
): Promise<PendingAsset[]> {
  const ids = [...collectAssetIds(fragment.content)];
  if (ids.length === 0) return [];
  const assets = await Promise.all(
    ids.map((id) => storage.readAsset(sourceId, id)),
  );
  await storage.stageAssets(targetId, assets);
  return assets;
}

export async function importFragmentWithAssets(
  target: Project,
  source: Project,
  fragment: Entry,
  storage: FragmentAssetStorage,
): Promise<Project> {
  await copyFragmentAssets(target.id, source.id, fragment, storage);
  return importFragment(target, source, fragment);
}

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
    ...a,
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
