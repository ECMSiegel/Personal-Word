import { test, expect } from "@playwright/test";

async function create(page: any, title: string, template = "Blank") {
  await page.getByRole("button", { name: "Start new project" }).click();
  await page.getByRole("button", { name: template, exact: true }).click();
  await page.getByLabel("Project title").fill(title);
  await page.getByRole("button", { name: "Save", exact: true }).click();
}

test.use({ viewport: { width: 1280, height: 800 } });

test("formatting toolbar stays on one row", async ({ page }) => {
  await page.goto("/");
  await create(page, "Toolbar row");
  const toolbar = page.getByRole("toolbar", { name: "Formatting" });
  await expect(toolbar).toBeVisible();
  const box = await toolbar.boundingBox();
  expect(box?.height ?? 999).toBeLessThan(48);
});

test("Tab indents the paragraph and keeps focus in the editor", async ({
  page,
}) => {
  await page.goto("/");
  await create(page, "Indent test");
  const editor = page.getByRole("textbox", { name: "Writing editor" });
  // Exercise the same actual-text pointer entry as the indentation matrix.
  await editor.locator("p").first().click();
  await editor.pressSequentially("Indented paragraph.");
  await editor.press("Home");
  // Browser Home updates the DOM selection before ProseMirror consumes it.
  // Wait for the command's actual selection, not a transient DOM offset.
  await expect
    .poll(() =>
      editor.evaluate((element: any) => ({
        offset: element.editor.state.selection.$from.parentOffset,
        empty: element.editor.state.selection.empty,
        domOffset: window.getSelection()?.anchorOffset,
      })),
    )
    .toEqual({ offset: 0, empty: true, domOffset: 0 });
  await editor.press("Tab");
  await expect(editor).toBeFocused();
  await expect(editor.locator("p").first()).toHaveAttribute(
    "style",
    /text-indent: 0\.5in/,
  );
  await expect(editor.locator("p").first()).not.toHaveAttribute(
    "style",
    /margin-left/,
  );
  await editor.press("Shift+Tab");
  await expect(editor.locator("p").first()).toHaveAttribute(
    "style",
    /text-indent: 0px;/,
  );
});

test("Tab nests a bullet list item", async ({ page }) => {
  await page.goto("/");
  await create(page, "Nested list");
  const editor = page.getByRole("textbox", { name: "Writing editor" });
  await editor.fill("First item");
  await page.getByRole("button", { name: "Bullet list", exact: true }).click();
  await editor.press("End");
  await editor.press("Enter");
  await editor.pressSequentially("Second item");
  await editor.press("Tab");
  await expect(editor.locator("ul ul li")).toHaveCount(1);
  await expect(editor.locator("ul ul li")).toHaveText("Second item");
});

test("Font family dropdown opens from the keyboard and changes the font", async ({
  page,
}) => {
  await page.goto("/");
  await create(page, "Font test");
  const editor = page.getByRole("textbox", { name: "Writing editor" });
  await editor.fill("Typeface sample");
  await editor.press("ControlOrMeta+a");
  const font = page.getByRole("button", { name: "Font family", exact: true });
  await font.focus();
  await font.press("Enter");
  await expect(
    page.getByRole("listbox", { name: "Font family" }),
  ).toBeVisible();
  for (let i = 0; i < 4; i++) await font.press("ArrowDown");
  await font.press("Enter");
  await expect(font).toContainText("Georgia");
  await expect(editor.locator('span[style*="Georgia"]').first()).toHaveText(
    "Typeface sample",
  );
});

const bar = (page: any) => page.getByRole("toolbar", { name: "Formatting" });
const moreRows = (page: any) =>
  page.getByRole("dialog", { name: "More formatting" });

// Groups that are on the bar and also listed in More would be a layout bug.
async function overflowReport(page: any) {
  return bar(page).evaluate((el: HTMLElement) => ({
    clientWidth: el.clientWidth,
    scrollWidth: el.scrollWidth,
    labels: el.hasAttribute("data-labels"),
    barLabels: [
      ...el.querySelectorAll(":scope > .toolbar-group .toolbar-label"),
    ].length,
  }));
}

test("icons only at every width", async ({ page }) => {
  await page.setViewportSize({ width: 2200, height: 900 });
  await page.goto("/");
  await create(page, "Icons only");
  await expect(bar(page)).not.toHaveAttribute("data-labels", /.*/);
  const visibleBarLabels = await bar(page)
    .locator(":scope > .toolbar-group .toolbar-label")
    .evaluateAll((els: HTMLElement[]) =>
      els.filter((el) => getComputedStyle(el).display !== "none").length,
    );
  expect(visibleBarLabels).toBe(0);
  const report = await overflowReport(page);
  expect(report.scrollWidth).toBeLessThanOrEqual(report.clientWidth);
});

