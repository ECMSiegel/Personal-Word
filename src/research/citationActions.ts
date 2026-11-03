import type { Footnote, ResearchData, ResearchNote, Source } from "./types";

export type NewId = () => string;
const id = () => crypto.randomUUID();

export const kindLabels: Record<Source["kind"], string> = {
  book: "Book", journal: "Journal article", website: "Website", chapter: "Book chapter",
  thesis: "Thesis or dissertation", report: "Report", conference: "Conference work",
  newspaper: "Newspaper article", interview: "Interview", media: "Media", other: "Other",
};
export const firstWords = (text: string) => {
  const words = text.trim().split(/\s+/);
  return words.slice(0, 6).join(" ") + (words.length > 6 ? "…" : "");
};
const leadName = (source: Source) => {
  const first = source.authors.find((name) => name.trim())?.trim();
  if (!first) return "";
  return first.includes(",") ? first.split(",")[0].trim() : (first.split(/\s+/).at(-1) ?? "");
};
export const sourceSummary = (source: Source) =>
  [leadName(source), source.title.trim() || "Untitled source"].filter(Boolean).join(" -- ") +
  (source.year ? ` (${source.year})` : "");

export function addLookedUpSource(data: ResearchData, source: Omit<Source, "id">, newId: NewId = id) {
  const sourceId = newId();
  return { data: { ...data, sources: [...data.sources, { id: sourceId, ...source }] }, id: sourceId };
}
export function addManualSource(data: ResearchData, newId: NewId = id) {
  const sourceId = newId();
  return { data: { ...data, sources: [...data.sources, { id: sourceId, kind: "book" as const, title: "", authors: [] }] }, id: sourceId };
}
export function addCitation(data: ResearchData, sourceId: string | undefined, newId: NewId = id) {
  const footnoteId = newId();
  return { data: { ...data, footnotes: [...data.footnotes, { id: footnoteId, text: "", ...(sourceId ? { sourceId } : {}) }] }, footnoteId };
}
export function patchSource(data: ResearchData, id: string, patch: Partial<Source>): ResearchData {
  return { ...data, sources: data.sources.map((s) => s.id === id ? { ...s, ...patch } : s) };
}
export function patchFootnote(data: ResearchData, id: string, patch: Partial<Footnote>): ResearchData {
  return { ...data, footnotes: data.footnotes.map((f) => f.id === id ? { ...f, ...patch } : f) };
}
export function removeSource(data: ResearchData, id: string): { data: ResearchData } | { error: string } {
  if (data.footnotes.some((f) => f.sourceId === id) || data.notes.some((n) => n.sourceId === id))
    return { error: "Remove the quotes and footnotes linked to this source before deleting it. Footnotes can be unlinked." };
  return { data: { ...data, sources: data.sources.filter((s) => s.id !== id) } };
}
export function patchResearchNote(data: ResearchData, id: string, patch: Partial<ResearchNote>): ResearchData {
  return { ...data, notes: data.notes.map((n) => n.id === id ? { ...n, ...patch } : n) };
}
