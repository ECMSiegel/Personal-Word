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

test("a wide format bar shows a label beside each icon", async ({ page }) => {
  // At 1600 px (bar 1330) label mode pushes Bold into More; 2200 px (bar
  // 1930) keeps it on the bar. Measured numbers are in the T103 note.
  await page.setViewportSize({ width: 2200, height: 900 });
  await page.goto("/");
  await create(page, "Label mode");
  await expect(bar(page)).toHaveAttribute("data-labels", "");
  const width = await bar(page).evaluate((el: HTMLElement) => el.clientWidth);
  expect(width).toBeGreaterThanOrEqual(1100);
  const bold = bar(page).getByRole("button", {
    name: "Bold (⌘B)",
    exact: true,
  });
  await expect(bold.locator(".toolbar-label")).toBeVisible();
  await expect(bold.locator(".toolbar-label")).toHaveText("Bold");
  expect(
    await bold.evaluate((el) =>
      parseFloat(
        getComputedStyle(el.querySelector(".toolbar-label")!).fontSize,
      ),
    ),
  ).toBe(12);
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

test("crossing the label threshold keeps overflow correct both ways", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1600, height: 900 });
  await page.goto("/");
  await create(page, "Resize toolbar");
  for (const width of [1100, 1600, 1100, 1300, 1600]) {
    await page.setViewportSize({ width, height: 900 });
    await expect
      .poll(async () => {
        const r = await overflowReport(page);
        return (
          r.labels === r.clientWidth >= 1100 && r.scrollWidth <= r.clientWidth
        );
      })
      .toBe(true);
    // No group is both on the bar and inside More.
    const more = bar(page).getByRole("button", {
      name: "More formatting",
      exact: true,
    });
    if (await more.count()) {
      await more.click();
      const names = await moreRows(page)
        .getByRole("button")
        .evaluateAll((els: HTMLElement[]) =>
          els.map((e) => e.getAttribute("aria-label")),
        );
      await page.keyboard.press("Escape");
      for (const name of names) {
        if (!name) continue;
        await expect(
          bar(page).locator(`:scope > .toolbar-group [aria-label="${name}"]`),
        ).toHaveCount(0);
      }
    }
  }
});

test("More lists labelled rows with shortcut hints and a following highlight", async ({
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
  // The one highlight glides to the hovered row.
  await bold.hover();
  await expect
    .poll(async () => {
      const hl = await menu.locator(".popover-highlight").boundingBox();
      const row = await bold.boundingBox();
      return hl && row
        ? Math.abs(hl.y - row.y) + Math.abs(hl.height - row.height)
        : 99;
    })
    .toBeLessThan(2);
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
