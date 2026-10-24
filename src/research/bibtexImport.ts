import { parseCslJson, type CslImportResult } from "./cslImport";
import { normalizeDoi } from "./identifiers";
import type { Source } from "./types";

/**
 * In-house BibTeX/BibLaTeX reader. It never evaluates TeX and never touches the network.
 * Each entry becomes a CSL-JSON-like item, and the existing CSL importer then builds the
 * source drafts and the duplicate review, so BibTeX and CSL imports behave identically.
 */
export const BIBTEX_MAX_CHARS = 5 * 1024 * 1024;
export const BIBTEX_MAX_ENTRIES = 5000;
export const BIBTEX_MAX_DEPTH = 50;
const MAX_VALUE_CHARS = 200_000;

/** Fatal for the whole file (a limit was hit); malformed single entries are only warnings. */
class FatalBibtexError extends Error {}
/** Thrown inside one entry; the entry is skipped and parsing resumes. */
class MalformedEntry extends Error {}

type RawEntry = { type: string; key: string; fields: Map<string, string> };

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const isSpace = (c: string | undefined) => c === " " || c === "\n" || c === "\t" || c === "\r" || c === "\f";

// ---------------------------------------------------------------- tokenizer / entry reader

class Reader {
  pos = 0;
  readonly macros = new Map<string, string>(MONTHS.map((m) => [m.slice(0, 3).toLowerCase(), m]));
  readonly entries: RawEntry[] = [];
  readonly warnings: string[] = [];
  malformed = 0;
  sawStructure = false;
  constructor(readonly s: string) {}

  skipWs() {
    while (isSpace(this.s[this.pos])) this.pos++;
  }

  /** pos is on "{"; returns the raw inside text (inner braces kept) and moves past the closing "}". */
  readBraced(): string {
    const s = this.s;
    const start = ++this.pos;
    let depth = 1;
    while (this.pos < s.length) {
      const c = s[this.pos];
      if (c === "\\") { this.pos += 2; continue; }
      if (c === "{") {
        if (++depth > BIBTEX_MAX_DEPTH) throw new FatalBibtexError(`BibTeX braces are nested more than ${BIBTEX_MAX_DEPTH} levels deep.`);
      } else if (c === "}" && --depth === 0) {
        const text = s.slice(start, this.pos);
        this.pos++;
        return text;
      }
      this.pos++;
    }
    throw new MalformedEntry("a brace was never closed");
  }

  readQuoted(): string {
    const s = this.s;
    const start = ++this.pos;
    let depth = 0;
    while (this.pos < s.length) {
      const c = s[this.pos];
      if (c === "\\" && (s[this.pos + 1] === "{" || s[this.pos + 1] === "}")) { this.pos += 2; continue; }
      if (c === "{") {
        if (++depth > BIBTEX_MAX_DEPTH) throw new FatalBibtexError(`BibTeX braces are nested more than ${BIBTEX_MAX_DEPTH} levels deep.`);
      } else if (c === "}") depth--;
      else if (c === '"' && depth <= 0) {
        const text = s.slice(start, this.pos);
        this.pos++;
        return text;
      }
      this.pos++;
    }
    throw new MalformedEntry("a quote was never closed");
  }

  /** A value: parts joined with "#". Macro names expand; unknown macros stay literal with a warning. */
  readValue(context: string): string {
    let out = "";
    for (;;) {
      this.skipWs();
      const c = this.s[this.pos];
      let part: string;
      if (c === "{") part = this.readBraced();
      else if (c === '"') part = this.readQuoted();
      else {
        const start = this.pos;
        while (this.pos < this.s.length && !isSpace(this.s[this.pos]) && !",#{}()=\"@".includes(this.s[this.pos])) this.pos++;
        const token = this.s.slice(start, this.pos);
        if (!token) throw new MalformedEntry("a field has no value");
        if (/^\d+$/.test(token)) part = token;
        else {
          const known = this.macros.get(token.toLowerCase());
          if (known === undefined) {
            this.warnings.push(`${context}: the macro “${token}” is not defined, so its name was kept as text.`);
            part = token;
          } else part = known;
        }
      }
      out += part;
      if (out.length > MAX_VALUE_CHARS) throw new MalformedEntry("a field value is too long");
      this.skipWs();
      if (this.s[this.pos] === "#") this.pos++;
      else return out;
    }
  }

