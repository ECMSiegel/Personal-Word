import { test, expect, type Page } from "@playwright/test";

async function create(page: Page, title: string) {
  await page.goto("/");
  await page.getByRole("button", { name: "Start new project" }).click();
  await page.getByRole("button", { name: "Blank", exact: true }).click();
  await page.getByLabel("Project title").fill(title);
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByRole("textbox", { name: "Writing editor" })).toBeVisible();
}

for (const mode of ["click", "keyboard"] as const) {
  test(`Snapshot name dialog takes focus at once; Escape closes it and focus returns (${mode})`, async ({ page }) => {
    await create(page, `Snapshot dialog ${mode}`);
    const button = page.getByRole("button", { name: "Snapshot", exact: true });
    const dialog = page.getByRole("dialog");
    for (let round = 0; round < 5; round++) {
      if (mode === "click") await button.click();
      else {
        await button.focus();
        await page.keyboard.press("Enter");
      }
      // No waiting: the first thing the user does is type or press Escape.
      await expect(dialog).toBeVisible();
      expect(await page.evaluate(() => document.activeElement?.closest("[role=dialog]") !== null)).toBe(true);
      await expect(page.getByLabel("Snapshot name")).toBeFocused();
      await page.keyboard.press("Escape");
      await expect(dialog).toHaveCount(0);
      await expect(button).toBeFocused();
    }
  });
}

test("Escape closes the Snapshot name dialog even when focus has left it", async ({ page }) => {
  await create(page, "Snapshot dialog focus lost");
  const button = page.getByRole("button", { name: "Snapshot", exact: true });
  await button.click();
  await expect(page.getByLabel("Snapshot name")).toBeFocused();
  // A click on the dimmed backdrop (or anywhere dead) drops focus to the page.
  await page.mouse.click(5, 450);
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
  expect(await page.evaluate(() => document.activeElement?.closest("[role=dialog]") === null)).toBe(true);
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(button).toBeFocused();
});
