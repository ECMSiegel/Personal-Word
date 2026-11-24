import { Fragment, useEffect, useId, useLayoutEffect, useRef, useState, type KeyboardEvent } from "react";
import { Check } from "lucide-react";
import "./popover.css";
import "./dropdown.css";
import "./context-menu.css";

export type ContextMenuItem =
  | {
      kind?: undefined;
      label: string;
      run: () => void;
      disabled?: boolean;
      /** Destructive: drawn in --danger. */
      danger?: boolean;
      /** Ticked or not. When any item of a menu sets it, every row reserves the check column and
       *  rows that set it are menuitemcheckbox rows (the sort menu's check). */
      checked?: boolean;
    }
  | ContextMenuSwatches;

/**
 * A custom row (T12): a rule, then one row of square colour swatches. The row is one stop in the
 * Up/Down order; Left/Right move among the swatches (roving tabindex, wraps), Home/End go to the
 * first/last, Enter/Space pick. Picking closes the menu and returns focus like any item.
 */
export type ContextMenuSwatches = {
  kind: "swatches";
  label: string;
  /** The id of the marked (current) option. */
  value: string;
  /** `colour` is any CSS colour, e.g. `var(--swatch-purple)`. */
  options: { id: string; label: string; colour: string }[];
  onPick: (id: string) => void;
  disabled?: undefined;
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
  const checkColumn = items.some((it) => it.kind === undefined && it.checked !== undefined);
  const enabled = items.map((it, i) => (it.disabled ? -1 : i)).filter((i) => i >= 0);
  const [highlight, setHighlight] = useState(viaKeyboard ? (enabled[0] ?? -1) : -1);
  const [shown, setShown] = useState(viaKeyboard);
  // The active swatch of each swatch row (roving tabindex), starting on its current value.
  const [swatchAt, setSwatchAt] = useState<Record<number, number>>(() =>
    Object.fromEntries(
      items.flatMap((it, i) =>
        it.kind === "swatches" ? [[i, Math.max(0, it.options.findIndex((o) => o.id === it.value))]] : [],
      ),
    ),
  );
  const swatchButtons = useRef<Record<string, HTMLButtonElement | null>>({});
  /** Moves the highlight; DOM focus follows into a swatch row and back to the menu. */
  const highlightAt = (index: number, swatch = swatchAt[index]) => {
    setHighlight(index);
    if (items[index]?.kind === "swatches") swatchButtons.current[`${index}:${swatch}`]?.focus();
    else if (menu.current && menu.current !== document.activeElement) menu.current.focus({ preventScroll: true });
  };
  const moveSwatch = (index: number, to: number) => {
    setSwatchAt((s) => ({ ...s, [index]: to }));
    swatchButtons.current[`${index}:${to}`]?.focus();
  };

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

  const choose = (index: number, swatch = swatchAt[index]) => {
    const it = items[index];
    if (!it || it.disabled) return;
    onClose(true);
    if (it.kind === "swatches") {
      const option = it.options[swatch];
      if (option) it.onPick(option.id);
    } else it.run();
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
    highlightAt(next);
  };
  const onKeyDown = (e: KeyboardEvent) => {
    const row = items[highlight];
    const count = row?.kind === "swatches" ? row.options.length : 0;
    const at = swatchAt[highlight] ?? 0;
    if (count && e.key === "ArrowRight") moveSwatch(highlight, (at + 1) % count);
    else if (count && e.key === "ArrowLeft") moveSwatch(highlight, (at - 1 + count) % count);
    else if (count && e.key === "Home") moveSwatch(highlight, 0);
    else if (count && e.key === "End") moveSwatch(highlight, count - 1);
    else if (e.key === "ArrowDown") step(1);
    else if (e.key === "ArrowUp") step(-1);
    else if (e.key === "Home") highlightAt(enabled[0] ?? -1);
    else if (e.key === "End") highlightAt(enabled.at(-1) ?? -1);
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
      className="popover dropdown-menu context-menu menu"
      role="menu"
      aria-label={label}
      tabIndex={-1}
      aria-activedescendant={highlight >= 0 && items[highlight]?.kind !== "swatches" ? `${id}-${highlight}` : undefined}
      data-animate={viaKeyboard || window.matchMedia("(prefers-reduced-motion: reduce)").matches ? undefined : ""}
      data-shown={shown ? "" : undefined}
      onKeyDown={onKeyDown}
      onContextMenu={(e) => e.preventDefault()}
    >
      {items.map((it, index) =>
        it.kind === "swatches" ? (
          <Fragment key={it.label}>
            <div className="menu-rule" role="separator" />
            <div
              role="group"
              aria-label={it.label}
              className="context-menu-swatches row"
              onPointerDown={(e) => e.preventDefault()}
            >
              <div className="cluster gap-0 flush-start">
                {it.options.map((o, n) => (
                  <button
                    key={o.id}
                    ref={(el) => {
                      swatchButtons.current[`${index}:${n}`] = el;
                    }}
                    type="button"
                    role="menuitemradio"
                    aria-checked={o.id === it.value}
                    aria-label={o.label}
                    tabIndex={n === (swatchAt[index] ?? 0) ? 0 : -1}
                    className="context-menu-swatch slot icon-grow"
                    onClick={() => choose(index, n)}
                  >
                    <span aria-hidden="true" className="swatch-chip" style={{ background: o.colour }} />
                  </button>
                ))}
              </div>
            </div>
          </Fragment>
        ) : (
        <div
          key={it.label}
          id={`${id}-${index}`}
          role={it.checked === undefined ? "menuitem" : "menuitemcheckbox"}
          aria-checked={it.checked}
          aria-disabled={it.disabled || undefined}
          data-highlighted={index === highlight ? "" : undefined}
          data-danger={it.danger ? "" : undefined}
          className="dropdown-option context-menu-item row"
          onPointerEnter={() => !it.disabled && setHighlight(index)}
          onPointerDown={(e) => e.preventDefault()}
          onClick={() => choose(index)}
        >
          {checkColumn && (
            <span className="dropdown-check" aria-hidden="true">
              {it.checked && <Check size={16} />}
            </span>
          )}
          <span className="row-label">{it.label}</span>
        </div>
        ),
      )}
    </div>
  );
}
