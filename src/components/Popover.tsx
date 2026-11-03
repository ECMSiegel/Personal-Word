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
import { staggerIn, usePresence } from "../motion";
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

export type RectLike = {
  left: number;
  right: number;
  top: number;
  bottom: number;
  width: number;
  height: number;
};

/** Window (and container) margin shared by every placement decision. */
const MARGIN = 8;
/** Room kept between a bounded popup and its scroll container's edges. */
const BOUNDARY_INSET = 16;

/**
 * One pure placement rule (UI wave 5, B2). Without a scroll-container
 * boundary it is exactly the behaviour Popover has always had: prefer start,
 * flip to the end near the window's right edge, flip up near the window's
 * bottom, cap the height at the room left. With a boundary (the nearest
 * auto/scroll ancestor, found by the caller) the same decisions run against
 * the boundary intersected with the viewport, and the popup width is capped
 * at the boundary width minus 16 so long labels wrap instead of spilling.
 * The toolbar and More-menu chain has no auto/scroll ancestor, so those
 * popovers take the window branch and never move.
 */
export function placePopover(input: {
  trigger: RectLike;
  popupWidth: number;
  popupHeight: number;
  viewport: { width: number; height: number };
  boundary: RectLike | null;
  align: "start" | "end";
}): { end: boolean; up: boolean; maxWidth: number | null; maxHeight: number } {
  const { trigger, popupWidth, popupHeight, viewport, align } = input;

  // The visible part of the boundary; an invisible boundary is no boundary.
  let box: RectLike | null = null;
  if (input.boundary) {
    const b = input.boundary;
    const left = Math.max(0, b.left);
    const top = Math.max(0, b.top);
    const right = Math.min(viewport.width, b.right);
    const bottom = Math.min(viewport.height, b.bottom);
    if (right - left > 0 && bottom - top > 0)
      box = { left, top, right, bottom, width: right - left, height: bottom - top };
  }

  const fitsStart = (box?.left ?? 0) + MARGIN; // left edge of the room the menu may use
  const fitsEnd = (box?.right ?? viewport.width) - MARGIN;

  const end =
    align === "end" ||
    (trigger.left + popupWidth > fitsEnd &&
      trigger.right - popupWidth >= (box ? fitsStart : MARGIN));

  const below = (box?.bottom ?? viewport.height) - trigger.bottom - MARGIN;
  const above = trigger.top - (box?.top ?? 0) - MARGIN;
  const up = popupHeight > below && above > below;

  return {
    end,
    up,
    maxWidth: box ? box.width - BOUNDARY_INSET : null,
    maxHeight: Math.max(0, Math.min(popupHeight, up ? above : below)),
  };
}

/**
 * The nearest ancestor of the popup that actually scrolls (overflow auto or
 * scroll on either axis). Hidden, clipped and visible ancestors are not
 * scroll containers; the toolbar/workspace chain is all clip, so toolbar
 * popovers find none and keep the window placement.
 */
export function nearestScrollBoundary(popup: Element): HTMLElement | null {
  let node: HTMLElement | null = popup.parentElement;
  while (node && node !== document.body) {
    const style = getComputedStyle(node);
    if (
      style.overflowX === "auto" ||
      style.overflowX === "scroll" ||
      style.overflowY === "auto" ||
      style.overflowY === "scroll"
    )
      return node;
    node = node.parentElement;
  }
  return null;
}

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
    const boundary = nearestScrollBoundary(popup);
    const measure = () => {
      const t = trigger.getBoundingClientRect();
      const viewport = { width: window.innerWidth, height: window.innerHeight };
      const box = boundary ? boundary.getBoundingClientRect() : null;
      // Measure the un-clamped menu first so the flip decision uses its natural
      // width, and so a later resize does not measure the already-clamped width.
      popup.style.maxWidth = "";
      popup.removeAttribute("data-bounded");
      const natural = placePopover({
        trigger: t,
        popupWidth: popup.getBoundingClientRect().width,
        popupHeight: popup.scrollHeight,
        viewport,
        boundary: box,
        align,
      });
      if (natural.maxWidth != null) {
        // Only ever narrow the menu: keep the stylesheet's own cap (320 px for a Dropdown).
        const cssMax = parseFloat(getComputedStyle(popup).maxWidth);
        popup.style.maxWidth = `${Math.min(natural.maxWidth, Number.isFinite(cssMax) ? cssMax : Infinity)}px`;
        popup.setAttribute("data-bounded", "");
      }
      // The width clamp can wrap a long label, and a wrapped menu is taller, so
      // read the size again (forces a reflow) and clamp the height to the menu's
      // real, wrapped height -- otherwise its last item is cut off.
      const out = placePopover({
        trigger: t,
        popupWidth: popup.getBoundingClientRect().width,
        popupHeight: popup.scrollHeight,
        viewport,
        boundary: box,
        align,
      });
      // Panels that let nested menus spill out (overflow: visible) keep their height.
      if (getComputedStyle(popup).overflowY !== "visible")
        popup.style.maxHeight = `${out.maxHeight}px`;
      up.current = out.up;
      setPlace((p) =>
        p.end === natural.end && p.up === out.up
          ? p
          : { end: natural.end, up: out.up },
      );
    };
    let raf = 0;
    const schedule = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        measure();
      });
    };
    measure();
    window.addEventListener("resize", schedule);
    boundary?.addEventListener("scroll", schedule, { passive: true });
    return () => {
      if (raf) cancelAnimationFrame(raf);
      window.removeEventListener("resize", schedule);
      boundary?.removeEventListener("scroll", schedule);
    };
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

  // The highlighted (or hovered/focused) item is marked data-highlighted; CSS shows it by weight.
  const followed = useRef<HTMLElement | null>(null);
  const sync = () => {
    const popup = el.current;
    if (!popup) return;
    let target: HTMLElement | null = null;
    if (typeof highlight === "number")
      target = popup.querySelectorAll<HTMLElement>(ITEM)[highlight] ?? null;
    else if (highlight === "follow") target = followed.current;
    for (const item of popup.querySelectorAll<HTMLElement>("[data-highlighted]"))
      if (item !== target) item.removeAttribute("data-highlighted");
    target?.setAttribute("data-highlighted", "");
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
