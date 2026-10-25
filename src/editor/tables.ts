import { Extension, Node, mergeAttributes } from "@tiptap/core";
import type { Node as PMNode, NodeType, Schema, ResolvedPos } from "@tiptap/pm/model";
import {
  TextSelection,
  Selection,
  type EditorState,
  type Transaction,
} from "@tiptap/pm/state";
import {
  addColumnAfter,
  addRowAfter,
  cellAround,
  deleteColumn,
  deleteRow,
  deleteTable,
  isInTable,
  selectionCell,
  tableEditing,
  toggleHeader,
} from "@tiptap/pm/tables";

export type InsertTableOptions = { rows?: number; cols?: number; withHeaderRow?: boolean };

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    tables: {
      insertTable: (options?: InsertTableOptions) => ReturnType;
      addRowAfter: () => ReturnType;
      deleteRow: () => ReturnType;
      addColumnAfter: () => ReturnType;
      deleteColumn: () => ReturnType;
      toggleHeaderRow: () => ReturnType;
      deleteTable: () => ReturnType;
    };
  }
}

/** Cells hold any block except a table (tables cannot nest). */
const CELL_CONTENT =
  "(paragraph | heading | bulletList | orderedList | blockquote | codeBlock | horizontalRule | image)+";

const ROLES: Record<string, string> = {
  table: "table",
  tableRow: "row",
  tableCell: "cell",
  tableHeader: "header_cell",
};

/** Adds prosemirror-tables' `tableRole` to the four node specs. */
const TableRoles = Extension.create({
  name: "tableRoles",
  extendNodeSchema(extension) {
    const tableRole = ROLES[extension.name];
    return tableRole ? { tableRole } : {};
  },
});

// Merging is not offered, so spans always stay 1 (pasted spans are flattened).
const spanAttrs = () => ({
  colspan: { default: 1, parseHTML: () => 1, renderHTML: () => ({}) },
  rowspan: { default: 1, parseHTML: () => 1, renderHTML: () => ({}) },
});

const Table = Node.create({
  name: "table",
  group: "block",
  content: "tableRow+",
  isolating: true,
  parseHTML() {
    return [{ tag: "table" }];
  },
  renderHTML({ HTMLAttributes }) {
    return ["table", mergeAttributes(HTMLAttributes), ["tbody", 0]];
  },
  addProseMirrorPlugins() {
    return [tableEditing()];
  },
});

const TableRow = Node.create({
  name: "tableRow",
  content: "(tableCell | tableHeader)+",
  parseHTML() {
    return [{ tag: "tr" }];
  },
  renderHTML({ HTMLAttributes }) {
    return ["tr", mergeAttributes(HTMLAttributes), 0];
  },
});

const TableHeader = Node.create({
  name: "tableHeader",
  content: CELL_CONTENT,
  isolating: true,
  addAttributes: spanAttrs,
  parseHTML() {
    return [{ tag: "th" }];
  },
  renderHTML({ HTMLAttributes }) {
    return ["th", mergeAttributes(HTMLAttributes), 0];
  },
});

const TableCell = Node.create({
  name: "tableCell",
  content: CELL_CONTENT,
  isolating: true,
  addAttributes: spanAttrs,
  parseHTML() {
    return [{ tag: "td" }];
  },
  renderHTML({ HTMLAttributes }) {
    return ["td", mergeAttributes(HTMLAttributes), 0];
  },
});

function createTable(schema: Schema, rows: number, cols: number, withHeaderRow: boolean): PMNode {
  const type = (name: string): NodeType => schema.nodes[name];
  const cell = (t: NodeType) => t.createAndFill()!;
  const rowNodes: PMNode[] = [];
  for (let r = 0; r < rows; r++) {
    const cellType = withHeaderRow && r === 0 ? type("tableHeader") : type("tableCell");
    const cells: PMNode[] = [];
    for (let c = 0; c < cols; c++) cells.push(cell(cellType));
    rowNodes.push(type("tableRow").create(null, cells));
  }
  return type("table").create(null, rowNodes);
}

/** Tab/Shift-Tab step between cells; inside a list the list's own indent keys win. */
const insideList = (state: EditorState) => {
  const { $from } = state.selection;
  for (let d = $from.depth; d > 0; d--) if ($from.node(d).type.name === "listItem") return true;
  return false;
};

/**
 * Position just inside a cell's content where a caret should land:
 * forward Tab lands at the content start, Shift-Tab at the content end,
 * so typing appends in the previous cell instead of replacing it.
 */
function caretInsideCell(doc: PMNode, cellPos: number, cellSize: number, dir: 1 | -1): Selection | null {
  if (dir === 1) {
    const $start = doc.resolve(cellPos + 1);
    return TextSelection.findFrom($start, 1, true);
  }
  const $end = doc.resolve(cellPos + cellSize - 1);
  return TextSelection.findFrom($end, -1, true);
}

