import { test, expect } from "@playwright/test";

async function create(page: any, title: string, template = "Blank") {
  await page.getByRole("button", { name: "Start new project" }).click();
  await page.getByRole("button", { name: template, exact: true }).click();
  await page.getByLabel("Project title").fill(title);
  await page.getByRole("button", { name: "Save", exact: true }).click();
}

async function toolbarButton(page: any, name: string) {
  const button = page.getByRole("button", { name, exact: true });
  if (!(await button.count()))
    await page.getByRole("button", { name: "More formatting" }).click();
  return button;
}

async function openResearch(page: any) {
  await page
    .locator(".group-title")
    .filter({ hasText: /^Research$/ })
    .click();
}

async function insertTextOnlyFootnote(page: any) {
  await openResearch(page);
  await page.getByRole("button", { name: "Insert footnote at cursor" }).click();
}

// The saved project, read from the browser store (src/storage.ts keeps
// projects under "folio.preview.project.<id>"). Returns the footnote records,
// so a test can prove a record really left storage, not just the screen.
async function storedFootnotes(
  page: any,
): Promise<{ text: string; sourced: boolean }[]> {
  return page.evaluate(() => {
    const key = Object.keys(localStorage).find((name) =>
      name.startsWith("folio.preview.project."),
    );
    if (!key) return [];
    const project = JSON.parse(localStorage.getItem(key)!);
    return (project.research?.footnotes ?? []).map((note: any) => ({
      text: note.text,
      sourced: Boolean(note.sourceId),
    }));
  });
}

test("Backspace in an empty text-only footnote removes marker, row and record", async ({
  page,
}) => {
  await page.addInitScript(() =>
    localStorage.setItem("personal-word.restoreTabs", "true"),
  );
  await page.goto("/");
  await create(page, "Empty footnote backspace");
  const editor = page.getByRole("textbox", { name: "Writing editor" });
  await editor.fill("Evidence here.");
  await insertTextOnlyFootnote(page);

  const textarea = page.getByLabel("Footnote 1 text");
  await expect(textarea).toBeFocused();
  await expect(textarea).toHaveValue("");
  await expect(editor.locator("[data-footnote-id]")).toHaveCount(1);

  // The record reaches storage before the deletion, so removing it is provable.
  await expect
    .poll(async () => (await storedFootnotes(page)).length, { timeout: 15000 })
    .toBe(1);

  await page.keyboard.press("Backspace");

  await expect(editor.locator("[data-footnote-id]")).toHaveCount(0);
  await expect(page.locator(".footnote-row")).toHaveCount(0);

  // The saved record left with the marker. This is the storage-level check:
  // the research panel row below only proves the same thing while it is open.
  await expect
    .poll(async () => (await storedFootnotes(page)).length, { timeout: 15000 })
    .toBe(0);
  await expect(page.locator(".footnote-item")).toHaveCount(0);

  // The caret sits in the editor where the marker was.
  await expect(editor).toBeFocused();
  await page.keyboard.type("!");
  await expect(editor).toContainText("Evidence here.!");

  // The reload does not bring an orphan record back.
  await page.reload();
  await expect(
    page.getByRole("textbox", { name: "Writing editor" }),
  ).toContainText("Evidence here.!");
  expect(await storedFootnotes(page)).toEqual([]);
});

test("Backspace in an empty citation footnote keeps its marker", async ({
  page,
}) => {
  await page.goto("/");
  await create(page, "Cited footnote backspace");
  const editor = page.getByRole("textbox", { name: "Writing editor" });
  await editor.fill("Evidence here.");
  await openResearch(page);
  await page.getByRole("button", { name: "Enter manually" }).click();
  await page.getByLabel("Title", { exact: true }).fill("Interior Chinatown");
  await page.getByLabel("Authors", { exact: true }).fill("Charles Yu");
  await page.getByRole("button", { name: "Cite here", exact: true }).click();
  await expect(editor.locator("[data-footnote-id]")).toHaveCount(1);

  // Whether a new note opens its editor by itself depends on effect ordering
  // (U4 changed it), so open it when needed and take focus ourselves rather
  // than relying on that race.
  const textarea = page.getByLabel("Footnote 1 text");
  const body = page.locator(".footnote-row .footnote-body").first();
  await expect
    .poll(async () => (await textarea.count()) || (await body.count()))
    .toBeTruthy();
  if (!(await textarea.count())) await body.click();
  await textarea.focus();
  await expect(textarea).toBeFocused();
  await expect(textarea).toHaveValue("");

  await page.keyboard.press("Backspace");

  await expect(editor.locator("[data-footnote-id]")).toHaveCount(1);
  await expect(page.locator(".footnote-row")).toHaveCount(1);

  // A cited note's record stays in storage: only source-less notes are removed.
  await expect
    .poll(async () => (await storedFootnotes(page)).length, { timeout: 15000 })
    .toBe(1);
  expect((await storedFootnotes(page))[0].sourced).toBe(true);
});

test("Backspace in a text-only footnote with text deletes one character", async ({
  page,
}) => {
  await page.goto("/");
  await create(page, "Typed footnote backspace");
  const editor = page.getByRole("textbox", { name: "Writing editor" });
  await editor.fill("Evidence here.");
  await insertTextOnlyFootnote(page);

  const textarea = page.getByLabel("Footnote 1 text");
  await expect(textarea).toBeFocused();
  await page.keyboard.type("ab");
  await expect(textarea).toHaveValue("ab");

  await page.keyboard.press("Backspace");

  await expect(textarea).toHaveValue("a");
  await expect(editor.locator("[data-footnote-id]")).toHaveCount(1);
});

test("footnote text appears at the bottom of the page and is editable there", async ({
  page,
}) => {
  await page.goto("/");
  await create(page, "Footnote display");
  const editor = page.getByRole("textbox", { name: "Writing editor" });
  await editor.fill("Evidence here.");
  await page
    .locator(".group-title")
    .filter({ hasText: /^Research$/ })
    .click();
  await page.getByRole("button", { name: "Insert footnote at cursor" }).click();
  await page
    .getByLabel("Footnote text", { exact: true })
    .fill("A supporting note.");
  await page
    .getByRole("button", { name: "Close research", exact: true })
    .click();

  const area = page.locator(".footnote-area");
  await expect(area).toContainText("A supporting note.");
  await area.locator(".footnote-body").click();
  await page.getByLabel("Footnote 1 text").fill("Edited note.");
  await page.getByLabel("Footnote 1 text").press("Escape");
  await expect(area).toContainText("Edited note.");

  await (await toolbarButton(page, "Page view")).click();
  const block = page
    .locator(".page-footnotes")
    .filter({ hasText: "Edited note." });
  await expect(block).toHaveCount(1);
  const paper = await page.locator(".editor-paper").boundingBox();
  const box = await block.boundingBox();
  expect(paper).not.toBeNull();
  expect(box).not.toBeNull();
  // The first page is 1056px tall at 100% zoom; notes belong in its bottom half.
  const offset = box!.y - paper!.y;
  expect(offset).toBeGreaterThan(528);
  expect(offset).toBeLessThan(1056);
});
