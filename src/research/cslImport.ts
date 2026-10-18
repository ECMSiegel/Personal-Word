import type { Source } from "./types";
import type { SourceDraft } from "./lookup";

export type CslImportResult = {
  sources: SourceDraft[];
  skipped: Record<string, number>;
  duplicates: number;
  warnings: string[];
};

type CslItem = Record<string, unknown>;
const knownTypes: Record<string, Source["kind"]> = {
  book: "book",
  "article-journal": "journal",
  "article-magazine": "journal",
  "article-newspaper": "journal",
  webpage: "website",
  post: "website",
  "post-weblog": "website",
};
function increment(counter: Record<string, number>, key: string): void {
  const value = (Object.hasOwn(counter, key) ? counter[key] : 0) + 1;
  Object.defineProperty(counter, key, {
    value,
    enumerable: true,
    configurable: true,
    writable: true,
  });
}
const first = (value: unknown): unknown => Array.isArray(value) ? value[0] : value;
const string = (value: unknown): string | undefined =>
  typeof value === "string" || typeof value === "number" ? String(value) : undefined;
const authors = (value: unknown): string[] => {
  if (!Array.isArray(value)) return [];
  return value.flatMap((candidate) => {
    if (!candidate || typeof candidate !== "object") return [];
    const name = candidate as Record<string, unknown>;
    const given = string(name.given)?.trim();
    const family = string(name.family)?.trim();
    const literal = string(name.literal)?.trim();
    const full = given && family ? `${given} ${family}` : literal || family || given;
    return full ? [full] : [];
  });
};
const yearValue = (value: unknown): string | undefined => {
  if (!value || typeof value !== "object") return undefined;
  const date = value as Record<string, unknown>;
  const part = Array.isArray(date["date-parts"]) ? (date["date-parts"] as unknown[])[0] : undefined;
  const year = Array.isArray(part) ? string(part[0]) : string(date.raw) ?? string(date.literal);
  return year?.trim() || undefined;
};
const accessedValue = (value: unknown): string | undefined => {
  if (!value || typeof value !== "object") return undefined;
  const date = value as Record<string, unknown>;
  const part = Array.isArray(date["date-parts"]) ? (date["date-parts"] as unknown[])[0] : undefined;
  if (Array.isArray(part) && part.length >= 3) {
    const [year, month, day] = part.map((item) => string(item));
    if (year && month && day) return `${year.padStart(4, "0")}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
  }
  const raw = string(date.raw);
  return raw && /^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : undefined;
};
const normalizedDoi = (value?: string) => value?.trim().replace(/^(?:https?:\/\/(?:dx\.)?doi\.org\/|doi:\s*)/i, "").toLowerCase();
const surname = (names: string[]) => names[0]?.split(/\s+/).filter(Boolean).at(-1)?.toLocaleLowerCase() ?? "";
const normalizedTitle = (title: string) => title.trim().toLocaleLowerCase();

export function parseCslJson(text: string, existing: Source[]): CslImportResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error("This file is not a CSL JSON export from Zotero.");
  }
  const items = Array.isArray(parsed)
    ? parsed
    : parsed && typeof parsed === "object" && Array.isArray((parsed as { items?: unknown }).items)
      ? (parsed as { items: unknown[] }).items
      : null;
  if (!items) throw new Error("This file is not a CSL JSON export from Zotero.");

  const result: CslImportResult = { sources: [], skipped: {}, duplicates: 0, warnings: [] };
  const ids = new Set(existing.map((source) => source.cslId).filter((id): id is string => !!id));
  const dois = new Set(existing.map((source) => normalizedDoi(source.doi)).filter((doi): doi is string => !!doi));
  const titleAuthors = new Set(existing.map((source) => `${normalizedTitle(source.title)}\u0000${surname(source.authors)}`));
  for (const value of items) {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      increment(result.skipped, "invalid");
      result.warnings.push("A CSL item was skipped because it was not an object.");
      continue;
    }
    const item = value as CslItem;
    const type = string(item.type) ?? "unknown";
    const kind = Object.hasOwn(knownTypes, type) ? knownTypes[type] : undefined;
    if (!kind) {
      increment(result.skipped, type);
      continue;
    }
    const title = string(first(item.title))?.trim();
    if (!title) {
      increment(result.skipped, "invalid");
      result.warnings.push(`A ${type} item was skipped because it had no title.`);
      continue;
    }
    const itemAuthors = authors(item.author);
    const cslId = string(item.id);
    const doi = string(item.DOI);
    const doiKey = normalizedDoi(doi);
    const titleAuthorKey = `${normalizedTitle(title)}\u0000${surname(itemAuthors)}`;
    if ((cslId && ids.has(cslId)) || (doiKey && dois.has(doiKey)) || titleAuthors.has(titleAuthorKey)) {
      result.duplicates++;
      continue;
    }
    const draft: SourceDraft = {
      kind,
      title,
      authors: itemAuthors,
      lookupNote: "Imported from Zotero",
      ...(cslId ? { cslId } : {}),
      ...(string(first(item["title-short"])) ? { shortTitle: string(first(item["title-short"])) } : {}),
      ...(string(item.publisher) ? { publisher: string(item.publisher) } : {}),
      ...(yearValue(item.issued) ? { year: yearValue(item.issued) } : {}),
      ...(kind === "journal" && string(first(item["container-title"])) ? { journal: string(first(item["container-title"])) } : {}),
      ...(kind === "website" && string(first(item["container-title"])) ? { website: string(first(item["container-title"])) } : {}),
      ...(string(item.volume) ? { volume: string(item.volume) } : {}),
      ...(string(item.issue) ? { issue: string(item.issue) } : {}),
      ...(string(item.page) ? { pages: string(item.page) } : {}),
      ...(doi ? { doi } : {}),
      ...(string(item.ISBN)?.trim().split(/\s+/)[0] ? { isbn: string(item.ISBN)!.trim().split(/\s+/)[0] } : {}),
      ...(string(item.URL) ? { url: string(item.URL) } : {}),
      ...(accessedValue(item.accessed) ? { accessed: accessedValue(item.accessed) } : {}),
    };
    result.sources.push(draft);
    if (cslId) ids.add(cslId);
    if (doiKey) dois.add(doiKey);
    titleAuthors.add(titleAuthorKey);
  }
  return result;
}