/**
 * Next/previous cell's open-token position, following the same layout rules
 * prosemirror-tables' goToNextCell uses. The schema forbids merged cells, so
 * the flat row layout these formulas cover is the only shape that exists.
 */
function findNextCellPos($cell: ResolvedPos, dir: 1 | -1): number | null {
  if (dir < 0) {
    const before = $cell.nodeBefore;
    if (before) return $cell.pos - before.nodeSize;
    for (let row = $cell.index(-1) - 1, rowEnd = $cell.before(); row >= 0; row--) {
      const rowNode = $cell.node(-1).child(row);
      const lastChild = rowNode.lastChild;
      if (lastChild) return rowEnd - 1 - lastChild.nodeSize;
      rowEnd -= rowNode.nodeSize;
    }
  } else {
    if ($cell.index() < $cell.parent.childCount - 1) {
      const after = $cell.nodeAfter;
      if (!after) return null;
      return $cell.pos + after.nodeSize;
    }
    const table = $cell.node(-1);
    for (let row = $cell.indexAfter(-1), rowStart = $cell.after(); row < table.childCount; row++) {
      const rowNode = table.child(row);
      if (rowNode.childCount) return rowStart + 1;
      rowStart += rowNode.nodeSize;
    }
  }
  return null;
}

export const TableKeys = Extension.create({
  name: "tableKeys",
  priority: 1000,
  addKeyboardShortcuts() {
    const step = (dir: 1 | -1) => () =>
      this.editor.commands.command(({ state, view, tr, dispatch }) => {
        if (insideList(state)) return false;
        const doc = state.doc;
        // In a mounted view the DOM caret is authoritative: the editor state
        // can lag one keystroke behind it right after a mouse click, before
        // PM processes the DOM selectionchange, which made the first Tab
        // navigate from the wrong cell. The state residue is a fallback for
        // headless contexts where no view/DOM selection exists.
        let $cell: ResolvedPos | null = null;
        if (view) {
          try {
            const dom = view.dom;
            const domSel = dom.ownerDocument.defaultView?.getSelection?.() ?? null;
            if (domSel?.anchorNode && dom.contains(domSel.anchorNode)) {
              const pos = view.posAtDOM(domSel.anchorNode, domSel.anchorOffset);
              $cell = cellAround(doc.resolve(pos)) ?? null;
            }
          } catch {
            $cell = null;
          }
        }
        if (!$cell && isInTable(state)) {
          try {
            $cell = selectionCell(state);
          } catch {
            $cell = null;
          }
        }
        if (!$cell) return false;
        const nextPos = findNextCellPos($cell, dir);
        if (nextPos == null) return false;
        const cellNode = doc.nodeAt(nextPos);
        if (!cellNode) return false;
        const caret = caretInsideCell(doc, nextPos, cellNode.nodeSize, dir);
        if (!caret) return false;
        if (dispatch) {
          tr.setSelection(caret).scrollIntoView();
          dispatch(tr);
        }
        return true;
      });
    return { Tab: step(1), "Shift-Tab": step(-1) };
  },
});

const wrap =
  (command: typeof addRowAfter) =>
  () =>
  ({ state, dispatch }: { state: EditorState; dispatch?: (tr: Transaction) => void }) =>
    command(state, dispatch);

export const tableExtensions = () => [
  TableRoles,
  Table.extend({
    addCommands() {
      return {
        insertTable:
          ({ rows = 3, cols = 3, withHeaderRow = true } = {}) =>
          ({ state, tr, dispatch }) => {
            const r = Math.max(1, Math.min(50, Math.floor(rows)));
            const c = Math.max(1, Math.min(20, Math.floor(cols)));
            if (dispatch) {
              const table = createTable(state.schema, r, c, withHeaderRow);
              tr.replaceSelectionWith(table).scrollIntoView();
              let tablePos = -1;
              tr.doc.nodesBetween(Math.max(0, state.selection.from - 1), tr.doc.content.size, (node, pos) => {
                if (tablePos < 0 && node.type.name === "table") tablePos = pos;
                return tablePos < 0;
              });
              if (tablePos >= 0) tr.setSelection(TextSelection.near(tr.doc.resolve(tablePos + 3)));
            }
            return true;
          },
        addRowAfter: wrap(addRowAfter),
        deleteRow: wrap(deleteRow),
        addColumnAfter: wrap(addColumnAfter),
        deleteColumn: wrap(deleteColumn),
        // toggleHeaderRow in prosemirror-tables is a deprecated legacy variant
        // that toggles the caret's row; with the caret in a body row it would
        // create a second header row. Our command toggles the table's first
        // header row instead (modern toggleHeader("row") semantics), which
        // matches the editor's "Toggle header row" control.
        toggleHeaderRow: wrap(toggleHeader("row")),
        deleteTable: wrap(deleteTable),
      };
    },
  }),
  TableRow,
  TableHeader,
  TableCell,
  TableKeys,
];
