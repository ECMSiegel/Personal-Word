import { test, expect, type Page } from "@playwright/test";

// FB2: the Sort control is one button showing the current sort. Its menu covers the button,
// is no wider than the wider of the button and its longest row, has no tick column, and lists
// Name, Added, Last edited and Custom. Custom starts from the sort the owner came from.

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

async function openSort(page: Page) {
  await sortButton(page).click();
  await expect(page.getByRole("option").first()).toBeVisible();
  await page.waitForTimeout(500); // reveal animation
}

test("the trigger is the current sort and the menu covers it, with no tick column", async ({ page }) => {
  await page.setViewportSize({ width: 1100, height: 900 });
  await seed(page);

  // The selected sort is the button itself; the word "Sort" is gone from the toolbar.
  await expect(sortButton(page)).toContainText("Last edited");
  await expect(page.locator(".library-toolbar").getByText("Sort", { exact: true })).toHaveCount(0);

  const trigger = (await sortButton(page).boundingBox())!;
  await openSort(page);
  // Located by behaviour, not by any class this fix adds: the one open menu.
  const menu = page.locator(".popover.dropdown-menu");
  await expect(menu).toHaveCount(1);
  const box = (await menu.boundingBox())!;

  expect(Math.abs(box.x - trigger.x), `menu x ${box.x} vs trigger ${trigger.x}`).toBeLessThanOrEqual(1);
  // Like a macOS pop-up button, the current row's text sits on the trigger's text.
  const [triggerText, currentText] = await textRects(page);
  expect(Math.abs(currentText.left - triggerText.left), `text x ${currentText.left} vs ${triggerText.left}`).toBeLessThanOrEqual(1);
  expect(Math.abs(currentText.top - triggerText.top), `text y ${currentText.top} vs ${triggerText.top}`).toBeLessThanOrEqual(1);
  expect(box.width, `menu width ${box.width} vs trigger ${trigger.width}`).toBeGreaterThanOrEqual(trigger.width - 1);
  expect(box.width, `menu width ${box.width} vs trigger ${trigger.width}`).toBeLessThanOrEqual(trigger.width + 24);

  // Four plain rows, no tick column.
  expect(await page.getByRole("option").allInnerTexts()).toEqual(["Name", "Added", "Last edited", "Custom"]);
  await expect(menu.locator(".dropdown-check")).toHaveCount(0);
  await expect(menu.locator(".dropdown-option.is-current")).toHaveText("Last edited");

  await page.keyboard.press("Escape");
});

// The rect of the text itself (not its box) in the trigger and in the current menu row.
const textRects = (page: Page) =>
  page.evaluate(() => {
    const rect = (el: Element) => {
      const range = document.createRange();
      range.selectNodeContents(el);
      const r = range.getBoundingClientRect();
      return { left: r.left, top: r.top, width: r.width, height: r.height };
    };
    return [
      rect(document.querySelector('[aria-label="Sort projects"] .dropdown-value')!),
      rect(document.querySelector(".popover.dropdown-menu .dropdown-option.is-current .row-label")!),
    ];
  });

test("whichever sort is current, its row's text sits exactly on the trigger's text and the pointer rests on it", async ({ page }) => {
  await page.setViewportSize({ width: 1100, height: 900 });
  await seed(page);
  for (const name of ["Name", "Added", "Last edited", "Custom"]) {
    await openSort(page);
    await page.getByRole("option", { name, exact: true }).click();
    await expect(sortButton(page)).toContainText(name);
    await page.waitForTimeout(300);
    const trigger = (await sortButton(page).boundingBox())!;
    await openSort(page);
    const [triggerText, currentText] = await textRects(page);
    expect(Math.abs(currentText.left - triggerText.left), `${name}: text x ${currentText.left} vs ${triggerText.left}`).toBeLessThanOrEqual(1);
    expect(Math.abs(currentText.top - triggerText.top), `${name}: text y ${currentText.top} vs ${triggerText.top}`).toBeLessThanOrEqual(1);
    // The pointer that clicked the trigger is over the current row, not another one.
    const row = (await page.locator(".dropdown-option.is-current").boundingBox())!;
    const pointerY = trigger.y + trigger.height / 2;
    expect(pointerY >= row.y && pointerY <= row.y + row.height, `${name}: trigger centre ${pointerY} within row ${row.y}-${row.y + row.height}`).toBe(true);
    await page.keyboard.press("Escape");
    await page.waitForTimeout(300);
  }
});

