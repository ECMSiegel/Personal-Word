import { getSchema, type JSONContent } from "@tiptap/react";
import { Fragment, Slice } from "@tiptap/pm/model";
import { documentExtensions } from "../editor/extensions";
import { textOf, type Entry, type Project } from "../model";

const schema = getSchema(documentExtensions());
const MAX_BLOCKS = 400;
const MAX_DIFF_CELLS = 80_000;
const MAX_TEXT = 100_000;
const MAX_TOTAL_TEXT = 1_000_000;
const MAX_TOTAL_FINGERPRINT = 1_000_000;

export type DiffSpan = {
  kind: "unchanged" | "added" | "deleted";
  text: string;
  from: number;
  to: number;
};
export type AlignedBlock = {
  id: string;
  beforeIndex: number | null;
  currentIndex: number | null;
  status: "unchanged" | "changed" | "added" | "deleted" | "moved";
  beforeSpans: DiffSpan[];
  currentSpans: DiffSpan[];
  structuralChanges: string[];
};
export type RevisionDiff = {
  entryId: string;
  blocks: AlignedBlock[];
  oversized: boolean;
  summary: string;
};
export type RestorePatch = {
  entryId: string;
  expectedProjectRevision: number;
  expectedContentHash: string;
  from: number;
  to: number;
  slice: JSONContent[];
};

type Token = { text: string; from: number; to: number };

function tokenise(text: string): Token[] | null {
  const Segmenter = Intl.Segmenter;
  if (!Segmenter) return null;
  const segments = [...new Segmenter(undefined, { granularity: "word" }).segment(text)];
  const boundaries = new Set<number>([0, text.length]);
  for (const part of new Segmenter(undefined, { granularity: "grapheme" }).segment(text)) {
    boundaries.add(part.index);
    boundaries.add(part.index + part.segment.length);
  }
  if (segments.some((part) => !boundaries.has(part.index) || !boundaries.has(part.index + part.segment.length))) return null;
  return segments.map((segment) => ({
    text: segment.segment,
    from: segment.index,
    to: segment.index + segment.segment.length,
  }));
}

/** Return a bounded substring whose endpoints always fall on grapheme boundaries. */
export function boundedGraphemeExcerpt(text: string, offset: number, maxUnits: number): string | null {
  const Segmenter = Intl.Segmenter;
  if (!Segmenter || !Number.isSafeInteger(maxUnits) || maxUnits < 1) return null;
  const boundaries = [0];
  for (const part of new Segmenter(undefined, { granularity: "grapheme" }).segment(text))
    boundaries.push(part.index + part.segment.length);
  const requested = Math.max(0, Math.min(text.length, Number.isFinite(offset) ? Math.trunc(offset) : 0));
  let start = 0;
  for (const boundary of boundaries) {
    if (boundary > requested) break;
    start = boundary;
  }
  if (start >= text.length) return "";
  const limit = Math.min(text.length, start + maxUnits);
  let end = start;
  for (const boundary of boundaries) {
    if (boundary > limit) break;
    if (boundary > start) end = boundary;
  }
  return end > start ? text.slice(start, end) : null;
}

function diffTokens(before: Token[], current: Token[]): [DiffSpan[], DiffSpan[]] | null {
  type Edit = { kind: "equal" | "insert" | "delete"; before?: number; current?: number };
  const n = before.length, m = current.length;
  const frontier = new Map<number, number>([[1, 0]]);
  const trace: Map<number, number>[] = [];
  let work = 0;
  let distance = -1;
  outer: for (let d = 0; d <= n + m; d++) {
    for (let k = -d; k <= d; k += 2) {
      if (++work > MAX_DIFF_CELLS) return null;
      let x = k === -d || (k !== d && (frontier.get(k - 1) ?? -1) < (frontier.get(k + 1) ?? -1))
        ? frontier.get(k + 1) ?? 0
        : (frontier.get(k - 1) ?? 0) + 1;
      let y = x - k;
      while (x < n && y < m && before[x].text === current[y].text) { x++; y++; }
      frontier.set(k, x);
      if (x >= n && y >= m) {
        trace.push(new Map(frontier));
        distance = d;
        break outer;
      }
    }
    trace.push(new Map(frontier));
  }
  if (distance < 0) return null;
  const edits: Edit[] = [];
  let x = n, y = m;
  for (let d = distance; d > 0; d--) {
    const previous = trace[d - 1];
    const k = x - y;
    const previousK = k === -d || (k !== d && (previous.get(k - 1) ?? -1) < (previous.get(k + 1) ?? -1)) ? k + 1 : k - 1;
    const previousX = previous.get(previousK) ?? 0;
    const previousY = previousX - previousK;
    while (x > previousX && y > previousY) edits.push({ kind: "equal", before: --x, current: --y });
    if (x === previousX) edits.push({ kind: "insert", current: --y });
    else edits.push({ kind: "delete", before: --x });
  }
  while (x > 0 && y > 0) edits.push({ kind: "equal", before: --x, current: --y });
  edits.reverse();
  const left: DiffSpan[] = [];
  const right: DiffSpan[] = [];
  for (const edit of edits) {
    if (edit.kind === "equal") {
      const a = before[edit.before!], b = current[edit.current!];
      left.push({ kind: "unchanged", text: a.text, from: a.from, to: a.to });
      right.push({ kind: "unchanged", text: b.text, from: b.from, to: b.to });
    } else if (edit.kind === "delete") {
      const token = before[edit.before!];
      left.push({ kind: "deleted", text: token.text, from: token.from, to: token.to });
    } else {
      const token = current[edit.current!];
      right.push({ kind: "added", text: token.text, from: token.from, to: token.to });
    }
  }
  return [coalesce(left), coalesce(right)];
}