  /** Move to the start of the next line that begins with "@" (error recovery). */
  resync(from: number) {
    const s = this.s;
    let i = s.indexOf("\n", from);
    while (i !== -1) {
      let j = i + 1;
      while (s[j] === " " || s[j] === "\t") j++;
      if (s[j] === "@") { this.pos = j; return; }
      i = s.indexOf("\n", i + 1);
    }
    this.pos = s.length;
  }

  readAll() {
    const s = this.s;
    for (;;) {
      const at = s.indexOf("@", this.pos);
      if (at === -1) return;
      this.pos = at + 1;
      this.skipWs();
      const typeStart = this.pos;
      while (this.pos < s.length && /[A-Za-z0-9_:-]/.test(s[this.pos])) this.pos++;
      const type = s.slice(typeStart, this.pos).toLowerCase();
      this.skipWs();
      const open = s[this.pos];
      if (!type || (open !== "{" && open !== "(")) continue; // stray "@" in free text
      const close = open === "{" ? "}" : ")";
      this.sawStructure = true;
      this.pos++;
      try {
        if (type === "comment" || type === "preamble") {
          this.pos--;
          if (open === "{") this.readBraced();
          else this.skipParen();
        } else if (type === "string") {
          this.skipWs();
          const nameStart = this.pos;
          while (this.pos < s.length && !isSpace(s[this.pos]) && s[this.pos] !== "=" && s[this.pos] !== close) this.pos++;
          const name = s.slice(nameStart, this.pos).toLowerCase();
          this.skipWs();
          if (!name || s[this.pos] !== "=") throw new MalformedEntry("@string needs name = value");
          this.pos++;
          this.macros.set(name, this.readValue(`@string ${name}`));
          this.skipWs();
          if (s[this.pos] !== close) throw new MalformedEntry("@string is not closed");
          this.pos++;
        } else this.readEntry(type, close);
      } catch (error) {
        if (error instanceof MalformedEntry) {
          this.malformed++;
          this.warnings.push(`Skipped @${type} near character ${at + 1}: ${error.message}.`);
          this.resync(at + 1);
        } else throw error;
      }
    }
  }

  skipParen() {
    const end = this.s.indexOf(")", this.pos);
    if (end === -1) throw new MalformedEntry("a parenthesis was never closed");
    this.pos = end + 1;
  }

  readEntry(type: string, close: string) {
    const s = this.s;
    if (this.entries.length >= BIBTEX_MAX_ENTRIES) {
      throw new FatalBibtexError(`This BibTeX file has more than ${BIBTEX_MAX_ENTRIES} entries. Split it into smaller files.`);
    }
    this.skipWs();
    const keyStart = this.pos;
    while (this.pos < s.length && !",{}()=\"".includes(s[this.pos])) this.pos++;
    const key = s.slice(keyStart, this.pos).trim();
    if (s[this.pos] === "=" || this.pos >= s.length) throw new MalformedEntry("the entry has no citation key");
    if (!key) throw new MalformedEntry("the entry has an empty citation key");
    const fields = new Map<string, string>();
    for (;;) {
      this.skipWs();
      const c = s[this.pos];
      if (c === close) { this.pos++; break; }
      if (c === ",") { this.pos++; continue; }
      if (c === undefined) throw new MalformedEntry(`@${type} “${key}” is not closed`);
      const nameStart = this.pos;
      while (this.pos < s.length && !isSpace(s[this.pos]) && !"=,{}()\"#".includes(s[this.pos])) this.pos++;
      const name = s.slice(nameStart, this.pos).toLowerCase();
      this.skipWs();
      if (!name || s[this.pos] !== "=") throw new MalformedEntry(`“${key}” has a field without “=”`);
      this.pos++;
      const value = this.readValue(`“${key}” field ${name}`);
      if (!fields.has(name)) fields.set(name, value);
      this.skipWs();
      if (s[this.pos] !== "," && s[this.pos] !== close) throw new MalformedEntry(`“${key}” has text after field ${name} that is not a comma`);
    }
    this.entries.push({ type, key, fields });
  }
}

// ---------------------------------------------------------------- LaTeX text

const MARKS: Record<string, string> = {
  "'": "́", "`": "̀", "^": "̂", '"': "̈", "~": "̃", "=": "̄", ".": "̇",
  u: "̆", v: "̌", H: "̋", c: "̧", k: "̨", r: "̊", d: "̣", b: "̱",
};
const SYMBOLS: Record<string, string> = {
  ss: "ß", ae: "æ", AE: "Æ", oe: "œ", OE: "Œ", o: "ø", O: "Ø", aa: "å", AA: "Å", l: "ł", L: "Ł",
  i: "i", j: "j", ldots: "…", textendash: "–", textemdash: "—", textquoteright: "’", textquoteleft: "‘",
};

