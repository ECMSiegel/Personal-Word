import { useEffect, useState, type RefObject } from "react";
import type { Editor } from "@tiptap/react";
import {
  FOOTNOTE_RESERVE_PADDING,
  assignPages,
  computeReserve,
} from "./footnoteLayout";
import type { PageLayout } from "./formatting";
import { offsetWithin, paginate } from "./pagination";
import type { FootnoteNote } from "./FootnoteArea";

export type FootnotePlan = {
  reserve: number;
  pages: { page: number; ids: string[] }[];
};

type Geometry = {
  width: number;
  height: number;
  margin: number;
  contentWidth: number;
  contentHeight: number;
  gap: number;
};

/** Measures page footnotes without remounting or mutating the Tiptap editor. */
export function useFootnoteLayout({
  editor,
  layout,
  geometry,
  documentSettings,
  editingNote,
  notes,
  notesKey,
  paperRef,
  measureRef,
}: {
  editor: Editor | null;
  layout: PageLayout;
  geometry: Geometry;
  documentSettings: unknown;
  editingNote: string | null;
  notes: FootnoteNote[];
  notesKey: string;
  paperRef: RefObject<HTMLDivElement | null>;
  measureRef: RefObject<HTMLDivElement | null>;
}) {
  const [plan, setPlan] = useState<FootnotePlan | null>(null);
  const [overlong, setOverlong] = useState(false);

  useEffect(() => {
    if (!editor || layout.mode !== "pages") {
      setPlan(null);
      setOverlong(false);
      return;
    }
    const noteIds = new Set(notes.map((note) => note.id));
    let active = true;
    let frame = 0;
    // Each page reserves the same bottom space, sized for the tallest page.
    // This is an approximation: a short page keeps an empty reserve. Reserving
    // space reflows text, so references can move; retry a few times until the
    // page assignment stops changing.
    const measure = () => {
      const paper = paperRef.current;
      if (!active || !paper) return;
      const surface = editor.view.dom;
      const cap = geometry.contentHeight / 2;
      // Start from the reserve already applied: starting from 0 would move
      // the page spacers twice on every keystroke.
      const applied = () =>
        parseFloat(paper.style.getPropertyValue("--footnote-reserve")) || 0;
      let reserve = applied();
      let result: FootnotePlan = { reserve: 0, pages: [] };
      let hasOverlongNote = false;
      for (let attempt = 0; attempt < 3; attempt++) {
        const changed = Math.abs(applied() - reserve) >= 0.5;
        paper.style.setProperty("--footnote-reserve", `${reserve}px`);
        // The page spacers depend on the reserve; place them before reading
        // where the references fall.
        if (changed) paginate(editor.view);
        const surfaceRect = surface.getBoundingClientRect();
        const scale = surfaceRect.width / geometry.contentWidth || 1;
        const ids: string[] = [];
        const tops: number[] = [];
        surface
          .querySelectorAll<HTMLElement>("[data-footnote-id]")
          .forEach((el) => {
            const id = el.dataset.footnoteId ?? "";
            if (!noteIds.has(id) || ids.includes(id)) return;
            ids.push(id);
            // Unzoomed layout px from the top of the text area.
            tops.push(offsetWithin(el, surface));
          });
        const columns = assignPages(tops, 0, geometry.height, geometry.gap);
        const byPage = new Map<number, string[]>();
        ids.forEach((id, i) => {
          byPage.set(columns[i], [...(byPage.get(columns[i]) ?? []), id]);
        });
        const pages = [...byPage]
          .sort((a, b) => a[0] - b[0])
          .map(([page, pageIds]) => ({ page, ids: pageIds }));
        const heights = new Map<string, number>();
        measureRef.current
          ?.querySelectorAll<HTMLElement>("[data-note-id]")
          .forEach((el) => {
            heights.set(
              el.dataset.noteId ?? "",
              el.getBoundingClientRect().height / scale,
            );
          });
        const pageHeights = pages.map((group) =>
          group.ids.reduce((sum, id) => sum + (heights.get(id) ?? 0), 0),
        );
        hasOverlongNote = pageHeights.some(
          (height) => height + FOOTNOTE_RESERVE_PADDING > cap,
        );
        const next = computeReserve(pageHeights, cap);
        result = { reserve, pages };
        if (Math.abs(next - reserve) < 0.5) break;
        reserve = next;
      }
      if (Math.abs(applied() - result.reserve) >= 0.5) {
        paper.style.setProperty("--footnote-reserve", `${result.reserve}px`);
        paginate(editor.view);
      }
      setPlan((previous) =>
        JSON.stringify(previous) === JSON.stringify(result) ? previous : result,
      );
      setOverlong(hasOverlongNote);
    };
    const run = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(measure);
    };
    const observer = new ResizeObserver(run);
    observer.observe(editor.view.dom);
    editor.on("update", run);
    document.fonts.ready.then(run);
    run();
    return () => {
      active = false;
      observer.disconnect();
      editor.off("update", run);
      cancelAnimationFrame(frame);
    };
  }, [
    editor,
    layout.mode,
    layout.paper,
    layout.margin,
    layout.zoom,
    documentSettings,
    editingNote,
    notesKey,
  ]);

  return { plan, overlong };
}
