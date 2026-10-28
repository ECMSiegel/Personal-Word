import { useRef, type ReactElement } from "react";
import type { Editor } from "@tiptap/react";
import { Popover, PopoverItem } from "../components/Popover";

export function TableContextMenu({
  editor,
  at,
  onClose,
}: {
  editor: Editor;
  at: { x: number; y: number } | null;
  onClose: () => void;
}): ReactElement | null {
  const anchor = useRef<HTMLSpanElement>(null);
  if (!at) return null;

  const close = () => {
    onClose();
    editor.commands.focus();
  };

  const run = (command: () => void) => {
    command();
    close();
  };

  return (
    <span
      ref={anchor}
      className="table-menu-anchor"
      style={{ left: at.x, top: at.y }}
    >
      <Popover
        open
        anchor={anchor}
        morph="edge"
        highlight="follow"
        role="menu"
        label="Table actions"
        tabIndex={-1}
        className="table-context-menu"
        onDismiss={close}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown" || event.key === "ArrowUp") {
            const items = Array.from(
              event.currentTarget.querySelectorAll<HTMLElement>('[role="menuitem"]'),
            );
            const at = items.indexOf(document.activeElement as HTMLElement);
            const step = event.key === "ArrowDown" ? 1 : -1;
            event.preventDefault();
            items[(at + step + items.length) % items.length]?.focus();
            return;
          }
          if (event.key !== "Escape") return;
          event.preventDefault();
          event.stopPropagation();
          close();
        }}
      >
        <PopoverItem
          role="menuitem"
          autoFocus
          onClick={() =>
            run(() => {
              editor.chain().focus().addRowAfter().run();
            })
          }
        >
          Add row below
        </PopoverItem>
        <PopoverItem
          role="menuitem"
          onClick={() =>
            run(() => {
              editor.chain().focus().deleteRow().run();
            })
          }
        >
          Delete row
        </PopoverItem>
        <PopoverItem
          role="menuitem"
          onClick={() =>
            run(() => {
              editor.chain().focus().addColumnAfter().run();
            })
          }
        >
          Add column after
        </PopoverItem>
        <PopoverItem
          role="menuitem"
          onClick={() =>
            run(() => {
              editor.chain().focus().deleteColumn().run();
            })
          }
        >
          Delete column
        </PopoverItem>
        <PopoverItem
          role="menuitem"
          onClick={() =>
            run(() => {
              editor.chain().focus().toggleHeaderRow().run();
            })
          }
        >
          Toggle header row
        </PopoverItem>
        <PopoverItem
          role="menuitem"
          className="is-danger"
          onClick={() =>
            run(() => {
              editor.chain().focus().deleteTable().run();
            })
          }
        >
          Delete table
        </PopoverItem>
      </Popover>
    </span>
  );
}
