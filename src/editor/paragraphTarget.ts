import type { EditorState } from "@tiptap/pm/state";

export type ParagraphRange = { from: number; to: number };

export function paragraphRange(state: EditorState): ParagraphRange | null {
  const { selection } = state;
  if (!selection.empty) return { from: selection.from, to: selection.to };

  const { $from } = selection;
  if (!$from.parent.isTextblock || $from.parent.content.size === 0) return null;
  return { from: $from.start(), to: $from.end() };
}
