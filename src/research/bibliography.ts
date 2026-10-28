// Chicago 18 notes and bibliography style sorting rules:
// - Entry text and parts come from the existing citationParts(s, "bibliography") / manualBibliography exactly as in citations.ts.
// - "author": alphabetical by author/editor/title using Chicago author sort (localeCompare), following the Chicago citation guide.
// - "cited": in order of the first footnote reference marker that cites them in manuscript section order.
// - "type": grouped by source kind in sourceKinds order (only kinds that have entries), with author order inside each group.
// - Scope "cited": only sources cited in footnotes in the manuscript.
// - Scope "all": all sources in the project; with "cited" order, uncited sources follow the cited ones in author order.
// - Note: Chicago Manual of Style (CMOS) paragraph numbers for custom sorting are not specified in this codebase.

import type { Project } from "../model";
import { bibliography, type CitationPart } from "./citations";
import { footnoteIdsInOrder } from "./noteForms";
import {
  sourceKinds,
  type DocumentSettings,
  type Source,
} from "./types";

export type BibliographyOrder = NonNullable<DocumentSettings["bibliographyOrder"]>;
export type BibliographyScope = NonNullable<DocumentSettings["bibliographyScope"]>;

export type BibliographyItem = {
  id: string;
  parts: CitationPart[];
  text: string;
  heading?: true;
};

export const SOURCE_KIND_HEADINGS: Record<Source["kind"], string> = {
  book: "Books",
  journal: "Journal articles",
  website: "Websites",
  chapter: "Book chapters",
  thesis: "Theses and dissertations",
  report: "Reports",
  conference: "Conference works",
  newspaper: "Newspaper articles",
  interview: "Interviews",
  media: "Media",
  other: "Other sources",
};

/**
 * Returns source IDs in order of the first footnote marker that cites them,
 * walking manuscript sections in project order.
 */
export function citedSourceOrder(
  project: Pick<Project, "order" | "entries" | "research">,
): string[] {
  const footnotes = project.research?.footnotes ?? [];
  const validSourceIds = new Set((project.research?.sources ?? []).map((s) => s.id));
  const seen = new Set<string>();
  const result: string[] = [];

  for (const fnId of footnoteIdsInOrder(project)) {
    const fn = footnotes.find((n) => n.id === fnId);
    if (fn?.sourceId && validSourceIds.has(fn.sourceId) && !seen.has(fn.sourceId)) {
      seen.add(fn.sourceId);
      result.push(fn.sourceId);
    }
  }

  return result;
}

/**
 * Produces unified bibliography items for page view and all exports.
 */
export function bibliographyItems(
  project: Pick<Project, "order" | "entries" | "research">,
  settings?: Pick<DocumentSettings, "bibliographyOrder" | "bibliographyScope">,
): BibliographyItem[] {
  const order: BibliographyOrder = settings?.bibliographyOrder ?? "author";
  const scope: BibliographyScope = settings?.bibliographyScope ?? "cited";

  const allSources = project.research?.sources ?? [];
  const sourceMap = new Map(allSources.map((s) => [s.id, s]));
  const citedIds = citedSourceOrder(project);
  const citedSet = new Set(citedIds);

  const formatSource = (s: Source): BibliographyItem => {
    const [item] = bibliography({
      ...(project.research ?? { sources: [], notes: [], footnotes: [] }),
      sources: [s],
    });
    return item;
  };

  const inScopeSources: Source[] =
    scope === "cited"
      ? citedIds.map((id) => sourceMap.get(id)!).filter(Boolean)
      : allSources;

  if (inScopeSources.length === 0) return [];

  if (order === "author") {
    return bibliography({
      ...(project.research ?? { sources: [], notes: [], footnotes: [] }),
      sources: inScopeSources,
    });
  }

  if (order === "cited") {
    const citedItems = citedIds
      .map((id) => sourceMap.get(id))
      .filter((s): s is Source => Boolean(s))
      .map(formatSource);

    if (scope === "cited") {
      return citedItems;
    }

    // scope === "all": uncited sources follow the cited ones in author order
    const uncitedSources = allSources.filter((s) => !citedSet.has(s.id));
    const uncitedItems = bibliography({
      ...(project.research ?? { sources: [], notes: [], footnotes: [] }),
      sources: uncitedSources,
    });
    return [...citedItems, ...uncitedItems];
  }

  if (order === "type") {
    const items: BibliographyItem[] = [];
    for (const kind of sourceKinds) {
      const ofKind = inScopeSources.filter((s) => s.kind === kind);
      if (ofKind.length === 0) continue;
      const headingText = SOURCE_KIND_HEADINGS[kind];
      items.push({
        id: "heading:" + kind,
        text: headingText,
        parts: [{ text: headingText }],
        heading: true,
      });
      const sortedOfKind = bibliography({
        ...(project.research ?? { sources: [], notes: [], footnotes: [] }),
        sources: ofKind,
      });
      items.push(...sortedOfKind);
    }
    return items;
  }

  return [];
}
