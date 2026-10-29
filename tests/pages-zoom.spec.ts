import { test, expect } from "@playwright/test";
import {
  create,
  dense,
  measurePages,
  ownerShape,
  pngColumn,
  seedBlocks,
  setZoom,
  settle,
  togglePageView,
} from "./pages-helpers";

// Owner report (wave 4 item 1, 1.png): below 100 % zoom the page breaks look
// lost -- text that belongs on page 2 sits on what looks like page 1. Two
// things must hold at every toolbar zoom: the spacers put each page's first
// line where its text area begins (layout), and the paper draws its grey gaps
// where those pages are (pixels).

test.describe("page view at every toolbar zoom", () => {
  test.use({ viewport: { width: 1240, height: 840 } });

  test("page starts and drawn page gaps hold at 50, 75, 125 and 150 %", async ({ page }) => {
    test.setTimeout(240_000);
    await create(page, "Zoom pages");
    // The owner's shape first (a word, empty lines, short lines), then about
    // twelve pages of long paragraphs.
    await seedBlocks(page, [...ownerShape(1), ...dense(90)]);
    const editor = page.getByRole("textbox", { name: "Writing editor", exact: true });
    await togglePageView(page);
    await expect.poll(async () => (await measurePages(editor)).spacers).toBeGreaterThan(10);
    await settle(page);
    const base = await measurePages(editor);

    for (const zoom of [100, 50, 75, 125, 150]) {
      await setZoom(page, zoom);
      await settle(page);
      await settle(page);
      const g = await measurePages(editor);
      test.info().annotations.push({
        type: "starts",
        description: `toolbar ${zoom} %: max |layout| ${Math.max(0, ...g.starts.map((x) => Math.abs(x.layout)))}, max |drawn| ${Math.max(0, ...g.starts.map((x) => Math.abs(x.drawn))).toFixed(2)}, crossings ${g.crossings.length}, worst ${JSON.stringify(g.starts.filter((x) => Math.abs(x.layout) > 1 || Math.abs(x.drawn) > 1).slice(0, 4))}`,
      });
      // At 1240 px the 125 % and 150 % pages are scaled to fit (about 1.15).
      expect(g.zoom, `zoom ${zoom}`).toBeLessThanOrEqual(zoom / 100 + 0.0005);
      test.info().annotations.push({ type: "zoom", description: `toolbar ${zoom} %: paper zoom ${g.zoom}` });
      // The plan does not depend on zoom: same number of pages.
      expect(g.spacers, `zoom ${zoom} spacers`).toBe(base.spacers);
      for (const start of g.starts) {
        expect.soft(Math.abs(start.layout), `zoom ${zoom} page ${start.page} layout`).toBeLessThanOrEqual(1);
        expect.soft(Math.abs(start.drawn), `zoom ${zoom} page ${start.page} drawn`).toBeLessThanOrEqual(1);
      }
      expect.soft(g.crossings, `zoom ${zoom} crossings`).toEqual([]);

      // Pixels: for the first three gaps, a column in the paper's left margin
      // is paper-coloured down to page k's foot and grey across the gap, and
      // the gap sits where the spacers say page k + 1 begins.
      for (let k = 0; k < 3; k++) {
        const where = await editor.evaluate(
          (surface: HTMLElement, { k }) => {
            const paper = surface.closest<HTMLElement>(".editor-paper")!;
            const scroller = surface.closest<HTMLElement>(".writer-scroll") ?? surface.closest<HTMLElement>(".is-paged")!;
            const vars = getComputedStyle(paper);
            const num = (name: string) => parseFloat(vars.getPropertyValue(name)) || 0;
            const zoom = parseFloat(vars.zoom) || 1;
            const height = num("--page-height");
            const pitch = height + num("--page-gap");
            // Bring the gap to the middle of the visible area.
            const before = paper.getBoundingClientRect();
            const ratio = paper.offsetWidth ? before.width / paper.offsetWidth : 1;
            const toScreen = Math.abs(ratio - zoom) <= Math.abs(ratio - 1) ? 1 : zoom;
            const gapTop = before.top * toScreen + (k * pitch + height) * zoom;
            const view = scroller.getBoundingClientRect();
            scroller.scrollTop += gapTop - (view.top + view.height / 2);
            const r = paper.getBoundingClientRect();
            const top = r.top * toScreen;
            return {
              zoom,
              left: r.left * toScreen,
              gapTop: top + (k * pitch + height) * zoom,
              gapBottom: top + (k + 1) * pitch * zoom,
              viewTop: view.top,
              viewBottom: view.bottom,
            };
          },
          { k },
        );
        await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
        const y0 = Math.max(where.viewTop, Math.floor(where.gapTop - 60));
        const y1 = Math.min(where.viewBottom, Math.ceil(where.gapBottom + 60));
        const png = await page.screenshot({
          clip: { x: Math.round(where.left), y: y0, width: 12, height: y1 - y0 },
        });
        const column = await pngColumn(page, png, 6);
        const paperColour = column[0];
        const isPaper = (c: number[]) => c.every((v, i) => Math.abs(v - paperColour[i]) <= 3);
        // First grey row and first paper row after it, in screen px.
        let greyTop = -1;
        let greyBottom = -1;
        column.forEach((c, y) => {
          if (greyTop < 0 && !isPaper(c)) greyTop = y0 + y;
          else if (greyTop >= 0 && greyBottom < 0 && isPaper(c)) greyBottom = y0 + y;
        });
        const label = `zoom ${zoom} gap ${k + 1}: expected ${where.gapTop.toFixed(1)}-${where.gapBottom.toFixed(1)}, drawn ${greyTop}-${greyBottom}`;
        test.info().annotations.push({ type: "gap", description: label });
        expect.soft(Math.abs(greyTop - where.gapTop), label).toBeLessThanOrEqual(2);
        expect.soft(Math.abs(greyBottom - where.gapBottom), label).toBeLessThanOrEqual(2);
      }
    }
  });
});
