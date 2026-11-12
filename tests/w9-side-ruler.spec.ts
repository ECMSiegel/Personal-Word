import { expect, test, type Page } from "@playwright/test";
import { create, dense, seedBlocks, setZoom, togglePageView } from "./pages-helpers";

// W9 C5: a vertical ruler left of each page in page view.

/** Switches the top Ruler and the Side ruler together (OF3 made them two toggles). */
async function setRuler(page: Page, on: boolean) {
  const names = ["Ruler", "Side ruler"];
  let opened = false;
  if (!(await page.getByRole("button", { name: "Ruler", exact: true }).isVisible())) {
    await page.getByRole("button", { name: "Page setup", exact: true }).click();
    opened = true;
  }
  for (const name of names) {
    const toggle = page.getByRole("button", { name, exact: true });
    if ((await toggle.getAttribute("aria-pressed")) !== String(on)) await toggle.click();
    await expect(toggle).toHaveAttribute("aria-pressed", String(on));
  }
  if (opened) await page.keyboard.press("Escape");
}

async function pageView(page: Page, on: boolean) {
  const viewport = page.locator(".editor-viewport").first();
  const isPaged = /is-paged/.test((await viewport.getAttribute("class")) ?? "");
  if (isPaged !== on) await togglePageView(page);
  await expect(viewport).toHaveClass(on ? /is-paged/ : /is-continuous/);
}

const margin = (page: Page) =>
  page.locator(".editor-paper").evaluate((el) => parseFloat(getComputedStyle(el).getPropertyValue("--page-margin")));

/** Screen-px geometry of every side ruler against its page sheet. */
function measure(page: Page) {
  return page.evaluate(() => {
    const sheets = Array.from(document.querySelectorAll<HTMLElement>(".page-sheet"));
    const rulers = Array.from(document.querySelectorAll<HTMLElement>(".side-ruler"));
    const paper = document.querySelector<HTMLElement>(".editor-paper")!.getBoundingClientRect();
    const scale = paper.width / parseFloat(getComputedStyle(document.querySelector(".editor-paper")!).getPropertyValue("--page-width"));
    return {
      scale,
      sheets: sheets.map((s) => s.getBoundingClientRect()).map((r) => ({ top: r.top, height: r.height, left: r.left })),
      rulers: rulers.map((el) => {
        const r = el.getBoundingClientRect();
        const band = (cls: string) => el.querySelector<HTMLElement>(cls)?.getBoundingClientRect().height ?? -1;
        const numbers = Array.from(el.querySelectorAll(".side-ruler-tick.is-inch"))
          .map((t) => (t.textContent ?? "").trim())
          .filter(Boolean);
        const ticks = Array.from(el.querySelectorAll<HTMLElement>(".side-ruler-tick")).map((t) => t.getBoundingClientRect().top);
        return { top: r.top, height: r.height, right: r.right, left: r.left, top_band: band(".side-ruler-band--top"), bottom_band: band(".side-ruler-band--bottom"), numbers, ticks };
      }),
    };
  });
}

test.use({ viewport: { width: 1440, height: 900 } });

