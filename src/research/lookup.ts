import { normalizeDoi, isValidIsbn } from "./identifiers";
export { normalizeDoi, isValidIsbn } from "./identifiers";
import { invoke } from "@tauri-apps/api/core";
import type { Source } from "./types";

export type SourceDraft = Omit<Source, "id">;
export type LookupResult = { source: SourceDraft; provider: string };
export type LookupIdentifier =
  | { kind: "doi"; doi: string }
  | { kind: "isbn"; isbn: string }
  | { kind: "url"; url: string };
export type FetchText = (url: string) => Promise<string>;
export type LookupOptions = { fetchText?: FetchText; today?: string };

export const lookupPrompt = "Enter a DOI, ISBN, or web address";
const browserBlocked = "This site can't be read from the browser preview";
const crossrefDown =
  "Couldn't reach Crossref -- check the connection and try again";
const openLibraryDown =
  "Couldn't reach Open Library -- check the connection and try again";
const accept = "text/html,application/json;q=0.9,*/*;q=0.5";

export class FetchFailure extends Error {
  status?: number;
  constructor(message: string, status?: number) {
    super(message);
    this.name = "FetchFailure";
    this.status = status;
  }
}

const pad = (n: number) => String(n).padStart(2, "0");

export const localIsoDate = (date: Date = new Date()) =>
  `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

export const isNativeApp = () =>
  typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

export function parseIdentifier(input: string): LookupIdentifier {
  const value = input.trim();
  if (!value) throw new Error(lookupPrompt);
  const doi = normalizeDoi(value);
  if (doi) return { kind: "doi", doi };
  const compact = value
    .replace(/^isbn[:\s]*/i, "")
    .replace(/[\s-]/g, "")
    .toUpperCase();
  if (/^\d{9}[\dX]$/.test(compact) || /^\d{13}$/.test(compact)) {
    if (!isValidIsbn(compact))
      throw new Error("That ISBN doesn't check out -- check the digits");
    return { kind: "isbn", isbn: compact };
  }
  try {
    const url = new URL(value);
    if (url.protocol === "http:" || url.protocol === "https:")
      return { kind: "url", url: url.href };
  } catch {
    // Not a web address; fall through to the prompt error.
  }
  throw new Error(lookupPrompt);
}

export async function fetchText(url: string): Promise<string> {
  if (isNativeApp()) {
    try {
      return await invoke<string>("lookup_fetch", { url });
    } catch (error) {
      const message = String(error);
      const status = /HTTP (\d{3})/.exec(message);
      throw new FetchFailure(message, status ? Number(status[1]) : undefined);
    }
  }
  let response: Response;
  try {
    response = await fetch(url, { headers: { Accept: accept } });
  } catch {
    throw new FetchFailure(browserBlocked);
  }
  if (!response.ok)
    throw new FetchFailure(
      `The site answered with HTTP ${response.status}`,
      response.status,
    );
  return response.text();
}

const named: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
  ndash: "–",
  mdash: "—",
  lsquo: "‘",
  rsquo: "’",
  ldquo: "“",
  rdquo: "”",
  hellip: "…",
};

export function decodeEntities(value: string): string {
  return value
    .replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (match, body: string) => {
      if (body[0] === "#") {
        const code =
          body[1] === "x" || body[1] === "X"
            ? parseInt(body.slice(2), 16)
            : parseInt(body.slice(1), 10);
        return Number.isFinite(code) && code > 0 && code <= 0x10ffff
          ? String.fromCodePoint(code)
          : match;
      }
      return named[body.toLowerCase()] ?? match;
    })
    .trim();
}

function makeDraft(
  base: Pick<SourceDraft, "kind" | "title" | "authors">,
  fields: Partial<SourceDraft>,
): SourceDraft {
  const present = Object.fromEntries(
    Object.entries(fields).filter(
      ([, value]) => typeof value === "string" && value.trim() !== "",
    ),
  );
  return { ...base, ...present } as SourceDraft;
}

type CrossrefDate = { "date-parts"?: (number | null)[][] };
type CrossrefWork = {
  type?: string;
  title?: string[];
  "container-title"?: string[];
  author?: { given?: string; family?: string; name?: string }[];
  volume?: string;
  issue?: string;
  page?: string;
  publisher?: string;
  DOI?: string;
  URL?: string;
  issued?: CrossrefDate;
  "published-print"?: CrossrefDate;
  "published-online"?: CrossrefDate;
  published?: CrossrefDate;
};

function crossrefDate(...dates: (CrossrefDate | undefined)[]) {
  for (const date of dates) {
    const [year, month, day] = date?.["date-parts"]?.[0] ?? [];
    if (typeof year !== "number") continue;
    if (typeof month === "number" && typeof day === "number")
      return `${year}-${pad(month)}-${pad(day)}`;
    return String(year);
  }
  return undefined;
}

export function mapCrossref(raw: unknown, doi: string): SourceDraft {
  const envelope = raw as { message?: CrossrefWork } | null;
  const work = envelope?.message ?? (envelope as CrossrefWork | null);
  if (!work || typeof work !== "object")
    throw new Error("No match found for that DOI");
  const container = work["container-title"]?.[0]?.trim() || undefined;
  const type = work.type ?? "";
  const kind: Source["kind"] =
    type === "journal-article"
      ? "journal"
      : /^(book|monograph|edited-book|reference-book)$/.test(type)
        ? "book"
        : container
          ? "journal"
          : "website";
  const date = crossrefDate(
    work.issued,
    work["published-print"],
    work["published-online"],
    work.published,
  );
  const authors = (work.author ?? [])
    .map((a) =>
      a.family || a.given
        ? [a.given, a.family].filter(Boolean).join(" ")
        : (a.name ?? "").trim(),
    )
    .filter(Boolean);
  const url = work.URL && !/doi\.org/i.test(work.URL) ? work.URL : undefined;
  return makeDraft(
    { kind, title: work.title?.[0]?.trim() ?? "", authors },
    {
      year: kind === "website" ? date : date?.slice(0, 4),
      publisher: work.publisher,
      journal: kind === "journal" ? container : undefined,
      website: kind === "website" ? work.publisher : undefined,
      volume: work.volume,
      issue: work.issue,
      pages: work.page?.replace(/\s*-+\s*/g, "–"),
      doi: work.DOI ?? doi,
      url,
    },
  );
}

type OpenLibraryBook = {
  title?: string;
  subtitle?: string;
  authors?: { name?: string }[];
  publishers?: { name?: string }[];
  publish_date?: string;
};

export function mapOpenLibrary(raw: unknown, isbn: string): SourceDraft {
  const book = (raw as Record<string, OpenLibraryBook | undefined> | null)?.[
    `ISBN:${isbn}`
  ];
  if (!book) throw new Error("No match found for that ISBN");
  return makeDraft(
    {
      kind: "book",
      title: [book.title, book.subtitle].filter(Boolean).join(": "),
      authors: (book.authors ?? [])
        .map((a) => (a.name ?? "").trim())
        .filter(Boolean),
    },
    {
      publisher: book.publishers?.[0]?.name,
      year: /\b(\d{4})\b/.exec(book.publish_date ?? "")?.[1],
      isbn,
    },
  );
}

const hostOf = (url: string) => {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
};

/** "Last, First" from citation tags becomes natural "First Last" order. */
const naturalName = (name: string) => {
  const parts = name.split(",").map((part) => part.trim());
  return parts.length === 2 && parts[0] && parts[1]
    ? `${parts[1]} ${parts[0]}`
    : name;
};

function attributesOf(tag: string) {
  const attributes: Record<string, string> = {};
  for (const match of tag.matchAll(
    /([^\s=/>"']+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+))/g,
  )) {
    attributes[match[1].toLowerCase()] = decodeEntities(
      match[2] ?? match[3] ?? match[4] ?? "",
    );
  }
  return attributes;
}

export function parseHtmlMetadata(html: string, url: string): SourceDraft {
  const meta = new Map<string, string[]>();
  for (const match of html.matchAll(/<meta\b[^>]*>/gi)) {
    const attributes = attributesOf(match[0]);
    const key = (attributes.name ?? attributes.property ?? "")
      .trim()
      .toLowerCase();
    const content = attributes.content?.trim();
    if (key && content) meta.set(key, [...(meta.get(key) ?? []), content]);
  }
  const one = (...keys: string[]) => {
    for (const key of keys) {
      const value = meta.get(key)?.[0];
      if (value) return value;
    }
    return undefined;
  };
  const tagTitle = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html)?.[1];
  const title =
    one("citation_title", "og:title", "twitter:title") ??
    (tagTitle ? decodeEntities(tagTitle) : "");
  const citationAuthors = meta.get("citation_author") ?? [];
  const plainAuthors = meta.get("author") ?? [];
  const articleAuthors = (meta.get("article:author") ?? []).filter(
    (name) => !/^https?:/i.test(name),
  );
  const authors = [
    ...new Set(
      (citationAuthors.length
        ? citationAuthors
        : plainAuthors.length
          ? plainAuthors
          : articleAuthors
      ).map(naturalName),
    ),
  ];
  const container = one("citation_journal_title");
  const dateText =
    one(
      "citation_publication_date",
      "citation_date",
      "article:published_time",
      "og:published_time",
      "dc.date",
      "date",
    ) ?? "";
  const iso = /(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/.exec(dateText);
  const fullDate = iso
    ? `${iso[1]}-${pad(Number(iso[2]))}-${pad(Number(iso[3]))}`
    : undefined;
  const year = /\b(\d{4})\b/.exec(dateText)?.[1];
  const firstPage = one("citation_firstpage");
  const lastPage = one("citation_lastpage");
  const doi = one("citation_doi");
  const host = hostOf(url);
  if (container) {
    return makeDraft(
      { kind: "journal", title, authors },
      {
        journal: container,
        volume: one("citation_volume"),
        issue: one("citation_issue"),
        pages: firstPage && lastPage ? `${firstPage}–${lastPage}` : firstPage,
        year,
        publisher: one("citation_publisher"),
        doi: doi ? (normalizeDoi(doi) ?? undefined) : undefined,
      },
    );
  }
  return makeDraft(
    { kind: "website", title, authors },
    {
      website: one("og:site_name", "citation_website") ?? host,
      year: fullDate ?? year,
      url,
      doi: doi ? (normalizeDoi(doi) ?? undefined) : undefined,
    },
  );
}

function finish(draft: SourceDraft, provider: string, today: string) {
  const source: SourceDraft = {
    ...draft,
    lookupNote: `Found on ${provider}`,
  };
  if (source.kind === "website") source.accessed = today;
  return { source, provider };
}

const encodePath = (doi: string) =>
  doi.split("/").map(encodeURIComponent).join("/");

async function lookupDoi(
  doi: string,
  get: FetchText,
  today: string,
): Promise<LookupResult> {
  let text: string;
  try {
    text = await get(`https://api.crossref.org/works/${encodePath(doi)}`);
  } catch (error) {
    if (error instanceof FetchFailure && error.status === 404)
      throw new Error("No match found for that DOI");
    throw new Error(crossrefDown);
  }
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error("Crossref sent a response that could not be read");
  }
  return finish(mapCrossref(json, doi), "Crossref", today);
}

