import { describe, expect, it } from "vitest";
import { getSchema } from "@tiptap/core";
import fixtureJson from "../tests/fixtures/beta-synthetic-project.json";
import { textOf, validateProject, type Annotation, type Project } from "./model";
import { documentExtensions } from "./editor/extensions";
import { resolveCommentAnchor } from "./editor/commentAnchors";
import { createProjectArchive, readProjectArchive } from "./projectArchive";
import { collectAssetIds, fromBase64, inspectImage, sha256Hex } from "./assets/assets";
import type { AssetMeta, PendingAsset } from "./assets/types";
import { mergeSourceFields, type SourceImportField } from "./research/sourceMerge";

// The synthetic project behind the D2 durability matrix (tests/fixtures/beta-synthetic-project.json).
// The same file feeds the Rust store test and scripts/native-reliability.py, which builds every
// expected native state from it, so these checks keep the fixture itself honest.
type Edit = { entryId?: string; updatedAt: string; entry?: Record<string, unknown>; sources?: { id: string; set: Record<string, unknown> }[] };
type Fixture = {
  ids: { project: string; sec1: string; sec2: string; frag: string };
  assets: { name: string; id: string; meta: AssetMeta; data: string }[];
  initial: Project;
  edits: Record<"incremental" | "second" | "lateImage" | "merge" | "restore", Edit>;
  anchorSpecs: { id: string; quote: string; occurrence: number }[];
};
const fx = fixtureJson as unknown as Fixture;
const schema = getSchema(documentExtensions());

function applyEdit(project: Project, edit: Edit): Project {
  const next = structuredClone(project);
  next.revision += 1;
  next.updatedAt = edit.updatedAt;
  if (edit.entryId) {
    const index = next.entries.findIndex((e) => e.id === edit.entryId);
    next.entries[index] = { ...next.entries[index], ...structuredClone(edit.entry) } as Project["entries"][number];
  }
  for (const patch of edit.sources ?? []) {
    const source = next.research!.sources.find((s) => s.id === patch.id)!;
    Object.assign(source, structuredClone(patch.set));
  }
  return next;
}
const states = () => {
  const s1 = fx.initial;
  const s2 = applyEdit(s1, fx.edits.incremental);
  const s3 = applyEdit(s2, fx.edits.second);
  const late = applyEdit(s1, fx.edits.lateImage);
  const merged = applyEdit(s1, fx.edits.merge);
  return { s1, s2, s3, late, merged };
};
const pending = async (): Promise<Map<string, PendingAsset>> => {
  const map = new Map<string, PendingAsset>();
  for (const a of fx.assets) map.set(a.id, { id: a.id, meta: a.meta, bytes: fromBase64(a.data) });
  return map;
};

