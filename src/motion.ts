import { useLayoutEffect, useRef, useState, type RefObject } from "react";

// The one motion engine (docs/design-system.md, Motion). Web Animations only;
// values mirror the `--duration-*` and `--ease-*` tokens in src/styles.css.
// No top-level window access: this module must import in Node.

export const MOTION_MS = { press: 80, fast: 120, base: 180, morph: 220 } as const;
export type MotionSpeed = keyof typeof MOTION_MS;

export const EASING = {
  out: "cubic-bezier(0.2, 0, 0, 1)",
  in: "cubic-bezier(0.4, 0, 1, 1)",
  spring: "cubic-bezier(0.34, 1.4, 0.64, 1)",
} as const;
export type MotionEasing = keyof typeof EASING;

export const ANIMATABLE = ["transform", "opacity", "clipPath"] as const;

const FRAME_KEYS = new Set<string>([...ANIMATABLE, "offset", "easing", "composite"]);

export function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

export function checkKeyframes(frames: Keyframe[]): void {
  for (const frame of frames) {
    for (const key of Object.keys(frame)) {
      if (!FRAME_KEYS.has(key)) throw new Error(`Not animatable: ${key}`);
    }
  }
}

export function play(
  el: Element,
  frames: Keyframe[],
  opts: { speed: MotionSpeed; easing: MotionEasing; delay?: number; fill?: FillMode },
): Animation | null {
  checkKeyframes(frames);
  if (prefersReducedMotion()) return null;
  return el.animate(frames, {
    duration: MOTION_MS[opts.speed],
    easing: EASING[opts.easing],
    delay: opts.delay ?? 0,
    fill: opts.fill ?? "none",
  });
}

export type Presence = { show(): void; hide(): Promise<boolean>; cancel(): void };

const REST: Record<string, string | number> = { transform: "none", opacity: 1, clipPath: "inset(0)" };

function restFor(hidden: Keyframe): Keyframe {
  const rest: Keyframe = {};
  for (const key of Object.keys(hidden)) if (key in REST) rest[key] = REST[key];
  return rest;
}

export function presence(
  el: HTMLElement,
  hidden: Keyframe,
  opts?: { showSpeed?: MotionSpeed; hideSpeed?: MotionSpeed; showEasing?: MotionEasing; hideEasing?: MotionEasing },
): Presence {
  const rest = restFor(hidden);
  let anim: Animation | null = null;
  let direction: "show" | "hide" | null = null;
  let generation = 0;
  let pending: Promise<boolean> | null = null;
  let settle: ((done: boolean) => void) | null = null;

  const resolveHide = (done: boolean) => {
    const s = settle;
    settle = null;
    pending = null;
    s?.(done);
  };

  // Each start or reversal is a new generation; a finish only counts for the
  // generation that is current when it arrives.
  const watch = (a: Animation) => {
    const gen = ++generation;
    a.finished.then(
      () => {
        if (gen !== generation || anim !== a) return;
        if (direction === "hide") resolveHide(true);
        else {
          a.cancel();
          anim = null;
          direction = null;
        }
      },
      () => {},
    );
  };

  const reverseTo = (to: "show" | "hide") => {
    const a = anim!;
    // A reversed show runs back to offset 0 (hidden): hold it there until unmount.
    if (to === "hide") a.effect?.updateTiming({ fill: "both" });
    a.reverse();
    direction = to;
    watch(a);
  };

  return {
    show() {
      if (anim && direction === "hide") {
        resolveHide(false);
        const live = anim.playState === "running" || anim.pending;
        if (live && !prefersReducedMotion()) {
          // Continue from the current frame.
          reverseTo("show");
          return;
        }
        // A finished hide only holds its last frame: drop it and enter afresh.
        anim.cancel();
        anim = null;
        direction = null;
      }
      if (anim) return; // already showing
      const a = play(el, [hidden, rest], {
        speed: opts?.showSpeed ?? "base",
        easing: opts?.showEasing ?? "out",
      });
      if (!a) return;
      anim = a;
      direction = "show";
      watch(a);
    },
    hide() {
      if (direction === "hide" && anim) {
        return pending ?? Promise.resolve(true);
      }
      if (prefersReducedMotion()) {
        anim?.cancel();
        anim = null;
        direction = null;
        return Promise.resolve(true);
      }
      pending = new Promise<boolean>((resolve) => (settle = resolve));
      const result = pending;
      if (anim && direction === "show") {
        reverseTo("hide");
        return result;
      }
      const a = play(el, [rest, hidden], {
        speed: opts?.hideSpeed ?? "fast",
        easing: opts?.hideEasing ?? "in",
        fill: "forwards",
      });
      if (!a) {
        resolveHide(true);
        return result;
      }
      anim = a;
      direction = "hide";
      watch(a);
      return result;
    },
    cancel() {
      generation++;
      anim?.cancel();
      anim = null;
      direction = null;
      resolveHide(false);
    },
  };
}

