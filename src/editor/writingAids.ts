import { Extension } from "@tiptap/react";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import type { Node as ProseMirrorNode } from "@tiptap/pm/model";
import { Decoration, DecorationSet } from "@tiptap/pm/view";
import { findProseIssues, type ProseIssue } from "./proseCheck";

export const focusModeKey = new PluginKey<DecorationSet>("focusMode");
export const proseCheckKey = new PluginKey<DecorationSet>("proseCheck");
/**
 * Rendering cost grows with the number of decorations, so a pathological
 * paragraph can make typing crawl. Only the issues closest to the cursor are
 * kept, which bounds the cost without changing ordinary documents (a dense
 * 4,900-word section produced about 1,000 issues).
 */
export const MAX_PROSE_DECORATIONS = 2000;

type EnabledOptions = { enabled: () => boolean };
function focusDecorations(doc: ProseMirrorNode, selectionHead: number, enabled: boolean): DecorationSet {
  if (!enabled) return DecorationSet.empty;
  const decorations: Decoration[] = [];
  doc.forEach((node, pos) => {
    if (selectionHead < pos || selectionHead >= pos + node.nodeSize)
      decorations.push(Decoration.node(pos, pos + node.nodeSize, { class: "focus-dim" }));
  });
  return DecorationSet.create(doc, decorations);
}
function proseDecorations(doc: ProseMirrorNode, selection: number, enabled: boolean): DecorationSet {
  if (!enabled) return DecorationSet.empty;
  const found: Array<{ from: number; to: number; issue: ProseIssue; distance: number }> = [];
  doc.descendants((node, pos) => {
    if (node.type.name === "blockquote") return false;
    if (!node.isTextblock) return;
    if (node.type.name === "codeBlock") return false;
    const text = node.textBetween(0, node.content.size, "\n", (leaf) => {
      if (leaf.type.name === "hardBreak") return "\n";
      if (leaf.type.name === "footnoteReference") return "\uFFFC";
      return leaf.textContent;
    });
    for (const issue of findProseIssues(text)) {
      const from = pos + 1 + issue.from;
      const to = pos + 1 + issue.to;
      const distance =
        from > selection ? from - selection : selection > to ? selection - to : 0;
      found.push({ from, to, issue, distance });
    }
  });
  const kept =
    found.length <= MAX_PROSE_DECORATIONS
      ? found
      : [...found]
          .sort((a, b) => a.distance - b.distance || a.from - b.from)
          .slice(0, MAX_PROSE_DECORATIONS)
          .sort((a, b) => a.from - b.from);
  const decorations: Decoration[] = kept.map(({ from, to, issue }) =>
    // The issue travels in the decoration spec: prosemirror-view's public
    // Decoration type exposes attrs only through the spec, not the class.
    Decoration.inline(from, to, { class: `prose-${issue.kind}`, title: issue.message }, issue),
  );
  return DecorationSet.create(doc, decorations);
}
function decorationExtension(name: "focus" | "prose", key: PluginKey<DecorationSet>, compute: (doc: any, selection: number, enabled: boolean) => DecorationSet) {
  return Extension.create<EnabledOptions>({
    name,
    addOptions() { return { enabled: () => false }; },
    addProseMirrorPlugins() {
      let debounce: ReturnType<typeof setTimeout> | undefined;
      return [new Plugin<DecorationSet>({
        key,
        state: {
          init: (_, state) => compute(state.doc, state.selection.head, this.options.enabled()),
          apply: (tr, previous, _oldState, newState) => {
            if (!this.options.enabled()) return DecorationSet.empty;
            if (tr.getMeta(key) === "refresh") return compute(newState.doc, newState.selection.head, true);
            if (name === "focus" && (tr.docChanged || tr.selectionSet)) return compute(newState.doc, newState.selection.head, true);
            return tr.docChanged ? previous.map(tr.mapping, tr.doc) : previous;
          },
        },
        props: { decorations(state) { return key.getState(state) ?? DecorationSet.empty; } },
        view: (view) => {
          let previousDoc = view.state.doc;
          return {
            update: (nextView) => {
              if (name !== "prose" || nextView.state.doc === previousDoc) return;
              previousDoc = nextView.state.doc;
              if (!this.options.enabled()) return;
              if (debounce) clearTimeout(debounce);
              debounce = setTimeout(() => {
                if (!nextView.isDestroyed) nextView.dispatch(nextView.state.tr.setMeta(key, "refresh"));
              }, 300);
            },
            destroy: () => { if (debounce) clearTimeout(debounce); },
          };
        },
      })];
    },
  });
}
export const FocusMode = decorationExtension("focus", focusModeKey, focusDecorations);
export const ProseCheck = decorationExtension("prose", proseCheckKey, (doc, selection, enabled) => proseDecorations(doc, selection, enabled));