describe("synthetic beta project fixture", () => {
  it("is a valid project in every state the matrix derives from it", () => {
    for (const [name, project] of Object.entries(states())) {
      expect(() => validateProject(project), name).not.toThrow();
    }
  });

  it("carries every legacy and new shape the matrix must preserve", () => {
    const p = fx.initial;
    const research = p.research!;
    // Sources: every kind the draft listed plus a legacy record with no creators, cslData or short forms.
    expect(research.sources.map((s) => s.kind)).toEqual(["book", "journal", "chapter", "thesis", "interview", "website"]);
    expect(research.sources.filter((s) => s.cslData && "rawUnknownField" in s.cslData)).toHaveLength(1);
    const legacy = research.sources.find((s) => s.id === "src-legacy")!;
    expect(legacy.creators).toBeUndefined();
    expect(legacy.cslData).toBeUndefined();
    // Policies, goals, layout and additive metadata.
    expect(research.citationPolicy).toEqual({ scope: "section", repeats: "ibid" });
    expect(research.autoShortNotes).toBe(false);
    expect(p.goals).toEqual({ totalWords: 60000, dailyWords: 750, deadline: "2026-12-31", scope: "manuscript-and-fragments", dayMode: "utc" });
    expect((p as unknown as Record<string, unknown>).additiveBetaField).toBeDefined();
    // Repeated and multiline notes.
    expect(research.footnotes.filter((n) => n.sourceId === "src-book")).toHaveLength(2);
    expect(research.footnotes.some((n) => n.text.includes("\n\n"))).toBe(true);
    expect(research.notes.some((n) => n.text.includes("\n"))).toBe(true);
    // Comments: duplicate quotes, a Unicode quote, a legacy one without an anchor, a detached one and a task.
    const quotes = (p.annotations ?? []).map((a) => a.quote);
    expect(quotes.filter((q) => q === "excavation trench")).toHaveLength(2);
    expect((p.annotations ?? []).some((a) => /[\u{1F300}-\u{1FAFF}]/u.test(a.quote) && a.quote.includes("‍"))).toBe(true);
    expect((p.annotations ?? []).some((a) => !a.anchor && a.quote)).toBe(true);
    expect((p.annotations ?? []).some((a) => a.anchor?.status === "detached")).toBe(true);
    expect((p.annotations ?? []).some((a) => a.kind === "task")).toBe(true);
    // Media, fragment provenance and a table with a header row.
    const sec1 = p.entries.find((e) => e.id === fx.ids.sec1)!;
    const types = (sec1.content.content ?? []).map((n) => n.type);
    expect(types).toContain("image");
    expect(types).toContain("table");
    const table = sec1.content.content!.find((n) => n.type === "table")!;
    expect(table.content![0].content!.every((c) => c.type === "tableHeader")).toBe(true);
    const fragment = p.entries.find((e) => e.id === fx.ids.frag)!;
    expect(fragment.origin).toMatchObject({ sectionId: fx.ids.sec1 });
    expect(collectAssetIds(p)).toEqual(new Set([fx.assets[0].id, fx.assets[1].id]));
  });

  it("keeps every entry's text equal to its content and every asset id equal to its bytes", async () => {
    for (const [name, project] of Object.entries(states()))
      for (const e of project.entries) expect(e.text, `${name}:${e.title}`).toBe(textOf(e.content));
    for (const a of fx.assets) {
      const bytes = fromBase64(a.data);
      expect(await sha256Hex(bytes), a.name).toBe(a.id);
      expect(inspectImage(bytes), a.name).toEqual(a.meta);
    }
    const { s1, late } = states();
    expect(collectAssetIds(s1).has(fx.assets[2].id)).toBe(false);
    expect(collectAssetIds(late).has(fx.assets[2].id)).toBe(true);
  });

  it("anchors each duplicate and Unicode comment to its own range", () => {
    const sec1 = fx.initial.entries.find((e) => e.id === fx.ids.sec1)!;
    const doc = schema.nodeFromJSON(sec1.content);
    const attached = (fx.initial.annotations ?? []).filter((a) => a.anchor?.status === "attached");
    expect(attached.map((a) => a.id)).toEqual(fx.anchorSpecs.map((s) => s.id));
    for (const a of attached) {
      const resolved = resolveCommentAnchor(a, doc);
      expect(resolved, a.id).toEqual({ from: a.anchor!.from, to: a.anchor!.to });
      expect(doc.textBetween(resolved!.from, resolved!.to, "\n"), a.id).toBe(a.quote);
    }
    const [dup1, dup2] = attached;
    expect(dup1.quote).toBe(dup2.quote);
    expect(dup1.anchor!.from).toBeLessThan(dup2.anchor!.from);
    // Controls: an anchor moved by one position, or the second range carrying the first one's
    // surrounding text, must stop resolving rather than jump to the other duplicate.
    const shifted: Annotation = { ...dup1, anchor: { ...dup1.anchor!, from: dup1.anchor!.from + 1, to: dup1.anchor!.to + 1 } };
    expect(resolveCommentAnchor(shifted, doc)).toBeNull();
    const wrongContext: Annotation = { ...dup2, anchor: { ...dup2.anchor!, prefix: dup1.anchor!.prefix, suffix: dup1.anchor!.suffix } };
    expect(resolveCommentAnchor(wrongContext, doc)).toBeNull();
  });

  it("round trips through a v2 archive and imports under a new identity with every field and image byte intact", async () => {
    const { s3 } = states();
    const assets = await pending();
    const text = await createProjectArchive(s3, async (id) => assets.get(id)!);
    const read = await readProjectArchive(text);
    expect(read.project).toEqual(s3);
    expect(read.ignoredAssetIds).toEqual([]);
    expect(read.assets.map((a) => a.id).sort()).toEqual([...collectAssetIds(s3)].sort());
    for (const a of read.assets) expect(await sha256Hex(a.bytes)).toBe(a.id);
    // The identity the app gives an imported archive (App.importProject): only these four fields change.
    const imported: Project = { ...read.project, id: "b1b2c3d4-0000-4000-8000-0000000000ff", revision: 1, title: s3.title + " (recovered)", updatedAt: "2026-10-25T00:00:00.000Z" };
    expect(() => validateProject(imported)).not.toThrow();
    const { id: _id, revision: _revision, title: _title, updatedAt: _updatedAt, ...importedRest } = imported;
    const { id: _id2, revision: _revision2, title: _title2, updatedAt: _updatedAt2, ...originalRest } = s3;
    expect(importedRest).toEqual(originalRest);
    // Controls: a dropped metadata field or a dropped image must be caught by this comparison and by the reader.
    const doctored = JSON.parse(text) as { project: Record<string, unknown>; assets: unknown[] };
    delete doctored.project.goals;
    expect((await readProjectArchive(JSON.stringify(doctored))).project).not.toEqual(s3);
    doctored.assets.pop();
    await expect(readProjectArchive(JSON.stringify(doctored))).rejects.toThrow(/missing image/);
  });

  it("derives the merge state from the real field merge and leaves other sources untouched", () => {
    const { s1, merged } = states();
    for (const patch of fx.edits.merge.sources!) {
      const existing = s1.research!.sources.find((s) => s.id === patch.id)!;
      const fields = Object.keys(patch.set) as SourceImportField[];
      const viaApp = mergeSourceFields(existing, { ...existing, ...patch.set } as never, fields);
      expect(merged.research!.sources.find((s) => s.id === patch.id)).toEqual(viaApp);
      expect(viaApp.cslData).toEqual(existing.cslData);
    }
    const touched = new Set(fx.edits.merge.sources!.map((p) => p.id));
    for (const source of s1.research!.sources.filter((s) => !touched.has(s.id)))
      expect(merged.research!.sources.find((s) => s.id === source.id)).toEqual(source);
  });
});
