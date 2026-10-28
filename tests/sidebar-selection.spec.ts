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

test("dragging across plain sidebar heading text does not select chrome", async (
  { page },
  testInfo,
) => {
  await createProject(page, "Sidebar selection fixture");
  await dragAcross(page, page.locator(".sidebar .group-label").first());
  await page.screenshot({
    path: testInfo.outputPath("sidebar-selection-light.png"),
    fullPage: true,
  });
  await page.emulateMedia({ colorScheme: "dark" });
  await page.screenshot({
    path: testInfo.outputPath("sidebar-selection-dark.png"),
    fullPage: true,
  });
  expect(await selectedText(page, ".sidebar .group-label")).toBeNull();
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
  // The preview text stays selectable: a press inside it never lifts the row.
  await expect(preview.locator("xpath=ancestor::*[@data-drag-state]")).toHaveCount(0);

  await page.getByRole("button", { name: "New section", exact: true }).click();
  await page.getByLabel("Title", { exact: true }).fill("Second preview section");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  const manuscriptRows = manuscriptGroup.locator(".entry-row");
  await expect(manuscriptRows).toHaveCount(2);
  await manuscriptRows.nth(0).dragTo(manuscriptRows.nth(1), { sourcePosition: { x: 6, y: 6 } });
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

test("at the 190 px minimum sidebar width every row stays on one line", async ({
  page,
}) => {
  await page.addInitScript(() =>
    localStorage.setItem(
      "folio.workspace.sidebar",
      JSON.stringify({ width: 190, pinned: true, hover: true }),
    ),
  );
  await createProject(page, "Narrow sidebar");
  expect(
    await page.locator(".sidebar").evaluate((el) => el.getBoundingClientRect().width),
  ).toBe(190);
  const rows = await page.evaluate(() => {
    const targets = [
      ...document.querySelectorAll<HTMLElement>(
        ".sidebar .group-title, .sidebar .entry-main, .sidebar .project-switch",
      ),
    ];
    return targets.map((el) => {
      const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
      const tops = new Set<number>();
      for (let node = walker.nextNode(); node; node = walker.nextNode()) {
        if (!node.textContent?.trim()) continue;
        const range = document.createRange();
        range.selectNodeContents(node);
        for (const rect of range.getClientRects()) tops.add(Math.round(rect.top));
      }
      const style = getComputedStyle(el);
      return {
        label: (el.textContent ?? "").trim(),
        kind: el.className,
        lines: tops.size,
        height: Math.round(el.getBoundingClientRect().height),
        font: parseFloat(style.fontSize),
      };
    });
  });
  const labels = rows.map((r) => r.label);
  expect(labels).toContain("Snapshots & history");
  expect(labels).toContain("Narrow sidebar");
  for (const row of rows) {
    expect(row.lines, row.label + " is one line").toBe(1);
    expect(row.font, row.label + " font size").toBeGreaterThanOrEqual(12);
  }
  const titleHeights = new Set(
    rows.filter((r) => r.kind.includes("group-title")).map((r) => r.height),
  );
  expect([...titleHeights], "group title rows share one height").toHaveLength(1);
  const entryHeights = new Set(
    rows.filter((r) => r.kind.includes("entry-main")).map((r) => r.height),
  );
  expect(entryHeights.size).toBeLessThanOrEqual(1);
  const clipped = await page.evaluate(() =>
    ["Manuscript", "Fragments", "Research"].map((name) => {
      const el = [...document.querySelectorAll<HTMLElement>(".sidebar .group-label")].find(
        (e) => e.textContent?.trim() === name,
      );
      return { name, found: !!el, fits: !!el && el.scrollWidth <= el.clientWidth };
    }),
  );
  for (const c of clipped) {
    expect(c.found, c.name + " heading exists").toBe(true);
    expect(c.fits, c.name + " label is not truncated").toBe(true);
  }
  const heading = page.locator(".sidebar .group-heading", {
    has: page.getByRole("button", { name: "Hide Manuscript" }),
  });
  await heading.locator(".group-title").focus();
  const reached: string[] = [];
  for (let i = 0; i < 3; i += 1) {
    await page.keyboard.press("Tab");
    reached.push(
      await page.evaluate(() => document.activeElement?.getAttribute("aria-label") ?? ""),
    );
  }
  expect(reached).toEqual(["Hide Manuscript", "Show Manuscript cards", "New section"]);
  const actions = heading.locator(".group-actions");
  expect(await actions.evaluate((el) => getComputedStyle(el).opacity)).toBe("1");
});

test("bottom rows keep their fixed order and carry no hover actions", async ({ page }) => {
  await createProject(page, "Bottom rows");
  await expect(
    page.locator(".sidebar-bottom-groups .group-label"),
  ).toHaveText([
    "Read manuscript",
    "Comments",
    "Snapshots & history",
    "Settings",
  ]);
  await page
    .locator('.sidebar-bottom-groups [data-group="comments"] .group-heading')
    .hover();
  await expect(page.getByRole("button", { name: "Move Comments up" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "New comment" })).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Show Comments cards" }),
  ).toHaveCount(0);
  await expect(
    page.locator('.sidebar-bottom-groups [data-group="comments"]'),
  ).not.toHaveAttribute("data-drag-index");
  // A top group still offers them.
  await page
    .locator('.sidebar-groups [data-group="manuscript"] .group-heading')
    .hover();
  await expect(
    page.getByRole("button", { name: "Move Manuscript up" }),
  ).toHaveCount(1);
  await expect(page.getByRole("button", { name: "New section" })).toHaveCount(1);
});

test("Move down is disabled on the third top group", async ({ page }) => {
  await createProject(page, "Move limits");
  await page
    .locator('.sidebar-groups [data-group="research"] .group-heading')
    .hover();
  await expect(page.getByRole("button", { name: "Move Research down" })).toBeDisabled();
  await expect(page.getByRole("button", { name: "Move Research up" })).toBeEnabled();
});

test("a hidden feature row leaves the sidebar, survives reload, and stays per project", async ({ page }) => {
  await createProject(page, "Hidden comments");
  await page.locator(".group-title").filter({ hasText: /^Settings$/ }).click();
  const toggle = page.getByLabel("Show Comments");
  await expect(toggle).toBeChecked();
  await toggle.uncheck();
  const commentsRow = page.locator('.sidebar-bottom-groups [data-group="comments"]');
  await expect(commentsRow).toHaveCount(0);
  await page.reload();
  await expect(
    page.locator(".group-title").filter({ hasText: /^Settings$/ }),
  ).toBeVisible();
  await expect(commentsRow).toHaveCount(0);
  // Another project is unaffected. (Create it from the library we are already
  // on: createProject re-navigates, and tab restore would reopen the project.)
  await page.getByRole("button", { name: "Projects", exact: true }).click();
  await expect(page.locator(".library")).toBeVisible();
  await page.getByRole("button", { name: "Start new project" }).click();
  await page.getByRole("button", { name: "Blank", exact: true }).click();
  await page.getByLabel("Project title").fill("Second project");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(
    page.getByRole("textbox", { name: "Writing editor" }),
  ).toBeVisible();
  await expect(
    page.locator('.sidebar-bottom-groups [data-group="comments"]'),
  ).toHaveCount(1);
});
