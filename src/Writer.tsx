import {
  useEditor,
  EditorContent,
  type Editor,
  type JSONContent,
} from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import Typography from "@tiptap/extension-typography";
import {
  Bold,
  Italic,
  Underline,
  Strikethrough,
  List,
  ListOrdered,
  Quote,
  Undo2,
  Redo2,
  Scissors,
  Link as LinkIcon,
  Unlink,
} from "lucide-react";
import { useState } from "react";
import { type Entry } from "./model";
export function Writer({
  item,
  onEdit,
  onExtract,
  onLink,
}: {
  item: Entry;
  onEdit: (content: JSONContent, text: string) => void;
  onExtract: (editor: Editor) => void;
  onLink: (current: string, apply: (url: string) => void) => void;
}) {
  const [, render] = useState(0);
  const editor = useEditor({
    extensions: [
      StarterKit.configure({ link: { openOnClick: false } }),
      Typography,
      Placeholder.configure({
        placeholder: "Begin anywhere. The shape will come.",
      }),
    ],
    content: item.content,
    editorProps: {
      attributes: {
        class: "writing-surface",
        "aria-label": "Writing editor",
        spellcheck: "true",
      },
      handleKeyDown: (_, event) => {
        if (
          (event.metaKey || event.ctrlKey) &&
          event.shiftKey &&
          event.key.toLowerCase() === "x" &&
          item.kind === "section"
        ) {
          event.preventDefault();
          if (editor) onExtract(editor);
          return true;
        }
        return false;
      },
    },
    onUpdate: ({ editor }) => onEdit(editor.getJSON(), editor.getText()),
    onSelectionUpdate: () => render((x) => x + 1),
    onTransaction: () => render((x) => x + 1),
  });
  if (!editor) return null;
  const tools = [
    {
      label: "Bold (⌘B)",
      icon: Bold,
      active: editor.isActive("bold"),
      run: () => editor.chain().focus().toggleBold().run(),
    },
    {
      label: "Italic (⌘I)",
      icon: Italic,
      active: editor.isActive("italic"),
      run: () => editor.chain().focus().toggleItalic().run(),
    },
    {
      label: "Underline (⌘U)",
      icon: Underline,
      active: editor.isActive("underline"),
      run: () => editor.chain().focus().toggleUnderline().run(),
    },
    {
      label: "Strikethrough",
      icon: Strikethrough,
      active: editor.isActive("strike"),
      run: () => editor.chain().focus().toggleStrike().run(),
    },
    {
      label: "Bullet list",
      icon: List,
      active: editor.isActive("bulletList"),
      run: () => editor.chain().focus().toggleBulletList().run(),
    },
    {
      label: "Numbered list",
      icon: ListOrdered,
      active: editor.isActive("orderedList"),
      run: () => editor.chain().focus().toggleOrderedList().run(),
    },
    {
      label: "Block quote",
      icon: Quote,
      active: editor.isActive("blockquote"),
      run: () => editor.chain().focus().toggleBlockquote().run(),
    },
  ];
  return (
    <>
      <div className="format-bar" role="toolbar" aria-label="Formatting">
        <select
          aria-label="Paragraph style"
          value={
            editor.isActive("heading", { level: 1 })
              ? "1"
              : editor.isActive("heading", { level: 2 })
                ? "2"
                : "0"
          }
          onChange={(e) =>
            e.target.value === "0"
              ? editor.chain().focus().setParagraph().run()
              : editor
                  .chain()
                  .focus()
                  .toggleHeading({ level: Number(e.target.value) as 1 | 2 })
                  .run()
          }
        >
          <option value="0">Normal text</option>
          <option value="1">Heading 1</option>
          <option value="2">Heading 2</option>
        </select>
        <span className="separator" />
        {tools.map((t) => (
          <button
            key={t.label}
            title={t.label}
            aria-label={t.label}
            aria-pressed={t.active}
            onClick={t.run}
          >
            <t.icon size={16} />
          </button>
        ))}
        <button
          title="Add link"
          aria-label="Add link"
          onClick={() =>
            onLink(editor.getAttributes("link").href ?? "", (url) =>
              editor.chain().focus().setLink({ href: url }).run(),
            )
          }
        >
          <LinkIcon size={16} />
        </button>
        {editor.isActive("link") && (
          <button
            title="Remove link"
            aria-label="Remove link"
            onClick={() => editor.chain().focus().unsetLink().run()}
          >
            <Unlink size={16} />
          </button>
        )}
        <span className="separator" />
        <button
          title="Undo"
          aria-label="Undo"
          disabled={!editor.can().undo()}
          onClick={() => editor.chain().focus().undo().run()}
        >
          <Undo2 size={16} />
        </button>
        <button
          title="Redo"
          aria-label="Redo"
          disabled={!editor.can().redo()}
          onClick={() => editor.chain().focus().redo().run()}
        >
          <Redo2 size={16} />
        </button>
        {item.kind === "section" && (
          <button
            className="extract"
            disabled={editor.state.selection.empty}
            title="Move selection to Fragments (⌘⇧X)"
            onClick={() => onExtract(editor)}
          >
            <Scissors size={15} />
            <span>Keep as fragment</span>
          </button>
        )}
      </div>
      <EditorContent editor={editor} />
    </>
  );
}
