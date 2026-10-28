import { test, expect } from "@playwright/test";

const editorOf = (page: import("@playwright/test").Page) =>
  page.getByRole("textbox", { name: "Writing editor" });

async function createProject(
  page: import("@playwright/test").Page,
  title: string,
  template = "Blank",
) {
  await page.addInitScript(() =>
    localStorage.setItem("personal-word.restoreTabs", "true"),
  );
  await page.goto("/");
  await page.getByRole("button", { name: "Start new project" }).click();
  await page.getByRole("button", { name: template, exact: true }).click();
  await page.getByLabel("Project title").fill(title);
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByText("Saved", { exact: true })).toBeVisible();
}

test("renaming from the sidebar title saves on blur and shows one name", async ({
  page,
}) => {
  await createProject(page, "Working title");
  await page.locator(".project-switch").click();
  const input = page.getByLabel("Project title");
  await input.fill("Final title");
  // Clicking away saves the rename (plan A2 step 2).
  await editorOf(page).click();
  await expect(page.locator(".project-switch")).toContainText("Final title");
  // The project name appears once: no second title button in the topbar.
  await expect(page.getByRole("button", { name: "Rename project" })).toHaveCount(
    0,
  );
  await page.reload();
  await expect(page.locator(".project-switch")).toContainText("Final title");
});

test("Escape reverts the rename and returns focus to the title", async ({
  page,
}) => {
  await createProject(page, "Working title");
  await page.locator(".project-switch").click();
  await page.getByLabel("Project title").fill("Renamed draft");
  await page.keyboard.press("Escape");
  await expect(page.locator(".project-switch")).toContainText("Working title");
  await expect(page.locator(".project-switch")).toBeFocused();
});

test("Enter saves the rename and returns focus to the title", async ({
  page,
}) => {
  await createProject(page, "Working title");
  await page.locator(".project-switch").click();
  await page.getByLabel("Project title").fill("Entered title");
  await page.keyboard.press("Enter");
  await expect(page.locator(".project-switch")).toContainText("Entered title");
  await expect(page.locator(".project-switch")).toBeFocused();
});

test("the breadcrumb shows only the section with correct semantics", async ({
  page,
}) => {
  await createProject(page, "Breadcrumb check");
  const breadcrumb = page.locator('nav.breadcrumb[aria-label="Breadcrumb"]');
  await expect(breadcrumb).toBeVisible();
  const items = breadcrumb.locator("ol > li");
  await expect(items).toHaveCount(1);
  await expect(items.first()).toHaveAttribute("aria-current", "page");
  // A fresh project opens in write mode on its first section, so the single
  // item is the section; "Manuscript" is the fallback when no entry is active.
  await expect(items.first()).toContainText("Opening");
  // The project name appears once, above the editor (the tab strip), not here.
  await expect(breadcrumb).not.toContainText("Breadcrumb check");
});
