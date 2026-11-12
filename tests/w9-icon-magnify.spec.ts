import { test, expect, type Page } from "@playwright/test";

async function createProject(page: Page, title: string) {
  await page.getByRole("button", { name: "Start new project" }).click();
  await page.getByRole("button", { name: "Blank", exact: true }).click();
  await page.getByLabel("Project title").fill(title);
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await page.getByRole("button", { name: "Projects", exact: true }).click();
  await expect(page.locator(".library")).toBeVisible();
}

async function addSection(page: Page, title: string) {
  await page.getByRole("button", { name: "New section", exact: true }).click();
  await page.getByLabel("Title", { exact: true }).fill(title);
  await page.getByRole("button", { name: "Save", exact: true }).click();
}

test("standalone icon children magnify on hover and keyboard focus without moving buttons", async ({ page }) => {
  await page.goto("/");
  await createProject(page, "Icon magnify fixture");

  await page.evaluate(() => {
    const fixture = document.createElement("div");
    fixture.innerHTML = `
      <button class="icon-grow" aria-label="SVG test"><svg width="16" height="16"><circle cx="8" cy="8" r="6" /></svg></button>
      <button class="icon-grow" aria-label="Span test"><span>+</span></button>`;
    document.body.append(fixture);
  });

  const project = page.locator(".project-row").filter({ hasText: "Icon magnify fixture" });
  const trash = project.locator(".delete-entry");
  const iconCases = [
    { button: trash, child: "svg" },
    { button: page.getByRole("button", { name: "SVG test" }), child: "svg" },
    { button: page.getByRole("button", { name: "Span test" }), child: "span" },
  ];

  for (const { button, child } of iconCases) {
    await button.scrollIntoViewIfNeeded();
    const boxBefore = await button.boundingBox();
    await button.hover();
    await expect.poll(() => button.locator(`:scope > ${child}`).evaluate((el) => getComputedStyle(el).transform))
      .toBe("matrix(1.25, 0, 0, 1.25, 0, 0)");
    expect(await button.boundingBox()).toEqual(boxBefore);
    await page.mouse.move(0, 0);
    // Keyboard focus: focus-visible only applies after keyboard input, so finish on a Tab key press.
    await button.focus();
    await page.keyboard.press("Shift+Tab");
    await page.keyboard.press("Tab");
    await expect.poll(() => button.locator(`:scope > ${child}`).evaluate((el) => getComputedStyle(el).transform))
      .toBe("matrix(1.25, 0, 0, 1.25, 0, 0)");
    expect(await button.boundingBox()).toEqual(boxBefore);
    await button.blur();
  }

  await page.emulateMedia({ reducedMotion: "reduce" });
  for (const { button, child } of iconCases) {
    await button.hover();
    await expect.poll(() => button.locator(`:scope > ${child}`).evaluate((el) => getComputedStyle(el).transform))
      .toBe("none");
  }

  await page.emulateMedia({ reducedMotion: "no-preference" });
  await project.locator("button.emph-row").click();
  await addSection(page, "One");
  await addSection(page, "Two");

  const listOpenBeside = page.getByRole("button", { name: "Open Two beside" });
  const listBoxBefore = await listOpenBeside.boundingBox();
  await listOpenBeside.hover();
  await expect.poll(() => listOpenBeside.locator(":scope > svg").evaluate((el) => getComputedStyle(el).transform))
    .toBe("matrix(1.25, 0, 0, 1.25, 0, 0)");
  expect(await listOpenBeside.boundingBox()).toEqual(listBoxBefore);

  await page.getByRole("button", { name: "Show Manuscript cards" }).click();
  const cardOpenBeside = page.getByRole("button", { name: "Open Two beside" });
  const cardBoxBefore = await cardOpenBeside.boundingBox();
  await cardOpenBeside.hover();
  await expect.poll(() => cardOpenBeside.locator(":scope > svg").evaluate((el) => getComputedStyle(el).transform))
    .toBe("matrix(1.25, 0, 0, 1.25, 0, 0)");
  expect(await cardOpenBeside.boundingBox()).toEqual(cardBoxBefore);

  await page.emulateMedia({ reducedMotion: "reduce" });
  for (const { button, child } of [
    { button: listOpenBeside, child: "svg" },
    { button: cardOpenBeside, child: "svg" },
  ]) {
    await button.hover();
    await expect.poll(() => button.locator(`:scope > ${child}`).evaluate((el) => getComputedStyle(el).transform))
      .toBe("none");
  }
});
