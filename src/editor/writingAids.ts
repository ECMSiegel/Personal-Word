import { Extension } from "@tiptap/react";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import type { Node as ProseMirrorNode } from "@tiptap/pm/model";
import { Decoration, DecorationSet } from "@tiptap/pm/view";
import type { ProseIssue } from "./proseCheck";
import type { ProseWorkerResponse } from "../derived/prose.worker";

export const focusModeKey = new PluginKey<DecorationSet>("focusMode");
export type ProseRules = Record<ProseIssue["kind"], boolean>;
export const defaultProseRules: ProseRules = { repeat: true, passive: true, filler: true, long: true };
export type ProseCheckState = { decorations: DecorationSet; issues: ProseIssue[]; unavailable: boolean; refreshToken: number; blockIds: Map<number, string>; blockNodes: Map<number, ProseMirrorNode>; changedBlockIds: Set<string> };
export const proseCheckKey = new PluginKey<ProseCheckState>("proseCheck");
export const MAX_PROSE_DECORATIONS = 2000;

type EnabledOptions = { enabled: () => boolean };
type ProseOptions = EnabledOptions & {
  getContext: () => { entryId: string; revision: number };
  getRules: () => ProseRules;
  getDismissed: () => ReadonlySet<string>;
  onIssues: (issues: ProseIssue[]) => void;
  onPending: () => void;
  onUnavailable: () => void;
};

export function isLatestProseResponse(
  response: Pick<ProseWorkerResponse, "entryId" | "revision" | "requestId">,
  latest: Pick<ProseWorkerResponse, "entryId" | "revision" | "requestId"> | null,
): boolean {
  return !!latest && response.entryId === latest.entryId && response.revision === latest.revision && response.requestId === latest.requestId;
}
export function isCurrentProseResponse(
  response: Pick<ProseWorkerResponse, "entryId" | "revision" | "requestId">,
  latest: Pick<ProseWorkerResponse, "entryId" | "revision" | "requestId"> | null,
  context: { entryId: string; revision: number },
  requestedDoc: ProseMirrorNode | null,
  currentDoc: ProseMirrorNode,
): boolean {
  return isLatestProseResponse(response, latest) && response.entryId === context.entryId && response.revision === context.revision && requestedDoc === currentDoc;
}
export function createLatestOnlyRequestQueue<T>(send: (request: T) => number) {
  let inFlight: number | null = null;
  let pending: T | null = null;
  return {
    request(request: T) {
      if (inFlight !== null) { pending = request; return; }
      inFlight = send(request);
    },
    complete(requestId: number) {
      if (inFlight !== requestId) return false;
      inFlight = null;
      if (pending !== null) {
        const next = pending;
        pending = null;
        inFlight = send(next);
      }
      return true;
    },
    clearPending() { pending = null; },
    reset() { inFlight = null; pending = null; },
    get busy() { return inFlight !== null; },
  };
}

function focusDecorations(doc: ProseMirrorNode, selectionHead: number, enabled: boolean): DecorationSet {
  if (!enabled) return DecorationSet.empty;
  const decorations: Decoration[] = [];
  doc.forEach((node, pos) => {
    if (selectionHead < pos || selectionHead >= pos + node.nodeSize)
      decorations.push(Decoration.node(pos, pos + node.nodeSize, { class: "focus-dim" }));
  });
  return DecorationSet.create(doc, decorations);
}

export function proseDecorationsFor(doc: ProseMirrorNode, selection: number, issues: ProseIssue[], enabled: boolean, rules: ProseRules = defaultProseRules, dismissed: ReadonlySet<string> = new Set()): DecorationSet {
  if (!enabled) return DecorationSet.empty;
  const visible = issues.filter(issue => rules[issue.kind] && !dismissed.has(issue.id ?? ""));
  const near = visible.length > MAX_PROSE_DECORATIONS
    ? [...visible].sort((a, b) => distance(a, selection) - distance(b, selection) || a.from - b.from).slice(0, MAX_PROSE_DECORATIONS)
    : visible;
  const decorations = [...near].sort((a, b) => a.from - b.from).map(issue =>
    Decoration.inline(issue.from, issue.to, { class: `prose-${issue.kind}`, title: issue.message }, issue),
  );
  return DecorationSet.create(doc, decorations);
}
function distance(issue: ProseIssue, selection: number): number {
  return issue.from > selection ? issue.from - selection : selection > issue.to ? selection - issue.to : 0;
}

export const FocusMode = Extension.create<EnabledOptions>({
  name: "focus",
  addOptions() { return { enabled: () => false }; },
  addProseMirrorPlugins() {
    return [new Plugin<DecorationSet>({
      key: focusModeKey,
      state: {
        init: (_, state) => focusDecorations(state.doc, state.selection.head, this.options.enabled()),
        apply: (tr, previous, _oldState, next) => {
          if (!this.options.enabled()) return DecorationSet.empty;
          if (tr.docChanged || tr.selectionSet || tr.getMeta(focusModeKey) === "refresh")
            return focusDecorations(next.doc, next.selection.head, true);
          return previous;
        },
      },
      props: { decorations(state) { return focusModeKey.getState(state) ?? DecorationSet.empty; } },
    })];
  },
});

