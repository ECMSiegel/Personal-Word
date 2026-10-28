import { test, expect, type Page } from "@playwright/test";

test.use({ viewport: { width: 1280, height: 800 } });

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

test("right-click opens table actions and Delete table removes the table", async ({
  page,
}) => {
  await page.emulateMedia({ colorScheme: "light" });
  await createProject(page, "Table context menu");
  const editor = page.getByRole("textbox", { name: "Writing editor" });
  await insertTable(page);
  const table = editor.locator("table");
  await expect(table).toBeVisible();

  await table.locator("td").first().click({ button: "right" });
  const menu = tableMenu(page);
  await expect(menu).toBeVisible();
  const box = await menu.boundingBox();
  expect(box).not.toBeNull();
  const clip = {
    x: box!.x,
    y: box!.y,
    width: box!.width,
    height: box!.height,
  };
  await page.screenshot({
    path: "node_modules/.cache/personal-word-beta/ui3-e3/table-menu-light.png",
    clip,
  });
  await page.emulateMedia({ colorScheme: "dark" });
  await page.screenshot({
    path: "node_modules/.cache/personal-word-beta/ui3-e3/table-menu-dark.png",
    clip,
  });
  await page.emulateMedia({ colorScheme: "light" });
  for (const label of [
    "Add row below",
    "Delete row",
    "Add column after",
    "Delete column",
    "Toggle header row",
    "Delete table",
  ]) {
    await expect(menu.getByRole("menuitem", { name: label })).toBeVisible();
  }

  await menu.getByRole("menuitem", { name: "Delete table" }).click();
  await expect(table).toHaveCount(0);

  await insertTable(page);
  await editor.locator("table td").first().click({ button: "right" });
  await expect(menu).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(menu).not.toBeVisible();
  await expect(editor).toBeFocused();
});

test("Shift+F10 opens table actions at the caret", async ({ page }) => {
  await createProject(page, "Keyboard table context menu");
  const editor = page.getByRole("textbox", { name: "Writing editor" });
  await insertTable(page);
  await editor.locator("table td").first().click();
  await page.keyboard.press("Shift+F10");

  const menu = tableMenu(page);
  await expect(menu).toBeVisible();
  await expect(menu.getByRole("menuitem", { name: "Add row below" })).toBeFocused();
  await page.keyboard.press("ArrowDown");
  await expect(menu.getByRole("menuitem", { name: "Delete row" })).toBeFocused();
  await page.keyboard.press("ArrowUp");
  await page.keyboard.press("ArrowUp");
  await expect(menu.getByRole("menuitem", { name: "Delete table" })).toBeFocused();
});

test("right-click outside a table does not open table actions", async ({ page }) => {
  await createProject(page, "Outside table context menu");
  const editor = page.getByRole("textbox", { name: "Writing editor" });
  await editor.fill("Outside the table");
  await editor.press("End");
  await editor.press("Enter");
  await insertTable(page);

  await editor.locator("p").filter({ hasText: "Outside the table" }).click({
    button: "right",
  });
  await expect(tableMenu(page)).toHaveCount(0);
});
