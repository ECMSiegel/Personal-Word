import { normalizeDoi } from "./identifiers";
import type { Footnote, ResearchData, ResolvedNoteForm, Source, SourceCreator } from "./types";
export type CitationPart = { text: string; italic?: boolean };
const naturalName = (creator: SourceCreator) =>
  creator.literal || [[creator.given, creator.family].filter(Boolean).join(" "), creator.suffix].filter(Boolean).join(" ");
const invertedName = (creator: SourceCreator) =>
  creator.literal || [[creator.family, creator.given].filter(Boolean).join(", "), creator.suffix].filter(Boolean).join(", ");
const surname = (name: string) => name.trim().split(/\s+/).at(-1) ?? name;
const inverted = (name: string) => {
  const parts = name.trim().split(/\s+/);
  return parts.length < 2 ? name : `${parts.pop()}, ${parts.join(" ")}`;
};
function authors(s: Source, bib = false, short = false): string {
  const structured = s.creators?.filter((creator) => creator.role === "author");
  const a = structured?.length
    ? structured.map(naturalName)
    : s.authors.filter(Boolean);
  const shortName = (index: number) => structured?.[index]
    ? structured[index].literal || structured[index].family || structured[index].given || ""
    : surname(a[index]);
  const firstInverted = structured?.[0]
    ? invertedName(structured[0])
    : inverted(a[0] ?? "");
  if (!a.length) return "";
  if (short)
    return (
      shortName(0) +
      (a.length > 2 ? " et al." : a.length === 2 ? ` and ${shortName(1)}` : "")
    );
  if (!bib && a.length > 2) return a[0] + " et al.";
  const names = bib ? [firstInverted, ...a.slice(1, a.length > 6 ? 3 : 6)] : a;
  return (
    names
      .join(names.length === 2 ? " and " : ", ")
      .replace(/, ([^,]+)$/, names.length > 2 ? ", and $1" : ", $1") +
    (bib && a.length > 6 ? ", et al." : "")
  );
}
const endPeriod = (text: string) => (text.endsWith(".") ? text : text + ".");
const namesForRole = (s: Source, role: string) => (s.creators ?? [])
  .filter((creator) => creator.role === role)
  .map((creator) => naturalName(creator).trim())
  .filter(Boolean);
const joinNames = (names: string[]) => names.length < 2
  ? names[0] ?? ""
  : names.length === 2
    ? `${names[0]} and ${names[1]}`
    : `${names.slice(0, -1).join(", ")}, and ${names.at(-1)}`;
const quotedChapterTitle = (title: string, ending: "," | ".") => {
  const clean = title.replace(/\.$/, "");
  return `“${clean}${/[?!]$/.test(clean) ? "" : ending}”`;
};
const chapterCitationParts = (
  s: Source,
  mode: "full" | "short" | "bibliography",
  locator: string,
): CitationPart[] | null => {
  const editors = namesForRole(s, "editor");
  const container = s.container?.trim();
  const publisher = s.publisher?.trim();
  const year = s.year?.trim();
  const author = authors(s, mode === "bibliography", mode === "short");
  // This automatic formatter intentionally covers the reviewed, print edited-book example only.
  if (!author || !editors.length || !container || !publisher || !year || s.doi || s.url || s.edition?.trim()) return null;
  const title = mode === "short" ? shortTitle(s).trim() || s.title : s.title;
  if (mode === "short") {
    return [
      { text: `${author}, ` },
      { text: quotedChapterTitle(title, locator ? "," : ".") },
      ...(locator ? [{ text: ` ${locator}.` }] : []),
    ];
  }
  if (mode === "bibliography") {
    return [
      { text: `${author}. ` },
      { text: quotedChapterTitle(title, ".") },
      { text: " In " },
      { text: container, italic: true },
      { text: `, edited by ${joinNames(editors)}. ${publisher}, ${year}.` },
    ];
  }
  return [
    { text: `${author}, ` },
    { text: quotedChapterTitle(title, ",") },
    { text: " in " },
    { text: container, italic: true },
    { text: `, ed. ${joinNames(editors)} (${publisher}, ${year})${locator ? `, ${locator}` : ""}.` },
  ];
};
const manualPlaceholders = new WeakSet<CitationPart[]>();
const manualRequired = (s: Source, mode: "full" | "short" | "bibliography"): CitationPart[] => {
  const parts = [
    { text: `[Manual ${mode === "bibliography" ? "bibliography entry" : mode === "short" ? "short note" : "note"} required: ${s.title || "Untitled source"}]` },
  ];
  manualPlaceholders.add(parts);
  return parts;
};
/** True when the source's note form is still the manual-required placeholder. */
export const needsManualNote = (s: Source, mode: "full" | "short", locator = "") =>
  manualPlaceholders.has(citationParts(s, mode, locator));
