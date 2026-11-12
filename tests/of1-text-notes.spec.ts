import { test, expect, type Page } from "@playwright/test";

async function createProject(page: Page, title: string) {
  await page.getByRole("button", { name: "Start new project" }).click();
  await page.getByRole("button", { name: "Blank", exact: true }).click();
  await page.getByLabel("Project title").fill(title);
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByRole("textbox", { name: "Writing editor", exact: true })).toBeVisible();
}

const tab = (page: Page, name: "Sources" | "Notes") =>
  page.locator(".research-tabs").getByRole("button", { name, exact: true });

test("Text-only notes live on the Notes tab, not the Sources tab", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");
  await createProject(page, "Text-only move");
  await page.getByRole("textbox", { name: "Writing editor", exact: true }).fill("Evidence here.");
  await page.locator(".group-title").filter({ hasText: /^Research$/ }).click();
  await expect(page.locator(".research-panel")).toBeVisible();

  // Sources tab: nothing about text-only notes.
  await expect(tab(page, "Sources")).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("heading", { name: "Text-only notes" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Insert footnote at cursor" })).toHaveCount(0);

  // Notes tab: the whole block.
  await tab(page, "Notes").click();
  await expect(page.getByRole("heading", { name: "Text-only notes" })).toBeVisible();
  await page.getByRole("button", { name: "Insert footnote at cursor" }).click();
  await page.getByLabel("Footnote text", { exact: true }).fill("A text-only note");
  const item = page.locator(".research-group .footnote-item");
  await expect(item).toHaveCount(1);
  await expect(item.locator(".footnote-where")).toContainText("in ");
  await expect(item.getByRole("button", { name: "Go to", exact: true })).toBeVisible();
  await expect(item.getByText("Preview")).toBeVisible();

  // Back on Sources it is still absent; the footnote did not vanish.
  await tab(page, "Sources").click();
  await expect(page.locator(".footnote-item")).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Text-only notes" })).toHaveCount(0);
  await tab(page, "Notes").click();
  await expect(page.locator(".research-group .footnote-item")).toHaveCount(1);
});

async function addSection(page: Page, title: string) {
  await page.getByRole("button", { name: "New section", exact: true }).click();
  await page.getByLabel("Title", { exact: true }).fill(title);
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
}
const sidebarRow = (page: Page, title: string) =>
  page.locator(".sidebar .entry-main").filter({ hasText: new RegExp("^" + title) });
const editorBox = (page: Page) => page.getByRole("textbox", { name: "Writing editor", exact: true });

async function storedFootnotes(page: Page): Promise<{ text: string }[]> {
  return page.evaluate(() => {
    const key = Object.keys(localStorage).find((k) => k.startsWith("folio.preview.project."));
    return key ? (JSON.parse(localStorage.getItem(key)!).research?.footnotes ?? []) : [];
  });
}

// Section Two holds two text-only footnotes ("Note A" then "Note B"); section One is left open.
async function twoNotes(page: Page, openSection: "One" | "Two") {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");
  await createProject(page, "Delete text-only");
  await addSection(page, "One");
  await addSection(page, "Two");
  await sidebarRow(page, "Two").click();
  await editorBox(page).fill("Second section text.");
  await page.locator(".group-title").filter({ hasText: /^Research$/ }).click();
  await tab(page, "Notes").click();
  for (const label of ["Note A", "Note B"]) {
    await page.getByRole("button", { name: "Insert footnote at cursor" }).click();
    await page.locator(".research-group .footnote-item textarea").last().fill(label);
  }
  await expect(page.locator(".research-group .footnote-item")).toHaveCount(2);
  if (openSection === "One") {
    await sidebarRow(page, "One").click();
    // Opening a section closes Research: reopen it on Notes.
    await page.locator(".group-title").filter({ hasText: /^Research$/ }).click();
    await tab(page, "Notes").click();
  }
  await expect(page.getByRole("button", { name: "Rename section" })).toHaveText(openSection);
}

const rows = (page: Page) => page.locator(".research-group .footnote-item");
const del = (page: Page, n: number) => rows(page).nth(n).getByRole("button", { name: "Delete footnote", exact: true });

test("Delete in a section that is not open: confirm, cancel, snapshot, renumber, reload", async ({ page }) => {
  await twoNotes(page, "One");
  await expect(del(page, 0)).toBeVisible();

  // Cancel (button and Escape) changes nothing.
  await del(page, 0).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toContainText("in “Two”");
  await dialog.getByRole("button", { name: "Cancel" }).click();
  await expect(dialog).toHaveCount(0);
  await del(page, 0).click();
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(rows(page)).toHaveCount(2);
  expect(await storedFootnotes(page)).toHaveLength(2);

  // Confirm removes the first note.
  await del(page, 0).click();
  await dialog.getByRole("button", { name: "Delete footnote" }).click();
  await expect(dialog).toHaveCount(0);
  await expect(rows(page)).toHaveCount(1);
  await expect(rows(page).first().locator("textarea")).toHaveValue("Note B");
  await expect.poll(async () => (await storedFootnotes(page)).map((n) => n.text), { timeout: 15000 }).toEqual(["Note B"]);

  // Section Two: one marker left, numbered 1.
  await sidebarRow(page, "Two").click();
  const markers = editorBox(page).locator("[data-footnote-id]");
  await expect(markers).toHaveCount(1);
  await expect(markers.first()).toHaveAttribute("aria-label", "Edit footnote 1");

  // A safety snapshot exists in History.
  await page.getByRole("button", { name: "Snapshots & history", exact: true }).click();
  await expect(page.locator(".versions").getByRole("button", { name: /Before deleting a footnote/ })).toBeVisible();

  // Still gone after a reload.
  await page.reload();
  await page.locator(".project-row").filter({ has: page.getByText("Delete text-only", { exact: true }) }).locator("button").first().click();
  await sidebarRow(page, "Two").click();
  await expect(editorBox(page).locator("[data-footnote-id]")).toHaveCount(1);
  expect((await storedFootnotes(page)).map((n) => n.text)).toEqual(["Note B"]);
});

test("Delete while the section is open in the editor removes the marker and survives the next save", async ({ page }) => {
  await twoNotes(page, "Two");
  await del(page, 1).focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("dialog")).toContainText("in “Two”");
  await page.getByRole("dialog").getByRole("button", { name: "Delete footnote" }).click();
  await expect(rows(page)).toHaveCount(1);
  await expect(editorBox(page).locator("[data-footnote-id]")).toHaveCount(1);
  // Keep typing: a stale editor copy must not bring the note back.
  await editorBox(page).click();
  await page.keyboard.type(" More.");
  await expect.poll(async () => (await storedFootnotes(page)).map((n) => n.text), { timeout: 15000 }).toEqual(["Note A"]);
  await page.reload();
  await page.locator(".project-row").filter({ has: page.getByText("Delete text-only", { exact: true }) }).locator("button").first().click();
  await sidebarRow(page, "Two").click();
  await expect(editorBox(page).locator("[data-footnote-id]")).toHaveCount(1);
  await expect(editorBox(page)).toContainText("More.");
});

test("a cited footnote's action row says exactly Unlink source (no stray index)", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");
  await createProject(page, "Cited actions");
  await editorBox(page).fill("Cited text.");
  await page.locator(".group-title").filter({ hasText: /^Research$/ }).click();
  await page.getByRole("button", { name: "Enter manually" }).click();
  await page.getByLabel("Authors", { exact: true }).fill("Ada Example");
  await page.getByLabel("Title", { exact: true }).fill("Lamps and Ledgers");
  await page.getByRole("button", { name: "Cite here", exact: true }).click();
  const actions = page.locator(".source-body .footnote-item .item-actions");
  await expect(actions).toHaveCount(1);
  await expect(actions).toHaveText("Unlink source");
});
