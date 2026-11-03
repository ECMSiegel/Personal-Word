// Scroll fade for internal scroll regions (UI wave 5, E2). The hook only reports which
// edges have more content beyond them (data-scroll-top / data-scroll-bottom); scroll-fade.css
// turns that into a mask on the region. No state, no re-render: attributes are set directly.
import { useEffect, type RefObject } from "react";

/** Which edges of a scroll view have hidden content beyond them. Sub-pixel scroll
 *  positions count as the edge (1 px of slack). */
export function scrollEdges(scrollTop: number, clientHeight: number, scrollHeight: number): { top: boolean; bottom: boolean } {
  return {
    top: scrollTop > 1,
    bottom: scrollHeight - clientHeight - scrollTop > 1,
  };
}

/** Keep data-scroll-top / data-scroll-bottom on `el` current. Returns the cleanup. */
export function watchScrollFade(el: HTMLElement): () => void {
  let frame = 0;
  const apply = () => {
    frame = 0;
    const edges = scrollEdges(el.scrollTop, el.clientHeight, el.scrollHeight);
    if (edges.top) el.setAttribute("data-scroll-top", "1"); else el.removeAttribute("data-scroll-top");
    if (edges.bottom) el.setAttribute("data-scroll-bottom", "1"); else el.removeAttribute("data-scroll-bottom");
  };
  const schedule = () => { if (!frame) frame = requestAnimationFrame(apply); };
  apply();
  el.addEventListener("scroll", schedule, { passive: true });
  const resize = new ResizeObserver(schedule);
  resize.observe(el);
  // Content growing or shrinking inside the region changes scrollHeight without resizing the region.
  const mutate = new MutationObserver(schedule);
  mutate.observe(el, { childList: true, subtree: true, characterData: true });
  return () => {
    if (frame) cancelAnimationFrame(frame);
    el.removeEventListener("scroll", schedule);
    resize.disconnect();
    mutate.disconnect();
    el.removeAttribute("data-scroll-top");
    el.removeAttribute("data-scroll-bottom");
  };
}

export function useScrollFade(ref: RefObject<HTMLElement | null>): void {
  useEffect(() => (ref.current ? watchScrollFade(ref.current) : undefined), [ref]);
}