const raw = (s: Source): Record<string, unknown> => s.cslData ?? {};
const rawText = (s: Source, key: string): string => {
  const value = raw(s)[key];
  return typeof value === "string" ? value.trim() : "";
};
const oneStructuredAuthor = (s: Source) => {
  const found = s.creators?.filter((creator) => creator.role === "author") ?? [];
  if (found.length !== 1) return "";
  const person = found[0];
  return person.literal?.trim() || [[person.given?.trim(), person.family?.trim()].filter(Boolean).join(" "), person.suffix?.trim()].filter(Boolean).join(" ");
};
const validHttpUrl = (value: string | undefined) => {
  if (!value?.trim()) return false;
  try {
    const parsed = new URL(value.trim());
    return (parsed.protocol === "http:" || parsed.protocol === "https:") && !parsed.username && !parsed.password;
  } catch {
    return false;
  }
};
const validIsoDate = (value: string | undefined) => {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value.trim())) return false;
  const [year, month, day] = value.trim().split("-").map(Number);
  const check = new Date(Date.UTC(year, month - 1, day));
  return check.getUTCFullYear() === year && check.getUTCMonth() === month - 1 && check.getUTCDate() === day;
};
const rawMonthYear = (value: unknown) => {
  if (typeof value === "string") {
    const match = /^(January|February|March|April|May|June|July|August|September|October|November|December) (\d{4})$/.exec(value.trim());
    return match ? `${match[1]} ${match[2]}` : "";
  }
  if (!value || typeof value !== "object" || !Array.isArray((value as { "date-parts"?: unknown })["date-parts"])) return "";
  const parts = (value as { "date-parts": unknown[] })["date-parts"];
  if (parts.length !== 1 || !Array.isArray(parts[0]) || parts[0].length !== 2) return "";
  const [year, month] = parts[0];
  if (!Number.isInteger(year) || Number(year) < 1 || Number(year) > 9999 || !Number.isInteger(month) || Number(month) < 1 || Number(month) > 12) return "";
  return `${monthNames[Number(month) - 1]} ${year}`;
};
const quote = (title: string, ending: "," | "." | "") => {
  const clean = title.trim().replace(/[.,]+$/, "");
  return `“${clean}${/[?!]$/.test(clean) ? "" : ending}”`;
};
const qualifiedSourceCitation = (
  s: Source,
  mode: "full" | "short" | "bibliography",
  locator: string,
): CitationPart[] | null => {
  const csl = raw(s);
  const author = oneStructuredAuthor(s);
  const title = s.title.trim();
  const short = s.shortTitle?.trim() ?? "";
  const bib = mode === "bibliography";
  if (!author || !title || !short) return null;

  if (s.kind === "thesis") {
    const archive = rawText(s, "archive");
    const number = rawText(s, "archive_location");
    const year = s.year?.trim() ?? "";
    const institution = s.institution?.trim() ?? "";
    if (csl.type !== "thesis" || rawText(s, "genre") !== "PhD diss." || archive !== "ProQuest" || !number || !/^\d{4}$/.test(year) || !institution || s.doi || s.url) return null;
    const displayName = bib ? authors(s, true, false) : mode === "short" ? authors(s, false, true) : author;
    if (!displayName) return null;
    return [{ text: bib
      ? `${endPeriod(displayName)} ${quote(title, ".")} PhD diss., ${institution}, ${year}. ProQuest (${number}).`
      : mode === "short"
        ? `${displayName}, ${quote(short, locator ? "," : ".")}${locator ? ` ${locator}.` : ""}`
        : `${displayName}, ${quote(title, "")} (PhD diss., ${institution}, ${year}),${locator ? ` ${locator},` : ""} ProQuest (${number}).` }];
  }

  if (s.kind === "newspaper") {
    const container = s.container?.trim() ?? "";
    const date = s.publishedDate?.trim() ?? "";
    if (csl.type !== "article-newspaper" || !container || !validIsoDate(date) || !validHttpUrl(s.url) || s.doi) return null;
    const displayName = bib ? authors(s, true, false) : mode === "short" ? authors(s, false, true) : author;
    if (!displayName) return null;
    const formattedDate = chicagoDate(date);
    if (bib) return [
      { text: `${endPeriod(displayName)} ${quote(title, ".")} ` },
      { text: container, italic: true },
      { text: `, ${formattedDate}. ${s.url!.trim()}.` },
    ];
    if (mode === "short") return [{ text: `${displayName}, ${quote(short, locator ? "," : ".")}${locator ? ` ${locator}.` : ""}` }];
    return [
      { text: `${displayName}, ${quote(title, ",")} ` },
      { text: container, italic: true },
      { text: `, ${formattedDate}${locator.trim() ? `, ${locator.trim()}` : ""}, ${s.url!.trim()}.` },
    ];
  }

  if (s.kind === "interview") {
    const container = s.container?.trim() ?? "";
    const publisher = s.publisher?.trim() ?? "";
    const date = s.publishedDate?.trim() ?? "";
    const interviewers = namesForRole(s, "interviewer");
    const duration = rawText(s, "dimensions");
    if (csl.type !== "interview" || rawText(s, "medium") !== "audio" || !/^\d{1,2}:[0-5]\d$/.test(duration) || interviewers.length !== 1 || !container || !publisher || !validIsoDate(date) || !validHttpUrl(s.url) || s.doi || (mode === "full" && locator.trim())) return null;
    const displayName = bib ? authors(s, true, false) : mode === "short" ? authors(s, false, true) : author;
    if (!displayName) return null;
    const formattedDate = chicagoDate(date);
    if (bib) return [
      { text: `${endPeriod(displayName)} ${quote(title, ".")} Interview by ${interviewers[0]}. ` },
      { text: container, italic: true },
      { text: `, ${publisher}, ${formattedDate}. Audio, ${duration}. ${s.url!.trim()}.` },
    ];
    if (mode === "short") return [{ text: `${displayName}, interview${locator ? `, ${locator}` : ""}.` }];
    return [
      { text: `${displayName}, ${quote(title, ",")} interview by ${interviewers[0]}, ` },
      { text: container, italic: true },
      { text: `, ${publisher}, ${formattedDate}, audio, ${duration}, ${s.url!.trim()}.` },
    ];
  }

  if (s.kind === "media") {
    const eventPlace = rawText(s, "event-place");
    const eventDate = rawMonthYear(csl["event-date"]);
    const genre = rawText(s, "genre");
    const event = s.event?.trim() || genre;
    const duration = rawText(s, "dimensions");
    if (csl.type !== "speech" || genre !== "TED Talk" || rawText(s, "medium") !== "video" || !/^[1-9]\d* min\., (?:[0-5]?\d) sec\.$/.test(duration) || !eventPlace || !eventDate || !validHttpUrl(s.url) || s.doi || (mode === "full" && locator.trim())) return null;
    const displayName = bib ? authors(s, true, false) : mode === "short" ? authors(s, false, true) : author;
    if (!displayName) return null;
    return [{ text: bib
      ? `${endPeriod(displayName)} ${quote(title, ".")} ${event}, ${eventPlace}, ${eventDate}. Video, ${duration} ${s.url!.trim()}.`
      : mode === "short"
        ? `${displayName}, ${quote(short, locator ? "," : ".")}${locator ? ` ${locator}.` : ""}`
        : `${displayName}, ${quote(title, ",")} ${event}, ${eventPlace}, ${eventDate}, ${duration}, ${s.url!.trim()}.` }];
  }
  return null;
};
const end = (v: string) => v.replace(/[.,\s]+$/, "") + ".";
const monthNames = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];
/** Chicago writes full dates as "March 4, 2025"; stored dates stay yyyy-mm-dd. */
const chicagoDate = (value: string) => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  const month = match ? monthNames[Number(match[2]) - 1] : undefined;
  return match && month ? `${month} ${Number(match[3])}, ${match[1]}` : value;
};
const link = (s: Source) =>
  s.doi
    ? `https://doi.org/${normalizeDoi(s.doi) ?? s.doi.replace(/^https?:\/\/doi.org\//, "")}`
    : (s.url ?? "");
