import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import { paperGeometry, type PageLayout } from "../editor/formatting";
import { PageLabels } from "../editor/PageLabels";
import { paginateStatic } from "../editor/staticPagination";
import type { DocumentSettings } from "../research/types";
import "./paged-sheet.css";

/**
 * Read-only page view for static content (Read, Bibliography): the editor's
 * sheets and page labels around a plain writing surface whose direct children
 * are the blocks. `contentKey` must change whenever the content does: the
 * surface is remounted, so React never reconciles into spacer-mutated DOM.
 */
export function PagedSheet({
  layout,
  settings,
  templateId,
  contentKey,
  className,
  children,
}: {
  layout: PageLayout;
  settings: DocumentSettings;
  templateId: string | undefined;
  contentKey: string;
  className?: string;
  children: ReactNode;
}) {
  const geometry = paperGeometry(layout);
  const { width, height, gap, margin } = geometry;
  const viewport = useRef<HTMLDivElement>(null);
  const surface = useRef<HTMLDivElement>(null);
  const [pages, setPages] = useState(1);
  const [fit, setFit] = useState(1);
  const run = useCallback(() => {
    const el = surface.current;
    if (!el) return;
    const count = paginateStatic(el, { pageHeight: height, gap, margin, reserve: 0 });
    setPages((previous) => (previous === count ? previous : count));
  }, [height, gap, margin]);
  // A pane narrower than the page scales the paper down (CSS zoom), never reflows it.
  useLayoutEffect(() => {
    const el = viewport.current;
    if (!el) return;
    const measure = () => {
      const style = getComputedStyle(el);
      const available =
        el.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
      const next = Math.min(1, Math.max(0.25, available / width));
      setFit((previous) => (Math.abs(previous - next) < 0.001 ? previous : next));
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [width]);
  useLayoutEffect(run, [run, contentKey, fit]);
  useEffect(() => {
    let alive = true;
    document.fonts?.ready.then(() => alive && run());
    // An image that finishes loading changes its block's height.
    const el = viewport.current;
    const loaded = (event: Event) => {
      if (event.target instanceof HTMLImageElement) run();
    };
    el?.addEventListener("load", loaded, true);
    return () => {
      alive = false;
      el?.removeEventListener("load", loaded, true);
    };
  }, [run]);
  const vars = {
    "--page-width": `${width}px`,
    "--page-height": `${height}px`,
    "--page-margin": `${margin}px`,
    "--content-width": `${geometry.contentWidth}px`,
    "--content-height": `${geometry.contentHeight}px`,
    "--page-gap": `${gap}px`,
    "--page-count": pages,
    "--page-scale": fit,
    "--footnote-reserve": "0px",
  } as CSSProperties;
  return (
    <div ref={viewport} className="editor-viewport is-paged paged-sheet" style={vars}>
      <div className="editor-paper" style={{ ...vars, zoom: fit } as CSSProperties}>
        {Array.from({ length: pages }, (_, page) => (
          <div
            key={page}
            className="page-sheet"
            aria-hidden="true"
            style={{ top: page * (height + gap) }}
          />
        ))}
        <PageLabels
          pages={pages}
          geometry={geometry}
          margin={margin}
          settings={settings}
          templateId={templateId}
        />
        <div
          key={contentKey}
          ref={surface}
          className={"writing-surface" + (className ? " " + className : "")}
        >
          {children}
        </div>
      </div>
    </div>
  );
}