function coalesce(spans: DiffSpan[]): DiffSpan[] {
  return spans.reduce<DiffSpan[]>((out, span) => {
    const last = out.at(-1);
    if (last && last.kind === span.kind && last.to === span.from) {
      last.text += span.text;
      last.to = span.to;
    } else out.push({ ...span });
    return out;
  }, []);
}

function plainText(node: JSONContent): string {
  if (node.type === "text") return node.text ?? "";
  if (node.type === "hardBreak") return "\n";
  return (node.content ?? []).map(plainText).join("");
}
function contentFingerprint(content: JSONContent): string {
  // Exact serialized equality is collision-free for this in-memory JSON value.
  return JSON.stringify(content);
}
function fingerprintBlocks(blocks: JSONContent[], maxCharacters: number): string[] | null {
  const result: string[] = [];
  let characters = 0;
  for (const block of blocks) {
    const fingerprint = contentFingerprint(block);
    characters += fingerprint.length;
    if (characters > maxCharacters) return null;
    result.push(fingerprint);
  }
  return result;
}
function structuralChanges(a: JSONContent, b: JSONContent): string[] {
  const changes: string[] = [];
  if (a.type !== b.type) changes.push(`Block type changed: ${a.type} → ${b.type}`);
  if (JSON.stringify(a.attrs ?? {}) !== JSON.stringify(b.attrs ?? {})) changes.push("Block formatting or attributes changed");
  const marks = (node: JSONContent): string => JSON.stringify(node.marks ?? []);
  const flatten = (node: JSONContent): string[] => node.type === "text"
    ? [marks(node)]
    : (node.content ?? []).flatMap(flatten);
  if (JSON.stringify(flatten(a)) !== JSON.stringify(flatten(b))) changes.push("Text formatting or inline structure changed");
  const shape = (node: JSONContent): unknown => node.type === "text"
    ? ["text", marks(node)]
    : [node.type, node.attrs ?? {}, (node.content ?? []).map(shape)];
  if (JSON.stringify(shape(a)) !== JSON.stringify(shape(b)) && !changes.some((change) => change.includes("inline structure")))
    changes.push("Inline structure or reference changed");
  if (plainText(a) === plainText(b) && contentFingerprint(a) !== contentFingerprint(b) && !changes.length)
    changes.push("Rich-text structure changed");
  return changes;
}

