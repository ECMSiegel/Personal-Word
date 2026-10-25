import { getSchema, type JSONContent } from "@tiptap/react";
import { documentExtensions } from "./editor/extensions";
import type { PageLayout } from "./editor/formatting";
import type { ResearchData, DocumentSettings } from "./research/types";
import { sourceKinds, emptyResearch } from "./research/types";
const documentSchema = getSchema(documentExtensions());
export type Entry = {
  id: string;
  kind: "section" | "fragment";
  title: string;
  content: JSONContent;
  contentRevision?: number;
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
  goals?: { totalWords?: number; dailyWords?: number; deadline?: string; scope?: "manuscript" | "manuscript-and-fragments"; dayMode?: "local" | "utc" };
};
export type CommentAnchor = {
  version: 1;
  from: number;
  to: number;
  entryRevision: number;
  prefix: string;
  suffix: string;
  status: "attached" | "detached" | "ambiguous";
};
export type Annotation = {
  id: string;
  entryId: string;
  quote: string;
  text: string;
  resolved: boolean;
  createdAt: string;
  kind: "comment" | "task";
  anchor?: CommentAnchor;
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
    research: emptyResearch(),
  };
}
export function isValidGoalDeadline(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const timestamp = Date.parse(value + "T00:00:00Z");
  return Number.isFinite(timestamp) && new Date(timestamp).toISOString().slice(0, 10) === value;
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
  if (node.type === "image") return (node.attrs?.alt as string) ?? "";
  const sep =
    node.type === "tableRow"
      ? " "
      : node.type === "doc" ||
        node.type === "bulletList" ||
        node.type === "orderedList" ||
        node.type === "blockquote" ||
        node.type === "listItem" ||
        node.type === "table" ||
        node.type === "tableCell" ||
        node.type === "tableHeader"
        ? "\n"
        : "";
  return (node.content ?? []).map(textOf).join(sep);
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
  if (p.goals !== undefined) {
    const goals = p.goals;
    if (!goals || typeof goals !== "object" || Array.isArray(goals))
      throw new Error("Invalid writing goals");
    if (goals.scope !== undefined && !["manuscript", "manuscript-and-fragments"].includes(goals.scope))
      throw new Error("Invalid writing goal scope");
    if (goals.dayMode !== undefined && !["local", "utc"].includes(goals.dayMode))
      throw new Error("Invalid writing goal day mode");
    for (const value of [goals.totalWords, goals.dailyWords])
      if (value !== undefined && (!Number.isSafeInteger(value) || value <= 0))
        throw new Error("Invalid writing goals");
    if (goals.deadline !== undefined) {
      if (!isValidGoalDeadline(goals.deadline))
        throw new Error("Invalid writing goals");
    }
  }
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
        !sourceKinds.includes(source.kind)
      )
        throw new Error("Invalid research source.");
    if (
      r.sources.some(
        (source) =>
          (source.shortTitle !== undefined &&
            typeof source.shortTitle !== "string") ||
          (source.cslId !== undefined && typeof source.cslId !== "string") ||
          ["edition", "container", "institution", "event", "publishedDate", "manualFull", "manualShort", "manualBibliography"].some((key) => {
            const value = (source as unknown as Record<string, unknown>)[key];
            return value !== undefined && typeof value !== "string";
          }) ||
          (source.cslData !== undefined && (!source.cslData || typeof source.cslData !== "object" || Array.isArray(source.cslData))) ||
          (source.creators !== undefined && (!Array.isArray(source.creators) || source.creators.some((creator) =>
            !creator || typeof creator !== "object" || Array.isArray(creator) || typeof creator.role !== "string" ||
            [creator.given, creator.family, creator.literal].some((value) => value !== undefined && typeof value !== "string")
          ))),
      )
    )
      throw new Error("Invalid research source.");
    if (r.autoShortNotes !== undefined && typeof r.autoShortNotes !== "boolean")
      throw new Error("Invalid research data.");
    const policy = r.citationPolicy as { scope?: unknown; repeats?: unknown } | undefined;
    if (policy !== undefined && (!policy || typeof policy !== "object" || Array.isArray(policy) ||
      !["manuscript", "section"].includes(policy.scope as string) || !["short", "ibid"].includes(policy.repeats as string)))
      throw new Error("Invalid research data.");
    for (const note of [...r.notes, ...r.footnotes])
      if (typeof note.id !== "string" || typeof note.text !== "string")
        throw new Error("Invalid research note.");
    if (r.footnotes.some((note) => note.form !== undefined && !["auto", "full", "short"].includes(note.form)))
      throw new Error("Invalid footnote form");
  }
  if (
    p.annotations &&
    (!Array.isArray(p.annotations) ||
      p.annotations.some(
        (a) =>
          typeof a.id !== "string" ||
          typeof a.entryId !== "string" ||
          typeof a.text !== "string" ||
          typeof a.quote !== "string" ||
          (a.anchor?.status === "attached" && !a.quote) ||
          (a.anchor !== undefined && !validCommentAnchor(a.anchor)),
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
      (e.contentRevision !== undefined &&
        (!Number.isSafeInteger(e.contentRevision) || e.contentRevision < 0)) ||
      e.content?.type !== "doc" ||
      !Array.isArray(e.content.content)
    )
      throw new Error("Project contains an invalid entry.");
    documentSchema.nodeFromJSON(e.content).check();
    validateTableNesting(e.content);
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

// A cell's blockquote/list can contain a table even though direct table children
// are excluded by the schema. Check descendants to enforce unnested tables.
function validateTableNesting(node: JSONContent, insideTable = false): void {
  if (node.type === "table" && insideTable)
    throw new RangeError("Tables cannot be nested.");
  for (const child of node.content ?? [])
    validateTableNesting(child, insideTable || node.type === "table");
}

function validCommentAnchor(value: unknown): value is CommentAnchor {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const anchor = value as CommentAnchor;
  return anchor.version === 1 &&
    Number.isSafeInteger(anchor.from) && anchor.from >= 0 &&
    Number.isSafeInteger(anchor.to) && anchor.to >= anchor.from &&
    Number.isSafeInteger(anchor.entryRevision) && anchor.entryRevision >= 0 &&
    typeof anchor.prefix === "string" && typeof anchor.suffix === "string" &&
    ["attached", "detached", "ambiguous"].includes(anchor.status) &&
    (anchor.status !== "attached" || anchor.to > anchor.from);
}
