import { useEffect, useRef } from "react";
import { EditorContent, useEditor, type JSONContent } from "@tiptap/react";
import { documentExtensions } from "../editor/extensions";

export function FragmentEditor({
  title,
  content,
  editable,
  onEdit,
}: {
  title: string;
  content: JSONContent;
  editable: boolean;
  onEdit?: (content: JSONContent, text: string) => void;
}) {
  const onEditRef = useRef(onEdit);
  onEditRef.current = onEdit;
  const writable = editable && !!onEdit;
  const synced = useRef(JSON.stringify(content));
  const editor = useEditor({
    extensions: documentExtensions(),
    content,
    editable: writable,
    editorProps: {
      attributes: {
        class: "fragment-text",
        "aria-label": "Fragment text: " + title,
        spellcheck: "true",
      },
    },
    onUpdate: ({ editor }) => {
      const json = editor.getJSON();
      synced.current = JSON.stringify(json);
      onEditRef.current?.(json, editor.getText());
    },
  });

  useEffect(() => {
    if (!editor) return;
    editor.view.dom.setAttribute("aria-label", "Fragment text: " + title);
  }, [editor, title]);

  useEffect(() => {
    if (!editor) return;
    editor.setEditable(writable);
  }, [editor, writable]);

  useEffect(() => {
    if (!editor) return;
    const next = JSON.stringify(content);
    if (next === synced.current || editor.isFocused) return;
    synced.current = next;
    editor.commands.setContent(content, { emitUpdate: false });
  }, [editor, content]);

  return <EditorContent editor={editor} />;
}
