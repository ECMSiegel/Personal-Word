import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { ChevronDown, FolderPlus, Search, Settings } from "lucide-react";
import type { Summary } from "../model";
import type { DamagedJournal } from "../save-queue";
import { desktop } from "../storage";
import { baseName, dropProblem, readDroppedPath } from "../import/dropImport";
import { ModalFrame } from "../app/ProjectDialogs";
import { DropTarget, type DropItem } from "./DropTarget";
import { Popover, PopoverItem } from "./Popover";
import { play } from "../motion";
import {
  readLibraryPreferences,
  writeLibraryPreferences,
  type LibraryColumn,
  type LibraryPreferences,
} from "../libraryPreferences";
import { ContextMenu, type ContextMenuItem } from "./ContextMenu";
import {
  ROOT,
  addFolder,
  containerOf,
  deleteFolder,
  emptyLibrary,
  fileProject,
  moveFolder,
  itemKey,
  parseKey,
  PIN_LIMIT,
  togglePin,
  placeBeside,
  renameFolder,
  savedItems,
  setFolderCollapsed,
  setFolderColour,
  type ItemKey,
  type LibraryFolder,
  type LibraryState,
} from "../library/folders";
import { buildOutline, siblings, type OutlineRow } from "../library/outline";
// Outline.tsx sits beside outline.ts; on a case-insensitive disk "../library/Outline" would
// resolve to outline.ts, so the component is imported with its extension.
import { Outline, type OutlineRowWiring } from "../library/Outline.tsx";
import { SortMenu } from "../library/SortMenu";
import { columnMenuItems, toggleColumn } from "../library/columnMenu";
import { dropPins, stalePins } from "../library/pins";
import { useLibrary } from "../library/useLibrary";
import { useLibraryDrag, type DragRowInfo } from "../library/useLibraryDrag";
import type { Drop } from "../library/outlineDrag";
import { keyboardMove } from "./dragReorder";
import { folderDestinations, folderPath } from "../library/LibraryFolders";
import "./library.css";

