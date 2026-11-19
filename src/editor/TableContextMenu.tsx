import { useCallback, useRef, type ReactElement } from "react";
import type { Editor } from "@tiptap/react";
import { Popover, PopoverItem } from "../components/Popover";

/** Window margin the menu keeps on every side (same as ContextMenu). */
const MARGIN = 8;

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
  // Popover only measures when it is already mounted, and this menu mounts open, so it never
  // flips here. Once the menu is in the page, shift it (a CSS translate, which nothing else
  // here uses) so it opens upward / leftward when it would run past the window, and stays inside.
  const x = at?.x;
  const y = at?.y;
  const keepInWindow = useCallback(
    (menu: HTMLDivElement | null) => {
      if (!menu) return;
      menu.style.translate = "";
      const r = menu.getBoundingClientRect();
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      let left = r.left;
      let top = r.top;
      if (r.right > vw - MARGIN) left = r.left - r.width;
      if (r.bottom > vh - MARGIN) top = r.top - r.height - 2;
      left = Math.max(MARGIN, Math.min(left, vw - MARGIN - r.width));
      top = Math.max(MARGIN, Math.min(top, vh - MARGIN - r.height));
      if (left !== r.left || top !== r.top) menu.style.translate = `${left - r.left}px ${top - r.top}px`;
    },
    // A new click point is a new placement.
    [x, y],
  );
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
        ref={keepInWindow}
        anchor={anchor}
        morph="edge"
        highlight="follow"
        role="menu"
        label="Table actions"
        tabIndex={-1}
        className="table-context-menu menu"
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
