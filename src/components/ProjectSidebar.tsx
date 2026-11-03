import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  Book,
  BookMarked,
  BookOpen,
  ChevronDown,
  Columns2,
  FileText,
  History,
  Layers,
  Library,
  List,
  MessageSquare,
  Pin,
  PinOff,
  Plus,
  Search,
  StickyNote,
  X,
} from "lucide-react";
import { entryWords, type Project, type Entry } from "../model";
import type { ResearchNote } from "../research/types";
import type { PaneContent } from "../split";
import { readSidebarPreferences, writeSidebarPreferences } from "../sidebarPreferences";
import { Dropdown } from "./Dropdown";
import { ContextMenu, type ContextMenuItem } from "./ContextMenu";
import { keyboardMove } from "./dragReorder";
import { useDragReorder } from "./useDragReorder";
import { useSpyDock } from "./scrollspy";
import { watchScrollFade } from "./scrollFade";
import "./drag-reorder.css";
import "./scrollspy.css";
import "./floating.css";
import "./scroll-fade.css";
export const workspaceGroups = [
  "manuscript",
  "fragments",
  "research",
  "read",
  "comments",
  "history",
  "settings",
];
/** Groups whose lists collapse with a chevron on the group title. */
export const collapsibleGroups = ["manuscript", "fragments", "research"];
/** Feature shortcuts that sit at the bottom of the sidebar. */
export const bottomGroups = ["read", "comments", "history", "settings"];

type Props = {
  project: Project;
  active: string;
  mode: "write" | "read";
  query: string;
  onQuery: (q: string) => void;
  onRenameProject: (title: string) => void;
  hoverReveal: boolean;
  onAdd: (kind: Entry["kind"]) => void;
  /** beside: Cmd/Ctrl+click opens the entry in the right split pane. */
  onSelect: (id: string, beside?: boolean) => void;
  /** The row's open-beside button: opens the entry in the right split pane. */
  onOpenBeside?: (target: PaneContent) => void;
  onRename: (e: Entry) => void;
  /** The row menu's Delete: App's confirm and safety snapshot. */
  onDelete?: (e: Entry) => void;
  onReorder: (id: string, to: number) => void;
  /** Moves a fragment to position `to` among all fragments. */
  onReorderFragment?: (id: string, to: number) => void;
  /** Moves a research source or note to position `to` in its own list. */
  onReorderResearch?: (list: "sources" | "notes", id: string, to: number) => void;
  onRead: () => void;
  onVersions: () => void;
  activeDestination?: string;
  /** Ids open on screen: the main pane's entry, or both split panes' entries
      (a source PDF as `pdf:<sourceId>`). Their rows and section headers are lit. */
  openIds?: ReadonlySet<string>;
  /** Read mode: the section the reader is in (scrollspy line drawn active). */
  readActiveId?: string;
  /** Read mode: a scrollspy line click scrolls the Read view to that section. */
  onScrollToSection?: (id: string, viaKeyboard: boolean) => void;
  /** 0..1: how far the open section or fragment (Write mode) or the section being read
      (Read mode) is scrolled; drawn on the one active Manuscript or Fragments line. */
  spyProgress?: number;
  /** The research source open in the Research panel (its line is drawn active). */
  activeResearchId?: string;
  onDestination?: (id: string) => void;
  groupOrder?: string[];
  onGroupOrder?: (ids: string[]) => void;
  /** Bottom features switched off for this project; "settings" is never hidden. */
  hiddenGroups?: string[];
  collectionItems?: Record<string, CollectionRow[]>;
  onCollectionSelect?: (group: string, id: string) => void;
  onCollectionAdd?: (group: string) => void;
  onEntryDetails?: (id: string, patch: Partial<Entry>) => void;
  /** Settings > General "Floating sidebar and research" (wave 5, C2). */
  floating?: boolean;
  /** App's useMarginFit result for the left margin (src/components/floating.ts):
      `top`/`bottom` are viewport px; `width` is the room the margin leaves. */
  floatFit?: { fits: boolean; width: number; top: number; bottom: number };
};

/** One Research, Comments or History row. */
type CollectionRow = {
  id: string;
  title: string;
  detail?: string;
  depth?: 0 | 1;
  beside?: PaneContent;
};

/** Research note kinds; App.tsx passes one as a note row's `detail`. */
const NOTE_KINDS = new Set<string>(
  ["quote", "paraphrase", "personal"] satisfies ResearchNote["kind"][],
);

/** The leading 16 px icon of a collection row. Every row in the three list
 *  groups carries one, so their labels start where Manuscript rows start.
 *  Sources and notes are only distinguishable here by `detail`, which App.tsx
 *  sets from `ResearchNote["kind"]` (wave-5 plan, A1). */
function collectionRowIcon(group: string, item: CollectionRow) {
  if (item.id.startsWith("pdf:")) return FileText;
  if (item.id === "bibliography") return Library;
  if (group === "comments") return MessageSquare;
  if (group === "history") return History;
  return item.detail && NOTE_KINDS.has(item.detail) ? StickyNote : Book;
}

