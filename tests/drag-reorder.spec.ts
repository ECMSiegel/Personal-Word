import { test, expect, type Page } from "@playwright/test";

// Sidebar groups and manuscript entries reorder by pointer drag (useDragReorder);
// the arrow buttons stay as the keyboard way to reorder.

const SHOTS = process.env.N4_SHOTS;

async function createProject(page: Page, title: string) {
  await page.addInitScript(() => localStorage.setItem("personal-word.restoreTabs", "true"));
  await page.goto("/");
  await page.getByRole("button", { name: "Start new project" }).click();
  await page.getByRole("button", { name: "Blank", exact: true }).click();
  await page.getByLabel("Project title").fill(title);
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByRole("textbox", { name: "Writing editor" })).toBeVisible();
}

async function addSection(page: Page, title: string) {
  await page.getByRole("button", { name: "New section", exact: true }).click();
  await page.getByLabel("Title", { exact: true }).fill(title);
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.locator(".entry-main").filter({ hasText: title })).toBeVisible();
}

const heading = (page: Page, group: string) => page.locator(`.sidebar-groups [data-group="${group}"] .group-title`);
const groupNames = (page: Page) =>
  page.locator(".sidebar-groups > .sidebar-group").evaluateAll((els) => els.map((el) => el.getAttribute("data-group")));
const entryTitles = (page: Page) =>
  page.locator('[data-group="manuscript"] .entry-row .entry-main > span').allTextContents();

/** Mouse down on `from`'s centre, then travel to `toY`; leaves the button down. */
async function pickUp(page: Page, from: ReturnType<Page["locator"]>, toY: (box: { y: number; height: number }) => number) {
  const box = (await from.boundingBox())!;
  const x = box.x + box.width / 2;
  await page.mouse.move(x, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(x, box.y + box.height / 2 + (toY(box) > box.y ? 8 : -8), { steps: 3 });
  await page.mouse.move(x, toY(box), { steps: 8 });
}

test("dragging Fragments above Manuscript reorders the groups and the order survives a reload", async ({ page }) => {
  await createProject(page, "Group drag fixture");
  expect(await groupNames(page)).toEqual(["manuscript", "fragments", "research"]);
  const manuscript = (await heading(page, "manuscript").boundingBox())!;
  await pickUp(page, heading(page, "fragments"), () => manuscript.y + 2);

  // Mid-drag: the lifted group follows the pointer, the landing slot shows a 2 px accent line, no shadow.
  const lifted = page.locator('.sidebar-groups > [data-drag-state="lifted"]');
  await expect(lifted).toHaveAttribute("data-group", "fragments");
  const line = page.locator("[data-drag-edge]");
  await expect(line).toHaveCount(1);
  const look = await line.evaluate((el) => {
    const after = getComputedStyle(el, "::after");
    return { height: after.height, color: after.backgroundColor, shadow: after.boxShadow };
  });
  const accent = await page.evaluate(() => {
    const probe = document.createElement("span");
    probe.style.color = "var(--accent)";
    document.body.append(probe);
    const c = getComputedStyle(probe).color;
    probe.remove();
    return c;
  });
  expect(look).toEqual({ height: "2px", color: accent, shadow: "none" });
  expect(await lifted.evaluate((el) => getComputedStyle(el).boxShadow)).toBe("none");
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/group-drag-${process.env.N4_SCHEME ?? "light"}.png` });

  await page.mouse.up();
  await expect(page.locator("[data-drag-state]")).toHaveCount(0);
  expect(await groupNames(page)).toEqual(["fragments", "manuscript", "research"]);
  await expect(page.locator(".save-status")).toHaveText("Saved", { timeout: 10_000 });
  await page.reload();
  await expect(page.getByRole("textbox", { name: "Writing editor" })).toBeVisible();
  expect(await groupNames(page)).toEqual(["fragments", "manuscript", "research"]);
});

test("dragging an entry below its sibling reorders the manuscript and persists", async ({ page }) => {
  await createProject(page, "Entry drag fixture");
  await addSection(page, "Second section");
  const first = await entryTitles(page);
  expect(first).toHaveLength(2);
  const rows = page.locator('[data-group="manuscript"] .entry-row');
  const last = (await rows.nth(1).boundingBox())!;
  await pickUp(page, rows.nth(0), () => last.y + last.height - 2);
  await expect(page.locator('.entry-row[data-drag-state="lifted"]')).toHaveCount(1);
  await expect(page.locator(".entry-row[data-drag-edge]")).toHaveCount(1);
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/entry-drag-${process.env.N4_SCHEME ?? "light"}.png` });
  await page.mouse.up();
  expect(await entryTitles(page)).toEqual([first[1], first[0]]);
  await expect(page.locator(".save-status")).toHaveText("Saved", { timeout: 10_000 });
  await page.reload();
  await expect(page.getByRole("textbox", { name: "Writing editor" })).toBeVisible();
  expect(await entryTitles(page)).toEqual([first[1], first[0]]);
});

