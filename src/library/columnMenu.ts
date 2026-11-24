import type { ContextMenuItem } from "../components/ContextMenu";
import { LIBRARY_COLUMNS, type LibraryColumn } from "../libraryPreferences";

export const COLUMN_LABELS: Record<LibraryColumn, string> = {
  edited: "Edited",
  words: "Words",
  sections: "Sections",
  added: "Added",
};

/** One checkable row per column; a shown column is ticked. */
export function columnMenuItems(
  columns: LibraryColumn[],
  toggle: (column: LibraryColumn) => void,
): ContextMenuItem[] {
  return LIBRARY_COLUMNS.map((column) => ({
    label: COLUMN_LABELS[column],
    checked: columns.includes(column),
    run: () => toggle(column),
  }));
}

/** The column list after ticking or unticking one; always in LIBRARY_COLUMNS order. */
export function toggleColumn(columns: LibraryColumn[], column: LibraryColumn): LibraryColumn[] {
  return LIBRARY_COLUMNS.filter((c) => (c === column ? !columns.includes(c) : columns.includes(c)));
}
