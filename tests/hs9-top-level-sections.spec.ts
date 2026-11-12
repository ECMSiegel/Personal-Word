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
  await page.getByRole("button", { name: "New top-level section", exact: true }).click();
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
  await dialog.getByRole("button", { name: "Delete section" }).click();
  await expect(custom(page)).toHaveCount(0);
  // The section sat above Manuscript, so its entries keep their place: first.
  expect(await rows(manuscript(page))).toEqual(["Alpha", "Beta", "Gamma", "Opening"]);
  await saved(page);
  await page.getByRole("button", { name: "Snapshots & history", exact: true }).click();
  await expect(page.locator(".versions").getByRole("button", { name: /Before deleting section “Appendix”/ })).toBeVisible();
});

test("rename Manuscript and restore the default; empty sidebar space and palette add a section", async ({ page }) => {
  await createProject(page, "Rename built-in");
  const title = manuscript(page).locator(".group-title");
  await title.click({ button: "right" });
  expect(await menu(page).getByRole("menuitem").allTextContents()).toEqual([
    "Collapse", "Move up", "Move down", "New section", "New top-level section", "Rename",
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
    "Collapse", "Move up", "Move down", "New section", "New top-level section", "Rename", "Reset name",
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
  await item(page, "New top-level section").click();
  await nameIt(page, "From space");
  await expect(custom(page).locator(".group-title")).toHaveText("From space");

  // Command palette.
  await page.keyboard.press("ControlOrMeta+Shift+p");
  await page.keyboard.type("New top-level section");
  await page.keyboard.press("Enter");
  await nameIt(page, "From palette");
  await expect(custom(page).locator(".group-title")).toHaveText(["From space", "From palette"]);
});

test("the row More button shifts nothing and overlaps neither the title nor the split icon", async ({ page }) => {
  await createProject(page, "More button");
  await page.getByRole("button", { name: "New section", exact: true }).click();
  await nameIt(page, "Second section with a rather long title that runs on");
  for (const view of ["list", "cards"]) {
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
  await page.getByRole("button", { name: "New top-level section", exact: true }).click();
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
