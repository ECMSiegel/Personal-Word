import { describe, expect, it } from "vitest";
import { getSchema, type JSONContent } from "@tiptap/core";
import type { Node as ProseMirrorNode } from "@tiptap/pm/model";
import { EditorState, TextSelection, type Transaction } from "@tiptap/pm/state";
import type { Annotation, Project } from "../model";
import { documentExtensions } from "./extensions";
import {
  buildQuoteInsertion,
  createCommentAnchor,
  mapCommentAnchors,
  migrateLegacyCommentAnchor,
  resolveCommentAnchor,
  withCommentRevisions,
} from "./commentAnchors";

const schema = getSchema(documentExtensions());
const entryId = "entry-1";
const stamp = "2026-10-20T12:00:00.000Z";

type AnchoredAnnotation = Annotation & {
  anchor: {
    version: 1;
    from: number;
    to: number;
    entryRevision: number;
    prefix: string;
    suffix: string;
    status: "attached" | "detached" | "ambiguous";
  };
};

function annotation(
  doc: ProseMirrorNode,
  from: number,
  to: number,
  quote: string,
): AnchoredAnnotation {
  const anchor = createCommentAnchor(doc, from, to, 4);
  if (!anchor) throw new Error("Invalid test annotation range");
  return {
    id: "comment-1",
    entryId,
    quote,
    text: "Review this passage",
    resolved: false,
    createdAt: stamp,
    kind: "comment",
    anchor,
  };
}

function docWithText(text: string) {
  return schema.nodes.doc.create(null, [
    schema.nodes.paragraph.create(null, schema.text(text)),
  ]);
}

function selectionTransaction(doc: ReturnType<typeof docWithText>) {
  const state = EditorState.create({ schema, doc });
  let transaction: Transaction = state.tr;
  return {
    state,
    apply(edit: (tr: Transaction) => Transaction) {
      transaction = edit(transaction);
      return transaction;
    },
  };
}

function projectWithDoc(
  doc: ReturnType<typeof docWithText>,
  contentRevision = 0,
  annotations: Annotation[] = [],
): Project {
  return {
    id: "project-1",
    title: "Anchor fixture",
    createdAt: stamp,
    updatedAt: stamp,
    revision: 1,
    order: [entryId],
    entries: [
      {
        id: entryId,
        kind: "section",
        title: "Opening",
        content: doc.toJSON() as JSONContent,
        contentRevision,
        text: doc.textContent,
        updatedAt: stamp,
        origin: null,
      },
    ],
    annotations,
  };
}

