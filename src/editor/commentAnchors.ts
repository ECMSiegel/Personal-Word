import type { Node as ProseMirrorNode } from "@tiptap/pm/model";
import type { Transaction } from "@tiptap/pm/state";
import { getSchema, type JSONContent } from "@tiptap/core";
import type { Annotation, CommentAnchor, Entry, Project } from "../model";
import { documentExtensions } from "./extensions";
import { isBlockQuote } from "../research/quoteText";

const CONTEXT_LENGTH = 48;
const documentSchema = getSchema(documentExtensions());

function isValidRange(doc: ProseMirrorNode, from: number, to: number) {
  return (
    Number.isInteger(from) &&
    Number.isInteger(to) &&
    from >= 0 &&
    to > from &&
    to <= doc.content.size
  );
}

function context(doc: ProseMirrorNode, from: number, to: number) {
  return {
    prefix: doc
      .textBetween(Math.max(0, from - CONTEXT_LENGTH), from, "\n")
      .slice(-CONTEXT_LENGTH),
    suffix: doc
      .textBetween(to, Math.min(doc.content.size, to + CONTEXT_LENGTH), "\n")
      .slice(0, CONTEXT_LENGTH),
  };
}

function hasCurrentContext(
  anchor: CommentAnchor,
  doc: ProseMirrorNode,
): boolean {
  const current = context(doc, anchor.from, anchor.to);
  return anchor.prefix === current.prefix && anchor.suffix === current.suffix;
}

export function createCommentAnchor(
  doc: ProseMirrorNode,
  from: number,
  to: number,
  entryRevision: number,
): CommentAnchor | null {
  if (
    !isValidRange(doc, from, to) ||
    !Number.isSafeInteger(entryRevision) ||
    entryRevision < 0
  )
    return null;
  const text = doc.textBetween(from, to, "\n");
  if (!text) return null;
  return {
    version: 1,
    from,
    to,
    entryRevision,
    ...context(doc, from, to),
    status: "attached",
  };
}

export function resolveCommentAnchor(
  annotation: Annotation,
  doc: ProseMirrorNode,
): { from: number; to: number } | null {
  const anchor = annotation.anchor;
  if (
    !anchor ||
    anchor.version !== 1 ||
    anchor.status !== "attached" ||
    !isValidRange(doc, anchor.from, anchor.to) ||
    !hasCurrentContext(anchor, doc)
  )
    return null;
  const text = doc.textBetween(anchor.from, anchor.to, "\n");
  if (!text || text !== annotation.quote) return null;
  return { from: anchor.from, to: anchor.to };
}

type TextStream = { text: string; boundaries: number[] };

function appendText(stream: TextStream, text: string, from: number) {
  for (let index = 0; index < text.length; index += 1) {
    stream.text += text[index];
    stream.boundaries.push(from + index + 1);
  }
}

function textStreams(doc: ProseMirrorNode): TextStream[] {
  const streams: TextStream[] = [];
  let priorBlockLastRun: TextStream | undefined;
  let priorBlockHadAtom = false;
  doc.descendants((block, blockPos) => {
    if (!block.isTextblock) return;
    const runs: TextStream[] = [];
    let run: TextStream | undefined;
    let hadAtom = false;
    const startRun = (position: number) => {
      run = { text: "", boundaries: [position] };
      runs.push(run);
    };
    block.descendants((node, pos) => {
      const position = blockPos + 1 + pos;
      if (node.isText) {
        const value = node.text ?? "";
        if (!run) startRun(position);
        appendText(run!, value, position);
      } else if (node.isInline && node.isLeaf) {
        // Unknown inline atoms are hard boundaries: legacy text cannot safely
        // be assumed to have included or excluded their rendered content.
        hadAtom = true;
        run = undefined;
      }
    });

    if (runs.length) {
      if (
        priorBlockLastRun &&
        !priorBlockHadAtom &&
        !hadAtom &&
        runs.length > 0
      ) {
        const first = runs.shift()!;
        priorBlockLastRun.text += "\n" + first.text;
        priorBlockLastRun.boundaries.push(first.boundaries[0]);
        priorBlockLastRun.boundaries.push(...first.boundaries.slice(1));
        streams.push(...runs);
      } else {
        streams.push(...runs);
      }
      priorBlockLastRun = runs.at(-1) ?? streams.at(-1);
    } else {
      priorBlockLastRun = undefined;
    }
    priorBlockHadAtom = hadAtom;
    return false;
  });
  return streams;
}

