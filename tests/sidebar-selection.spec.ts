import { test, expect, type Locator, type Page } from "@playwright/test";

async function createProject(page: Page, title: string, template = "Blank") {
  await page.addInitScript(() =>
    localStorage.setItem("personal-word.restoreTabs", "true"),
  );
  await page.goto("/");
  await page.getByRole("button", { name: "Start new project" }).click();
  await page.getByRole("button", { name: template, exact: true }).click();
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
    // Wave 6 T6: the word count stays visible at 190 px, and one row paints the
    // title (body size) and the count (small size) on ONE line at different
    // baselines. Tops within 8 px are one visual line; a real wrap puts the
    // second text a full line lower (~15 px line height).
    const textLines = (el: HTMLElement) => {
      const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
      const tops: number[] = [];
      for (let node = walker.nextNode(); node; node = walker.nextNode()) {
        if (!node.textContent?.trim()) continue;
        const range = document.createRange();
        range.selectNodeContents(node);
        for (const rect of range.getClientRects()) tops.push(Math.round(rect.top));
      }
      tops.sort((a, b) => a - b);
      const lines: number[] = [];
      for (const t of tops) {
        const last = lines[lines.length - 1];
        if (last === undefined || t - last > 8) lines.push(t);
      }
      return lines.length;
    };
    return targets.map((el) => {
      const style = getComputedStyle(el);
      return {
        label: (el.textContent ?? "").trim(),
        kind: el.className,
        lines: textLines(el),
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
      return {
        name,
        found: !!el,
        fits: !!el && el.scrollWidth <= el.clientWidth,
        ellipses: !!el && getComputedStyle(el).textOverflow === "ellipsis",
      };
    }),
  );
  for (const c of clipped) {
    expect(c.found, c.name + " heading exists").toBe(true);
    // Wave 6 T6: room is reserved for the in-flow action buttons at every
    // width, so at 190 px a long heading name may ellipsize (one line either
    // way, never overlapping the buttons or the word counts).
    expect(
      c.fits || c.ellipses,
      c.name + " label fits or ellipsizes on one line",
    ).toBe(true);
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
  // Tab order follows the visual order: view toggle, add, then the rightmost chevron.
  expect(reached).toEqual(["Show Manuscript cards", "New section", "Hide Manuscript"]);
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
  // A top group still offers its view toggle and add button (no move arrows since wave 5 A2).
  await page
    .locator('.sidebar-groups [data-group="manuscript"] .group-heading')
    .hover();
  await expect(page.locator('.sidebar button[aria-label^="Move "]')).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Show Manuscript cards" })).toHaveCount(1);
  await expect(page.getByRole("button", { name: "New section" })).toHaveCount(1);
});

