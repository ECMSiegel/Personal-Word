import { test, expect } from "@playwright/test";

test.use({ viewport: { width: 1280, height: 800 } });

test("Export menu rows paint above the format bar", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Start new project" }).click();
  await page.getByRole("button", { name: "Blank", exact: true }).click();
  await page.getByLabel("Project title").fill("Export menu stack");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByRole("toolbar", { name: "Formatting" })).toBeVisible();
  await page.locator(".export-menu-button").click();
  const menu = page.getByRole("menu", { name: "Export" });
  await expect(menu).toBeVisible();
  // The menu opens with a clip-path reveal and its rows drop in; until that settles, lower rows are
  // still clipped and hit-test to whatever is underneath. Check the settled menu.
  await menu.evaluate((el) => Promise.all(el.getAnimations({ subtree: true }).map((a) => a.finished)));
  const rows = menu.getByRole("menuitem");
  const count = await rows.count();
  expect(count).toBeGreaterThanOrEqual(5);
  for (let i = 0; i < count; i++) {
    const row = rows.nth(i);
    const label = (await row.textContent()) ?? `row ${i}`;
    const top = await row.evaluate((el) => {
      const r = el.getBoundingClientRect();
      const hit = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
      return !!hit && (hit === el || el.contains(hit));
    });
    expect(top, `"${label}" is the topmost element at its centre`).toBe(true);
  }
});
