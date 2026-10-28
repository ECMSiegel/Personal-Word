import { test, expect } from "@playwright/test";
async function create(page: any, title: string, template = "Blank") {
  await page.getByRole("button", { name: "Start new project" }).click();
  await page.getByRole("button", { name: template, exact: true }).click();
  await page.getByLabel("Project title").fill(title);
  await page.getByRole("button", { name: "Save", exact: true }).click();
}
test("daily goal shows progress in the status line", async ({ page }) => {
  await page.goto("/");
  await create(page, "Daily writing");
  await page.locator(".group-title").filter({ hasText: /^Settings$/ }).click();
  const goal = page.getByLabel("Daily word goal", { exact: true });
  await expect(goal).toBeVisible();
  await goal.fill("10");
  await page.locator(".group-title").filter({ hasText: /^Manuscript$/ }).click();
  await page.getByRole("textbox", { name: "Writing editor" }).fill("one two three four five six seven eight nine ten eleven twelve");
  await expect(page.getByLabel("Writing goals", { exact: true })).toContainText("12 of 10 today");
});

test("exports the project as Markdown", async ({ page }) => {
  await page.goto("/");
  await create(page, "Portable writing", "Chicago");
  await page.getByRole("textbox", { name: "Writing editor" }).fill("Evidence to preserve.");
  await page.locator(".group-title").filter({ hasText: /^Research$/ }).click();
  await page.getByRole("button", { name: "Insert footnote at cursor" }).click();
  await page.getByLabel("Footnote text", { exact: true }).fill("A supporting note.");
  await page.getByRole("button", { name: "Close research", exact: true }).click();
  await page.locator(".group-title").filter({ hasText: /^Settings$/ }).click();
  const button = page.getByRole("button", { name: "Export Markdown", exact: true });
  await expect(button).toBeVisible();
  const downloaded = page.waitForEvent("download");
  await button.click();
  const download = await downloaded;
  expect(download.suggestedFilename()).toBe("Portable writing.md");
  const stream = await download.createReadStream();
  const chunks: Buffer[] = [];
  for await (const chunk of stream!) chunks.push(Buffer.from(chunk));
  const text = Buffer.concat(chunks).toString("utf8");
  expect(text).toContain("## Introduction");
  expect(text).toContain("[^1]");
  expect(text).toContain("A supporting note.");
});
test("projects default startup, tabs, sidebar cards, and durable formatting", async ({
  page,
}) => {
  await page.goto("/");
  await create(page, "Alpha");
  const editor = page.getByRole("textbox", { name: "Writing editor" });
  await editor.fill("A paragraph to preserve.");
  await page.getByRole("button", { name: "Projects", exact: true }).click();
  await create(page, "Beta");
  await page
    .locator(".project-tabs")
    .getByRole("button", { name: "Alpha", exact: true })
    .click();
  await expect(editor).toContainText("A paragraph to preserve.");
  await page.getByRole("button", { name: "Show Manuscript cards" }).click();
  await expect(page.locator(".sidebar-group.cards-view")).toBeVisible();
  await page.reload();
  await expect(page.locator(".library")).toBeVisible();
  await page
    .locator(".project-row")
    .filter({ hasText: "Alpha" })
    .getByRole("button")
    .first()
    .click();
  await expect(editor).toContainText("A paragraph to preserve.");
  await page.screenshot({ path: "test-results/personal-word-workspace.png" });
});
test("research notes, footnote insertion, comments, and export route", async ({
  page,
}) => {
  await page.goto("/");
  await create(page, "Research");
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
  await expect(editor.locator("[data-footnote-id]")).toHaveText("1");
  await page
    .getByRole("button", { name: "Close research", exact: true })
    .click();
  await editor.press("ControlOrMeta+a");
  await page.getByRole("button", { name: "Comment on selection" }).click();
  await page.getByLabel("Note", { exact: true }).fill("Check this claim");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await page
    .locator(".group-title")
    .filter({ hasText: /^Comments$/ })
    .click();
  await expect(
    page.getByText("Check this claim", { exact: true }).last(),
  ).toBeVisible();
  await page
    .locator(".group-title")
    .filter({ hasText: /^Settings$/ })
    .click();
  await expect(page.getByRole("button", { name: "Export DOCX" })).toBeVisible();
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export DOCX" }).click();
  expect((await download).suggestedFilename()).toBe("Research.docx");
});

