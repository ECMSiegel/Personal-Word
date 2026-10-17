import { test, expect } from "@playwright/test";

async function create(page: any, title: string, template = "Blank") {
  await page.getByRole("button", { name: "Start new project" }).click();
  await page.getByRole("button", { name: template, exact: true }).click();
  await page.getByLabel("Project title").fill(title);
  await page.getByRole("button", { name: "Save", exact: true }).click();
}

async function toolbarButton(page: any, name: string) {
  const button = page.getByRole("button", { name, exact: true });
  if (!(await button.count()))
    await page.getByRole("button", { name: "More formatting" }).click();
  return button;
}

test("footnote text appears at the bottom of the page and is editable there", async ({
  page,
}) => {
  await page.goto("/");
  await create(page, "Footnote display");
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
  await page
    .getByRole("button", { name: "Close research", exact: true })
    .click();

  const area = page.locator(".footnote-area");
  await expect(area).toContainText("A supporting note.");
  await area.locator(".footnote-body").click();
  await page.getByLabel("Footnote 1 text").fill("Edited note.");
  await page.getByLabel("Footnote 1 text").press("Escape");
  await expect(area).toContainText("Edited note.");

  await (await toolbarButton(page, "Page view")).click();
  const block = page
    .locator(".page-footnotes")
    .filter({ hasText: "Edited note." });
  await expect(block).toHaveCount(1);
  const paper = await page.locator(".editor-paper").boundingBox();
  const box = await block.boundingBox();
  expect(paper).not.toBeNull();
  expect(box).not.toBeNull();
  // The first page is 1056px tall at 100% zoom; notes belong in its bottom half.
  const offset = box!.y - paper!.y;
  expect(offset).toBeGreaterThan(528);
  expect(offset).toBeLessThan(1056);
});