describe("persistent comment anchors", () => {
  it("keeps the second identical occurrence when text is inserted before it", () => {
    const text = "Echo gap Echo";
    const second = text.lastIndexOf("Echo");
    const doc = docWithText(text);
    const anchored = annotation(doc, 1 + second, 1 + second + "Echo".length, "Echo");
    const { apply } = selectionTransaction(doc);
    const transaction = apply((tr) => tr.insertText("New ", 1));

    const mapped = mapCommentAnchors(
      [anchored],
      entryId,
      transaction,
      5,
    )[0] as AnchoredAnnotation;
    const range = resolveCommentAnchor(mapped, transaction.doc);

    expect(mapped.anchor.status).toBe("attached");
    expect(mapped.anchor.entryRevision).toBe(5);
    expect(mapped.anchor.prefix).toContain("New Echo gap ");
    expect(range).toEqual({ from: 1 + second + 4, to: 1 + second + 4 + 4 });
    expect(transaction.doc.textBetween(range!.from, range!.to)).toBe("Echo");
  });

  it("updates the anchored quote when text is inserted inside its range", () => {
    const doc = docWithText("A passage remains.");
    const from = 3;
    const to = from + "passage".length;
    const anchored = annotation(doc, from, to, "passage");
    const { apply } = selectionTransaction(doc);
    const transaction = apply((tr) => tr.insertText("new ", from + 3));

    const mapped = mapCommentAnchors(
      [anchored],
      entryId,
      transaction,
      5,
    )[0] as AnchoredAnnotation;

    expect(mapped.quote).toBe("pasnew sage");
    expect(mapped.anchor.status).toBe("attached");
    expect(mapped.anchor.entryRevision).toBe(5);
  });

  it("resolves one anchored range across marked text nodes after a mapped edit", () => {
    const paragraph = schema.nodes.paragraph.create(null, [
      schema.text("Before "),
      schema.text("marked", [schema.marks.bold.create()]),
      schema.text(" passage after"),
    ]);
    const doc = schema.nodes.doc.create(null, [paragraph]);
    const quote = "Before marked passage after";
    const anchored = annotation(doc, 1, 1 + quote.length, quote);
    const { apply } = selectionTransaction(doc);
    const transaction = apply((tr) => tr.insertText("Added ", 1));

    const mapped = mapCommentAnchors(
      [anchored],
      entryId,
      transaction,
      5,
    )[0] as AnchoredAnnotation;
    const range = resolveCommentAnchor(mapped, transaction.doc);

    expect(range).toEqual({ from: 7, to: 7 + quote.length });
    expect(transaction.doc.textBetween(range!.from, range!.to, "\n")).toBe(quote);
  });

  it("creates exact ranges across marked nodes and migrates only a unique legacy match", () => {
    const paragraph = schema.nodes.paragraph.create(null, [
      schema.text("A unique "),
      schema.text("passage", [schema.marks.italic.create()]),
    ]);
    const doc = schema.nodes.doc.create(null, [paragraph]);
    const quote = "A unique passage";
    const anchor = createCommentAnchor(doc, 1, 1 + quote.length, 6);
    const legacy = { ...annotation(doc, 1, 1 + quote.length, quote), anchor: undefined };
    const migrated = migrateLegacyCommentAnchor(legacy, doc, 6);

    expect(anchor?.status).toBe("attached");
    expect(anchor?.entryRevision).toBe(6);
    expect(migrated.anchor).toEqual(anchor);
    expect(resolveCommentAnchor(migrated, doc)).toEqual({ from: 1, to: 1 + quote.length });
  });

  it("rejects an exact quote when its saved context no longer matches", () => {
    const doc = docWithText("Before Echo After");
    const from = 1 + "Before ".length;
    const anchor = createCommentAnchor(doc, from, from + 4, 3)!;
    const anchored = {
      ...annotation(doc, from, from + 4, "Echo"),
      anchor: { ...anchor, prefix: "Stale prefix" },
    };

    expect(resolveCommentAnchor(anchored, doc)).toBeNull();
  });

  it("detaches a stale-context anchor before a later edit can refresh context", () => {
    const doc = docWithText("Before Echo After");
    const from = 1 + "Before ".length;
    const anchor = createCommentAnchor(doc, from, from + 4, 4)!;
    const stale = {
      ...annotation(doc, from, from + 4, "Echo"),
      anchor: { ...anchor, prefix: "Stale prefix" },
    };
    const { apply } = selectionTransaction(doc);
    const transaction = apply((tr) => tr.insertText("New ", 1));

    const mapped = mapCommentAnchors([stale], entryId, transaction, 5)[0];

    expect(mapped.anchor?.status).toBe("detached");
    expect(mapped.anchor?.entryRevision).toBe(5);
    expect(resolveCommentAnchor(mapped, transaction.doc)).toBeNull();
  });

  it("marks duplicate legacy text ambiguous rather than choosing the first occurrence", () => {
    const doc = docWithText("Same passage, then Same passage");
    const legacy = {
      ...annotation(doc, 1, 1 + "Same passage".length, "Same passage"),
      anchor: undefined,
    };
    const migrated = migrateLegacyCommentAnchor(legacy, doc, 5);

    expect(migrated.anchor?.status).toBe("ambiguous");
    expect(resolveCommentAnchor(migrated, doc)).toBeNull();
  });

  it("migrates a unique legacy quote spanning paragraph boundaries", () => {
    const first = "A multi-paragraph";
    const second = " passage remains unique.";
    const doc = schema.nodes.doc.create(null, [
      schema.nodes.paragraph.create(null, schema.text(first)),
      schema.nodes.paragraph.create(null, schema.text(second)),
    ]);
    const from = 1;
    const to = doc.content.size - 1;
    const quote = doc.textBetween(from, to, "\n");
    const legacy = { ...annotation(doc, from, to, quote), anchor: undefined };

    const migrated = migrateLegacyCommentAnchor(legacy, doc, 9);

    expect(migrated.anchor?.status).toBe("attached");
    expect(resolveCommentAnchor(migrated, doc)).toEqual({ from, to });
  });

  it("resolves and maps an attached cross-paragraph range containing marked text", () => {
    const firstParagraph = schema.nodes.paragraph.create(null, [
      schema.text("First "),
      schema.text("marked", [schema.marks.bold.create()]),
    ]);
    const secondParagraph = schema.nodes.paragraph.create(null, [
      schema.text("paragraph "),
      schema.text("quote", [schema.marks.italic.create()]),
    ]);
    const doc = schema.nodes.doc.create(null, [firstParagraph, secondParagraph]);
    const from = 1;
    const to = doc.content.size - 1;
    const quote = doc.textBetween(from, to, "\n");
    const anchor = createCommentAnchor(doc, from, to, 4)!;
    const anchored = { ...annotation(doc, from, to, quote), anchor };
    const { apply } = selectionTransaction(doc);
    const transaction = apply((tr) => tr.insertText("Added ", 1));

    const mapped = mapCommentAnchors([anchored], entryId, transaction, 5)[0];
    const range = resolveCommentAnchor(mapped, transaction.doc);

    expect(range).toEqual({ from: from + 6, to: to + 6 });
    expect(transaction.doc.textBetween(range!.from, range!.to, "\n")).toBe(quote);
  });

  it("detaches a deleted occurrence instead of resolving the duplicate elsewhere", () => {
    const text = "Echo gap Echo";
    const second = text.lastIndexOf("Echo");
    const from = 1 + second;
    const to = from + "Echo".length;
    const doc = docWithText(text);
    const anchored = annotation(doc, from, to, "Echo");
    const { apply } = selectionTransaction(doc);
    const transaction = apply((tr) => tr.delete(from, to));

    const mapped = mapCommentAnchors(
      [anchored],
      entryId,
      transaction,
      5,
    )[0] as AnchoredAnnotation;

    expect(mapped.anchor.status).toBe("detached");
    expect(resolveCommentAnchor(mapped, transaction.doc)).toBeNull();
    expect(transaction.doc.textContent).toBe("Echo gap ");
  });

  it("builds a multi-paragraph quotation with its reference in the final paragraph", () => {
    const firstParagraph = Array.from({ length: 51 }, (_, index) => `First${index}`).join(" ");
    const finalParagraph = Array.from({ length: 51 }, (_, index) => `Final${index}`).join(" ");
    const note = {
      kind: "quote",
      text: `${firstParagraph}\n\n${finalParagraph}`,
    };
    const insertion = buildQuoteInsertion(note, "footnote-1");
    const quote = insertion.find((node: JSONContent) => node.type === "blockquote");

    expect(quote?.content?.map((node) => node.type)).toEqual([
      "paragraph",
      "paragraph",
    ]);
    expect(quote?.content?.[0]?.content?.map((node) => node.text).join("")).toBe(firstParagraph);
    expect(quote?.content?.[1]?.content?.map((node) => node.text ?? "").join(""))
      .toContain("Final50");
    expect(quote?.content?.[1]?.content?.some((node) => node.type === "footnoteReference"))
      .toBe(true);
    expect(insertion.filter((node: JSONContent) => node.type === "footnoteReference"))
      .toHaveLength(0);
  });

  it("keeps short quotations inline and leaves their citation as an inline sibling", () => {
    const insertion = buildQuoteInsertion(
      { kind: "quote", text: "A short quotation." },
      "footnote-2",
    );

    expect(insertion.map((node) => node.type)).toEqual([
      "text",
      "footnoteReference",
    ]);
    expect(insertion[0].text).toBe("“A short quotation.”");
  });

  it("increments contentRevision once for an exact mapped content transaction", () => {
    const text = "Echo gap Echo";
    const oldDoc = docWithText(text);
    const second = text.lastIndexOf("Echo");
    const anchor = createCommentAnchor(
      oldDoc,
      1 + second,
      1 + second + "Echo".length,
      4,
    )!;
    const anchored = { ...annotation(oldDoc, anchor.from, anchor.to, "Echo"), anchor };
    const previous = projectWithDoc(oldDoc, 4, [anchored]);
    const { apply } = selectionTransaction(oldDoc);
    const transaction = apply((tr) => tr.insertText("New ", 1));
    const next = projectWithDoc(transaction.doc, 91, [anchored]);

    const updated = withCommentRevisions(previous, next, {
      entryId,
      transaction,
    });

    expect(updated.entries[0].contentRevision).toBe(5);
    expect(updated.annotations?.[0].anchor?.entryRevision).toBe(5);
    expect(updated.annotations?.[0].anchor?.from).toBe(1 + second + 4);
    expect(updated.annotations?.[0].anchor?.status).toBe("attached");
  });

  it("increments and detaches when a ReplaceStep replaces an anchor with identical text", () => {
    const oldDoc = docWithText("Echo gap");
    const anchor = createCommentAnchor(oldDoc, 1, 5, 4)!;
    const anchored = { ...annotation(oldDoc, 1, 5, "Echo"), anchor };
    const previous = projectWithDoc(oldDoc, 4, [anchored]);
    const { apply } = selectionTransaction(oldDoc);
    const transaction = apply((tr) =>
      tr.replaceWith(anchor.from, anchor.to, schema.text("Echo")),
    );
    const next = {
      ...previous,
      revision: previous.revision + 1,
      entries: [{ ...previous.entries[0] }],
    };

    expect(transaction.docChanged).toBe(true);
    expect(transaction.doc.eq(oldDoc)).toBe(true);
    const updated = withCommentRevisions(previous, next, {
      entryId,
      transaction,
    });

    expect(updated.entries[0].contentRevision).toBe(5);
    expect(updated.annotations?.[0].anchor?.status).toBe("detached");
    expect(updated.annotations?.[0].anchor?.entryRevision).toBe(5);
  });

  it("uses revision-stamped detached anchors for direct content changes", () => {
    const oldDoc = docWithText("Original passage");
    const anchor = createCommentAnchor(oldDoc, 1, 1 + "Original".length, 7)!;
    const anchored = {
      ...annotation(oldDoc, anchor.from, anchor.to, "Original"),
      anchor,
    };
    const previous = projectWithDoc(oldDoc, 7, [anchored]);
    const next = projectWithDoc(docWithText("Replaced passage"), 500, [anchored]);

    const updated = withCommentRevisions(previous, next);

    expect(updated.entries[0].contentRevision).toBe(8);
    expect(updated.annotations?.[0].quote).toBe("Original");
    expect(updated.annotations?.[0].anchor?.status).toBe("detached");
    expect(updated.annotations?.[0].anchor?.entryRevision).toBe(8);
  });

  it("detaches instead of mapping a transaction whose before document mismatches", () => {
    const oldDoc = docWithText("Original passage");
    const anchor = createCommentAnchor(oldDoc, 1, 1 + "Original".length, 7)!;
    const anchored = {
      ...annotation(oldDoc, anchor.from, anchor.to, "Original"),
      anchor,
    };
    const previous = projectWithDoc(oldDoc, 7, [anchored]);
    const wrongStart = docWithText("Different baseline");
    const { apply } = selectionTransaction(wrongStart);
    const transaction = apply((tr) => tr.insertText("New ", 1));
    const next = projectWithDoc(transaction.doc, 7, [anchored]);

    const updated = withCommentRevisions(previous, next, {
      entryId,
      transaction,
    });

    expect(updated.annotations?.[0].anchor?.status).toBe("detached");
    expect(updated.annotations?.[0].anchor?.entryRevision).toBe(8);
  });

  it("preserves metadata-only revisions and unchanged entry identities", () => {
    const doc = docWithText("Keep this passage");
    const previous = projectWithDoc(doc, 3);
    const priorEntry = previous.entries[0];
    const metadataOnly = {
      ...previous,
      entries: [{ ...priorEntry, title: "Renamed", contentRevision: 90 }],
    };

    const updated = withCommentRevisions(previous, metadataOnly);
    const unchanged = withCommentRevisions(previous, {
      ...previous,
      revision: 2,
    });

    expect(updated.entries[0].title).toBe("Renamed");
    expect(updated.entries[0].contentRevision).toBe(3);
    expect(unchanged.entries[0]).toBe(priorEntry);
  });

  it("does not parse unrelated entries whose content object is unchanged", () => {
    const doc = docWithText("Keep this passage");
    const previous = projectWithDoc(doc, 3);
    let contentReads = 0;
    const content = new Proxy(previous.entries[0].content, {
      get(target, property, receiver) {
        contentReads += 1;
        return Reflect.get(target, property, receiver);
      },
    });
    const priorEntry = { ...previous.entries[0], content };
    const nextEntry = { ...priorEntry, title: "Renamed" };
    const prior = { ...previous, entries: [priorEntry] };
    const next = { ...previous, entries: [nextEntry] };

    const updated = withCommentRevisions(prior, next);

    expect(updated.entries[0].title).toBe("Renamed");
    expect(updated.entries[0].contentRevision).toBe(3);
    expect(contentReads).toBe(0);
  });

  it("does not advance a content revision for selection-only transactions", () => {
    const doc = docWithText("No content change");
    const previous = projectWithDoc(doc, 3);
    const { state, apply } = selectionTransaction(doc);
    const transaction = apply((tr) =>
      tr.setSelection(TextSelection.create(state.doc, 2)),
    );
    const next = projectWithDoc(transaction.doc, 999);

    const updated = withCommentRevisions(previous, next, {
      entryId,
      transaction,
    });

    expect(updated.entries[0].contentRevision).toBe(3);
  });

  it("retains annotations for deleted entries but detaches their passage", () => {
    const doc = docWithText("Removed passage");
    const anchor = createCommentAnchor(doc, 1, 1 + "Removed".length, 2)!;
    const anchored = { ...annotation(doc, anchor.from, anchor.to, "Removed"), anchor };
    const previous = projectWithDoc(doc, 2, [anchored]);
    const next: Project = {
      ...previous,
      order: [],
      entries: [],
    };

    const updated = withCommentRevisions(previous, next);

    expect(updated.annotations).toHaveLength(1);
    expect(updated.annotations?.[0].anchor?.status).toBe("detached");
    expect(updated.annotations?.[0].quote).toBe("Removed");
  });
});
