import { useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  BookMarked,
  BookOpen,
  ChevronDown,
  Columns2,
  FileText,
  History,
  Layers,
  List,
  MessageSquare,
  Pin,
  PinOff,
  Plus,
  Search,
} from "lucide-react";
import { entryWords, type Project, type Entry } from "../model";
import { slideHighlight } from "../motion";
import type { PaneContent } from "../split";
import { readSidebarPreferences, writeSidebarPreferences } from "../sidebarPreferences";
import { Dropdown } from "./Dropdown";
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

function selectedHighlightTarget(container: HTMLElement): HTMLElement | null {
  const selectedEntry = Array.from(
    container.querySelectorAll<HTMLElement>(".entry-row.selected"),
  ).find((row) => !row.closest(".cards-view"));
  return (
    selectedEntry ?? container.querySelector<HTMLElement>(".group-title.selected")
  );
}

function placeHighlightImmediately(
  container: HTMLElement,
  highlight: HTMLElement,
) {
  highlight.getAnimations().forEach((animation) => animation.cancel());
  const target = selectedHighlightTarget(container);
  if (!target) {
    highlight.style.opacity = "0";
    return;
  }
  const containerBox = container.getBoundingClientRect();
  const targetBox = target.getBoundingClientRect();
  const x =
    targetBox.left - containerBox.left - container.clientLeft + container.scrollLeft;
  const y =
    targetBox.top - containerBox.top - container.clientTop + container.scrollTop;
  highlight.style.transform = `translate(${x}px, ${y}px) scale(${targetBox.width}, ${targetBox.height})`;
  highlight.style.opacity = "1";
}

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
  onReorder: (id: string, to: number) => void;
  onRead: () => void;
  onVersions: () => void;
  activeDestination?: string;
  onDestination?: (id: string) => void;
  groupOrder?: string[];
  onGroupOrder?: (ids: string[]) => void;
  /** Bottom features switched off for this project; "settings" is never hidden. */
  hiddenGroups?: string[];
  collectionItems?: Record<
    string,
    {
      id: string;
      title: string;
      detail?: string;
      depth?: 0 | 1;
      beside?: PaneContent;
    }[]
  >;
  onCollectionSelect?: (group: string, id: string) => void;
  onCollectionAdd?: (group: string) => void;
  onEntryDetails?: (id: string, patch: Partial<Entry>) => void;
};
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
  const [revealed, setRevealed] = useState(false);
  const [focusKey, setFocusKey] = useState(0);
  const pinnedRef = useRef(prefs.pinned);
  const previewDragRestorers = useRef(new Set<() => void>());
  const groupsContainer = useRef<HTMLDivElement>(null);
  const bottomGroupsContainer = useRef<HTMLElement>(null);
  const groupsHighlight = useRef<HTMLSpanElement>(null);
  const bottomGroupsHighlight = useRef<HTMLSpanElement>(null);
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
  useEffect(
    () => () => {
      for (const restore of previewDragRestorers.current) restore();
    },
    [],
  );
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
    writeSidebarPreferences(localStorage, { ...prefs, hover: hoverReveal });
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
  useLayoutEffect(() => {
    const groups = groupsContainer.current;
    const bottomGroups = bottomGroupsContainer.current;
    const groupsMark = groupsHighlight.current;
    const bottomMark = bottomGroupsHighlight.current;
    if (!groups || !bottomGroups || !groupsMark || !bottomMark) return;
    slideHighlight(groupsMark, selectedHighlightTarget(groups), groups);
    slideHighlight(
      bottomMark,
      selectedHighlightTarget(bottomGroups),
      bottomGroups,
    );
  }, [
    active,
    mode,
    props.activeDestination,
    collapsed,
    views,
    query,
    order.join(),
    prefs.width,
  ]);

  useLayoutEffect(() => {
    const groups = groupsContainer.current;
    const bottomGroups = bottomGroupsContainer.current;
    const groupsMark = groupsHighlight.current;
    const bottomMark = bottomGroupsHighlight.current;
    if (!groups || !bottomGroups || !groupsMark || !bottomMark) return;
    const observer = new ResizeObserver(() => {
      placeHighlightImmediately(groups, groupsMark);
      placeHighlightImmediately(bottomGroups, bottomMark);
    });
    observer.observe(groups);
    observer.observe(bottomGroups);
    return () => observer.disconnect();
  }, []);
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
    const start = event.clientX,
      width = prefs.width;
    const move = (e: PointerEvent) =>
      setPrefs((p) => ({
        ...p,
        width: Math.max(190, Math.min(520, width + e.clientX - start)),
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
  const labels: Record<string, string> = {
    manuscript: "Manuscript",
    fragments: "Fragments",
    research: "Research",
    read: "Read manuscript",
    comments: "Comments",
    history: "Snapshots & history",
    settings: "Settings",
  };
  const expanded = prefs.pinned || revealed;
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
    const entries = (
      id === "manuscript"
        ? sections
        : id === "fragments"
          ? project.entries.filter((e) => e.kind === "fragment")
          : []
    ).filter(
      (e) =>
        !query ||
        (e.title + " " + e.text).toLowerCase().includes(query.toLowerCase()),
    );
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
        key={id}
        onDragOver={(e) => {
          if (collapsibleGroups.includes(id)) e.preventDefault();
        }}
        onDrop={(e) => {
          if (!collapsibleGroups.includes(id)) return;
          const group = e.dataTransfer.getData("text/personal-word-group");
          if (group) {
            e.preventDefault();
            moveGroup(group, index);
          }
        }}
      >
        <div
          className="group-heading"
          draggable={collapsibleGroups.includes(id)}
          onDragStart={(e) =>
            e.dataTransfer.setData("text/personal-word-group", id)
          }
        >
          <button
            className={
              "group-title " +
              (props.activeDestination === id ||
              (id === "read" && mode === "read")
                ? "selected"
                : "")
            }
            onClick={() => selectDestination(id)}
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
            <button
              aria-label={"Move " + labels[id] + " up"}
              disabled={index === 0}
              onClick={() => moveGroup(id, index - 1)}
            >
              <ArrowUp size={16} />
            </button>
            <button
              aria-label={"Move " + labels[id] + " down"}
              disabled={index === collapsibleGroups.length - 1}
              onClick={() => moveGroup(id, index + 1)}
            >
              <ArrowDown size={16} />
            </button>
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
            {(props.collectionItems?.[id] ?? [])
              .filter(
                (item) =>
                  !query ||
                  (item.title + " " + item.detail)
                    .toLowerCase()
                    .includes(query.toLowerCase()),
              )
              .map((item) => (
                <div
                  className={
                    "entry-row" +
                    (item.id === props.activeDestination ? " selected" : "") +
                    (item.beside ? " has-beside" : "")
                  }
                  data-depth={item.depth ?? 0}
                  key={item.id}
                >
                  <button
                    className="entry-main"
                    onClick={() => {
                      if (item.beside) {
                        props.onOpenBeside?.(item.beside);
                        return;
                      }
                      selectDestination(id);
                      props.onCollectionSelect?.(id, item.id);
                    }}
                  >
                    <span>{item.title}</span>
                    {views[id] && item.detail && (
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
                </div>
              ))}
            {entries.map((e) => (
              <div
                key={e.id}
                className={
                  "entry-row " +
                  (active === e.id && mode === "write" ? "selected" : "")
                }
                draggable
                onDragStart={(event) => {
                  event.stopPropagation();
                  event.dataTransfer.setData("text/folio-section", e.id);
                }}
                onDragOver={(event) => event.preventDefault()}
                onDrop={(event) => {
                  const dragged =
                    event.dataTransfer.getData("text/folio-section");
                  if (project.order.includes(dragged)) {
                    event.preventDefault();
                    event.stopPropagation();
                    onReorder(dragged, project.order.indexOf(e.id));
                  }
                }}
              >
                <button
                  className="entry-main"
                  onClick={(event) =>
                    onSelect(e.id, event.metaKey || event.ctrlKey)
                  }
                  onDoubleClick={() => onRename(e)}
                  onPointerDownCapture={(event) => {
                    const target = event.target;
                    if (
                      !(target instanceof Element) ||
                      !target.closest(".entry-preview")
                    ) {
                      return;
                    }
                    const candidateRow =
                      event.currentTarget.closest<HTMLElement>(".entry-row");
                    if (!candidateRow || !candidateRow.draggable) return;
                    const row: HTMLElement = candidateRow;

                    // Let the browser select preview prose instead of starting
                    // the parent row's native drag gesture.
                    const wasDraggable = row.draggable;
                    row.draggable = false;
                    let restored = false;
                    function restoreRowDrag() {
                      if (restored) return;
                      restored = true;
                      row.draggable = wasDraggable;
                      previewDragRestorers.current.delete(restoreRowDrag);
                      document.removeEventListener("pointerup", restoreRowDrag);
                      document.removeEventListener(
                        "pointercancel",
                        restoreRowDrag,
                      );
                      document.removeEventListener(
                        "visibilitychange",
                        restoreWhenHidden,
                      );
                      window.removeEventListener("blur", restoreRowDrag);
                    }
                    function restoreWhenHidden() {
                      if (document.hidden) restoreRowDrag();
                    }
                    previewDragRestorers.current.add(restoreRowDrag);
                    document.addEventListener("pointerup", restoreRowDrag);
                    document.addEventListener(
                      "pointercancel",
                      restoreRowDrag,
                    );
                    document.addEventListener(
                      "visibilitychange",
                      restoreWhenHidden,
                    );
                    window.addEventListener("blur", restoreRowDrag);
                  }}
                >
                  <FileText size={16} />
                  <span>{e.title}</span>
                  <small>{entryWords(e)} words</small>
                  {views[id] && (
                    <p className="entry-preview">{e.text || "Empty"}</p>
                  )}
                </button>
                {(id === "manuscript" || props.onOpenBeside) && (
                  <div className="reorder">
                    {props.onOpenBeside && (
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
                    )}
                    {id === "manuscript" && (
                      <>
                        <button
                          aria-label={"Move " + e.title + " up"}
                          disabled={project.order[0] === e.id}
                          onClick={() =>
                            onReorder(e.id, project.order.indexOf(e.id) - 1)
                          }
                        >
                          <ArrowUp size={16} />
                        </button>
                        <button
                          aria-label={"Move " + e.title + " down"}
                          disabled={project.order.at(-1) === e.id}
                          onClick={() =>
                            onReorder(e.id, project.order.indexOf(e.id) + 1)
                          }
                        >
                          <ArrowDown size={16} />
                        </button>
                      </>
                    )}
                  </div>
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
      className={
        "sidebar-shell " +
        (prefs.pinned ? "is-pinned" : "is-overlay") +
        (expanded ? " is-revealed" : "")
      }
      style={{ "--sidebar-width": prefs.width + "px" } as React.CSSProperties}
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
                  const next = titleDraft.trim();
                  if (next && next !== project.title) onRenameProject(next);
                  setEditingTitle(false);
                } else if (e.key === "Escape") {
                  e.preventDefault();
                  e.stopPropagation();
                  setEditingTitle(false);
                }
              }}
              onBlur={() => setEditingTitle(false)}
            />
          ) : (
            <button
              className="project-switch"
              title="Rename project"
              onClick={() => {
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
          />
          <kbd>⌘K</kbd>
        </div>
        <div className="sidebar-groups" ref={groupsContainer}>
          <span
            ref={groupsHighlight}
            className="sidebar-highlight"
            aria-hidden="true"
          />
          {order
            .filter((id) => collapsibleGroups.includes(id))
            .map((id) => group(id, order.indexOf(id)))}
        </div>
        <nav
          className="sidebar-bottom-groups"
          ref={bottomGroupsContainer}
          aria-label="Project features"
        >
          <span
            ref={bottomGroupsHighlight}
            className="sidebar-highlight"
            aria-hidden="true"
          />
          {order
            .filter((id) => !collapsibleGroups.includes(id))
            .map((id) => group(id, order.indexOf(id)))}
        </nav>
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
