import { test, expect, type Locator, type Page } from "@playwright/test";

async function createProject(page: Page, title: string) {
  await page.addInitScript(() =>
    localStorage.setItem("personal-word.restoreTabs", "true"),
  );
  await page.goto("/");
  await page.getByRole("button", { name: "Start new project" }).click();
  await page.getByRole("button", { name: "Blank", exact: true }).click();
  await page.getByLabel("Project title").fill(title);
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(
    page.getByRole("textbox", { name: "Writing editor" }),
  ).toBeVisible();
}

async function dragAcross(page: Page, locator: Locator) {
  const textBox = await locator.evaluate((element) => {
    const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
    const textNode = walker.nextNode();
    if (!textNode?.textContent) return null;
    const range = document.createRange();
    range.setStart(textNode, 0);
    range.setEnd(textNode, textNode.textContent.length);
    const rect = range.getClientRects()[0];
    return rect
      ? { x: rect.x, y: rect.y + rect.height / 2, width: rect.width }
      : null;
  });
  expect(textBox).not.toBeNull();
  const inset = Math.min(1, textBox!.width / 10);
  await page.mouse.move(textBox!.x + inset, textBox!.y);
  await page.mouse.down();
  await page.mouse.move(
    textBox!.x + textBox!.width - inset,
    textBox!.y,
    { steps: 12 },
  );
  await page.mouse.up();
}

async function selectedText(page: Page, selector: string) {
  return page.evaluate((targetSelector) => {
    const target = document.querySelector(targetSelector);
    const selection = window.getSelection();
    if (!target || !selection || selection.isCollapsed) return null;
    const range = selection.getRangeAt(0);
    return {
      text: selection.toString(),
      anchorInside: target.contains(selection.anchorNode),
      focusInside: target.contains(selection.focusNode),
      intersects: range.intersectsNode(target),
    };
  }, selector);
}

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
});

test("dragging across plain sidebar brand text does not select chrome", async (
  { page },
  testInfo,
) => {
  await createProject(page, "Sidebar selection fixture");
  await dragAcross(page, page.locator(".sidebar .brand"));
  await page.screenshot({
    path: testInfo.outputPath("sidebar-selection-light.png"),
    fullPage: true,
  });
  await page.emulateMedia({ colorScheme: "dark" });
  await page.screenshot({
    path: testInfo.outputPath("sidebar-selection-dark.png"),
    fullPage: true,
  });
  expect(await selectedText(page, ".sidebar .brand")).toBeNull();
});

test("search, rename, editor, and prose preview text remain selectable", async ({
  page,
}) => {
  await createProject(page, "Sidebar editable fixture");

  const search = page.getByRole("textbox", { name: "Search project" });
  await search.fill("Synthetic query");
  await search.focus();
  await search.press("ControlOrMeta+A");
  const searchSelection = await search.evaluate((el: HTMLInputElement) => [
    el.selectionStart,
    el.selectionEnd,
    el.value.length,
  ]);
  expect(searchSelection).toEqual([0, "Synthetic query".length, "Synthetic query".length]);
  await search.pressSequentially("Replacement query");
  await expect(search).toHaveValue("Replacement query");
  await search.fill("");

  await page.getByRole("button", { name: "Rename section" }).click();
  const title = page.getByLabel("Title", { exact: true });
  await title.fill("Temporary section title");
  await title.press("ControlOrMeta+A");
  const titleSelection = await title.evaluate((el: HTMLInputElement) => [
    el.selectionStart,
    el.selectionEnd,
    el.value.length,
  ]);
  expect(titleSelection).toEqual([
    0,
    "Temporary section title".length,
    "Temporary section title".length,
  ]);
  await title.pressSequentially("Renamed synthetic section");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.locator(".entry-main").first()).toContainText(
    "Renamed synthetic section",
  );

  const editor = page.getByRole("textbox", { name: "Writing editor" });
  await editor.fill("Synthetic manuscript selection text.");
  await editor.focus();
  await editor.press("ControlOrMeta+A");
  const editorSelection = await page.evaluate(() => {
    const editorNode = document.querySelector(
      '[contenteditable="true"]',
    );
    const selection = window.getSelection();
    return {
      text: selection?.toString() ?? "",
      anchorInside: editorNode?.contains(selection?.anchorNode ?? null) ?? false,
      focusInside: editorNode?.contains(selection?.focusNode ?? null) ?? false,
    };
  });
  expect(editorSelection).toEqual({
    text: "Synthetic manuscript selection text.",
    anchorInside: true,
    focusInside: true,
  });
  await editor.pressSequentially("Replacement manuscript prose.");
  await expect(editor).toContainText("Replacement manuscript prose.");

  await editor.fill("Synthetic preview prose stays selectable.");
  const manuscriptGroup = page
    .locator(".sidebar-group")
    .filter({ has: page.getByRole("button", { name: "Manuscript", exact: true }) });
  await manuscriptGroup.hover();
  await page.getByRole("button", { name: "Show Manuscript cards" }).click();
  const preview = page.locator(".sidebar .entry-preview").first();
  await expect(preview).toContainText("Synthetic preview prose");
  await dragAcross(page, preview);
  const previewSelection = await selectedText(page, ".sidebar .entry-preview");
  expect(previewSelection?.text).toContain("Synthetic preview prose");
  expect(previewSelection?.anchorInside && previewSelection?.focusInside).toBe(
    true,
  );
  expect(await preview.evaluate((element) => element.closest(".entry-row")?.draggable)).toBe(
    true,
  );

  await page.getByRole("button", { name: "New section", exact: true }).click();
  await page.getByLabel("Title", { exact: true }).fill("Second preview section");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  const manuscriptRows = manuscriptGroup.locator(".entry-row");
  await expect(manuscriptRows).toHaveCount(2);
  await manuscriptRows.nth(0).dragTo(manuscriptRows.nth(1));
  await expect(manuscriptRows.first()).toContainText("Second preview section");
});