/** Index of the "}" matching the "{" at `open`, or -1. */
function matchBrace(s: string, open: number): number {
  let depth = 0;
  for (let i = open; i < s.length; i++) {
    if (s[i] === "\\") i++;
    else if (s[i] === "{") depth++;
    else if (s[i] === "}" && --depth === 0) return i;
  }
  return -1;
}

/** Plain text from common LaTeX: accents, symbols, dashes, quotes; protective braces are dropped. */
export function texToText(input: string): string {
  const s = input;
  let out = "";
  let i = 0;
  const accent = (mark: string, at: number): number => {
    // `at` is where the accent's argument begins; returns the index after it.
    let arg: string;
    let next: number;
    if (s[at] === "{") {
      const end = matchBrace(s, at);
      if (end === -1) return at;
      arg = texToText(s.slice(at + 1, end));
      next = end + 1;
    } else if (s[at] === "\\" && /[ij]/.test(s[at + 1] ?? "") && !/[A-Za-z]/.test(s[at + 2] ?? "")) {
      arg = s[at + 1];
      next = at + 2;
    } else if (at < s.length) {
      arg = s[at];
      next = at + 1;
    } else return at;
    out += arg ? arg[0] + mark + arg.slice(1) : "";
    return next;
  };
  while (i < s.length) {
    const c = s[i];
    if (c === "\\") {
      const n = s[i + 1];
      if (n === undefined) { i++; continue; }
      if (/[A-Za-z]/.test(n)) {
        let j = i + 1;
        while (j < s.length && /[A-Za-z]/.test(s[j])) j++;
        const name = s.slice(i + 1, j);
        while (isSpace(s[j])) j++;
        if (Object.hasOwn(MARKS, name) && name.length === 1) i = accent(MARKS[name], j);
        else {
          if (Object.hasOwn(SYMBOLS, name)) out += SYMBOLS[name];
          i = j;
        }
      } else if (Object.hasOwn(MARKS, n)) {
        i = accent(MARKS[n], i + 2);
      } else if ("&%$#_{}".includes(n)) { out += n; i += 2; }
      else if (n === "\\" || n === "," || n === " " || n === ";") { out += " "; i += 2; }
      else { out += n; i += 2; }
    } else if (c === "{" || c === "}") i++;
    else if (c === "-") {
      let j = i;
      while (s[j] === "-") j++;
      const run = j - i;
      out += run === 2 ? "–" : run === 3 ? "—" : "-".repeat(run);
      i = j;
    } else if (c === "~") { out += " "; i++; }
    else if (c === "`" && s[i + 1] === "`") { out += "“"; i += 2; }
    else if (c === "'" && s[i + 1] === "'") { out += "”"; i += 2; }
    else { out += c; i++; }
  }
  return out.normalize("NFC").replace(/\s+/g, " ").trim();
}

