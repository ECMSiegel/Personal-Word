import { expect, test, type Page } from "@playwright/test";
import { create, dense, seedBlocks, setZoom, togglePageView } from "./pages-helpers";

// OF3: rulers sit outside the sheet in page view, grey outside the margins, two separate toggles.

const TOP = "Ruler";
const SIDE = "Side ruler";

async function setToggle(page: Page, name: string, on: boolean) {
  const toggle = page.getByRole("button", { name, exact: true });
  let opened = false;
  if (!(await toggle.isVisible())) {
    await page.getByRole("button", { name: "Page setup", exact: true }).click();
    opened = true;
  }
  if ((await toggle.getAttribute("aria-pressed")) !== String(on)) await toggle.click();
  await expect(toggle).toHaveAttribute("aria-pressed", String(on));
  if (opened) await page.keyboard.press("Escape");
}

async function readToggle(page: Page, name: string) {
  const toggle = page.getByRole("button", { name, exact: true });
  let opened = false;
  if (!(await toggle.isVisible())) {
    await page.getByRole("button", { name: "Page setup", exact: true }).click();
    opened = true;
  }
  const value = await toggle.getAttribute("aria-pressed");
  if (opened) await page.keyboard.press("Escape");
  return value;
}

/** Reload keeping the open project (the same seeding the other specs use). */
async function reloadKeepingProject(page: Page) {
  await page.evaluate(() => {
    const key = Object.keys(localStorage).find((k) => k.startsWith("folio.preview.project."))!;
    const project = JSON.parse(localStorage.getItem(key)!);
    localStorage.setItem("personal-word.restoreTabs", "true");
    localStorage.setItem("folio.lastProject", project.id);
  });
  await page.reload();
  await expect(page.getByRole("textbox", { name: "Writing editor" })).toBeVisible();
}

const overlap = (a: { left: number; right: number; top: number; bottom: number }, b: typeof a) =>
  Math.min(a.right, b.right) - Math.max(a.left, b.left) > 0.5 &&
  Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > 0.5;

test.use({ viewport: { width: 1440, height: 900 } });

test("page view: neither ruler touches any sheet at rest; the top ruler stays pinned and the caret clears it", async ({ page }) => {
  await create(page, "OF3 outside");
  await togglePageView(page);
  await seedBlocks(page, dense(40));
  await setToggle(page, TOP, true);
  await setToggle(page, SIDE, true);
  await expect(page.locator(".document-ruler")).toBeVisible();
  await expect(page.locator(".side-ruler").first()).toBeVisible();
  const scroller = page.locator(".writer-scroll").first();
  await scroller.evaluate((el) => (el.scrollTop = 0));
  const rest = await page.evaluate(() => {
    const box = (el: Element) => el.getBoundingClientRect();
    const sheets = Array.from(document.querySelectorAll(".page-sheet")).map(box);
    const rulers = Array.from(document.querySelectorAll(".document-ruler, .side-ruler")).map(box);
    const top = box(document.querySelector(".document-ruler")!);
    return {
      hit: rulers.some((r) => sheets.some((s) =>
        Math.min(r.right, s.right) - Math.max(r.left, s.left) > 0.5 &&
        Math.min(r.bottom, s.bottom) - Math.max(r.top, s.top) > 0.5)),
      gap: top.bottom - sheets[0].top,
    };
  });
  expect(rest.hit, "a ruler overlaps a sheet at rest").toBe(false);
  expect(Math.abs(rest.gap)).toBeLessThanOrEqual(1.5);

  // Scrolled down: the top ruler is still at the top of the scroller.
  await scroller.evaluate((el) => (el.scrollTop = 1500));
  await page.waitForTimeout(150);
  const pinned = await page.evaluate(() => ({
    offset: document.querySelector(".document-ruler")!.getBoundingClientRect().top -
      document.querySelector(".writer-scroll")!.getBoundingClientRect().top,
  }));
  expect(Math.abs(pinned.offset), "ruler pinned").toBeLessThanOrEqual(2);

  // The caret is never left under the pinned ruler: put it at the end, scroll so it sits
  // right under the ruler, then step up a line; the editor must scroll it clear.
  await page.locator(".ProseMirror").first().click();
  await page.keyboard.press("ControlOrMeta+End");
  const caretTop = () =>
    page.evaluate(() => {
      const sel = window.getSelection()!;
      const range = sel.getRangeAt(0).cloneRange();
      const r = range.getClientRects()[0] ?? (sel.focusNode as HTMLElement).parentElement!.getBoundingClientRect();
      return r.top;
    });
  await expect.poll(caretTop).toBeGreaterThan(0);
  const rulerBottom = () => page.evaluate(() => document.querySelector(".document-ruler")!.getBoundingClientRect().bottom);
  const before = await caretTop();
  const scrollBottom = await rulerBottom();
  await scroller.evaluate((el, d) => (el.scrollTop += d), before - scrollBottom - 4);
  await page.keyboard.press("ArrowUp");
  await page.waitForTimeout(300);
  expect(await caretTop(), "caret not hidden under the ruler").toBeGreaterThanOrEqual((await rulerBottom()) - 1);
});