function alignBlocks(a: JSONContent[], b: JSONContent[], aKeys: string[], bKeys: string[]): [number | null, number | null, boolean?][] | null {
  if (a.length > MAX_BLOCKS || b.length > MAX_BLOCKS) return null;
  const cols = b.length + 1;
  if ((a.length + 1) * cols > MAX_DIFF_CELLS) return null;
  const table = new Uint16Array((a.length + 1) * cols);
  for (let i = a.length - 1; i >= 0; i--)
    for (let j = b.length - 1; j >= 0; j--)
      table[i * cols + j] = aKeys[i] === bKeys[j]
        ? table[(i + 1) * cols + j + 1] + 1
        : Math.max(table[(i + 1) * cols + j], table[i * cols + j + 1]);
  const pairs: [number | null, number | null, boolean?][] = [];
  let i = 0, j = 0;
  while (i < a.length || j < b.length) {
    if (i < a.length && j < b.length && aKeys[i] === bKeys[j]) {
      pairs.push([i++, j++]);
    } else if (i < a.length && (j === b.length || table[(i + 1) * cols + j] >= table[i * cols + j + 1])) {
      if (j < b.length && i + 1 < a.length && aKeys[i + 1] === bKeys[j])
        pairs.push([i++, null]);
      else pairs.push([i++, null]);
    } else pairs.push([null, j++]);
  }
  // Pair corresponding blocks inside a replacement run so changed paragraphs
  // get word diffs. Insertions/deletions remain explicit when run lengths differ.
  const aligned: [number | null, number | null, boolean?][] = [];
  for (let p = 0; p < pairs.length;) {
    if (pairs[p][0] !== null && pairs[p][1] !== null) { aligned.push(pairs[p++]); continue; }
    let end = p;
    while (end < pairs.length && (pairs[end][0] === null || pairs[end][1] === null)) end++;
    const run = pairs.slice(p, end);
    const removed = run.flatMap(([x, y]) => x !== null && y === null ? [x] : []);
    const added = run.flatMap(([x, y]) => x === null && y !== null ? [y] : []);
    for (let r = removed.length - 1; r >= 0; r--) {
      const fingerprint = aKeys[removed[r]];
      const matches = added.filter((index) => bKeys[index] === fingerprint);
      if (matches.length === 1 && removed.filter((index) => aKeys[index] === fingerprint).length === 1) {
        const movedIndex = matches[0];
        aligned.push([removed[r], movedIndex, true]);
        removed.splice(r, 1);
        added.splice(added.indexOf(movedIndex), 1);
      }
    }
    const paired = removed.length === added.length ? removed.length : 0;
    for (let k = 0; k < paired; k++) aligned.push([removed[k], added[k], false]);
    for (const index of removed.slice(paired)) aligned.push([index, null]);
    for (const index of added.slice(paired)) aligned.push([null, index]);
    p = end;
  }
  return aligned;
}

export function compareEntries(before: Entry, current: Entry): RevisionDiff {
  const a = before.content.content ?? [];
  const b = current.content.content ?? [];
  const oversized = (summary: string): RevisionDiff => ({ entryId: before.id, blocks: [], oversized: true, summary });
  if (a.length > MAX_BLOCKS || b.length > MAX_BLOCKS)
    return oversized("This section has too many paragraphs for an automatic comparison. Choose a paragraph from each version and compare a shorter passage.");
  const aTexts = a.map(plainText), bTexts = b.map(plainText);
  if (aTexts.some((text) => text.length > MAX_TEXT) || bTexts.some((text) => text.length > MAX_TEXT))
    return oversized("A paragraph is too large for an automatic comparison. Choose a shorter passage from each version.");
  if (aTexts.reduce((sum, text) => sum + text.length, 0) + bTexts.reduce((sum, text) => sum + text.length, 0) > MAX_TOTAL_TEXT)
    return oversized("This section is too large for an automatic comparison. Choose a paragraph from each version and compare a shorter passage.");
  const aKeys = fingerprintBlocks(a, MAX_TOTAL_FINGERPRINT);
  if (!aKeys) return oversized("This section contains too much rich-text metadata for an automatic comparison. Choose a paragraph from each version and compare a shorter passage.");
  const bKeys = fingerprintBlocks(b, MAX_TOTAL_FINGERPRINT - aKeys.reduce((sum, key) => sum + key.length, 0));
  if (!bKeys) return oversized("This section contains too much rich-text metadata for an automatic comparison. Choose a paragraph from each version and compare a shorter passage.");
  const alignment = alignBlocks(a, b, aKeys, bKeys);
  if (!alignment) return oversized("This section is too complex for an automatic comparison. Choose a paragraph from each version and compare a shorter passage.");
  const blocks: AlignedBlock[] = [];
  for (const [beforeIndex, currentIndex, moved] of alignment) {
    const old = beforeIndex === null ? undefined : a[beforeIndex];
    const live = currentIndex === null ? undefined : b[currentIndex];
    const oldText = old ? aTexts[beforeIndex!] : "";
    const liveText = live ? bTexts[currentIndex!] : "";
    const oldTokens = old ? tokenise(oldText) : [];
    const liveTokens = live ? tokenise(liveText) : [];
    if (old && live && (!oldTokens || !liveTokens))
      return { entryId: before.id, blocks: [], oversized: true, summary: "Automatic comparison requires Unicode grapheme support in this system." };
    const tokenDiff = old && live ? diffTokens(oldTokens!, liveTokens!) : null;
    if (old && live && !tokenDiff && oldText.length + liveText.length > 0)
      return { entryId: before.id, blocks: [], oversized: true, summary: "This section has a passage too large for automatic comparison. Select a shorter passage to compare." };
    const spans = tokenDiff ?? [old ? [{ kind: "deleted" as const, text: oldText, from: 0, to: oldText.length }] : [], live ? [{ kind: "added" as const, text: liveText, from: 0, to: liveText.length }] : []];
    const unchanged = old && live && aKeys[beforeIndex!] === bKeys[currentIndex!];
    const status = !old ? "added" : !live ? "deleted" : moved ? "moved" : unchanged ? "unchanged" : "changed";
    blocks.push({
      id: `${before.id}:${beforeIndex ?? "x"}:${currentIndex ?? "x"}`,
      beforeIndex, currentIndex, status,
      beforeSpans: spans[0], currentSpans: spans[1],
      structuralChanges: old && live ? [...(moved ? ["Block moved"] : []), ...structuralChanges(old, live)] : [],
    });
  }
  const changed = blocks.filter((x) => x.status !== "unchanged").length;
  return { entryId: before.id, blocks, oversized: false, summary: changed ? `${changed} changed passage${changed === 1 ? "" : "s"}.` : "No changes." };
}

