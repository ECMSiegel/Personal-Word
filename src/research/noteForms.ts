import type { Project } from "../model";
import type { Footnote, ResearchData, ResolvedNoteForm } from "./types";
import { needsManualNote } from "./citations";

export type SectionReferences = { sectionId: string; ids: string[] }[];
export type CitationContext = Record<string, { number: number; form: ResolvedNoteForm; locator: string; sectionId: string }>;

/** Footnote reference ids of each ordered manuscript section, in document order. */
export function sectionReferences(
  project: Pick<Project, "order" | "entries">,
): SectionReferences {
  return project.order.flatMap((id) => {
    const entry = project.entries.find((candidate) => candidate.id === id && candidate.kind === "section");
    if (!entry) return [];
    const ids: string[] = [];
    const walk = (node: unknown) => {
      if (!node || typeof node !== "object") return;
      const value = node as { type?: unknown; attrs?: { id?: unknown }; content?: unknown[] };
      if (value.type === "footnoteReference" && typeof value.attrs?.id === "string") ids.push(value.attrs.id);
      value.content?.forEach(walk);
    };
    walk(entry.content);
    return [{ sectionId: id, ids }];
  });
}

/** Each footnote once, at its first manuscript occurrence. */
function firstOccurrences(sections: SectionReferences) {
  const seen = new Set<string>();
  return sections.flatMap(({ sectionId, ids }) =>
    ids.filter((id) => !seen.has(id) && Boolean(seen.add(id))).map((id) => ({ id, sectionId })),
  );
}

export function footnoteIdsInOrder(
  project: Pick<Project, "order" | "entries">,
): string[] {
  return firstOccurrences(sectionReferences(project)).map(({ id }) => id);
}

function setOwn<T>(record: Record<string, T>, key: string, value: T) {
  Object.defineProperty(record, key, { value, enumerable: true, configurable: true, writable: true });
}

/** Ibid. only for a plain note citing the same single source as the plain note right before it. */
function ibidEligible(previous: Footnote | undefined, note: Footnote, data: ResearchData) {
  const plain = (n: Footnote) => Boolean(n.sourceId) && !n.text.trim();
  if (!previous || !plain(previous) || !plain(note) || previous.sourceId !== note.sourceId) return false;
  const source = data.sources.find((s) => s.id === note.sourceId);
  if (!source || source.manualFull?.trim() || source.manualShort?.trim()) return false;
  // Ibid. would hide a placeholder that still asks the writer for a manual citation.
  if (needsManualNote(source, "full", note.locator) || needsManualNote(source, "short", note.locator)) return false;
  const locator = note.locator?.trim() ?? "";
  // A bare Ibid. claims the same place, so it needs the same (or no) locator as before.
  return Boolean(locator) || locator === (previous.locator?.trim() ?? "");
}

/**
 * The single numbering and note-form context shared by the editor, reader,
 * research panel and every export. Without a citation policy the forms are
 * exactly the legacy resolveNoteForms result.
 */
export function resolveCitationContext(
  project: Pick<Project, "order" | "entries" | "research">,
  sections: SectionReferences = sectionReferences(project),
): CitationContext {
  const data = project.research ?? { sources: [], notes: [], footnotes: [] };
  const ordered = firstOccurrences(sections);
  const policy = data.citationPolicy;
  const legacy = policy ? undefined : resolveNoteForms(ordered.map(({ id }) => id), data);
  const result: CitationContext = {};
  const seenSources = new Set<string>();
  let previous: Footnote | undefined;
  let section: string | undefined;
  ordered.forEach(({ id, sectionId }, index) => {
    if (policy?.scope === "section" && sectionId !== section) {
      seenSources.clear();
      previous = undefined;
    }
    section = sectionId;
    const note = data.footnotes.find((candidate) => candidate.id === id);
    if (!note) {
      previous = undefined;
      return;
    }
    let form: ResolvedNoteForm;
    if (!policy) form = legacy![id] ?? "full";
    else if (!note.sourceId) form = "full";
    else if (note.form === "full" || note.form === "short") form = note.form;
    else if (note.shortened) form = "short";
    else if (policy.repeats === "ibid" && ibidEligible(previous, note, data)) form = "ibid";
    else form = seenSources.has(note.sourceId) ? "short" : "full";
    const locator = form === "ibid" && note.locator?.trim() === previous!.locator?.trim() ? "" : note.locator ?? "";
    setOwn(result, id, { number: index + 1, form, locator, sectionId });
    if (note.sourceId) seenSources.add(note.sourceId);
    previous = note;
  });
  return result;
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
    setOwn(result, id, form);
    if (note.sourceId) seenSources.add(note.sourceId);
  }
  return result;
}
