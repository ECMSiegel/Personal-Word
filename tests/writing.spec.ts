import { test, expect } from "@playwright/test";
test("writer journey: project, rapid edits, sections, fragments, snapshots, restore, reload", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await page.getByRole("button", { name: "New writing project" }).click();
  await page.getByLabel("Project title").fill("The shape of a place");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  const editor = page.getByRole("textbox", { name: "Writing editor" });
  await editor.fill("The first paragraph belongs here.");
  await page.getByRole("button", { name: "New section", exact: true }).click();
  await page.getByLabel("Title", { exact: true }).fill("A second place");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await editor.fill("An ending can become a beginning.");
  await page
    .getByRole("button", { name: "Opening", exact: false })
    .first()
    .click();
  await expect(editor).toContainText("The first paragraph belongs here.");
  await editor.press("ControlOrMeta+a");
  await page.getByRole("button", { name: "Keep as fragment" }).click();
  await expect(editor).not.toContainText("The first paragraph belongs here.");
  await page
    .getByRole("button", {
      name: "The first paragraph belongs here.",
      exact: true,
    })
    .click();
  await expect(editor).toContainText("The first paragraph belongs here.");
  await page.getByRole("button", { name: "Append to section" }).click();
  await expect(editor).toContainText("The first paragraph belongs here.");
  await page.getByRole("button", { name: "Snapshot", exact: true }).click();
  await page.getByLabel("Snapshot name").fill("Before workshop");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await editor.fill("A completely different opening.");
  await expect(page.getByText("Saved", { exact: true })).toBeVisible();
  await page.reload();
  await expect(editor).toContainText("A completely different opening.");
  await page.getByRole("button", { name: "Move A second place up" }).click();
  await page.getByRole("button", { name: "Snapshots & history" }).click();
  await page.getByRole("button", { name: /Before workshop/ }).click();
  await page.getByRole("button", { name: "Restore this version" }).click();
  await expect(editor).toContainText("The first paragraph belongs here.");
  await page
    .getByRole("button", { name: "Opening", exact: true })
    .last()
    .click();
  await page.getByLabel("Title", { exact: true }).fill("The return");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByText("Saved", { exact: true })).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("button", { name: "The return", exact: true }),
  ).toBeVisible();
  expect(errors).toEqual([]);
});
test("recovers a newer journal after an interrupted save", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "New writing project" }).click();
  await page.getByLabel("Project title").fill("Recovery");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByText("Saved", { exact: true })).toBeVisible();
  await page.evaluate(() => {
    const id = localStorage.getItem("folio.lastProject");
    const p = JSON.parse(localStorage.getItem("folio.preview.project." + id)!);
    p.revision += 1;
    p.entries[0].content = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [{ type: "text", text: "Recovered after interruption." }],
        },
      ],
    };
    p.entries[0].text = "Recovered after interruption.";
    localStorage.setItem("folio.recovery." + id, JSON.stringify(p));
  });
  await page.reload();
  await expect(
    page.getByRole("textbox", { name: "Writing editor" }),
  ).toContainText("Recovered after interruption.");
  await expect(page.getByText("Saved", { exact: true })).toBeVisible();
});

test("five thousand words survive rapid section changes and drag reordering", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "New writing project" }).click();
  await page.getByLabel("Project title").fill("Long essay");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  const editor = page.getByRole("textbox", { name: "Writing editor" });
  const prose = Array.from(
    { length: 500 },
    (_, i) => `Paragraph ${i} keeps ten words in this long essay draft.`,
  ).join("\n\n");
  await editor.fill(prose);
  await page.getByRole("button", { name: "New section", exact: true }).click();
  await page.getByLabel("Title", { exact: true }).fill("Ending");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await editor.fill("The last words remain.");
  for (let i = 0; i < 4; i++) {
    await page.locator(".entry-main").filter({ hasText: "Opening" }).click();
    await expect(editor).toContainText("Paragraph 499");
    await page.locator(".entry-main").filter({ hasText: "Ending" }).click();
    await expect(editor).toContainText("The last words remain.");
  }
  await page
    .locator(".entry-row")
    .nth(1)
    .dragTo(page.locator(".entry-row").nth(0));
  await expect(page.locator(".entry-main").first()).toContainText("Ending");
  await expect(page.getByText("Saved", { exact: true })).toBeVisible();
  await page.reload();
  await expect(editor).toContainText("The last words remain.");
  await page.locator(".entry-main").filter({ hasText: "Opening" }).click();
  await expect(editor).toContainText("Paragraph 499");
  await expect(page.locator(".sidebar-bottom")).toContainText("5,004 words");
  await page.screenshot({ path: "test-results/writing-view.png" });
});