export function citationParts(
  s: Source,
  mode: "full" | "short" | "bibliography" = "full",
  locator = "",
): CitationPart[] {
  const manual = mode === "bibliography" ? s.manualBibliography : mode === "short" ? s.manualShort : s.manualFull;
  if (manual?.trim()) return [{ text: manual }];
  if (["thesis", "newspaper", "interview", "media"].includes(s.kind))
    return qualifiedSourceCitation(s, mode, locator) ?? manualRequired(s, mode);
  if (!["book", "journal", "website", "chapter"].includes(s.kind))
    return manualRequired(s, mode);
  if (s.kind === "chapter")
    return chapterCitationParts(s, mode, locator) ?? manualRequired(s, mode);
  const bib = mode === "bibliography",
    short = mode === "short";
  const a = authors(s, bib, short);
  const parts: CitationPart[] = [];
  if (a) parts.push({ text: bib ? endPeriod(a) + " " : a + ", " });
  const title = s.title || "[Untitled source]";
  const noteTitle = short ? shortTitle(s) || title : title;
  parts.push({
    text: s.kind === "book" ? noteTitle : `“${(short ? noteTitle : title).replace(/[.]$/, "")}”`,
    italic: s.kind === "book",
  });
  if (short) {
    if (s.kind !== "book")
      parts[parts.length - 1].text = parts[parts.length - 1].text.replace(
        /”$/,
        (locator ? "," : /[?!]$/.test(noteTitle) ? "" : ".") + "”",
      );
    parts.push({
      text: locator
        ? `${s.kind === "book" ? ", " : " "}${locator}.`
        : s.kind === "book"
          ? /[?!]$/.test(noteTitle)
            ? ""
            : "."
          : "",
    });
    return parts;
  }
  if (s.kind === "book")
    parts.push({
      text: bib
        ? `. ${[s.publisher, s.year].filter(Boolean).join(", ")}`
        : ` (${[s.publisher, s.year].filter(Boolean).join(", ")})`,
    });
  if (s.kind === "journal") {
    parts.push({ text: bib ? ". " : ", " });
    parts.push({ text: s.journal ?? "", italic: true });
    parts.push({
      text: `${s.volume ? " " + s.volume : ""}${s.issue ? ", no. " + s.issue : ""}${s.year ? " (" + s.year + ")" : ""}${(bib ? s.pages : locator) ? ": " + (bib ? s.pages : locator) : ""}`,
    });
  }
  if (s.kind === "website")
    parts.push({
      text: `${bib ? ". " : ", "}${[s.website, s.year ? chicagoDate(s.year) : s.accessed && "accessed " + chicagoDate(s.accessed)].filter(Boolean).join(", ")}`,
    });
  if (s.kind === "book" && !bib && locator)
    parts.push({ text: ", " + locator });
  if (link(s)) parts.push({ text: (bib ? ". " : ", ") + link(s) });
  if (s.kind !== "book") {
    for (let i = 1; i < parts.length; i++) {
      if (parts[i].text.startsWith("“") && parts[i + 1]?.text.match(/^[.,]/)) {
        const punctuation = parts[i + 1].text[0];
        parts[i] = {
          ...parts[i],
          text: parts[i].text.replace(/”$/, punctuation + "”"),
        };
        parts[i + 1] = { ...parts[i + 1], text: parts[i + 1].text.slice(1) };
      }
    }
  }
  parts.push({ text: "." });
  return parts.map((p, i) =>
    i === parts.length - 2 ? { ...p, text: p.text.replace(/[.]$/, "") } : p,
  );
}
export function shortTitle(s: Source): string {
  if (s.shortTitle?.trim()) return s.shortTitle.trim();
  const colon = s.title.indexOf(": ");
  const question = s.title.indexOf("? ");
  const breaks = [colon, question].filter((index) => index >= 0);
  if (!breaks.length) return s.title;
  const index = Math.min(...breaks);
  return s.title.slice(0, index + (s.title[index] === "?" ? 1 : 0));
}
export const formatCitation = (
  s: Source,
  mode: "full" | "short" | "bibliography" = "full",
  locator = "",
) =>
  citationParts(s, mode, locator)
    .map((p) => p.text)
    .join("");
