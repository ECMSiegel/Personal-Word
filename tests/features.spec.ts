import { test, expect } from "@playwright/test";
async function create(page: any, title: string, template = "Blank") {
  await page.getByRole("button", { name: "Start new project" }).click();
  await page.getByRole("button", { name: template, exact: true }).click();
  await page.getByLabel("Project title").fill(title);
  await page.getByRole("button", { name: "Save", exact: true }).click();
}
test("projects default startup, tabs, sidebar cards, and durable formatting", async ({
  page,
}) => {
  await page.goto("/");
  await create(page, "Alpha");
  const editor = page.getByRole("textbox", { name: "Writing editor" });
  await editor.fill("A paragraph to preserve.");
  await page.getByRole("button", { name: "Projects", exact: true }).click();
  await create(page, "Beta");
  await page
    .locator(".project-tabs")
    .getByRole("button", { name: "Alpha", exact: true })
    .click();
  await expect(editor).toContainText("A paragraph to preserve.");
  await page.getByRole("button", { name: "Show Manuscript cards" }).click();
  await expect(page.locator(".sidebar-group.cards-view")).toBeVisible();
  await page.reload();
  await expect(page.locator(".library")).toBeVisible();
  await page
    .locator(".project-row")
    .filter({ hasText: "Alpha" })
    .getByRole("button")
    .first()
    .click();
  await expect(editor).toContainText("A paragraph to preserve.");
  await page.screenshot({ path: "test-results/personal-word-workspace.png" });
});
test("research notes, footnote insertion, comments, and export route", async ({
  page,
}) => {
  await page.goto("/");
  await create(page, "Research");
  const editor = page.getByRole("textbox", { name: "Writing editor" });
  await editor.fill("Evidence here.");
  await page
    .locator(".group-title")
    .filter({ hasText: /^Research$/ })
    .click();
  await page.getByRole("button", { name: "Insert footnote at cursor" }).click();
  await page
    .getByLabel("Footnote text", { exact: true })
    .fill("A supporting note.");
  await expect(editor.locator("[data-footnote-id]")).toHaveText("1");
  await page
    .getByRole("button", { name: "Close research", exact: true })
    .click();
  await editor.press("ControlOrMeta+a");
  await page.getByRole("button", { name: "Comment on selection" }).click();
  await page.getByLabel("Note", { exact: true }).fill("Check this claim");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await page
    .locator(".group-title")
    .filter({ hasText: /^Comments$/ })
    .click();
  await expect(
    page.getByText("Check this claim", { exact: true }).last(),
  ).toBeVisible();
  await page
    .locator(".group-title")
    .filter({ hasText: /^Settings$/ })
    .click();
  await expect(page.getByRole("button", { name: "Export DOCX" })).toBeVisible();
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export DOCX" }).click();
  expect((await download).suggestedFilename()).toBe("Research.docx");
});

async function toolbarButton(page: any, name: string) {
  const button = page.getByRole("button", { name, exact: true });
  if (!(await button.count()))
    await page.getByRole("button", { name: "More formatting" }).click();
  return button;
}
test("page layout reflows long paragraphs and preserves undo and formatting", async ({
  page,
}) => {
  await page.goto("/");
  await create(page, "Page layout test");
  const editor = page.getByRole("textbox", { name: "Writing editor" });
  await editor.fill(
    "A long sentence with enough words to flow across paper. ".repeat(300),
  );
  await editor.press("ControlOrMeta+a");
  await page
    .getByRole("button", { name: "Line and paragraph spacing" })
    .click();
  await page.getByRole("button", { name: "Double", exact: true }).click();
  await page.keyboard.press("Escape");
  await (await toolbarButton(page, "Page view")).click();
  await expect(page.getByLabel("Page count")).toContainText(/of [2-9]/);
  await expect
    .poll(() =>
      editor
        .locator("p")
        .first()
        .evaluate((el) => el.getClientRects().length),
    )
    .toBeGreaterThan(1);
  await (await toolbarButton(page, "Page view")).click();
  await editor.fill("Before");
  await page.waitForTimeout(600);
  await editor.press("End");
  await page.keyboard.insertText(" added");
  await (await toolbarButton(page, "Page view")).click();
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(editor).toHaveText("Before");
  await page.screenshot({ path: "test-results/personal-word-pages.png" });
});
