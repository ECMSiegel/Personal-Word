import type { SourceDraft } from "./lookup";
import type { Source } from "./types";
import { doiKey, isbnKey } from "./identifiers";

export type ExactMatchMethod = "doi" | "external-id" | "isbn-edition-type";
export type SourceReviewRow = { candidateIndex: number; candidate: SourceDraft };
export type ExactDuplicateRow = SourceReviewRow & {
  existingSourceIds: string[];
  matchedBy: ExactMatchMethod[];
};
export type PossibleMatchRow = SourceReviewRow & {
  matches: Array<{ existingSourceId: string; reasons: string[] }>;
};
export type SourceImportReview = {
  newSources: SourceReviewRow[];
  exactDuplicates: ExactDuplicateRow[];
  possibleMatches: PossibleMatchRow[];
  warnings: string[];
};

export const SOURCE_IMPORT_FIELDS = [
  "kind", "title", "shortTitle", "cslId", "edition", "authorsAndCreators", "container",
  "institution", "event", "publishedDate", "publisher", "year", "journal", "volume",
  "issue", "pages", "url", "doi", "accessed", "website", "isbn", "cslData",
] as const;
export type SourceImportField = (typeof SOURCE_IMPORT_FIELDS)[number];

const sourceImportFieldSet = new Set<string>(SOURCE_IMPORT_FIELDS);

export function mergeSourceFields(
  existing: Source,
  candidate: SourceDraft,
  selectedFields: readonly SourceImportField[] = [],
): Source {
  for (const field of selectedFields as readonly unknown[]) {
    if (typeof field !== "string" || !sourceImportFieldSet.has(field)) {
      throw new TypeError(`Unsupported source import field: ${String(field)}`);
    }
  }

  const merged: Source = { ...existing };
  const candidateValues = candidate as unknown as Record<string, unknown>;
  const mergedValues = merged as unknown as Record<string, unknown>;

  for (const field of new Set(selectedFields)) {
    if (field === "authorsAndCreators") {
      if (!Array.isArray(candidate.authors)) {
        throw new TypeError("Imported authors must be an array");
      }
      merged.authors = structuredClone(candidate.authors);
      if (candidate.creators !== undefined) merged.creators = structuredClone(candidate.creators);
      else delete merged.creators;
      continue;
    }

    if (!Object.hasOwn(candidateValues, field) || candidateValues[field] === undefined) continue;
    mergedValues[field] = structuredClone(candidateValues[field]);
  }

  return merged;
}

export function reviewSourceImport(
  candidates: SourceDraft[],
  existing: Source[],
): SourceImportReview {
  const newSources: SourceReviewRow[] = [];
  const exactDuplicates: ExactDuplicateRow[] = [];
  const possibleMatches: PossibleMatchRow[] = [];
  const warnings: string[] = [];

  candidates.forEach((candidate, candidateIndex) => {
    const exactIds = new Set<string>();
    const methods = new Set<ExactMatchMethod>();
    const suggestions: PossibleMatchRow["matches"] = [];

    for (const source of existing) {
      const candidateDoi = candidate.doi ? doiKey(candidate.doi) : null;
      const existingDoi = source.doi ? doiKey(source.doi) : null;
      const conflictingDoi = Boolean(candidateDoi && existingDoi && candidateDoi !== existingDoi);
      const sameDoi = Boolean(candidateDoi && existingDoi && candidateDoi === existingDoi);
      const candidateIsbn = candidate.isbn ? isbnKey(candidate.isbn) : null;
      const existingIsbn = source.isbn ? isbnKey(source.isbn) : null;
      const sameIsbn = Boolean(candidateIsbn && existingIsbn && candidateIsbn === existingIsbn);
      const sameVerifiedExternal = Boolean(
        verifiedExternalId(candidate.cslId) &&
        verifiedExternalId(candidate.cslId) === verifiedExternalId(source.cslId),
      );
      const sameUnverifiedId = Boolean(
        candidate.cslId?.trim() &&
        source.cslId?.trim() &&
        normalizeText(candidate.cslId) === normalizeText(source.cslId) &&
        !verifiedExternalId(candidate.cslId),
      );

      if (sameDoi) methods.add("doi");
      if (!conflictingDoi && sameVerifiedExternal) methods.add("external-id");
      const candidateEdition = normalizeText(candidate.edition ?? "");
      const existingEdition = normalizeText(source.edition ?? "");
      const sameIsbnEditionType = Boolean(
        !conflictingDoi && sameIsbn && candidate.kind === source.kind &&
        candidateEdition && existingEdition && candidateEdition === existingEdition,
      );
      if (sameIsbnEditionType) methods.add("isbn-edition-type");

      const reasons: string[] = [];
      const sameTitle = Boolean(normalizeText(candidate.title) && normalizeText(candidate.title) === normalizeText(source.title));
      const sameCreators = Boolean(creatorKey(candidate) && creatorKey(candidate) === creatorKey(source));
      const sameYear = Boolean(yearKey(candidate) && yearKey(candidate) === yearKey(source));
      const sameKind = candidate.kind === source.kind;

      if (sameTitle) reasons.push("title");
      if (sameCreators) reasons.push("creators");
      if (sameYear) reasons.push("year");
      if (sameKind) reasons.push("kind");
      if (sameIsbn) reasons.push("isbn");
      if (sameVerifiedExternal) reasons.push("external-id");
      if (sameUnverifiedId) reasons.push("unverified-csl-id");
      if (conflictingDoi && (sameTitle || sameIsbn || sameVerifiedExternal || sameUnverifiedId || (sameCreators && sameYear && sameKind))) {
        reasons.push("conflicting-doi");
        warnings.push(`The imported source “${candidate.title}” has a DOI that differs from “${source.title}”. Review both records before choosing.`);
      }

      const isExact = sameDoi || (!conflictingDoi && (sameVerifiedExternal || sameIsbnEditionType));
      if (isExact) exactIds.add(source.id);
      else if (sameTitle || (sameCreators && sameYear && sameKind) || sameIsbn || sameVerifiedExternal || sameUnverifiedId) {
        suggestions.push({ existingSourceId: source.id, reasons: [...new Set(reasons)] });
      }
    }

    if (exactIds.size) {
      exactDuplicates.push({
        candidateIndex,
        candidate,
        existingSourceIds: [...exactIds],
        matchedBy: (["doi", "external-id", "isbn-edition-type"] as const).filter((method) => methods.has(method)),
      });
    } else if (suggestions.length) {
      possibleMatches.push({ candidateIndex, candidate, matches: suggestions });
    } else {
      newSources.push({ candidateIndex, candidate });
    }
  });

  return { newSources, exactDuplicates, possibleMatches, warnings: [...new Set(warnings)] };
}