function CollectionRowIcon({
  group,
  item,
}: {
  group: string;
  item: CollectionRow;
}) {
  const Icon = collectionRowIcon(group, item);
  return <Icon size={16} />;
}

export function ProjectSidebar(props: Props) {
  const {
    project,
    active,
    mode,
    query,
    onQuery,
    onRenameProject,
    hoverReveal,
    onAdd,
    onSelect,
    onRename,
    onReorder,
    onRead,
    onVersions,
  } = props;
  const [prefs, setPrefs] = useState(() => {
    const { width, pinned } = readSidebarPreferences(localStorage);
    return { width, pinned };
  });
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState("");
  const titleButtonRef = useRef<HTMLButtonElement>(null);
  const suppressTitleBlur = useRef(false);
  const [titleRefocus, setTitleRefocus] = useState(false);
  const commitTitle = () => {
    const next = titleDraft.trim();
    if (next && next !== project.title) onRenameProject(next);
    setEditingTitle(false);
  };
  useEffect(() => {
    if (!editingTitle && titleRefocus) {
      titleButtonRef.current?.focus();
      setTitleRefocus(false);
    }
  }, [editingTitle, titleRefocus]);
  const [revealed, setRevealed] = useState(false);
  const [focusKey, setFocusKey] = useState(0);
  const pinnedRef = useRef(prefs.pinned);
  const groupsContainer = useRef<HTMLDivElement>(null);
  const bottomGroupsContainer = useRef<HTMLElement>(null);
  pinnedRef.current = prefs.pinned;
  const reveal = (focus = false) => {
    setRevealed(true);
    if (focus) setFocusKey((n) => n + 1);
  };
  useEffect(() => {
    if (focusKey)
      aside.current
        ?.querySelector<HTMLElement>(".sidebar-title-row .sidebar-pin")
        ?.focus();
  }, [focusKey]);
  useEffect(() => {
    const toggle = () => {
      setPrefs((p) => ({ ...p, pinned: !p.pinned }));
      setRevealed(false);
    };
    const revealSidebar = () => {
      if (pinnedRef.current) toggle();
      else reveal(true);
    };
    window.addEventListener("personal-word:toggle-sidebar", toggle);
    window.addEventListener("personal-word:reveal-sidebar", revealSidebar);
    return () => {
      window.removeEventListener("personal-word:toggle-sidebar", toggle);
      window.removeEventListener("personal-word:reveal-sidebar", revealSidebar);
    };
  }, []);
  const [views, setViews] = useState<Record<string, boolean>>(() => {
    try {
      return JSON.parse(
        localStorage.getItem("personal-word.views." + project.id) ?? "{}",
      );
    } catch {
      return {};
    }
  });
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  useEffect(() => {
    localStorage.setItem(
      "personal-word.views." + project.id,
      JSON.stringify(views),
    );
  }, [views, project.id]);
  useEffect(() => setCollapsed({}), [project.id]);
  const [localOrder, setLocalOrder] = useState(workspaceGroups);
  const aside = useRef<HTMLElement>(null);
  useEffect(() => {
    // Spread the stored value first so fields this component does not own
    // (the floating switch) survive its writes.
    writeSidebarPreferences(localStorage, {
      ...readSidebarPreferences(localStorage),
      ...prefs,
      hover: hoverReveal,
    });
  }, [prefs, hoverReveal]);
  useEffect(() => {
    setLocalOrder(workspaceGroups);
  }, [project.id]);
  const hiddenGroups = props.hiddenGroups ?? [];
  const topOrder = [
    ...(props.groupOrder ?? localOrder).filter((id) =>
      collapsibleGroups.includes(id),
    ),
    ...collapsibleGroups.filter(
      (id) => !(props.groupOrder ?? localOrder).includes(id),
    ),
  ];
  // The bottom rows keep a fixed order and only disappear when a feature is
  // switched off; Settings is never hidden.
  const order = [
    ...topOrder,
    ...bottomGroups.filter(
      (id) => id === "settings" || !hiddenGroups.includes(id),
    ),
  ];
  const moveGroup = (id: string, to: number) => {
    // Only the collapsible top three reorder; the bottom rows are fixed.
    if (!collapsibleGroups.includes(id)) return;
    const top = order.filter((x) => collapsibleGroups.includes(x) && x !== id);
    top.splice(Math.max(0, Math.min(collapsibleGroups.length - 1, to)), 0, id);
    const next = [...top, ...bottomGroups];
    setLocalOrder(next);
    props.onGroupOrder?.(next);
  };
  const selectDestination = (id: string) => {
    props.onDestination?.(id);
    if (id === "read") onRead();
    if (id === "history") onVersions();
  };
  const startResize = (event: React.PointerEvent) => {
    const handle = event.currentTarget;
    handle.setPointerCapture(event.pointerId);
    // Floating: the drawn width is capped by the margin, so the drag starts
    // from it and stops at the margin's room.
    const start = event.clientX,
      width = isFloating ? floatWidth : prefs.width,
      max = isFloating ? Math.max(190, floatWidth, props.floatFit!.width) : 520;
    const move = (e: PointerEvent) =>
      setPrefs((p) => ({
        ...p,
        width: Math.max(190, Math.min(max, width + e.clientX - start)),
      }));
    const stop = () => {
      handle.removeEventListener("pointermove", move as EventListener);
      handle.removeEventListener("pointerup", stop);
    };
    handle.addEventListener("pointermove", move as EventListener);
    handle.addEventListener("pointerup", stop, { once: true });
  };
  const sections = project.order
    .map((id) => project.entries.find((e) => e.id === id))
    .filter((e): e is Entry => !!e);
  const matches = (e: Entry) =>
    !query || (e.title + " " + e.text).toLowerCase().includes(query.toLowerCase());
  const manuscriptEntries = sections.filter(matches);
  const allFragments = project.entries.filter((e) => e.kind === "fragment");
  const fragmentEntries = allFragments.filter(matches);
  // Research rows: Bibliography is a fixed first row; each source is one
  // draggable unit with its PDF row; notes are their own list. App.tsx tells
  // notes from sources by `detail` (a note kind) and names a PDF `pdf:<sourceId>`.
  const shownItem = (item: CollectionRow) =>
    !query ||
    (item.title + " " + item.detail).toLowerCase().includes(query.toLowerCase());
  let bibliographyRow: CollectionRow | undefined;
  const sourceUnits: { id: string; rows: CollectionRow[] }[] = [];
  const noteRows: CollectionRow[] = [];
  for (const item of props.collectionItems?.research ?? []) {
    if (item.id === "bibliography") bibliographyRow = item;
    else if (item.id.startsWith("pdf:"))
      sourceUnits.find((u) => "pdf:" + u.id === item.id)?.rows.push(item);
    else if (item.detail && NOTE_KINDS.has(item.detail)) noteRows.push(item);
    else sourceUnits.push({ id: item.id, rows: [item] });
  }
  const shownSources = sourceUnits
    .map((u) => ({ ...u, rows: u.rows.filter(shownItem) }))
    .filter((u) => u.rows.length > 0);
  const shownNotes = noteRows.filter(shownItem);
  const allSourceIds = sourceUnits.map((u) => u.id);
  const allNoteIds = noteRows.map((n) => n.id);
  // Rows drag with the pointer; Option+Up/Down (`chord`) is the keyboard way.
  const groupDrag = useDragReorder({
    items: topOrder,
    onReorder: (from, to) => moveGroup(topOrder[from], to),
  });
  const entryDrag = useDragReorder({
    items: manuscriptEntries,
    onReorder: (from, to) =>
      onReorder(
        manuscriptEntries[from].id,
        project.order.indexOf(manuscriptEntries[to].id),
      ),
  });
  const fragmentDrag = useDragReorder({
    items: fragmentEntries,
    onReorder: (from, to) =>
      props.onReorderFragment?.(
        fragmentEntries[from].id,
        allFragments.indexOf(fragmentEntries[to]),
      ),
  });
  const sourceDrag = useDragReorder({
    items: shownSources,
    onReorder: (from, to) =>
      props.onReorderResearch?.(
        "sources",
        shownSources[from].id,
        allSourceIds.indexOf(shownSources[to].id),
      ),
  });
  const noteDrag = useDragReorder({
    items: shownNotes,
    onReorder: (from, to) =>
      props.onReorderResearch?.(
        "notes",
        shownNotes[from].id,
        allNoteIds.indexOf(shownNotes[to].id),
      ),
  });
  // Keyboard reorder: one live region announces each move, and focus returns
  // to the moved row (found by data-row-id) after the re-render.
  const [announcement, setAnnouncement] = useState("");
  // Clear, then write on the next frame: the same text twice (e.g. "already last") is a
  // React no-op, and a screen reader re-reads a live region only when its text is rewritten.
  const announceFrame = useRef(0);
  const announce = (text: string) => {
    cancelAnimationFrame(announceFrame.current);
    setAnnouncement("");
    announceFrame.current = requestAnimationFrame(() => setAnnouncement(text));
  };
  useEffect(() => () => cancelAnimationFrame(announceFrame.current), []);
  const pendingFocus = useRef<string | null>(null);
  useEffect(() => {
    const id = pendingFocus.current;
    if (!id) return;
    pendingFocus.current = null;
    aside.current
      ?.querySelector<HTMLElement>(`[data-row-id="${CSS.escape(id)}"]`)
      ?.focus();
  });
  /** Option+Up/Down on a focused row or heading moves it past its neighbour
   *  among the rows shown, at once (no drag state, nothing animates). */
  const chord = (
    e: React.KeyboardEvent,
    id: string,
    title: string,
    shown: readonly string[],
    all: readonly string[],
    move: ((id: string, to: number) => void) | undefined,
  ) => {
    const dir = keyboardMove(e);
    if (!dir || !move || !shown.includes(id)) return;
    e.preventDefault();
    moveBy(dir, id, title, shown, all, move);
  };
  /** One step up (-1) or down (1) among the rows shown: the chord and the
   *  context menu's Move items. `focusId` is the row refocused afterwards. */
  const moveBy = (
    dir: -1 | 1,
    id: string,
    title: string,
    shown: readonly string[],
    all: readonly string[],
    move: (id: string, to: number) => void,
    focusId = id,
  ) => {
    const next = shown[shown.indexOf(id) + dir];
    if (next === undefined) {
      announce(`${title} is already ${dir < 0 ? "first" : "last"}`);
      return;
    }
    const to = all.indexOf(next);
    move(id, to);
    pendingFocus.current = focusId;
    announce(`Moved ${title} to position ${to + 1} of ${all.length}`);
  };
  // Right-click / Shift+F10 / ContextMenu-key menu on rows and group headings (wave 5, E4).
  const [menu, setMenu] = useState<{
    x: number;
    y: number;
    rowId: string;
    label: string;
    items: ContextMenuItem[];
    viaKeyboard: boolean;
  } | null>(null);
  const menuRow = useRef<string | null>(null);
  menuRow.current = menu?.rowId ?? null;
  const closeMenu = useCallback((restore: boolean) => {
    const rowId = menuRow.current;
    setMenu(null);
    if (rowId && restore)
      aside.current
        ?.querySelector<HTMLElement>(`[data-row-id="${CSS.escape(rowId)}"]`)
        ?.focus();
  }, []);
  /** Move up / Move down items, disabled at the ends of the rows shown. */
  const moveItems = (
    id: string,
    title: string,
    shown: readonly string[],
    all: readonly string[],
    move: ((id: string, to: number) => void) | undefined,
    focusId = id,
  ): ContextMenuItem[] =>
    move
      ? ([-1, 1] as const).map((dir) => ({
          label: dir < 0 ? "Move up" : "Move down",
          disabled: shown[shown.indexOf(id) + dir] === undefined,
          run: () => moveBy(dir, id, title, shown, all, move, focusId),
        }))
      : [];
  /** contextmenu and Shift+F10 / ContextMenu-key handlers for one row button;
   *  other keys go on to `onKeyDown` (the chord). */
  const menuProps = (
    rowId: string,
    title: string,
    items: () => ContextMenuItem[],
    onKeyDown?: (e: React.KeyboardEvent) => void,
  ) => ({
    onContextMenu: (e: React.MouseEvent) => {
      e.preventDefault();
      setMenu({ x: e.clientX, y: e.clientY, rowId, label: `${title} actions`, items: items(), viaKeyboard: false });
    },
    onKeyDown: (e: React.KeyboardEvent<HTMLElement>) => {
      if ((e.shiftKey && e.key === "F10") || e.key === "ContextMenu") {
        e.preventDefault();
        const r = e.currentTarget.getBoundingClientRect();
        setMenu({ x: r.left, y: r.bottom, rowId, label: `${title} actions`, items: items(), viaKeyboard: true });
        return;
      }
      onKeyDown?.(e);
    },
  });
  /** Presses on controls inside a row stay clicks, edits and text selections. */
  const onRow =
    (down: (e: React.PointerEvent<HTMLElement>) => void, skip: string) =>
    (e: React.PointerEvent<HTMLElement>) => {
      if (e.target instanceof Element && e.target.closest(skip)) return;
      down(e);
    };
  // Scrollspy lines (wave 4 R1, wave 5 A3): a pointer-only mirror of each row of the three
  // list groups; the row button stays the accessible, keyboard path. useSpyDock magnifies
  // them by pointer proximity; `progress` (Manuscript/Fragments active line only) fills it.
  useSpyDock(groupsContainer);
  const spyLine = (
    state: "idle" | "open" | "active",
    onClick: (event: React.MouseEvent) => void,
    progress?: number,
  ) => {
    const filled = state === "active" && progress !== undefined;
    return (
      <button
        type="button"
        className="spy-line"
        tabIndex={-1}
        aria-hidden="true"
        data-state={state}
        data-progress={filled ? "" : undefined}
        style={
          filled
            ? ({ "--spy-progress": progress.toFixed(3) } as React.CSSProperties)
            : undefined
        }
        onClick={onClick}
      />
    );
  };
  const labels: Record<string, string> = {
    manuscript: "Manuscript",
    fragments: "Fragments",
    research: "Research",
    read: "Read manuscript",
    comments: "Comments",
    history: "Snapshots & history",
    settings: "Settings",
  };
  /** One Research, Comments or History row. Research passes the chord handler
   *  (sources, notes) and, for a note, its drag props (a source's unit carries its own). */
  const collectionRow = (
    group: string,
    item: CollectionRow,
    onKeyDown?: (e: React.KeyboardEvent) => void,
    drag?: ReturnType<typeof noteDrag.rowProps>,
    moves?: () => ContextMenuItem[],
  ) => {
    const open = () => {
      if (item.beside) {
        props.onOpenBeside?.(item.beside);
        return;
      }
      selectDestination(group);
      props.onCollectionSelect?.(group, item.id);
    };
    return (
    <div
      className={
        "entry-row" +
        (item.id === props.activeDestination ? " selected" : "") +
        (item.beside ? " has-beside" : "")
      }
      data-depth={item.depth ?? 0}
      data-open={props.openIds?.has(item.id) ? "" : undefined}
      key={item.id}
      {...drag}
      onPointerDown={
        drag ? onRow(drag.onPointerDown, ".collection-open-beside, .spy-line") : undefined
      }
    >
      <button
        className="entry-main"
        data-row-id={item.id}
        {...(group === "research"
          ? menuProps(
              item.id,
              item.title,
              () => [
                { label: "Open", run: open },
                ...(item.beside && props.onOpenBeside
                  ? [{ label: "Open beside", run: () => props.onOpenBeside?.(item.beside!) }]
                  : []),
                ...(moves?.() ?? []),
              ],
              onKeyDown,
            )
          : { onKeyDown })}
        onClick={open}
      >
        <CollectionRowIcon group={group} item={item} />
        <span>{item.title}</span>
        {views[group] && item.detail && (
          <p className="entry-preview">{item.detail}</p>
        )}
      </button>
      {item.beside && props.onOpenBeside && (
        <button
          className="collection-open-beside"
          type="button"
          aria-label={`Open ${item.title} beside`}
          title="Open beside"
          onClick={() => props.onOpenBeside?.(item.beside!)}
        >
          <Columns2 size={16} />
        </button>
      )}
      {group === "research" &&
        !views[group] &&
        spyLine(
          item.id === props.activeDestination || item.id === props.activeResearchId
            ? "active"
            : props.openIds?.has(item.id)
              ? "open"
              : "idle",
          open,
        )}
    </div>
    );
  };
  const expanded = prefs.pinned || revealed;
  // Floating (wave 5, C3): only when the setting is on and the left margin has
  // room; otherwise the normal pinned panel or overlay below.
  const isFloating = !!(props.floating && props.floatFit?.fits);
  const floatWidth = Math.min(prefs.width, props.floatFit?.width ?? prefs.width);
  // Floating has no surface, so a list row cut off by the scrolling group list
  // would sit as half a line against the bottom rows; the E2 scroll fade masks
  // that edge instead (floating only: the normal panel is unchanged).
  useEffect(
    () => (isFloating && groupsContainer.current ? watchScrollFade(groupsContainer.current) : undefined),
    [isFloating],
  );
  const shell = useRef<HTMLDivElement>(null);
  const floatTop = props.floatFit?.top ?? 0;
  const floatBottom = props.floatFit?.bottom ?? 0;
  // floatFit is in viewport px; the shell is placed inside .app, which sits
  // below the project tabs, so convert to the parent's box.
  useLayoutEffect(() => {
    const el = shell.current;
    const box = el?.parentElement?.getBoundingClientRect();
    if (!el || !box || !isFloating) return;
    el.style.setProperty("--float-top", Math.max(0, floatTop - box.top) + "px");
    el.style.setProperty("--float-bottom", Math.max(0, box.bottom - floatBottom) + "px");
  }, [isFloating, floatTop, floatBottom]);
  const group = (id: string, index: number) => {
    const collection = [
      "manuscript",
      "fragments",
      "research",
      "comments",
      "history",
    ].includes(id);
    const kind =
      id === "manuscript"
        ? "section"
        : id === "fragments"
          ? "fragment"
          : "research";
    const entries =
      id === "manuscript"
        ? manuscriptEntries
        : id === "fragments"
          ? fragmentEntries
          : [];
    const dragGroup = collapsibleGroups.includes(id) ? groupDrag.rowProps(index) : null;
    const titleSelected =
      props.activeDestination === id || (id === "read" && mode === "read");
    // A section is lit when it is the open destination or holds an open entry
    // (search and collapse do not change that). Bottom groups keep their own look.
    const open =
      collapsibleGroups.includes(id) &&
      (titleSelected ||
        (id === "research"
          ? (props.collectionItems?.research ?? []).some((i) => props.openIds?.has(i.id))
          : project.entries.some((e) => e.kind === kind && props.openIds?.has(e.id))));
    return (
      <section
        className={
          "sidebar-group " +
          (collapsibleGroups.includes(id) && views[id]
            ? "cards-view"
            : "list-view") +
          (collapsed[id] ? " is-collapsed" : "")
        }
        data-group={id}
        data-open={open ? "" : undefined}
        key={id}
        {...dragGroup}
        onPointerDown={
          dragGroup
            ? (e) => {
            // Only the heading lifts a group; its entries and buttons keep their own presses.
            if (
              e.target instanceof Element &&
              e.target.closest(".group-heading") &&
              !e.target.closest(".group-actions")
            )
              dragGroup.onPointerDown(e);
          }
            : undefined
        }
      >
        <div className="group-heading">
          <button
            className={
              "group-title " + (titleSelected ? "selected" : "")
            }
            data-row-id={id}
            onClick={() => selectDestination(id)}
            {...(collapsibleGroups.includes(id)
              ? menuProps(
                  id,
                  labels[id],
                  () => [
                    {
                      label: collapsed[id] ? "Expand" : "Collapse",
                      run: () => setCollapsed((c) => ({ ...c, [id]: !c[id] })),
                    },
                    ...moveItems(id, labels[id], topOrder, topOrder, moveGroup),
                  ],
                  (e) => chord(e, id, labels[id], topOrder, topOrder, moveGroup),
                )
              : {})}
          >
            {id === "manuscript" && <FileText size={16} />}
            {id === "fragments" && <Layers size={16} />}
            {id === "research" && <BookMarked size={16} />}
            {id === "read" && <BookOpen size={16} />}
            {id === "comments" && <MessageSquare size={16} />}
            {id === "history" && <History size={16} />}
            <span className="group-label">{labels[id]}</span>
          </button>
          {collapsibleGroups.includes(id) && (
            <button
              className="group-chevron"
              aria-label={(collapsed[id] ? "Show " : "Hide ") + labels[id]}
              aria-expanded={!collapsed[id]}
              data-collapsed={collapsed[id] ? "true" : undefined}
              onClick={() => setCollapsed((c) => ({ ...c, [id]: !c[id] }))}
            >
              <ChevronDown size={14} />
            </button>
          )}
          {collapsibleGroups.includes(id) && (
            <div className="group-actions">
            {collection && (
              <>
                <button
                  aria-label={
                    views[id]
                      ? "Show " + labels[id] + " list"
                      : "Show " + labels[id] + " cards"
                  }
                  onClick={() => setViews((v) => ({ ...v, [id]: !v[id] }))}
                >
                  {views[id] ? <List size={16} /> : <Layers size={16} />}
                </button>
                <button
                  aria-label={
                    "New " +
                    (id === "manuscript"
                      ? "section"
                      : id === "fragments"
                        ? "fragment"
                        : id === "comments"
                          ? "comment"
                          : id === "history"
                            ? "snapshot"
                            : "research note")
                  }
                  onClick={() => {
                    if (id === "manuscript" || id === "fragments")
                      onAdd(kind as Entry["kind"]);
                    else if (props.onCollectionAdd) props.onCollectionAdd(id);
                    else selectDestination(id);
                  }}
                >
                  <Plus size={16} />
                </button>
              </>
            )}
          </div>
          )}
        </div>
        {collection && !collapsed[id] && (
          <div className="entry-list">
            {id === "research" ? (
              <>
                {bibliographyRow &&
                  shownItem(bibliographyRow) &&
                  collectionRow(id, bibliographyRow)}
                <div className="entry-sublist" data-list="sources">
                  {shownSources.map((unit, i) => {
                    const drag = sourceDrag.rowProps(i);
                    return (
                      <div
                        className="entry-unit"
                        key={unit.id}
                        {...drag}
                        onPointerDown={onRow(drag.onPointerDown, ".collection-open-beside, .spy-line")}
                      >
                        {unit.rows.map((row) =>
                          collectionRow(
                            id,
                            row,
                            row.id === unit.id
                              ? (e) =>
                                  chord(
                                    e,
                                    row.id,
                                    row.title,
                                    shownSources.map((u) => u.id),
                                    allSourceIds,
                                    props.onReorderResearch &&
                                      ((x, to) => props.onReorderResearch?.("sources", x, to)),
                                  )
                              : undefined,
                            undefined,
                            // A PDF row's Move items move its source (the unit), like a drag.
                            () =>
                              moveItems(
                                unit.id,
                                unit.rows[0].title,
                                shownSources.map((u) => u.id),
                                allSourceIds,
                                props.onReorderResearch &&
                                  ((x, to) => props.onReorderResearch?.("sources", x, to)),
                                row.id,
                              ),
                          ),
                        )}
                      </div>
                    );
                  })}
                </div>
                <div className="entry-sublist" data-list="notes">
                  {shownNotes.map((note, i) =>
                    collectionRow(
                      id,
                      note,
                      (e) =>
                        chord(
                          e,
                          note.id,
                          note.title,
                          shownNotes.map((n) => n.id),
                          allNoteIds,
                          props.onReorderResearch &&
                            ((x, to) => props.onReorderResearch?.("notes", x, to)),
                        ),
                      noteDrag.rowProps(i),
                      () =>
                        moveItems(
                          note.id,
                          note.title,
                          shownNotes.map((n) => n.id),
                          allNoteIds,
                          props.onReorderResearch &&
                            ((x, to) => props.onReorderResearch?.("notes", x, to)),
                        ),
                    ),
                  )}
                </div>
              </>
            ) : (
              (props.collectionItems?.[id] ?? [])
                .filter(shownItem)
                .map((item) => collectionRow(id, item))
            )}
            {entries.map((e) => (
              <div
                key={e.id}
                className={
                  "entry-row " +
                  (active === e.id &&
                  mode === "write" &&
                  (!props.openIds || props.openIds.has(e.id))
                    ? "selected"
                    : "")
                }
                data-open={props.openIds?.has(e.id) ? "" : undefined}
                {...(id === "manuscript" ? entryDrag : fragmentDrag).rowProps(entries.indexOf(e))}
                onPointerDown={onRow(
                  (id === "manuscript" ? entryDrag : fragmentDrag).rowProps(
                    entries.indexOf(e),
                  ).onPointerDown,
                  "input, select, textarea, [role=combobox], .entry-preview, .entry-details, .reorder, .spy-line",
                )}
              >
                <button
                  className="entry-main"
                  data-row-id={e.id}
                  onClick={(event) =>
                    onSelect(e.id, event.metaKey || event.ctrlKey)
                  }
                  onDoubleClick={() => onRename(e)}
                  {...menuProps(
                    e.id,
                    e.title,
                    () => [
                      { label: "Open", run: () => onSelect(e.id) },
                      ...(props.onOpenBeside
                        ? [{ label: "Open beside", run: () => props.onOpenBeside?.({ kind: "entry", id: e.id }) }]
                        : []),
                      { label: "Rename", run: () => onRename(e) },
                      ...(id === "manuscript"
                        ? moveItems(e.id, e.title, manuscriptEntries.map((x) => x.id), project.order, onReorder)
                        : moveItems(
                            e.id,
                            e.title,
                            fragmentEntries.map((x) => x.id),
                            allFragments.map((x) => x.id),
                            props.onReorderFragment,
                          )),
                      ...(props.onDelete
                        ? [{ label: "Delete", danger: true, run: () => props.onDelete?.(e) }]
                        : []),
                    ],
                    (event) =>
                      id === "manuscript"
                        ? chord(
                            event,
                            e.id,
                            e.title,
                            manuscriptEntries.map((x) => x.id),
                            project.order,
                            onReorder,
                          )
                        : chord(
                            event,
                            e.id,
                            e.title,
                            fragmentEntries.map((x) => x.id),
                            allFragments.map((x) => x.id),
                            props.onReorderFragment,
                          ),
                  )}
                >
                  <FileText size={16} />
                  <span>{e.title}</span>
                  <small>{entryWords(e)} words</small>
                  {views[id] && (
                    <p className="entry-preview">{e.text || "Empty"}</p>
                  )}
                </button>
                {props.onOpenBeside && (
                  // The open-beside button's own wrapper (kept as .reorder:
                  // its hover reveal and specs predate the arrows' removal).
                  <div className="reorder">
                    <button
                      className="open-beside"
                      aria-label={"Open " + e.title + " beside"}
                      title="Open beside"
                      onClick={() =>
                        props.onOpenBeside?.({ kind: "entry", id: e.id })
                      }
                    >
                      <Columns2 size={16} />
                    </button>
                  </div>
                )}
                {!views[id] &&
                  spyLine(
                    (mode === "read"
                      ? id === "manuscript" && props.readActiveId === e.id
                      : active === e.id && (!props.openIds || props.openIds.has(e.id)))
                      ? "active"
                      : props.openIds?.has(e.id)
                        ? "open"
                        : "idle",
                    (event) => {
                      if (mode === "read" && id === "manuscript")
                        props.onScrollToSection?.(e.id, event.detail === 0);
                      else onSelect(e.id);
                    },
                    props.spyProgress,
                  )}
                {views[id] && props.onEntryDetails && (
                  <div className="entry-details">
                    <input
                      aria-label={"Synopsis for " + e.title}
                      placeholder="Synopsis"
                      value={e.synopsis ?? ""}
                      onChange={(event) =>
                        props.onEntryDetails?.(e.id, {
                          synopsis: event.target.value,
                        })
                      }
                    />
                    <Dropdown
                      className="entry-status"
                      label={"Draft status for " + e.title}
                      value={e.draftStatus ?? "notes"}
                      onChange={(value) =>
                        props.onEntryDetails?.(e.id, {
                          draftStatus: value as Entry["draftStatus"],
                        })
                      }
                      options={[
                        { value: "notes", label: "Notes" },
                        { value: "draft", label: "Draft" },
                        { value: "revised", label: "Revised" },
                      ]}
                    />
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </section>
    );
  };
  return (
    <div
      ref={shell}
      className={
        "sidebar-shell " +
        (prefs.pinned ? "is-pinned" : "is-overlay") +
        (isFloating ? " is-floating" : "") +
        (expanded ? " is-revealed" : "")
      }
      style={
        {
          "--sidebar-width": prefs.width + "px",
          "--float-width": floatWidth + "px",
        } as React.CSSProperties
      }
      onMouseLeave={() => {
        if (!aside.current?.contains(document.activeElement))
          setRevealed(false);
      }}
    >
      {!prefs.pinned && (
        <button
          className="sidebar-edge"
          aria-label="Show sidebar"
          aria-expanded={expanded}
          onMouseEnter={() => hoverReveal && reveal()}
          onClick={() => reveal(true)}
        />
      )}
      <aside
        ref={aside}
        className="sidebar"
        aria-label="Project sidebar"
        inert={!expanded}
        onKeyDown={(e) => {
          if (e.key === "Escape" && !prefs.pinned) {
            setRevealed(false);
            (
              e.currentTarget.parentElement?.querySelector(
                ".sidebar-edge",
              ) as HTMLButtonElement
            )?.focus();
          }
        }}
      >
        <div className="sidebar-title-row">
          {editingTitle ? (
            <input
              className="project-switch project-title-input"
              aria-label="Project title"
              autoFocus
              value={titleDraft}
              onChange={(e) => setTitleDraft(e.target.value)}
              onFocus={(e) => e.currentTarget.select()}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  suppressTitleBlur.current = true;
                  commitTitle();
                  setTitleRefocus(true);
                } else if (e.key === "Escape") {
                  e.preventDefault();
                  e.stopPropagation();
                  suppressTitleBlur.current = true;
                  setEditingTitle(false);
                  setTitleRefocus(true);
                }
              }}
              onBlur={() => {
                if (!suppressTitleBlur.current) commitTitle();
                suppressTitleBlur.current = false;
              }}
            />
          ) : (
            <button
              ref={titleButtonRef}
              className="project-switch"
              title="Rename project"
              onClick={() => {
                suppressTitleBlur.current = false;
                setTitleDraft(project.title);
                setEditingTitle(true);
              }}
            >
              <span>{project.title}</span>
            </button>
          )}
          <button
            className="sidebar-pin"
            aria-label={prefs.pinned ? "Unpin sidebar" : "Pin sidebar"}
            aria-pressed={prefs.pinned}
            onClick={() => setPrefs((p) => ({ ...p, pinned: !p.pinned }))}
          >
            {prefs.pinned ? <PinOff size={16} /> : <Pin size={16} />}
          </button>
        </div>
        <div className="search">
          <Search size={16} />
          <input
            aria-label="Search project"
            placeholder="Find in project"
            value={query}
            onChange={(e) => onQuery(e.target.value)}
            onKeyDown={(e) => {
              // Escape empties a typed query and stays in the field; on an empty
              // field it falls through to the sidebar's own Escape handling.
              if (e.key === "Escape" && query) {
                e.stopPropagation();
                onQuery("");
              }
            }}
          />
          <span className="search-end">
            <kbd>⌘K</kbd>
            <button
              type="button"
              className="icon-button search-clear"
              aria-label="Clear search"
              data-shown={query ? "1" : undefined}
              tabIndex={query ? 0 : -1}
              onClick={(e) => {
                onQuery("");
                e.currentTarget
                  .closest(".search")
                  ?.querySelector("input")
                  ?.focus();
              }}
            >
              <X size={16} />
            </button>
          </span>
        </div>
        <div className="sidebar-groups" ref={groupsContainer}>
          {order
            .filter((id) => collapsibleGroups.includes(id))
            .map((id) => group(id, order.indexOf(id)))}
        </div>
        <nav
          className="sidebar-bottom-groups"
          ref={bottomGroupsContainer}
          aria-label="Project features"
        >
          {order
            .filter((id) => !collapsibleGroups.includes(id))
            .map((id) => group(id, order.indexOf(id)))}
        </nav>
        {menu && (
          <ContextMenu
            key={menu.rowId + ":" + menu.x + ":" + menu.y}
            x={menu.x}
            y={menu.y}
            label={menu.label}
            items={menu.items}
            viaKeyboard={menu.viaKeyboard}
            onClose={closeMenu}
          />
        )}
        <div className="visually-hidden" role="status" aria-live="polite">
          {announcement}
        </div>
        <div
          className="sidebar-resize"
          role="separator"
          aria-label="Sidebar width"
          aria-orientation="vertical"
          aria-valuemin={190}
          aria-valuemax={520}
          aria-valuenow={prefs.width}
          tabIndex={0}
          onPointerDown={startResize}
          onKeyDown={(e) => {
            if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
              e.preventDefault();
              setPrefs((p) => ({
                ...p,
                width: Math.max(
                  190,
                  Math.min(520, p.width + (e.key === "ArrowRight" ? 20 : -20)),
                ),
              }));
            }
          }}
        />
      </aside>
    </div>
  );
}
