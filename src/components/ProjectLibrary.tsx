import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { ChevronDown, FolderPlus, Layers, List, Search, Settings, Trash2 } from "lucide-react";
import type { Summary } from "../model";
import type { DamagedJournal } from "../save-queue";
import { desktop } from "../storage";
import { baseName, dropProblem, readDroppedPath } from "../import/dropImport";
import { ModalFrame } from "../app/ProjectDialogs";
import { Dropdown } from "./Dropdown";
import { DropTarget, type DropItem } from "./DropTarget";
import { Popover, PopoverItem } from "./Popover";
import { play } from "../motion";
import {
  readLibraryPreferences,
  writeLibraryPreferences,
  type LibraryFallbackSort,
  type LibraryPreferences,
} from "../libraryPreferences";
import { ContextMenu, type ContextMenuItem } from "./ContextMenu";
import {
  ROOT,
  addFolder,
  childFolders,
  containerOf,
  deleteFolder,
  fileProject,
  moveFolder,
  moveProject,
  orderedFolders,
  orderedProjects,
  renameFolder,
  reorderFolder,
  setFolderCollapsed,
  setFolderColour,
  type LibraryFolder,
} from "../library/folders";
import { useLibrary } from "../library/useLibrary";
import { useLibraryDrag } from "../library/useLibraryDrag";
import type { DragItem, Drop } from "../library/libraryDrag";
import { keyboardMove } from "./dragReorder";
import {
  FolderHeading,
  byName,
  folderDestinations,
  folderPath,
  folderSubtree,
} from "../library/LibraryFolders";
import "./library.css";

/** The Projects-page order for one sort, applied before any folders exist. Pure: the input
 * array is not touched. Custom falls back to the sort the owner came from. */
export function sortProjects(
  projects: Summary[],
  sort: LibraryFallbackSort,
  reverse: boolean,
): Summary[] {
  const added = (p: Summary) => (p as Summary & { createdAt?: string }).createdAt;
  const out = projects
    .slice()
    .sort((a, b) =>
      sort === "name"
        ? a.title.localeCompare(b.title)
        : (sort === "added" ? (added(b) ?? "") : b.updatedAt).localeCompare(
            sort === "added" ? (added(a) ?? "") : a.updatedAt,
          ),
    );
  if (reverse) out.reverse();
  return out;
}

