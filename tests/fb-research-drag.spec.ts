import { test, expect, type Locator, type Page } from "@playwright/test";

const sourceTitles = ["Source Alpha", "Source Beta", "Source Gamma"];

async function createProject(page: Page) {
  await page.goto("/");
  await page.getByRole("button", { name: "Start new project" }).click();
  await page.getByRole("button", { name: "Blank", exact: true }).click();
  await page.getByLabel("Project title").fill("Research source reorder fixture");
  await page.getByRole("button", { name: "Save", exact: true }).click();
}

async function openResearch(page: Page) {
  await page.locator(".group-title").filter({ hasText: /^Research$/ }).click();
  await expect(page.locator(".research-panel")).toBeVisible();
}

async function addSource(page: Page, title: string) {
  await page.getByRole("button", { name: "Enter manually", exact: true }).click();
  await page.getByLabel("Authors", { exact: true }).fill("Ada Example");
  await page.getByLabel("Title", { exact: true }).fill(title);
}

async function orderedTitles(rows: Locator) {
  const texts = await rows.allTextContents();
  return texts.map((text) => sourceTitles.find((title) => text.includes(title))).filter(Boolean);
}

async function expectBothOrders(page: Page, expected: string[]) {
  await expect.poll(() => orderedTitles(page.locator(".source-list > .source-item .source-title"))).toEqual(expected);
  await expect.poll(() => orderedTitles(page.locator('.sidebar .entry-sublist[data-list="sources"] .entry-unit'))).toEqual(expected);
}

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.addInitScript(() => localStorage.setItem("personal-word.restoreTabs", "true"));
});

test("research source drag and Option+Down reorder the panel and sidebar and persist", async ({ page }) => {
  await createProject(page);
  await openResearch(page);
  for (const title of sourceTitles) await addSource(page, title);
  await expectBothOrders(page, sourceTitles);

  const panelRows = page.locator(".source-list > .source-item");
  const gammaRow = panelRows.filter({ hasText: "Source Gamma" });
  const gammaToggle = gammaRow.locator("button.source-toggle.row");
  const gammaBodyText = gammaRow.locator(".source-body .citation-preview").first();
  const alphaToggle = panelRows.filter({ hasText: "Source Alpha" }).locator("button.source-toggle.row");
  const bodyFrom = (await gammaBodyText.boundingBox())!;
  const bodyTarget = (await alphaToggle.boundingBox())!;
  await page.mouse.move(bodyFrom.x + bodyFrom.width / 2, bodyFrom.y + bodyFrom.height / 2);
  await page.mouse.down();
  await page.mouse.move(bodyTarget.x + bodyTarget.width / 2, bodyTarget.y + 1, { steps: 8 });
  await page.mouse.up();
  await expectBothOrders(page, sourceTitles);
  await expect(gammaToggle).toHaveAttribute("aria-expanded", "true");

  await gammaToggle.click();
  await expect(gammaToggle).toHaveAttribute("aria-expanded", "false");

  const from = (await gammaToggle.boundingBox())!;
  const to = (await alphaToggle.boundingBox())!;
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
  await page.mouse.down();
  await page.mouse.move(to.x + to.width / 2, to.y + 1, { steps: 8 });
  await page.mouse.up();

  await expectBothOrders(page, ["Source Gamma", "Source Alpha", "Source Beta"]);
  await expect(gammaToggle).toHaveAttribute("aria-expanded", "false");

  await gammaToggle.focus();
  await page.keyboard.press("Alt+ArrowDown");
  await expectBothOrders(page, ["Source Alpha", "Source Gamma", "Source Beta"]);
  await expect(gammaToggle).toBeFocused();
  await expect(page.locator(".source-reorder-status")).toContainText("position 2 of 3");
  await expect(page.getByText("Saved", { exact: true }).first()).toBeVisible();

  await page.reload();
  await openResearch(page);
  await expectBothOrders(page, ["Source Alpha", "Source Gamma", "Source Beta"]);
  const restoredGamma = page.locator(".source-list > .source-item").filter({ hasText: "Source Gamma" });
  const restoredToggle = restoredGamma.locator("button.source-toggle.row");
  await expect(restoredToggle).toHaveAttribute("aria-expanded", "false");
  await restoredToggle.click();
  await expect(restoredGamma.locator(".source-body")).toBeVisible();
});
