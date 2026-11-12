import { test, expect, type Page } from "@playwright/test";

async function createProject(page: Page, title: string) {
  await page.goto("/");
  await page.getByRole("button", { name: "Start new project" }).click();
  await page.getByRole("button", { name: "Blank", exact: true }).click();
  await page.getByLabel("Project title").fill(title);
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByText("Saved", { exact: true })).toBeVisible();
}

const exportButton = (page: Page) =>
  page.locator(".topbar").getByRole("button", { name: "Export", exact: true });
const menu = (page: Page) => page.getByRole("menu", { name: "Export" });

test("header has an Export menu next to Snapshot, in the planned order", async ({ page }) => {
  await createProject(page, "Menu order");
  await expect(page.getByRole("button", { name: "Export portable project" })).toHaveCount(0);
  await expect(page.locator(".topbar").getByRole("button", { name: "Snapshot" })).toBeVisible();
  await exportButton(page).click();
  await expect(menu(page)).toBeVisible();
  await expect(menu(page).getByRole("menuitem")).toHaveText([
    /^Word \(\.docx\)$/,
    /^PDF$/,
    /^Markdown$/,
    /^Markdown with images \(\.zip\)$/,
    /^Plain text$/,
    /^Export settings\.\.\.$/,
    /^Complete project \(\.json\)$/,
  ]);
  await expect(menu(page).locator("hr, [role=separator]")).toHaveCount(1);
});

test("Plain text triggers one download named for the project", async ({ page }) => {
  await createProject(page, "Plain export");
  await page.getByRole("textbox", { name: "Writing editor" }).fill("Some text to export.");
  await exportButton(page).click();
  const downloaded = page.waitForEvent("download");
  await menu(page).getByRole("menuitem", { name: "Plain text" }).click();
  const download = await downloaded;
  expect(download.suggestedFilename()).toBe("Plain export.txt");
  await expect(menu(page)).toHaveCount(0);
});

test("Export settings shows Settings with the Export document section in view", async ({ page }) => {
  await createProject(page, "Settings jump");
  await exportButton(page).click();
  await menu(page).getByRole("menuitem", { name: "Export settings..." }).click();
  await expect(page.getByRole("heading", { name: "Project settings" })).toBeVisible();
  const heading = page.getByRole("heading", { name: "Export document", exact: true });
  await expect(heading).toBeVisible();
  await expect(heading).toBeInViewport();
});

test("Cmd+Shift+E opens the menu with focus on the first item; keyboard works", async ({ page }) => {
  await createProject(page, "Keyboard export");
  const editor = page.getByRole("textbox", { name: "Writing editor" });
  await editor.click();
  await page.keyboard.press("Meta+Shift+e");
  await expect(menu(page)).toBeVisible();
  await expect(menu(page).getByRole("menuitem").first()).toBeFocused();
  await page.keyboard.press("ArrowDown");
  await expect(menu(page).getByRole("menuitem").nth(1)).toBeFocused();
  await page.keyboard.press("ArrowUp");
  await expect(menu(page).getByRole("menuitem").first()).toBeFocused();
  await page.keyboard.press("End");
  await expect(menu(page).getByRole("menuitem").last()).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(menu(page)).toHaveCount(0);
  await expect(exportButton(page)).toBeFocused();
  // Enter on an item chooses it.
  await page.keyboard.press("Meta+Shift+e");
  await expect(menu(page).getByRole("menuitem").first()).toBeFocused();
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("ArrowDown");
  await expect(menu(page).getByRole("menuitem", { name: "Plain text" })).toBeFocused();
  const downloaded = page.waitForEvent("download");
  await page.keyboard.press("Enter");
  expect((await downloaded).suggestedFilename()).toBe("Keyboard export.txt");
});

test("the command palette lists Export...", async ({ page }) => {
  await createProject(page, "Palette export");
  await page.getByRole("textbox", { name: "Writing editor" }).click();
  await page.keyboard.press("Meta+Shift+p");
  const palette = page.getByRole("dialog", { name: "Command palette" });
  await expect(palette).toBeVisible();
  await page.keyboard.type("export");
  await expect(palette.getByRole("option", { name: /Export\.\.\./ })).toHaveCount(1);
  await page.keyboard.press("Enter");
  await expect(menu(page)).toBeVisible();
});

test("a 60-character title at 1100 px does not wrap or overlap the header", async ({ page }) => {
  await page.setViewportSize({ width: 1100, height: 700 });
  await createProject(page, "A".repeat(60));
  const boxes = await page.evaluate(() => {
    const top = document.querySelector(".topbar")!;
    const r = (el: Element) => el.getBoundingClientRect();
    const right = top.lastElementChild!;
    const kids = [...right.children].map((c) => r(c));
    return {
      topHeight: r(top).height,
      kids: kids.map((k) => ({ l: k.left, r: k.right, t: k.top, b: k.bottom })),
      rightRight: r(right).right,
      topRight: r(top).right,
    };
  });
  expect(boxes.topHeight).toBeLessThanOrEqual(66);
  for (let i = 1; i < boxes.kids.length; i++)
    expect(boxes.kids[i].l).toBeGreaterThanOrEqual(boxes.kids[i - 1].r - 0.5);
  const heights = boxes.kids.map((k) => k.b - k.t);
  expect(Math.max(...heights)).toBeLessThan(40);
  expect(boxes.rightRight).toBeLessThanOrEqual(boxes.topRight);
  await expect(exportButton(page)).toBeVisible();
});
