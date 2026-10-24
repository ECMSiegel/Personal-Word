import { entryWords, type Project } from "../model";

export type EntrySummary = { words: number; referenceOrder: string[] };
export type ProjectSummary = {
  entries: Map<string, EntrySummary>;
  manuscriptWords: number;
  allWords: number;
  referenceOrder: string[];
  scannedEntries: number;
  recountedEntries: number;
};

function references(node: any, result: string[] = []): string[] {
  if (node.type === "footnoteReference" && typeof node.attrs?.id === "string")
    result.push(node.attrs.id);
  node.content?.forEach((child: any) => references(child, result));
  return result;
}

export function createProjectIndex() {
  // Cache immutable content objects separately from plain text: formatting may
  // replace the former without changing the latter. Neither cache owns prose.
  const content = new WeakMap<object, string[]>();
  let referenceOrder: string[] = [];
  let previousWords = new Map<string, {text: string; words: number}>();
  return {
    update(_previous: Project | null, next: Project): ProjectSummary {
      let scannedEntries = 0;
      let recountedEntries = 0;
      let manuscriptWords = 0;
      let allWords = 0;
      const entries = new Map<string, EntrySummary>();
      const nextWords = new Map<string, {text: string; words: number}>();
      const sections = new Set<string>();
      for (const entry of next.entries) {
        let referenceOrder = content.get(entry.content);
        if (!referenceOrder) {
          referenceOrder = references(entry.content);
          content.set(entry.content, referenceOrder);
          scannedEntries++;
        }
        const cached = previousWords.get(entry.id);
        const words = cached?.text === entry.text ? cached.words : entryWords(entry);
        if (cached?.text !== entry.text) recountedEntries++;
        nextWords.set(entry.id, {text: entry.text, words});
        entries.set(entry.id, {words, referenceOrder});
        allWords += words;
        if (entry.kind === "section") {
          sections.add(entry.id);
          manuscriptWords += words;
        }
      }
      previousWords = nextWords;
      const order = next.order.flatMap(id => sections.has(id) ? entries.get(id)?.referenceOrder ?? [] : []);
      const nextOrder = [...new Set(order)];
      if (nextOrder.length !== referenceOrder.length || nextOrder.some((id,index) => id !== referenceOrder[index])) referenceOrder = nextOrder;
      return { entries, manuscriptWords, allWords, referenceOrder, scannedEntries, recountedEntries };
    },
  };
}
