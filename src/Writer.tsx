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
  IndentDecrease,
  IndentIncrease,
  BetweenHorizontalStart,
  FileText,
  AlignJustify,
  Focus,
  Settings2,
  Ellipsis,
  MessageSquarePlus,
  Minus,
  Plus,
  type LucideIcon,
} from "lucide-react";
import {
  useState,
  useEffect,
  useLayoutEffect,
  useRef,
  type CSSProperties,
  type ReactNode,
} from "react";
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
import { FocusMode, ProseCheck, focusModeKey, proseCheckKey, MAX_PROSE_DECORATIONS } from "./editor/writingAids";
import type { ProseIssue } from "./editor/proseCheck";
import { changeIndent, indentKeys } from "./editor/indent";
import { NumberInput, PanelButton } from "./editor/ToolbarControls";
import {
  FootnoteBlock,
  FootnoteRows,
  type FootnoteNote,
} from "./editor/FootnoteArea";
import { useFootnoteLayout } from "./editor/useFootnoteLayout";
import { Dropdown, type DropdownOption } from "./components/Dropdown";
import type { DocumentSettings } from "./research/types";
import { type Entry } from "./model";

type ToolbarPanel = "spacing" | "setup" | "more" | "aids";
type ToolbarGroup =
  | "history"
  | "zoom"
  | "paragraph"
  | "font"
  | "size"
  | "marks"
  | "link"
  | "lists"
  | "indent"
  | "spacing"
  | "view"
  | "aids"
  | "setup"
  | "more"
  | "right";

const TOOLBAR_ORDER: ToolbarGroup[] = [
  "history",
  "zoom",
  "paragraph",
  "font",
  "size",
  "marks",
  "link",
  "lists",
  "indent",
  "spacing",
  "view",
  "aids",
  "setup",
  "more",
  "right",
];
/** Groups that move into the More menu first, least important first. */
const OVERFLOW_ORDER: ToolbarGroup[] = [
  "aids",
  "setup",
  "view",
  "spacing",
  "indent",
  "lists",
  "link",
  "marks",
  "size",
  "font",
  "paragraph",
  "zoom",
];
const ALWAYS_VISIBLE: ToolbarGroup[] = ["history", "right"];
const FONT_FACES = [
  "Futura, system-ui, sans-serif",
  "Arial, sans-serif",
  "Helvetica, sans-serif",
  "Verdana, sans-serif",
  "Georgia, serif",
  "Times New Roman, serif",
  "Courier New, monospace",
];
const LINE_PRESETS = [
  { value: 1, label: "Single" },
  { value: 1.15, label: "1.15" },
  { value: 1.5, label: "1.5" },
  { value: 2, label: "Double" },
];

function withCurrent(
  options: DropdownOption<string>[],
  value: string,
  label: string,
): DropdownOption<string>[] {
  return options.some((option) => option.value === value)
    ? options
    : [...options, { value, label }];
}