function matchingRanges(doc: ProseMirrorNode, quote: string) {
  const matches: { from: number; to: number }[] = [];
  for (const stream of textStreams(doc)) {
    let cursor = 0;
    while ((cursor = stream.text.indexOf(quote, cursor)) >= 0) {
      const from = stream.boundaries[cursor];
      const to = stream.boundaries[cursor + quote.length];
      if (from !== undefined && to !== undefined && to > from)
        matches.push({ from, to });
      cursor += 1;
    }
  }
  return matches;
}

export function migrateLegacyCommentAnchor(
  annotation: Annotation,
  doc: ProseMirrorNode,
  entryRevision: number,
): Annotation {
  if (annotation.anchor) return annotation;
  if (!annotation.quote) {
    return {
      ...annotation,
      anchor: {
        version: 1,
        from: 0,
        to: 0,
        entryRevision,
        prefix: "",
        suffix: "",
        status: "detached",
      },
    };
  }
  const matches = matchingRanges(doc, annotation.quote);
  if (matches.length !== 1) {
    return {
      ...annotation,
      anchor: {
        version: 1,
        from: 0,
        to: 0,
        entryRevision,
        prefix: "",
        suffix: "",
        status: matches.length > 1 ? "ambiguous" : "detached",
      },
    };
  }
  const anchor = createCommentAnchor(
    doc,
    matches[0].from,
    matches[0].to,
    entryRevision,
  );
  return anchor
    ? { ...annotation, anchor }
    : {
        ...annotation,
        anchor: {
          version: 1,
          from: 0,
          to: 0,
          entryRevision,
          prefix: "",
          suffix: "",
          status: "detached",
        },
      };
}

export function mapCommentAnchors(
  annotations: Annotation[],
  entryId: string,
  transaction: Transaction,
  nextEntryRevision: number,
): Annotation[] {
  if (!transaction.docChanged) return annotations;
  return annotations.map((annotation) => {
    const anchor = annotation.anchor;
    if (annotation.entryId !== entryId || !anchor || anchor.status !== "attached")
      return annotation;
    if (
      anchor.version !== 1 ||
      anchor.entryRevision !== nextEntryRevision - 1 ||
      !isValidRange(transaction.before, anchor.from, anchor.to) ||
      !hasCurrentContext(anchor, transaction.before) ||
      transaction.before.textBetween(anchor.from, anchor.to, "\n") !== annotation.quote
    ) {
      return {
        ...annotation,
        anchor: {
          ...anchor,
          entryRevision: nextEntryRevision,
          status: "detached",
        },
      };
    }

    let from = anchor.from;
    let to = anchor.to;
    let wasReplaced = false;
    for (const stepMap of transaction.mapping.maps) {
      stepMap.forEach((oldStart, oldEnd) => {
        if (oldEnd > oldStart && oldStart < to && oldEnd > from)
          wasReplaced = true;
      });
      if (wasReplaced) break;
      from = stepMap.map(from, 1);
      to = stepMap.map(to, -1);
    }
    if (wasReplaced || !isValidRange(transaction.doc, from, to))
      return {
        ...annotation,
        anchor: {
          ...anchor,
          entryRevision: nextEntryRevision,
          status: "detached",
        },
      };

    const mapped = createCommentAnchor(transaction.doc, from, to, nextEntryRevision);
    if (!mapped)
      return {
        ...annotation,
        anchor: {
          ...anchor,
          entryRevision: nextEntryRevision,
          status: "detached",
        },
      };
    return {
      ...annotation,
      quote: transaction.doc.textBetween(from, to, "\n"),
      anchor: mapped,
    };
  });
}

function readEntryDocument(
  entry: Entry,
  schema = documentSchema,
): ProseMirrorNode | null {
  try {
    return schema.nodeFromJSON(entry.content);
  } catch {
    return null;
  }
}

function detachedAnnotation(annotation: Annotation, entryRevision: number) {
  if (!annotation.quote && !annotation.anchor) return annotation;
  return {
    ...annotation,
    anchor: {
      ...(annotation.anchor ?? {
        version: 1 as const,
        from: 0,
        to: 0,
        prefix: "",
        suffix: "",
      }),
      entryRevision,
      status: "detached" as const,
    },
  };
}

function withEntryRevision(entry: Entry, revision: number) {
  const wasVersioned = entry.contentRevision !== undefined;
  if (!wasVersioned && revision === 0) return entry;
  if (entry.contentRevision === revision) return entry;
  return { ...entry, contentRevision: revision };
}

/**
 * Reconcile content revisions and anchors at the immutable project mutation
 * boundary. Only an exact transaction from the prior entry document to the
 * next entry document is trusted to map positions; all other content changes
 * detach affected annotations conservatively.
 */
