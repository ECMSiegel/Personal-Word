import type { CSSProperties, HTMLAttributes, KeyboardEvent, ReactNode, Ref } from "react";
import { ChevronDown, ChevronRight, Folder as FolderIcon, Pin, Trash2 } from "lucide-react";
import type { OutlineRow } from "./outline";
import type { LibraryColumn, LibrarySort } from "../libraryPreferences";
import { FolderNameInput } from "./LibraryFolders";
import "./outline.css";

/** What `ProjectLibrary` wires onto one row (OB2 contract; OB5 and OB6 add to `attrs`). */
export type OutlineRowWiring = {
  /** Spread on the row element: context menu, Option+arrows, Shift+F10, later drag state. */
  attrs: HTMLAttributes<HTMLDivElement> & { [data: `data-${string}`]: string | undefined };
  /** Project: open it. Folder: expand or collapse it. */
  onActivate: () => void;
  /** Projects only: the trash button. */
  onDelete?: () => void;
  /** Folders: the icon colour (Color palette with a colour set); otherwise the icon is muted. */
  tint?: string;
  /** Folders: set while the rename field shows; called with the name, or null when cancelled. */
  rename?: (name: string | null, viaKey: boolean) => void;
};

const LABELS: Record<"name" | LibraryColumn, string> = {
  name: "Name",
  edited: "Edited",
  words: "Words",
  sections: "Sections",
  added: "Added",
};

const date = (value?: string) =>
  value
    ? new Date(value).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })
    : "";
const count = (n: number) => n.toLocaleString("en-US");
const plural = (n: number, one: string) => `${count(n)} ${n === 1 ? one : one + "s"}`;

/** One cell: the value only (the header labels it), with the full phrase as its label. */
function Cell({ column, value, label }: { column: LibraryColumn; value: string; label?: string }) {
  return (
    <span className={`outline-cell col-${column}`} aria-label={value ? label : undefined}>
      {value}
    </span>
  );
}

function cells(row: OutlineRow, columns: LibraryColumn[]): ReactNode[] {
  return columns.map((column) => {
    if (row.kind === "folder") {
      const t = row.totals ?? { words: 0, projects: 0 };
      if (column === "edited") return <Cell key={column} column={column} value={date(t.edited)} label={`Edited ${date(t.edited)}`} />;
      if (column === "words") return <Cell key={column} column={column} value={count(t.words)} label={plural(t.words, "word")} />;
      if (column === "sections") {
        const text = plural(t.projects, "project");
        return <Cell key={column} column={column} value={text} label={text} />;
      }
      return <Cell key={column} column={column} value="" />;
    }
    const p = row.project!;
    if (column === "edited") return <Cell key={column} column={column} value={date(p.updatedAt)} label={`Edited ${date(p.updatedAt)}`} />;
    if (column === "added") return <Cell key={column} column={column} value={date(p.createdAt)} label={`Added ${date(p.createdAt)}`} />;
    const n = column === "words" ? p.wordCount : p.sectionCount;
    return (
      <Cell
        key={column}
        column={column}
        value={n === undefined ? "" : count(n)}
        label={n === undefined ? undefined : plural(n, column === "words" ? "word" : "section")}
      />
    );
  });
}

/** The sort each header column stands for; Name and Edited read A to Z / newest first at rest. */
const ascendingAtRest = (sort: LibrarySort) => sort === "name";

/**
 * The Projects page outline (OB2): a header row, then `pinned` and `rows` drawn alike, every row on
 * one grid template shared with the header, so names and columns line up at every depth.
 * Row skeleton, left to right: depth indent (`.depth`, one `--slot` per level), arrow slot (only
 * when the library has folders), icon slot, name, the visible columns, trash slot.
 */