const cleanUrl = (value: string) =>
  value.replace(/^\s*\\url\s*\{([\s\S]*)\}\s*$/, "$1").replace(/\\([_%&#$~{}])/g, "$1").replace(/\s+/g, "").trim();

// ---------------------------------------------------------------- names

type CslName = { family?: string; given?: string; literal?: string; suffix?: string };

/** Split on depth-0 whitespace, keeping braced groups whole. */
function words(s: string): string[] {
  const result: string[] = [];
  let depth = 0;
  let start = -1;
  for (let i = 0; i <= s.length; i++) {
    const c = s[i];
    if (c === "\\") { if (start < 0) start = i; i++; continue; }
    const space = c === undefined || (depth === 0 && isSpace(c));
    if (space) {
      if (start >= 0) { result.push(s.slice(start, i)); start = -1; }
      continue;
    }
    if (start < 0) start = i;
    if (c === "{") depth++;
    else if (c === "}") depth = Math.max(0, depth - 1);
  }
  return result;
}

function splitTopLevel(s: string, separator: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (c === "\\") i++;
    else if (c === "{") depth++;
    else if (c === "}") depth = Math.max(0, depth - 1);
    else if (c === separator && depth === 0) { parts.push(s.slice(start, i)); start = i + 1; }
  }
  parts.push(s.slice(start));
  return parts.map((part) => part.trim());
}

const isLowerWord = (word: string) => {
  const c = word[0];
  return !!c && c !== "{" && c !== "\\" && c === c.toLowerCase() && c !== c.toUpperCase();
};

function parseName(raw: string): CslName | null {
  const text = words(raw).join(" ");
  if (!text) return null;
  if (text.startsWith("{") && matchBrace(text, 0) === text.length - 1) {
    const literal = texToText(text);
    return literal ? { literal } : null;
  }
  const parts = splitTopLevel(text, ",");
  const decode = (value: string) => texToText(value);
  if (parts.length === 1) {
    const tokens = words(text);
    if (tokens.length === 1) return { family: decode(tokens[0]) };
    const last = tokens.length - 1;
    let vonStart = -1;
    for (let i = 0; i < last; i++) {
      if (isLowerWord(tokens[i])) { vonStart = i; break; }
    }
    if (vonStart < 0) return { given: decode(tokens.slice(0, last).join(" ")), family: decode(tokens[last]) };
    return { given: decode(tokens.slice(0, vonStart).join(" ")), family: decode(tokens.slice(vonStart).join(" ")) };
  }
  const family = decode(parts[0]);
  const given = decode(parts.slice(parts.length >= 3 ? 2 : 1).join(", "));
  const suffix = parts.length >= 3 ? decode(parts[1]) : "";
  const name: CslName = {};
  if (family) name.family = family;
  if (given) name.given = given;
  if (suffix) name.suffix = suffix;
  return family || given ? name : null;
}

/** Returns names and whether the list ended with "and others". */
function parseNames(raw: string): { names: CslName[]; etAl: boolean } {
  const groups: string[][] = [[]];
  for (const word of words(raw)) {
    if (word.toLowerCase() === "and") groups.push([]);
    else groups[groups.length - 1].push(word);
  }
  const names: CslName[] = [];
  let etAl = false;
  for (const group of groups) {
    const text = group.join(" ");
    if (text.toLowerCase() === "others") { etAl = true; continue; }
    const name = parseName(text);
    if (name) names.push(name);
  }
  return { names, etAl };
}

// ---------------------------------------------------------------- entries -> CSL items

const TYPE_MAP: Record<string, string> = {
  article: "article-journal",
  book: "book",
  incollection: "chapter",
  inbook: "chapter",
  phdthesis: "thesis",
  mastersthesis: "thesis",
  techreport: "report",
  inproceedings: "paper-conference",
  online: "webpage",
};

function monthNumber(raw: string): number | undefined {
  const t = texToText(raw).toLowerCase();
  if (/^\d{1,2}$/.test(t)) { const n = Number(t); return n >= 1 && n <= 12 ? n : undefined; }
  const index = MONTHS.findIndex((m) => t.startsWith(m.slice(0, 3).toLowerCase()));
  return index === -1 ? undefined : index + 1;
}

type Crossref = Map<string, RawEntry>;

function buildItem(entry: RawEntry, byKey: Crossref, warnings: string[]): Record<string, unknown> | null {
  const fields = new Map(entry.fields);
  const parentKey = fields.get("crossref")?.trim();
  const parent = parentKey ? byKey.get(parentKey) : undefined;
  if (parent && parent !== entry) {
    for (const [name, value] of parent.fields) if (!fields.has(name) && name !== "title") fields.set(name, value);
    const parentTitle = parent.fields.get("title");
    if (parentTitle && !fields.has("booktitle")) fields.set("booktitle", parentTitle);
  }
  const text = (...names: string[]): string | undefined => {
    for (const name of names) {
      const value = fields.get(name);
      if (value !== undefined) { const t = texToText(value); if (t) return t; }
    }
    return undefined;
  };
  const title = text("title");
  if (!title) {
    warnings.push(`Skipped @${entry.type} “${entry.key}”: it has no title.`);
    return null;
  }
  const hasUrl = !!text("url");
  let type: string;
  if (Object.hasOwn(TYPE_MAP, entry.type)) type = TYPE_MAP[entry.type];
  else if (entry.type === "misc") type = hasUrl ? "webpage" : "document";
  else {
    type = "document";
    warnings.push(`@${entry.type} “${entry.key}” is not a supported entry type, so it is kept as a generic record. Add manual citation text before citing.`);
  }

  const item: Record<string, unknown> = { id: entry.key, type, title };
  let etAl = false;
  for (const [field, role] of [["author", "author"], ["editor", "editor"], ["translator", "translator"]] as const) {
    const value = fields.get(field);
    if (value === undefined) continue;
    const parsed = parseNames(value);
    if (parsed.names.length) item[role] = parsed.names;
    if (parsed.etAl) {
      etAl = true;
      warnings.push(`“${title}” lists “and others” as ${role}s; only the named ones were imported. Add the rest by hand if you need them.`);
    }
  }
  const container = text("journaltitle", "journal", "booktitle");
  if (container) item["container-title"] = container;
  else if (type === "webpage") { const site = text("organization", "website"); if (site) item["container-title"] = site; }
  const institution = text("school", "institution", "organization");
  if (institution && type !== "webpage") item.institution = institution;
  const publisher = text("publisher") ?? (type === "thesis" || type === "report" ? institution : undefined);
  if (publisher) item.publisher = publisher;
  const place = text("address", "location");
  if (place) item["publisher-place"] = place;
  const volume = text("volume"); if (volume) item.volume = volume;
  const issue = text("number", "issue"); if (issue) item.issue = issue;
  const pages = text("pages"); if (pages) item.page = pages;
  const edition = text("edition"); if (edition) item.edition = edition;
  const note = text("note"); if (note) item.note = note;
  const isbn = text("isbn"); if (isbn) item.ISBN = isbn;
  const eventTitle = text("eventtitle"); if (eventTitle) item["event-title"] = eventTitle;
  const url = fields.get("url") !== undefined ? cleanUrl(fields.get("url")!) : "";
  if (url) item.URL = url;
  const rawDoi = fields.get("doi");
  if (rawDoi !== undefined) {
    const doi = normalizeDoi(cleanUrl(rawDoi));
    if (doi) item.DOI = doi;
    else warnings.push(`“${title}” has a DOI that does not look valid (${texToText(rawDoi)}); it was kept only in the raw fields.`);
  }
  if (entry.type === "phdthesis") item.genre = "PhD thesis";
  else if (entry.type === "mastersthesis") item.genre = "Master's thesis";

  const date = text("date");
  const dateMatch = date ? /^(\d{4})(?:-(\d{1,2}))?(?:-(\d{1,2}))?/.exec(date) : null;
  const year = text("year");
  if (dateMatch) {
    item.issued = { "date-parts": [dateMatch.slice(1).filter(Boolean).map(Number)] };
  } else if (year) {
    const month = fields.get("month") !== undefined ? monthNumber(fields.get("month")!) : undefined;
    item.issued = /^\d{1,4}$/.test(year) ? { "date-parts": [month ? [Number(year), month] : [Number(year)]] } : { raw: year };
  }
  const accessed = text("urldate");
  const accessedMatch = accessed ? /^(\d{4})-(\d{2})-(\d{2})/.exec(accessed) : null;
  if (accessedMatch) item.accessed = { "date-parts": [accessedMatch.slice(1).map(Number)] };

  // Everything the file said, unmodified (macros expanded), so nothing is lost.
  item.bibtex = { key: entry.key, type: entry.type, fields: Object.fromEntries(fields), ...(etAl ? { etAl: true } : {}) };
  return item;
}

/** Parse BibTeX/BibLaTeX text into the same review result a CSL JSON import produces. */
export function parseBibtex(text: string, existing: Source[] = []): CslImportResult {
  if (text.length > BIBTEX_MAX_CHARS) throw new Error("This BibTeX file is larger than 5 MB. Split it into smaller files.");
  const reader = new Reader(text.charCodeAt(0) === 0xfeff ? text.slice(1) : text);
  try {
    reader.readAll();
  } catch (error) {
    if (error instanceof FatalBibtexError) throw new Error(error.message);
    throw error;
  }
  if (!reader.sawStructure) throw new Error("This file does not contain any BibTeX entries.");

  const warnings = [...reader.warnings];
  const byKey: Crossref = new Map();
  const seen = new Set<string>();
  for (const entry of reader.entries) {
    if (seen.has(entry.key)) warnings.push(`The citation key “${entry.key}” appears more than once; both entries were imported.`);
    seen.add(entry.key);
    if (!byKey.has(entry.key)) byKey.set(entry.key, entry);
  }
  const items: Record<string, unknown>[] = [];
  let untitled = 0;
  for (const entry of reader.entries) {
    const before = warnings.length;
    const item = buildItem(entry, byKey, warnings);
    if (item) items.push(item);
    else if (warnings.length > before) untitled++;
  }
  const result = parseCslJson(JSON.stringify(items), existing);
  for (const source of result.sources) source.lookupNote = "Imported from BibTeX";
  const invalid = (result.skipped.invalid ?? 0) + reader.malformed + untitled;
  if (invalid) result.skipped.invalid = invalid;
  result.warnings = [...warnings, ...result.warnings];
  return result;
}