export function Writer({
  item,
  onEdit,
  onExtract,
  onLink,
  layout: controlledLayout,
  onLayoutChange,
  onPageCountChange,
  onPageStatus,
  onEditorReady,
  onComment,
  documentSettings,
  footnoteNumbers,
  footnotes,
  onFootnote,
  onFootnoteTextChange,
  header,
  footer,
  focusMode = false,
  proseCheck = false,
  onToggleFocusMode,
  onToggleProseCheck,
}: {
  documentSettings?: DocumentSettings;
  footnoteNumbers?: Record<string, number>;
  footnotes?: FootnoteNote[];
  onFootnote?: (id: string) => void;
  onFootnoteTextChange?: (id: string, text: string) => void;
  onEditorReady?: (editor: Editor | null) => void;
  layout?: PageLayout;
  onLayoutChange?: (layout: PageLayout) => void;
  onPageCountChange?: (count: number) => void;
  onPageStatus?: (status: { current: number; total: number }) => void;
  onComment?: () => void;
  header?: ReactNode;
  footer?: ReactNode;
  focusMode?: boolean;
  proseCheck?: boolean;
  onToggleFocusMode?: () => void;
  onToggleProseCheck?: () => void;
  item: Entry;
  onEdit: (content: JSONContent, text: string) => void;
  onExtract: (editor: Editor) => void;
  onLink: (current: string, apply: (url: string) => void) => void;
}) {
  const settingsRef = useRef(documentSettings);
  settingsRef.current = documentSettings;
  const focusModeRef = useRef(focusMode);
  focusModeRef.current = focusMode;
  const proseCheckRef = useRef(proseCheck);
  proseCheckRef.current = proseCheck;
  const pageStatusRef = useRef(onPageStatus);
  pageStatusRef.current = onPageStatus;
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
  const [panel, setPanel] = useState<ToolbarPanel | null>(null);
  const [overflowCount, setOverflowCount] = useState(0);
  const viewport = useRef<HTMLDivElement>(null);
  const barRef = useRef<HTMLDivElement>(null);
  const groupEls = useRef<Partial<Record<ToolbarGroup, HTMLElement | null>>>(
    {},
  );
  const groupWidths = useRef<Partial<Record<ToolbarGroup, number>>>({});
  const panelTriggers = useRef<
    Partial<Record<ToolbarPanel, HTMLButtonElement | null>>
  >({});
  const geometry = paperGeometry(layout);
  const [, render] = useState(0);
  const editor = useEditor({
    extensions: [
      ...documentExtensions(),
      FocusMode.configure({ enabled: () => focusModeRef.current }),
      ProseCheck.configure({ enabled: () => proseCheckRef.current }),
      indentKeys(
        () => settingsRef.current?.font === "mono",
        () => (settingsRef.current?.firstLineIndent ? 0.5 : 0),
      ),
      Placeholder.configure({ placeholder: "" }),
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
          event.key.toLowerCase() === "f"
        ) {
          event.preventDefault();
          onToggleFocusMode?.();
          return true;
        }
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
  const footnotePaper = useRef<HTMLDivElement>(null);
  const footnoteMeasure = useRef<HTMLDivElement>(null);
  const [editingNote, setEditingNote] = useState<string | null>(null);
  useEffect(() => {
    if (!editor) return;
    editor.view.dispatch(editor.state.tr
      .setMeta(focusModeKey, "refresh")
      .setMeta(proseCheckKey, "refresh"));
  }, [editor, focusMode, proseCheck]);
  const referencedIds: string[] = [];
  editor?.state.doc.descendants((node) => {
    const id =
      node.type.name === "footnoteReference" ? String(node.attrs.id) : "";
    if (id && !referencedIds.includes(id)) referencedIds.push(id);
  });
  const referencedKey = referencedIds.join("\n");
  const notes = referencedIds.flatMap((id) => {
    const note = footnotes?.find((item) => item.id === id);
    return note ? [note] : [];
  });
  const notesKey = JSON.stringify(notes);
  const { plan: footnotePlan, overlong: hasOverlongFootnote } =
    useFootnoteLayout({
      editor,
      layout,
      geometry,
      documentSettings,
      editingNote,
      notes,
      notesKey,
      paperRef: footnotePaper,
      measureRef: footnoteMeasure,
    });
  const knownNotes = useRef<Set<string> | null>(null);
  const pendingNotes = useRef<string[]>([]);
  useEffect(() => {
    knownNotes.current = null;
    pendingNotes.current = [];
  }, [item.id]);
  useEffect(() => {
    const ids = new Set(referencedIds);
    const known = knownNotes.current;
    if (known) {
      for (const id of ids) {
        if (!known.has(id) && !pendingNotes.current.includes(id))
          pendingNotes.current.push(id);
      }
    }
    knownNotes.current = ids;
    pendingNotes.current = pendingNotes.current.filter((id) => {
      if (!ids.has(id)) return false;
      const note = notes.find((item) => item.id === id);
      return !note || note.text === "";
    });
    const ready = pendingNotes.current.find((id) =>
      notes.some((item) => item.id === id && item.editable),
    );
    if (!ready) return;
    pendingNotes.current = pendingNotes.current.filter((id) => id !== ready);
    setEditingNote(ready);
  }, [referencedKey, notesKey]);
  useEffect(() => {
    if (editingNote && !notes.some((item) => item.id === editingNote))
      setEditingNote(null);
  }, [editingNote, notesKey]);
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
  useEffect(() => {
    pageStatusRef.current?.({
      current: Math.min(currentPage, pages),
      total: pages,
    });
  }, [currentPage, pages]);
  useEffect(() => {
    if (!panel) return;
    const dismiss = (event: PointerEvent) => {
      const target = event.target as Element | null;
      if (!target?.closest?.("[data-toolbar-panel]")) setPanel(null);
    };
    document.addEventListener("pointerdown", dismiss);
    return () => document.removeEventListener("pointerdown", dismiss);
  }, [panel]);
  const fitToolbar = () => {
    const bar = barRef.current;
    if (!bar) return;
    for (const id of Object.keys(groupEls.current) as ToolbarGroup[]) {
      const el = groupEls.current[id];
      if (el) groupWidths.current[id] = el.offsetWidth;
    }
    const widths = groupWidths.current;
    const style = getComputedStyle(bar);
    const available =
      bar.clientWidth -
      parseFloat(style.paddingLeft) -
      parseFloat(style.paddingRight);
    const sum = (ids: ToolbarGroup[]) =>
      ids.reduce((total, id) => total + (widths[id] ?? 0), 0);
    let count = OVERFLOW_ORDER.length;
    for (let k = 0; k <= OVERFLOW_ORDER.length; k++) {
      const visible = OVERFLOW_ORDER.slice(k);
      const total =
        sum(ALWAYS_VISIBLE) + sum(visible) + (k ? (widths.more ?? 40) : 0);
      if (total <= available) {
        count = k;
        break;
      }
    }
    setOverflowCount(count);
  };
  const linkActive = editor?.isActive("link") ?? false;
  useLayoutEffect(() => {
    fitToolbar();
    // Group widths only change when these inputs do; measuring on every
    // keystroke forces a full layout and slows typing.
  }, [editor, linkActive, documentSettings?.font, layout.mode, overflowCount]);
  useEffect(() => {
    const bar = barRef.current;
    if (!bar) return;
    const observer = new ResizeObserver(() => fitToolbar());
    observer.observe(bar);
    return () => observer.disconnect();
  }, [editor]);
  if (!editor) return null;
  const hidden = OVERFLOW_ORDER.slice(0, overflowCount);
  const closePanel = (name: ToolbarPanel) => {
    setPanel(
      name !== "more" && hidden.includes(name as ToolbarGroup) ? "more" : null,
    );
    panelTriggers.current[name]?.focus();
  };
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
  const paragraphValue = editor.isActive("heading", { level: 1 })
    ? "1"
    : editor.isActive("heading", { level: 2 })
      ? "2"
      : "0";
  const fontValue: string =
    editor.getAttributes("textFormat").fontFamily ?? defaultFont;
  const size =
    parseFloat(editor.getAttributes("textFormat").fontSize ?? "") ||
    defaultSize;
  const setSize = (n: number) =>
    editor
      .chain()
      .setMark("textFormat", { fontSize: `${Math.min(96, Math.max(8, n))}pt` })
      .run();
  const line = Number(paragraphAttrs.lineHeight ?? defaultLine);
  const marks = [
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
  ];
  const lists = [
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
  const iconButton = (t: {
    label: string;
    icon: LucideIcon;
    active: boolean;
    run: () => void;
  }) => (
    <button
      key={t.label}
      type="button"
      className="toolbar-icon"
      title={t.label}
      aria-label={t.label}
      aria-pressed={t.active}
      onClick={t.run}
    >
      <t.icon size={16} aria-hidden="true" />
    </button>
  );
  const groupBody = (id: ToolbarGroup): ReactNode => {
    switch (id) {
      case "history":
        return (
          <>
            <button
              type="button"
              className="toolbar-icon"
              title="Undo"
              aria-label="Undo"
              disabled={!editor.can().undo()}
              onClick={() => editor.chain().focus().undo().run()}
            >
              <Undo2 size={16} aria-hidden="true" />
            </button>
            <button
              type="button"
              className="toolbar-icon"
              title="Redo"
              aria-label="Redo"
              disabled={!editor.can().redo()}
              onClick={() => editor.chain().focus().redo().run()}
            >
              <Redo2 size={16} aria-hidden="true" />
            </button>
          </>
        );
      case "zoom":
        return (
          <Dropdown
            value={String(layout.zoom)}
            options={withCurrent(
              [50, 75, 100, 125, 150].map((n) => ({
                value: String(n),
                label: `${n}%`,
              })),
              String(layout.zoom),
              `${layout.zoom}%`,
            )}
            onChange={(value) => setLayout({ zoom: Number(value) })}
            label="Editor zoom"
            width={74}
          />
        );
      case "paragraph":
        return (
          <>
            <Dropdown
              value={paragraphValue}
              options={[
                { value: "0", label: "Normal text" },
                { value: "1", label: "Heading 1" },
                { value: "2", label: "Heading 2" },
              ]}
              onChange={(value) =>
                value === "0"
                  ? editor.chain().focus().setParagraph().run()
                  : editor
                      .chain()
                      .focus()
                      .toggleHeading({ level: Number(value) as 1 | 2 })
                      .run()
              }
              label="Paragraph style"
              width={104}
            />
            {documentSettings?.font === "mono" && (
              <Dropdown
                value={paragraphAttrs.paragraphStyle ?? "action"}
                options={screenplayStyles.map((style) => ({
                  value: style,
                  label: style[0].toUpperCase() + style.slice(1),
                }))}
                onChange={(style) =>
                  editor
                    .chain()
                    .focus()
                    .setParagraph()
                    .updateAttributes("paragraph", screenplayAttributes(style))
                    .run()
                }
                label="Screenplay paragraph style"
                title="Tab advances paragraph style; Shift Tab reverses"
                width={110}
              />
            )}
          </>
        );
      case "font":
        return (
          <Dropdown
            value={fontValue}
            options={withCurrent(
              FONT_FACES.map((f) => ({
                value: f,
                label: f.split(",")[0],
                style: { fontFamily: f },
              })),
              fontValue,
              fontValue.split(",")[0],
            )}
            onChange={(value) =>
              editor
                .chain()
                .focus()
                .setMark("textFormat", { fontFamily: value })
                .run()
            }
            label="Font family"
            width={124}
          />
        );
      case "size":
        return (
          <>
            <button
              type="button"
              className="toolbar-icon"
              title="Decrease font size"
              aria-label="Decrease font size"
              onClick={() => setSize(size - 1)}
            >
              <Minus size={14} aria-hidden="true" />
            </button>
            <NumberInput
              label="Font size"
              value={size}
              min={8}
              max={96}
              step={1}
              width={38}
              onCommit={setSize}
            />
            <button
              type="button"
              className="toolbar-icon"
              title="Increase font size"
              aria-label="Increase font size"
              onClick={() => setSize(size + 1)}
            >
              <Plus size={14} aria-hidden="true" />
            </button>
          </>
        );
      case "marks":
        return marks.map(iconButton);
      case "link":
        return (
          <>
            <button
              type="button"
              className="toolbar-icon"
              title="Add link"
              aria-label="Add link"
              onClick={() =>
                onLink(editor.getAttributes("link").href ?? "", (url) =>
                  editor.chain().focus().setLink({ href: url }).run(),
                )
              }
            >
              <LinkIcon size={16} aria-hidden="true" />
            </button>
            {editor.isActive("link") && (
              <button
                type="button"
                className="toolbar-icon"
                title="Remove link"
                aria-label="Remove link"
                onClick={() => editor.chain().focus().unsetLink().run()}
              >
                <Unlink size={16} aria-hidden="true" />
              </button>
            )}
          </>
        );
      case "lists":
        return lists.map(iconButton);
      case "indent":
        return (
          <>
            <button
              type="button"
              className="toolbar-icon"
              title="Decrease indent"
              aria-label="Decrease indent"
              onClick={() => changeIndent(editor, -1)}
            >
              <IndentDecrease size={16} aria-hidden="true" />
            </button>
            <button
              type="button"
              className="toolbar-icon"
              title="Increase indent"
              aria-label="Increase indent"
              onClick={() => changeIndent(editor, 1)}
            >
              <IndentIncrease size={16} aria-hidden="true" />
            </button>
          </>
        );
      case "spacing":
        return (
          <PanelButton
            label="Line and paragraph spacing"
            dialogLabel="Line and paragraph spacing"
            icon={BetweenHorizontalStart}
            open={panel === "spacing"}
            onToggle={() => setPanel(panel === "spacing" ? null : "spacing")}
            onEscape={() => closePanel("spacing")}
            buttonRef={(el) => {
              panelTriggers.current.spacing = el;
            }}
          >
            <div className="toolbar-popover-body">
              <span className="toolbar-field-title">Line spacing</span>
              <div className="toolbar-presets">
                {LINE_PRESETS.map((preset) => (
                  <button
                    key={preset.label}
                    type="button"
                    aria-pressed={line === preset.value}
                    onClick={() =>
                      setParagraphFormat("lineHeight", String(preset.value))
                    }
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
              <div className="toolbar-field">
                <span>Custom</span>
                <NumberInput
                  label="Custom line spacing"
                  value={line}
                  min={0.8}
                  max={5}
                  step={0.05}
                  width={64}
                  onCommit={(n) => setParagraphFormat("lineHeight", String(n))}
                />
              </div>
              <div className="toolbar-field">
                <span>Space before</span>
                <span className="toolbar-field-unit">
                  <NumberInput
                    label="Paragraph spacing before"
                    value={parseFloat(paragraphAttrs.spaceBefore ?? "0") || 0}
                    min={0}
                    max={144}
                    step={1}
                    width={56}
                    onCommit={(n) =>
                      setParagraphFormat("spaceBefore", `${n}pt`)
                    }
                  />
                  pt
                </span>
              </div>
              <div className="toolbar-field">
                <span>Space after</span>
                <span className="toolbar-field-unit">
                  <NumberInput
                    label="Paragraph spacing after"
                    value={parseFloat(paragraphAttrs.spaceAfter ?? "0") || 0}
                    min={0}
                    max={144}
                    step={1}
                    width={56}
                    onCommit={(n) => setParagraphFormat("spaceAfter", `${n}pt`)}
                  />
                  pt
                </span>
              </div>
            </div>
          </PanelButton>
        );
      case "view":
        return (
          <button
            type="button"
            className="toolbar-icon"
            title={layout.mode === "pages" ? "Page view" : "Continuous view"}
            aria-label="Page view"
            aria-pressed={layout.mode === "pages"}
            onClick={() =>
              setLayout({
                mode: layout.mode === "pages" ? "continuous" : "pages",
              })
            }
          >
            {layout.mode === "pages" ? (
              <FileText size={16} aria-hidden="true" />
            ) : (
              <AlignJustify size={16} aria-hidden="true" />
            )}
          </button>
        );
      case "aids": {
        const decorations = proseCheckKey.getState(editor.state)?.find() ?? [];
        const kinds: ProseIssue["kind"][] = ["repeat", "passive", "filler", "long"];
        const issues = decorations.flatMap((decoration) => {
          const spec = (decoration.spec ?? {}) as Partial<ProseIssue>;
          const kind = spec.kind as ProseIssue["kind"];
          if (!kinds.includes(kind)) return [];
          return [{ from: decoration.from, to: decoration.to, kind, message: String(spec.message ?? "") }];
        });
        const counts = kinds.map((kind) => `${kind[0].toUpperCase()}${kind.slice(1)} ${issues.filter((issue) => issue.kind === kind).length}`).join(" -- ");
        return (
          <>
            <button type="button" className="toolbar-icon" title="Focus mode" aria-label="Focus mode" aria-pressed={focusMode} onClick={() => onToggleFocusMode?.()}>
              <Focus size={16} aria-hidden="true" />
            </button>
            <PanelButton
              label="Prose check"
              dialogLabel="Prose check"
              icon={Settings2}
              open={panel === "aids"}
              onToggle={() => setPanel(panel === "aids" ? null : "aids")}
              onEscape={() => closePanel("aids")}
              buttonRef={(el) => { panelTriggers.current.aids = el; }}
            >
              <div className="toolbar-popover-body prose-check-panel">
                <label className="toolbar-field"><span>On</span><input type="checkbox" checked={proseCheck} onChange={() => onToggleProseCheck?.()} /></label>
                <span className="toolbar-field-title" aria-live="polite">{counts}</span>
                {decorations.length >= MAX_PROSE_DECORATIONS && <span className="toolbar-field-title">Only the issues closest to the cursor are shown.</span>}
                <div className="prose-issues" aria-label="Prose issues">
                  {issues.map((issue, index) => {
                    const excerpt = editor.state.doc.textBetween(issue.from, issue.to, " ");
                    return <button key={`${issue.from}-${index}`} type="button" className="toolbar-text-button" title={issue.message} onClick={() => editor.chain().focus().setTextSelection({ from: issue.from, to: issue.to }).scrollIntoView().run()}><span>{excerpt}</span><span>{issue.message}</span></button>;
                  })}
                  {issues.length === 0 && <span className="toolbar-field-title">No issues found.</span>}
                </div>
              </div>
            </PanelButton>
          </>
        );
      }
      case "setup":
        return (
          <PanelButton
            label="Page setup"
            dialogLabel="Page setup"
            icon={Settings2}
            align="end"
            open={panel === "setup"}
            onToggle={() => setPanel(panel === "setup" ? null : "setup")}
            onEscape={() => closePanel("setup")}
            buttonRef={(el) => {
              panelTriggers.current.setup = el;
            }}
          >
            <div className="toolbar-popover-body">
              <div className="toolbar-field">
                <span>Paper</span>
                <Dropdown
                  value={layout.paper}
                  options={[
                    { value: "letter", label: "Letter" },
                    { value: "a4", label: "A4" },
                  ]}
                  onChange={(paper) =>
                    setLayout({ paper: paper as PageLayout["paper"] })
                  }
                  label="Paper size"
                  width={112}
                />
              </div>
              <div className="toolbar-field">
                <span>Margins</span>
                <Dropdown
                  value={String(layout.margin)}
                  options={withCurrent(
                    [
                      { value: "48", label: "½ inch" },
                      { value: "72", label: "¾ inch" },
                      { value: "96", label: "1 inch" },
                    ],
                    String(layout.margin),
                    `${+(layout.margin / 96).toFixed(2)} inch`,
                  )}
                  onChange={(value) => setLayout({ margin: Number(value) })}
                  label="Page margins"
                  width={112}
                />
              </div>
              <button
                type="button"
                className="toolbar-text-button"
                onClick={() => {
                  setPanel(null);
                  editor
                    .chain()
                    .focus()
                    .insertContent([
                      { type: "pageBreak" },
                      { type: "paragraph" },
                    ])
                    .run();
                }}
              >
                Insert page break
              </button>
            </div>
          </PanelButton>
        );
      case "more":
        return (
          <PanelButton
            label="More formatting"
            dialogLabel="More formatting"
            icon={Ellipsis}
            align="end"
            isMore
            open={
              panel === "more" ||
              (panel !== null && hidden.includes(panel as ToolbarGroup))
            }
            onToggle={() => setPanel(panel === "more" ? null : "more")}
            onEscape={() => closePanel("more")}
            buttonRef={(el) => {
              panelTriggers.current.more = el;
            }}
          >
            {TOOLBAR_ORDER.filter((id) => hidden.includes(id)).map((group) =>
              renderGroup(group, true),
            )}
          </PanelButton>
        );
      case "right":
        return (
          <>
            <button
              type="button"
              className="toolbar-icon"
              title="Comment on selection"
              aria-label="Comment on selection"
              disabled={editor.state.selection.empty}
              onClick={() => onComment?.()}
            >
              <MessageSquarePlus size={16} aria-hidden="true" />
            </button>
            {item.kind === "section" && (
              <button
                type="button"
                className="extract"
                aria-label="Keep as fragment"
                disabled={editor.state.selection.empty}
                title="Move selection to Fragments (⌘⇧X)"
                onClick={() => onExtract(editor)}
              >
                <Scissors size={15} aria-hidden="true" />
                <span>Keep as fragment</span>
              </button>
            )}
          </>
        );
    }
  };
  const renderGroup = (id: ToolbarGroup, inMore = false) => (
    <span
      key={id}
      className={
        "toolbar-group" +
        (id === "right" ? " is-end" : "") +
        (inMore ? " in-more" : "")
      }
      ref={
        inMore
          ? undefined
          : (el) => {
              groupEls.current[id] = el;
            }
      }
    >
      {!inMore && id !== "history" && id !== "right" && (
        <span className="toolbar-divider" aria-hidden="true" />
      )}
      {groupBody(id)}
    </span>
  );
  return (
    <div className="writer">
      <div
        className="format-bar"
        role="toolbar"
        aria-label="Formatting"
        ref={barRef}
      >
        {TOOLBAR_ORDER.filter((id) =>
          id === "more" ? hidden.length > 0 : !hidden.includes(id),
        ).map((id) => renderGroup(id))}
      </div>
      <div className="writer-scroll">
        {header && <div className="writer-slot">{header}</div>}
        {layout.mode === "pages" && hasOverlongFootnote && (
          <div className="footnote-overflow" role="status">
            <span>A footnote is too long to fit on its page.</span>
            <button
              type="button"
              onClick={() => setLayout({ mode: "continuous" })}
            >
              Switch to continuous view
            </button>
          </div>
        )}
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
          <div className="editor-paper" style={pageStyle} ref={footnotePaper}>
            <EditorContent editor={editor} />
            {notes.length > 0 && layout.mode === "continuous" && (
              <FootnoteBlock
                className="footnote-area"
                label="Footnotes"
                notes={notes}
                editingId={editingNote}
                onEdit={setEditingNote}
                onEditEnd={() => setEditingNote(null)}
                onTextChange={onFootnoteTextChange}
                onSourceDetails={onFootnote}
              />
            )}
            {notes.length > 0 && layout.mode === "pages" && (
              <div
                className="footnote-measure"
                aria-hidden="true"
                ref={footnoteMeasure}
              >
                <FootnoteRows
                  notes={notes}
                  measuring
                  editingId={editingNote}
                  onEdit={setEditingNote}
                  onEditEnd={() => setEditingNote(null)}
                />
              </div>
            )}
            {layout.mode === "pages" &&
              footnotePlan?.pages.map((group) => {
                const groupNotes = group.ids.flatMap((id) =>
                  notes.filter((note) => note.id === id),
                );
                if (!groupNotes.length) return null;
                return (
                  <FootnoteBlock
                    key={group.page}
                    className="page-footnotes"
                    label={`Footnotes, page ${group.page + 1}`}
                    style={{
                      left:
                        group.page * (geometry.width + geometry.gap) +
                        geometry.margin,
                      top:
                        geometry.margin +
                        geometry.contentHeight -
                        footnotePlan.reserve +
                        8,
                      width: geometry.contentWidth,
                    }}
                    notes={groupNotes}
                    editingId={editingNote}
                    onEdit={setEditingNote}
                    onEditEnd={() => setEditingNote(null)}
                    onTextChange={onFootnoteTextChange}
                    onSourceDetails={onFootnote}
                  />
                );
              })}
          </div>
        </div>
        {footer && <div className="writer-slot">{footer}</div>}
      </div>
    </div>
  );
}
