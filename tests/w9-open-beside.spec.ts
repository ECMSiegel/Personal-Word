import { test, expect, type Page } from "@playwright/test";

// W9 B4: Open beside replaces the pane last used. With a split open, an entry
// target goes to the focused pane (select); with no split open the behaviour is
// unchanged (beside the active entry). test/split.test.ts covers the state
// machine; this spec covers what a user sees in both panes.

async function createProject(page: Page, title: string) {
  await page.getByRole("button", { name: "Start new project" }).click();
  await page.getByRole("button", { name: "Blank", exact: true }).click();
  await page.getByLabel("Project title").fill(title);
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(
    page.getByRole("textbox", { name: "Writing editor", exact: true }),
  ).toBeVisible();
}

async function addSection(page: Page, title: string) {
  await page.getByRole("button", { name: "New section", exact: true }).click();
  await page.getByLabel("Title", { exact: true }).fill(title);
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
}

const row = (page: Page, title: string) =>
  page.locator(".sidebar .entry-main").filter({ hasText: new RegExp("^" + title) });

const paneTitle = (page: Page, side: string) =>
  page.locator(`.split-pane[data-side="${side}"] .split-pane-title`);

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.addInitScript(() =>
    localStorage.setItem("personal-word.restoreTabs", "true"),
  );
});

test("open beside replaces the pane last used (W9 B4)", async ({ page }) => {
  await page.goto("/");
  await createProject(page, "Beside last used fixture");
  await addSection(page, "One");
  await addSection(page, "Two");
  await addSection(page, "Three");

  // Open a split: One on the left, Two beside it, right pane focused.
  await row(page, "One").click();
  await row(page, "Two").click({ modifiers: ["ControlOrMeta"] });
  await expect(page.locator(".split-pane")).toHaveCount(2);
  await expect(paneTitle(page, "right")).toHaveText("Two");

  // Focus the left pane, then open a third entry beside: the LEFT pane is
  // replaced and the right pane keeps its entry.
  await page.getByRole("textbox", { name: "Writing editor", exact: true }).click();
  await row(page, "Three").hover();
  await page.getByRole("button", { name: "Open Three beside" }).click();
  await expect(page.locator(".split-pane")).toHaveCount(2);
  await expect(paneTitle(page, "left")).toHaveText("Three");
  await expect(paneTitle(page, "right")).toHaveText("Two");
  await expect(page.locator('.split-pane[data-side="left"]')).toHaveAttribute("data-focused", "");
  await expect(page.getByRole("button", { name: "Rename section" })).toHaveText("Three");

  // The same from the right pane: it is replaced, the left pane keeps Three.
  await page.getByRole("textbox", { name: "Writing editor, right pane" }).click();
  await expect(page.locator('.split-pane[data-side="right"]')).toHaveAttribute("data-focused", "");
  await row(page, "One").hover();
  await page.getByRole("button", { name: "Open One beside" }).click();
  await expect(paneTitle(page, "right")).toHaveText("One");
  await expect(paneTitle(page, "left")).toHaveText("Three");
  await expect(page.locator('.split-pane[data-side="right"]')).toHaveAttribute("data-focused", "");
  await expect(page.getByRole("button", { name: "Rename section" })).toHaveText("One");

  // A target already shown in the other pane never swaps panes: focus moves.
  await row(page, "Three").hover();
  await page.getByRole("button", { name: "Open Three beside" }).click();
  await expect(paneTitle(page, "left")).toHaveText("Three");
  await expect(paneTitle(page, "right")).toHaveText("One");
  await expect(page.locator('.split-pane[data-side="left"]')).toHaveAttribute("data-focused", "");
  await expect(page.getByRole("button", { name: "Rename section" })).toHaveText("Three");

  // With no split open the old rule holds: the entry opens beside the active
  // one and the right pane takes focus.
  await page.getByRole("button", { name: "Close right pane" }).click();
  await expect(page.locator('.split-pane[data-side="right"]')).toHaveCount(0);
  await row(page, "Two").hover();
  await page.getByRole("button", { name: "Open Two beside" }).click();
  await expect(page.locator(".split-pane")).toHaveCount(2);
  await expect(paneTitle(page, "left")).toHaveText("Three");
  await expect(paneTitle(page, "right")).toHaveText("Two");
  await expect(page.locator('.split-pane[data-side="right"]')).toHaveAttribute("data-focused", "");
});
