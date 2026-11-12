import { test, expect, type Page } from "@playwright/test";

async function createProject(page: Page, title: string) {
  await page.getByRole("button", { name: "Start new project" }).click();
  await page.getByRole("button", { name: "Blank", exact: true }).click();
  await page.getByLabel("Project title").fill(title);
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByRole("textbox", { name: "Writing editor", exact: true })).toBeVisible();
}

async function addSection(page: Page, title: string) {
  await page.getByRole("button", { name: "New section", exact: true }).click();
  await page.getByLabel("Title", { exact: true }).fill(title);
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
}

const row = (page: Page, title: string) =>
  page.locator(".sidebar .entry-main").filter({ hasText: new RegExp("^" + title) });

async function openResearch(page: Page) {
  await page.locator(".group-title").filter({ hasText: /^Research$/ }).click();
}

// Section "Two" holds a footnote marker; section "One" is the one shown first.
async function fixture(page: Page) {
  await page.goto("/");
  await createProject(page, "Used in fixture");
  await addSection(page, "One");
  await addSection(page, "Two");
  await row(page, "Two").click();
  await page.getByRole("textbox", { name: "Writing editor", exact: true }).fill("Second section text.");
  await openResearch(page);
  await page.locator(".research-tabs").getByRole("button", { name: "Notes", exact: true }).click();
  await page.getByRole("button", { name: "Insert footnote at cursor" }).click();
  await page.getByLabel("Footnote 1 text").fill("A cited note");
  await row(page, "One").click();
}

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.addInitScript(() => localStorage.setItem("personal-word.restoreTabs", "true"));
});

test("Used in names the section that holds the footnote, and Go to selects its marker", async ({ page }) => {
  await fixture(page);
  await openResearch(page);
  await page.locator(".research-tabs").getByRole("button", { name: "Notes", exact: true }).click();
  await expect(page.locator(".footnote-where")).toContainText("in Two");

  await page.getByRole("button", { name: "Go to", exact: true }).click();
  await expect(page.locator('.split-pane[data-side="right"]')).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Rename section" })).toHaveText("Two");
  const marker = page.locator(".ProseMirror-selectednode");
  await expect(marker).toHaveCount(1);
  const box = await marker.boundingBox();
  const viewport = page.viewportSize()!;
  expect(box).not.toBeNull();
  expect(box!.y).toBeGreaterThanOrEqual(0);
  expect(box!.y + box!.height).toBeLessThanOrEqual(viewport.height);
  // The Research panel stays open.
  await expect(page.locator(".research-aside")).toBeVisible();
});

test("Go to in a split focuses the pane already showing the section and changes no entry", async ({ page }) => {
  await fixture(page);
  await row(page, "One").click();
  await row(page, "Two").click({ modifiers: ["ControlOrMeta"] });
  await expect(page.locator(".split-pane")).toHaveCount(2);
  await page.getByRole("textbox", { name: "Writing editor", exact: true }).click();
  await expect(page.locator('.split-pane[data-side="left"]')).toHaveAttribute("data-focused", "");

  await openResearch(page);
  await page.locator(".research-tabs").getByRole("button", { name: "Notes", exact: true }).click();
  await page.getByRole("button", { name: "Go to", exact: true }).click();
  await expect(page.locator('.split-pane[data-side="right"]')).toHaveAttribute("data-focused", "");
  await expect(page.locator('.split-pane[data-side="left"] .split-pane-title')).toHaveText("One");
  await expect(page.locator('.split-pane[data-side="right"] .split-pane-title')).toHaveText("Two");
});

test("Go to works from the keyboard", async ({ page }) => {
  await fixture(page);
  await openResearch(page);
  await page.locator(".research-tabs").getByRole("button", { name: "Notes", exact: true }).click();
  const button = page.getByRole("button", { name: "Go to", exact: true });
  await button.focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("button", { name: "Rename section" })).toHaveText("Two");
  await expect(page.locator(".ProseMirror-selectednode")).toHaveCount(1);
});

test("a source's Used in row names the section and Go to works from it", async ({ page }) => {
  await page.goto("/");
  await createProject(page, "Used in source");
  await addSection(page, "One");
  await addSection(page, "Two");
  await row(page, "Two").click();
  await page.getByRole("textbox", { name: "Writing editor", exact: true }).fill("Second section text.");
  await openResearch(page);
  await page.getByRole("button", { name: "Enter manually" }).click();
  await page.getByLabel("Authors", { exact: true }).fill("Ada Example");
  await page.getByLabel("Title", { exact: true }).fill("Lamps and Ledgers");
  await page.getByRole("button", { name: "Cite here", exact: true }).click();
  await row(page, "One").click();
  await openResearch(page);
  await page.locator(".source-item").filter({ hasText: "Lamps and Ledgers" }).locator(".source-toggle").click();

  const usedIn = page.getByRole("region", { name: "Used in" });
  await expect(usedIn.locator(".footnote-where")).toContainText("in Two");
  await usedIn.getByRole("button", { name: "Go to", exact: true }).click();
  await expect(page.getByRole("button", { name: "Rename section" })).toHaveText("Two");
  const marker = page.locator(".ProseMirror-selectednode");
  await expect(marker).toHaveCount(1);
  const box = await marker.boundingBox();
  const viewport = page.viewportSize()!;
  expect(box).not.toBeNull();
  expect(box!.y).toBeGreaterThanOrEqual(0);
  expect(box!.y + box!.height).toBeLessThanOrEqual(viewport.height);
  await expect(page.locator(".research-aside")).toBeVisible();
});