test("Option+Down on the last top group leaves the order and says it is already last", async ({ page }) => {
  await createProject(page, "Move limits");
  const names = () =>
    page
      .locator(".sidebar-groups > .sidebar-group")
      .evaluateAll((els) => els.map((el) => el.getAttribute("data-group")));
  const research = page.locator('.sidebar-groups [data-group="research"] .group-title');
  await research.focus();
  await page.keyboard.press("Alt+ArrowDown");
  expect(await names()).toEqual(["manuscript", "fragments", "research"]);
  await expect(page.locator('.sidebar [role="status"]')).toHaveText("Research is already last");
  await page.keyboard.press("Alt+ArrowUp");
  expect(await names()).toEqual(["manuscript", "research", "fragments"]);
  await expect(research).toBeFocused();
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

// UI wave 7: the section holding an open entry has a bold, normal-colour heading;
// rows are never bold and stay dim until hovered, focused, or open.
const PDF_BYTES = Buffer.from("%PDF-1.4\n1 0 obj << /Type /Catalog >> endobj\n%%EOF\n", "ascii");
const groupTitle = (page: Page, id: string) =>
  page.locator(`.sidebar-group[data-group="${id}"] > .group-heading .group-title`);
const entryRow = (page: Page, title: string) =>
  page.locator(".sidebar .entry-row").filter({
    has: page.locator(".entry-main").filter({ hasText: new RegExp("^" + title) }),
  });
async function looks(locator: Locator) {
  return locator.evaluate((el) => {
    const s = getComputedStyle(el);
    return { weight: Number(s.fontWeight), color: s.color, background: s.backgroundColor };
  });
}
async function textColour(page: Page) {
  return page.locator(".sidebar").evaluate((el) => {
    const probe = document.createElement("span");
    probe.style.color = "var(--text)";
    el.appendChild(probe);
    const colour = getComputedStyle(probe).color;
    probe.remove();
    return colour;
  });
}
async function tintColour(page: Page, id: string) {
  return page.locator(`.sidebar-group[data-group="${id}"]`).evaluate((group) => {
    const probe = document.createElement("span");
    probe.style.color = "var(--tint)";
    group.appendChild(probe);
    const colour = getComputedStyle(probe).color;
    probe.remove();
    return colour;
  });
}
async function keepFragment(page: Page, text: string) {
  const editor = page.getByRole("textbox", { name: "Writing editor" }).first();
  await editor.fill(text);
  await editor.press("ControlOrMeta+a");
  await page.getByRole("button", { name: "Keep as fragment" }).click();
}
async function addSection(page: Page, title: string) {
  await page.getByRole("button", { name: "New section", exact: true }).click();
  await page.getByLabel("Title", { exact: true }).fill(title);
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
}
async function expectHeader(page: Page, id: string, open: boolean) {
  const look = await looks(groupTitle(page, id));
  expect(look.background, id + " header has no fill").toBe("rgba(0, 0, 0, 0)");
  expect(await groupTitle(page, id).evaluate((el) => getComputedStyle(el).fontSize), "heading is 13px").toBe("13px");
  if (open) {
    expect(look.weight, id + " header weight").toBeGreaterThanOrEqual(700);
    expect(look.color, id + " header colour").toBe(await textColour(page));
  } else {
    expect(look.weight, id + " header weight").toBeLessThan(600);
    expect(look.color, id + " header colour").toBe(await textColour(page));
  }
}
async function expectEntry(page: Page, title: string, open: boolean) {
  const row = entryRow(page, title);
  const look = await looks(row.locator(".entry-main"));
  expect((await looks(row)).background, title + " row has no fill").toBe("rgba(0, 0, 0, 0)");
  expect(look.background, title + " entry has no fill").toBe("rgba(0, 0, 0, 0)");
  expect(await row.locator(".entry-main").evaluate((el) => getComputedStyle(el).fontSize), "row is 13px").toBe("13px");
  expect(look.weight, title + " row is never bold").toBeLessThan(600);
  if (open) expect(look.color, title + " open row colour").toBe(await textColour(page));
  else expect(look.color, title + " resting row is dim").not.toBe(await textColour(page));
}

test("W7 Plain: active heading is bold normal text; rows stay regular and reveal full colour", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "light" });
  await createProject(page, "Selection rule");
  await addSection(page, "Second section");
  await page.locator('.sidebar-group[data-group="manuscript"] .entry-main').first().click();
  await expect(groupTitle(page, "manuscript")).toHaveCSS("color", "rgb(36, 36, 40)");
  await expect(groupTitle(page, "manuscript")).toHaveCSS("font-weight", "700");
  const first = page.locator('.sidebar-group[data-group="manuscript"] .entry-row').first();
  await expect(first.locator(".entry-main")).toHaveCSS("font-weight", "400");
  await expect(first.locator(".entry-main")).toHaveCSS("color", "rgb(36, 36, 40)");
  await expectHeader(page, "manuscript", true);
  await expectHeader(page, "fragments", false);
  await expectHeader(page, "research", false);
  await expectEntry(page, "Second section", false);
  const dimRow = entryRow(page, "Second section").locator(".entry-main");
  await expect(dimRow).toHaveCSS("color", await page.locator(".sidebar").evaluate((el) => {
    const probe = document.createElement("span"); probe.style.color = "var(--muted)"; el.append(probe);
    const value = getComputedStyle(probe).color; probe.remove(); return value;
  }));
  await dimRow.hover();
  await expect(dimRow).toHaveCSS("color", "rgb(36, 36, 40)");
  await expect(dimRow).toHaveCSS("font-weight", "400");
  await page.mouse.move(900, 450);
  await dimRow.focus();
  await page.keyboard.press("Tab");
  await page.keyboard.press("Shift+Tab");
  await expect(dimRow).toHaveCSS("color", "rgb(36, 36, 40)");
  await expect(dimRow).toHaveCSS("font-weight", "400");

  // Hover reveals color without a real font-weight change; the shared width-neutral emphasis remains.
  // The open row still hovers like every other text control (faux-bold stroke + grow) at its real weight.
  const main = first.locator(".entry-main");
  await main.hover();
  await expect(main).toHaveCSS("transform", /matrix\(1\.04, 0, 0, 1\.04/);
  expect(await main.evaluate((el) => parseFloat(getComputedStyle(el).webkitTextStrokeWidth))).toBeGreaterThan(0);
  await expect(main).toHaveCSS("color", "rgb(36, 36, 40)");
  await expect(main).toHaveCSS("font-weight", "400");
  await page.mouse.down();
  await expect(main).toHaveCSS("color", "rgb(36, 36, 40)");
  await page.mouse.up();
  await page.mouse.move(900, 450);
  // Keyboard focus shows the same emphasis on the selected row.
  await main.focus();
  await page.keyboard.press("Tab");
  await page.keyboard.press("Shift+Tab");
  await expect(main).toBeFocused();
  await expect(main).toHaveCSS("transform", /matrix\(1\.04, 0, 0, 1\.04/);
  expect(await main.evaluate((el) => parseFloat(getComputedStyle(el).webkitTextStrokeWidth))).toBeGreaterThan(0);
  await expect(main).toHaveCSS("color", "rgb(36, 36, 40)");
  await expect(main).toHaveCSS("font-weight", "400");
  // Keyboard selection: Enter on the other row moves the open state.
  const second = entryRow(page, "Second section").locator(".entry-main");
  await second.focus();
  await page.keyboard.press("Enter");
  await expectEntry(page, "Second section", true);
  await expect(first.locator(".entry-main")).toHaveCSS("font-weight", "400");
  await expectHeader(page, "manuscript", true);

  // A destination page (Settings) shows no entry, so no section header is lit.
  await page.locator(".group-title").filter({ hasText: /^Settings$/ }).click();
  await expectHeader(page, "manuscript", false);
  await expectEntry(page, "Second section", false);
});

for (const [label, heading] of [
  ["Comments", /^Comments/],
  ["Read manuscript", /^Read manuscript/],
] as const)
  test(`W7 Plain: nothing in the three sections is lit while ${label} is on screen`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: "light" });
    await createProject(page, "Nothing lit " + label, "Chicago");
    await addSection(page, "Second section");
    await page.locator('.sidebar-group[data-group="manuscript"] .entry-main').first().click();
    await expectHeader(page, "manuscript", true);
    await page.locator(".group-title").filter({ hasText: heading }).click();
    await expectHeader(page, "manuscript", false);
    await expectHeader(page, "fragments", false);
    await expectHeader(page, "research", false);
    await expectEntry(page, "Second section", false);
  });

