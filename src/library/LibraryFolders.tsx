import { useLayoutEffect, useRef } from "react";
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
export function FolderNameInput({
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
      className="folder-name-input row row-label"
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
