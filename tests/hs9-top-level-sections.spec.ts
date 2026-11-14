import { test, expect, type Page } from "@playwright/test";

// HS9: custom top-level sections beside Manuscript. Their entries are part of the manuscript,
// in sidebar order (Read and exports); they can be renamed, deleted (entries go to Manuscript)
// and entries can be moved into them. Built-in headings can be renamed and restored.

async function createProject(page: Page, title: string) {
  await page.addInitScript(() => localStorage.setItem("personal-word.restoreTabs", "true"));
  await page.goto("/");
  await page.getByRole("button", { name: "Start new project" }).click();
  await page.getByRole("button", { name: "Blank", exact: true }).click();
  await page.getByLabel("Project title").fill(title);
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByRole("textbox", { name: "Writing editor" })).toBeVisible();
}

const custom = (page: Page) => page.locator('.sidebar-groups [data-group-kind="manuscript"]:not([data-group="manuscript"])');
const manuscript = (page: Page) => page.locator('.sidebar-groups [data-group="manuscript"]');
const rows = (section: ReturnType<typeof custom>) => section.locator(".entry-row .entry-main > span").allTextContents();
const menu = (page: Page) => page.getByRole("menu");
const item = (page: Page, name: string) => menu(page).getByRole("menuitem", { name, exact: true });
const editor = (page: Page) => page.getByRole("textbox", { name: "Writing editor" });

async function nameIt(page: Page, title: string) {
  await page.getByLabel("Title", { exact: true }).fill(title);
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
}
async function saved(page: Page) {
  await expect(page.getByText("Saved", { exact: true })).toBeVisible({ timeout: 10_000 });
}
async function plainText(page: Page) {
  await page.locator(".topbar").getByRole("button", { name: "Export", exact: true }).click();
  const downloaded = page.waitForEvent("download");
  await page.getByRole("menu", { name: "Export" }).getByRole("menuitem", { name: "Plain text" }).click();
  const stream = await (await downloaded).createReadStream();
  const chunks: Buffer[] = [];
  for await (const chunk of stream) chunks.push(chunk as Buffer);
  return Buffer.concat(chunks).toString("utf8");
}
const inOrder = (text: string, parts: string[]) => {
  const at = parts.map((p) => text.indexOf(p));
  expect(at.every((n) => n >= 0), `all of ${parts.join(", ")} in output`).toBe(true);
  expect(at).toEqual([...at].sort((a, b) => a - b));
};