test("W7 Plain: a clicked Bibliography row goes dim once the pointer leaves, and nothing in the three sections is lit", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "light" });
  await createProject(page, "Nothing lit Bibliography", "Chicago");
  await addSection(page, "Second section");
  await page.locator('.sidebar-group[data-group="manuscript"] .entry-main').first().click();
  await expectHeader(page, "manuscript", true);
  await entryRow(page, "Bibliography").locator(".entry-main").click();
  await page.mouse.move(900, 450);
  await expectHeader(page, "manuscript", false);
  await expectHeader(page, "fragments", false);
  await expectHeader(page, "research", false);
  await expectEntry(page, "Second section", false);
  await expectEntry(page, "Bibliography", false);
});

test("W7 resize handles stay unpainted on hover and retain keyboard focus cues", async ({ page }) => {
  await createProject(page, "Resize edge appearance");
  const sidebarHandle = page.locator(".sidebar-resize");
  await expect(sidebarHandle).toHaveCount(1);
  await sidebarHandle.hover();
  await expect(sidebarHandle).toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
  await sidebarHandle.focus();
  await page.keyboard.press("Tab");
  await page.keyboard.press("Shift+Tab");
  await expect(sidebarHandle).toHaveCSS("outline-style", "solid");
  await page.locator(".group-title").filter({ hasText: /^Research$/ }).click();
  const panelHandle = page.locator(".aside-resizer");
  await expect(panelHandle).toHaveCount(1);
  await panelHandle.hover();
  await expect(panelHandle).toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
  await panelHandle.focus();
  await page.keyboard.press("Tab");
  await page.keyboard.press("Shift+Tab");
  await expect(panelHandle).toHaveCSS("outline-style", "solid");
  await page.locator(".group-title").filter({ hasText: /^Manuscript$/ }).click();
  await keepFragment(page, "Resize fragment");
  await entryRow(page, "Resize fragment").locator(".entry-main").click({ modifiers: ["ControlOrMeta"] });
  const splitHandle = page.locator(".split-divider");
  await expect(splitHandle).toHaveCount(1);
  // The divider keeps its resting 1 px line on hover and drag: only the cursor changes.
  const restingLine = await splitHandle.evaluate((el) => getComputedStyle(el).backgroundImage);
  expect(restingLine).toContain("linear-gradient");
  await splitHandle.hover();
  await expect(splitHandle).toHaveCSS("background-image", restingLine);
  await expect(splitHandle).toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
  await page.mouse.down();
  await expect(splitHandle).toHaveCSS("background-image", restingLine);
  await page.mouse.up();
  await splitHandle.focus();
  await page.keyboard.press("Tab");
  await page.keyboard.press("Shift+Tab");
  await expect(splitHandle).toHaveCSS("outline-style", "solid");
});