test("a narrower format bar shows icons only", async ({ page }) => {
  await page.setViewportSize({ width: 1100, height: 800 });
  await page.goto("/");
  await create(page, "Icon mode");
  await expect(bar(page)).not.toHaveAttribute("data-labels", /.*/);
  const bold = bar(page).getByRole("button", {
    name: "Bold (⌘B)",
    exact: true,
  });
  await expect(bold.locator(".toolbar-label")).toBeHidden();
  const report = await overflowReport(page);
  expect(report.clientWidth).toBeLessThan(1100);
  expect(report.scrollWidth).toBeLessThanOrEqual(report.clientWidth);
});

test("the default window keeps Insert on the bar", async ({ page }) => {
  await page.setViewportSize({ width: 1240, height: 840 });
  await page.emulateMedia({ colorScheme: "light" });
  await page.addInitScript(() => {
    localStorage.setItem(
      "folio.workspace.sidebar",
      JSON.stringify({ width: 270, pinned: true, hover: true }),
    );
  });
  await page.goto("/");
  await create(page, "Insert at default width");
  const toolbar = bar(page);
  const insertImage = toolbar.locator(
    ':scope > .toolbar-group button[aria-label="Insert image"]',
  );
  const insertTable = toolbar.locator(
    ':scope > .toolbar-group button[aria-label="Insert table"]',
  );
  await expect(insertImage).toBeVisible();
  await expect(insertTable).toBeVisible();
  const more = toolbar.getByRole("button", {
    name: "More formatting",
    exact: true,
  });
  await more.click();
  const menu = moreRows(page);
  for (const label of [
    "Decrease indent",
    "Increase indent",
    "Line and paragraph spacing",
    "Page view",
    "Prose check",
    "Page setup",
  ]) {
    await expect(menu.getByRole("button", { name: label })).toBeVisible();
  }
  const report = await overflowReport(page);
  expect(report.scrollWidth).toBeLessThanOrEqual(report.clientWidth);
  await page.keyboard.press("Escape");
  const box = await toolbar.boundingBox();
  expect(box).not.toBeNull();
  const clip = {
    x: box!.x,
    y: box!.y,
    width: box!.width,
    height: box!.height,
  };
  await page.screenshot({
    path: "node_modules/.cache/personal-word-beta/ui3-e1/toolbar-light.png",
    clip,
  });
  await page.emulateMedia({ colorScheme: "dark" });
  await page.screenshot({
    path: "node_modules/.cache/personal-word-beta/ui3-e1/toolbar-dark.png",
    clip,
  });
});

test("More lists labelled rows with shortcut hints and emphasizes the hovered row", async ({
  page,
}) => {
  await page.setViewportSize({ width: 850, height: 600 });
  await page.goto("/");
  await create(page, "More rows");
  await bar(page)
    .getByRole("button", { name: "More formatting", exact: true })
    .click();
  const menu = moreRows(page);
  const bold = menu.getByRole("button", { name: "Bold (⌘B)", exact: true });
  await expect(bold.locator(".toolbar-label")).toHaveText("Bold");
  const shortcut = bold.locator(".popover-shortcut");
  await expect(shortcut).toHaveText("⌘B");
  const rowBox = await bold.boundingBox();
  const keyBox = await shortcut.boundingBox();
  expect(rowBox!.x + rowBox!.width - (keyBox!.x + keyBox!.width)).toBeLessThan(
    16,
  );
  await expect(bold).toHaveAttribute("data-popover-item", "");
  await bold.hover();
  await expect(bold).toHaveAttribute("data-highlighted", "");
  await expect(bold).toHaveCSS("font-weight", "600");
  await bold.click();
  await expect(
    page.getByRole("textbox", { name: "Writing editor" }).locator("p").first(),
  ).toBeVisible();
});

test("a Bold row in More toggles bold", async ({ page }) => {
  await page.setViewportSize({ width: 850, height: 600 });
  await page.goto("/");
  await create(page, "More bold");
  const editor = page.getByRole("textbox", { name: "Writing editor" });
  await editor.fill("Bold me");
  await editor.press("ControlOrMeta+a");
  await bar(page)
    .getByRole("button", { name: "More formatting", exact: true })
    .click();
  await moreRows(page)
    .getByRole("button", { name: "Bold (⌘B)", exact: true })
    .click();
  await expect(editor.locator("strong")).toHaveText("Bold me");
});