test("near the bottom of a short window the menu is kept inside it instead", async ({ page }) => {
  await page.setViewportSize({ width: 1100, height: 230 });
  await seed(page);
  await openSort(page);
  await page.getByRole("option", { name: "Name", exact: true }).click();
  await page.waitForTimeout(300);
  await openSort(page);
  const box = (await page.locator(".popover.dropdown-menu").boundingBox())!;
  expect(box.y, "menu top").toBeGreaterThanOrEqual(7);
  expect(box.y + box.height, "menu bottom").toBeLessThanOrEqual(230 - 7);
  // The offset is accepted: the current row is no longer on the trigger's text, but still in the menu.
  const [triggerText, currentText] = await textRects(page);
  expect(currentText.top, "current row text is shifted up from the trigger's").toBeLessThan(triggerText.top - 1);
  await page.keyboard.press("Escape");
});

test("near the top of the window the menu is kept inside it too", async ({ page }) => {
  await page.setViewportSize({ width: 1100, height: 900 });
  await seed(page);
  await openSort(page);
  await page.getByRole("option", { name: "Custom", exact: true }).click();
  await page.waitForTimeout(300);
  // Put the trigger 30 px below the top of the window: Custom is the 4th row, so it would poke out above.
  await page.evaluate(() => {
    const el = document.querySelector('[aria-label="Sort projects"]')!.closest(".dropdown") as HTMLElement;
    el.style.position = "fixed";
    el.style.top = "30px";
  });
  await openSort(page);
  const box = (await page.locator(".popover.dropdown-menu").boundingBox())!;
  expect(box.y, "menu top").toBeGreaterThanOrEqual(7);
  const [triggerText, currentText] = await textRects(page);
  expect(currentText.top, "current row text is shifted down from the trigger's").toBeGreaterThan(triggerText.top + 1);
  await page.keyboard.press("Escape");
});

test("choosing Added orders by when projects were added, and Custom keeps that order", async ({ page }) => {
  await seed(page);

  // Default is Last edited: Alpha (Mar 1), Beta (Feb 1), Gamma (Jan 1).
  expect(await titles(page)).toEqual(["Alpha", "Beta", "Gamma"]);

  await openSort(page);
  await page.getByRole("option", { name: "Added", exact: true }).click();
  await expect(sortButton(page)).toContainText("Added");
  // Added: Gamma (Mar 1), Beta (Feb 1), Alpha (Jan 1).
  expect(await titles(page)).toEqual(["Gamma", "Beta", "Alpha"]);

  // Custom with no hand-made order keeps the order the owner was looking at...
  await openSort(page);
  await page.getByRole("option", { name: "Custom", exact: true }).click();
  await expect(sortButton(page)).toContainText("Custom");
  expect(await titles(page)).toEqual(["Gamma", "Beta", "Alpha"]);
  // ...and the reverse control is off while Custom is selected.
  await expect(page.getByRole("button", { name: "Reverse project sort order" })).toBeDisabled();

  // The fallback sort is remembered beside the choice.
  await expect
    .poll(() => page.evaluate(() => JSON.parse(localStorage.getItem("folio.workspace.library") ?? "{}")))
    .toEqual({ sort: "custom", fallbackSort: "added", reverse: false, view: "list" });

  await page.reload();
  await expect(sortButton(page)).toContainText("Custom");
  expect(await titles(page)).toEqual(["Gamma", "Beta", "Alpha"]);
});

test("Name sorts alphabetically and Custom keeps coming from it", async ({ page }) => {
  await seed(page);
  await openSort(page);
  await page.getByRole("option", { name: "Name", exact: true }).click();
  expect(await titles(page)).toEqual(["Alpha", "Beta", "Gamma"]);
  await openSort(page);
  await page.getByRole("option", { name: "Custom", exact: true }).click();
  expect(await titles(page)).toEqual(["Alpha", "Beta", "Gamma"]);
});