async function lookupIsbn(
  isbn: string,
  get: FetchText,
  today: string,
): Promise<LookupResult> {
  let text: string;
  try {
    text = await get(
      `https://openlibrary.org/api/books?bibkeys=ISBN:${isbn}&format=json&jscmd=data`,
    );
  } catch {
    throw new Error(openLibraryDown);
  }
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error("Open Library sent a response that could not be read");
  }
  return finish(mapOpenLibrary(json, isbn), "Open Library", today);
}

async function lookupUrl(
  url: string,
  get: FetchText,
  today: string,
): Promise<LookupResult> {
  let html: string;
  try {
    html = await get(url);
  } catch (error) {
    const readable =
      error instanceof FetchFailure &&
      (isNativeApp() || error.status !== undefined);
    throw new Error(readable ? error.message : browserBlocked);
  }
  const draft = parseHtmlMetadata(html, url);
  if (draft.doi) {
    try {
      return await lookupDoi(draft.doi, get, today);
    } catch {
      // The page's own metadata is still a usable draft.
    }
  }
  return finish(draft, hostOf(url), today);
}

/** Looks up a DOI, ISBN, or web address. Returns a draft; the caller adds the id. */
export async function lookupIdentifier(
  input: string,
  options: LookupOptions = {},
): Promise<LookupResult> {
  const get = options.fetchText ?? fetchText;
  const today = options.today ?? localIsoDate();
  const identifier = parseIdentifier(input);
  if (identifier.kind === "doi") return lookupDoi(identifier.doi, get, today);
  if (identifier.kind === "isbn")
    return lookupIsbn(identifier.isbn, get, today);
  return lookupUrl(identifier.url, get, today);
}
