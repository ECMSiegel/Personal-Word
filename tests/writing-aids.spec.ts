import { test, expect } from "@playwright/test";

async function create(page: any, title: string) {
  await page.getByRole("button", { name: "Start new project" }).click();
  await page.getByRole("button", { name: "Blank", exact: true }).click();
  await page.getByLabel("Project title").fill(title);
  await page.getByRole("button", { name: "Save", exact: true }).click();
}

test.use({ viewport: { width: 1440, height: 900 } });

async function showAids(page: any) {
  const focus = page.getByRole("button", { name: "Focus mode", exact: true });
  if (!(await focus.isVisible().catch(() => false))) {
    const more = page.getByRole("button", { name: "More formatting", exact: true });
    if (await more.isVisible().catch(() => false)) await more.click();
  }
  await expect(focus).toBeVisible({ timeout: 5_000 });
}

test("focus mode dims other paragraphs and the shortcut toggles it", async ({ page }) => {
  await page.goto("/");
  await create(page, "Focused writing");
  const editor = page.getByRole("textbox", { name: "Writing editor" });
  await editor.fill("First paragraph");
  await editor.press("End");
  await editor.press("Enter");
  await editor.pressSequentially("Second paragraph");
  await expect(editor.locator("p")).toHaveCount(2);
  await editor.press("ArrowUp");
  await editor.press("Home");
  await showAids(page);
  await page.getByRole("button", { name: "Focus mode", exact: true }).click();
  await expect(editor.locator("p").nth(1)).toHaveClass(/focus-dim/);
  await editor.press("ControlOrMeta+Shift+F");
  await expect(editor.locator("p").nth(1)).not.toHaveClass(/focus-dim/);
});

test("prose check lists issues and Enter on an issue selects it", async ({ page }) => {
  await page.goto("/");
  await create(page, "Prose review sample");
  const editor = page.getByRole("textbox", { name: "Writing editor" });
  await editor.fill("The the cat.");
  await showAids(page);
  await page.getByRole("button", { name: "Prose check", exact: true }).click();
  await page.getByRole("checkbox", { name: "On", exact: true }).check();
  const issue = page.getByRole("button", { name: /Repeated word: the/ });
  await expect(issue).toBeVisible();
  await issue.focus();
  await issue.press("Enter");
  await expect.poll(() => editor.evaluate((el) => el.ownerDocument.getSelection()?.toString() ?? "")).toBe("the");
});

test("aids stay off for a new session by default", async ({ page }) => {
  await page.goto("/");
  await create(page, "Aids default");
  await showAids(page);
  await expect(page.getByRole("button", { name: "Focus mode", exact: true })).toHaveAttribute("aria-pressed", "false");
  await page.getByRole("button", { name: "Prose check", exact: true }).click();
  await expect(page.getByRole("checkbox", { name: "On", exact: true })).not.toBeChecked();
});
