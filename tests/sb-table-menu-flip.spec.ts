import { test, expect, type Page } from "@playwright/test";

async function createProject(page: Page, title: string) {
  await page.addInitScript(() =>
    localStorage.setItem("personal-word.restoreTabs", "true"),
  );
  await page.goto("/");
  await page.getByRole("button", { name: "Start new project" }).click();
  await page.getByRole("button", { name: "Blank", exact: true }).click();
  await page.getByLabel("Project title").fill(title);
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.locator(".save-status")).toHaveText("Saved");
}

async function insertTable(page: Page) {
  const insert = page.getByRole("button", { name: "Insert table", exact: true });
  if (!(await insert.isVisible()))
    await page.getByRole("button", { name: "More formatting", exact: true }).click();
  await insert.click();
}

const tableMenu = (page: Page) => page.getByRole("menu", { name: "Table actions" });

async function openMenu(page: Page, size: { width: number; height: number }, which: "low" | "last") {
  await page.setViewportSize(size);
  await createProject(page, "Table menu flip");
  await insertTable(page);
  await expect(page.getByRole("textbox", { name: "Writing editor" }).locator("td").first()).toBeVisible();
  // Pick the click point in one pass so nothing re-renders between measuring and clicking.
  const point = await page.evaluate(
    ({ w, h, which }) => {
      const cells = [...document.querySelectorAll(".ProseMirror td")].map((c) => c.getBoundingClientRect());
      if (which === "last") {
        // The visible cell nearest the window's right edge, near its top.
        const b = cells.filter((c) => c.top >= 0 && c.top + 12 <= h && c.left < w - 8).sort((p, q) => q.right - p.right)[0];
        return { x: Math.min(b.right - 4, w - 4), y: b.top + 6 };
      }
      const visible = cells.filter((b) => b.top >= 0 && b.top + 12 <= h);
      const b = visible.sort((p, q) => q.top - p.top)[0];
      return { x: b.left + 8, y: Math.min(b.bottom - 4, h - 4) };
    },
    { w: size.width, h: size.height, which },
  );
  await page.mouse.click(point.x, point.y, { button: "right" });
  await expect(tableMenu(page)).toBeVisible();
  // Let the open animation settle.
  await page.waitForTimeout(600);
  return { point, box: (await tableMenu(page).boundingBox())! };
}

test("table menu stays inside a short window", async ({ page }) => {
  const size = { width: 900, height: 420 };
  const { box } = await openMenu(page, size, "low");
  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.y).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width).toBeLessThanOrEqual(size.width);
  expect(box.y + box.height).toBeLessThanOrEqual(size.height);
});

test("table menu stays inside when clicked near the right edge", async ({ page }) => {
  const size = { width: 520, height: 420 };
  const { box } = await openMenu(page, size, "last");
  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width).toBeLessThanOrEqual(size.width);
  expect(box.y + box.height).toBeLessThanOrEqual(size.height);
});

test("table menu still opens downward at the pointer in a tall window", async ({ page }) => {
  const { box, point } = await openMenu(page, { width: 1280, height: 900 }, "low");
  expect(Math.abs(box.y - point.y)).toBeLessThan(6);
  expect(box.y + box.height).toBeLessThanOrEqual(900);
});
