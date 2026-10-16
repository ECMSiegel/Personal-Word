import { test, expect } from "@playwright/test";
const editorOf = (page: import("@playwright/test").Page) =>
  page.getByRole("textbox", { name: "Writing editor" });
async function createProject(
  page: import("@playwright/test").Page,
  title: string,
) {
  await page.goto("/");
  await page.getByRole("button", { name: "New writing project" }).click();
  await page.getByLabel("Project title").fill(title);
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByText("Saved", { exact: true })).toBeVisible();
}
test("rename project, delete a section and a fragment with safety snapshots, delete the project", async ({
  page,
}) => {
  await createProject(page, "Working title");
  const editor = editorOf(page);
  await editor.fill("Words that will be deleted.");
  await page.getByRole("button", { name: "Rename project" }).click();
  await page.getByLabel("Project title").fill("Final title");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.locator(".project-switch")).toContainText("Final title");
  await page.getByRole("button", { name: "New fragment" }).click();
  await page.getByLabel("Title", { exact: true }).fill("Loose idea");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await page.getByRole("button", { name: "Delete fragment" }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Delete fragment" })
    .click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.locator(".fragments")).not.toContainText("Loose idea");
  await page.getByRole("button", { name: "Delete section" }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Delete section" })
    .click();
  await expect(page.getByText("A little room to begin.")).toBeVisible();
  await expect(page.getByText("Saved", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Snapshots & history" }).click();
  await expect(
    page.getByRole("button", { name: /Before deleting “Opening”/ }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: /Before deleting “Loose idea”/ }),
  ).toBeVisible();
  await page.getByRole("button", { name: /Before deleting “Opening”/ }).click();
  await page.getByRole("button", { name: "Restore this version" }).click();
  await expect(editor).toContainText("Words that will be deleted.");
  await page.reload();
  await expect(editor).toContainText("Words that will be deleted.");
  await page.locator(".project-switch").click();
  await page
    .getByRole("button", { name: "Delete project Final title" })
    .click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Delete project" })
    .click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.locator(".project-row")).toHaveCount(0);
  await page.reload();
  await expect(page.locator(".project-row")).toHaveCount(0);
  expect(
    await page.evaluate(() =>
      Object.keys(localStorage).filter((k) => k.includes("folio.")),
    ),
  ).toEqual([]);
});
test("a conflicting same-revision journal offers a choice instead of locking the project", async ({
  page,
}) => {
  await createProject(page, "Conflict");
  await page.evaluate(() => {
    const id = localStorage.getItem("folio.lastProject");
    const p = JSON.parse(localStorage.getItem("folio.preview.project." + id)!);
    p.entries[0].content = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [{ type: "text", text: "Journal copy wins." }],
        },
      ],
    };
    p.entries[0].text = "Journal copy wins.";
    localStorage.setItem("folio.recovery." + id, JSON.stringify(p));
  });
  await page.reload();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toContainText("Two copies of this project disagree.");
  await dialog.getByRole("button", { name: "Keep journal copy" }).click();
  await expect(editorOf(page)).toContainText("Journal copy wins.");
  await expect(page.getByText("Saved", { exact: true })).toBeVisible();
  await page.reload();
  await expect(editorOf(page)).toContainText("Journal copy wins.");
  await expect(page.getByRole("dialog")).toHaveCount(0);
});
test("a corrupt recovery journal is listed as damaged without hiding the library", async ({
  page,
}) => {
  await createProject(page, "Healthy");
  await page.evaluate(() => {
    localStorage.setItem("folio.recovery.corrupt-key", "{not json");
    localStorage.removeItem("folio.lastProject");
  });
  await page.reload();
  await expect(
    page.getByRole("button", { name: /Healthy/ }).first(),
  ).toBeVisible();
  const region = page.getByRole("region", { name: "Needs attention" });
  await expect(region).toContainText("Damaged recovery journal");
  await expect(page.getByRole("alert")).toHaveCount(0);
  await region.getByRole("button", { name: "Discard" }).click();
  await expect(region).toHaveCount(0);
  expect(
    await page.evaluate(() =>
      localStorage.getItem("folio.recovery.corrupt-key"),
    ),
  ).toBeNull();
});
test("links are added through the name dialog, not window.prompt", async ({
  page,
}) => {
  await createProject(page, "Links");
  const editor = editorOf(page);
  await editor.fill("Visit the site");
  await editor.press("ControlOrMeta+a");
  await page.getByRole("button", { name: "Add link" }).click();
  await page.getByLabel("Link address").fill("not a url");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("http://");
  await page.getByLabel("Link address").fill("https://example.com");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(editor.locator('a[href="https://example.com"]')).toHaveCount(1);
  await page.getByRole("button", { name: "Remove link" }).click();
  await expect(editor.locator("a")).toHaveCount(0);
});