export function footnoteParts(
  note: Footnote,
  data: ResearchData,
  form?: ResolvedNoteForm,
  /** The resolved context's locator; for Ibid. it is blank when the place repeats. */
  locator = note.locator ?? "",
): CitationPart[] {
  const source = data.sources.find((s) => s.id === note.sourceId);
  return [
    ...(note.text ? [{ text: note.text + (source ? " " : "") }] : []),
    ...(source
      ? form === "ibid"
        ? [{ text: locator.trim() ? `Ibid., ${locator.trim()}.` : "Ibid." }]
        : citationParts(source, form ?? (note.shortened ? "short" : "full"), locator)
      : []),
  ];
}
export function footnoteText(note: Footnote, data: ResearchData, form?: ResolvedNoteForm, locator?: string) {
  return footnoteParts(note, data, form, locator)
    .map((p) => p.text)
    .join("");
}
export function bibliography(data: ResearchData) {
  return [...data.sources]
    .sort((a, b) =>
      (authors(a, true) || a.title).localeCompare(authors(b, true) || b.title),
    )
    .map((s) => ({
      id: s.id,
      parts: citationParts(s, "bibliography"),
      text: s.manualBibliography?.trim() ? s.manualBibliography : end(formatCitation(s, "bibliography")),
    }));
}
export const citationGuidance = {
  citation:
    "https://www.chicagomanualofstyle.org/tools_citationguide/citation-guide-1.html",
  layout:
    "https://www.chicagomanualofstyle.org/turabian/Student-Tip-Sheets.html",
};
