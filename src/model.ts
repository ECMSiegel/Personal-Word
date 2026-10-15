import { getSchema, type JSONContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
const documentSchema = getSchema([StarterKit]);
export type Entry = {
  id: string;
  kind: "section" | "fragment";
  title: string;
  content: JSONContent;
  text: string;
  updatedAt: string;
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
};
export type Summary = Pick<Project, "id" | "title" | "updatedAt">;
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
    throw new Error("This is not a valid Folio project.");
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