export function usePresence(
  open: boolean,
  ref: RefObject<HTMLElement | null>,
  hidden: Keyframe | (() => Keyframe),
  opts?: Parameters<typeof presence>[2],
): { mounted: boolean; closing: boolean } {
  const reduced = prefersReducedMotion();
  const [exiting, setExiting] = useState(false);
  const [prevOpen, setPrevOpen] = useState(open);
  // Derived during render so the closing render still mounts the element.
  if (open !== prevOpen) {
    setPrevOpen(open);
    setExiting(!open && !reduced);
  }
  const ctl = useRef<{ el: HTMLElement; p: Presence; hiding: boolean } | null>(null);
  const latest = useRef({ hidden, opts });
  latest.current = { hidden, opts };

  useLayoutEffect(() => {
    if (reduced) {
      ctl.current?.p.cancel();
      ctl.current = null;
      return;
    }
    const el = ref.current;
    if (open) {
      if (!el) return;
      // A fresh controller per opening (so a function `hidden` is re-read),
      // except while a hide is in flight: that one must be reversed.
      if (!ctl.current || ctl.current.el !== el || !ctl.current.hiding) {
        ctl.current?.p.cancel();
        const h = latest.current.hidden;
        ctl.current = { el, p: presence(el, typeof h === "function" ? h() : h, latest.current.opts), hiding: false };
      }
      ctl.current.hiding = false;
      ctl.current.p.show();
      return;
    }
    if (!exiting) return;
    const c = ctl.current;
    if (!c || !el || c.el !== el) {
      setExiting(false);
      return;
    }
    let live = true;
    c.hiding = true;
    c.p.hide().then((done) => {
      if (!live || !done) return;
      c.hiding = false;
      setExiting(false);
    });
    return () => {
      live = false;
    };
  }, [open, exiting, reduced, ref]);

  useLayoutEffect(
    () => () => {
      ctl.current?.p.cancel();
      ctl.current = null;
    },
    [],
  );

  if (reduced) return { mounted: open, closing: false };
  return { mounted: open || exiting, closing: !open && exiting };
}

const highlights = new WeakMap<HTMLElement, { w: number; h: number; visible: boolean; anim: Animation | null }>();

export function slideHighlight(highlight: HTMLElement, target: HTMLElement | null, container: HTMLElement): void {
  const prev = highlights.get(highlight);
  if (!target) {
    if (!prev?.visible) {
      highlight.style.opacity = "0";
      return;
    }
    const from = getComputedStyle(highlight).opacity;
    prev.anim?.cancel();
    highlight.style.opacity = "0";
    const anim = play(highlight, [{ opacity: from }, { opacity: 0 }], { speed: "fast", easing: "in" });
    highlights.set(highlight, { ...prev, visible: false, anim });
    return;
  }
  const box = container.getBoundingClientRect();
  const rect = target.getBoundingClientRect();
  // The highlight's top:0/left:0 is the container's padding box, inside its border.
  const x = rect.left - box.left - container.clientLeft + container.scrollLeft;
  const y = rect.top - box.top - container.clientTop + container.scrollTop;
  const w = rect.width;
  const h = rect.height;
  const to = `translate(${x}px, ${y}px) scale(${w}, ${h})`;
  // Read the current frame before cancelling, so a re-target mid-flight starts where it is.
  const from = getComputedStyle(highlight).transform;
  prev?.anim?.cancel();
  highlight.style.transform = to;
  highlight.style.opacity = "1";
  let anim: Animation | null = null;
  if (prev?.visible) {
    const resized = prev.w !== w || prev.h !== h;
    anim = play(highlight, [{ transform: from }, { transform: to }], {
      speed: "base",
      easing: resized ? "spring" : "out",
    });
  }
  highlights.set(highlight, { w, h, visible: true, anim });
}

export function staggerIn(items: HTMLElement[], step = 15): void {
  items.forEach((item, i) => {
    // fill "backwards" holds the first frame during the delay (no jump); never opacity.
    play(item, [{ transform: "translateY(-4px)" }, { transform: "none" }], {
      speed: "fast",
      easing: "out",
      delay: Math.min(i, 6) * step,
      fill: "backwards",
    });
  });
}
