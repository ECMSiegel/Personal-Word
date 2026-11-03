import { useEffect, useId, useLayoutEffect, useRef, useState, type KeyboardEvent } from "react";
import "./dropdown.css";
import "./context-menu.css";

export type ContextMenuItem = {
  label: string;
  run: () => void;
  disabled?: boolean;
  /** Destructive: drawn in --danger. */
  danger?: boolean;
};

/** Window margin the menu keeps on every side. */
const MARGIN = 8;

/**
 * Right-click / Shift+F10 menu for sidebar rows (UI wave 5, E4). Rendered in
 * place (no portal) as an absolutely positioned child of the sidebar; `x`/`y`
 * are viewport pixels and the menu converts them to the sidebar's box. Rows reuse
 * dropdown.css; hover and the keyboard highlight come from the one shared
 * emphasis rule in styles.css ([role="menuitem"], [data-highlighted]).
 * A pointer open fades in by opacity/transform tokens; a keyboard open and
 * Reduce Motion are instant (context-menu.css).
 */
export function ContextMenu({
  x,
  y,
  label,
  items,
  viaKeyboard,
  onClose,
}: {
  x: number;
  y: number;
  label: string;
  items: ContextMenuItem[];
  viaKeyboard: boolean;
  /** `restore`: focus goes back to the row (Escape, or an item ran). */
  onClose: (restore: boolean) => void;
}) {
  const id = useId();
  const menu = useRef<HTMLDivElement>(null);
  const enabled = items.map((it, i) => (it.disabled ? -1 : i)).filter((i) => i >= 0);
  const [highlight, setHighlight] = useState(viaKeyboard ? (enabled[0] ?? -1) : -1);
  const [shown, setShown] = useState(viaKeyboard);

  // Place at (x, y), flipped up/left and clamped inside the window, then
  // converted from viewport to containing-block coordinates.
  useLayoutEffect(() => {
    const el = menu.current;
    if (!el) return;
    // Untransformed size and the containing block's padding-box origin, so the
    // fade's starting transform cannot skew the measurement.
    const w = el.offsetWidth;
    const h = el.offsetHeight;
    const parent = el.offsetParent;
    const box = parent?.getBoundingClientRect();
    const origin = {
      left: (box?.left ?? 0) + (parent?.clientLeft ?? 0),
      top: (box?.top ?? 0) + (parent?.clientTop ?? 0),
    };
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    let left = x + w > vw - MARGIN ? x - w : x;
    let top = y + h > vh - MARGIN ? y - h : y;
    left = Math.max(MARGIN, Math.min(left, vw - MARGIN - w));
    top = Math.max(MARGIN, Math.min(top, vh - MARGIN - h));
    el.style.left = left - origin.left + "px";
    el.style.top = top - origin.top + "px";
    el.focus({ preventScroll: true });
  }, [x, y]);

  // Pointer open: show on the next frame so the opacity/transform transition runs.
  useEffect(() => {
    if (shown) return;
    const frame = requestAnimationFrame(() => setShown(true));
    return () => cancelAnimationFrame(frame);
  }, [shown]);

  // Dismiss on a press outside, a window resize or any scroll.
  useEffect(() => {
    const outside = (e: PointerEvent) => {
      if (!(e.target instanceof Node) || !menu.current?.contains(e.target)) onClose(false);
    };
    const away = () => onClose(false);
    // Only a scroll that moves the rows (the sidebar's list, or the page) closes
    // it; the editor scrolling its caret into view does not.
    const scrolled = (e: Event) => {
      const host = menu.current?.parentElement;
      const t = e.target;
      if (!(t instanceof Node) || !host || t.contains(host) || host.contains(t)) away();
    };
    document.addEventListener("pointerdown", outside, true);
    window.addEventListener("resize", away);
    window.addEventListener("scroll", scrolled, true);
    return () => {
      document.removeEventListener("pointerdown", outside, true);
      window.removeEventListener("resize", away);
      window.removeEventListener("scroll", scrolled, true);
    };
  }, [onClose]);

  const choose = (index: number) => {
    const it = items[index];
    if (!it || it.disabled) return;
    onClose(true);
    it.run();
  };
  const step = (delta: 1 | -1) => {
    if (!enabled.length) return;
    const at = enabled.indexOf(highlight);
    const next =
      at < 0
        ? delta > 0
          ? enabled[0]
          : enabled[enabled.length - 1]
        : enabled[Math.max(0, Math.min(enabled.length - 1, at + delta))];
    setHighlight(next);
  };
  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === "ArrowDown") step(1);
    else if (e.key === "ArrowUp") step(-1);
    else if (e.key === "Home") setHighlight(enabled[0] ?? -1);
    else if (e.key === "End") setHighlight(enabled.at(-1) ?? -1);
    else if (e.key === "Enter" || e.key === " ") choose(highlight);
    else if (e.key === "Escape") onClose(true);
    else if (e.key === "Tab") {
      onClose(false);
      return;
    } else return;
    // Handled here: the sidebar's own Escape (hide an unpinned sidebar) and
    // the row's chord handler must not see it.
    e.preventDefault();
    e.stopPropagation();
  };

  return (
    <div
      ref={menu}
      className="dropdown-menu context-menu"
      role="menu"
      aria-label={label}
      tabIndex={-1}
      aria-activedescendant={highlight >= 0 ? `${id}-${highlight}` : undefined}
      data-animate={viaKeyboard ? undefined : ""}
      data-shown={shown ? "" : undefined}
      onKeyDown={onKeyDown}
      onContextMenu={(e) => e.preventDefault()}
    >
      {items.map((it, index) => (
        <div
          key={it.label}
          id={`${id}-${index}`}
          role="menuitem"
          aria-disabled={it.disabled || undefined}
          data-highlighted={index === highlight ? "" : undefined}
          data-danger={it.danger ? "" : undefined}
          className="dropdown-option context-menu-item"
          onPointerEnter={() => !it.disabled && setHighlight(index)}
          onPointerDown={(e) => e.preventDefault()}
          onClick={() => choose(index)}
        >
          {it.label}
        </div>
      ))}
    </div>
  );
}
