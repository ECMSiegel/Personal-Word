// Keep as Fragment, made visible on a pointer click only: the scissors icon
// turns -12 degrees and back (two press beats), and the new Fragments row (or,
// when that group is collapsed, its heading) slides in with the shared stagger.
import { useLayoutEffect, useRef, type RefObject } from "react";
import { play, prefersReducedMotion, staggerIn } from "../motion";

export function turnScissors(icon: Element | null): void {
  if (!icon || prefersReducedMotion()) return;
  // Added on top of the icon's own transform, so a hovered (magnified) icon keeps its size while it turns.
  const beats = [
    play(icon, [{ transform: "none" }, { transform: "rotate(-12deg)" }], { speed: "press", easing: "out" }),
    // The delayed return holds its first frame while the turn runs: no jump between beats.
    play(icon, [{ transform: "rotate(-12deg)" }, { transform: "none" }], {
      speed: "press",
      easing: "out",
      delay: 80,
      fill: "backwards",
    }),
  ];
  for (const beat of beats) if (beat?.effect) (beat.effect as KeyframeEffect).composite = "add";
}

export function useNewFragmentRow(scope: RefObject<HTMLElement | null>, fragmentId: string | undefined): void {
  const handled = useRef(fragmentId);
  useLayoutEffect(() => {
    if (!fragmentId || fragmentId === handled.current) return;
    handled.current = fragmentId;
    const root = scope.current;
    if (!root || prefersReducedMotion()) return;
    const group = root.querySelector<HTMLElement>('[data-group="fragments"]');
    const row = [...(group?.querySelectorAll<HTMLElement>(".entry-row") ?? [])].find(
      (r) => r.querySelector(`[data-row-id="${CSS.escape(fragmentId)}"]`),
    );
    const target = row ?? group?.querySelector<HTMLElement>(".group-heading");
    if (target) staggerIn([target]);
  }, [fragmentId, scope]);
}