export function withCommentRevisions(
  previous: Project,
  next: Project,
  edit?: { entryId: string; transaction: Transaction },
): Project {
  let annotations = next.annotations;
  let annotationsChanged = false;
  const nextEntries = next.entries.map((candidate) => {
    const prior = previous.entries.find((entry) => entry.id === candidate.id);
    if (!prior) return candidate;

    const priorRevision = prior.contentRevision ?? 0;
    const transaction = edit?.entryId === candidate.id ? edit.transaction : undefined;
    if (prior.content === candidate.content && !transaction?.docChanged) {
      return withEntryRevision(candidate, priorRevision);
    }
    // Nodes are schema-bound. Parse both snapshots using the transaction's
    // schema when available; independently-created schema instances make
    // structurally identical ProseMirror nodes compare unequal.
    const comparisonSchema = transaction?.before.type.schema;
    const priorDoc = readEntryDocument(prior, comparisonSchema);
    const nextDoc = readEntryDocument(candidate, comparisonSchema);
    const exactTransaction =
      transaction &&
      priorDoc &&
      nextDoc &&
      transaction.before.eq(priorDoc) &&
      transaction.doc.eq(nextDoc);
    if (
      prior.content === candidate.content &&
      !(exactTransaction && transaction?.docChanged)
    ) {
      return withEntryRevision(candidate, priorRevision);
    }
    if (
      priorDoc &&
      nextDoc &&
      priorDoc.eq(nextDoc) &&
      !(exactTransaction && transaction?.docChanged)
    )
      return withEntryRevision(candidate, priorRevision);

    const nextRevision = priorRevision + 1;
    const versioned = { ...candidate, contentRevision: nextRevision };
    if (!annotations?.length) return versioned;

    let updated: Annotation[];
    if (exactTransaction && transaction && priorDoc) {
      const prepared = annotations.map((annotation) =>
        annotation.entryId === candidate.id &&
        annotation.quote &&
        !annotation.anchor
          ? migrateLegacyCommentAnchor(annotation, priorDoc, priorRevision)
          : annotation,
      );
      updated = mapCommentAnchors(
        prepared,
        candidate.id,
        transaction,
        nextRevision,
      );
    } else {
      updated = annotations.map((annotation) =>
        annotation.entryId === candidate.id
          ? detachedAnnotation(annotation, nextRevision)
          : annotation,
      );
    }
    if (updated.some((annotation, index) => annotation !== annotations![index])) {
      annotations = updated;
      annotationsChanged = true;
    }
    return versioned;
  });

  const remainingIds = new Set(nextEntries.map((entry) => entry.id));
  if (annotations?.length) {
    const deleted = annotations.map((annotation) => {
      if (remainingIds.has(annotation.entryId)) return annotation;
      const prior = previous.entries.find((entry) => entry.id === annotation.entryId);
      return prior
        ? detachedAnnotation(annotation, prior.contentRevision ?? 0)
        : annotation;
    });
    if (deleted.some((annotation, index) => annotation !== annotations![index])) {
      annotations = deleted;
      annotationsChanged = true;
    }
  }

  const entriesChanged = nextEntries.some(
    (entry, index) => entry !== next.entries[index],
  );
  if (!entriesChanged && !annotationsChanged) return next;
  return {
    ...next,
    ...(entriesChanged ? { entries: nextEntries } : {}),
    ...(annotationsChanged ? { annotations } : {}),
  };
}

function inlineText(text: string): JSONContent[] {
  const pieces = text.split("\n");
  return pieces.flatMap((piece, index) => [
    ...(piece ? [{ type: "text", text: piece } satisfies JSONContent] : []),
    ...(index < pieces.length - 1 ? [{ type: "hardBreak" } satisfies JSONContent] : []),
  ]);
}

export function buildQuoteInsertion(
  note: { kind: string; text: string },
  footnoteId?: string,
): JSONContent[] {
  const text = note.text.trim();
  const reference = footnoteId
    ? [{ type: "footnoteReference", attrs: { id: footnoteId } } satisfies JSONContent]
    : [];
  if (note.kind !== "quote" || !isBlockQuote(text)) {
    return [
      { type: "text", text: note.kind === "quote" ? `“${text}”` : text },
      ...reference,
    ];
  }

  const paragraphs = text
    .split(/\n\s*\n/u)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);
  const content: JSONContent[] = paragraphs.map((paragraph) => ({
    type: "paragraph",
    content: inlineText(paragraph),
  } satisfies JSONContent));
  if (!content.length) content.push({ type: "paragraph" });
  if (reference.length) {
    content[content.length - 1].content = [
      ...(content[content.length - 1].content ?? []),
      ...reference,
    ];
  }
  return [{ type: "blockquote", content }];
}
