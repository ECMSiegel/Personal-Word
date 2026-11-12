import { test, expect } from "@playwright/test";

test.use({ viewport: { width: 1280, height: 800 } });

test("Page setup: page numbers toggle and Top center position persist and show in Export settings", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Start new project" }).click();
  await page.getByRole("button", { name: "Blank", exact: true }).click();
  await page.getByLabel("Project title").fill("HS8 numbers");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  const bar = page.getByRole("toolbar", { name: "Formatting" });
  await expect(bar).toBeVisible();

  const openSetup = async () => {
    const direct = bar.getByRole("button", { name: "Page setup", exact: true });
    if (await direct.isVisible().catch(() => false)) await direct.click();
    else {
      await bar.getByRole("button", { name: "More formatting", exact: true }).click();
      await page
        .getByRole("button", { name: "Page setup", exact: true })
        .last()
        .click();
    }
    const dialog = page.getByRole("dialog", { name: "Page setup" });
    await expect(dialog).toBeVisible();
    return dialog;
  };

  let dialog = await openSetup();
  const checkbox = dialog.getByRole("checkbox", { name: "Page numbers" });
  await expect(checkbox).toBeChecked();
  await expect(dialog.getByText("Shown in PDF and Word exports.")).toBeVisible();
  // Off hides the position; on shows it again.
  await checkbox.uncheck();
  await expect(dialog.getByRole("button", { name: "Page number position" })).toHaveCount(0);
  await checkbox.check();
  await dialog.getByRole("button", { name: "Page number position" }).click();
  await page.getByRole("option", { name: "Top center" }).click();
  await page.keyboard.press("Escape");

  dialog = await openSetup();
  await expect(
    dialog.getByRole("button", { name: "Page number position" }),
  ).toContainText("Top center");
  await page.keyboard.press("Escape");

  await page.locator(".export-menu-button").click();
  await page.getByRole("menuitem", { name: "Export settings..." }).click();
  await expect(page.getByRole("checkbox", { name: "Page numbers" })).toBeChecked();
  await expect(
    page.getByRole("button", { name: "Page number position" }),
  ).toContainText("Top center");
});
