import { test, expect, type Page } from "@playwright/test";

async function create(page: Page, title: string, template: string) {
  await page.getByRole("button", { name: "Start new project" }).click();
  await page.getByRole("button", { name: template, exact: true }).click();
  await page.getByLabel("Project title").fill(title);
  await page.getByRole("button", { name: "Save", exact: true }).click();
}

const family = (page: Page, selector: string) =>
  page.locator(selector).first().evaluate((el) => getComputedStyle(el).fontFamily);

test("a sans project's editor and Read view use the interface font; Chicago does not", async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("folio.workspace.interfaceFont", '"Avenir Next", -apple-system, sans-serif');
  });
  await page.goto("/");
  await create(page, "Sans follows", "Blank");
  const editor = page.getByRole("textbox", { name: "Writing editor" });
  await editor.fill("Body text.");
  expect(await family(page, ".writing-surface p")).toMatch(/^"?Avenir Next/);
  await page.getByRole("button", { name: "Read manuscript", exact: true }).click();
  await expect(page.locator(".read-prose").first()).toBeVisible();
  expect(await family(page, ".read-prose")).toMatch(/^"?Avenir Next/);
});

test("changing the interface font updates a sans project live", async ({ page }) => {
  await page.goto("/");
  await create(page, "Sans live", "Blank");
  await page.getByRole("textbox", { name: "Writing editor" }).fill("Body text.");
  // Change the interface font through the real Settings UI (works on the dev server and the built app).
  await page.locator(".group-title").filter({ hasText: /^Settings$/ }).click();
  await page.getByRole("button", { name: "Interface font" }).click();
  await page.getByRole("option", { name: "Gill Sans", exact: true }).click();
  await page.locator(".group-title").filter({ hasText: /^Manuscript$/ }).click();
  await expect.poll(() => family(page, ".writing-surface p")).toMatch(/^"?Gill Sans/);
});

test("a Chicago (serif) project is unaffected by the interface font", async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("folio.workspace.interfaceFont", '"Avenir Next", -apple-system, sans-serif');
  });
  await page.goto("/");
  await create(page, "Serif stays", "Chicago");
  await page.getByRole("textbox", { name: "Writing editor" }).fill("Body text.");
  expect(await family(page, ".writing-surface p")).toMatch(/Times New Roman/);
});