test("sidebar drag, resize, collapse, pin, and keyboard controls still work", async ({
  page,
}) => {
  await createProject(page, "Sidebar controls fixture");

  await page.getByRole("button", { name: "New section", exact: true }).click();
  await page.getByLabel("Title", { exact: true }).fill("Second section");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await page.locator(".entry-row").nth(1).dragTo(page.locator(".entry-row").nth(0));
  await expect(page.locator(".entry-main").first()).toContainText(
    "Second section",
  );
  await page.reload();
  await expect(page.locator(".entry-main").first()).toContainText(
    "Second section",
  );

  const groups = page.locator(".sidebar-group");
  const fragments = groups.filter({
    has: page.getByRole("button", { name: "Fragments", exact: true }),
  });
  const manuscript = groups.filter({
    has: page.getByRole("button", { name: "Manuscript", exact: true }),
  });
  await fragments.locator(".group-heading").dragTo(manuscript);
  await expect(page.locator(".sidebar-groups > .sidebar-group").first()).toContainText(
    "Fragments",
  );
  await page.reload();
  await expect(page.locator(".sidebar-groups > .sidebar-group").first()).toContainText(
    "Fragments",
  );

  const manuscriptAfterMove = page
    .locator(".sidebar-group")
    .filter({ has: page.getByRole("button", { name: "Manuscript", exact: true }) });
  const collapse = manuscriptAfterMove.getByRole("button", {
    name: "Hide Manuscript",
    exact: true,
  });
  await collapse.focus();
  await collapse.press("Enter");
  await expect(manuscriptAfterMove).toHaveClass(/is-collapsed/);
  await manuscriptAfterMove
    .getByRole("button", { name: "Show Manuscript", exact: true })
    .click();

  const resize = page.getByRole("separator", { name: "Sidebar width" });
  const widthBefore = Number(await resize.getAttribute("aria-valuenow"));
  await resize.focus();
  await resize.press("ArrowRight");
  await expect(resize).toHaveAttribute("aria-valuenow", String(widthBefore + 20));

  await page.getByRole("button", { name: "Unpin sidebar" }).click();
  const showSidebar = page.getByRole("button", { name: "Show sidebar" });
  await expect(showSidebar).toBeVisible();
  await page.mouse.move(700, 400);
  await page.mouse.move(3, 400);
  await expect(page.locator(".sidebar-shell")).toHaveClass(/is-revealed/);
  await page.mouse.move(700, 400);
  await expect(page.locator(".sidebar-shell")).not.toHaveClass(/is-revealed/);
  await showSidebar.click();
  await expect(page.getByRole("button", { name: "Pin sidebar" })).toBeVisible();
  await page.getByRole("button", { name: "Pin sidebar" }).click();
  await expect(page.getByRole("button", { name: "Unpin sidebar" })).toBeVisible();
});
