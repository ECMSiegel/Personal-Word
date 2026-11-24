import { test, expect, type Page } from "@playwright/test";

// FB2, updated by OB4: the Sort control is one button showing the current sort. Its menu
// (Sort by / Direction / Folders) is kept inside the window; Custom starts from the sort the
// owner came from. The cover-style menu (text on the trigger's text, four plain rows) and the
// reverse arrow button are gone; the menu's own checks are covered by tests/ob-sort-menu.spec.ts.

const seeds = [
  {
    id: "aaaa1111-1111-4111-8111-111111111111",
    title: "Alpha",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-03-01T00:00:00.000Z",
  },
  {
    id: "bbbb2222-2222-4222-8222-222222222222",
    title: "Beta",
    createdAt: "2026-02-01T00:00:00.000Z",
    updatedAt: "2026-02-01T00:00:00.000Z",
  },
  {
    id: "cccc3333-3333-4333-8333-333333333333",
    title: "Gamma",
    createdAt: "2026-03-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  },
];

async function seed(page: Page) {
  await page.goto("/");
  await page.evaluate((projects) => {
    for (const p of projects)
      localStorage.setItem(
        "folio.preview.project." + p.id,
        JSON.stringify({
          id: p.id,
          title: p.title,
          createdAt: p.createdAt,
          updatedAt: p.updatedAt,
          revision: 1,
          order: [],
          entries: [],
        }),
      );
  }, seeds);
  await page.reload();
  await expect(page.locator(".project-row")).toHaveCount(3);
}

const titles = (page: Page) =>
  page.locator(".project-row .project-name").allInnerTexts();

const sortButton = (page: Page) => page.getByRole("button", { name: "Sort projects" });
const sortMenu = (page: Page) => page.getByRole("menu", { name: "Sort projects" });

async function openSort(page: Page) {
  await sortButton(page).click();
  await expect(sortMenu(page)).toBeVisible();
  await page.waitForTimeout(500); // reveal animation
}
const pick = (page: Page, name: string) =>
  sortMenu(page).getByRole("menuitemradio", { name, exact: true }).click();

test("the trigger shows the current sort and the word Sort is not in the toolbar", async ({ page }) => {
  await page.setViewportSize({ width: 1100, height: 900 });
  await seed(page);
  await expect(sortButton(page)).toContainText("Edited");
  await expect(page.locator(".library-toolbar").getByText("Sort", { exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Reverse project sort order" })).toHaveCount(0);
});

test("near the bottom of a short window the menu is kept inside it", async ({ page }) => {
  await page.setViewportSize({ width: 1100, height: 520 });
  await seed(page);
  await openSort(page);
  const box = (await sortMenu(page).boundingBox())!;
  expect(box.y, "menu top").toBeGreaterThanOrEqual(5);
  expect(box.y + box.height, "menu bottom").toBeLessThanOrEqual(520 - 5);
  await page.keyboard.press("Escape");
});

test("choosing Added orders by when projects were added, and Custom keeps that order", async ({ page }) => {
  await seed(page);

  // Default is Edited: Alpha (Mar 1), Beta (Feb 1), Gamma (Jan 1).
  expect(await titles(page)).toEqual(["Alpha", "Beta", "Gamma"]);

  await openSort(page);
  await pick(page, "Added");
  await expect(sortButton(page)).toContainText("Added");
  // Added: Gamma (Mar 1), Beta (Feb 1), Alpha (Jan 1).
  expect(await titles(page)).toEqual(["Gamma", "Beta", "Alpha"]);

  // Custom with no hand-made order keeps the order the owner was looking at...
  await pick(page, "Custom");
  await expect(sortButton(page)).toContainText("Custom");
  expect(await titles(page)).toEqual(["Gamma", "Beta", "Alpha"]);
  // ...and Direction is off while Custom is selected.
  await expect(sortMenu(page).getByRole("menuitemradio", { name: "Newest first" })).toHaveAttribute("aria-disabled", "true");
  await page.keyboard.press("Escape");

  // The fallback sort is remembered beside the choice.
  await expect
    .poll(() => page.evaluate(() => JSON.parse(localStorage.getItem("folio.workspace.library") ?? "{}")))
    .toMatchObject({ sort: "custom", fallbackSort: "added", reverse: false });

  await page.reload();
  await expect(sortButton(page)).toContainText("Custom");
  expect(await titles(page)).toEqual(["Gamma", "Beta", "Alpha"]);
});

test("Name sorts alphabetically and Custom keeps coming from it", async ({ page }) => {
  await seed(page);
  await openSort(page);
  await pick(page, "Name");
  expect(await titles(page)).toEqual(["Alpha", "Beta", "Gamma"]);
  await pick(page, "Custom");
  expect(await titles(page)).toEqual(["Alpha", "Beta", "Gamma"]);
  await page.keyboard.press("Escape");
});
