import type { JSONContent } from "@tiptap/react";
import { footnoteText } from "../research/citations";
import { bibliographyItems } from "../research/bibliography";
import { footnoteIdsInOrder, resolveCitationContext } from "../research/noteForms";
import { emptyResearch } from "../research/types";
import type { AssetId, PendingAsset } from "../assets/types";
import type { ExportProject } from "./document";

type Assets = Map<AssetId, PendingAsset>;

const escapeMarkdown = (value: string) => value
  .replace(/[\\*_\[\]#`]/g, "\\$&")
  .replace(/(^|\n)([ \t]*)(>)/g, (_match, lineStart: string, indentation: string, marker: string) => `${lineStart}${indentation}\\${marker}`)
  .replace(/(^|\n)([ \t]*)([-+]|[0-9]+\.)([ \t])/g, (_match, lineStart: string, indentation: string, marker: string, spacing: string) => {
    const escapedMarker = /^\d/.test(marker) ? marker.replace(/\.$/, "\\.") : `\\${marker}`;
    return `${lineStart}${indentation}${escapedMarker}${spacing}`;
  });

function researchLocator(locator: string): string {
  return /^(?:p|pp|ch)\.\s/i.test(locator.trim()) ? locator : `p. ${locator}`;
}

function codeSpan(value: string): string {
  const longest = Math.max(0, ...[...value.matchAll(/`+/g)].map((m) => m[0].length));
  const fence = "`".repeat(longest + 1);
  const pad = /^`|`$|^ | $/.test(value) ? " " : "";
  return `${fence}${pad}${value}${pad}${fence}`;
}

function codeBlock(value: string): string {
  const longest = Math.max(0, ...[...value.matchAll(/`+/g)].map((m) => m[0].length));
  const fence = "`".repeat(Math.max(3, longest + 1));
  return `${fence}\n${value}${value.endsWith("\n") ? "" : "\n"}${fence}`;
}

function noteReference(id: string, numbers: Map<string, number>, research: ExportProject["research"], markdown: boolean): string {
  const number = numbers.get(id);
  if (number) return markdown ? `[^${number}]` : `[${number}]`;
  const data = research ?? emptyResearch();
  const note = data.footnotes.find((candidate) => candidate.id === id);
  if (!note) throw new Error("A footnote reference has no matching note. Restore the note before exporting.");
  return `[Note: ${markdown ? escapeMarkdown(footnoteText(note, data)) : footnoteText(note, data)}]`;
}

function inlineMarkdown(node: JSONContent, numbers: Map<string, number>, research: ExportProject["research"]): string {
  if (node.type === "footnoteReference") {
    const id = String(node.attrs?.id ?? "");
    return noteReference(id, numbers, research, true);
  }
  if (node.type === "hardBreak") return "  \n";
  if (node.type === "text") {
    const raw = node.text ?? "";
    const marks = node.marks ?? [];
    const marked = marks.some((m) => ["code", "bold", "italic", "strike", "link"].includes(m.type));
    const leading = marked ? raw.match(/^\s*/)?.[0] ?? "" : "";
    const trailing = marked ? raw.match(/\s*$/)?.[0] ?? "" : "";
    const core = marked ? raw.slice(leading.length, raw.length - trailing.length || undefined) : raw;
    let text = escapeMarkdown(core);
    if (marks.some((m) => m.type === "code")) text = codeSpan(core);
    if (marks.some((m) => m.type === "bold")) text = `**${text}**`;
    if (marks.some((m) => m.type === "italic")) text = `*${text}*`;
    if (marks.some((m) => m.type === "strike")) text = `~~${text}~~`;
    const href = marks.find((m) => m.type === "link")?.attrs?.href;
    if (href) text = `[${text}](${String(href).replace(/[()\\]/g, "\\$&")})`;
    return leading + text + trailing;
  }
  return (node.content ?? []).map((n) => inlineMarkdown(n, numbers, research)).join("");
}

function imageAsset(node: JSONContent, assets: Assets): PendingAsset {
  const id = String(node.attrs?.assetId ?? "");
  const asset = assets.get(id);
  if (!asset) throw new Error(`An image is missing from this export (asset ${id.slice(0, 12) || "unknown"}). Restore the image or remove it from the document before exporting.`);
  return asset;
}

/**
 * Markdown table cells hold one line: blocks are joined with <br>, hard breaks
 * become <br>, and pipes are escaped. The first row is always the pipe-table
 * header row (GFM requires one), whether or not it uses tableHeader cells.
 */
function markdownTable(node: JSONContent, numbers: Map<string, number>, research: ExportProject["research"], assets: Assets): string {
  const rows = (node.content ?? []).map((row) =>
    (row.content ?? []).map((cell) =>
      (cell.content ?? [])
        .flatMap((n) => markdownBlocks(n, numbers, research, "", assets))
        .flatMap((part) => part.split("\n"))
        .map((line) => line.replace(/ {2}$/, "").trim())
        .filter(Boolean)
        .join("<br>")
        .replace(/\|/g, "\\|"),
    ),
  );
  const columns = Math.max(1, ...rows.map((r) => r.length));
  const line = (cells: string[]) => `| ${Array.from({ length: columns }, (_, i) => cells[i] ?? "").join(" | ")} |`;
  if (!rows.length) return "";
  return [line(rows[0]), line(Array(columns).fill("---")), ...rows.slice(1).map(line)].join("\n");
}

function markdownBlocks(node: JSONContent, numbers: Map<string, number>, research: ExportProject["research"], indentation = "", assets: Assets = new Map()): string[] {
  const children = node.content ?? [];
  switch (node.type) {
    case "image": {
      const asset = imageAsset(node, assets);
      const title = node.attrs?.title ? ` "${String(node.attrs.title).replace(/["\\]/g, "\\$&")}"` : "";
      return [`![${escapeMarkdown(String(node.attrs?.alt ?? ""))}](assets/${asset.id}.${asset.meta.mime === "image/png" ? "png" : "jpg"}${title})`];
    }
    case "table":
      return [markdownTable(node, numbers, research, assets)];
    case "paragraph":
      return [inlineMarkdown(node, numbers, research)];
    case "heading": {
      const level = Math.min(6, Math.max(1, Number(node.attrs?.level ?? 1) + 1));
      return [`${"#".repeat(level)} ${inlineMarkdown(node, numbers, research)}`];
    }
    case "codeBlock":
      return [codeBlock(children.map((n) => n.text ?? "").join(""))];
    case "blockquote":
      return children.flatMap((n) => markdownBlocks(n, numbers, research, indentation, assets)).map((line) => line.split("\n").map((part) => `> ${part}`).join("\n"));
    case "bulletList":
    case "orderedList": {
      const ordered = node.type === "orderedList";
      const start = Number(node.attrs?.start ?? 1);
      return children.flatMap((item, index) => {
        const itemChildren = item.content ?? [];
        const marker = ordered ? `${start + index}. ` : "- ";
        const prefix = indentation + marker;
        const result: string[] = [];
        let hasMarker = false;
        for (const child of itemChildren) {
          if (child.type === "paragraph") {
            const paragraph = inlineMarkdown(child, numbers, research);
            result.push(hasMarker ? `${indentation}${" ".repeat(marker.length)}${paragraph}` : prefix + paragraph);
            hasMarker = true;
          } else result.push(...markdownBlocks(child, numbers, research, indentation + " ".repeat(marker.length), assets));
        }
        return result.length ? result : [prefix.trimEnd()];
      });
    }
    case "pageBreak":
      return ["---"];
    case "horizontalRule":
      return ["---"];
    default:
      return children.flatMap((n) => markdownBlocks(n, numbers, research, indentation, assets));
  }
}

function footnoteNumbers(project: ExportProject): Map<string, number> {
  const ids = footnoteIdsInOrder(project);
  const notes = project.research?.footnotes ?? [];
  for (const id of ids) if (!notes.some((n) => n.id === id)) throw new Error("A footnote reference has no matching note. Restore the note before exporting.");
  return new Map(ids.map((id, i) => [id, i + 1]));
}

function projectParts(project: ExportProject) {
  const research = project.research ?? emptyResearch();
  const numbers = footnoteNumbers(project);
  const context = resolveCitationContext({ ...project, research });
  const notes = [...numbers.entries()].map(([id, number]) => {
    const note = research.footnotes.find((n) => n.id === id)!;
    return { number, text: footnoteText(note, research, context[id].form, context[id].locator) };
  });
  return { research, numbers, notes };
}

function formatMarkdownFootnote(number: number, text: string): string {
  const [firstPara = "", ...rest] = text.split(/\n{2,}/);
  const first = `[^${number}]: ${escapeMarkdown(firstPara)}`;
  const continuation = rest.map((para) =>
    para.split("\n").map((l) => "    " + escapeMarkdown(l)).join("\n")
  );
  return [first, ...continuation].join("\n\n");
}

export function projectMarkdown(project: ExportProject, assets: Assets = new Map()): string {
  const { research, numbers, notes } = projectParts(project);
  const sections: string[] = [`# ${escapeMarkdown(project.title)}`];
  for (const id of project.order) {
    const entry = project.entries.find((e) => e.id === id && e.kind === "section");
    if (!entry) continue;
    sections.push(`## ${escapeMarkdown(entry.title)}`, ...markdownBlocks(entry.content, numbers, research, "", assets));
  }
  if (notes.length) sections.push("## Notes", ...notes.map((note) => formatMarkdownFootnote(note.number, note.text)));
  const bib = project.documentSettings?.bibliography === false
    ? []
    : bibliographyItems(project, project.documentSettings);
  if (bib.length) {
    sections.push(
      "## Bibliography",
      ...bib.map((item) =>
        item.heading
          ? `### ${escapeMarkdown(item.text)}`
          : `- ${escapeMarkdown(item.text)}`,
      ),
    );
  }
  const fragments = project.entries.filter((e) => e.kind === "fragment");
  if (fragments.length) sections.push("## Fragments", ...fragments.flatMap((e) => [`### ${escapeMarkdown(e.title)}`, ...markdownBlocks(e.content, numbers, research, "", assets)]));
  if (research.notes.length) sections.push("## Research notes", ...research.notes.flatMap((note) => {
    const source = research.sources.find((s) => s.id === note.sourceId);
    const locator = note.locator ? `${source ? ", " : ""}${researchLocator(note.locator)}` : "";
    const attribution = source || locator ? `\n\n— ${source ? escapeMarkdown(source.title) : ""}${escapeMarkdown(locator)}` : "";
    return [note.kind === "quote" ? `> ${escapeMarkdown(note.text).replace(/\n/g, "\n> ")}${attribution}` : `${escapeMarkdown(note.text)}${attribution}`];
  }));
  return sections.join("\n\n").trimEnd() + "\n";
}

function plainInline(node: JSONContent, numbers: Map<string, number>, research: ExportProject["research"]): string {
  if (node.type === "footnoteReference") {
    return noteReference(String(node.attrs?.id ?? ""), numbers, research, false);
  }
  if (node.type === "hardBreak") return "\n";
  if (node.type === "text") return node.text ?? "";
  return (node.content ?? []).map((n) => plainInline(n, numbers, research)).join("");
}

function plainBlocks(node: JSONContent, numbers: Map<string, number>, research: ExportProject["research"], indentation = "", assets: Assets = new Map()): string[] {
  if (node.type === "image") {
    imageAsset(node, assets);
    const alt = String(node.attrs?.alt ?? "").trim();
    return [alt ? `[Image: ${alt}]` : "[Image]"];
  }
  if (node.type === "table")
    return [(node.content ?? []).map((row) =>
      (row.content ?? [])
        .map((cell) =>
          (cell.content ?? [])
            .flatMap((n) => plainBlocks(n, numbers, research, "", assets))
            .join(" ")
            .replace(/\s+/g, " ")
            .trim(),
        )
        .join("\t"),
    ).join("\n")];
  if (node.type === "paragraph" || node.type === "heading" || node.type === "codeBlock") return [plainInline(node, numbers, research)];
  if (node.type === "pageBreak") return ["[Page break]"];
  if (node.type === "horizontalRule") return ["[Horizontal rule]"];
  if (node.type === "bulletList" || node.type === "orderedList") {
    const start = Number(node.attrs?.start ?? 1);
    return (node.content ?? []).flatMap((item, i) => {
      const content = item.content ?? [];
      const marker = node.type === "orderedList" ? `${start + i}. ` : "- ";
      const prefix = indentation + marker;
      const lines: string[] = [];
      let hasMarker = false;
      for (const child of content) {
        if (child.type === "paragraph") {
          const paragraph = plainInline(child, numbers, research);
          lines.push(hasMarker ? `${indentation}${" ".repeat(marker.length)}${paragraph}` : prefix + paragraph);
          hasMarker = true;
        } else lines.push(...plainBlocks(child, numbers, research, indentation + " ".repeat(marker.length), assets));
      }
      return lines.length ? lines : [prefix.trimEnd()];
    });
  }
  if (node.type === "blockquote") return (node.content ?? []).flatMap((n) => plainBlocks(n, numbers, research, indentation, assets));
  return (node.content ?? []).flatMap((n) => plainBlocks(n, numbers, research, indentation, assets));
}

export function projectPlainText(project: ExportProject, assets: Assets = new Map()): string {
  const { research, numbers, notes } = projectParts(project);
  const sections = [`${project.title}\n${"=".repeat(Math.max(1, project.title.length))}`];
  for (const id of project.order) {
    const entry = project.entries.find((e) => e.id === id && e.kind === "section");
    if (!entry) continue;
    sections.push(`${entry.title}\n${"-".repeat(Math.max(1, entry.title.length))}`, ...plainBlocks(entry.content, numbers, research, "", assets));
  }
  if (notes.length) sections.push("Notes", "-----", ...notes.map((note) => `${note.number}. ${note.text}`));
  const bib = project.documentSettings?.bibliography === false
    ? []
    : bibliographyItems(project, project.documentSettings);
  if (bib.length) sections.push("Bibliography", "-----------", ...bib.map((item) => item.text));
  const fragments = project.entries.filter((e) => e.kind === "fragment");
  if (fragments.length) sections.push("Fragments", "---------", ...fragments.flatMap((e) => [e.title, ...plainBlocks(e.content, numbers, research, "", assets)]));
  if (research.notes.length) sections.push("Research notes", "--------------", ...research.notes.map((note) => {
    const source = research.sources.find((s) => s.id === note.sourceId);
    const locator = note.locator ? `${source ? ", " : ""}${researchLocator(note.locator)}` : "";
    return `${note.text}${source || locator ? `\n— ${source?.title ?? ""}${locator}` : ""}`;
  }));
  return sections.join("\n\n").trimEnd() + "\n";
}