test("add, fill, rename, reload, read, export, move into, delete a top-level section", async ({ page }) => {
  await createProject(page, "Top sections");
  await editor(page).fill("Opening body");

  // Add a top-level section with the visible control; its "+" is always shown.
  await page.getByRole("button", { name: "Add header", exact: true }).click();
  await nameIt(page, "Part two");
  await expect(custom(page).locator(".group-title")).toHaveText("Part two");
  await expect(custom(page).getByRole("button", { name: "New section in Part two" })).toBeVisible();
  for (const title of ["Alpha", "Beta"]) {
    await custom(page).getByRole("button", { name: "New section in Part two" }).click();
    await nameIt(page, title);
    await editor(page).fill(title + " body");
  }
  expect(await rows(custom(page))).toEqual(["Alpha", "Beta"]);
  expect(await rows(manuscript(page))).toEqual(["Opening"]);
  // Only the section holding the open entry lights.
  await expect(custom(page)).toHaveAttribute("data-open", "");
  await expect(manuscript(page)).not.toHaveAttribute("data-open", "");

  // Rename through the heading menu, then survive a reload.
  await custom(page).locator(".group-title").click({ button: "right" });
  await item(page, "Rename").click();
  await nameIt(page, "Appendix");
  await expect(custom(page).locator(".group-title")).toHaveText("Appendix");
  await saved(page);
  await page.reload();
  await expect(custom(page).locator(".group-title")).toHaveText("Appendix");
  expect(await rows(custom(page))).toEqual(["Alpha", "Beta"]);

  // A new Manuscript entry is read and exported before the custom section's entries.
  await page.getByRole("button", { name: "New section", exact: true }).click();
  await nameIt(page, "Gamma");
  await editor(page).fill("Gamma body");
  expect(await rows(manuscript(page))).toEqual(["Opening", "Gamma"]);
  await saved(page);
  await page.getByRole("button", { name: "Read manuscript", exact: true }).click();
  await expect(page.locator(".read-prose").first()).toBeVisible();
  inOrder((await page.locator(".read-prose").allInnerTexts()).join("\n"), ["Opening body", "Gamma body", "Alpha body", "Beta body"]);
  await page.locator('[data-group="manuscript"] .entry-main').filter({ hasText: "Opening" }).click();
  inOrder(await plainText(page), ["Opening body", "Gamma body", "Alpha body", "Beta body"]);

  // Move Gamma into Appendix from its row's More button (the row menu); it goes last there.
  const gamma = manuscript(page).locator(".entry-row").filter({ hasText: "Gamma" });
  await gamma.hover();
  await gamma.getByRole("button", { name: "More actions for Gamma" }).click();
  await expect(item(page, "Rename")).toBeVisible();
  await item(page, "Move to Appendix").click();
  expect(await rows(custom(page))).toEqual(["Alpha", "Beta", "Gamma"]);
  expect(await rows(manuscript(page))).toEqual(["Opening"]);
  inOrder(await plainText(page), ["Opening body", "Alpha body", "Beta body", "Gamma body"]);

  // Move the section above Manuscript from its heading menu: Read and export order follow.
  for (let i = 0; i < 3; i++) {
    await custom(page).locator(".group-title").click({ button: "right" });
    await item(page, "Move up").click();
  }
  await expect(page.locator(".sidebar-groups > .sidebar-group").first()).toHaveAttribute("data-group-kind", "manuscript");
  await expect(page.locator(".sidebar-groups > .sidebar-group").first()).not.toHaveAttribute("data-group", "manuscript");
  inOrder(await plainText(page), ["Alpha body", "Beta body", "Gamma body", "Opening body"]);

  // Delete the section: confirm, safety snapshot, entries land under Manuscript.
  await custom(page).locator(".group-title").click({ button: "right" });
  await item(page, "Delete").click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toContainText("Its entries move to Manuscript");
  await dialog.getByRole("button", { name: "Delete header" }).click();
  await expect(custom(page)).toHaveCount(0);
  // The section sat above Manuscript, so its entries keep their place: first.
  expect(await rows(manuscript(page))).toEqual(["Alpha", "Beta", "Gamma", "Opening"]);
  await saved(page);
  await page.getByRole("button", { name: "Snapshots & history", exact: true }).click();
  await expect(page.locator(".versions").getByRole("button", { name: /Before deleting header “Appendix”/ })).toBeVisible();
});

test("rename Manuscript and restore the default; empty sidebar space and palette add a section", async ({ page }) => {
  await createProject(page, "Rename built-in");
  const title = manuscript(page).locator(".group-title");
  await title.click({ button: "right" });
  expect(await menu(page).getByRole("menuitem").allTextContents()).toEqual([
    "Collapse", "Move up", "Move down", "New section", "Add header", "Rename",
  ]);
  await item(page, "Rename").click();
  await nameIt(page, "Chapters");
  await expect(title).toHaveText("Chapters");
  await title.click({ button: "right" });
  await item(page, "Rename").click();
  await nameIt(page, "Manuscript");
  await expect(title).toHaveText("Manuscript");
  // A renamed built-in heading offers "Reset name" (the name dialog refuses an empty name).
  await title.click({ button: "right" });
  await item(page, "Rename").click();
  await nameIt(page, "Chapters");
  await title.click({ button: "right" });
  expect(await menu(page).getByRole("menuitem").allTextContents()).toEqual([
    "Collapse", "Move up", "Move down", "New section", "Add header", "Rename", "Reset name",
  ]);
  await item(page, "Reset name").click();
  await expect(title).toHaveText("Manuscript");
  await title.click({ button: "right" });
  await expect(item(page, "Reset name")).toHaveCount(0);
  await page.keyboard.press("Escape");

  // Right-click on empty space in the sections area.
  const groups = page.locator(".sidebar-groups");
  const box = (await groups.boundingBox())!;
  await page.mouse.click(box.x + 20, box.y + box.height - 4, { button: "right" });
  await item(page, "Add header").click();
  await nameIt(page, "From space");
  await expect(custom(page).locator(".group-title")).toHaveText("From space");

  // Command palette.
  await page.keyboard.press("ControlOrMeta+Shift+p");
  await page.keyboard.type("Add header");
  await page.keyboard.press("Enter");
  await nameIt(page, "From palette");
  await expect(custom(page).locator(".group-title")).toHaveText(["From space", "From palette"]);
});