for (const palette of ["plain", "color"] as const)
  for (const scheme of ["light", "dark"] as const)
    test(`B1 ${palette} ${scheme}: split panes light their own sections; a source PDF lights Research`, async ({ page }, testInfo) => {
      await page.addInitScript((p) => {
        if (p === "color")
          localStorage.setItem(
            "folio.workspace.appearance",
            JSON.stringify({ theme: "system", palette: "color", sections: { manuscript: "blue", fragments: "green", research: "orange" } }),
          );
      }, palette);
      await page.emulateMedia({ colorScheme: scheme });
      await createProject(page, "Split selection " + palette + " " + scheme);
      if (palette === "color") await expect(page.locator("html")).toHaveAttribute("data-palette", "color");
      else await expect(page.locator("html")).not.toHaveAttribute("data-palette", /.*/);
      await keepFragment(page, "Beside words");
      await addSection(page, "Chapter two");
      await addSection(page, "Chapter three");
      await entryRow(page, "Chapter two").locator(".entry-main").click();
      await expectHeader(page, "manuscript", true);
      await expectHeader(page, "fragments", false);
      await expectEntry(page, "Chapter two", true);
      await expectEntry(page, "Chapter three", false);
      if (palette === "color") {
        // Icons keep the section tint; the heading text remains normal-colour.
        const tint = await tintColour(page, "manuscript");
        await expect(entryRow(page, "Chapter two").locator(".entry-main svg")).toHaveCSS("color", tint);
        await expect(groupTitle(page, "manuscript").locator("svg")).toHaveCSS("color", tint);
        await expect(groupTitle(page, "manuscript")).toHaveCSS("color", await textColour(page));
      }
      await page.locator(".sidebar").screenshot({ path: testInfo.outputPath(`sidebar-${palette}-${scheme}-single.png`) });

      // Fragment beside: both active headings bold, both open rows regular, nothing else.
      await entryRow(page, "Beside words").locator(".entry-main").click({ modifiers: ["ControlOrMeta"] });
      await expect(page.locator(".split-pane")).toHaveCount(2);
      await expectHeader(page, "manuscript", true);
      await expectHeader(page, "fragments", true);
      await expectHeader(page, "research", false);
      await expectEntry(page, "Chapter two", true);
      await expectEntry(page, "Beside words", true);
      await expectEntry(page, "Chapter three", false);
      await page.locator(".sidebar").screenshot({ path: testInfo.outputPath(`sidebar-${palette}-${scheme}-split.png`) });
      await page.screenshot({ path: testInfo.outputPath(`window-${palette}-${scheme}-split.png`) });

      // Focusing the right pane keeps both lit (the open state is not the focus).
      await page.locator('.split-pane[data-side="right"] .ProseMirror').click();
      await expectHeader(page, "manuscript", true);
      await expectEntry(page, "Chapter two", true);
      await expectEntry(page, "Beside words", true);

      // A source PDF beside: Research heading lit, its PDF row regular; Fragments goes dim again.
      await page.locator('.split-pane[data-side="left"] .ProseMirror').click();
      await page.locator(".group-title").filter({ hasText: /^Research$/ }).click();
      await page.getByRole("button", { name: "Enter manually" }).click();
      await page.getByLabel("Title", { exact: true }).fill("Lit source");
      const source = page.locator(".source-item").filter({ hasText: "Lit source" });
      await source.locator('.source-pdf-field input[type="file"]').setInputFiles({
        name: "lit.pdf",
        mimeType: "application/pdf",
        buffer: PDF_BYTES,
      });
      await source.getByRole("button", { name: "Open beside" }).click();
      await expect(page.locator('iframe[title="PDF: lit.pdf"]')).toBeVisible();
      await expectHeader(page, "research", true);
      await expectHeader(page, "fragments", false);
      await expectHeader(page, "manuscript", true);
      await expectEntry(page, "lit.pdf", true);
      await expectEntry(page, "Beside words", false);
    });

