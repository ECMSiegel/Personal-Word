import { test, expect, type Page } from "@playwright/test";

// T314 (LP T10): a Dropdown inside a <label> must stay closed after a mouse pick.
async function newProject(page: Page, title: string) {
  await page.goto("/");
  await page.getByRole("button", { name: "Start new project" }).click();
  await page.getByRole("button", { name: "Blank", exact: true }).click();
  await page.getByLabel("Project title").fill(title);
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByRole("toolbar", { name: "Formatting" })).toBeVisible();
}

/** Mouse-pick the option at `index`; the list must stay closed afterwards. */
async function mousePick(page: Page, trigger: ReturnType<Page["getByRole"]>, index: number) {
  await trigger.click();
  const options = page.getByRole("option");
  await expect(options.first()).toBeVisible();
  await page.waitForTimeout(400); // reveal animation
  const option = options.nth(index);
  const text = ((await option.innerText()) ?? "").trim();
  await option.click();
  await page.waitForTimeout(700); // close animation, and any re-open
  await expect(page.getByRole("option")).toHaveCount(0);
  await expect(trigger).toContainText(text);
  await expect(trigger).toHaveAttribute("aria-expanded", "false");
}

// OB4: the Projects-page Sort is the sort menu (Sort by / Direction / Folders), which stays open
// after a pick on purpose and closes with Escape; the pick must still show on the trigger.
test("Projects-page Sort shows the pick, stays open, and closes with Escape", async ({ page }) => {
  await newProject(page, "T10 sort");
  await page.getByRole("button", { name: "Projects", exact: true }).click();
  await expect(page.locator(".library")).toBeVisible();
  const sort = page.getByRole("button", { name: "Sort projects" });
  await sort.click();
  const menu = page.getByRole("menu", { name: "Sort projects" });
  await expect(menu).toBeVisible();
  await page.waitForTimeout(400); // reveal animation
  await menu.getByRole("menuitemradio", { name: "Words", exact: true }).click();
  await expect(sort).toContainText("Words");
  await expect(menu).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(menu).toHaveCount(0);
  await expect(sort).toHaveAttribute("aria-expanded", "false");
});

test("Read manuscript Font stays closed after a mouse pick", async ({ page }) => {
  await newProject(page, "T10 read");
  await page.getByRole("button", { name: "Read manuscript", exact: true }).click();
  const font = page.locator(".reader-options").getByRole("button", { name: "Font", exact: true });
  await expect(font).toBeVisible();
  await mousePick(page, font, 1);
});

test("Export typeface stays closed after a mouse pick", async ({ page }) => {
  await newProject(page, "T10 export");
  await page.locator(".export-menu-button").click();
  await page.getByRole("menuitem", { name: "Export settings..." }).click();
  const typeface = page.getByRole("button", { name: "Export typeface", exact: true });
  await expect(typeface).toBeVisible();
  await mousePick(page, typeface, 1);
});

test("keyboard choice still closes the list and returns focus to the trigger", async ({ page }) => {
  await newProject(page, "T10 keys");
  await page.locator(".export-menu-button").click();
  await page.getByRole("menuitem", { name: "Export settings..." }).click();
  const typeface = page.getByRole("button", { name: "Export typeface", exact: true });
  await typeface.focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("option").first()).toBeVisible();
  await page.waitForTimeout(400);
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("Enter");
  await page.waitForTimeout(700);
  await expect(page.getByRole("option")).toHaveCount(0);
  await expect(typeface).toBeFocused();
});
