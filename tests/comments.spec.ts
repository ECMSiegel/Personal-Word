import { expect, test, type Locator, type Page } from "@playwright/test";

async function create(page: Page, title: string) {
  await page.getByRole("button", { name: "Start new project" }).click();
  await page.getByRole("button", { name: "Blank", exact: true }).click();
  await page.getByLabel("Project title").fill(title);
  await page.getByRole("button", { name: "Save", exact: true }).click();
}

async function selectedStartOffset(editor: Locator) {
  return editor.evaluate((root) => {
    const range = window.getSelection()?.getRangeAt(0);
    if (!range) return null;
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    let offset = 0;
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      if (node === range.startContainer) return offset + range.startOffset;
      offset += node.textContent?.length ?? 0;
    }
    return null;
  });
}

// Anchor behavior needs a real edit at paragraph start. Use the installed
// macOS user shortcut there; Home has separate coverage in ci-indent/toolbar.
async function moveToTextblockStart(editor: Locator) {
  const key = await editor.evaluate(() => /Mac|iP(hone|ad|od)/.test(navigator.platform) ? "Control+a" : "Home");
  await editor.press(key);
  await expect.poll(() => editor.evaluate((element: any) => ({
    offset: element.editor.state.selection.$from.parentOffset,
    empty: element.editor.state.selection.empty,
    domOffset: window.getSelection()?.anchorOffset,
  }))).toEqual({ offset: 0, empty: true, domOffset: 0 });
}

test("comment anchors retain the second duplicate, detach on deletion, and reattach by selection", async ({
  page,
}) => {
  const title = "Comment anchor duplicates";
  await page.goto("/");
  await create(page, title);
  const editor = page.getByRole("textbox", { name: "Writing editor" });
  await editor.fill("Echo gap Echo");
  await editor.focus();
  await editor.press("End");
  for (let index = 0; index < 4; index += 1)
    await page.keyboard.press("Shift+ArrowLeft");
  await expect
    .poll(() => editor.evaluate(() => window.getSelection()?.toString() ?? ""))
    .toBe("Echo");
  await page.getByRole("button", { name: "Comment on selection" }).click();
  await page.getByLabel("Note", { exact: true }).fill("Keep the second passage");
  await page.getByRole("button", { name: "Save", exact: true }).click();

  await editor.locator("p").first().click();
  await moveToTextblockStart(editor);
  await page.keyboard.insertText("New ");
  await expect(editor).toContainText("New Echo gap Echo");
  await expect(page.locator(".save-status")).toHaveText("Saved", {
    timeout: 10_000,
  });

  await page.getByRole("button", { name: "Projects", exact: true }).click();
  await page
    .locator(".project-row")
    .filter({ hasText: title })
    .locator("button")
    .first()
    .click();
  const reopenedEditor = page.getByRole("textbox", { name: "Writing editor" });
  await expect(reopenedEditor).toContainText("New Echo gap Echo");
  await page.locator(".group-title").filter({ hasText: /^Comments$/ }).click();
  const comment = page
    .locator("article.feature-item")
    .filter({ hasText: "Keep the second passage" });
  await comment.getByRole("button", { name: "Go to passage" }).click();
  await reopenedEditor.focus();
  await expect.poll(() => selectedStartOffset(reopenedEditor)).toBe(13);
  await expect(reopenedEditor).toContainText("New Echo gap Echo");

  await reopenedEditor.press("Backspace");
  await expect(reopenedEditor).toContainText("New Echo gap ");
  await page.locator(".group-title").filter({ hasText: /^Comments$/ }).click();
  await expect(comment).toContainText("Detached from text");

  await comment.getByRole("button", { name: "Reattach to selection" }).click();
  await expect(reopenedEditor).toBeVisible();
  const attach = page.getByRole("button", { name: "Attach comment to selection" });
  await expect(attach).toBeDisabled();
  // Pointer selection is the primary reattachment journey. Keep keyboard-only
  // recent-focus/Home behavior separate from this exact passage check.
  await reopenedEditor.locator("p").first().click();
  await moveToTextblockStart(reopenedEditor);
  for (let index = 0; index < 4; index += 1)
    await page.keyboard.press("ArrowRight");
  for (let index = 0; index < 4; index += 1)
    await page.keyboard.press("Shift+ArrowRight");
  await expect
    .poll(() => reopenedEditor.evaluate(() => window.getSelection()?.toString() ?? ""))
    .toBe("Echo");
  await expect(attach).toBeEnabled();
  await attach.click();

  await expect(comment).not.toContainText("Detached from text");
  // Returning to Projects flushes the save queue before reopening the persisted
  // project, so the new attachment cannot pass only from the current UI state.
  await page.getByRole("button", { name: "Projects", exact: true }).click();
  await page.locator(".project-row").filter({ hasText: title }).locator("button").first().click();
  if (!(await comment.isVisible()))
    await page.locator(".group-title").filter({ hasText: /^Comments$/ }).click();
  await expect(comment).not.toContainText("Detached from text");
  await comment.getByRole("button", { name: "Go to passage" }).click();
  await reopenedEditor.focus();
  await expect.poll(() => selectedStartOffset(reopenedEditor)).toBe(4);
});

test("multi-paragraph captured quote keeps the citation in its last paragraph across one undo/redo", async ({
  page,
}) => {
  await page.goto("/");
  await create(page, "Multi-paragraph quote");
  const editor = page.getByRole("textbox", { name: "Writing editor" });
  await editor.fill("Opening prose.");
  await page.locator(".group-title").filter({ hasText: /^Research$/ }).click();
  await page.getByRole("button", { name: "Enter manually" }).click();
  await page.getByLabel("Authors", { exact: true }).fill("Avery Example");
  await page.getByLabel("Title", { exact: true }).fill("Quoted Work");
  await page.getByRole("button", { name: "Capture quote" }).click();
  await page.getByRole("button", { name: "Source", exact: true }).click();
  await page.getByRole("option", { name: /Avery Example -- Quoted Work/ }).click();
  const firstParagraph = Array.from({ length: 51 }, (_, index) => `Opening${index}`).join(" ");
  const finalParagraph = Array.from({ length: 51 }, (_, index) => `Ending${index}`).join(" ");
  await page.getByLabel("Quotation").fill(`${firstParagraph}\n\n${finalParagraph}`);
  await page.getByLabel("Page").fill("48");
  await page.getByRole("button", { name: "Save and insert" }).click();

  const quote = editor.locator("blockquote");
  await expect(quote.locator("[data-footnote-id]")).toHaveCount(1);
  await expect(quote.locator("p")).toHaveCount(2);
  await expect(quote.locator("p").first()).toContainText("Opening0");
  const finalQuoteParagraph = quote.locator("p").last();
  await expect(finalQuoteParagraph).toContainText("Ending50");
  await expect(finalQuoteParagraph.locator("[data-footnote-id]")).toHaveCount(1);
  await expect(quote.locator("[data-footnote-id]")).toHaveCount(1);

  await editor.focus();
  await page.keyboard.press(process.platform === "darwin" ? "Meta+z" : "Control+z");
  await expect(editor.locator("blockquote")).toHaveCount(0);
  await expect(editor.locator("[data-footnote-id]")).toHaveCount(0);
  await page.keyboard.press(process.platform === "darwin" ? "Meta+Shift+z" : "Control+Shift+z");
  await expect(editor.locator("blockquote p")).toHaveCount(2);
  await expect(editor.locator("blockquote p").last().locator("[data-footnote-id]")).toHaveCount(1);
});
