import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type KeyboardEventHandler,
  type ReactNode,
  type Ref,
  type RefObject,
  type SyntheticEvent,
} from "react";
import { slideHighlight, staggerIn, usePresence } from "../motion";
import "./popover.css";

export type PopoverProps = {
  open: boolean;
  anchor: RefObject<HTMLElement | null>;
  onDismiss?: () => void;
  align?: "start" | "end";
  morph?: "edge" | "anchor";
  highlight?: number | null | "follow";
  role?: string;
  id?: string;
  label?: string;
  activeDescendant?: string;
  tabIndex?: number;
  className?: string;
  onKeyDown?: KeyboardEventHandler<HTMLDivElement>;
  ref?: Ref<HTMLDivElement>;
  children: ReactNode;
};

const ITEM = "[data-popover-item]";

/**
 * The one menu and panel surface (docs/design-system.md, Popover). It is an
 * absolutely positioned sibling of its anchor inside the anchor's positioned
 * wrapper; it grows in from the anchor edge, reverses from its current frame
 * when reopened mid-close, and drops its role at once while closing.
 */
export function Popover({
  open,
  anchor,
  onDismiss,
  align = "start",
  morph = "edge",
  highlight = null,
  role,
  id,
  label,
  activeDescendant,
  tabIndex,
  className,
  onKeyDown,
  ref,
  children,
}: PopoverProps) {
  const el = useRef<HTMLDivElement | null>(null);
  const box = useRef<HTMLDivElement>(null);
  const [place, setPlace] = useState({ end: false, up: false });
  const up = useRef(false);
  const anchorSize = useRef({ w: 0, h: 0 });

  const setRef = useCallback(
    (node: HTMLDivElement | null) => {
      el.current = node;
      if (typeof ref === "function") ref(node);
      else if (ref) (ref as { current: HTMLDivElement | null }).current = node;
    },
    [ref],
  );

  // Placement runs before usePresence's effect (hook order), so the hidden
  // frame below knows which edge the popover grows from.
  useLayoutEffect(() => {
    const popup = el.current;
    const trigger = anchor.current;
    if (!open || !popup || !trigger) return;
    if (morph === "anchor") {
      const r = trigger.getBoundingClientRect();
      anchorSize.current = { w: r.width, h: r.height };
      return;
    }
    const measure = () => {
      const t = trigger.getBoundingClientRect();
      const rect = popup.getBoundingClientRect();
      const naturalHeight = popup.scrollHeight;
      const below = window.innerHeight - t.bottom - 8;
      const above = t.top - 8;
      const vertical = naturalHeight > below && above > below;
      // Panels that let nested menus spill out (overflow: visible) keep their height.
      if (getComputedStyle(popup).overflowY !== "visible")
        popup.style.maxHeight = `${Math.max(0, Math.min(naturalHeight, vertical ? above : below))}px`;
      const end =
        align === "end" ||
        (t.left + rect.width > window.innerWidth - 8 && t.right - rect.width >= 8);
      up.current = vertical;
      setPlace((p) => (p.end === end && p.up === vertical ? p : { end, up: vertical }));
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [open, align, morph, anchor]);

  const hidden = useCallback(
    (): Keyframe =>
      morph === "anchor"
        ? {
            clipPath: `inset(0 calc(100% - ${anchorSize.current.w}px) calc(100% - ${anchorSize.current.h}px) 0)`,
          }
        : { opacity: 0, clipPath: up.current ? "inset(100% 0 0 0)" : "inset(0 0 100% 0)" },
    [morph],
  );
  const { mounted, closing } = usePresence(
    open,
    el,
    hidden,
    morph === "anchor" ? { showSpeed: "morph", showEasing: "spring" } : undefined,
  );

  // One highlight box slides behind the highlighted (or hovered/focused) item.
  const followed = useRef<HTMLElement | null>(null);
  const sync = () => {
    const popup = el.current;
    const hl = box.current;
    if (!popup || !hl) return;
    let target: HTMLElement | null = null;
    if (typeof highlight === "number")
      target = popup.querySelectorAll<HTMLElement>(ITEM)[highlight] ?? null;
    else if (highlight === "follow") target = followed.current;
    slideHighlight(hl, target, popup);
  };
  const syncRef = useRef(sync);
  syncRef.current = sync;
  useLayoutEffect(() => {
    if (!open) {
      followed.current = null;
      return;
    }
    syncRef.current();
  }, [open, highlight]);

  // Items drop in (transform only) on a fresh opening, not on a reversal.
  const wasClosing = useRef(false);
  useLayoutEffect(() => {
    const popup = el.current;
    if (!open || !popup || wasClosing.current) return;
    const items = [...popup.querySelectorAll<HTMLElement>(ITEM)].filter(
      (item) => item.closest(".popover") === popup,
    );
    staggerIn(items);
    // A highlight measured while items were still moving is re-measured once they rest.
    const moving = items.flatMap((item) => item.getAnimations());
    if (moving.length)
      Promise.all(moving.map((a) => a.finished.catch(() => undefined))).then(() => {
        if (el.current === popup) syncRef.current();
      });
  }, [open]);
  useLayoutEffect(() => {
    wasClosing.current = closing;
  });

  const follow = (event: SyntheticEvent) => {
    if (highlight !== "follow") return;
    const item = (event.target as Element).closest?.<HTMLElement>(ITEM);
    if (!item || item.closest(".popover") !== el.current || item === followed.current) return;
    followed.current = item;
    syncRef.current();
  };

  const dismiss = useRef(onDismiss);
  dismiss.current = onDismiss;
  const dismissible = !!onDismiss;
  useEffect(() => {
    if (!open || !dismissible) return;
    const close = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!el.current?.contains(target) && !anchor.current?.contains(target))
        dismiss.current?.();
    };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, [open, dismissible, anchor]);

  if (!mounted) return null;
  return (
    <div
      ref={setRef}
      id={id}
      className={[
        "popover",
        morph === "anchor" ? "popover-anchor" : "",
        morph === "edge" && place.end ? "popover-end" : "",
        morph === "edge" && place.up ? "popover-up" : "",
        className ?? "",
      ]
        .filter(Boolean)
        .join(" ")}
      role={closing ? undefined : role}
      aria-label={closing ? undefined : label}
      aria-activedescendant={closing ? undefined : activeDescendant}
      aria-hidden={closing ? true : undefined}
      inert={closing || undefined}
      data-state={closing ? "closing" : undefined}
      tabIndex={tabIndex}
      onKeyDown={onKeyDown}
      onPointerOver={follow}
      onFocus={follow}
    >
      {highlight !== null && <div ref={box} className="popover-highlight" aria-hidden="true" />}
      {children}
    </div>
  );
}

export function PopoverItem({
  shortcut,
  className,
  children,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { shortcut?: string }) {
  return (
    <button
      type="button"
      {...rest}
      className={"popover-item" + (className ? " " + className : "")}
      data-popover-item=""
    >
      {children}
      {shortcut && (
        <span className="popover-shortcut" aria-hidden="true">
          {shortcut}
        </span>
      )}
    </button>
  );
}