test("a drag that ends on its own slot, or is cancelled with Escape, changes nothing", async ({ page }) => {
  await createProject(page, "Cancel fixture");
  await addSection(page, "Second section");
  const before = await entryTitles(page);
  const rows = page.locator('[data-group="manuscript"] .entry-row');
  const last = (await rows.nth(1).boundingBox())!;
  await pickUp(page, rows.nth(0), () => last.y + last.height - 2);
  await page.keyboard.press("Escape");
  await page.mouse.up();
  await expect(page.locator("[data-drag-state]")).toHaveCount(0);
  expect(await entryTitles(page)).toEqual(before);
});

test("a press that barely moves is still a click", async ({ page }) => {
  await createProject(page, "Click fixture");
  await addSection(page, "Second section");
  const row = page.locator('[data-group="manuscript"] .entry-row').nth(0);
  const box = (await row.boundingBox())!;
  await page.mouse.move(box.x + 40, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + 42, box.y + box.height / 2 + 2);
  await page.mouse.up();
  await expect(row).toHaveClass(/selected/);
});

test("the arrow buttons still reorder groups and entries from the keyboard", async ({ page }) => {
  await createProject(page, "Arrow fixture");
  await addSection(page, "Second section");
  const before = await entryTitles(page);
  await page.getByRole("button", { name: `Move ${before[0]} down` }).focus();
  await page.keyboard.press("Enter");
  expect(await entryTitles(page)).toEqual([before[1], before[0]]);
  await heading(page, "manuscript").hover();
  await page.getByRole("button", { name: "Move Manuscript down" }).click();
  expect(await groupNames(page)).toEqual(["fragments", "manuscript", "research"]);
});

test("under reduced motion, rows that step aside do not animate", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await createProject(page, "Reduced motion fixture");
  await addSection(page, "Second section");
  const rows = page.locator('[data-group="manuscript"] .entry-row');
  const last = (await rows.nth(1).boundingBox())!;
  await pickUp(page, rows.nth(0), () => last.y + last.height - 2);
  const shifted = page.locator('.entry-row[data-drag-state="shifted"]');
  await expect(shifted).toHaveCount(1);
  expect(await shifted.evaluate((el) => getComputedStyle(el).transitionDuration)).toBe("0s");
  await page.mouse.up();
});

test("without reduced motion, the shifted row animates transform only", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await createProject(page, "Motion fixture");
  await addSection(page, "Second section");
  const rows = page.locator('[data-group="manuscript"] .entry-row');
  const last = (await rows.nth(1).boundingBox())!;
  await pickUp(page, rows.nth(0), () => last.y + last.height - 2);
  const shifted = page.locator('.entry-row[data-drag-state="shifted"]');
  await expect(shifted).toHaveCount(1);
  expect(await shifted.evaluate((el) => getComputedStyle(el).transitionProperty)).toBe("transform");
  await page.mouse.up();
});

test("a press released outside the row does not leave the row armed", async ({ page }) => {
  await createProject(page, "Stray release fixture");
  await addSection(page, "Second section");
  const before = await entryTitles(page);
  const row = page.locator('[data-group="manuscript"] .entry-row').nth(0);
  const box = (await row.boundingBox())!;
  const editor = (await page.getByRole("textbox", { name: "Writing editor" }).boundingBox())!;
  const y = box.y + 6;
  await page.mouse.move(box.x + 40, y);
  await page.mouse.down();
  await page.mouse.move(editor.x + editor.width / 2, y, { steps: 6 });
  await page.mouse.up();
  // Button is up: crossing the row lower down must not lift it.
  await page.mouse.move(box.x + 40, box.y + box.height - 4, { steps: 6 });
  await page.mouse.move(box.x + 44, box.y + box.height - 2, { steps: 3 });
  await expect(page.locator("[data-drag-state]")).toHaveCount(0);
  await page.mouse.click(box.x + 40, box.y + box.height - 2);
  expect(await entryTitles(page)).toEqual(before);
});
