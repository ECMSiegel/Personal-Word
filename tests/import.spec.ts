import { test, expect } from "@playwright/test";

test("Markdown import is previewed, cancel is safe, and accepted writing survives reload", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("personal-word.restoreTabs", "true"));
  await page.goto("/");
  const picker = page.locator("#import-writing-text");
  const file = { name: "Draft.md", mimeType: "text/markdown", buffer: Buffer.from("# A heading\n\n**A bold sentence.**\n\n![Diagram](https://example.invalid/image.png)") };
  await picker.setInputFiles(file);
  const preview = page.getByRole("dialog", { name: "Import writing" });
  await expect(preview).toBeVisible();
  await expect(preview).toContainText("Images are retained");
  await preview.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(page.locator(".project-row")).toHaveCount(0);
  await picker.setInputFiles(file);
  await preview.getByLabel("Project title").fill("Imported draft");
  await preview.getByRole("button", { name: "Import", exact: true }).click();
  const editor = page.getByRole("textbox", { name: "Writing editor" });
  await expect(editor.locator("h1")).toHaveText("A heading");
  await expect(editor.locator("strong")).toHaveText("A bold sentence.");
  await expect(editor.locator("img")).toHaveCount(0);
  await expect(page.getByText("Saved", { exact: true })).toBeVisible();
  await page.reload();
  await expect(editor.locator("h1")).toHaveText("A heading");
  await expect(editor).toContainText("https://example.invalid/image.png");
});

test("import dialog keeps focus inside, cancels on Escape, and never fetches source images", async ({ page }) => {
  let remoteRequests = 0;
  page.on("request", (r) => { if (r.url().startsWith("https://example.invalid")) remoteRequests++; });
  await page.goto("/");
  await page.locator("#import-writing-text").setInputFiles({ name: "Safe.md", mimeType: "text/markdown", buffer: Buffer.from('<script>alert(1)</script>\n\n![x](https://example.invalid/x.png)') });
  const dialog = page.getByRole("dialog", { name: "Import writing" });
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: "Import", exact: true }).focus();
  await page.keyboard.press("Tab");
  await expect(dialog.getByLabel("Project title")).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  expect(remoteRequests).toBe(0);
  await expect(page.locator(".project-row")).toHaveCount(0);
});
