import { test, expect } from "@playwright/test";

async function create(page: any, title: string, template = "Blank") {
  await page.getByRole("button", { name: "Start new project" }).click();
  await page.getByRole("button", { name: template, exact: true }).click();
  await page.getByLabel("Project title").fill(title);
  await page.getByRole("button", { name: "Save", exact: true }).click();
}

test.use({ viewport: { width: 1280, height: 800 } });

test("formatting toolbar stays on one row", async ({ page }) => {
  await page.goto("/");
  await create(page, "Toolbar row");
  const toolbar = page.getByRole("toolbar", { name: "Formatting" });
  await expect(toolbar).toBeVisible();
  const box = await toolbar.boundingBox();
  expect(box?.height ?? 999).toBeLessThan(48);
});

test("Tab indents the paragraph and keeps focus in the editor", async ({
  page,
}) => {
  await page.goto("/");
  await create(page, "Indent test");
  const editor = page.getByRole("textbox", { name: "Writing editor" });
  await editor.fill("Indented paragraph.");
  await expect
    .poll(async () => {
      await editor.press("Home");
      return page.evaluate(() => window.getSelection()?.anchorOffset ?? -1);
    })
    .toBe(0);
  await editor.press("Tab");
  await expect(editor).toBeFocused();
  await expect(editor.locator("p").first()).toHaveAttribute(
    "style",
    /text-indent/,
  );
  await editor.press("Shift+Tab");
  await expect(editor.locator("p").first()).not.toHaveAttribute(
    "style",
    /text-indent: 0\.5in/,
  );
});

test("Tab nests a bullet list item", async ({ page }) => {
  await page.goto("/");
  await create(page, "Nested list");
  const editor = page.getByRole("textbox", { name: "Writing editor" });
  await editor.fill("First item");
  await page.getByRole("button", { name: "Bullet list", exact: true }).click();
  await editor.press("End");
  await editor.press("Enter");
  await editor.pressSequentially("Second item");
  await editor.press("Tab");
  await expect(editor.locator("ul ul li")).toHaveCount(1);
  await expect(editor.locator("ul ul li")).toHaveText("Second item");
});

test("Font family dropdown opens from the keyboard and changes the font", async ({
  page,
}) => {
  await page.goto("/");
  await create(page, "Font test");
  const editor = page.getByRole("textbox", { name: "Writing editor" });
  await editor.fill("Typeface sample");
  await editor.press("ControlOrMeta+a");
  const font = page.getByRole("button", { name: "Font family", exact: true });
  await font.focus();
  await font.press("Enter");
  await expect(
    page.getByRole("listbox", { name: "Font family" }),
  ).toBeVisible();
  for (let i = 0; i < 4; i++) await font.press("ArrowDown");
  await font.press("Enter");
  await expect(font).toContainText("Georgia");
  await expect(editor.locator('span[style*="Georgia"]').first()).toHaveText(
    "Typeface sample",
  );
});
