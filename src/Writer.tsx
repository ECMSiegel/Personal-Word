import {
  useEditor,
  EditorContent,
  type Editor,
  type JSONContent,
} from "@tiptap/react";
import Placeholder from "@tiptap/extension-placeholder";
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
import { useState, useEffect, useRef, type CSSProperties } from "react";
import {
  defaultPageLayout,
  paperGeometry,
  countPages,
  type PageLayout,
  screenplayStyles,
  screenplayAttributes,
} from "./editor/formatting";
import "./editor/editor.css";
import { documentExtensions } from "./editor/extensions";
import type { DocumentSettings } from "./research/types";
import { type Entry } from "./model";
export function Writer({
  item,
  onEdit,
  onExtract,
  onLink,
  layout: controlledLayout,
  onLayoutChange,
  onPageCountChange,
  onEditorReady,
  documentSettings,
  footnoteNumbers,
  onFootnote,
}: {
  documentSettings?: DocumentSettings;
  footnoteNumbers?: Record<string, number>;
  onFootnote?: (id: string) => void;
  onEditorReady?: (editor: Editor | null) => void;
  layout?: PageLayout;
  onLayoutChange?: (layout: PageLayout) => void;
  onPageCountChange?: (count: number) => void;
  item: Entry;
  onEdit: (content: JSONContent, text: string) => void;
  onExtract: (editor: Editor) => void;
  onLink: (current: string, apply: (url: string) => void) => void;
}) {
  const settingsRef = useRef(documentSettings);
  settingsRef.current = documentSettings;
  const defaultFont =
    documentSettings?.font === "serif"
      ? "Times New Roman, serif"
      : documentSettings?.font === "mono"
        ? "Courier New, monospace"
        : "Futura, system-ui, sans-serif";
  const defaultSize = documentSettings?.fontSize ?? 14;
  const defaultLine = documentSettings?.lineSpacing ?? 1.5;
  const [localLayout, setLocalLayout] = useState<PageLayout>({
    ...defaultPageLayout,
    margin: documentSettings
      ? documentSettings.marginInches * 96
      : defaultPageLayout.margin,
  });
  const layout = controlledLayout ?? localLayout;
  const setLayout = (patch: Partial<PageLayout>) => {
    const next = { ...layout, ...patch };
    setLocalLayout(next);
    onLayoutChange?.(next);
  };
  const [pages, setPages] = useState(1);
  const [currentPage, setCurrentPage] = useState(1);
  const viewport = useRef<HTMLDivElement>(null);
  const geometry = paperGeometry(layout);
  const [, render] = useState(0);
  const editor = useEditor({
    extensions: [
      ...documentExtensions(),
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
          event.key === "Tab" &&
          settingsRef.current?.font === "mono" &&
          editor
        ) {
          event.preventDefault();
          const current = editor.getAttributes("paragraph").paragraphStyle;
          const index = screenplayStyles.indexOf(current);
          const next =
            screenplayStyles[(index + (event.shiftKey ? 4 : 1) + 5) % 5];
          editor
            .chain()
            .updateAttributes("paragraph", screenplayAttributes(next))
            .run();
          return true;
        }
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
  useEffect(() => {
    if (!editor) return;
    const numberReferences = () => {
      const seen = new Map<string, number>();
      editor.view.dom
        .querySelectorAll<HTMLElement>("[data-footnote-id]")
        .forEach((el) => {
          const id = el.dataset.footnoteId ?? "";
          if (!seen.has(id)) seen.set(id, seen.size + 1);
          const number = footnoteNumbers?.[id] ?? seen.get(id)!;
          el.textContent = String(number);
          el.setAttribute("aria-label", `Edit footnote ${number}`);
          el.setAttribute("role", "button");
        });
    };
    numberReferences();
    editor.on("transaction", numberReferences);
    return () => {
      editor.off("transaction", numberReferences);
    };
  }, [editor, footnoteNumbers]);
  useEffect(() => {
    onEditorReady?.(editor);
    return () => onEditorReady?.(null);
  }, [editor, onEditorReady]);
  useEffect(() => {
    if (!editor) return;
    let frame = 0;
    const measure = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const count =
          layout.mode === "pages"
            ? countPages(
                editor.view.dom.scrollWidth,
                geometry.contentWidth,
                geometry.gap + 2 * geometry.margin,
              )
            : 1;
        setPages(count);
        onPageCountChange?.(count);
      });
    };
    const observer = new ResizeObserver(measure);
    observer.observe(editor.view.dom);
    editor.on("update", measure);
    document.fonts.ready.then(measure);
    measure();
    return () => {
      observer.disconnect();
      editor.off("update", measure);
      cancelAnimationFrame(frame);
    };
  }, [
    editor,
    layout.mode,
    layout.paper,
    layout.margin,
    documentSettings,
    layout.zoom,
    onPageCountChange,
  ]);
  if (!editor) return null;
  const paragraphAttrs = editor.getAttributes(
    editor.isActive("heading") ? "heading" : "paragraph",
  );
  const setParagraphFormat = (name: string, value: string) =>
    editor
      .chain()
      .updateAttributes("paragraph", { [name]: value })
      .updateAttributes("heading", { [name]: value })
      .run();
  const pageStyle = {
    "--document-font": defaultFont,
    "--document-size": `${defaultSize}pt`,
    "--document-line": defaultLine,
    "--document-indent": documentSettings?.firstLineIndent ? "0.5in" : "0",
    "--page-width": `${geometry.width}px`,
    "--page-height": `${geometry.height}px`,
    "--page-margin": `${geometry.margin}px`,
    "--content-width": `${geometry.contentWidth}px`,
    "--content-height": `${geometry.contentHeight}px`,
    "--page-gap": `${geometry.gap}px`,
    "--page-count": pages,
    zoom: layout.zoom / 100,
  } as CSSProperties;
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
        <span className="editor-tool-separator" aria-hidden="true">
          --
        </span>
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
        <span className="editor-tool-separator" aria-hidden="true">
          --
        </span>
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
      <div className="editor-settings" aria-label="Text and page settings">
        {documentSettings?.font === "mono" && (
          <label>
            Screenplay{" "}
            <select
              aria-label="Screenplay paragraph style"
              value={paragraphAttrs.paragraphStyle ?? "action"}
              onChange={(e) =>
                editor
                  .chain()
                  .focus()
                  .setParagraph()
                  .updateAttributes(
                    "paragraph",
                    screenplayAttributes(e.target.value),
                  )
                  .run()
              }
            >
              {screenplayStyles.map((style) => (
                <option key={style} value={style}>
                  {style[0].toUpperCase() + style.slice(1)}
                </option>
              ))}
            </select>
            <span title="Tab advances paragraph style; Shift Tab reverses">
              Tab to cycle
            </span>
          </label>
        )}
        <label>
          Font{" "}
          <select
            aria-label="Font family"
            value={editor.getAttributes("textFormat").fontFamily ?? defaultFont}
            onChange={(e) =>
              editor
                .chain()
                .focus()
                .setMark("textFormat", { fontFamily: e.target.value })
                .run()
            }
          >
            {[
              "Futura, system-ui, sans-serif",
              "Arial, sans-serif",
              "Helvetica, sans-serif",
              "Verdana, sans-serif",
              "Georgia, serif",
              "Times New Roman, serif",
              "Courier New, monospace",
            ].map((f) => (
              <option key={f} value={f}>
                {f.split(",")[0]}
              </option>
            ))}
          </select>
        </label>
        <label>
          Size{" "}
          <input
            aria-label="Font size"
            type="number"
            min="8"
            max="96"
            value={parseFloat(
              editor.getAttributes("textFormat").fontSize ??
                String(defaultSize),
            )}
            onChange={(e) => {
              const n = Number(e.target.value);
              if (n >= 8 && n <= 96)
                editor
                  .chain()
                  .setMark("textFormat", { fontSize: `${n}pt` })
                  .run();
            }}
          />
        </label>
        <span aria-hidden="true">--</span>
        <label>
          Line{" "}
          <select
            aria-label="Line spacing"
            value={
              ["1", "1.15", "1.5", "2"].includes(
                String(paragraphAttrs.lineHeight ?? String(defaultLine)),
              )
                ? String(paragraphAttrs.lineHeight ?? String(defaultLine))
                : "custom"
            }
            onChange={(e) => {
              if (e.target.value !== "custom")
                setParagraphFormat("lineHeight", e.target.value);
              else setParagraphFormat("lineHeight", "1.25");
            }}
          >
            <option value="1">Single</option>
            <option value="1.15">1.15</option>
            <option value="1.5">1.5</option>
            <option value="2">Double</option>
            <option value="custom">Custom</option>
          </select>
        </label>
        <label>
          Custom{" "}
          <input
            aria-label="Custom line spacing"
            type="number"
            min="0.8"
            max="5"
            step="0.05"
            value={paragraphAttrs.lineHeight ?? String(defaultLine)}
            onChange={(e) => {
              const n = Number(e.target.value);
              if (n >= 0.8 && n <= 5)
                setParagraphFormat("lineHeight", String(n));
            }}
          />
        </label>
        {(["spaceBefore", "spaceAfter"] as const).map((key, i) => (
          <label key={key}>
            {i ? "After" : "Before"}{" "}
            <input
              aria-label={`Paragraph spacing ${i ? "after" : "before"}`}
              type="number"
              min="0"
              max="144"
              value={parseFloat(paragraphAttrs[key] ?? "0")}
              onChange={(e) => {
                const n = Number(e.target.value);
                if (n >= 0 && n <= 144) setParagraphFormat(key, `${n}pt`);
              }}
            />{" "}
            pt
          </label>
        ))}
        <span aria-hidden="true">--</span>
        <button
          aria-pressed={layout.mode === "pages"}
          onClick={() =>
            setLayout({
              mode: layout.mode === "pages" ? "continuous" : "pages",
            })
          }
        >
          {layout.mode === "pages" ? "Pages" : "Continuous"}
        </button>
        <label>
          Paper{" "}
          <select
            aria-label="Paper size"
            value={layout.paper}
            onChange={(e) =>
              setLayout({ paper: e.target.value as PageLayout["paper"] })
            }
          >
            <option value="letter">Letter</option>
            <option value="a4">A4</option>
          </select>
        </label>
        <label>
          Margins{" "}
          <select
            aria-label="Page margins"
            value={layout.margin}
            onChange={(e) => setLayout({ margin: Number(e.target.value) })}
          >
            <option value="48">½ inch</option>
            <option value="72">¾ inch</option>
            <option value="96">1 inch</option>
          </select>
        </label>
        <label>
          Zoom{" "}
          <select
            aria-label="Editor zoom"
            value={layout.zoom}
            onChange={(e) => setLayout({ zoom: Number(e.target.value) })}
          >
            {[50, 75, 100, 125, 150].map((n) => (
              <option key={n} value={n}>
                {n}%
              </option>
            ))}
          </select>
        </label>
        <button
          onClick={() =>
            editor
              .chain()
              .focus()
              .insertContent([{ type: "pageBreak" }, { type: "paragraph" }])
              .run()
          }
        >
          Page break
        </button>
        {layout.mode === "pages" && (
          <span aria-live="polite" aria-label="Page count">
            Page {Math.min(currentPage, pages)} of {pages} -- this section --
            scroll horizontally
          </span>
        )}
      </div>
      <div
        onClick={(event) => {
          const target = (event.target as HTMLElement).closest<HTMLElement>(
            "[data-footnote-id]",
          );
          if (target?.dataset.footnoteId)
            onFootnote?.(target.dataset.footnoteId);
        }}
        ref={viewport}
        onScroll={(event) =>
          setCurrentPage(
            Math.max(
              1,
              Math.floor(
                event.currentTarget.scrollLeft /
                  (((geometry.width + geometry.gap) * layout.zoom) / 100),
              ) + 1,
            ),
          )
        }
        className={`editor-viewport ${layout.mode === "pages" ? "is-paged" : "is-continuous"}`}
      >
        <div className="editor-paper" style={pageStyle}>
          <EditorContent editor={editor} />
        </div>
      </div>
    </>
  );
}
