import { test, expect } from "@playwright/test";

test("system appearance changes live and document progress follows nested scrolling", async ({
  page,
}) => {
  await page.emulateMedia({ colorScheme: "light" });
  await page.goto("/");
  await expect(page).toHaveTitle(/Personal Word/);
  await expect(page.locator(".brand")).toContainText("Personal Word");
  await expect(page.locator(".library")).toHaveCSS(
    "background-color",
    "rgb(245, 245, 247)",
  );
  await page.emulateMedia({ colorScheme: "dark", reducedMotion: "reduce" });
  await expect(page.locator(".library")).toHaveCSS(
    "background-color",
    "rgb(40, 40, 44)",
  );
  await page.getByRole("button", { name: "New writing project" }).click();
  await page.getByLabel("Project title").fill("Appearance check");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.locator(".workspace")).toHaveCSS(
    "background-color",
    "rgb(32, 32, 35)",
  );
  await page
    .getByRole("textbox", { name: "Writing editor" })
    .fill("A paragraph of writing.\n\n".repeat(100));
  await page.locator(".editor-scroll").evaluate((el) => {
    el.scrollTop = el.scrollHeight;
  });
  await expect(page.getByRole("progressbar")).toHaveAttribute(
    "aria-valuenow",
    "100",
  );
  await page.getByRole("button", { name: "New section", exact: true }).click();
  await page.getByLabel("Title", { exact: true }).fill("Second section");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByRole("progressbar")).toHaveAttribute(
    "aria-valuenow",
    "0",
  );
  await page.getByRole("button", { name: "Read manuscript" }).click();
  await page.getByRole("button", { name: "Jump to Second section" }).click();
  await expect
    .poll(() => page.locator(".manuscript-read").evaluate((el) => el.scrollTop))
    .toBeGreaterThan(100);
  await page.screenshot({ path: "test-results/personal-word-dark.png" });
  await page.emulateMedia({ colorScheme: "light" });
  await expect(page.locator(".workspace")).toHaveCSS(
    "background-color",
    "rgb(255, 255, 255)",
  );
  await page.screenshot({ path: "test-results/personal-word-light.png" });
});
