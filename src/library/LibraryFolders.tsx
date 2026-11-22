import { useLayoutEffect, useRef, type KeyboardEvent, type MouseEvent } from "react";
import { ChevronDown, ChevronRight, Folder as FolderIcon } from "lucide-react";
import { childFolders, type LibraryFolder, type LibraryState } from "./folders";
import "../components/drag-reorder.css";
import "./folders.css";

/** Folders sort by name wherever the sort is not Custom (FB4 step 2). */
export const byName = (a: LibraryFolder, b: LibraryFolder) => a.name.localeCompare(b.name);

/** "Essays / Drafts": the folder's names from the top level down. */
export function folderPath(state: LibraryState, id: string): string {
  const names: string[] = [];
  const seen = new Set<string>();
  let at = state.folders.find((f) => f.id === id);
  while (at && !seen.has(at.id)) {
    seen.add(at.id);
    names.unshift(at.name);
    const parent = at.parent;
    at = parent === null ? undefined : state.folders.find((f) => f.id === parent);
  }
  return names.join(" / ");
}

/** The folder and every folder beneath it. */
export function folderSubtree(state: LibraryState, id: string): Set<string> {
  const ids = new Set([id]);
  for (let grew = true; grew; ) {
    grew = false;
    for (const f of state.folders)
      if (f.parent !== null && ids.has(f.parent) && !ids.has(f.id)) {
        ids.add(f.id);
        grew = true;
      }
  }
  return ids;
}

/** "Move to folder…" rows: Top level, then every folder by path in tree order. Moving a
 *  folder leaves out itself and its descendants. Labels are unique (menu rows key on them). */
export function folderDestinations(
  state: LibraryState,
  moving?: string,
): { id: string | null; label: string }[] {
  const skip = moving ? folderSubtree(state, moving) : new Set<string>();
  const out: { id: string | null; label: string }[] = [{ id: null, label: "Top level" }];
  const used = new Set(["Top level"]);
  const walk = (parent: string | null) => {
    for (const f of childFolders(state, parent).slice().sort(byName)) {
      if (skip.has(f.id)) continue;
      let label = folderPath(state, f.id);
      for (let n = 2; used.has(label); n++) label = `${folderPath(state, f.id)} (${n})`;
      used.add(label);
      out.push({ id: f.id, label });
      walk(f.id);
    }
  };
  walk(null);
  return out;
}

/** The name field for a new or renamed folder: focused and selected; Enter or blur saves,
 *  Escape cancels (`null`). `viaKey` says whether a key, not a blur, finished it. */
function FolderNameInput({
  initial,
  onDone,
}: {
  initial: string;
  onDone: (name: string | null, viaKey: boolean) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const done = useRef(false);
  useLayoutEffect(() => {
    input.current?.focus();
    input.current?.select();
  }, []);
  const finish = (name: string | null, viaKey: boolean) => {
    if (done.current) return;
    done.current = true;
    onDone(name, viaKey);
  };
  return (
    <input
      ref={input}
      type="text"
      className="folder-name-input row-label"
      aria-label="Folder name"
      defaultValue={initial}
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          finish(e.currentTarget.value, true);
        } else if (e.key === "Escape") {
          e.preventDefault();
          e.stopPropagation();
          finish(null, true);
        }
      }}
      onBlur={(e) => finish(e.currentTarget.value, false)}
    />
  );
}

/**
 * One folder heading (FB4 step 3): `div.folder-heading.row[data-folder-heading]` holding the
 * chevron button (the keyboard stop: `aria-expanded`, named by the folder), the folder icon, the
 * name (or its rename field) and a muted "-- n" count. A click anywhere on the heading toggles it.
 * Nesting comes from the enclosing folder bodies (`.indent`, one `--slot` per level).
 */
export function FolderHeading({
  folder,
  count,
  tint,
  editing,
  lifted,
  dropInto,
  onToggle,
  onRenamed,
  onContextMenu,
  onKeyDown,
}: {
  folder: LibraryFolder;
  count: number;
  /** CSS colour for the icon (Color palette with a colour set); otherwise it stays muted. */
  tint?: string;
  editing: boolean;
  /** FB5 drag: this folder is being dragged / a dragged project would be filed into it. */
  lifted?: boolean;
  dropInto?: boolean;
  onToggle: () => void;
  onRenamed: (name: string | null, viaKey: boolean) => void;
  onContextMenu: (e: MouseEvent<HTMLElement>) => void;
  onKeyDown: (e: KeyboardEvent<HTMLElement>) => void;
}) {
  const expanded = !folder.collapsed;
  return (
    <div
      className="folder-heading row"
      data-folder-heading={folder.id}
      data-drag-state={lifted ? "lifted" : undefined}
      data-drop-into={dropInto ? "" : undefined}
      onClick={editing ? undefined : onToggle}
      onContextMenu={onContextMenu}
      onKeyDown={onKeyDown}
    >
      <button
        type="button"
        className="folder-chevron icon-button slot flush-start"
        aria-label={folder.name}
        aria-expanded={expanded}
      >
        {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
      </button>
      <FolderIcon size={16} className="folder-icon" aria-hidden="true" style={tint ? { color: tint } : undefined} />
      {editing ? (
        <FolderNameInput initial={folder.name} onDone={onRenamed} />
      ) : (
        <span className="folder-name">{folder.name}</span>
      )}
      <span className="folder-count">-- {count}</span>
    </div>
  );
}
