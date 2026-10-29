import {
  useEditor,
  EditorContent,
  type Editor,
  type JSONContent,
} from "@tiptap/react";
import { TextSelection, type Transaction } from "@tiptap/pm/state";
import type { EditorProps } from "@tiptap/pm/view";
import { cellAround } from "@tiptap/pm/tables";
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
  Image as ImageIcon,
  Table as TableIcon,
  type LucideIcon,
} from "lucide-react";
import {
  useState,
  useEffect,
  useLayoutEffect,
  useRef,
  useMemo,
  useCallback,
  type CSSProperties,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import {
  defaultPageLayout,
  paperGeometry,
  type PageLayout,
  screenplayStyles,
  screenplayAttributes,
} from "./editor/formatting";
import "./editor/editor.css";
import "./editor/toolbar-motion.css";
import { useDock } from "./components/dock";
import { documentExtensions } from "./editor/extensions";
import { Pagination, paginate, paginationKey } from "./editor/pagination";
import { TableContextMenu } from "./editor/TableContextMenu";
import { setImageSourceResolver } from "./editor/media";
import {
  FocusMode,
  ProseCheck,
  focusModeKey,
  proseCheckKey,
  defaultProseRules,
  type ProseRules,
} from "./editor/writingAids";
import type { ProseIssue } from "./editor/proseCheck";
import { changeIndent, indentKeys } from "./editor/indent";
import { NumberInput, PanelButton } from "./editor/ToolbarControls";
import { Popover } from "./components/Popover";
import { shortcutHints, visibleLabel } from "./editor/shortcuts";
import { resolveChord, type ShortcutOverrides } from "./shortcuts/store";
import {
  FootnoteBlock,
  FootnoteRows,
  type FootnoteNote,
} from "./editor/FootnoteArea";
import { useFootnoteLayout } from "./editor/useFootnoteLayout";
import { Dropdown, type DropdownOption } from "./components/Dropdown";
import { ProseIssues } from "./components/ProseIssues";
import type { DocumentSettings } from "./research/types";
import { type Entry } from "./model";

type ToolbarPanel = "spacing" | "setup" | "more" | "aids" | "table";
type ToolbarGroup =
  | "history"
  | "zoom"
  | "paragraph"
  | "font"
  | "size"
  | "marks"
  | "link"
  | "insert"
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
  "insert",
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
  "insert",
  "lists",
  "link",
  "marks",
  "size",
  "font",
  "paragraph",
  "zoom",
];
const ALWAYS_VISIBLE: ToolbarGroup[] = ["history", "right"];
type GroupWidths = Partial<Record<ToolbarGroup, number>>;
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

const NO_SHORTCUT_OVERRIDES: ShortcutOverrides = {};