test("the row More button shifts nothing and overlaps neither the title nor the split icon", async ({ page }) => {
  await createProject(page, "More button");
  await page.getByRole("button", { name: "New section", exact: true }).click();
  await nameIt(page, "Second section with a rather long title that runs on");
  for (const view of ["list", "cards"]) {
    if (view === "cards") await manuscript(page).locator(":scope > .group-heading").hover();
    if (view === "cards") await manuscript(page).getByRole("button", { name: "Show Manuscript cards" }).click();
    const rowsHere = manuscript(page).locator(".entry-row");
    const first = rowsHere.nth(0);
    const nextBefore = (await rowsHere.nth(1).boundingBox())!;
    await first.locator(".entry-main").hover();
    const more = first.getByRole("button", { name: /^More actions for / });
    await expect(more).toBeVisible();
    expect(await rowsHere.nth(1).boundingBox()).toEqual(nextBefore);
    const second = rowsHere.nth(1);
    await second.locator(".entry-main").hover();
    // The title's text box: its border box less any room it reserves on the right.
    const title = await second.locator(".entry-main > span").evaluate((el) => {
      const r = el.getBoundingClientRect();
      return { x: r.left, width: r.width - parseFloat(getComputedStyle(el).paddingRight) };
    });
    const m = (await second.getByRole("button", { name: /^More actions for / }).boundingBox())!;
    const split = (await second.locator(".open-beside").boundingBox())!;
    expect(m.x, view + ": More starts after the title").toBeGreaterThanOrEqual(title.x + title.width - 0.5);
    expect(split.x, view + ": split icon starts after More").toBeGreaterThanOrEqual(m.x + m.width - 0.5);
  }
});

test("restoring a snapshot taken before a heading move: sidebar order equals Read and export order", async ({ page }) => {
  await createProject(page, "Restore order");
  await editor(page).fill("Opening body");
  await page.getByRole("button", { name: "Add header", exact: true }).click();
  await nameIt(page, "Part two");
  await custom(page).getByRole("button", { name: "New section in Part two" }).click();
  await nameIt(page, "Alpha");
  await editor(page).fill("Alpha body");
  await saved(page);
  await page.locator(".topbar").getByRole("button", { name: "Snapshot", exact: true }).click();
  await page.getByLabel("Snapshot name").fill("V1");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  for (let i = 0; i < 3; i++) {
    await custom(page).locator(".group-title").click({ button: "right" });
    await item(page, "Move up").click();
  }
  await saved(page);
  await page.getByRole("button", { name: "Snapshots & history", exact: true }).click();
  await page.locator(".versions").getByRole("button", { name: /V1/ }).first().click();
  await page.getByRole("button", { name: "Restore this version" }).click();
  await expect(page.getByRole("button", { name: "Restore this version" })).toHaveCount(0);
  const headings = await page
    .locator('.sidebar-groups > .sidebar-group[data-group-kind="manuscript"] .group-title')
    .allTextContents();
  const exported = await plainText(page);
  const byExport = [...headings].sort((a, b) =>
    exported.indexOf(a === "Manuscript" ? "Opening body" : "Alpha body") -
    exported.indexOf(b === "Manuscript" ? "Opening body" : "Alpha body"));
  expect(headings, "sidebar heading order vs plain-text export order").toEqual(byExport);
  await page.getByRole("button", { name: "Read manuscript", exact: true }).click();
  const read = (await page.locator(".read-prose").allInnerTexts()).join("\n");
  const byRead = [...headings].sort((a, b) =>
    read.indexOf(a === "Manuscript" ? "Opening body" : "Alpha body") -
    read.indexOf(b === "Manuscript" ? "Opening body" : "Alpha body"));
  expect(headings, "sidebar heading order vs Read order").toEqual(byRead);
});