export function ProjectLibrary({
  projects,
  listed,
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
  /** True after the first successful project listing; until then no project pin counts as stale. */
  listed: boolean;
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
  const { sort, reverse, fallbackSort, foldersFirst, columns } = prefs;
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
  const needle = query.trim().toLocaleLowerCase();

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
  const folderFocus = (id: string) => `[data-folder-id="${CSS.escape(id)}"] .folder-chevron`;
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
  // Custom order (OB5, Decision 4). Every hand reorder -- menu, Option+arrows or a drag, under any
  // sort -- moves just that row inside its container's saved order (or, with none, the order on
  // screen) and switches the sort to Custom (changePrefs records the sort it came from). Off while
  // searching (a filtered list is never saved as an order) and until the library has loaded.
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
  // A project that was in the listing and is gone (not damaged) was deleted: its pin goes with it.
  // Not "missing from the listing" alone: that list is empty until the first load.
  const seen = useRef<string[]>([]);
  useEffect(() => {
    const gone = seen.current.filter((id) => !projects.some((p) => p.id === id) && !damagedFolders.includes(id));
    seen.current = projects.map((p) => p.id);
    if (ready && listed && gone.length) update((s) => dropPins(s, gone.map((id) => itemKey("project", id))));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projects, ready, listed, damagedFolders]);
  // What the pin menu's click needs, read at click time (a menu opened earlier keeps its old items).
  const live = useRef({ ids: [] as string[], damaged: [] as string[], listed });
  live.current = { ids: projects.map((p) => p.id), damaged: damagedFolders, listed };
  // A listing that came back empty proves nothing about which projects exist (a slow or partial read
  // looks the same), so project pins are only judged stale against a non-empty, successful listing.
  const knowsProjects = (now: { ids: string[]; listed: boolean }) => now.listed && now.ids.length > 0;
  // The page (OB1 model): one flat list of rows with depths. Search is a flat list of matches in
  // the active sort (Custom shows its fallback sort), with no folders and no pinned rows.
  const outline = buildOutline({ projects, lib, sort, fallbackSort, reverse, foldersFirst });
  const matches = needle
    ? buildOutline({
        projects: projects.filter((p) => p.title.toLocaleLowerCase().includes(needle)),
        lib: emptyLibrary,
        sort: sort === "custom" ? fallbackSort : sort,
        fallbackSort,
        reverse,
        foldersFirst,
      }).rows.map((row): OutlineRow => {
        const at = containerOf(lib, row.id);
        return { ...row, container: at, path: at === ROOT ? undefined : folderPath(lib, at) };
      })
    : [];
  // Hand reorder (OB5). "Shown" is a container's order as the page draws it in the current sort,
  // with every folder open (so a collapsed folder has its would-be order) and without the rows
  // lifted into the pinned band (they are not on screen in their container).
  const opened = (s: LibraryState): LibraryState => ({
    ...s,
    folders: s.folders.map((f) => (f.collapsed ? { ...f, collapsed: false } : f)),
  });
  const layout = (s: LibraryState, asCustom = false) => {
    const o = buildOutline({
      projects,
      lib: opened(s),
      sort: asCustom ? "custom" : sort,
      // As toCustom/changePrefs: Custom falls back to the sort it came from.
      fallbackSort: asCustom && sort !== "custom" ? sort : fallbackSort,
      reverse,
      foldersFirst,
    });
    return [...o.pinned.filter((r) => r.depth > 0), ...o.rows];
  };
  const shownIn = (container: string, s = lib, asCustom = false) => siblings(layout(s, asCustom), container);
  const containerOfKey = (key: ItemKey) => {
    const { kind, id } = parseKey(key);
    return kind === "project" ? containerOf(lib, id) : (lib.folders.find((f) => f.id === id)?.parent ?? ROOT);
  };
  /** The neighbour a step of `dir` would pass, or null at the end of the container or, under
   *  Folders on top, where a project would pass a folder (or a folder a project). */
  const stepTarget = (key: ItemKey, dir: -1 | 1, shown: ItemKey[]): ItemKey | null => {
    const at = shown.indexOf(key);
    const next = at < 0 ? undefined : shown[at + dir];
    if (!next) return null;
    return foldersFirst && next[0] !== key[0] ? null : next;
  };
  /** Move up (-1) / down (1) past the neighbouring on-screen sibling; focus stays on the row. */
  const stepItem = (key: ItemKey, name: string, dir: -1 | 1, focus: string) => {
    if (!canReorder) return;
    const container = containerOfKey(key);
    const shown = shownIn(container);
    // Rows in the pinned band are not in their container's on-screen order: no step.
    if (!shown.includes(key)) return;
    const next = stepTarget(key, dir, shown);
    if (!next) {
      // Under Folders on top a step also stops where a folder would pass a project (or the reverse):
      // say which kind of row it is the end of, since rows of the other kind follow or precede it.
      const beyond = shown[shown.indexOf(key) + dir];
      const kind = beyond && foldersFirst && beyond[0] !== key[0] ? (key[0] === "f" ? " folder" : " project") : "";
      announce(`${name} is already ${kind ? "the " : ""}${dir < 0 ? "first" : "last"}${kind}`);
      return;
    }
    const side = dir < 0 ? "before" : "after";
    const result = placeBeside(lib, container, shown, key, next, side);
    update((s) => placeBeside(s, container, shown, key, next, side));
    toCustom();
    focusLater(focus);
    // The place it lands in the saved order, which the page shows now that the sort is Custom.
    const after = shownIn(container, result, true);
    announce(`Moved ${name} to position ${after.indexOf(key) + 1} of ${after.length}`);
  };
  const stepProject = (p: Summary, dir: -1 | 1) => stepItem(itemKey("project", p.id), p.title, dir, projectFocus(p.id));
  const stepFolder = (f: LibraryFolder, dir: -1 | 1) => stepItem(itemKey("folder", f.id), f.name, dir, folderFocus(f.id));
  /** Move up / Move down, disabled at the ends, where Folders on top stops it, in the pinned band
   *  and whenever reordering is off. */
  const stepItems = (key: ItemKey, step: (dir: -1 | 1) => void): ContextMenuItem[] => {
    const shown = canReorder ? shownIn(containerOfKey(key)) : [];
    return ([-1, 1] as const).map((dir) => ({
      label: dir < 0 ? "Move up" : "Move down",
      disabled: !canReorder || !stepTarget(key, dir, shown),
      run: () => step(dir),
    }));
  };
  /** A drag released on a target (useLibraryDrag). A row changing container is filed or moved and
   *  placed in one write; only the target container's order changes. A drop where the row already
   *  is changes nothing (no write, the sort stays). */
  const applyDrop = (source: ItemKey, drop: Drop) => {
    if (!canReorder) return;
    const { kind, id } = parseKey(source);
    const from = containerOfKey(source);
    const target = drop.kind === "end" ? ROOT : drop.kind === "into" ? drop.folder : drop.container;
    const shown = shownIn(target);
    const rest = shown.filter((k) => k !== source);
    const side = drop.kind === "after" || drop.kind === "end" ? "after" : "before";
    // Same place on screen: before its own next sibling, after its previous one, into its folder
    // when it is already first there, end when it is already last at the top level.
    if (target === from) {
      const beside = drop.kind === "into" ? (rest[0] ?? null) : drop.kind === "end" ? null : drop.key;
      const at = beside === null ? rest.length : rest.indexOf(beside) + (side === "after" ? 1 : 0);
      if (shown.indexOf(source) === at) return;
    }
    // Into: first in the folder's saved order, so before the head of the list placeBeside saves
    // (rows not yet saved come first, then the saved ones). End: last at the top level.
    const saved = savedItems(lib, target) ?? [];
    const head = [...rest.filter((k) => !saved.includes(k)), ...saved.filter((k) => rest.includes(k))][0];
    const neighbour = drop.kind === "into" ? (head ?? null) : drop.kind === "end" ? null : drop.key;
    const parent = target === ROOT ? null : target;
    // moveFolder refuses a folder into its own subtree (the drop rules never offer one).
    if (kind === "folder" && target !== from && moveFolder(lib, id, parent) === lib) return;
    update((s) => {
      const moved =
        target === from ? s : kind === "project" ? fileProject(s, id, parent) : moveFolder(s, id, parent);
      return placeBeside(moved, target, shown, source, neighbour, side);
    });
    toCustom();
  };
  // What the drag needs from the model about each drawn row (OB5a RowRect less its box).
  const all = needle ? [] : [...outline.pinned, ...outline.rows];
  const dragInfo = new Map<ItemKey, DragRowInfo>();
  all.forEach((row, i) => {
    const ancestors: string[] = [];
    for (let at = row.container; at !== ROOT; ) {
      if (ancestors.includes(at)) break;
      ancestors.unshift(at);
      at = lib.folders.find((f) => f.id === at)?.parent ?? ROOT;
    }
    dragInfo.set(row.key, {
      key: row.key,
      kind: row.kind,
      container: row.container,
      depth: row.depth,
      expandedWithRows: row.kind === "folder" && all[i + 1]?.container === row.id,
      // The band's own rows: lifted, so depth 0 inside `pinned` (their children are deeper).
      pinnedTop: i < outline.pinned.length && row.depth === 0,
      ancestors,
    });
  });
  const { drag, onPointerDown: startDrag } = useLibraryDrag({
    tree,
    enabled: canReorder,
    info: (key) => dragInfo.get(key),
    foldersFirst,
    onDrop: applyDrop,
  });
  const lastKey = all[all.length - 1]?.key;
  /** The drag state a row draws (outline.css): lifted, the drop line, "into", the end line. */
  const dragAttrs = (row: OutlineRow) => {
    const drop = drag?.drop;
    const edge =
      drop && (drop.kind === "before" || drop.kind === "after") && drop.key === row.key
        ? drop.kind === "before" ? "start" : "end"
        : drop?.kind === "end" && row.key === lastKey ? "end" : undefined;
    return {
      "data-drag-state": drag?.source === row.key ? "lifted" : undefined,
      "data-drag-edge": edge,
      "data-drop-into": drop?.kind === "into" && row.kind === "folder" && drop.folder === row.id ? "" : undefined,
      "data-drop-end": drop?.kind === "end" && row.key === lastKey ? "" : undefined,
    };
  };
  /** "Pin to top" / "Unpin" (OB6); at the limit an unpinned row's item is disabled and says so.
   *  Only live pins count: one whose project was deleted (or folder removed) holds no slot, and is
   *  dropped when the next pin is made. Damaged projects are kept (they may come back). */
  const pinItem = (key: ItemKey): ContextMenuItem => {
    const pins = lib.pins ?? [];
    const pinned = pins.includes(key);
    const stale = stalePins(lib, live.current.ids, damagedFolders, knowsProjects(live.current));
    const used = pins.length - stale.length;
    const full = !pinned && used >= PIN_LIMIT;
    return {
      label: pinned ? "Unpin" : full ? `Pin to top (${used} of ${PIN_LIMIT} used)` : "Pin to top",
      disabled: full,
      // Stale pins are worked out at click time from the state being changed, never from the menu's build.
      run: () =>
        update((s) => {
          const now = live.current;
          return togglePin(dropPins(s, stalePins(s, now.ids, now.damaged, knowsProjects(now))), key);
        }),
    };
  };
  const folderItems = (f: LibraryFolder, at: Point): ContextMenuItem[] => [
    {
      label: f.collapsed ? "Expand" : "Collapse",
      run: () => update((s) => setFolderCollapsed(s, f.id, !f.collapsed)),
    },
    pinItem(itemKey("folder", f.id)),
    { label: "New project here", run: () => onCreate(undefined, f.id) },
    { label: "New subfolder", run: () => startFolder(f.id) },
    { label: "Rename", run: () => setEditing({ id: f.id, fresh: false }) },
    ...stepItems(itemKey("folder", f.id), (dir) => stepFolder(f, dir)),
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
      pinItem(itemKey("project", p.id)),
      ...stepItems(itemKey("project", p.id), (dir) => stepProject(p, dir)),
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
  /** A header click: another column sorts by it in its natural direction; the same one flips. */
  const sortBy = (column: "name" | LibraryColumn) =>
    sort === column ? changePrefs({ reverse: !reverse }) : changePrefs({ sort: column, reverse: false });
  const wiring = (row: OutlineRow): OutlineRowWiring => {
    if (row.kind === "folder") {
      const f = row.folder!;
      return {
        attrs: {
          ...menuHandlers(
            (at) => openMenu(at, `${f.name} actions`, folderFocus(f.id), folderItems(f, at)),
            (dir) => stepFolder(f, dir),
          ),
          ...dragAttrs(row),
        },
        onActivate: () => update((s) => setFolderCollapsed(s, f.id, !f.collapsed)),
        tint: colours?.find((c) => c.id === f.colour)?.colour,
        rename:
          editing?.id === f.id
            ? (name, viaKey) => finishEditing(f.id, editing.fresh, name, viaKey)
            : undefined,
      };
    }
    const p = row.project!;
    return {
      attrs: {
        ...menuHandlers(
          (at) => openMenu(at, `${p.title} actions`, projectFocus(p.id), projectItems(p, at)),
          (dir) => stepProject(p, dir),
        ),
        ...dragAttrs(row),
      },
      onActivate: () => onOpen(p.id),
      onDelete: () => onDelete(p),
    };
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
          <SortMenu
            sort={sort}
            reverse={reverse}
            foldersFirst={foldersFirst}
            onChange={changePrefs}
          />
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
      <Outline
        pinned={needle ? [] : outline.pinned}
        rows={needle ? matches : outline.rows}
        columns={columns}
        sort={sort}
        reverse={reverse}
        hasFolders={lib.folders.length > 0}
        showPaths={!!needle}
        onSort={sortBy}
        onHeaderMenu={(at) =>
          openMenu(at, "Columns", "button.outline-sort", columnMenuItems(columns, (c) =>
            changePrefs({ columns: toggleColumn(columns, c) }),
          ))
        }
        renderRowProps={wiring}
        rootRef={tree}
        rootAttrs={{ "data-dragging": drag ? "" : undefined, onPointerDown: startDrag }}
      >
        {needle
          ? projects.length > 0 && !matches.length && <p className="library-empty">No matching projects.</p>
          : !projects.length && (
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
      </Outline>
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
