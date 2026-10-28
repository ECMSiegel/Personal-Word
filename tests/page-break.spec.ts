import { test, expect } from "@playwright/test";
import JSZip from "jszip";

async function createBlankProject(page: any, title: string) {
  await page.getByRole("button", { name: "Start new project" }).click();
  await page.getByRole("button", { name: "Blank", exact: true }).click();
  await page.getByLabel("Project title").fill(title);
  await page.getByRole("button", { name: "Save", exact: true }).click();
}

async function toolbarButton(page: any, name: string) {
  const button = page.getByRole("button", { name, exact: true });
  if (!(await button.isVisible())) {
    await page.getByRole("button", { name: "More formatting", exact: true }).click();
  }
  return button;
}

test("Shift+Enter inserts an exported page break while Cmd+Enter stays soft", async ({ page }) => {
  await page.goto("/");
  await createBlankProject(page, "Page break keys");

  const editor = page.getByRole("textbox", { name: "Writing editor" });
  await editor.fill("Before the break.");
  await editor.press("End");
  await page.keyboard.press("Shift+Enter");
  await page.keyboard.type("After the break.");

  await expect(editor.locator(".manual-page-break")).toHaveCount(1);
  await expect(editor.locator(":scope > p")).toHaveCount(2);
  await expect(editor.locator(":scope > p").first()).toHaveText("Before the break.");
  await expect(editor.locator(":scope > p").last()).toHaveText("After the break.");

  await (await toolbarButton(page, "Page view")).click();
  await expect(page.getByLabel("Page count")).toContainText("2");

  await editor.locator(":scope > p").last().click();
  await page.keyboard.press("End");
  await page.keyboard.press("ControlOrMeta+Enter");
  await expect(editor.locator(".manual-page-break")).toHaveCount(1);
  // ProseMirror appends its own caret placeholder after a break; only the
  // real hard break counts here.
  await expect(
    editor.locator("br:not(.ProseMirror-trailingBreak)"),
  ).toHaveCount(1);

  await page.locator(".group-title").filter({ hasText: /^Settings$/ }).click();
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export DOCX", exact: true }).click();
  const download = await downloadPromise;
  const stream = await download.createReadStream();
  const chunks: Buffer[] = [];
  for await (const chunk of stream!) chunks.push(Buffer.from(chunk));
  const archive = await JSZip.loadAsync(Buffer.concat(chunks));
  const document = await archive.file("word/document.xml")!.async("string");
  expect(document.match(/<w:pageBreakBefore(?:\s[^>]*)?\/>/g) ?? []).toHaveLength(1);
});

// Page view and the exports only honour top-level page breaks, so inside a
// wrapping block (list item, block quote) Shift+Enter declines and keeps its
// soft-break behaviour, like a table cell. No break is nested in the block.
for (const [name, markdown] of [
  ["a list item", "- "],
  ["a block quote", "> "],
] as const) {
  test(`Shift+Enter in ${name} stays a soft break and page view and DOCX agree`, async ({ page }) => {
    await page.goto("/");
    await createBlankProject(page, "Page break wrapped");

    const editor = page.getByRole("textbox", { name: "Writing editor" });
    await editor.click();
    await page.keyboard.type(`${markdown}Inside`);
    await page.keyboard.press("Shift+Enter");
    await page.keyboard.type("Still inside");

    await expect(editor.locator(".manual-page-break")).toHaveCount(0);
    await expect(
      editor.locator("br:not(.ProseMirror-trailingBreak)"),
    ).toHaveCount(1);

    await (await toolbarButton(page, "Page view")).click();
    await expect(page.getByLabel("Page count")).toContainText("1");

    await page.locator(".group-title").filter({ hasText: /^Settings$/ }).click();
    const downloadPromise = page.waitForEvent("download");
    await page.getByRole("button", { name: "Export DOCX", exact: true }).click();
    const download = await downloadPromise;
    const stream = await download.createReadStream();
    const chunks: Buffer[] = [];
    for await (const chunk of stream!) chunks.push(Buffer.from(chunk));
    const archive = await JSZip.loadAsync(Buffer.concat(chunks));
    const document = await archive.file("word/document.xml")!.async("string");
    expect(document.match(/<w:pageBreakBefore(?:\s[^>]*)?\/>/g) ?? []).toHaveLength(0);
  });
}
