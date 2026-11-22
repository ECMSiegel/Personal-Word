import { test, expect, type Locator, type Page } from "@playwright/test";

// FB5 (docs/agent-work/2026-11-18-folders-batch/PLAN.md): custom order on the Projects page.
// Any hand reorder -- Move up/down, Option+Up/Down or dragging -- switches the sort to Custom
// and saves the order that was on screen with the move applied; a project dropped on a folder
// heading is filed there; reordering is off while searching. Browser preview storage only.

// Created oldest first: Delta, Bravo, Alpha, Charlie. So Added (newest first) is Charlie, Alpha,
// Bravo, Delta; Name is Alpha, Bravo, Charlie, Delta; Last edited is Delta, Alpha, Charlie, Bravo.
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

const SHOTS = process.env.FB_SHOTS_DIR ?? "test-results/fb-FB5";
const titles = (page: Page, container = "root") =>
  page.locator(`[data-container="${container}"] > .project-row .project-name`).allInnerTexts();
const row = (page: Page, title: string) => page.locator(".project-row").filter({ hasText: title });
const sortButton = (page: Page) => page.getByRole("button", { name: "Sort projects" });
const heading = (page: Page, name: string) =>
  page.locator("[data-folder-heading]").filter({ has: page.getByRole("button", { name, exact: true }) });
const menu = (page: Page) => page.getByRole("menu");
const item = (page: Page, name: string) => menu(page).getByRole("menuitem", { name, exact: true });
const stored = (page: Page) =>
  page.evaluate(() => JSON.parse(localStorage.getItem("folio.preview.library") ?? "null"));

async function sortBy(page: Page, label: "Name" | "Added" | "Last edited" | "Custom") {
  await sortButton(page).click();
  await expect(page.getByRole("option").first()).toBeVisible();
  await page.waitForTimeout(400); // reveal animation
  await page.getByRole("option", { name: label, exact: true }).click();
  await expect(sortButton(page)).toContainText(label);
}

async function newFolder(page: Page, name: string) {
  await page.getByRole("button", { name: "New folder", exact: true }).click();
  await expect(page.getByRole("textbox", { name: "Folder name" })).toBeFocused();
  await page.keyboard.type(name);
  await page.keyboard.press("Enter");
  await expect(heading(page, name)).toBeVisible();
}

type Spot = "top" | "bottom" | "left" | "right" | "middle";
/** A real pointer drag: press in `from`, pass the 4 px threshold, move to `spot` of `to`, then
 *  `during` (screenshots, mid-drag checks) and release unless `release` is false. */
async function drag(page: Page, from: Locator, to: Locator, spot: Spot, during?: () => Promise<void>) {
  const a = (await from.boundingBox())!;
  const b = (await to.boundingBox())!;
  const x = { left: b.x + b.width * 0.2, right: b.x + b.width * 0.8 }[spot as "left"] ?? b.x + b.width / 2;
  const y = { top: b.y + b.height * 0.25, bottom: b.y + b.height * 0.75 }[spot as "top"] ?? b.y + b.height / 2;
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
  expect((await stored(page)).order.root).toEqual(["bbbb2222-2222-4222-8222-222222222222", "aaaa1111-1111-4111-8111-111111111111", "cccc3333-3333-4333-8333-333333333333", "dddd4444-4444-4444-8444-444444444444"]);
  await row(page, "Delta").locator(".row-label").click({ button: "right" });
  await expect(item(page, "Move down")).toHaveAttribute("aria-disabled", "true");
  await page.keyboard.press("Escape");
});

test("(e) dragging a project onto a folder heading files it; dropping on a row in another folder places it there", async ({ page }) => {
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
  // Dropped onto the heading, a project is filed first, like "Move to folder…".
  await drag(page, row(page, "Bravo"), heading(page, "Essays"), "middle");
  expect(await titles(page, essays!)).toEqual(["Bravo", "Delta", "Alpha"]);
});

test("(f) in cards view a drag reorders by the card's horizontal middle", async ({ page }) => {
  await seed(page);
  await sortBy(page, "Added");
  await page.getByRole("button", { name: "Show project cards" }).click();
  await expect(page.locator(".project-list--cards .project-row")).toHaveCount(4);
  await drag(page, row(page, "Charlie"), row(page, "Alpha"), "right", async () => {
    await expect(row(page, "Alpha")).toHaveAttribute("data-drag-edge", "end");
    // The drop line is vertical in a card grid.
    const line = await row(page, "Alpha").evaluate((el) => {
      const s = getComputedStyle(el, "::after");
      return { w: s.width, content: s.content };
    });
    expect(line).toEqual({ w: "2px", content: '""' });
    if (process.env.FB4_SHOTS) await page.screenshot({ path: `${SHOTS}/drag-cards-light.png`, fullPage: true });
  });
  await expect(sortButton(page)).toContainText("Custom");
  expect(await titles(page)).toEqual(["Alpha", "Charlie", "Bravo", "Delta"]);
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
  const folders = () => page.locator(".library-tree > section.library-folder > [data-folder-heading] .folder-name").allInnerTexts();
  expect(await folders()).toEqual(["Essays", "Fiction"]);
  await drag(page, heading(page, "Essays").locator(".folder-name"), heading(page, "Fiction"), "bottom", async () => {
    await expect(heading(page, "Essays")).toHaveAttribute("data-drag-state", "lifted");
    // The line marks the end of the whole Fiction section.
    await expect(page.locator("section.library-folder").filter({ has: heading(page, "Fiction") })).toHaveAttribute("data-drag-edge", "end");
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

// Review screenshot (FB4_SHOTS=1): a list drag in progress, showing the drop line.
test("screenshots: a list drag in progress", async ({ page }) => {
  test.skip(!process.env.FB4_SHOTS, "set FB4_SHOTS=1 to save the review screenshots");
  await page.setViewportSize({ width: 1100, height: 900 });
  await seed(page);
  await newFolder(page, "Essays");
  await drag(page, row(page, "Alpha"), heading(page, "Essays"), "middle");
  await drag(page, row(page, "Delta"), row(page, "Bravo"), "bottom", async () => {
    await page.screenshot({ path: `${SHOTS}/drag-list-light.png`, fullPage: true });
  });
});
