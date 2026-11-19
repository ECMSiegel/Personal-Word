// Projects <-> document. A pointer open lets only the sheet fade in and rise 4 px
// (the sidebar and header are already there); a pointer return to Projects fades
// the library in and staggers its rows. Keyboard, the palette and Reduce Motion
// run nothing, and neither does the first paint.
import { useLayoutEffect, useRef } from "react";
import { play, prefersReducedMotion, staggerIn } from "../motion";

export function useProjectSwapMotion(projectOpen: boolean, wasPointer: () => boolean): void {
  const before = useRef(projectOpen);
  useLayoutEffect(() => {
    const was = before.current;
    before.current = projectOpen;
    if (was === projectOpen || !wasPointer() || prefersReducedMotion()) return;
    if (projectOpen) {
      const sheet = document.querySelector<HTMLElement>(".app .editor-paper");
      if (!sheet) return;
      const rise = play(
        sheet,
        [
          { transform: "translateY(4px)", opacity: 0 },
          { transform: "none", opacity: 1 },
        ],
        { speed: "base", easing: "out" },
      );
      return () => rise?.cancel();
    }
    const library = document.querySelector<HTMLElement>(".app > .library");
    if (!library) return;
    const fade = play(library, [{ opacity: 0 }, { opacity: 1 }], { speed: "fast", easing: "out" });
    staggerIn([...library.querySelectorAll<HTMLElement>(".project-row")]);
    return () => fade?.cancel();
    // wasPointer reads a ref; only a change of `projectOpen` starts an entrance.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectOpen]);
}