export function Writer({
  item,
  onEdit,
  onExtract,
  onLink,
  onInsertImage,
  resolveAsset,
  layout: controlledLayout,
  onLayoutChange,
  onPageCountChange,
  onPageStatus,
  onEditorReady,
  onComment,
  onSelectionChange,
  documentSettings,
  footnoteNumbers,
  footnotes,
  onFootnote,
  onFootnoteTextChange,
  onFootnoteDelete,
  header,
  footer,
  focusMode = false,
  proseCheck = false,
  onToggleFocusMode,
  onToggleProseCheck,
  toolbarTarget,
  showToolbar = true,
  editorLabel = "Writing editor",
  shortcuts = NO_SHORTCUT_OVERRIDES,
}: {
  /** Split view: the format bar renders into this shared slot instead. */
  toolbarTarget?: HTMLElement | null;
  /** Split view: only the focused pane shows its format bar. */
  showToolbar?: boolean;
  editorLabel?: string;
  documentSettings?: DocumentSettings;
  footnoteNumbers?: Record<string, number>;
  footnotes?: FootnoteNote[];
  onFootnote?: (id: string) => void;
  onFootnoteTextChange?: (id: string, text: string) => void;
  /** Called just before an empty source-less note's marker is deleted. */
  onFootnoteDelete?: (id: string) => void;
  onEditorReady?: (editor: Editor | null) => void;
  layout?: PageLayout;
  onLayoutChange?: (layout: PageLayout) => void;
  onPageCountChange?: (count: number) => void;
  onPageStatus?: (status: { current: number; total: number }) => void;
  onComment?: () => void;
  onSelectionChange?: (editor: Editor) => void;
  header?: ReactNode;
  footer?: ReactNode;
  /** The user's rebound chords; empty means the defaults. */
  shortcuts?: ShortcutOverrides;
  focusMode?: boolean;
  proseCheck?: boolean;
  onToggleFocusMode?: () => void;
  onToggleProseCheck?: () => void;
  item: Entry;
  onEdit: (
    content: JSONContent,
    text: string,
    transaction: Transaction,
  ) => void;
  onExtract: (editor: Editor) => void;
  onLink: (current: string, apply: (url: string) => void) => void;
  onInsertImage?: (file: File) => Promise<{
    assetId: string;
    alt: string;
    width?: number | null;
    height?: number | null;
  } | null>;
  resolveAsset?: (id: string) => Promise<string | null>;
}) {
  const settingsRef = useRef(documentSettings);
  settingsRef.current = documentSettings;
  const shortcutsRef = useRef(shortcuts);
  shortcutsRef.current = shortcuts;
  const hints = useMemo(() => shortcutHints(shortcuts), [shortcuts]);
  const focusModeRef = useRef(focusMode);
  focusModeRef.current = focusMode;
  const proseCheckRef = useRef(proseCheck);
  proseCheckRef.current = proseCheck;
  const itemRef = useRef(item);
  itemRef.current = item;
  const callbacksRef = useRef({
    onToggleFocusMode,
    onToggleProseCheck,
    onExtract,
  });
  callbacksRef.current = { onToggleFocusMode, onToggleProseCheck, onExtract };
  const analysisRevisionRef = useRef({
    entryId: item.id,
    revision: item.contentRevision ?? 0,
  });
  if (analysisRevisionRef.current.entryId !== item.id) {
    analysisRevisionRef.current = {
      entryId: item.id,
      revision: item.contentRevision ?? 0,
    };
  } else if (
    (item.contentRevision ?? 0) > analysisRevisionRef.current.revision
  ) {
    analysisRevisionRef.current.revision = item.contentRevision ?? 0;
  }
  const [proseRules, setProseRules] = useState<ProseRules>(defaultProseRules);
  const proseRulesRef = useRef(proseRules);
  proseRulesRef.current = proseRules;
  const [proseIssues, setProseIssues] = useState<ProseIssue[]>([]);
  const [prosePending, setProsePending] = useState(false);
  const [proseUnavailable, setProseUnavailable] = useState(false);
  const [dismissedIssues, setDismissedIssues] = useState<Set<string>>(
    () => new Set(),
  );
  const dismissedIssuesRef = useRef(dismissedIssues);
  dismissedIssuesRef.current = dismissedIssues;
  const [prosePage, setProsePage] = useState(0);
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
  const [fitScale, setFitScale] = useState(1);
  const [panel, setPanel] = useState<ToolbarPanel | null>(null);
  const [tableMenuAt, setTableMenuAt] = useState<{
    x: number;
    y: number;
  } | null>(null);
  const [overflowCount, setOverflowCount] = useState(0);
  const viewport = useRef<HTMLDivElement>(null);
  const barRef = useRef<HTMLDivElement | null>(null);
  // State, not just a ref, so the observer re-attaches when the bar remounts.
  const [barEl, setBarEl] = useState<HTMLDivElement | null>(null);
  const setBar = useCallback((el: HTMLDivElement | null) => {
    barRef.current = el;
    setBarEl(el);
  }, []);
  useDock(barRef, barEl);
  // Focus mode hides the bar until it is needed: the pointer nears the top of
  // the writing area, keyboard focus enters the bar, or the focusToolbar
  // shortcut runs. A pointer reveal animates; a keyboard reveal is instant.
  const [revealed, setRevealed] = useState(false);
  const [revealByKey, setRevealByKey] = useState(false);
  const revealedRef = useRef(false);
  const hideTimer = useRef<number | undefined>(undefined);
  const panelOpenRef = useRef(false);
  panelOpenRef.current = panel !== null;
  // Only the single-pane bar hides in focus mode: split view's shared bar (toolbarTarget set) stays
  // visible, so neither pane jumps and the bar never covers the pane headers.
  const hidesBar = focusMode && showToolbar && toolbarTarget === undefined;
  const reveal = useCallback((byKey: boolean) => {
    window.clearTimeout(hideTimer.current);
    hideTimer.current = undefined;
    revealedRef.current = true;
    setRevealed(true);
    if (byKey) setRevealByKey(true);
  }, []);
  const scheduleHide = useCallback(() => {
    if (!revealedRef.current || hideTimer.current !== undefined) return;
    hideTimer.current = window.setTimeout(() => {
      hideTimer.current = undefined;
      if (panelOpenRef.current) return;
      if (barRef.current?.contains(document.activeElement)) return;
      revealedRef.current = false;
      setRevealed(false);
    }, 600);
  }, []);
  const hideNow = useCallback(() => {
    window.clearTimeout(hideTimer.current);
    hideTimer.current = undefined;
    revealedRef.current = false;
    setRevealed(false);
  }, []);
  useEffect(() => {
    if (!hidesBar) {
      hideNow();
      setRevealByKey(false);
      return;
    }
    let frame = 0;
    let last: PointerEvent | null = null;
    const onMove = () => {
      frame = 0;
      const bar = barRef.current;
      const host = bar?.parentElement;
      if (!bar || !host || !last) return;
      const rect = host.getBoundingClientRect();
      const nearTop =
        last.clientX >= rect.left &&
        last.clientX <= rect.right &&
        last.clientY >= rect.top &&
        last.clientY <= rect.top + 56;
      const overBar = last.target instanceof Node && bar.contains(last.target);
      if (nearTop || (revealedRef.current && overBar)) {
        setRevealByKey(false);
        reveal(false);
      } else scheduleHide();
    };
    const onPointer = (event: PointerEvent) => {
      last = event;
      if (!frame) frame = requestAnimationFrame(onMove);
    };
    document.addEventListener("pointermove", onPointer);
    return () => {
      document.removeEventListener("pointermove", onPointer);
      cancelAnimationFrame(frame);
      window.clearTimeout(hideTimer.current);
      hideTimer.current = undefined;
    };
  }, [hidesBar, reveal, scheduleHide, hideNow]);
  const focusToolbarNow = () => {
    reveal(true);
    barRef.current
      ?.querySelector<HTMLElement>("button:not(:disabled)")
      ?.focus();
  };
  const focusToolbarRef = useRef(focusToolbarNow);
  focusToolbarRef.current = focusToolbarNow;
  const groupEls = useRef<Partial<Record<ToolbarGroup, HTMLElement | null>>>(
    {},
  );
  const groupWidths = useRef<GroupWidths>({});
  const panelTriggers = useRef<
    Partial<Record<ToolbarPanel, HTMLButtonElement | null>>
  >({});
  const fileInputRef = useRef<HTMLInputElement>(null);
  const altInputRef = useRef<HTMLInputElement>(null);
  const imageButtonRef = useRef<HTMLButtonElement>(null);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [altText, setAltText] = useState("");
  const [isInsertingImage, setIsInsertingImage] = useState(false);

  useEffect(() => {
    const cache = new Map<string, string>();
    if (resolveAsset) {
      setImageSourceResolver(async (assetId: string) => {
        const cached = cache.get(assetId);
        if (cached) return cached;
        const url = await resolveAsset(assetId);
        if (url) cache.set(assetId, url);
        return url;
      });
    } else {
      setImageSourceResolver(null);
    }
    return () => {
      setImageSourceResolver(null);
      for (const url of cache.values()) {
        if (url.startsWith("blob:")) {
          try {
            URL.revokeObjectURL(url);
          } catch {
            // ignore
          }
        }
      }
      cache.clear();
    };
  }, [resolveAsset, item.id]);

  useEffect(() => {
    if (pendingFile) {
      altInputRef.current?.focus();
    }
  }, [pendingFile]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && (file.type === "image/png" || file.type === "image/jpeg")) {
      setPendingFile(file);
      setAltText("");
    }
  };

  const handleCancelImage = () => {
    setPendingFile(null);
    setAltText("");
    if (fileInputRef.current) fileInputRef.current.value = "";
    editorRef.current?.chain().focus().run();
  };

  const handleCommitImage = async () => {
    const editor = editorRef.current;
    if (!pendingFile || !editor) return;
    const file = pendingFile;
    const customAlt = altText.trim();
    setIsInsertingImage(true);
    try {
      if (onInsertImage) {
        const res = await onInsertImage(file);
        if (res && res.assetId) {
          editor
            .chain()
            .focus()
            .insertImage({
              assetId: res.assetId,
              alt: customAlt || res.alt || "",
              width: res.width ?? null,
              height: res.height ?? null,
            })
            .run();
        }
      }
    } finally {
      setIsInsertingImage(false);
      setPendingFile(null);
      setAltText("");
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };
  const geometry = paperGeometry(layout);
  const [, render] = useState(0);
  const initialContentRef = useRef(item.content);
  const editorRef = useRef<Editor | null>(null);
  const writerRootRef = useRef<HTMLDivElement>(null);
  const editorExtensions = useMemo(
    () => [
      ...documentExtensions(),
      Pagination,
      FocusMode.configure({ enabled: () => focusModeRef.current }),
      ProseCheck.configure({
        enabled: () => proseCheckRef.current,
        getContext: () => ({
          entryId: itemRef.current.id,
          revision: analysisRevisionRef.current.revision,
        }),
        getRules: () => proseRulesRef.current,
        getDismissed: () => dismissedIssuesRef.current,
        onIssues: (issues) => {
          setProseIssues(issues);
          setProsePage(0);
          setProsePending(false);
        },
        onPending: () => setProsePending(true),
        onUnavailable: () => setProseUnavailable(true),
      }),
      indentKeys(
        () => settingsRef.current?.font === "mono",
        () => (settingsRef.current?.firstLineIndent ? 0.5 : 0),
      ),
      Placeholder.configure({ placeholder: "" }),
    ],
    [],
  );
  const editorProps = useMemo<EditorProps>(
    () => ({
      attributes: {
        class: "writing-surface",
        "aria-label": editorLabel,
        spellcheck: "true",
      },
      handleDOMEvents: {
        contextmenu: (view, event) => {
          const mouse = event as MouseEvent;
          const target = mouse.target instanceof Element ? mouse.target : null;
          const cell = target?.closest("td, th");
          const root = writerRootRef.current;
          if (!cell || !view.dom.contains(cell) || !root) return false;
          let position = view.posAtCoords({
            left: mouse.clientX,
            top: mouse.clientY,
          })?.pos;
          if (position == null) position = view.posAtDOM(cell, 0);
          const $position = view.state.doc.resolve(position);
          if (!cellAround($position)) return false;
          const rect = root.getBoundingClientRect();
          mouse.preventDefault();
          view.dispatch(
            view.state.tr
              .setSelection(TextSelection.near($position, 1))
              .scrollIntoView(),
          );
          setTableMenuAt({
            x: mouse.clientX - rect.left,
            y: mouse.clientY - rect.top,
          });
          return true;
        },
      },
      handleKeyDown: (_, event) => {
        const action = resolveChord(event, shortcutsRef.current);
        if (action === "focusMode") {
          event.preventDefault();
          callbacksRef.current.onToggleFocusMode?.();
          return true;
        }
        if (action === "focusToolbar") {
          event.preventDefault();
          focusToolbarRef.current();
          return true;
        }
        const activeEditor = editorRef.current;
        if (
          (event.key === "ContextMenu" ||
            (event.key === "F10" && event.shiftKey)) &&
          activeEditor &&
          cellAround(activeEditor.state.selection.$from) &&
          writerRootRef.current
        ) {
          const coords = activeEditor.view.coordsAtPos(
            activeEditor.state.selection.from,
          );
          const rect = writerRootRef.current.getBoundingClientRect();
          event.preventDefault();
          setTableMenuAt({
            x: coords.left - rect.left,
            y: coords.bottom - rect.top,
          });
          return true;
        }
        if (
          event.key === "Tab" &&
          settingsRef.current?.font === "mono" &&
          activeEditor
        ) {
          event.preventDefault();
          const current =
            activeEditor.getAttributes("paragraph").paragraphStyle;
          const index = screenplayStyles.indexOf(current);
          const next =
            screenplayStyles[(index + (event.shiftKey ? 4 : 1) + 5) % 5];
          activeEditor
            .chain()
            .updateAttributes("paragraph", screenplayAttributes(next))
            .run();
          return true;
        }
        if (action === "keepAsFragment" && itemRef.current.kind === "section") {
          event.preventDefault();
          if (activeEditor) callbacksRef.current.onExtract(activeEditor);
          return true;
        }
        return false;
      },
    }),
    [],
  );
  const editor = useEditor({
    extensions: editorExtensions,
    content: initialContentRef.current,
    editorProps,
    onUpdate: ({ editor, transaction }) => {
      if (transaction.docChanged) {
        if (analysisRevisionRef.current.entryId === itemRef.current.id)
          analysisRevisionRef.current.revision += 1;
        else
          analysisRevisionRef.current = {
            entryId: itemRef.current.id,
            revision: (itemRef.current.contentRevision ?? 0) + 1,
          };
        onEdit(editor.getJSON(), editor.getText(), transaction);
      }
    },
    onSelectionUpdate: ({ editor }) => {
      render((x) => x + 1);
      onSelectionChange?.(editor);
    },
    onTransaction: () => render((x) => x + 1),
  });
  editorRef.current = editor;
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
  const deleteEmptyNote = (id: string) => {
    if (!editor) return;
    const markers: { pos: number; size: number }[] = [];
    editor.state.doc.descendants((node, pos) => {
      if (markers.length) return false;
      if (node.type.name !== "footnoteReference") return undefined;
      if (String(node.attrs.id) !== id) return undefined;
      markers.push({ pos, size: node.nodeSize });
      return false;
    });
    const [marker] = markers;
    if (!marker) return;
    setEditingNote(null);
    onFootnoteDelete?.(id);
    editor
      .chain()
      .focus()
      .deleteRange({ from: marker.pos, to: marker.pos + marker.size })
      .setTextSelection(marker.pos)
      .run();
  };
  useEffect(() => {
    if (!editor) return;
    editor.view.dispatch(
      editor.state.tr
        .setMeta(focusModeKey, "refresh")
        .setMeta(proseCheckKey, "refresh"),
    );
  }, [editor, focusMode, proseCheck]);
  useEffect(() => {
    setProseUnavailable(false);
    setProsePending(proseCheck);
    setProsePage(0);
    if (!editor) return;
    editor.view.dispatch(editor.state.tr.setMeta(proseCheckKey, "refresh"));
  }, [editor, proseRules, dismissedIssues, item.id, proseCheck]);
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
    const read = () => {
      const count =
        layout.mode === "pages"
          ? (paginationKey.getState(editor.state)?.pageCount ?? 1)
          : 1;
      setPages(count);
      onPageCountChange?.(count);
    };
    // Layout props change the CSS variables the pagination plugin reads (and
    // the margins it caches); measure again once they are painted.
    const frame = requestAnimationFrame(() => {
      paginate(editor.view, true);
      read();
    });
    editor.on("transaction", read);
    return () => {
      editor.off("transaction", read);
      cancelAnimationFrame(frame);
    };
  }, [
    editor,
    layout.mode,
    layout.paper,
    layout.margin,
    documentSettings,
    layout.zoom,
    fitScale,
    onPageCountChange,
  ]);
  useEffect(() => {
    // A pane narrower than the page scales the paper down (CSS zoom) instead
    // of scrolling sideways.
    const element = viewport.current;
    if (!element || layout.mode !== "pages") {
      setFitScale(1);
      return;
    }
    const fit = () => {
      const style = getComputedStyle(element);
      const available =
        element.clientWidth -
        parseFloat(style.paddingLeft) -
        parseFloat(style.paddingRight);
      const natural = (geometry.width * layout.zoom) / 100;
      const next = Math.min(1, Math.max(0.25, available / natural));
      setFitScale((previous) =>
        Math.abs(previous - next) < 0.001 ? previous : next,
      );
    };
    const observer = new ResizeObserver(fit);
    observer.observe(element);
    fit();
    return () => observer.disconnect();
  }, [editor, layout.mode, layout.zoom, geometry.width]);
  useEffect(() => {
    // Pages stack vertically and an ancestor scrolls. Listen on the document
    // and use only scrollers that hold this Writer's pages (in split view the
    // other pane's scroll must not move this pane's page number).
    if (layout.mode !== "pages") return;
    const onScroll = (event: Event) => {
      const element = viewport.current;
      const scroller = event.target;
      if (
        !element ||
        !(scroller instanceof Element) ||
        !scroller.contains(element)
      )
        return;
      const padding = parseFloat(getComputedStyle(element).paddingTop) || 0;
      // The viewport itself is not zoomed, so its box is in screen px.
      const offset =
        scroller === element
          ? element.scrollTop - padding
          : scroller.getBoundingClientRect().top -
            (element.getBoundingClientRect().top + padding);
      const pitch =
        (geometry.height + geometry.gap) * (layout.zoom / 100) * fitScale;
      setCurrentPage(Math.max(1, Math.floor((offset + pitch / 3) / pitch) + 1));
    };
    document.addEventListener("scroll", onScroll, {
      capture: true,
      passive: true,
    });
    return () =>
      document.removeEventListener("scroll", onScroll, { capture: true });
  }, [layout.mode, layout.zoom, fitScale, geometry.height, geometry.gap]);
  useEffect(() => {
    pageStatusRef.current?.({
      current: Math.min(currentPage, pages),
      total: pages,
    });
  }, [currentPage, pages, Boolean(onPageStatus)]);
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
    const widths = groupWidths.current;
    for (const id of Object.keys(groupEls.current) as ToolbarGroup[]) {
      const el = groupEls.current[id];
      if (el) widths[id] = el.offsetWidth;
    }
    const style = getComputedStyle(bar);
    const available =
      bar.clientWidth -
      parseFloat(style.paddingLeft) -
      parseFloat(style.paddingRight);
    // Groups are separated by the bar's gap, which is not part of their widths.
    const gap = parseFloat(style.columnGap) || 0;
    const sum = (ids: ToolbarGroup[]) =>
      ids.reduce((total, id) => total + (widths[id] ?? 0), 0);
    let count = OVERFLOW_ORDER.length;
    for (let k = 0; k <= OVERFLOW_ORDER.length; k++) {
      const visible = OVERFLOW_ORDER.slice(k);
      const children = ALWAYS_VISIBLE.length + visible.length + (k ? 1 : 0);
      const total =
        sum(ALWAYS_VISIBLE) +
        sum(visible) +
        (k ? (widths.more ?? 40) : 0) +
        gap * Math.max(0, children - 1);
      if (total <= available) {
        count = k;
        break;
      }
    }
    setOverflowCount(count);
  };
  const linkActive = editor?.isActive("link") ?? false;
  const tableActive = editor?.isActive("table") ?? false;
  useLayoutEffect(() => {
    fitToolbar();
    // Group widths only change when these inputs do; measuring on every
    // keystroke forces a full layout and slows typing.
  }, [
    editor,
    linkActive,
    tableActive,
    documentSettings?.font,
    layout.mode,
    overflowCount,
    showToolbar,
    toolbarTarget,
  ]);
  useEffect(() => {
    if (!barEl) return;
    const observer = new ResizeObserver(() => fitToolbar());
    observer.observe(barEl);
    return () => observer.disconnect();
  }, [editor, barEl]);
  if (!editor) return null;
  const hidden = OVERFLOW_ORDER.slice(0, overflowCount);
  const closePanel = (name: ToolbarPanel) => {
    const isHidden =
      name === "table"
        ? hidden.includes("insert")
        : hidden.includes(name as ToolbarGroup);
    setPanel(name !== "more" && isHidden ? "more" : null);
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
    "--page-scale": fitScale,
    zoom: (layout.zoom / 100) * (layout.mode === "pages" ? fitScale : 1),
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
  // Inside the More menu every control is a menu row: it takes part in the
  // sliding highlight and shows its shortcut. Elsewhere only the label span
  // (hidden unless the bar is wide enough) is added.
  const popoverItem = (inMore: boolean) =>
    inMore ? { "data-popover-item": "" } : {};
  const toolbarLabel = (label: string, inMore: boolean) => (
    <>
      <span className="toolbar-label" aria-hidden="true">
        {visibleLabel(label)}
      </span>
      {inMore && hints[label] && (
        <span className="popover-shortcut" aria-hidden="true">
          {hints[label]}
        </span>
      )}
    </>
  );
  const iconButton = (
    t: {
      label: string;
      icon: LucideIcon;
      active: boolean;
      run: () => void;
    },
    inMore: boolean,
  ) => (
    <button
      key={t.label}
      type="button"
      className="toolbar-icon"
      {...popoverItem(inMore)}
      title={t.label}
      aria-label={t.label}
      aria-pressed={t.active}
      onClick={t.run}
    >
      <t.icon size={16} aria-hidden="true" />
      {toolbarLabel(t.label, inMore)}
    </button>
  );
  const groupBody = (id: ToolbarGroup, inMore = false): ReactNode => {
    const mp = popoverItem(inMore);
    const lab = (label: string) => toolbarLabel(label, inMore);
    switch (id) {
      case "history":
        return (
          <>
            <button
              type="button"
              className="toolbar-icon"
              {...mp}
              title="Undo"
              aria-label="Undo"
              disabled={!editor.can().undo()}
              onClick={() => editor.chain().focus().undo().run()}
            >
              <Undo2 size={16} aria-hidden="true" />
              {lab("Undo")}
            </button>
            <button
              type="button"
              className="toolbar-icon"
              {...mp}
              title="Redo"
              aria-label="Redo"
              disabled={!editor.can().redo()}
              onClick={() => editor.chain().focus().redo().run()}
            >
              <Redo2 size={16} aria-hidden="true" />
              {lab("Redo")}
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
                {
                  value: "0",
                  label: "Normal text",
                  shortcut: hints["Normal text"],
                },
                {
                  value: "1",
                  label: "Heading 1",
                  shortcut: hints["Heading 1"],
                },
                {
                  value: "2",
                  label: "Heading 2",
                  shortcut: hints["Heading 2"],
                },
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
              {...mp}
              title="Decrease font size"
              aria-label="Decrease font size"
              onClick={() => setSize(size - 1)}
            >
              <Minus size={16} aria-hidden="true" />
              {lab("Decrease font size")}
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
              {...mp}
              title="Increase font size"
              aria-label="Increase font size"
              onClick={() => setSize(size + 1)}
            >
              <Plus size={16} aria-hidden="true" />
              {lab("Increase font size")}
            </button>
          </>
        );
      case "marks":
        return marks.map((t) => iconButton(t, inMore));
      case "link":
        return (
          <>
            <button
              type="button"
              className="toolbar-icon"
              {...mp}
              title="Add link"
              aria-label="Add link"
              onClick={() =>
                onLink(editor.getAttributes("link").href ?? "", (url) =>
                  editor.chain().focus().setLink({ href: url }).run(),
                )
              }
            >
              <LinkIcon size={16} aria-hidden="true" />
              {lab("Add link")}
            </button>
            {editor.isActive("link") && (
              <button
                type="button"
                className="toolbar-icon"
                {...mp}
                title="Remove link"
                aria-label="Remove link"
                onClick={() => editor.chain().focus().unsetLink().run()}
              >
                <Unlink size={16} aria-hidden="true" />
                {lab("Remove link")}
              </button>
            )}
          </>
        );
      case "insert": {
        return (
          <>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg"
              style={{ display: "none" }}
              aria-hidden="true"
              tabIndex={-1}
              onChange={handleFileChange}
            />
            <span className="toolbar-anchor" data-toolbar-panel="">
              <button
                ref={imageButtonRef}
                type="button"
                className="toolbar-icon"
                {...mp}
                title="Insert image"
                aria-label="Insert image"
                aria-haspopup="dialog"
                aria-expanded={pendingFile !== null}
                onClick={() => fileInputRef.current?.click()}
              >
                <ImageIcon size={16} aria-hidden="true" />
                {lab("Insert image")}
              </button>
              <Popover
                open={pendingFile !== null}
                anchor={imageButtonRef}
                role="dialog"
                label="Image alternative text"
                tabIndex={-1}
                className="toolbar-popover"
                onKeyDown={(e) => {
                  if (e.key === "Escape") {
                    e.preventDefault();
                    e.stopPropagation();
                    handleCancelImage();
                  }
                }}
              >
                <div className="toolbar-popover-body">
                  <span className="toolbar-field-title">
                    {pendingFile?.name}
                  </span>
                  <div className="toolbar-field">
                    <span>Alt text</span>
                    <input
                      ref={altInputRef}
                      type="text"
                      className="toolbar-input"
                      aria-label="Image alternative text"
                      placeholder="Description for screen readers"
                      value={altText}
                      onChange={(e) => setAltText(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          handleCommitImage();
                        }
                      }}
                    />
                  </div>
                  <div
                    style={{
                      display: "flex",
                      gap: "8px",
                      justifyContent: "flex-end",
                    }}
                  >
                    <button
                      type="button"
                      className="toolbar-text-button"
                      onClick={handleCancelImage}
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      className="toolbar-text-button"
                      disabled={isInsertingImage}
                      onClick={handleCommitImage}
                    >
                      {isInsertingImage ? "Inserting..." : "Insert"}
                    </button>
                  </div>
                </div>
              </Popover>
            </span>

            {!tableActive ? (
              <button
                type="button"
                className="toolbar-icon"
                {...mp}
                title="Insert table"
                aria-label="Insert table"
                onClick={() =>
                  editor
                    .chain()
                    .focus()
                    .insertTable({ rows: 3, cols: 3, withHeaderRow: true })
                    .run()
                }
              >
                <TableIcon size={16} aria-hidden="true" />
                {lab("Insert table")}
              </button>
            ) : (
              <PanelButton
                inMore={inMore}
                label="Table controls"
                dialogLabel="Table controls"
                icon={TableIcon}
                open={panel === "table"}
                onToggle={() => setPanel(panel === "table" ? null : "table")}
                onEscape={() => closePanel("table")}
                buttonRef={(el) => {
                  panelTriggers.current.table = el;
                }}
              >
                <div className="toolbar-popover-body">
                  <span className="toolbar-field-title">Table controls</span>
                  <div className="table-controls-grid">
                    <button
                      type="button"
                      className="toolbar-text-button"
                      onClick={() => editor.chain().focus().addRowAfter().run()}
                    >
                      Add row below
                    </button>
                    <button
                      type="button"
                      className="toolbar-text-button"
                      onClick={() => editor.chain().focus().deleteRow().run()}
                    >
                      Delete row
                    </button>
                    <button
                      type="button"
                      className="toolbar-text-button"
                      onClick={() =>
                        editor.chain().focus().addColumnAfter().run()
                      }
                    >
                      Add column after
                    </button>
                    <button
                      type="button"
                      className="toolbar-text-button"
                      onClick={() =>
                        editor.chain().focus().deleteColumn().run()
                      }
                    >
                      Delete column
                    </button>
                    <button
                      type="button"
                      className="toolbar-text-button"
                      onClick={() =>
                        editor.chain().focus().toggleHeaderRow().run()
                      }
                    >
                      Toggle header row
                    </button>
                    <button
                      type="button"
                      className="toolbar-text-button is-danger"
                      onClick={() => {
                        setPanel(null);
                        editor.chain().focus().deleteTable().run();
                      }}
                    >
                      Delete table
                    </button>
                  </div>
                </div>
              </PanelButton>
            )}
          </>
        );
      }
      case "lists":
        return lists.map((t) => iconButton(t, inMore));
      case "indent":
        return (
          <>
            <button
              type="button"
              className="toolbar-icon"
              {...mp}
              title="Decrease indent"
              aria-label="Decrease indent"
              onClick={() => changeIndent(editor, -1)}
            >
              <IndentDecrease size={16} aria-hidden="true" />
              {lab("Decrease indent")}
            </button>
            <button
              type="button"
              className="toolbar-icon"
              {...mp}
              title="Increase indent"
              aria-label="Increase indent"
              onClick={() => changeIndent(editor, 1)}
            >
              <IndentIncrease size={16} aria-hidden="true" />
              {lab("Increase indent")}
            </button>
          </>
        );
      case "spacing":
        return (
          <PanelButton
            inMore={inMore}
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
            {...mp}
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
            {lab("Page view")}
          </button>
        );
      case "aids": {
        return (
          <>
            <button
              type="button"
              className="toolbar-icon"
              {...mp}
              title="Focus mode"
              aria-label="Focus mode"
              aria-pressed={focusMode}
              onClick={() => onToggleFocusMode?.()}
            >
              <Focus size={16} aria-hidden="true" />
              {lab("Focus mode")}
            </button>
            <PanelButton
              inMore={inMore}
              label="Prose check"
              dialogLabel="Prose check"
              icon={Settings2}
              open={panel === "aids"}
              onToggle={() => setPanel(panel === "aids" ? null : "aids")}
              onEscape={() => closePanel("aids")}
              buttonRef={(el) => {
                panelTriggers.current.aids = el;
              }}
            >
              <div className="toolbar-popover-body prose-check-panel">
                <label className="toolbar-field">
                  <span>On</span>
                  <input
                    type="checkbox"
                    checked={proseCheck}
                    onChange={() => onToggleProseCheck?.()}
                  />
                </label>
                <ProseIssues
                  issues={proseIssues.filter(
                    (issue) => !dismissedIssues.has(issue.id ?? ""),
                  )}
                  rules={proseRules}
                  pending={prosePending}
                  unavailable={proseUnavailable}
                  page={prosePage}
                  excerpt={(issue) =>
                    editor.state.doc.textBetween(issue.from, issue.to, " ")
                  }
                  onRuleChange={(rule, enabled) =>
                    setProseRules((current) => ({
                      ...current,
                      [rule]: enabled,
                    }))
                  }
                  onPageChange={setProsePage}
                  onSelect={(issue) =>
                    editor
                      .chain()
                      .focus()
                      .setTextSelection({ from: issue.from, to: issue.to })
                      .scrollIntoView()
                      .run()
                  }
                  onDismiss={(issue) =>
                    setDismissedIssues((current) =>
                      new Set(current).add(issue.id ?? ""),
                    )
                  }
                />
              </div>
            </PanelButton>
          </>
        );
      }
      case "setup":
        return (
          <PanelButton
            inMore={inMore}
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
            inMore={inMore}
            label="More formatting"
            dialogLabel="More formatting"
            icon={Ellipsis}
            align="end"
            isMore
            open={
              panel === "more" ||
              (panel !== null &&
                (hidden.includes(panel as ToolbarGroup) ||
                  (panel === "table" && hidden.includes("insert"))))
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
              {...mp}
              title="Comment on selection"
              aria-label="Comment on selection"
              disabled={editor.state.selection.empty}
              onClick={() => onComment?.()}
            >
              <MessageSquarePlus size={16} aria-hidden="true" />
              {lab("Comment on selection")}
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
                <Scissors size={16} aria-hidden="true" />
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
      {groupBody(id, inMore)}
    </span>
  );
  const bar = showToolbar ? (
    <div
      className="format-bar"
      role="toolbar"
      aria-label="Formatting"
      ref={setBar}
      data-focus-hidden={hidesBar ? "" : undefined}
      data-toolbar-revealed={hidesBar && revealed ? "" : undefined}
      data-reveal={hidesBar && revealed && revealByKey ? "key" : undefined}
      onFocus={() => {
        if (hidesBar) reveal(true);
      }}
      onBlur={(event) => {
        if (
          hidesBar &&
          !event.currentTarget.contains(event.relatedTarget as Node | null)
        )
          scheduleHide();
      }}
      onKeyDown={(event) => {
        if (!hidesBar || event.key !== "Escape" || panel) return;
        event.preventDefault();
        hideNow();
        editor?.chain().focus().run();
      }}
    >
      {TOOLBAR_ORDER.filter((id) =>
        id === "more" ? hidden.length > 0 : !hidden.includes(id),
      ).map((id) => renderGroup(id))}
    </div>
  ) : null;
  return (
    <div
      className="writer"
      ref={writerRootRef}
      data-focus-toolbar={hidesBar ? "" : undefined}
    >
      {toolbarTarget === undefined
        ? bar
        : toolbarTarget && bar && createPortal(bar, toolbarTarget)}
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
          className={`editor-viewport ${layout.mode === "pages" ? "is-paged" : "is-continuous"}`}
        >
          <div className="editor-paper" style={pageStyle} ref={footnotePaper}>
            {/* One sheet per page, laid out inside the zoomed paper so it
                scales with zoom in every engine (WebKit does not zoom a
                gradient's px stops, which drew the gaps in the wrong place). */}
            {layout.mode === "pages" &&
              Array.from({ length: pages }, (_, page) => (
                <div
                  key={page}
                  className="page-sheet"
                  aria-hidden="true"
                  style={{ top: page * (geometry.height + geometry.gap) }}
                />
              ))}
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
                onDeleteEmpty={deleteEmptyNote}
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
                      left: geometry.margin,
                      top:
                        group.page * (geometry.height + geometry.gap) +
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
                    onDeleteEmpty={deleteEmptyNote}
                  />
                );
              })}
          </div>
        </div>
        {footer && <div className="writer-slot">{footer}</div>}
      </div>
      {editor && (
        <TableContextMenu
          editor={editor}
          at={tableMenuAt}
          onClose={() => setTableMenuAt(null)}
        />
      )}
    </div>
  );
}