// UI wave 7 T244: a heading is bold only when its section holds what is on screen.
// A heading click only changes the destination; the fragment stays on screen.
// With a fragment open, clicking the Manuscript heading must not light Manuscript.
test("W7 T244: after the Manuscript heading, a fragment on screen leaves only Fragments bold", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "light" });
  await createProject(page, "Heading lit fixture");
  await keepFragment(page, "Fragment heading words");
  await addSection(page, "Chapter two");
  await entryRow(page, "Fragment heading words").locator(".entry-main").click();
  await groupTitle(page, "manuscript").click();
  await expectHeader(page, "fragments", true);
  await expectHeader(page, "manuscript", false);
  await expectHeader(page, "research", false);
  await expectEntry(page, "Fragment heading words", true);
  await expectEntry(page, "Chapter two", false);
});

// UI wave 6 T6 (REQUEST 9.1, rough edges s, t): at every width the heading's
// action buttons stay in the heading's flow -- never an absolute overlay, never
// backed by a --sidebar fill (the grey box shot 8 shows) -- and never cover a
// label, and the word count survives at the 190 px minimum width.
function t6SidebarAudit() {
  const fillVerdicts: string[] = [];
  const textRects = (el: Element) => {
    const out: { left: number; right: number; top: number; bottom: number }[] = [];
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      if (!n.textContent?.trim()) continue;
      const range = document.createRange();
      range.selectNodeContents(n);
      for (const r of range.getClientRects()) {
        if (r.width > 0 && r.height > 0)
          out.push({ left: r.left, right: r.right, top: r.top, bottom: r.bottom });
      }
    }
    return out;
  };
  for (const heading of document.querySelectorAll<HTMLElement>(".sidebar .group-heading")) {
    const actions = heading.querySelector(".group-actions");
    const label = heading.querySelector(".group-label");
    const name = (label?.textContent ?? heading.className).trim();
    if (!(actions instanceof HTMLElement)) continue;
    const actionsStyle = getComputedStyle(actions);
    if (actionsStyle.display === "none") continue;
    if (actionsStyle.position !== "static")
      fillVerdicts.push(name + ": action row is " + actionsStyle.position + ", not in flow");
    for (let el: HTMLElement | null = actions; el; el = el.parentElement) {
      const bg = getComputedStyle(el).backgroundColor;
      if (bg !== "rgba(0, 0, 0, 0)")
        fillVerdicts.push(name + ": fill " + bg + " on '" + (el.classList[0] || el.tagName) + "'");
      if (el === heading) break;
    }
    // The label truncates with overflow hidden, so only the part inside its box is drawn.
    const box = label?.getBoundingClientRect();
    const rects = label && box
      ? textRects(label).map((t) => ({ ...t, left: Math.max(t.left, box.left), right: Math.min(t.right, box.right) }))
      : [];
    for (const b of actions.querySelectorAll("button")) {
      const r = b.getBoundingClientRect();
      if (r.width <= 0) continue;
      for (const t of rects) {
        const overlaps = !(r.right <= t.left || r.left >= t.right || r.bottom <= t.top || r.top >= t.bottom);
        if (overlaps) fillVerdicts.push(name + ": an action button covers the label text");
      }
    }
  }
  return fillVerdicts;
}