let nextBlockId = 0;
function newBlockId() { return `block-${++nextBlockId}`; }
function isEligibleProseBlock(node: ProseMirrorNode | null | undefined): node is ProseMirrorNode {
  return !!node?.isTextblock && node.type.name !== "codeBlock";
}
function initialBlockInfo(doc: ProseMirrorNode) {
  const ids = new Map<number, string>();
  const nodes = new Map<number, ProseMirrorNode>();
  doc.descendants((node, pos) => {
    if (node.type.name === "blockquote") return false;
    if (isEligibleProseBlock(node)) { ids.set(pos, newBlockId()); nodes.set(pos, node); }
  });
  return { blockIds: ids, blockNodes: nodes };
}
function mapBlockInfo(previous: ProseCheckState, transaction: import("@tiptap/pm/state").Transaction, doc: ProseMirrorNode) {
  const next = new Map<number, string>();
  const nodes = new Map<number, ProseMirrorNode>();
  const changed = new Set<string>();
  for (const [pos, id] of previous.blockIds) {
    const mapped = transaction.mapping.mapResult(pos, 1);
    const node = doc.nodeAt(mapped.pos);
    if (mapped.deleted || !isEligibleProseBlock(node)) continue;
    if (!next.has(mapped.pos)) {
      next.set(mapped.pos, id);
      nodes.set(mapped.pos, node);
      if (node !== previous.blockNodes.get(pos)) changed.add(id);
    }
  }
  doc.descendants((node, pos) => {
    if (node.type.name === "blockquote") return false;
    if (isEligibleProseBlock(node) && !next.has(pos)) {
      const id = newBlockId();
      next.set(pos, id);
      nodes.set(pos, node);
      changed.add(id);
    }
  });
  return { blockIds: next, blockNodes: nodes, changedBlockIds: changed };
}
function collectBlocks(doc: ProseMirrorNode, ids: ReadonlyMap<number, string>, changedIds: ReadonlySet<string>, forceAll: boolean) {
  const blockPositions: Array<{ id: string; from: number }> = [];
  const changedBlocks: Array<{ id: string; from: number; text: string }> = [];
  doc.descendants((node, pos) => {
    if (node.type.name === "blockquote") return false;
    if (!isEligibleProseBlock(node)) return;
    const id = ids.get(pos);
    if (!id) return;
    if (forceAll || changedIds.has(id)) {
      const text = node.textBetween(0, node.content.size, "\n", leaf => {
        if (leaf.type.name === "hardBreak") return "\n";
        if (leaf.type.name === "footnoteReference") return "\uFFFC";
        return leaf.textContent;
      });
      changedBlocks.push({ id, from: pos + 1, text });
    }
    blockPositions.push({ id, from: pos + 1 });
  });
  return { blockPositions, changedBlocks };
}

