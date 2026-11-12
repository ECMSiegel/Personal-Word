// The Research aside slides in on a pointer open. A keyboard or palette open,
// Reduce Motion and closing run nothing.
import { useLayoutEffect, type RefObject } from "react";
import { play, prefersReducedMotion } from "../motion";

export function useResearchAsideEntrance(
  aside: RefObject<HTMLElement | null>,
  shown: boolean,
  wasPointer: () => boolean,
): void {
  useLayoutEffect(() => {
    const el = aside.current;
    if (!shown || !el || !wasPointer() || prefersReducedMotion()) return;
    // Read the token as pixels: keyframes are checked, not styled.
    const slide =
      getComputedStyle(document.documentElement).getPropertyValue("--space-4").trim() || "16px";
    const animation = play(
      el,
      [
        { transform: `translateX(${slide})`, opacity: 0 },
        { transform: "none", opacity: 1 },
      ],
      { speed: "base", easing: "out" },
    );
    return () => animation?.cancel();
    // wasPointer reads a ref; only a change of `shown` starts a slide.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shown]);
}