const T6_COLOR_APPEARANCE = {
  theme: "system",
  palette: "color",
  sections: { manuscript: "blue", fragments: "green", research: "orange" },
};

for (const palette of ["plain", "color"] as const)
  for (const width of [190, 240, 270, 390] as const)
    test(`T6 ${palette} @${width}px: heading actions in flow, no fill, clear of labels`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: "light" });
      await page.addInitScript(
        ([pal, w]) => {
          localStorage.setItem(
            "folio.workspace.sidebar",
            JSON.stringify({ width: w, pinned: true, hover: true, floating: false }),
          );
          if (pal === "color")
            localStorage.setItem(
              "folio.workspace.appearance",
              JSON.stringify(T6_COLOR_APPEARANCE),
            );
        },
        [palette, width] as const,
      );
      await createProject(page, "Action placement");
      const sidebar = page.locator(".sidebar");
      expect(
        await sidebar.evaluate((el) => el.getBoundingClientRect().width),
        "sidebar counts its own width",
      ).toBe(width);
      await page
        .locator('.sidebar [data-group="manuscript"] > .group-heading')
        .hover();
      const verdicts = await page.evaluate(t6SidebarAudit);
      expect(verdicts, "every heading audit passes").toEqual([]);
      // UI wave 7 A1: rows carry no word count at any width (the footer keeps it).
      expect(
        await page.locator(".sidebar .entry-main small").count(),
        "no row shows a word count",
      ).toBe(0);
    });

