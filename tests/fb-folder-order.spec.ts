import { test, expect, type Locator, type Page } from "@playwright/test";

// FB5 (docs/agent-work/2026-11-18-folders-batch/PLAN.md), rewritten for the outline by OB5
// (docs/agent-work/2026-11-22-projects-outline/PLAN.md, Decisions 4 and 10): any hand reorder --
// Move up/down, Option+Up/Down or dragging -- moves that one row inside its container's saved
// order (with none, the order on screen) and switches the sort to Custom; a project dropped on a
// folder row is filed first there; reordering is off while searching. The card cases are gone
// with the card view. Browser preview storage only.

// Created oldest first: Delta, Bravo, Alpha, Charlie. So Added (newest first) is Charlie, Alpha,
// Bravo, Delta; Name is Alpha, Bravo, Charlie, Delta; Edited is Delta, Alpha, Charlie, Bravo.
const seeds = [
  { id: "dddd4444-4444-4444-8444-444444444444", title: "Delta", createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-04-01T00:00:00.000Z" },
  { id: "bbbb2222-2222-4222-8222-222222222222", title: "Bravo", createdAt: "2026-02-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z" },
  { id: "aaaa1111-1111-4111-8111-111111111111", title: "Alpha", createdAt: "2026-03-01T00:00:00.000Z", updatedAt: "2026-03-01T00:00:00.000Z" },
  { id: "cccc3333-3333-4333-8333-333333333333", title: "Charlie", createdAt: "2026-04-01T00:00:00.000Z", updatedAt: "2026-02-01T00:00:00.000Z" },
];

async function seed(page: Page) {
  await page.goto("/");
  await page.evaluate((projects) => {
    for (const p of projects)
      localStorage.setItem(
        "folio.preview.project." + p.id,
        JSON.stringify({ ...p, revision: 1, order: [], entries: [] }),
      );
  }, seeds);
  await page.reload();
  await expect(page.locator(".project-row")).toHaveCount(4);
}

const titles = (page: Page, container = "root") =>
  page.locator(`.project-row[data-container="${container}"] .project-name`).allInnerTexts();
const row = (page: Page, title: string) => page.locator(".project-row").filter({ hasText: title });
const sortButton = (page: Page) => page.getByRole("button", { name: "Sort projects" });
const heading = (page: Page, name: string) =>
  page.locator(".folder-row").filter({ has: page.getByRole("button", { name, exact: true }) });
const menu = (page: Page) => page.getByRole("menu");
const item = (page: Page, name: string) => menu(page).getByRole("menuitem", { name, exact: true });
const stored = (page: Page) =>
  page.evaluate(() => JSON.parse(localStorage.getItem("folio.preview.library") ?? "null"));

async function sortBy(page: Page, label: "Name" | "Added" | "Edited" | "Custom") {
  await sortButton(page).click();
  const sortMenu = page.getByRole("menu", { name: "Sort projects" });
  await expect(sortMenu).toBeVisible();
  await page.waitForTimeout(400); // reveal animation
  await sortMenu.getByRole("menuitemradio", { name: label, exact: true }).click();
  await page.keyboard.press("Escape");
  await expect(sortMenu).toBeHidden();
  await expect(sortButton(page)).toContainText(label);
}

async function newFolder(page: Page, name: string) {
  await page.getByRole("button", { name: "New folder", exact: true }).click();
  await expect(page.getByRole("textbox", { name: "Folder name" })).toBeFocused();
  await page.keyboard.type(name);
  await page.keyboard.press("Enter");
  await expect(heading(page, name)).toBeVisible();
}

type Spot = "top" | "bottom" | "middle";
/** A real pointer drag: press in `from`, pass the 4 px threshold, move to `spot` of `to`, then
 *  `during` (screenshots, mid-drag checks) and release unless `release` is false. */
async function drag(page: Page, from: Locator, to: Locator, spot: Spot, during?: () => Promise<void>) {
  const a = (await from.boundingBox())!;
  const b = (await to.boundingBox())!;
  const x = b.x + b.width / 2;
  // Top and bottom sixth: before / after on a project (halves) and on a folder (thirds).
  const y = { top: b.y + b.height * 0.15, bottom: b.y + b.height * 0.85 }[spot as "top"] ?? b.y + b.height / 2;
  await page.mouse.move(a.x + a.width / 3, a.y + a.height / 2);
  await page.mouse.down();
  await page.mouse.move(a.x + a.width / 3 + 6, a.y + a.height / 2 + 6, { steps: 2 });
  await page.mouse.move(x, y, { steps: 6 });
  await during?.();
  await page.mouse.up();
}

test("(a, i) sort Added, drag row 3 above row 1: the sort reads Custom and the order is 3, 1, 2, 4 after a reload", async ({ page }) => {
  await seed(page);
  await sortBy(page, "Added");
  expect(await titles(page)).toEqual(["Charlie", "Alpha", "Bravo", "Delta"]);
  await drag(page, row(page, "Bravo"), row(page, "Charlie"), "top", async () => {
    await expect(row(page, "Bravo")).toHaveAttribute("data-drag-state", "lifted");
    await expect(row(page, "Charlie")).toHaveAttribute("data-drag-edge", "start");
    // No other row moves while dragging.
    await expect(page.locator('.project-row[style*="transform"]')).toHaveCount(0);
  });
  await expect(sortButton(page)).toContainText("Custom");
  expect(await titles(page)).toEqual(["Bravo", "Charlie", "Alpha", "Delta"]);
  // The release did not open the project, and nothing is left marked.
  await expect(page.locator(".library")).toBeVisible();
  await expect(page.locator("[data-drag-state], [data-drag-edge]")).toHaveCount(0);
  await page.reload();
  await expect(sortButton(page)).toContainText("Custom");
  expect(await titles(page)).toEqual(["Bravo", "Charlie", "Alpha", "Delta"]);
});

test("(b) Name shows the alphabetical order; Custom shows the hand-made order again", async ({ page }) => {
  await seed(page);
  await sortBy(page, "Added");
  await drag(page, row(page, "Bravo"), row(page, "Charlie"), "top");
  await sortBy(page, "Name");
  expect(await titles(page)).toEqual(["Alpha", "Bravo", "Charlie", "Delta"]);
  await sortBy(page, "Custom");
  expect(await titles(page)).toEqual(["Bravo", "Charlie", "Alpha", "Delta"]);
});

test("(c) with no hand-made order, Custom keeps the order of the sort it came from", async ({ page }) => {
  await seed(page);
  await sortBy(page, "Name");
  await sortBy(page, "Custom");
  expect(await titles(page)).toEqual(["Alpha", "Bravo", "Charlie", "Delta"]);
  expect(await stored(page)).toBeNull();
});

test("(d) Move down from the menu switches to Custom; Move up is disabled at the top", async ({ page }) => {
  await seed(page);
  await sortBy(page, "Name");
  await row(page, "Alpha").locator(".row-label").click({ button: "right" });
  await expect(item(page, "Move up")).toHaveAttribute("aria-disabled", "true");
  await item(page, "Move down").click();
  await expect(sortButton(page)).toContainText("Custom");
  expect(await titles(page)).toEqual(["Bravo", "Alpha", "Charlie", "Delta"]);
  // No saved order before (rule B): the order on screen, with the move, is saved as items.
  expect((await stored(page)).order["items:root"]).toEqual(["p:bbbb2222-2222-4222-8222-222222222222", "p:aaaa1111-1111-4111-8111-111111111111", "p:cccc3333-3333-4333-8333-333333333333", "p:dddd4444-4444-4444-8444-444444444444"]);
  await row(page, "Delta").locator(".row-label").click({ button: "right" });
  await expect(item(page, "Move down")).toHaveAttribute("aria-disabled", "true");
  await page.keyboard.press("Escape");
});

test("(e) dragging a project onto a folder row files it; dropping on a row in another folder places it there", async ({ page }) => {
  await seed(page);
  await sortBy(page, "Name");
  await newFolder(page, "Essays");
  await drag(page, row(page, "Alpha"), heading(page, "Essays"), "middle", async () => {
    await expect(heading(page, "Essays")).toHaveAttribute("data-drop-into", "");
    const accent = await page.evaluate(() => {
      const s = document.createElement("span");
      s.style.color = "var(--accent)";
      document.body.append(s);
      const c = getComputedStyle(s).color;
      s.remove();
      return c;
    });
    const name = heading(page, "Essays").locator(".folder-name");
    expect(await name.evaluate((el) => getComputedStyle(el).color)).toBe(accent);
    // Weight and colour only: the heading gets no fill.
    expect(await heading(page, "Essays").evaluate((el) => getComputedStyle(el).backgroundColor)).toBe("rgba(0, 0, 0, 0)");
  });
  const essays = await page.locator("[data-folder-id]").first().getAttribute("data-folder-id");
  expect(await titles(page, essays!)).toEqual(["Alpha"]);
  expect(await titles(page)).toEqual(["Bravo", "Charlie", "Delta"]);
  await expect(sortButton(page)).toContainText("Custom");
  // The folder stays expanded: the release did not toggle it.
  await expect(heading(page, "Essays").getByRole("button", { name: "Essays", exact: true })).toHaveAttribute("aria-expanded", "true");
  // A top-level project dropped above the folder's row joins the folder at that place.
  await drag(page, row(page, "Delta"), row(page, "Alpha"), "top");
  expect(await titles(page, essays!)).toEqual(["Delta", "Alpha"]);
  expect(await titles(page)).toEqual(["Bravo", "Charlie"]);
  expect((await stored(page)).placement).toMatchObject({ "dddd4444-4444-4444-8444-444444444444": essays });
  // Dropped onto the folder row, a project is filed first in it.
  await drag(page, row(page, "Bravo"), heading(page, "Essays"), "middle");
  expect(await titles(page, essays!)).toEqual(["Bravo", "Delta", "Alpha"]);
});

test("(g) Option+Down moves the focused row, announces it and keeps focus", async ({ page }) => {
  await seed(page);
  await sortBy(page, "Name");
  const alpha = row(page, "Alpha").locator(".row-label");
  await alpha.focus();
  await page.keyboard.press("Alt+ArrowDown");
  expect(await titles(page)).toEqual(["Bravo", "Alpha", "Charlie", "Delta"]);
  await expect(sortButton(page)).toContainText("Custom");
  await expect(alpha).toBeFocused();
  await expect(page.getByRole("status").filter({ hasText: "Moved" })).toHaveText("Moved Alpha to position 2 of 4");
  await page.keyboard.press("Alt+ArrowUp");
  await page.keyboard.press("Alt+ArrowUp");
  await expect(page.getByRole("status").filter({ hasText: "Alpha" })).toHaveText("Alpha is already first");
  expect(await titles(page)).toEqual(["Alpha", "Bravo", "Charlie", "Delta"]);
  await expect(alpha).toBeFocused();
});

test("(h) a folder dragged below its sibling reorders; a folder moves by keyboard too", async ({ page }) => {
  await seed(page);
  await newFolder(page, "Essays");
  await newFolder(page, "Fiction");
  const folders = () => page.locator('.folder-row[data-container="root"] .folder-name').allInnerTexts();
  expect(await folders()).toEqual(["Essays", "Fiction"]);
  await drag(page, heading(page, "Essays").locator(".folder-name"), heading(page, "Fiction"), "bottom", async () => {
    await expect(heading(page, "Essays")).toHaveAttribute("data-drag-state", "lifted");
    // Fiction is empty, so its bottom third is "after": the line is on its lower edge.
    await expect(heading(page, "Fiction")).toHaveAttribute("data-drag-edge", "end");
  });
  expect(await folders()).toEqual(["Fiction", "Essays"]);
  await expect(sortButton(page)).toContainText("Custom");
  await expect(heading(page, "Essays").getByRole("button", { name: "Essays", exact: true })).toHaveAttribute("aria-expanded", "true");
  const chevron = heading(page, "Essays").getByRole("button", { name: "Essays", exact: true });
  await chevron.focus();
  await page.keyboard.press("Alt+ArrowUp");
  expect(await folders()).toEqual(["Essays", "Fiction"]);
  await expect(chevron).toBeFocused();
  await page.reload();
  expect(await folders()).toEqual(["Essays", "Fiction"]);
});

test("Escape cancels a drag; nothing moves and the press does not open the project", async ({ page }) => {
  await seed(page);
  await sortBy(page, "Name");
  await drag(page, row(page, "Delta"), row(page, "Alpha"), "top", async () => {
    await expect(row(page, "Alpha")).toHaveAttribute("data-drag-edge", "start");
    await page.keyboard.press("Escape");
    await expect(page.locator("[data-drag-state], [data-drag-edge]")).toHaveCount(0);
  });
  await expect(page.locator(".library")).toBeVisible();
  await expect(sortButton(page)).toContainText("Name");
  expect(await titles(page)).toEqual(["Alpha", "Bravo", "Charlie", "Delta"]);
  expect(await stored(page)).toBeNull();
});

test("while searching every reorder control is off", async ({ page }) => {
  await seed(page);
  await sortBy(page, "Name");
  await page.getByRole("button", { name: "Search projects" }).click();
  await page.getByRole("searchbox", { name: "Filter projects by title" }).fill("a");
  await row(page, "Bravo").locator(".row-label").click({ button: "right" });
  await expect(item(page, "Move up")).toHaveAttribute("aria-disabled", "true");
  await expect(item(page, "Move down")).toHaveAttribute("aria-disabled", "true");
  await page.keyboard.press("Escape");
  await row(page, "Bravo").locator(".row-label").focus();
  await page.keyboard.press("Alt+ArrowDown");
  await drag(page, row(page, "Delta"), row(page, "Alpha"), "top", async () => {
    await expect(page.locator("[data-drag-state], [data-drag-edge]")).toHaveCount(0);
  });
  await expect(sortButton(page)).toContainText("Name");
  expect(await stored(page)).toBeNull();
});
