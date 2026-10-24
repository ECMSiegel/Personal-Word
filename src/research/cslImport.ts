import { reviewSourceImport, type SourceImportReview } from "./sourceMerge";
import type { SourceCreator } from "./types";
import type { Source } from "./types";
import type { SourceDraft } from "./lookup";

export type CslImportResult = {
  sources: SourceDraft[];
  existingSources: Source[];
  review: SourceImportReview;
  skipped: Record<string, number>;
  duplicates: number;
  warnings: string[];
};

type CslItem = Record<string, unknown>;
const knownTypes: Record<string, Source["kind"]> = {
  book: "book",
  "article-journal": "journal",
  "article-magazine": "journal",
  "article-newspaper": "newspaper",
  chapter: "chapter", thesis: "thesis", report: "report", paper: "conference",
  "paper-conference": "conference", interview: "interview", broadcast: "media",
  motion_picture: "media", song: "media", speech: "media",
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
const creators = (item: CslItem): SourceCreator[] =>
  ["author", "editor", "translator", "interviewer", "director", "composer"].flatMap((role) => {
    const entries = item[role];
    if (!Array.isArray(entries)) return [];
    return entries.flatMap((entry) => {
      if (!entry || typeof entry !== "object" || Array.isArray(entry)) return [];
      const person = entry as Record<string, unknown>;
      const fields = Object.fromEntries(["given", "family", "literal"].flatMap((key) => {
        const value = string(person[key]);
        return value ? [[key, value]] : [];
      }));
      return Object.keys(fields).length ? [{ role, ...fields }] : [];
    });
  });

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

  const sources: SourceDraft[] = [];
  const skipped: Record<string, number> = {};
  const warnings: string[] = [];
  for (const value of items) {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      increment(skipped, "invalid");
      warnings.push("A CSL item was skipped because it was not an object.");
      continue;
    }
    const item = value as CslItem;
    const type = string(item.type) ?? "unknown";
    const kind = Object.hasOwn(knownTypes, type) ? knownTypes[type] : "other";
    if (kind === "other") warnings.push(`“${string(first(item.title)) ?? type}” uses ${type}; raw fields are retained. Add manual citation text before citing.`);
    const title = string(first(item.title))?.trim();
    if (!title) {
      increment(skipped, "invalid");
      warnings.push(`A ${type} item was skipped because it had no title.`);
      continue;
    }
    const itemAuthors = authors(item.author);
    const cslId = string(item.id);
    const doi = string(item.DOI);
    const draft: SourceDraft = {
      kind,
      title,
      cslData: item,
      creators: creators(item),
      ...(string(item.edition) ? { edition: string(item.edition) } : {}),
      ...(string(first(item["container-title"])) ? { container: string(first(item["container-title"])) } : {}),
      ...(string(item.institution) ? { institution: string(item.institution) } : {}),
      ...(string(item["event-title"]) ? { event: string(item["event-title"]) } : {}),
      ...(accessedValue(item.issued) ? { publishedDate: accessedValue(item.issued) } : {}),
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
    sources.push(draft);
  }
  const review = reviewSourceImport(sources, existing);
  return { sources, existingSources: existing, skipped, duplicates: review.exactDuplicates.length, warnings: [...warnings, ...review.warnings], review };
}