test("side ruler: one per page, shaded margins, drag and keys change the margin", async ({ page }) => {
  await create(page, "Margin strips");
  await pageView(page, true);
  await seedBlocks(page, dense(40));
  await setRuler(page, true);
  await expect(page.locator(".page-sheet").nth(1)).toBeAttached();

  const sheetCount = await page.locator(".page-sheet").count();
  expect(sheetCount).toBeGreaterThanOrEqual(2);
  await expect(page.locator(".side-ruler")).toHaveCount(sheetCount);

  const m = await measure(page);
  const m0 = await margin(page);
  expect(m0).toBe(96);
  m.rulers.forEach((r, i) => {
    const s = m.sheets[i];
    expect(Math.abs(r.top - s.top), `ruler ${i} top`).toBeLessThanOrEqual(1);
    expect(Math.abs(r.height - s.height), `ruler ${i} height`).toBeLessThanOrEqual(1);
    expect(Math.abs(r.right - s.left), `ruler ${i} right edge on paper left edge`).toBeLessThanOrEqual(1);
    expect(r.numbers, `ruler ${i} numbers`).toEqual(["1", "2", "3", "4", "5", "6", "7", "8", "9", "10"]);
    expect(Math.abs(r.top_band - m0 * m.scale), `ruler ${i} top band`).toBeLessThanOrEqual(1);
    expect(Math.abs(r.bottom_band - m0 * m.scale), `ruler ${i} bottom band`).toBeLessThanOrEqual(1);
  });

  const topMarker = page.getByRole("slider", { name: "Adjust top and bottom margins from the top" }).first();
  const bottomMarker = page.getByRole("slider", { name: "Adjust top and bottom margins from the bottom" }).first();
  const leftMarker = page.getByRole("slider", { name: "Adjust left and right margins from the left" });
  await expect(topMarker).toHaveAttribute("aria-valuenow", "96");

  // Changing the margin with the top ruler's key updates the side ruler's bands.
  await leftMarker.focus();
  await page.keyboard.press("ArrowRight");
  await expect.poll(() => margin(page)).toBe(102);
  const mKey = await measure(page);
  expect(Math.abs(mKey.rulers[0].top_band - 102 * mKey.scale)).toBeLessThanOrEqual(1);
  expect(Math.abs(mKey.rulers[0].bottom_band - 102 * mKey.scale)).toBeLessThanOrEqual(1);
  await page.keyboard.press("ArrowLeft");
  await expect.poll(() => margin(page)).toBe(96);

  // The top ruler's markers follow a change made on the side ruler.
  const leftBefore = (await leftMarker.boundingBox())!.x;
  const box = (await topMarker.boundingBox())!;
  const scale = (await measure(page)).scale;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2 + 48 * scale, { steps: 4 });
  await page.mouse.up();
  await expect.poll(() => margin(page)).toBe(144);
  await expect(leftMarker).toHaveAttribute("aria-valuenow", "144");
  expect((await leftMarker.boundingBox())!.x).toBeGreaterThan(leftBefore + 40 * scale);
  const m2 = await measure(page);
  expect(Math.abs(m2.rulers[0].top_band - 144 * m2.scale)).toBeLessThanOrEqual(1);
  expect(Math.abs(m2.rulers[0].bottom_band - 144 * m2.scale)).toBeLessThanOrEqual(1);

  // The bottom marker drags up to raise the margin too (clamped at 192).
  await bottomMarker.scrollIntoViewIfNeeded();
  const bbox = (await bottomMarker.boundingBox())!;
  await page.mouse.move(bbox.x + bbox.width / 2, bbox.y + bbox.height / 2);
  await page.mouse.down();
  await page.mouse.move(bbox.x + bbox.width / 2, bbox.y + bbox.height / 2 - 400 * scale, { steps: 4 });
  await page.mouse.up();
  await expect.poll(() => margin(page)).toBe(192);

  // Keys on the markers.
  await topMarker.focus();
  await page.keyboard.press("ArrowUp");
  await expect.poll(() => margin(page)).toBe(186);
  await page.keyboard.press("ArrowDown");
  await expect.poll(() => margin(page)).toBe(192);
  await bottomMarker.focus();
  await page.keyboard.press("ArrowDown");
  await expect.poll(() => margin(page)).toBe(186);
  await page.keyboard.press("Home");
  await expect.poll(() => margin(page)).toBe(24);
});

test("side ruler: absent with Ruler off, in continuous view and in focus mode", async ({ page }) => {
  await create(page, "Side ruler hidden");
  await pageView(page, true);
  await setRuler(page, true);
  await expect(page.locator(".side-ruler").first()).toBeVisible();
  await setRuler(page, false);
  await expect(page.locator(".side-ruler")).toHaveCount(0);
  await setRuler(page, true);
  await pageView(page, false);
  await expect(page.locator(".side-ruler")).toHaveCount(0);
  await pageView(page, true);
  await expect(page.locator(".side-ruler").first()).toBeVisible();
  let focus = page.getByRole("button", { name: "Focus mode", exact: true });
  if (!(await focus.count())) {
    await page.getByRole("button", { name: "More formatting" }).click();
    focus = page.getByRole("button", { name: "Focus mode", exact: true });
  }
  await focus.click();
  await expect(page.locator(".side-ruler")).toHaveCount(0);
});

test("side ruler: ticks line up with the page at 150 percent", async ({ page }) => {
  await create(page, "Side ruler zoom");
  await pageView(page, true);
  await setZoom(page, 150);
  await setRuler(page, true);
  const m = await measure(page);
  const r = m.rulers[0];
  const s = m.sheets[0];
  expect(Math.abs(r.top - s.top)).toBeLessThanOrEqual(1);
  expect(Math.abs(r.height - s.height)).toBeLessThanOrEqual(1);
  expect(Math.abs(r.right - s.left)).toBeLessThanOrEqual(1);
  // 96 page px between inch ticks, scaled.
  const inch = await page.evaluate(() =>
    Array.from(document.querySelectorAll(".side-ruler")[0].querySelectorAll<HTMLElement>(".side-ruler-tick.is-inch")).map((t) => t.getBoundingClientRect().top),
  );
  expect(Math.abs(inch[2] - inch[1] - 96 * m.scale)).toBeLessThanOrEqual(1);
  expect(Math.abs(inch[1] - s.top - 96 * m.scale)).toBeLessThanOrEqual(1.5);
});

test("side ruler: hidden while the sidebar floats", async ({ page }) => {
  await page.setViewportSize({ width: 1600, height: 900 });
  await page.addInitScript(() => {
    localStorage.setItem("folio.workspace.sidebar", JSON.stringify({ width: 270, pinned: true, hover: true, floating: true }));
  });
  await create(page, "Side ruler floating");
  await pageView(page, true);
  await setRuler(page, true);
  await expect(page.locator(".sidebar-shell.is-floating")).toBeVisible();
  await expect(page.locator(".side-ruler")).not.toHaveCount(0);
  await expect(page.locator(".side-ruler").first()).toBeHidden();
});
