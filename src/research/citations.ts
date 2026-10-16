import type { Footnote, ResearchData, Source } from "./types";
export type CitationPart = { text: string; italic?: boolean };
const surname = (name: string) => name.trim().split(/\s+/).at(-1) ?? name;
const inverted = (name: string) => {
  const parts = name.trim().split(/\s+/);
  return parts.length < 2 ? name : `${parts.pop()}, ${parts.join(" ")}`;
};
function authors(s: Source, bib = false, short = false): string {
  const a = s.authors.filter(Boolean);
  if (!a.length) return "";
  if (short)
    return (
      surname(a[0]) +
      (a.length > 2 ? " et al." : a.length === 2 ? ` and ${surname(a[1])}` : "")
    );
  if (!bib && a.length > 2) return a[0] + " et al.";
  const names = bib ? [inverted(a[0]), ...a.slice(1, a.length > 6 ? 3 : 6)] : a;
  return (
    names
      .join(names.length === 2 ? " and " : ", ")
      .replace(/, ([^,]+)$/, names.length > 2 ? ", and $1" : ", $1") +
    (bib && a.length > 6 ? ", et al." : "")
  );
}
const end = (v: string) => v.replace(/[.,\s]+$/, "") + ".";
const link = (s: Source) =>
  s.doi
    ? `https://doi.org/${s.doi.replace(/^https?:\/\/doi.org\//, "")}`
    : (s.url ?? "");
export function citationParts(
  s: Source,
  mode: "full" | "short" | "bibliography" = "full",
  locator = "",
): CitationPart[] {
  const bib = mode === "bibliography",
    short = mode === "short";
  const a = authors(s, bib, short);
  const parts: CitationPart[] = [];
  if (a) parts.push({ text: a + (bib ? ". " : ", ") });
  const title = s.title || "[Untitled source]";
  parts.push({
    text: s.kind === "book" ? title : `“${title.replace(/[.]$/, "")}”`,
    italic: s.kind === "book",
  });
  if (short) {
    if (s.kind !== "book")
      parts[parts.length - 1].text = parts[parts.length - 1].text.replace(
        /”$/,
        (locator ? "," : ".") + "”",
      );
    parts.push({
      text: locator
        ? `${s.kind === "book" ? ", " : " "}${locator}.`
        : s.kind === "book"
          ? "."
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
      text: `${bib ? ". " : ", "}${[s.website, s.year || (s.accessed ? "accessed " + s.accessed : "")].filter(Boolean).join(", ")}`,
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
): CitationPart[] {
  const source = data.sources.find((s) => s.id === note.sourceId);
  return [
    ...(note.text ? [{ text: note.text + (source ? " " : "") }] : []),
    ...(source
      ? citationParts(source, note.shortened ? "short" : "full", note.locator)
      : []),
  ];
}
export function footnoteText(note: Footnote, data: ResearchData) {
  return footnoteParts(note, data)
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
      text: end(formatCitation(s, "bibliography")),
    }));
}
export const citationGuidance = {
  citation:
    "https://www.chicagomanualofstyle.org/tools_citationguide/citation-guide-1.html",
  layout:
    "https://www.chicagomanualofstyle.org/turabian/Student-Tip-Sheets.html",
};