test("hovering a card with body text moves no other card", async ({ page }) => {
  await createProject(page, "Card hover");
  const words = (n: number) => Array.from({ length: n }, (_, i) => ["alpha", "bravo", "charlie", "delta"][i % 4]).join(" ");
  await editor(page).fill(words(3));
  for (let n = 4; n <= 14; n++) {
    await page.getByRole("button", { name: "New section", exact: true }).click();
    await nameIt(page, "S" + n);
    await editor(page).fill(words(n));
  }
  await saved(page);
  await manuscript(page).locator(":scope > .group-heading").hover();
  await manuscript(page).getByRole("button", { name: "Show Manuscript cards" }).click();
  const cards = manuscript(page).locator(".entry-row");
  const count = await cards.count();
  for (let i = 0; i < count - 1; i++) {
    await page.mouse.move(900, 450);
    // Measured against the hovered card, so a scroll into view is not counted as a shift.
    const gap = async () => {
      const [a, b] = [(await cards.nth(i).boundingBox())!, (await cards.nth(i + 1).boundingBox())!];
      return { dy: b.y - a.y, height: b.height, ownHeight: a.height };
    };
    await cards.nth(i + 1).scrollIntoViewIfNeeded();
    const before = await gap();
    await cards.nth(i).locator(".entry-main").hover();
    await expect(cards.nth(i).getByRole("button", { name: /^More actions for / })).toBeVisible();
    expect(await gap(), `hovering card ${i + 1} moves the next card`).toEqual(before);
  }
});

// T12: every header's colour is a row of eight swatches at the end of its right-click menu (Color
// palette only). Built-in headers store theirs per project (Project.headerColours); custom headers
// in Project.groups[].colour. The app-wide appearance value is only a legacy fallback, never written.
const swatchRow = (page: Page) => menu(page).getByRole("group", { name: "Colour", exact: true });
const swatch = (page: Page, name: string) => swatchRow(page).getByRole("menuitemradio", { name, exact: true });
const T12_NOTES = "docs/agent-work/2026-11-12-layout-primitives/notes";
const colourAppearance = (sections: Record<string, string>) => {
  const value = JSON.stringify({ theme: "system", palette: "color", sections });
  return (page: Page) => page.addInitScript((v) => localStorage.setItem("folio.workspace.appearance", v), value);
};
async function swatchColour(page: Page, name: string) {
  return page.evaluate((n) => {
    const probe = document.createElement("i");
    probe.style.color = `var(--swatch-${n})`;
    document.body.append(probe);
    const c = getComputedStyle(probe).color;
    probe.remove();
    return c;
  }, name);
}
async function settledMenu(page: Page) {
  await expect(menu(page)).toBeVisible();
  await menu(page).evaluate(async (el) => {
    await Promise.all(el.getAnimations().map((a) => a.finished));
  });
}

test("a custom header's colour is picked from its menu by mouse and keyboard and survives a reload", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "light" });
  await colourAppearance({ manuscript: "blue", fragments: "green", research: "orange" })(page);
  await createProject(page, "Header colour");
  await page.getByRole("button", { name: "Add header", exact: true }).click();
  await expect(page.getByRole("dialog")).toContainText("New header");
  await nameIt(page, "Part two");
  // Unset: it shows Manuscript's colour, and Manuscript's swatch is the marked one.
  await custom(page).locator(".group-title").click({ button: "right" });
  expect(await menu(page).getByRole("menuitem").allTextContents()).toEqual([
    "Collapse", "Move up", "Move down", "New section", "Add header", "Rename", "Delete",
  ]);
  await expect(swatchRow(page).getByRole("menuitemradio")).toHaveCount(8);
  expect(await swatchRow(page).getByRole("menuitemradio").evaluateAll((els) => els.map((el) => el.getAttribute("aria-label"))))
    .toEqual(["Red", "Orange", "Yellow", "Green", "Teal", "Blue", "Indigo", "Purple"]);
  await expect(swatch(page, "Blue")).toHaveAttribute("aria-checked", "true");
  await expect(swatch(page, "Purple")).toHaveAttribute("aria-checked", "false");
  await settledMenu(page);
  await page.screenshot({ path: `${T12_NOTES}/T12-custom-menu-light.png`, clip: { x: 0, y: 0, width: 520, height: 680 } });
  await page.emulateMedia({ colorScheme: "dark" });
  await page.screenshot({ path: `${T12_NOTES}/T12-custom-menu-dark.png`, clip: { x: 0, y: 0, width: 520, height: 680 } });
  await page.emulateMedia({ colorScheme: "light" });
  // The swatch square is the colour the icon is drawn in.
  const purple = await swatchColour(page, "purple");
  await expect(swatch(page, "Purple").locator(".swatch-chip")).toHaveCSS("background-color", purple);
  // Mouse: applies at once, closes the menu, focus back on the heading.
  await swatch(page, "Purple").click();
  await expect(menu(page)).toHaveCount(0);
  await expect(custom(page).locator(".group-title")).toBeFocused();
  await expect(custom(page)).toHaveAttribute("data-tint", "purple");
  await expect(custom(page).locator(".group-title svg").first()).toHaveCSS("color", purple);
  await saved(page);
  await page.reload();
  await expect(custom(page)).toHaveAttribute("data-tint", "purple");
  await expect(custom(page).locator(".group-title svg").first()).toHaveCSS("color", purple);
  // Keyboard: Shift+F10, the row is one stop in the Up/Down order, Right x2 wraps Purple -> Red -> Orange.
  await custom(page).locator(".group-title").focus();
  await page.keyboard.press("Shift+F10");
  await expect(menu(page)).toBeVisible();
  await page.keyboard.press("End");
  await expect(swatch(page, "Purple")).toBeFocused();
  await page.keyboard.press("ArrowUp");
  await expect(menu(page)).toBeFocused();
  await page.keyboard.press("ArrowDown");
  await expect(swatch(page, "Purple")).toBeFocused();
  await page.keyboard.press("ArrowRight");
  await expect(swatch(page, "Red")).toBeFocused();
  await page.keyboard.press("ArrowRight");
  await expect(swatch(page, "Orange")).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(menu(page)).toHaveCount(0);
  await expect(custom(page).locator(".group-title")).toBeFocused();
  await expect(custom(page)).toHaveAttribute("data-tint", "orange");
  await expect(custom(page).locator(".group-title svg").first()).toHaveCSS("color", await swatchColour(page, "orange"));
});