for (const mode of ["pages", "continuous"] as const) {
  for (const zoom of [75, 100, 150]) {
    test(`top ruler greys outside the margins: ${mode} at ${zoom}%`, async ({ page }) => {
      await create(page, `OF3 bands ${mode} ${zoom}`);
      if (mode === "pages") await togglePageView(page);
      await setZoom(page, zoom);
      await setToggle(page, TOP, true);
      const m = await page.evaluate(() => {
        const paper = document.querySelector<HTMLElement>(".editor-paper")!;
        const margin = parseFloat(getComputedStyle(paper).getPropertyValue("--page-margin"));
        // The ruler's own zoom (the paper can be narrower than the page in continuous view).
        const scale = parseFloat(getComputedStyle(document.querySelector(".document-ruler")!).zoom) || 1;
        const ruler = document.querySelector(".document-ruler")!.getBoundingClientRect();
        const left = document.querySelector(".ruler-band--left")?.getBoundingClientRect();
        const right = document.querySelector(".ruler-band--right")?.getBoundingClientRect();
        return {
          margin, scale, ruler: { left: ruler.left, right: ruler.right },
          left: left ? { width: left.width, left: left.left } : null,
          right: right ? { width: right.width, right: right.right } : null,
        };
      });
      expect(m.left, "left band exists").not.toBeNull();
      expect(m.right, "right band exists").not.toBeNull();
      expect(Math.abs(m.left!.width - m.margin * m.scale)).toBeLessThanOrEqual(1);
      expect(Math.abs(m.right!.width - m.margin * m.scale)).toBeLessThanOrEqual(1);
      expect(Math.abs(m.left!.left - m.ruler.left)).toBeLessThanOrEqual(1);
      expect(Math.abs(m.right!.right - m.ruler.right)).toBeLessThanOrEqual(1);
      // A margin change moves the bands.
      await page.getByRole("slider", { name: "Adjust left and right margins from the left" }).focus();
      await page.keyboard.press("ArrowRight");
      await expect.poll(() => page.locator(".ruler-band--left").evaluate((el) => el.getBoundingClientRect().width))
        .toBeCloseTo(102 * m.scale, 0);
    });
  }
}

test("each ruler toggles alone and each choice survives a reload", async ({ page }) => {
  await create(page, "OF3 toggles");
  await togglePageView(page);
  const top = page.locator(".document-ruler");
  const side = page.locator(".side-ruler");

  await setToggle(page, TOP, true);
  await expect(top).toBeVisible();
  await expect(side).toHaveCount(0);
  expect(await readToggle(page, SIDE)).toBe("false");

  await reloadKeepingProject(page);
  await expect(top).toBeVisible();
  await expect(side).toHaveCount(0);

  await setToggle(page, TOP, false);
  await setToggle(page, SIDE, true);
  await expect(top).toHaveCount(0);
  await expect(side.first()).toBeVisible();
  await reloadKeepingProject(page);
  await expect(top).toHaveCount(0);
  await expect(side.first()).toBeVisible();
  expect(await readToggle(page, TOP)).toBe("false");
  expect(await readToggle(page, SIDE)).toBe("true");

  await setToggle(page, SIDE, false);
  await expect(side).toHaveCount(0);
  await reloadKeepingProject(page);
  await expect(top).toHaveCount(0);
  await expect(side).toHaveCount(0);
});

