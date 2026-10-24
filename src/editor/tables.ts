import { Extension, Node, mergeAttributes } from "@tiptap/core";
import type { Node as PMNode, NodeType, Schema } from "@tiptap/pm/model";
import { TextSelection, type EditorState, type Transaction } from "@tiptap/pm/state";
import {
  addColumnAfter,
  addRowAfter,
  deleteColumn,
  deleteRow,
  deleteTable,
  goToNextCell,
  tableEditing,
  toggleHeaderRow,
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

export const TableKeys = Extension.create({
  name: "tableKeys",
  priority: 1000,
  addKeyboardShortcuts() {
    const step = (dir: 1 | -1) => () =>
      this.editor.commands.command(({ state, dispatch }) => !insideList(state) && goToNextCell(dir)(state, dispatch));
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
        toggleHeaderRow: wrap(toggleHeaderRow),
        deleteTable: wrap(deleteTable),
      };
    },
  }),
  TableRow,
  TableHeader,
  TableCell,
  TableKeys,
];