export function validateSourceMergeUpdates(
  sources: Source[],
  updates: Array<{ candidateIndex: number; existingSourceId: string; fields: string[] }>,
): void {
  const replacements = new Set<string>();
  for (const update of updates) {
    const targets = (sources || []).filter((s) => s.id === update.existingSourceId);
    if (targets.length !== 1) {
      throw new Error("This source identity is not unique. Nothing was updated.");
    }
    if (replacements.has(update.existingSourceId)) {
      throw new Error("Update an existing source from only one imported record at a time.");
    }
    if (!update.fields || !update.fields.length) {
      throw new Error("Choose the fields to update first.");
    }
    replacements.add(update.existingSourceId);
  }
}

const normalizeText = (value: string): string => value.normalize("NFKC").trim().replace(/\s+/g, " ").toLowerCase();

function verifiedExternalId(value: string | undefined): string | null {
  if (!value) return null;
  if (!/^https?:\/\/(?:www\.)?zotero\.org\/users\/\d+\/items\/[^/?#]+\/?$/i.test(value)) return null;
  try {
    const url = new URL(value);
    if ((url.protocol !== "http:" && url.protocol !== "https:") || url.username || url.password || url.port || url.search || url.hash) return null;
    if (url.hostname.toLowerCase() !== "zotero.org" && url.hostname.toLowerCase() !== "www.zotero.org") return null;
    const match = /^\/users\/(\d+)\/items\/([^/]+)\/?$/.exec(url.pathname);
    return match ? `zotero:${match[1]}:${match[2]}` : null;
  } catch {
    return null;
  }
}

function creatorKey(source: Pick<SourceDraft, "creators" | "authors"> | Pick<Source, "creators" | "authors">): string {
  const creators = (source.creators ?? []).flatMap((creator) => {
    const fields = [creator.role, creator.given, creator.family, creator.literal].map((field) => normalizeText(field ?? ""));
    return fields.slice(1).some(Boolean) ? [fields.join("\u001f")] : [];
  });
  const values = creators.length
    ? creators
    : source.authors.map((author) => `author\u001f${normalizeText(author)}`).filter((author) => author !== "author\u001f");
  return values.join("\u001e");
}

function yearKey(source: Pick<SourceDraft, "year" | "publishedDate"> | Pick<Source, "year" | "publishedDate">): string {
  const value = source.year?.trim() || source.publishedDate?.trim() || "";
  const year = /^(\d{4})/.exec(value)?.[1] ?? "";
  return year;
}
