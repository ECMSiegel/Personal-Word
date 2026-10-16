import { getSchema, type JSONContent } from "@tiptap/react";
import { documentExtensions } from "./editor/extensions";
import type { PageLayout } from "./editor/formatting";
import type { ResearchData, DocumentSettings } from "./research/types";
const documentSchema = getSchema(documentExtensions());
export type Entry = {
  id: string;
  kind: "section" | "fragment";
  title: string;
  content: JSONContent;
  text: string;
  updatedAt: string;
  synopsis?: string;
  draftStatus?: "notes" | "draft" | "revised";
  tags?: string[];
  uses?: { projectId: string; sectionId: string; date: string }[];
  origin: {
    sectionId: string;
    sectionTitle: string;
    from: number;
    to: number;
    context: string;
    removedAt: string;
  } | null;
};
export type Project = {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  revision: number;
  order: string[];
  entries: Entry[];
  research?: ResearchData;
  documentSettings?: DocumentSettings;
  templateId?: string;
  pageLayout?: PageLayout;
  sidebarOrder?: string[];
  annotations?: Annotation[];
};
export type Annotation = {
  id: string;
  entryId: string;
  quote: string;
  text: string;
  resolved: boolean;
  createdAt: string;
  kind: "comment" | "task";
};
export type Summary = Pick<Project, "id" | "title" | "updatedAt"> & {
  createdAt?: string;
};
export type Version = { id: string; name: string; createdAt: string };
export const now = () => new Date().toISOString();
export const emptyDoc = (): JSONContent => ({
  type: "doc",
  content: [{ type: "paragraph" }],
});
export function entry(kind: Entry["kind"], title: string): Entry {
  return {
    id: crypto.randomUUID(),
    kind,
    title,
    content: emptyDoc(),
    text: "",
    updatedAt: now(),
    origin: null,
  };
}
export function newProject(title: string): Project {
  const first = entry("section", "Opening");
  return {
    id: crypto.randomUUID(),
    title,
    createdAt: now(),
    updatedAt: now(),
    revision: 1,
    order: [first.id],
    entries: [first],
  };
}
export const words = (text: string) =>
  text.trim() ? text.trim().split(/\s+/u).length : 0;
// Entries are immutable, so unchanged entries keep their count between keystrokes.
const wordCounts = new WeakMap<Entry, number>();
export function entryWords(e: Entry): number {
  let n = wordCounts.get(e);
  if (n === undefined) wordCounts.set(e, (n = words(e.text)));
  return n;
}
export function textOf(node: JSONContent): string {
  if (node.type === "text") return node.text ?? "";
  if (node.type === "hardBreak") return "\n";
  return (node.content ?? [])
    .map(textOf)
    .join(
      node.type === "doc" ||
        node.type === "bulletList" ||
        node.type === "orderedList" ||
        node.type === "blockquote" ||
        node.type === "listItem"
        ? "\n"
        : "",
    );
}
export function validateProject(value: unknown): asserts value is Project {
  const p = value as Project;
  const uuid =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (
    !p ||
    !uuid.test(p.id) ||
    typeof p.title !== "string" ||
    !p.title.trim() ||
    !Number.isSafeInteger(p.revision) ||
    p.revision < 1 ||
    !Array.isArray(p.entries) ||
    !Array.isArray(p.order) ||
    typeof p.createdAt !== "string" ||
    typeof p.updatedAt !== "string"
  )
    throw new Error("This is not a valid Personal Word project.");
  if (p.research) {
    const r = p.research;
    if (
      !Array.isArray(r.sources) ||
      !Array.isArray(r.notes) ||
      !Array.isArray(r.footnotes)
    )
      throw new Error("Invalid research data.");
    for (const source of r.sources)
      if (
        typeof source.id !== "string" ||
        typeof source.title !== "string" ||
        !Array.isArray(source.authors) ||
        !source.authors.every((a) => typeof a === "string") ||
        !["book", "journal", "website"].includes(source.kind)
      )
        throw new Error("Invalid research source.");
    for (const note of [...r.notes, ...r.footnotes])
      if (typeof note.id !== "string" || typeof note.text !== "string")
        throw new Error("Invalid research note.");
  }
  if (
    p.annotations &&
    (!Array.isArray(p.annotations) ||
      p.annotations.some(
        (a) =>
          typeof a.id !== "string" ||
          typeof a.entryId !== "string" ||
          typeof a.text !== "string" ||
          typeof a.quote !== "string",
      ))
  )
    throw new Error("Invalid annotations.");
  if (
    p.pageLayout &&
    (!["continuous", "pages"].includes(p.pageLayout.mode) ||
      !["letter", "a4"].includes(p.pageLayout.paper) ||
      !Number.isFinite(p.pageLayout.margin) ||
      !Number.isFinite(p.pageLayout.zoom) ||
      p.pageLayout.zoom < 25 ||
      p.pageLayout.zoom > 200)
  )
    throw new Error("Invalid page settings.");
  const ids = new Set<string>();
  for (const e of p.entries) {
    if (
      !uuid.test(e.id) ||
      ids.has(e.id) ||
      !["section", "fragment"].includes(e.kind) ||
      typeof e.title !== "string" ||
      !e.title.trim() ||
      typeof e.text !== "string" ||
      typeof e.updatedAt !== "string" ||
      e.content?.type !== "doc" ||
      !Array.isArray(e.content.content)
    )
      throw new Error("Project contains an invalid entry.");
    documentSchema.nodeFromJSON(e.content).check();
    ids.add(e.id);
  }
  const sections = p.entries.filter((e) => e.kind === "section");
  if (
    new Set(p.order).size !== p.order.length ||
    p.order.length !== sections.length ||
    sections.some((e) => !p.order.includes(e.id))
  )
    throw new Error("Project section order is invalid.");
}
