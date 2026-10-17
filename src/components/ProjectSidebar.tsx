import { useEffect, useRef, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  BookOpen,
  ChevronDown,
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
type Props = {
  project: Project;
  active: string;
  mode: "write" | "read";
  query: string;
  onQuery: (q: string) => void;
  onLibrary: () => void;
  onAdd: (kind: Entry["kind"]) => void;
  onSelect: (id: string) => void;
  onRename: (e: Entry) => void;
  onReorder: (id: string, to: number) => void;
  onRead: () => void;
  onVersions: () => void;
  activeDestination?: string;
  onDestination?: (id: string) => void;
  groupOrder?: string[];
  onGroupOrder?: (ids: string[]) => void;
  collectionItems?: Record<
    string,
    { id: string; title: string; detail?: string }[]
  >;
  onCollectionSelect?: (group: string, id: string) => void;
  onCollectionAdd?: (group: string) => void;
  onEntryDetails?: (id: string, patch: Partial<Entry>) => void;
};
type Preferences = { width: number; pinned: boolean; hover: boolean };
const preferenceKey = "folio.workspace.sidebar";
function preferences(): Preferences {
  try {
    return {
      width: 270,
      pinned: true,
      hover: true,
      ...JSON.parse(localStorage.getItem(preferenceKey) ?? "{}"),
    };
  } catch {
    return { width: 270, pinned: true, hover: true };
  }
}
export function ProjectSidebar(props: Props) {
  const {
    project,
    active,
    mode,
    query,
    onQuery,
    onLibrary,
    onAdd,
    onSelect,
    onRename,
    onReorder,
    onRead,
    onVersions,
  } = props;
  const [prefs, setPrefs] = useState(preferences);
  const [revealed, setRevealed] = useState(false);
  const [focusKey, setFocusKey] = useState(0);
  const pinnedRef = useRef(prefs.pinned);
  pinnedRef.current = prefs.pinned;
  const reveal = (focus = false) => {
    setRevealed(true);
    if (focus) setFocusKey((n) => n + 1);
  };
  useEffect(() => {
    if (focusKey)
      aside.current
        ?.querySelector<HTMLElement>(".sidebar-brand button")
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
    localStorage.setItem(preferenceKey, JSON.stringify(prefs));
  }, [prefs]);
  useEffect(() => {
    setLocalOrder(workspaceGroups);
  }, [project.id]);
  const order = [
    ...(props.groupOrder ?? localOrder).filter((id) =>
      workspaceGroups.includes(id),
    ),
    ...workspaceGroups.filter(
      (id) => !(props.groupOrder ?? localOrder).includes(id),
    ),
  ];
  const moveGroup = (id: string, to: number) => {
    const next = order.filter((x) => x !== id);
    next.splice(to, 0, id);
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
          (views[id] ? "cards-view" : "list-view") +
          (collapsed[id] ? " is-collapsed" : "")
        }
        key={id}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          const group = e.dataTransfer.getData("text/personal-word-group");
          if (group) {
            e.preventDefault();
            moveGroup(group, index);
          }
        }}
      >
        <div
          className="group-heading"
          draggable
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
            {id === "manuscript" && <FileText size={15} />}
            {id === "fragments" && <Layers size={15} />}
            {id === "read" && <BookOpen size={15} />}
            {id === "comments" && <MessageSquare size={15} />}
            {id === "history" && <History size={15} />}
            {labels[id]}
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
          <div className="group-actions">
            <button
              aria-label={"Move " + labels[id] + " up"}
              disabled={index === 0}
              onClick={() => moveGroup(id, index - 1)}
            >
              <ArrowUp size={12} />
            </button>
            <button
              aria-label={"Move " + labels[id] + " down"}
              disabled={index === order.length - 1}
              onClick={() => moveGroup(id, index + 1)}
            >
              <ArrowDown size={12} />
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
                  {views[id] ? <List size={15} /> : <Layers size={15} />}
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
                <div className="entry-row" key={item.id}>
                  <button
                    className="entry-main"
                    onClick={() => {
                      selectDestination(id);
                      props.onCollectionSelect?.(id, item.id);
                    }}
                  >
                    <span>{item.title}</span>
                    {views[id] && item.detail && (
                      <p className="entry-preview">{item.detail}</p>
                    )}
                  </button>
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
                  onClick={() => onSelect(e.id)}
                  onDoubleClick={() => onRename(e)}
                >
                  <FileText size={14} />
                  <span>{e.title}</span>
                  <small>{entryWords(e)} words</small>
                  {views[id] && (
                    <p className="entry-preview">{e.text || "Empty"}</p>
                  )}
                </button>
                {id === "manuscript" && (
                  <div className="reorder">
                    <button
                      aria-label={"Move " + e.title + " up"}
                      disabled={project.order[0] === e.id}
                      onClick={() =>
                        onReorder(e.id, project.order.indexOf(e.id) - 1)
                      }
                    >
                      <ArrowUp size={12} />
                    </button>
                    <button
                      aria-label={"Move " + e.title + " down"}
                      disabled={project.order.at(-1) === e.id}
                      onClick={() =>
                        onReorder(e.id, project.order.indexOf(e.id) + 1)
                      }
                    >
                      <ArrowDown size={12} />
                    </button>
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
          onMouseEnter={() => prefs.hover && reveal()}
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
        <div className="sidebar-brand">
          <div className="brand">Personal Word</div>
          <button
            aria-label={prefs.pinned ? "Unpin sidebar" : "Pin sidebar"}
            aria-pressed={prefs.pinned}
            onClick={() => setPrefs((p) => ({ ...p, pinned: !p.pinned }))}
          >
            {prefs.pinned ? <PinOff size={15} /> : <Pin size={15} />}
          </button>
        </div>
        <button
          className="project-switch"
          title="All projects"
          onClick={onLibrary}
        >
          <span>{project.title}</span>
        </button>
        <div className="search">
          <Search size={14} />
          <input
            aria-label="Search project"
            placeholder="Find in project"
            value={query}
            onChange={(e) => onQuery(e.target.value)}
          />
          <kbd>⌘K</kbd>
        </div>
        <div className="sidebar-groups">
          {order
            .filter((id) => collapsibleGroups.includes(id))
            .map((id) => group(id, order.indexOf(id)))}
        </div>
        <nav className="sidebar-bottom-groups" aria-label="Project features">
          {order
            .filter((id) => !collapsibleGroups.includes(id))
            .map((id) => group(id, order.indexOf(id)))}
        </nav>
        <label className="sidebar-hover-setting">
          <input
            type="checkbox"
            checked={prefs.hover}
            onChange={(e) =>
              setPrefs((p) => ({ ...p, hover: e.target.checked }))
            }
          />
          Reveal sidebar on hover
        </label>
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