/** Build a guarded patch for the selected aligned block. It restores that whole paragraph. */
export function createRestorePatch(
  historical: Entry,
  current: Entry,
  projectRevision: number,
  alignedBlock: AlignedBlock,
): RestorePatch | null {
  if (historical.id !== current.id || !Number.isSafeInteger(projectRevision) || projectRevision < 1) return null;
  const oldBlocks = historical.content.content ?? [];
  const currentBlocks = current.content.content ?? [];
  const beforeIndex = alignedBlock.beforeIndex;
  const currentIndex = alignedBlock.currentIndex;
  if (beforeIndex === null || currentIndex === null || oldBlocks[beforeIndex] === undefined || currentBlocks[currentIndex] === undefined) return null;
  const oldSlice = [structuredClone(oldBlocks[beforeIndex])];
  const fingerprint = contentFingerprint(current.content);
  const from = blockPosition(currentBlocks, currentIndex);
  const to = blockPosition(currentBlocks, currentIndex, true);
  if (from === null || to === null) return null;
  return { entryId: current.id, expectedProjectRevision: projectRevision, expectedContentHash: fingerprint, from, to, slice: oldSlice };
}
function blockPosition(blocks: JSONContent[], index: number, end = false): number | null {
  if (index < 0 || index >= blocks.length) return null;
  return blocks.slice(0, index).reduce((n, block) => n + nodeSize(block), 0) + (end ? nodeSize(blocks[index]) : 0);
}
function nodeSize(node: JSONContent): number {
  return schema.nodeFromJSON(node).nodeSize;
}

export function applyRestorePatch(project: Project, patch: RestorePatch): Project {
  if (project.revision !== patch.expectedProjectRevision) throw new Error("The project changed. Compare the passage again before restoring it.");
  const entry = project.entries.find((item) => item.id === patch.entryId);
  if (!entry || contentFingerprint(entry.content) !== patch.expectedContentHash) throw new Error("The passage changed. Compare it again before restoring it.");
  if (!Number.isSafeInteger(patch.from) || !Number.isSafeInteger(patch.to) || patch.from < 0 || patch.to <= patch.from || !Array.isArray(patch.slice) || !patch.slice.length)
    throw new Error("This restore patch is invalid.");
  for (const node of patch.slice) schema.nodeFromJSON(node).check();
  const notes = project.research?.footnotes ?? [];
  const sourceIds = new Set((project.research?.sources ?? []).map((source) => source.id));
  const validateReferences = (node: JSONContent): void => {
    if (node.type === "footnoteReference") {
      const note = notes.find((item) => item.id === node.attrs?.id);
      if (!note) throw new Error("This passage refers to a footnote that is not available in this project.");
      if (note.sourceId && !sourceIds.has(note.sourceId)) throw new Error("This passage refers to a source that is not available in this project.");
    }
    (node.content ?? []).forEach(validateReferences);
  };
  patch.slice.forEach(validateReferences);
  const doc = schema.nodeFromJSON(entry.content);
  if (patch.from >= doc.content.size || patch.to > doc.content.size) throw new Error("The passage no longer has a valid location.");
  const nextDoc = doc.replace(patch.from, patch.to, new Slice(Fragment.from(patch.slice.map((node) => schema.nodeFromJSON(node))), 0, 0));
  const content = nextDoc.toJSON() as JSONContent;
  const nextEntry = { ...entry, content, text: textOf(content), contentRevision: (entry.contentRevision ?? 0) + 1, updatedAt: new Date().toISOString() };
  return {
    ...project,
    entries: project.entries.map((item) => item.id === entry.id ? nextEntry : item),
    annotations: project.annotations?.map((annotation) => annotation.entryId === entry.id && annotation.anchor?.status === "attached"
      ? { ...annotation, anchor: { ...annotation.anchor, entryRevision: nextEntry.contentRevision!, status: "detached" } }
      : annotation),
  };
}