export const ProseCheck = Extension.create<ProseOptions>({
  name: "prose",
  addOptions() {
    return {
      enabled: () => false,
      getContext: () => ({ entryId: "", revision: 0 }),
      getRules: () => defaultProseRules,
      getDismissed: () => new Set<string>(),
      onIssues: () => undefined,
      onPending: () => undefined,
      onUnavailable: () => undefined,
    };
  },
  addProseMirrorPlugins() {
    const rules = () => this.options.getRules();
    const dismissed = () => this.options.getDismissed();
    return [new Plugin<ProseCheckState>({
      key: proseCheckKey,
      state: {
        init: (_, state) => {
          const { blockIds, blockNodes } = initialBlockInfo(state.doc);
          return { decorations: DecorationSet.empty, issues: [], unavailable: false, refreshToken: 0, blockIds, blockNodes, changedBlockIds: new Set(blockIds.values()) };
        },
        apply: (tr, previous, _oldState, next) => {
          const response = tr.getMeta(proseCheckKey) as { type?: string; issues?: ProseIssue[]; unavailable?: boolean; sentBlockIds?: string[] } | string | undefined;
          if (response && typeof response === "object" && response.type === "blocks-sent") {
            const sent = new Set(response.sentBlockIds ?? []);
            return { ...previous, changedBlockIds: new Set([...previous.changedBlockIds].filter(id => !sent.has(id))) };
          }
          if (response && typeof response === "object" && response.type === "response") {
            const issues = response.issues ?? [];
            return {
              issues,
              unavailable: response.unavailable ?? false,
              refreshToken: previous.refreshToken,
              blockIds: previous.blockIds,
              blockNodes: previous.blockNodes,
              changedBlockIds: previous.changedBlockIds,
              decorations: proseDecorationsFor(next.doc, next.selection.head, issues, this.options.enabled(), rules(), dismissed()),
            };
          }
          if (tr.getMeta(proseCheckKey) === "refresh")
            return { ...previous, refreshToken: previous.refreshToken + 1, decorations: proseDecorationsFor(next.doc, next.selection.head, previous.issues, this.options.enabled(), rules(), dismissed()) };
          if (tr.docChanged) {
            const mapped = mapBlockInfo(previous, tr, next.doc);
            const activeBlockIds = new Set(mapped.blockIds.values());
            const changedBlockIds = new Set([...previous.changedBlockIds, ...mapped.changedBlockIds].filter(id => activeBlockIds.has(id)));
            return { decorations: DecorationSet.empty, issues: [], unavailable: false, refreshToken: previous.refreshToken, blockIds: mapped.blockIds, blockNodes: mapped.blockNodes, changedBlockIds };
          }
          if (!this.options.enabled()) return { decorations: DecorationSet.empty, issues: [], unavailable: false, refreshToken: previous.refreshToken, blockIds: previous.blockIds, blockNodes: previous.blockNodes, changedBlockIds: previous.changedBlockIds };
          if (tr.selectionSet)
            return { ...previous, decorations: proseDecorationsFor(next.doc, next.selection.head, previous.issues, true, rules(), dismissed()) };
          return previous;
        },
      },
      props: { decorations(state) { return proseCheckKey.getState(state)?.decorations ?? DecorationSet.empty; } },
      view: (view) => {
        let worker: Worker | null = null;
        let alive = true;
        let frame: number | ReturnType<typeof setTimeout> | null = null;
        let requestId = 0;
        let latest: { entryId: string; revision: number; requestId: number } | null = null;
        let requestedDoc: ProseMirrorNode | null = null;
        let forceFullEntry = true;
        let previousDoc = view.state.doc;
        let previousRefreshToken = proseCheckKey.getState(view.state)?.refreshToken ?? 0;
        let previousContext = this.options.getContext();
        try {
          if (typeof Worker === "undefined") throw new Error("Workers are unavailable");
          worker = new Worker(new URL("../derived/prose.worker.ts", import.meta.url), { type: "module" });
        } catch {
          this.options.onUnavailable();
        }
        if (worker) worker.addEventListener("message", (event: MessageEvent<ProseWorkerResponse>) => {
          const response = event.data;
          if (!alive || !queue.complete(response.requestId)) return;
          const context = this.options.getContext();
          if (isCurrentProseResponse(response, latest, context, requestedDoc, view.state.doc)) {
            this.options.onIssues(response.issues);
            view.dispatch(view.state.tr.setMeta(proseCheckKey, { type: "response", issues: response.issues }));
          }
        });
        if (worker) worker.addEventListener("error", () => {
          latest = null;
          queue.reset();
          if (frame !== null) {
            if (typeof cancelAnimationFrame === "function" && typeof frame === "number") cancelAnimationFrame(frame);
            else clearTimeout(frame);
            frame = null;
          }
          worker?.terminate();
          worker = null;
          this.options.onIssues([]);
          this.options.onUnavailable();
        });
        const queue = createLatestOnlyRequestQueue<boolean>(() => {
          const context = this.options.getContext();
          const id = ++requestId;
          latest = { ...context, requestId: id };
          requestedDoc = view.state.doc;
          const pluginState = proseCheckKey.getState(view.state);
          const blockIds = pluginState?.blockIds ?? new Map<number, string>();
          const { blockPositions, changedBlocks } = collectBlocks(view.state.doc, blockIds, pluginState?.changedBlockIds ?? new Set(), forceFullEntry);
          worker!.postMessage({ ...context, requestId: id, blockPositions, changedBlocks });
          if (changedBlocks.length) view.dispatch(view.state.tr.setMeta(proseCheckKey, { type: "blocks-sent", sentBlockIds: changedBlocks.map(block => block.id) }));
          forceFullEntry = false;
          return id;
        });
        const schedule = () => {
          if (!alive) return;
          if (!this.options.enabled()) { queue.clearPending(); this.options.onIssues([]); return; }
          if (!worker) { queue.clearPending(); this.options.onUnavailable(); return; }
          if (queue.busy) { queue.request(true); return; }
          if (frame !== null) {
            if (typeof cancelAnimationFrame === "function" && typeof frame === "number") cancelAnimationFrame(frame);
            else clearTimeout(frame);
          }
          const run = () => { frame = null; queue.request(true); };
          frame = typeof requestAnimationFrame === "function" ? requestAnimationFrame(run) : setTimeout(run, 0);
        };
        schedule();
        return {
          update: (nextView) => {
            const refreshToken = proseCheckKey.getState(nextView.state)?.refreshToken ?? 0;
            const context = this.options.getContext();
            const contextChanged = context.entryId !== previousContext.entryId || context.revision !== previousContext.revision;
            if (nextView.state.doc !== previousDoc || refreshToken !== previousRefreshToken || contextChanged) {
              latest = null;
              requestedDoc = null;
              queue.clearPending();
              if (context.entryId !== previousContext.entryId) forceFullEntry = true;
              this.options.onIssues([]);
              this.options.onPending();
              schedule();
            }
            previousDoc = nextView.state.doc;
            previousRefreshToken = refreshToken;
            previousContext = context;
          },
          destroy: () => {
            alive = false;
            if (frame !== null) {
              if (typeof cancelAnimationFrame === "function" && typeof frame === "number") cancelAnimationFrame(frame);
              else clearTimeout(frame);
            }
            worker?.terminate();
          },
        };
      },
    })];
  },
});
