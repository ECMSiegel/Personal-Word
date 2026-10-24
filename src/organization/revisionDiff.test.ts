import { describe, expect, it } from "vitest";
import { getSchema } from "@tiptap/react";
import { entry, newProject } from "../model";
import { documentExtensions } from "../editor/extensions";
import { applyRestorePatch, boundedGraphemeExcerpt, compareEntries, createRestorePatch } from "./revisionDiff";

const paragraph = (text: string) => ({ type: "paragraph", content: [{ type: "text", text }] });
function fixture(text: string) {
  const project = newProject("Draft");
  const section = project.entries[0];
  section.content = { type: "doc", content: [paragraph(text)] };
  section.text = text;
  return { project, section };
}

describe("revision comparison", () => {
  it("aligns unchanged blocks around an inserted paragraph", () => {
    const before = fixture("First").section;
    before.content.content = [paragraph("First"), paragraph("Keep")];
    const current = structuredClone(before);
    current.content.content = [paragraph("First"), paragraph("Inserted"), paragraph("Keep")];
    const diff = compareEntries(before, current);
    expect(diff.oversized).toBe(false);
    expect(diff.blocks.map((block) => [block.beforeIndex, block.currentIndex, block.status])).toEqual([
      [0, 0, "unchanged"], [null, 1, "added"], [1, 2, "unchanged"],
    ]);
  });

  it("does not guess a restore target when an insertion and edit share an unmatched run", () => {
    const before = fixture("First").section;
    before.content.content = [paragraph("First"), paragraph("Old passage"), paragraph("Last")];
    const current = structuredClone(before);
    current.content.content = [paragraph("First"), paragraph("Inserted"), paragraph("Edited passage"), paragraph("Last")];
    const diff = compareEntries(before, current);
    const ambiguous = diff.blocks.filter((block) => block.beforeIndex === 1 || block.currentIndex === 1 || block.currentIndex === 2);
    expect(ambiguous.map((block) => block.status)).toEqual(["deleted", "added", "added"]);
    expect(ambiguous.some((block) => createRestorePatch(before, current, 2, block) !== null)).toBe(false);
  });

  it("reports changed words while preserving combining and RTL graphemes", () => {
    const before = fixture("Cafe\u0301 שלום old word").section;
    const current = structuredClone(before);
    current.content.content![0] = paragraph("Cafe\u0301 שלום new word");
    const diff = compareEntries(before, current);
    const changed = diff.blocks.find((block) => block.status === "changed");
    expect(changed).toBeDefined();
    expect(changed!.beforeSpans.some((span) => span.kind === "deleted" && span.text.includes("old"))).toBe(true);
    expect(changed!.currentSpans.some((span) => span.kind === "added" && span.text.includes("new"))).toBe(true);
    expect(changed!.beforeSpans.map((span) => span.text).join("")).toBe("Cafe\u0301 שלום old word");
  });

  it("restores only the aligned current block and rejects stale revisions or content", () => {
    const { project, section: before } = fixture("Before paragraph");
    const current = structuredClone(before);
    current.content.content = [paragraph("New paragraph")];
    current.text = "New paragraph";
    project.entries = [current];
    project.revision++;
    const block = compareEntries(before, current).blocks[0];
    const patch = createRestorePatch(before, current, project.revision, block);
    expect(patch).not.toBeNull();
    const restored = applyRestorePatch(project, patch!);
    expect(restored.revision).toBe(project.revision);
    expect(restored.entries[0].text).toBe("Before paragraph");
    expect(() => applyRestorePatch({ ...project, revision: project.revision + 1 }, patch!)).toThrow(/project changed/i);
    expect(() => applyRestorePatch({ ...project, entries: [{ ...current, content: { type: "doc", content: [paragraph("Different one")] } }] }, patch!)).toThrow(/passage changed/i);
  });

  it("restores at the aligned live position when an earlier paragraph was inserted", () => {
    const before = fixture("Anchor").section;
    before.content.content = [paragraph("Anchor"), paragraph("Old target"), paragraph("Ending")];
    const current = structuredClone(before);
    current.content.content = [paragraph("Inserted earlier"), paragraph("Anchor"), paragraph("New target"), paragraph("Ending")];
    const project = newProject("Shifted target");
    project.entries = [current];
    const block = compareEntries(before, current).blocks.find((item) => item.beforeIndex === 1)!;
    expect(block.currentIndex).toBe(2);
    const patch = createRestorePatch(before, current, project.revision, block)!;
    const restored = applyRestorePatch(project, patch);
    expect(restored.entries[0].content.content?.map((node) => node.content?.[0]?.text)).toEqual([
      "Inserted earlier", "Anchor", "Old target", "Ending",
    ]);
  });

  it("refuses a passage whose historical footnote is missing", () => {
    const { project, section: before } = fixture("Citation");
    before.content.content = [{ type: "paragraph", content: [{ type: "footnoteReference", attrs: { id: "gone" } }] }];
    const current = structuredClone(before);
    current.content.content = [paragraph("Plain")];
    project.entries = [current];
    project.revision++;
    const patch = createRestorePatch(before, current, project.revision, compareEntries(before, current).blocks[0]);
    expect(patch).not.toBeNull();
    expect(() => applyRestorePatch(project, patch!)).toThrow(/footnote that is not available/i);
  });

  it("keeps historical marks in the restored rich-text paragraph", () => {
    const { project, section: before } = fixture("Bold words");
    before.content.content = [{ type: "paragraph", content: [{ type: "text", text: "Bold words", marks: [{ type: "bold" }] }] }];
    const current = structuredClone(before);
    current.content.content = [paragraph("Plain words")];
    project.entries = [current];
    project.revision++;
    const block = compareEntries(before, current).blocks[0];
    const patch = createRestorePatch(before, current, project.revision, block)!;
    const restored = applyRestorePatch(project, patch);
    expect(restored.entries[0].content.content![0].content![0].marks).toEqual([{ type: "bold" }]);
  });

  it("uses ProseMirror node positions across atom and page-break blocks", () => {
    const { project, section: before } = fixture("Old target");
    const prefix = { type: "paragraph", content: [
      { type: "text", text: "Footnote " },
      { type: "footnoteReference", attrs: { id: "note" } },
    ] };
    before.content.content = [prefix, { type: "pageBreak" }, paragraph("Old target")];
    const current = structuredClone(before);
    current.content.content![2] = paragraph("New target");
    project.research = { sources: [], notes: [], footnotes: [{ id: "note", text: "A source note" }] };
    project.entries = [current];
    project.revision++;
    const block = compareEntries(before, current).blocks.find((item) => item.beforeIndex === 2)!;
    const patch = createRestorePatch(before, current, project.revision, block)!;
    const doc = getSchema(documentExtensions()).nodeFromJSON(current.content);
    const expected = doc.child(0).nodeSize + doc.child(1).nodeSize;
    expect(patch.from).toBe(expected);
    expect(patch.to).toBe(expected + doc.child(2).nodeSize);
    expect(applyRestorePatch(project, patch).entries[0].text).toContain("Old target");
  });

  it("detaches only affected comments and preserves additive entry metadata", () => {
    const { project, section: before } = fixture("Original");
    (before as typeof before & { futureField?: unknown }).futureField = { kept: true };
    const current = structuredClone(before);
    current.content.content = [paragraph("Changed")];
    project.entries = [current];
    project.revision++;
    project.annotations = [
      { id: "a", entryId: current.id, quote: "Changed", text: "note", resolved: false, createdAt: "now", kind: "comment", anchor: { version: 1, from: 1, to: 8, entryRevision: 0, prefix: "", suffix: "", status: "attached" } },
      { id: "b", entryId: "other", quote: "Other", text: "keep", resolved: false, createdAt: "now", kind: "comment" },
    ];
    const patch = createRestorePatch(before, current, project.revision, compareEntries(before, current).blocks[0])!;
    const restored = applyRestorePatch(project, patch);
    expect((restored.entries[0] as typeof before & { futureField?: unknown }).futureField).toEqual({ kept: true });
    expect(restored.annotations?.[0].anchor).toMatchObject({ status: "detached", entryRevision: 1 });
    expect(restored.annotations?.[1]).toEqual(project.annotations[1]);
  });

  it("marks very large block lists as oversized instead of guessing", () => {
    const before = entry("section", "Large");
    before.content = { type: "doc", content: Array.from({ length: 401 }, () => paragraph("x")) };
    const current = structuredClone(before);
    expect(compareEntries(before, current).oversized).toBe(true);
  });

  it("bounds serialized rich-text metadata even when visible prose is short", () => {
    const before = entry("section", "Large metadata");
    const link = { type: "text", text: "x", marks: [{ type: "link", attrs: { href: `https://${"a".repeat(600_000)}` } }] };
    before.content = { type: "doc", content: [{ type: "paragraph", content: [link] }] };
    const current = structuredClone(before);
    expect(compareEntries(before, current).oversized).toBe(true);
  });

  it("keeps excerpt boundaries around emoji, combining marks, ZWJ, and RTL graphemes", () => {
    expect(boundedGraphemeExcerpt("A😀B", 2, 2)).toBe("😀");
    expect(boundedGraphemeExcerpt("e\u0301X", 1, 2)).toBe("e\u0301");
    expect(boundedGraphemeExcerpt("👩‍👩‍👧‍👦x", 3, 20)).toBe("👩‍👩‍👧‍👦x");
    expect(boundedGraphemeExcerpt("שלום😀", 4, 2)).toBe("😀");
    expect(boundedGraphemeExcerpt("😀x", 0, 1)).toBeNull();
    expect(boundedGraphemeExcerpt("A😀B", 1, 1)).toBeNull();
  });

});