export function Outline({
  pinned,
  rows,
  columns,
  sort,
  reverse,
  hasFolders,
  showPaths = false,
  onSort,
  onHeaderMenu,
  renderRowProps,
  rootRef,
  rootAttrs,
  children,
}: {
  pinned: OutlineRow[];
  rows: OutlineRow[];
  columns: LibraryColumn[];
  sort: LibrarySort;
  reverse: boolean;
  hasFolders: boolean;
  /** Search results: show each project's folder path ("-- Essays / Drafts") after its name. */
  showPaths?: boolean;
  onSort: (column: "name" | LibraryColumn) => void;
  onHeaderMenu: (at: { x: number; y: number; viaKeyboard: boolean }) => void;
  renderRowProps: (row: OutlineRow) => OutlineRowWiring;
  /** The list root (`.outline.library-tree`): measured by drag and used to restore focus. */
  rootRef?: Ref<HTMLDivElement>;
  rootAttrs?: HTMLAttributes<HTMLDivElement> & { [data: `data-${string}`]: string | undefined };
  /** Drawn under the list: the empty state, "No matching projects.", the context menu. */
  children?: ReactNode;
}) {
  const lead = hasFolders ? "[arrow] var(--slot) [icon] var(--icon-size)" : "[icon] var(--icon-size)";
  const tracks = (shown: LibraryColumn[]) =>
    `${lead} [name] minmax(0, 1fr) ${shown.map((c) => `[${c}] var(--col-${c})`).join(" ")} [trash] var(--slot) [end]`;
  const style = {
    "--outline-template": tracks(columns),
    "--outline-template-narrow": tracks(columns.filter((c) => c === "edited")),
  } as CSSProperties;
  const all = [...pinned, ...rows];
  // The band's own rows (OB6). Every pinned row in the band wears the pin mark in its icon slot (a
  // pinned item inside a pinned folder uses a slot too; on a folder it stands in for the folder
  // icon); only the lifted top rows (depth 0) also show the folder path.
  const bandTop = new Set(pinned.filter((r) => r.depth === 0).map((r) => r.key));
  const bandPinned = new Set(pinned.filter((r) => r.pinned).map((r) => r.key));
  const pinMark = (tint?: string) => (
    <Pin size={16} className="outline-icon outline-pin" role="img" aria-label="Pinned" style={tint ? { color: tint } : undefined} />
  );
  /** The name cell: the title (it alone ellipsizes), then "-- <folder path>" (search, or a lifted
   *  row from a folder), which never shrinks. */
  const nameCell = (row: OutlineRow, title: string, className: string) => {
    const path = (showPaths || bandTop.has(row.key)) && row.path;
    return (
      <span className={`outline-name ${className} cluster gap-1`}>
        <span className="outline-title">{title}</span>
        {path && <span className="project-path">{" "}-- {path}</span>}
      </span>
    );
  };

  const headerCell = (column: "name" | LibraryColumn) => {
    const active = sort === column;
    const ascending = active && ascendingAtRest(sort) !== reverse;
    const arrow = active ? <span className="outline-sort-arrow" aria-hidden="true">{ascending ? "↑" : "↓"}</span> : null;
    return (
      <div
        key={column}
        role="columnheader"
        className={`outline-heading col-${column}`}
        aria-sort={active ? (ascending ? "ascending" : "descending") : undefined}
      >
        <button
          type="button"
          className="outline-sort"
          data-active={active || undefined}
          onClick={() => onSort(column)}
          onKeyDown={(e) => {
            if ((e.shiftKey && e.key === "F10") || e.key === "ContextMenu") {
              e.preventDefault();
              const r = e.currentTarget.getBoundingClientRect();
              onHeaderMenu({ x: r.left, y: r.bottom, viaKeyboard: true });
            }
          }}
        >
          <span className="outline-sort-label cluster gap-2">
            {column !== "name" && arrow}
            {LABELS[column]}
            {column === "name" && arrow}
          </span>
        </button>
      </div>
    );
  };

  const folderRow = (row: OutlineRow, wiring: OutlineRowWiring) => {
    const f = row.folder!;
    const expanded = !f.collapsed;
    const onChevronKey = (e: KeyboardEvent<HTMLButtonElement>) => {
      if (e.altKey || e.metaKey || e.ctrlKey || e.shiftKey) return;
      if ((e.key === "ArrowLeft" && expanded) || (e.key === "ArrowRight" && !expanded)) {
        e.preventDefault();
        wiring.onActivate();
      }
    };
    return (
      <div
        key={row.key}
        {...wiring.attrs}
        className="outline-row folder-row row depth"
        style={{ "--depth": row.depth } as CSSProperties}
        data-kind="folder"
        data-key={row.key}
        data-depth={row.depth}
        data-container={row.container}
        data-folder-id={f.id}
        data-folder-heading={f.id}
        data-pinned={row.pinned ? "" : undefined}
        data-path={row.path}
        onClick={wiring.rename ? undefined : wiring.onActivate}
      >
        <button
          type="button"
          className="folder-chevron icon-button icon-grow slot flush-start"
          aria-label={f.name}
          aria-expanded={expanded}
          onKeyDown={onChevronKey}
        >
          {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        </button>
        {bandPinned.has(row.key) ? (
          pinMark(wiring.tint)
        ) : (
          <FolderIcon size={16} className="outline-icon folder-icon" aria-hidden="true" style={wiring.tint ? { color: wiring.tint } : undefined} />
        )}
        {wiring.rename ? (
          <FolderNameInput initial={f.name} onDone={wiring.rename} />
        ) : (
          nameCell(row, f.name, "folder-name")
        )}
        {cells(row, columns)}
      </div>
    );
  };

  const projectRow = (row: OutlineRow, wiring: OutlineRowWiring) => {
    const p = row.project!;
    return (
      <div
        key={row.key}
        {...wiring.attrs}
        className="outline-row project-row row depth"
        style={{ "--depth": row.depth } as CSSProperties}
        data-kind="project"
        data-key={row.key}
        data-depth={row.depth}
        data-container={row.container}
        data-project-id={p.id}
        data-pinned={row.pinned ? "" : undefined}
        data-path={row.path}
      >
        <button type="button" className="outline-open emph-row row-label" onClick={wiring.onActivate}>
          {bandPinned.has(row.key) && pinMark()}
          {nameCell(row, p.title, "project-name emph-label")}
          {cells(row, columns)}
        </button>
        <button
          type="button"
          className="delete-entry icon-grow slot flush-end"
          aria-label={"Delete project " + p.title}
          title="Delete project"
          onClick={wiring.onDelete}
        >
          <Trash2 size={16} />
        </button>
      </div>
    );
  };

  const drawRow = (row: OutlineRow) => {
    const wiring = renderRowProps(row);
    return row.kind === "folder" ? folderRow(row, wiring) : projectRow(row, wiring);
  };

  return (
    <div {...rootAttrs} ref={rootRef} className="outline library-tree" style={style}>
      {all.length > 0 && (
        <div
          className="outline-header row"
          role="row"
          onContextMenu={(e) => {
            e.preventDefault();
            onHeaderMenu({ x: e.clientX, y: e.clientY, viaKeyboard: false });
          }}
        >
          {headerCell("name")}
          {columns.map(headerCell)}
        </div>
      )}
      {/* With pins: the band, then the list straight under it, one row rule between them. */}
      {pinned.length > 0 && <div className="outline-body outline-band">{pinned.map(drawRow)}</div>}
      {(rows.length > 0 || pinned.length === 0) && <div className="outline-body">{rows.map(drawRow)}</div>}
      {children}
    </div>
  );
}