export function ProjectLibrary({
  projects,
  onCreate,
  onOpen,
  onDelete,
  onImport,
  onImportWriting,
  damagedJournals,
  onExportJournal,
  onDiscardJournal,
  damagedFolders,
  path,
  onSetAside,
  templates,
  dropEnabled,
  onDropError,
  settings,
  colours,
}: {
  projects: Summary[];
  templates?: { id: string; name: string }[];
  /** `folderId`: file the new project in that folder (FB4 "New project here"). */
  onCreate: (templateId?: string, folderId?: string) => void;
  /** The folder colour swatches; passed only in the Color palette. */
  colours?: { id: string; label: string; colour: string }[];
  onOpen: (id: string) => void;
  onDelete: (project: Summary) => void;
  onImport: (file: File) => void;
  onImportWriting: (file: File) => void;
  damagedJournals: DamagedJournal[];
  onExportJournal: (d: DamagedJournal) => void;
  onDiscardJournal: (d: DamagedJournal) => void;
  damagedFolders: string[];
  path: string;
  onSetAside: (id: string) => void;
  dropEnabled: boolean;
  onDropError: (message: string) => void;
  settings?: ReactNode;
}) {
  const [prefs, setPrefs] = useState<LibraryPreferences>(() =>
    readLibraryPreferences(window.localStorage),
  );
  const { view, sort, reverse, fallbackSort } = prefs;
  const changePrefs = (change: Partial<LibraryPreferences>) => {
    const next = { ...prefs, ...change };
    // Choosing Custom remembers the sort the owner came from; that is what Custom shows
    // until the first hand-made order exists.
    if (change.sort === "custom")
      next.fallbackSort = prefs.sort === "custom" ? prefs.fallbackSort : prefs.sort;
    setPrefs(next);
    writeLibraryPreferences(window.localStorage, next);
  };
  const [creating, setCreating] = useState(false);
  const [searching, setSearching] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const createButton = useRef<HTMLButtonElement>(null);
  const createPanel = useRef<HTMLDivElement>(null);
  const writingInput = useRef<HTMLInputElement>(null);
  const openDropPicker = useRef<(() => void) | null>(null);
  const projectInput = useRef<HTMLInputElement>(null);
  const createFade = useRef<Animation | null>(null);
  const searchButton = useRef<HTMLButtonElement>(null);
  const searchInput = useRef<HTMLInputElement>(null);
  const templateChoices: [string, string][] = templates?.map((t) => [t.id, t.name]) ?? [
    ["blank", "Blank"],
    ["chicago", "Chicago"],
    ["screenplay", "Screenplay"],
  ];
  const added = (p: Summary) =>
    (p as Summary & { createdAt?: string }).createdAt;
  const needle = query.trim().toLocaleLowerCase();
  const sorted = sortProjects(
    projects.filter((p) => p.title.toLocaleLowerCase().includes(needle)),
    sort === "custom" ? fallbackSort : sort,
    reverse,
  );

  // Folders (FB4). Until the library has been read, and for good if the read failed, every
  // project shows at the top level and nothing about folders can be changed.
  const { state: lib, update, ready } = useLibrary(onDropError);
  const tree = useRef<HTMLDivElement>(null);
  const newFolderButton = useRef<HTMLButtonElement>(null);
  /** The folder whose name field is showing; `fresh` = just made (Escape removes it). */
  const [editing, setEditing] = useState<{ id: string; fresh: boolean } | null>(null);
  type Point = { x: number; y: number; viaKeyboard: boolean };
  const [menu, setMenu] = useState<
    (Point & { key: number; label: string; items: ContextMenuItem[]; focus: string }) | null
  >(null);
  const menuSeq = useRef(0);
  const menuFocus = useRef<string | null>(null);
  menuFocus.current = menu?.focus ?? null;
  const closeMenu = useCallback((restore: boolean) => {
    const selector = menuFocus.current;
    setMenu(null);
    if (restore && selector) tree.current?.querySelector<HTMLElement>(selector)?.focus({ preventScroll: true });
  }, []);
  const openMenu = (at: Point, label: string, focus: string, items: ContextMenuItem[]) =>
    setMenu({ ...at, key: ++menuSeq.current, label, focus, items });
  /** Right-click, Shift+F10 and the ContextMenu key; a keyboard open sits below the target.
   *  Option+Up / Option+Down run `step` (FB5 keyboard reorder). */
  const menuHandlers = (open: (at: Point) => void, step: (dir: -1 | 1) => void) => ({
    onContextMenu: (e: React.MouseEvent<HTMLElement>) => {
      e.preventDefault();
      open({ x: e.clientX, y: e.clientY, viaKeyboard: false });
    },
    onKeyDown: (e: React.KeyboardEvent<HTMLElement>) => {
      if (e.target instanceof HTMLInputElement) return;
      const dir = keyboardMove(e);
      if (dir) {
        e.preventDefault();
        step(dir);
      } else if ((e.shiftKey && e.key === "F10") || e.key === "ContextMenu") {
        e.preventDefault();
        const r = (e.target as HTMLElement).getBoundingClientRect();
        open({ x: r.left, y: r.bottom, viaKeyboard: true });
      }
    },
  });
  const projectFocus = (id: string) => `[data-project-id="${CSS.escape(id)}"] .row-label`;
  const folderFocus = (id: string) =>
    `[data-folder-id="${CSS.escape(id)}"] > [data-folder-heading] .folder-chevron`;
  const focusLater = (selector: string, fallback?: HTMLElement | null) =>
    requestAnimationFrame(() =>
      (tree.current?.querySelector<HTMLElement>(selector) ?? fallback)?.focus(),
    );
  /** "Move to folder…": replaces the open menu, at the same point, with the destinations. */
  const moveMenu = (
    at: Point,
    label: string,
    focus: string,
    current: string | null,
    moving: string | undefined,
    move: (to: string | null) => void,
  ) =>
    openMenu(
      at,
      label,
      focus,
      folderDestinations(lib, moving).map((d) => ({
        label: d.label,
        disabled: d.id === current,
        run: () => move(d.id),
      })),
    );
  const startFolder = (parent: string | null) => {
    if (!ready) return;
    if (query) {
      setQuery("");
      setSearching(false);
    }
    let id = "";
    update((s) => {
      const opened = parent && s.folders.find((f) => f.id === parent)?.collapsed
        ? setFolderCollapsed(s, parent, false)
        : s;
      const added = addFolder(opened, "New folder", parent);
      id = added.id;
      return added.state;
    });
    if (id) setEditing({ id, fresh: true });
  };
  const finishEditing = (id: string, fresh: boolean, name: string | null, viaKey: boolean) => {
    setEditing(null);
    if (name !== null) update((s) => renameFolder(s, id, name));
    else if (fresh) update((s) => deleteFolder(s, id));
    if (!viaKey) return;
    if (name === null && fresh) newFolderButton.current?.focus();
    else focusLater(folderFocus(id));
  };
  // Custom order (FB5). Every hand reorder -- menu, Option+arrows or a drag -- first switches the
  // sort to Custom (changePrefs records the sort it came from), then saves the order on screen
  // with the move applied. Off while searching (a filtered list is never saved as an order) and
  // until the library has loaded.
  const canReorder = ready && !needle;
  const toCustom = () => {
    if (sort !== "custom") changePrefs({ sort: "custom" });
  };
  const [announcement, setAnnouncement] = useState("");
  const announceFrame = useRef(0);
  // Clear, then write on the next frame, so the same text twice is read again (as the sidebar does).
  const announce = (text: string) => {
    cancelAnimationFrame(announceFrame.current);
    setAnnouncement("");
    announceFrame.current = requestAnimationFrame(() => setAnnouncement(text));
  };
  useEffect(() => () => cancelAnimationFrame(announceFrame.current), []);
  /** One step up (-1) or down (1) among what is on screen; the focus stays on the moved row. */
  const stepBy = (
    dir: -1 | 1,
    id: string,
    name: string,
    shown: string[],
    save: (to: number) => void,
    focus: string,
  ) => {
    if (!canReorder) return;
    const to = shown.indexOf(id) + dir;
    if (to < 0 || to >= shown.length) {
      announce(`${name} is already ${dir < 0 ? "first" : "last"}`);
      return;
    }
    toCustom();
    save(to);
    focusLater(focus);
    announce(`Moved ${name} to position ${to + 1} of ${shown.length}`);
  };
  const projectIds = (container: string) => projectsIn(container).map((p) => p.id);
  const folderIds = (parent: string | null) => foldersIn(parent).map((f) => f.id);
  const stepProject = (p: Summary, dir: -1 | 1) => {
    const container = containerOf(lib, p.id);
    const shown = projectIds(container);
    stepBy(dir, p.id, p.title, shown, (to) => update((s) => moveProject(s, container, shown, p.id, to)), projectFocus(p.id));
  };
  const stepFolder = (f: LibraryFolder, dir: -1 | 1) => {
    const shown = folderIds(f.parent);
    stepBy(dir, f.id, f.name, shown, (to) => update((s) => reorderFolder(s, f.parent, shown, f.id, to)), folderFocus(f.id));
  };
  /** Move up / Move down, disabled at the ends and whenever reordering is off. */
  const stepItems = (id: string, shown: string[], step: (dir: -1 | 1) => void): ContextMenuItem[] =>
    ([-1, 1] as const).map((dir) => ({
      label: dir < 0 ? "Move up" : "Move down",
      disabled: !canReorder || shown[shown.indexOf(id) + dir] === undefined,
      run: () => step(dir),
    }));
  /** A drag released on a target (useLibraryDrag). A project changing folder is filed and placed
   *  in one write, using the target container's order on screen (a drop onto a heading files it first). */
  const applyDrop = (source: DragItem, drop: Drop) => {
    if (!canReorder) return;
    if (source.kind === "project") {
      const from = containerOf(lib, source.id);
      const target = drop.kind === "into" ? drop.folder : drop.container;
      const shown = projectIds(target);
      const rest = shown.filter((id) => id !== source.id);
      toCustom();
      // Onto a heading: filed like "Move to folder…", so it appears first in that folder.
      if (drop.kind === "into") {
        update((s) => fileProject(s, source.id, target === ROOT ? null : target));
        return;
      }
      const to = rest.indexOf(drop.id) + (drop.kind === "after" ? 1 : 0);
      update((s) =>
        moveProject(target === from ? s : fileProject(s, source.id, target === ROOT ? null : target), target, shown, source.id, to),
      );
      return;
    }
    if (drop.kind === "into") return;
    const parent = lib.folders.find((f) => f.id === source.id)?.parent ?? null;
    const shown = folderIds(parent);
    const to = shown.filter((id) => id !== source.id).indexOf(drop.id) + (drop.kind === "after" ? 1 : 0);
    toCustom();
    update((s) => reorderFolder(s, parent, shown, source.id, to));
  };
  const { drag, onPointerDown: startDrag } = useLibraryDrag({ tree, enabled: canReorder, view, onDrop: applyDrop });
  const folderItems = (f: LibraryFolder, at: Point): ContextMenuItem[] => [
    {
      label: f.collapsed ? "Expand" : "Collapse",
      run: () => update((s) => setFolderCollapsed(s, f.id, !f.collapsed)),
    },
    { label: "New project here", run: () => onCreate(undefined, f.id) },
    { label: "New subfolder", run: () => startFolder(f.id) },
    { label: "Rename", run: () => setEditing({ id: f.id, fresh: false }) },
    ...stepItems(f.id, folderIds(f.parent), (dir) => stepFolder(f, dir)),
    {
      label: "Move to folder…",
      run: () =>
        moveMenu(at, `Move ${f.name} to`, folderFocus(f.id), f.parent, f.id, (to) => {
          update((s) => moveFolder(s, f.id, to));
          focusLater(folderFocus(f.id));
        }),
    },
    { label: "Delete folder", danger: true, run: () => update((s) => deleteFolder(s, f.id)) },
    ...(colours
      ? [
          {
            kind: "swatches" as const,
            label: "Colour",
            value: f.colour ?? "",
            options: colours,
            // Picking the current colour clears it.
            onPick: (colour: string) =>
              update((s) =>
                setFolderColour(
                  s,
                  f.id,
                  s.folders.find((x) => x.id === f.id)?.colour === colour ? undefined : colour,
                ),
              ),
          },
        ]
      : []),
  ];
  const projectItems = (p: Summary, at: Point): ContextMenuItem[] => {
    const current = containerOf(lib, p.id);
    return [
      { label: "Open", run: () => onOpen(p.id) },
      ...stepItems(p.id, projectIds(current), (dir) => stepProject(p, dir)),
      {
        label: "Move to folder…",
        disabled: !ready,
        run: () =>
          moveMenu(at, `Move ${p.title} to`, projectFocus(p.id), current === ROOT ? null : current, undefined, (to) => {
            update((s) => fileProject(s, p.id, to));
            focusLater(projectFocus(p.id));
          }),
      },
      { label: "Delete", danger: true, run: () => onDelete(p) },
    ];
  };
  const activeSort = sort === "custom" ? fallbackSort : sort;
  /** A container's projects: the active sort, then the hand-made order while Custom. */
  const projectsIn = (container: string) => {
    const shown = sortProjects(
      projects.filter((p) => containerOf(lib, p.id) === container),
      activeSort,
      reverse,
    );
    return sort === "custom" ? orderedProjects(lib, container, shown) : shown;
  };
  /** A container's subfolders: by name, then the hand-made order while Custom. */
  const foldersIn = (parent: string | null) => {
    const named = childFolders(lib, parent).slice().sort(byName);
    return sort === "custom" ? orderedFolders(lib, parent, named) : named;
  };
  const folderCount = (id: string) => {
    const inside = folderSubtree(lib, id);
    return projects.filter((p) => inside.has(containerOf(lib, p.id))).length;
  };
  useLayoutEffect(() => {
    if (!creating) return;
    createPanel.current?.querySelector<HTMLButtonElement>("button")?.focus();
  }, [creating]);
  const previousCreating = useRef(creating);
  useEffect(() => {
    if (previousCreating.current === creating) return;
    previousCreating.current = creating;
    const trigger = createButton.current;
    // The menu covers the trigger; fade it out on open and back in on close.
    // Under reduced motion the menu simply covers it with no animation.
    if (!trigger) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      createFade.current?.cancel();
      createFade.current = null;
      trigger.style.removeProperty("opacity");
      return;
    }
    if (createFade.current) {
      createFade.current.reverse();
      return;
    }
    createFade.current = play(trigger, [{ opacity: 1 }, { opacity: 0 }], {
      speed: "fast",
      easing: "out",
      fill: "both",
    });
  }, [creating]);
  useEffect(() => () => createFade.current?.cancel(), []);
  useEffect(() => {
    // Browser preview: a file dropped outside the drop region must not replace the page.
    // (In the Mac app, Tauri takes file drags before the page sees them.)
    if (desktop) return;
    const block = (e: DragEvent) => e.preventDefault();
    document.addEventListener("dragover", block);
    document.addEventListener("drop", block);
    return () => {
      document.removeEventListener("dragover", block);
      document.removeEventListener("drop", block);
    };
  }, []);
  // Browsers hide a dragged file's name until the drop, so an empty name passes here.
  const acceptWriting = (file: DropItem) =>
    !dropEnabled
      ? "Finish the open step first."
      : file.name
        ? dropProblem([file.name])
        : null;
  const importDropped = (files: File[] | string[]) => {
    const names = files.map((f) => (typeof f === "string" ? baseName(f) : f.name));
    const problem = dropProblem(names);
    if (problem) return onDropError(problem);
    const first = files[0];
    if (typeof first === "string")
      readDroppedPath(first).then(onImportWriting, (error) => onDropError(String(error)));
    else onImportWriting(first);
  };
  const closeCreate = (refocus: boolean) => {
    setCreating(false);
    if (refocus) createButton.current?.focus();
  };
  const onPanelKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      e.stopPropagation();
      return closeCreate(true);
    }
    const items = [
      ...(createPanel.current?.querySelectorAll<HTMLButtonElement>("button") ??
        []),
    ];
    const at = items.indexOf(document.activeElement as HTMLButtonElement);
    const target =
      e.key === "ArrowDown"
        ? items[(at + 1) % items.length]
        : e.key === "ArrowUp"
          ? items[(at - 1 + items.length) % items.length]
          : e.key === "Home"
            ? items[0]
            : e.key === "End"
              ? items[items.length - 1]
              : null;
    if (!target) return;
    e.preventDefault();
    target.focus();
  };
  const closeSearch = (refocus: boolean) => {
    setQuery("");
    setSearching(false);
    if (refocus) searchButton.current?.focus();
  };
  const date = (value?: string) =>
    value
      ? new Date(value).toLocaleDateString(undefined, {
          month: "short",
          day: "numeric",
          year: "numeric",
        })
      : "Unknown";
  const projectRow = (p: Summary, path?: string) => (
    <div
      className="project-row row"
      key={p.id}
      data-project-id={p.id}
      data-drag-state={lifted("project", p.id) ? "lifted" : undefined}
      data-drag-edge={edgeAt(p.id, path === undefined ? containerOf(lib, p.id) : undefined)}
      {...menuHandlers(
        (at) => openMenu(at, `${p.title} actions`, projectFocus(p.id), projectItems(p, at)),
        (dir) => stepProject(p, dir),
      )}
    >
      <button className="emph-row row-label" onClick={() => onOpen(p.id)}>
        <strong className="project-name emph-label">
          {p.title}
          {path && (
            <>
              {" "}
              <span className="project-path">-- {path}</span>
            </>
          )}
        </strong>
        <span className="project-dates">
          <span className="project-edited">Edited {date(p.updatedAt)}</span>
          <span className="project-added">Added {date(added(p))}</span>
          {p.wordCount !== undefined && (
            <span className="project-words">
              {p.wordCount.toLocaleString("en-US")} {p.wordCount === 1 ? "word" : "words"}
            </span>
          )}
          {p.sectionCount !== undefined && (
            <span className="project-sections">
              {p.sectionCount} {p.sectionCount === 1 ? "section" : "sections"}
            </span>
          )}
        </span>
      </button>
      <button
        className="delete-entry icon-grow slot flush-end"
        aria-label={"Delete project " + p.title}
        title="Delete project"
        onClick={() => onDelete(p)}
      >
        <Trash2 size={16} />
      </button>
    </div>
  );
  /** One container's projects. A folder with no projects renders none; the top level always
   *  renders (it holds the empty state). */
  const lifted = (kind: DragItem["kind"], id: string) =>
    drag?.source.kind === kind && drag.source.id === id;
  /** The 2 px drop line: "start" above (list) or left of (cards) the target, "end" below or right.
   *  A folder's line marks its whole section, so "after" reads as after its contents. */
  const edgeAt = (id: string, container: string | undefined) => {
    const d = drag?.drop;
    if (!d || d.kind === "into" || d.id !== id || d.container !== container) return undefined;
    return d.kind === "before" ? "start" : "end";
  };
  const projectsBox = (container: string, extra?: ReactNode, always = false) => {
    const shown = projectsIn(container);
    if (!shown.length && !always) return null;
    return (
      <div
        className={"folder-projects project-list project-list--" + view}
        data-container={container}
        data-drag-axis={view === "cards" ? "x" : undefined}
      >
        {shown.map((p) => projectRow(p))}
        {extra}
      </div>
    );
  };
  const folderSection = (f: LibraryFolder): ReactNode => (
    <section
      className={"library-folder stack " + (view === "cards" ? "gap-2" : "gap-0")}
      key={f.id}
      data-folder-id={f.id}
      data-drag-edge={edgeAt(f.id, f.parent ?? ROOT)}
    >
      <FolderHeading
        folder={f}
        count={folderCount(f.id)}
        tint={colours?.find((c) => c.id === f.colour)?.colour}
        editing={editing?.id === f.id}
        lifted={lifted("folder", f.id)}
        dropInto={drag?.drop?.kind === "into" && drag.drop.folder === f.id}
        onToggle={() => update((s) => setFolderCollapsed(s, f.id, !f.collapsed))}
        onRenamed={(name, viaKey) => finishEditing(f.id, editing?.fresh ?? false, name, viaKey)}
        {...menuHandlers(
          (at) => openMenu(at, `${f.name} actions`, folderFocus(f.id), folderItems(f, at)),
          (dir) => stepFolder(f, dir),
        )}
      />
      {!f.collapsed && (
        <div className={"folder-body stack indent " + (view === "cards" ? "gap-6" : "gap-5")}>
          {foldersIn(f.id).map((c) => folderSection(c))}
          {projectsBox(f.id)}
        </div>
      )}
    </section>
  );
  return (
    <main
      className="library"
      aria-label="Projects"
    >
      <div className="brand">Personal Word</div>
      <div className="library-toolbar bar">
        <div
          className="create-project"
          onKeyDown={(e) => {
            if (e.key === "Escape" && creating) {
              e.stopPropagation();
              closeCreate(true);
            }
          }}
          onBlur={(e) => {
            const next = e.relatedTarget as Node | null;
            if (creating && next && !e.currentTarget.contains(next))
              setCreating(false);
          }}
        >
          <button
            ref={createButton}
            type="button"
            className="primary"
            aria-expanded={creating}
            aria-controls="create-panel"
            onClick={() => setCreating((value) => !value)}
          >
            Start new project <ChevronDown size={14} />
          </button>
          <Popover
            open={creating}
            anchor={createButton}
            morph="anchor"
            highlight="follow"
            role="group"
            className="menu"
            id="create-panel"
            label="Start new project"
            onDismiss={() => setCreating(false)}
            onKeyDown={onPanelKeyDown}
            ref={createPanel}
          >
            {templateChoices.map(([id, label]) => (
              <PopoverItem
                key={id}
                onClick={() => {
                  setCreating(false);
                  onCreate(id);
                }}
              >
                {label}
              </PopoverItem>
            ))}
            <div className="menu-rule" role="separator" />
            <PopoverItem
              onClick={() => {
                setCreating(false);
                writingInput.current?.click();
              }}
            >
              Import a file…
            </PopoverItem>
            <PopoverItem
              onClick={() => {
                setCreating(false);
                projectInput.current?.click();
              }}
            >
              Recover from a project.json file…
            </PopoverItem>
          </Popover>
        </div>
        <button
          type="button"
          className="library-import"
          aria-label="Import writing (text, Markdown, Word, HTML or a .zip bundle)"
          onClick={() => openDropPicker.current?.()}
        >
          Import writing
        </button>
        <div className="library-display cluster gap-2 flush-end">
          <div className="library-search" data-open={searching || undefined}>
            <div className="library-search-field">
              <button
                ref={searchButton}
                type="button"
                className="icon-grow"
                aria-label="Search projects"
                aria-expanded={searching}
                aria-controls="library-search-input"
                onClick={() => {
                  if (searching && !query) return closeSearch(false);
                  setSearching(true);
                  requestAnimationFrame(() => searchInput.current?.focus());
                }}
              >
                <Search size={16} />
              </button>
              <input
                ref={searchInput}
                id="library-search-input"
                type="text"
                role="searchbox"
                aria-label="Filter projects by title"
                placeholder="Search projects"
                tabIndex={searching ? 0 : -1}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Escape") {
                    e.stopPropagation();
                    closeSearch(true);
                  }
                }}
                onBlur={(e) => {
                  if (!query && e.relatedTarget !== searchButton.current)
                    setSearching(false);
                }}
              />
            </div>
          </div>
          <Dropdown
            label="Sort projects"
            value={sort}
            onChange={(value) => changePrefs({ sort: value })}
            cover
            plain
            options={[
              { value: "name", label: "Name" },
              { value: "added", label: "Added" },
              { value: "edited", label: "Last edited" },
              { value: "custom", label: "Custom" },
            ]}
          />
          <button
            type="button"
            className="icon-button icon-grow slot"
            aria-label="Reverse project sort order"
            disabled={sort === "custom"}
            onClick={() => changePrefs({ reverse: !reverse })}
          >
            <span aria-hidden="true">{reverse ? "↑" : "↓"}</span>
          </button>
          <button
            ref={newFolderButton}
            type="button"
            className="icon-button icon-grow slot"
            aria-label="New folder"
            title="New folder"
            disabled={!ready}
            onClick={() => startFolder(null)}
          >
            <FolderPlus size={16} />
          </button>
          <button
            type="button"
            className="icon-button icon-grow slot"
            aria-label={
              view === "list" ? "Show project cards" : "Show project list"
            }
            onClick={() => changePrefs({ view: view === "list" ? "cards" : "list" })}
          >
            {view === "list" ? <Layers size={16} /> : <List size={16} />}
          </button>
          {settings && (
            <button
              type="button"
              className="library-settings icon-grow slot"
              aria-label="Settings"
              title="Settings"
              onClick={() => setSettingsOpen(true)}
            >
              <Settings size={16} aria-hidden="true" />
            </button>
          )}
        </div>
      </div>
      <DropTarget
        accept={acceptWriting}
        onFiles={importDropped}
        onReject={(reason) => dropEnabled && onDropError(reason)}
        label="Drop to import"
        openPicker={openDropPicker}
      >
      {/* Top-level blocks and a folder's own blocks are spaced apart, so a folder's last
          project never reads as part of what follows it. */}
      <div
        className={"library-tree stack " + (view === "cards" ? "gap-6" : "gap-5")}
        ref={tree}
        data-dragging={drag ? "" : undefined}
        onPointerDown={startDrag}
      >
        {needle ? (
          // Search: no headings, one flat list, each match with its folder path.
          <div className={"folder-projects project-list project-list--" + view} data-search="">
            {sorted.map((p) => {
              const at = containerOf(lib, p.id);
              return projectRow(p, at === ROOT ? undefined : folderPath(lib, at));
            })}
            {projects.length > 0 && !sorted.length && (
              <p className="library-empty">No matching projects.</p>
            )}
          </div>
        ) : (
          <>
            {foldersIn(null).map((f) => folderSection(f))}
            {projectsBox(ROOT, (
              !projects.length && (
                <div className="library-empty">
                  <p>
                    Start with a blank page or a template, or bring in writing you
                    already have.
                  </p>
                  <div className="library-empty-actions">
                    {templateChoices.map(([id, label]) => (
                      <button
                        key={id}
                        type="button"
                        className="text-action"
                        aria-label={"Start a " + label + " project"}
                        onClick={() => onCreate(id)}
                      >
                        {label}
                      </button>
                    ))}
                    <button
                      type="button"
                      className="text-action"
                      aria-label="Import writing from a file"
                      onClick={() => writingInput.current?.click()}
                    >
                      Import writing
                    </button>
                  </div>
                </div>
              )
            ), true)}
          </>
        )}
        {menu && (
          <ContextMenu
            key={menu.key}
            x={menu.x}
            y={menu.y}
            label={menu.label}
            items={menu.items}
            viaKeyboard={menu.viaKeyboard}
            onClose={closeMenu}
          />
        )}
      </div>
      </DropTarget>
      <div className="visually-hidden" role="status" aria-live="polite">
        {announcement}
      </div>
      {(damagedJournals.length > 0 || damagedFolders.length > 0) && (
        <div className="damaged" role="region" aria-label="Needs attention">
          <div className="eyebrow">NEEDS ATTENTION</div>
          {damagedJournals.map((d) => (
            <div className="damaged-row" key={d.key}>
              <span>
                <strong>Damaged recovery journal</strong>
                <small>
                  {d.key.replace("folio.recovery.", "")} -- {d.message}
                </small>
              </span>
              <button onClick={() => onExportJournal(d)}>Export</button>
              <button onClick={() => onDiscardJournal(d)}>Discard</button>
            </div>
          ))}
          {damagedFolders.map((id) => (
            <div className="damaged-row" key={id}>
              <span>
                <strong>Project folder cannot be opened</strong>
                <small>
                  Keep a copy of {path}/{id}, then recover it from its
                  project.json or a snapshots/ file using Recover from a project.json file in the Start new project panel.
                </small>
              </span>
              <button onClick={() => onSetAside(id)}>Set aside</button>
            </div>
          ))}
        </div>
      )}
      <span id="import-project-label" className="visually-hidden">
        Recover from a project.json file
      </span>
      <input
        ref={projectInput}
        id="import-project-json"
        className="visually-hidden"
        type="file"
        accept=".json"
        aria-labelledby="import-project-label"
        tabIndex={-1}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onImport(file);
        }}
      />
      <span id="import-writing-label" className="visually-hidden">
        Import writing -- text or Markdown (up to 5 MB), Word, HTML or Markdown bundle (.zip) (up to 20 MB)
      </span>
      <input
        ref={writingInput}
        id="import-writing-text"
        className="visually-hidden"
        type="file"
        accept=".txt,.md,.markdown,.zip,.docx,.html,.htm,text/plain,application/zip,text/markdown,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/html"
        aria-labelledby="import-writing-label"
        tabIndex={-1}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onImportWriting(file);
          e.currentTarget.value = "";
        }}
      />
      {settingsOpen && settings && (
        <ModalFrame title="Settings" onCancel={() => setSettingsOpen(false)}>
          <div className="project-settings library-settings-body">
            {settings}
          </div>
          <div className="dialog-actions cluster gap-4">
            <button type="button" onClick={() => setSettingsOpen(false)}>
              Close
            </button>
          </div>
        </ModalFrame>
      )}
      <p className="storage-note">
        {desktop
          ? "Your writing stays on this Mac."
          : "Browser preview -- writing is stored in this browser only."}
      </p>
    </main>
  );
}
