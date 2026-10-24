import { expect, test, type Page } from "@playwright/test";

async function createProject(page: Page, title: string) {
  await page.goto("/");
  await page.getByRole("button", { name: "Start new project" }).click();
  await page.getByRole("button", { name: "Blank", exact: true }).click();
  await page.getByLabel("Project title").fill(title);
  await page.getByRole("button", { name: "Save", exact: true }).click();
}

async function makeSnapshot(page: Page, name: string) {
  await page.getByRole("button", { name: "Snapshot", exact: true }).click();
  await page.getByLabel("Snapshot name").fill(name);
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
}

async function previewSnapshot(page: Page, name: string) {
  await page.getByRole("button", { name: "Snapshots & history", exact: true }).click();
  await page.locator(".versions").getByRole("button", { name: new RegExp(name) }).click();
}

test("word comparison labels changes, navigates them, and restores a changed rich-text paragraph safely", async ({ page }) => {
  await createProject(page, "Revision comparison");
  const editor = page.getByRole("textbox", { name: "Writing editor" });
  await editor.fill("Opening\nOld passage\nClosing");
  await expect(page.locator(".save-status")).toHaveText("Saved", { timeout: 10_000 });
  await makeSnapshot(page, "Before paragraph change");
  await editor.fill("Opening\nNew passage\nClosing");
  await expect(page.locator(".save-status")).toHaveText("Saved", { timeout: 10_000 });
  await previewSnapshot(page, "Before paragraph change");

  const dialog = page.locator(".preview-dialog");
  await expect(dialog.locator("del")).toContainText("Old");
  await expect(dialog.locator("ins")).toContainText("New");
  await expect(dialog.getByRole("button", { name: "Previous change" })).toBeEnabled();
  await expect(dialog.getByRole("button", { name: "Next change" })).toBeEnabled();
  await expect(dialog.getByRole("button", { name: "Restore paragraph from snapshot" })).toHaveCount(1);
  await dialog.screenshot({ path: "node_modules/.cache/personal-word-beta/e3/diff-light.png" });
  await page.emulateMedia({ colorScheme: "dark" });
  await dialog.screenshot({ path: "node_modules/.cache/personal-word-beta/e3/diff-dark.png" });
  await page.emulateMedia({ colorScheme: "light" });
  await dialog.getByRole("button", { name: "Restore paragraph from snapshot" }).click();
  await expect(editor).toContainText("Opening");
  await expect(editor).toContainText("Old passage");
  await expect(editor).toContainText("Closing");
  await expect(page.locator(".save-status")).toHaveText("Saved", { timeout: 10_000 });

  await previewSnapshot(page, "Before restoring passage");
  const safety = page.locator(".preview-dialog");
  await expect(safety.locator("del")).toContainText("New");
  await expect(safety.locator("ins")).toContainText("Old");
});

test("does not offer a guessed paragraph restore when inserted and edited blocks are ambiguous", async ({ page }) => {
  await createProject(page, "Ambiguous passage alignment");
  const editor = page.getByRole("textbox", { name: "Writing editor" });
  await editor.fill("Opening\nOld passage\nClosing");
  await expect(page.locator(".save-status")).toHaveText("Saved", { timeout: 10_000 });
  await makeSnapshot(page, "Before insertion");
  await editor.fill("Opening\nInserted paragraph\nEdited passage\nClosing");
  await expect(page.locator(".save-status")).toHaveText("Saved", { timeout: 10_000 });
  await previewSnapshot(page, "Before insertion");

  const dialog = page.locator(".preview-dialog");
  await expect(dialog.locator("ins").filter({ hasText: "Inserted paragraph" })).toBeVisible();
  await expect(dialog.locator("del").filter({ hasText: "Old passage" })).toBeVisible();
  await expect(dialog.getByRole("button", { name: "Restore paragraph from snapshot" })).toHaveCount(0);
  await expect(dialog.getByRole("button", { name: "Restore this section" })).toBeVisible();
});

test("oversized comparisons offer a bounded, cancellable selected-passage view", async ({ page }) => {
  await createProject(page, "Oversized revision comparison");
  const editor = page.getByRole("textbox", { name: "Writing editor" });
  await editor.fill(Array.from({ length: 401 }, (_, index) => `Paragraph ${index + 1}`).join("\n\n"));
  await expect(page.locator(".save-status")).toHaveText("Saved", { timeout: 10_000 });
  await makeSnapshot(page, "Large snapshot");
  await previewSnapshot(page, "Large snapshot");
  const dialog = page.locator(".preview-dialog");
  await expect(dialog.getByText(/too many paragraphs/i)).toBeVisible();
  await dialog.getByRole("button", { name: "Compare selected passage" }).click();
  await dialog.getByRole("button", { name: "Use these passages" }).click();
  await expect(dialog.getByLabel("Snapshot passage", { exact: true })).toHaveAttribute("readonly", "");
  await expect(dialog.getByLabel("Current passage", { exact: true })).toHaveAttribute("readonly", "");
  await expect(dialog.getByLabel("Snapshot passage", { exact: true })).toHaveValue("Paragraph 1");
  await dialog.getByRole("button", { name: "Compare selected passage" }).click();
  await expect(dialog.locator(".revision-selected-result").getByRole("status")).toContainText("No changes");
  await expect(dialog.getByRole("button", { name: "Restore paragraph from snapshot" })).toHaveCount(0);
  await dialog.getByRole("button", { name: "Cancel" }).click();
  await expect(dialog.getByRole("button", { name: "Compare selected passage" })).toBeVisible();
});

test("refuses a corrupted safety snapshot and keeps current prose unchanged", async ({ page }) => {
  await page.addInitScript(() => {
    const nativeSet = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key: string, value: string) {
      nativeSet.call(this, key, value);
      if (key.startsWith("folio.preview.snapshots.") && (window as any).__corruptNextSafetySnapshot) {
        (window as any).__corruptNextSafetySnapshot = false;
        const versions = JSON.parse(value);
        versions[0].project.title = "Corrupted safety copy";
        nativeSet.call(this, key, JSON.stringify(versions));
      }
    };
  });
  await createProject(page, "Safety snapshot rejection");
  const editor = page.getByRole("textbox", { name: "Writing editor" });
  await editor.fill("Old saved prose");
  await expect(page.locator(".save-status")).toHaveText("Saved", { timeout: 10_000 });
  await makeSnapshot(page, "Before safety restore");
  await editor.fill("Current prose must stay");
  await expect(page.locator(".save-status")).toHaveText("Saved", { timeout: 10_000 });
  await previewSnapshot(page, "Before safety restore");
  await page.evaluate(() => { (window as any).__corruptNextSafetySnapshot = true; });
  await page.locator(".preview-dialog").getByRole("button", { name: "Restore paragraph from snapshot" }).click();
  await expect(page.getByRole("alert")).toContainText(/safety snapshot/i);
  await expect(editor).toContainText("Current prose must stay");
});