test("a built-in header's colour is per project, follows the tab and falls back to the app-wide value", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "light" });
  // Legacy app-wide value: Fragments teal. A project with no headerColours shows it.
  await colourAppearance({ manuscript: "blue", fragments: "teal", research: "orange" })(page);
  await createProject(page, "Colour A");
  const fragments = page.locator('.sidebar-groups [data-group="fragments"]');
  const teal = await swatchColour(page, "teal");
  const purple = await swatchColour(page, "purple");
  await expect(fragments.locator(".group-title svg").first()).toHaveCSS("color", teal);
  await fragments.locator(".group-title").click({ button: "right" });
  await expect(swatch(page, "Teal")).toHaveAttribute("aria-checked", "true");
  await settledMenu(page);
  await page.screenshot({ path: `${T12_NOTES}/T12-builtin-menu-light.png`, clip: { x: 0, y: 0, width: 520, height: 560 } });
  await page.emulateMedia({ colorScheme: "dark" });
  await page.screenshot({ path: `${T12_NOTES}/T12-builtin-menu-dark.png`, clip: { x: 0, y: 0, width: 520, height: 560 } });
  await page.emulateMedia({ colorScheme: "light" });
  await swatch(page, "Purple").click();
  await expect(menu(page)).toHaveCount(0);
  await expect(fragments.locator(".group-title")).toBeFocused();
  await expect(fragments.locator(".group-title svg").first()).toHaveCSS("color", purple);
  // Nothing writes the app-wide value any more.
  const stored = JSON.parse((await page.evaluate(() => localStorage.getItem("folio.workspace.appearance")))!);
  expect(stored.sections).toEqual({ manuscript: "blue", fragments: "teal", research: "orange" });
  await saved(page);
  await page.reload();
  await expect(fragments.locator(".group-title svg").first()).toHaveCSS("color", purple);
  // Project B keeps the legacy colour; switching tabs switches the tint.
  await page.getByRole("button", { name: "Projects", exact: true }).click();
  await page.getByRole("button", { name: "Start new project" }).click();
  await page.getByRole("button", { name: "Blank", exact: true }).click();
  await page.getByLabel("Project title").fill("Colour B");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(editor(page)).toBeVisible();
  await expect(fragments.locator(".group-title svg").first()).toHaveCSS("color", teal);
  const tabs = page.locator(".project-tabs");
  await tabs.getByRole("button", { name: "Colour A", exact: true }).click();
  await expect(fragments.locator(".group-title svg").first()).toHaveCSS("color", purple);
  await tabs.getByRole("button", { name: "Colour B", exact: true }).click();
  await expect(fragments.locator(".group-title svg").first()).toHaveCSS("color", teal);
});

test("Plain palette: no colour row and no rule in a header's menu", async ({ page }) => {
  await createProject(page, "Plain header menu");
  await manuscript(page).locator(".group-title").click({ button: "right" });
  await expect(menu(page)).toBeVisible();
  await expect(swatchRow(page)).toHaveCount(0);
  await expect(menu(page).locator(".menu-rule")).toHaveCount(0);
  await expect(menu(page).getByRole("menuitemradio")).toHaveCount(0);
});
