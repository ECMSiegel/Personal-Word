import { test, expect, type Page } from "@playwright/test";

// FB11: project tabs reorder by pointer drag and by Option+Left / Option+Right.

async function create(page: Page, title: string) {
  await page.getByRole("button", { name: "Start new project" }).click();
  await page.getByRole("button", { name: "Blank", exact: true }).click();
  await page.getByLabel("Project title").fill(title);
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByRole("textbox", { name: "Writing editor" })).toBeVisible();
  await page.getByRole("button", { name: "Projects", exact: true }).click();
}

const tabNames = (page: Page) =>
  page.locator(".project-tabs .project-tab > button:first-child").allTextContents();

async function threeTabs(page: Page) {
  await page.addInitScript(() => localStorage.setItem("personal-word.restoreTabs", "true"));
  await page.goto("/");
  for (const t of ["Alpha", "Beta", "Gamma"]) await create(page, t);
  expect(await tabNames(page)).toEqual(["Alpha", "Beta", "Gamma"]);
}

test("dragging the third tab before the first reorders the tabs and the order survives a reload", async ({ page }) => {
  await threeTabs(page);
  const first = (await page.locator(".project-tab").nth(0).boundingBox())!;
  const third = page.locator(".project-tab").nth(2);
  const box = (await third.boundingBox())!;
  const y = box.y + box.height / 2;
  await page.mouse.move(box.x + box.width / 2, y);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 - 12, y, { steps: 3 });
  await page.mouse.move(first.x + 4, y, { steps: 10 });
  await expect(page.locator('.project-tabs [data-drag-state="lifted"]')).toHaveCount(1);
  await expect(page.locator(".project-tabs [data-drag-edge]")).toHaveCount(1);
  await page.mouse.up();
  await expect.poll(() => tabNames(page)).toEqual(["Gamma", "Alpha", "Beta"]);
  // The drag ended on a tab title: it must not have selected it.
  await expect(page.locator(".library")).toBeVisible();
  await page.reload();
  await expect.poll(() => tabNames(page)).toEqual(["Gamma", "Alpha", "Beta"]);
});

test("Option+Right and Option+Left move the focused tab and keep focus", async ({ page }) => {
  await threeTabs(page);
  const alpha = page.locator(".project-tab > button:first-child", { hasText: "Alpha" });
  await alpha.focus();
  await page.keyboard.press("Alt+ArrowRight");
  await expect.poll(() => tabNames(page)).toEqual(["Beta", "Alpha", "Gamma"]);
  await expect(alpha).toBeFocused();
  await expect(page.locator(".project-tabs [role=status]")).toContainText("Alpha moved to position 2 of 3");
  await page.keyboard.press("Alt+ArrowLeft");
  await expect.poll(() => tabNames(page)).toEqual(["Alpha", "Beta", "Gamma"]);
  await expect(alpha).toBeFocused();
});

test("a plain click still selects a tab and the close button still closes it", async ({ page }) => {
  await threeTabs(page);
  await page.locator(".project-tab > button:first-child", { hasText: "Beta" }).click();
  await expect(page.getByRole("textbox", { name: "Writing editor" })).toBeVisible();
  await page.getByRole("button", { name: "Close Gamma" }).click();
  await expect.poll(() => tabNames(page)).toEqual(["Alpha", "Beta"]);
});