test("the old single preference turns both rulers on, and they then split", async ({ page }) => {
  await create(page, "OF3 migrate");
  await togglePageView(page);
  await page.evaluate(() => {
    localStorage.setItem("folio.workspace.ruler", "true");
    localStorage.removeItem("folio.workspace.side-ruler");
  });
  await reloadKeepingProject(page);
  await expect(page.locator(".document-ruler")).toBeVisible();
  await expect(page.locator(".side-ruler").first()).toBeVisible();
  expect(await readToggle(page, TOP)).toBe("true");
  expect(await readToggle(page, SIDE)).toBe("true");

  // Turning the top ruler off keeps the side ruler the migration gave back.
  await setToggle(page, TOP, false);
  await reloadKeepingProject(page);
  await expect(page.locator(".document-ruler")).toHaveCount(0);
  await expect(page.locator(".side-ruler").first()).toBeVisible();
});

test("page view: a click on the strip's grey end leaves the caret and the scroll alone", async ({ page }) => {
  await create(page, "OF3 strip click");
  await togglePageView(page);
  await seedBlocks(page, dense(60));
  await setToggle(page, TOP, true);
  const scroller = page.locator(".writer-scroll").first();
  await page.locator(".ProseMirror").first().click();
  await page.keyboard.press("ControlOrMeta+Home");
  await scroller.evaluate((el) => (el.scrollTop = 1500));
  await page.waitForTimeout(200);
  const state = () =>
    page.evaluate(() => {
      const sel = window.getSelection()!;
      return { head: (sel.anchorNode?.textContent ?? "").slice(0, 12), offset: sel.anchorOffset, top: document.querySelector(".writer-scroll")!.scrollTop };
    });
  const before = await state();
  const spot = await page.evaluate(() => {
    const strip = document.querySelector(".ruler-strip")!.getBoundingClientRect();
    const ruler = document.querySelector(".document-ruler")!.getBoundingClientRect();
    return { x: (strip.left + ruler.left) / 2, y: strip.top + strip.height / 2 };
  });
  await page.mouse.click(spot.x, spot.y);
  await page.waitForTimeout(300);
  expect(await state(), "strip click changed the caret or the scroll").toEqual(before);
  // The ruler's own marker still works from the strip.
  await page.getByRole("slider", { name: "Adjust left and right margins from the left" }).focus();
  await page.keyboard.press("ArrowRight");
  await expect(page.getByRole("slider", { name: "Adjust left and right margins from the left" })).toHaveAttribute("aria-valuenow", "102");
});

test("page view with a floating sidebar: the sidebar and the citation card paint above the pinned strip", async ({ page }) => {
  await page.setViewportSize({ width: 1600, height: 900 });
  await page.addInitScript(() => {
    localStorage.setItem("personal-word.restoreTabs", "true");
    localStorage.setItem("folio.workspace.sidebar", JSON.stringify({ width: 270, pinned: true, hover: true, floating: true }));
  });
  await create(page, "Probe");
  await togglePageView(page);
  await seedBlocks(page, dense(40));
  await setToggle(page, TOP, true);
  await expect(page.locator(".sidebar-shell.is-floating")).toBeVisible();
  await page.getByText("Research", { exact: true }).first().click();
  const card = page.locator(".citation-card");
  const scroller = page.locator(".writer-scroll").first();
  for (const top of [0, 1500]) {
    await scroller.evaluate((el, y) => (el.scrollTop = y), top);
    await page.waitForTimeout(200);
    const bad = await page.evaluate(() => {
      const strip = document.querySelector(".ruler-strip")!.getBoundingClientRect();
      const out: string[] = [];
      const check = (sel: string, owner: string) => {
        document.querySelectorAll(sel).forEach((el) => {
          const r = el.getBoundingClientRect();
          if (r.width === 0) return;
          const pts: [number, number][] = [[r.left + r.width / 2, r.top + r.height / 2]];
          const top = Math.max(r.top, strip.top);
          const bottom = Math.min(r.bottom, strip.bottom);
          if (bottom > top) pts.push([r.left + r.width / 2, (top + bottom) / 2]);
          for (const [x, y] of pts) {
            const hit = document.elementFromPoint(x, y);
            if (hit && !hit.closest(owner)) out.push(`${sel} covered by ${hit.className}`);
          }
        });
      };
      check(".project-switch", ".sidebar-shell");
      check(".sidebar-pin", ".sidebar-shell");
      check(".citation-card", ".citation-card");
      return out;
    });
    expect(bad, `scrollTop ${top}`).toEqual([]);
  }
  expect(await card.count(), "citation card was probed").toBeGreaterThan(0);
});