async function toolbarButton(page: any, name: string) {
  const button = page.getByRole("button", { name, exact: true });
  if (!(await button.count()))
    await page.getByRole("button", { name: "More formatting" }).click();
  return button;
}
test("page layout stacks long paragraphs vertically and preserves undo and formatting", async ({
  page,
}) => {
  await page.goto("/");
  await create(page, "Page layout test");
  const editor = page.getByRole("textbox", { name: "Writing editor" });
  await editor.fill(
    "A long sentence with enough words to flow across paper. ".repeat(300),
  );
  await editor.press("ControlOrMeta+a");
  await (await toolbarButton(page, "Line and paragraph spacing")).click();
  await page.getByRole("button", { name: "Double", exact: true }).click();
  await page.keyboard.press("Escape");
  await (await toolbarButton(page, "Page view")).click();
  await expect(page.getByLabel("Page count")).toContainText(/of [2-9]/);
  // Pages stack vertically: one paragraph taller than a page runs down across
  // the gap (it is never split into columns), and nothing scrolls sideways.
  await expect
    .poll(() =>
      page.locator(".editor-paper").evaluate((el) => el.offsetHeight),
    )
    .toBeGreaterThan(2 * 1056);
  const viewport = page.locator(".editor-viewport");
  expect(
    await viewport.evaluate((el) => el.scrollWidth - el.clientWidth),
  ).toBe(0);
  expect(
    await editor.locator("p").first().evaluate((el) => el.getClientRects().length),
  ).toBe(1);
  await (await toolbarButton(page, "Page view")).click();
  await editor.fill("Before");
  await page.waitForTimeout(600);
  await editor.press("End");
  await page.keyboard.insertText(" added");
  await (await toolbarButton(page, "Page view")).click();
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(editor).toHaveText("Before");
  await page.screenshot({ path: "test-results/personal-word-pages.png" });
});


test("invalid extended-year goal deadlines never replace the saved deadline", async ({ page }) => {
  await page.goto("/");
  await create(page, "Deadline safety");
  await page.locator(".group-title").filter({ hasText: /^Settings$/ }).click();
  const deadline = page.getByLabel("Deadline", { exact: true });
  await deadline.fill("2028-02-29");
  await expect(deadline).toHaveValue("2028-02-29");
  await deadline.fill("10000-01-01");
  await expect(page.getByRole("alert")).toContainText("Enter a valid deadline date.");
  await expect(deadline).toHaveValue("2028-02-29");
  await page.getByRole("button", { name: "Projects", exact: true }).click();
  await page.reload();
  await page.locator(".project-row").filter({ hasText: "Deadline safety" }).getByRole("button").first().click();
  await page.locator(".group-title").filter({ hasText: /^Settings$/ }).click();
  await expect(deadline).toHaveValue("2028-02-29");
  await deadline.fill("");
  await expect(deadline).toHaveValue("");
});

test("Settings has no paragraph captions under the startup or goals controls", async ({ page }) => {
  await page.goto("/");
  await create(page, "No captions");
  await page.locator(".group-title").filter({ hasText: /^Settings$/ }).click();
  await expect(page.getByLabel("Daily word goal", { exact: true })).toBeVisible();
  await expect(page.getByText("Default startup opens Projects.")).toHaveCount(0);
  await expect(page.getByText(/Daily progress starts when you first open/)).toHaveCount(0);
  await expect(page.getByText(/Current baseline:/)).toBeVisible();
});

test("Settings Goals pickers use the interface font and square corners", async ({ page }) => {
  await page.goto("/");
  await create(page, "Goal pickers");
  await page.locator(".group-title").filter({ hasText: /^Settings$/ }).click();
  const ui = await page.locator(".project-settings .settings-label").first().evaluate((el) => getComputedStyle(el).fontFamily);
  for (const name of ["Goal scope", "Goal day"]) {
    const control = page.getByLabel(name, { exact: true });
    await expect(control).toBeVisible();
    const style = await control.evaluate((el) => {
      const s = getComputedStyle(el);
      return { font: s.fontFamily, radius: s.borderRadius };
    });
    expect(style.font, `${name} font`).toBe(ui);
    expect(style.radius, `${name} corners`).toBe("0px");
  }
});