// UI wave 7 follow-up T247: bottom-row spacing, the split icon's gap from the rail, and the
// chevron column. Geometry is measured in the browser, not read from CSS.
test.describe("sidebar row and header geometry (W7 T247)", () => {
  const RAIL_LINE = 16; // .spy-line width: its longest length (magnified), set by scrollspy.css
  const TOKEN_GAP = 8; // --space-2, the gap token between a split icon and the rail

  test("bottom rows sit evenly between their dividers and share one icon and label column", async ({ page }, testInfo) => {
    await createProject(page, "Bottom rows fixture");
    const rows = await page.evaluate(() =>
      Array.from(document.querySelectorAll(".sidebar-bottom-groups .sidebar-group")).map((group) => {
        const label = group.querySelector(".group-label")!.getBoundingClientRect();
        const icon = group.querySelector(".group-title svg")?.getBoundingClientRect() ?? null;
        const box = group.getBoundingClientRect();
        return {
          id: group.getAttribute("data-group"),
          top: box.top,
          labelTop: label.top,
          labelBottom: label.bottom,
          labelLeft: label.left,
          iconLeft: icon ? icon.left : null,
        };
      }),
    );
    expect(rows.length, "four bottom rows").toBe(4);
    // Each divider is the top border (1 px) of rows 2 to 4. Gap above = previous text to line;
    // gap below = line to this row's text. Both must be equal, at every divider.
    const gaps: number[] = [];
    for (let i = 1; i < rows.length; i++) {
      const above = rows[i].top - rows[i - 1].labelBottom;
      const below = rows[i].labelTop - (rows[i].top + 1);
      expect(Math.abs(above - below), `${rows[i].id}: gap above (${above}) equals gap below (${below})`).toBeLessThanOrEqual(0.5);
      gaps.push(above, below);
    }
    expect(Math.max(...gaps) - Math.min(...gaps), "all divider gaps match").toBeLessThanOrEqual(0.5);
    // Settings has no icon and is left out of the shared icon and label columns (owner scope:
    // no new icons). Its divider spacing above is still checked.
    const columned = rows.filter((r) => r.id !== "settings");
    for (const row of columned) expect(row.iconLeft, `${row.id} has an icon`).not.toBeNull();
    const icons = columned.map((r) => r.iconLeft as number);
    const labels = columned.map((r) => r.labelLeft);
    expect(Math.max(...icons) - Math.min(...icons), "icons share one column").toBeLessThanOrEqual(0.5);
    expect(Math.max(...labels) - Math.min(...labels), "labels share one column").toBeLessThanOrEqual(0.5);
    await page.locator(".sidebar-bottom-groups").screenshot({ path: testInfo.outputPath("bottom-rows-light.png") });
    await page.emulateMedia({ colorScheme: "dark" });
    await page.locator(".sidebar-bottom-groups").screenshot({ path: testInfo.outputPath("bottom-rows-dark.png") });
  });

  test("a bottom group's own list stacks below its heading, inside the sidebar", async ({ page }) => {
    await createProject(page, "Bottom lists fixture");
    await page.getByRole("button", { name: "Snapshot", exact: true }).click();
    await page.getByLabel("Snapshot name").fill("A named snapshot");
    await page.getByRole("button", { name: "Save", exact: true }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    const history = page.locator('.sidebar-bottom-groups [data-group="history"]');
    await history.locator(".group-title").click();
    await expect(history.locator(".entry-list .entry-row").first()).toBeVisible();
    const box = await history.evaluate((group) => {
      const heading = group.querySelector(".group-heading")!.getBoundingClientRect();
      const list = group.querySelector(".entry-list")!.getBoundingClientRect();
      return {
        headingBottom: heading.bottom,
        listTop: list.top,
        listRight: list.right,
        sidebarRight: document.querySelector("aside.sidebar")!.getBoundingClientRect().right,
      };
    });
    expect(box.listTop, "list is below its heading").toBeGreaterThanOrEqual(box.headingBottom - 0.5);
    expect(box.listRight, "list stays inside the sidebar").toBeLessThanOrEqual(box.sidebarRight + 0.5);
  });

  test("the split icon keeps one token gap from the rail in every list row", async ({ page }, testInfo) => {
    await createProject(page, "Rail gap fixture");
    await page.getByRole("button", { name: "New section" }).click();
    await page.getByLabel("Title", { exact: true }).fill("A second section with a very long title about the river commissioners");
    await page.getByRole("button", { name: "Save", exact: true }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    const measure = () =>
      page.evaluate(
        ([line]) => {
          const out: { row: string; gap: number }[] = [];
          document.querySelectorAll(".sidebar-groups .spy-rail").forEach((rail) => {
            const railLeft = rail.getBoundingClientRect().right - line;
            rail.closest(".entry-list")!.querySelectorAll(".entry-row").forEach((row) => {
              const glyph = row.querySelector("button.open-beside svg, button.collection-open-beside svg");
              if (!glyph) return;
              out.push({ row: row.textContent ?? "", gap: railLeft - glyph.getBoundingClientRect().right });
            });
          });
          return out;
        },
        [RAIL_LINE],
      );
    const gaps = await measure();
    expect(gaps.length, "at least one list row has a split icon and a rail").toBeGreaterThan(0);
    for (const g of gaps) expect(g.gap, `${g.row}: icon-to-rail gap`).toBeGreaterThanOrEqual(TOKEN_GAP - 0.5);
    const values = gaps.map((g) => g.gap);
    expect(Math.max(...values) - Math.min(...values), "every row has the same gap").toBeLessThanOrEqual(0.5);
    // Hovering a row keeps its split icon visible.
    const firstRow = page.locator(".sidebar-groups .entry-row").filter({ has: page.locator("button.open-beside, button.collection-open-beside") }).first();
    await firstRow.hover();
    const opacity = await firstRow.locator("button.open-beside, button.collection-open-beside").first().evaluate((el) => getComputedStyle(el).opacity);
    expect(opacity, "split icon visible on row hover").toBe("1");
    // A long title ends before the icon instead of running under it.
    const longRow = page.locator(".sidebar-groups .entry-row").filter({ hasText: "river commissioners" });
    await longRow.hover();
    const clear = await longRow.evaluate((row) => {
      const main = row.querySelector(".entry-main")!;
      const pad = parseFloat(getComputedStyle(main).paddingRight);
      return { textEnd: main.getBoundingClientRect().right - pad, icon: row.querySelector("button.open-beside svg")!.getBoundingClientRect().left };
    });
    expect(clear.textEnd, "title stops before the split icon").toBeLessThanOrEqual(clear.icon + 0.5);
    await page.locator(".sidebar-groups").screenshot({ path: testInfo.outputPath("rail-gap-light.png") });
    await page.emulateMedia({ colorScheme: "dark" });
    await page.locator(".sidebar-groups").screenshot({ path: testInfo.outputPath("rail-gap-dark.png") });
  });

  test("section chevrons share one right-hand column, stay rightmost, and ignore the revealed view and add buttons", async ({ page }, testInfo) => {
    await createProject(page, "Chevron column fixture");
    const headers = () =>
      page.evaluate(() =>
        Array.from(document.querySelectorAll(".sidebar-groups .sidebar-group")).map((group) => {
          const heading = group.querySelector(".group-heading")!;
          const chevron = group.querySelector(".group-chevron")?.getBoundingClientRect() ?? null;
          const toggles = Array.from(group.querySelectorAll(".group-actions button")).map((b) => b.getBoundingClientRect());
          return {
            id: group.getAttribute("data-group"),
            lastChild: heading.lastElementChild?.className ?? "",
            chevronRight: chevron ? chevron.right : null,
            chevronLeft: chevron ? chevron.left : null,
            toggleRights: toggles.map((t) => t.right),
            toggleLefts: toggles.map((t) => t.left),
          };
        }),
      );
    const before = await headers();
    expect(before.length, "three list sections").toBe(3);
    for (const h of before) {
      expect(h.lastChild, `${h.id}: chevron is the last item in its header`).toContain("group-chevron");
      expect(h.chevronRight, `${h.id}: has a chevron`).not.toBeNull();
    }
    const rights = before.map((h) => h.chevronRight as number);
    expect(Math.max(...rights) - Math.min(...rights), "chevrons share one right edge").toBeLessThanOrEqual(0.5);
    // Hover the Manuscript header: its view and add buttons appear, and no chevron moves.
    await page.locator('.sidebar-group[data-group="manuscript"] .group-heading').hover();
    const after = await headers();
    expect(after.map((h) => h.chevronRight), "chevrons do not move when toggles show").toEqual(rights);
    const manuscript = after.find((h) => h.id === "manuscript")!;
    for (const left of manuscript.toggleLefts) expect(left, "toggles sit left of the chevron").toBeLessThan(manuscript.chevronLeft!);
    await page.locator(".sidebar-groups").screenshot({ path: testInfo.outputPath("chevrons-light.png") });
    await page.emulateMedia({ colorScheme: "dark" });
    await page.locator('.sidebar-group[data-group="manuscript"] .group-heading').hover();
    await page.locator(".sidebar-groups").screenshot({ path: testInfo.outputPath("chevrons-dark.png") });
  });
});
