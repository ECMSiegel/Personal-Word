import { test, expect } from "@playwright/test";

async function create(page: any, title: string) {
  await page.getByRole("button", { name: "Start new project" }).click();
  await page.getByRole("button", { name: "Blank", exact: true }).click();
  await page.getByLabel("Project title").fill(title);
  await page.getByRole("button", { name: "Save", exact: true }).click();
}

test.use({ viewport: { width: 1400, height: 900 } });

test("font menu keeps one unquoted full-name option and has its own icon", async ({
  page,
}) => {
  await page.goto("/");
  await create(page, "Font menu");

  const editor = page.getByRole("textbox", { name: "Writing editor" });
  await editor.fill("Typeface sample");
  await editor.press("ControlOrMeta+a");
  const font = page.getByRole("button", { name: "Font family", exact: true });
  await font.click();
  await page.getByRole("option", { name: "Times New Roman", exact: true }).click();

  // Simulate a document saved by a font registry using a quoted CSS family
  // stack. It names the same family as the built-in option but is not its raw
  // value; reopening the menu must not add it as a second entry.
  await editor.evaluate((element: any) =>
    element.editor
      .chain()
      .focus()
      .setMark("textFormat", { fontFamily: '"Times New Roman", serif' })
      .run(),
  );
  await editor.locator("p").first().click();
  await font.click();
  const options = page.getByRole("option");
  // Times New Roman was applied above, so it is also under Recent. "One entry per font" means
  // once in the full list, which is everything below the grey divider.
  const fullList = await page
    .getByRole("listbox", { name: "Font family" })
    .evaluate((menu) => {
      const kids = [...menu.children];
      const divider = kids.findIndex((el) => el.getAttribute("role") === "separator");
      return kids.slice(divider + 1).map((el) => (el.textContent ?? "").trim());
    });
  expect(fullList.filter((text: string) => text === "Times New Roman")).toHaveLength(1);
  const optionTexts = await options.allTextContents();
  expect(optionTexts.every((text: string) => !/["']/.test(text))).toBe(true);
  await expect(font).not.toContainText(/["']/);
  await expect(font).toContainText("Times New Roman");

  const dimensions = await font.evaluate((button: HTMLButtonElement) => ({
    clientWidth: button.clientWidth,
    scrollWidth: button.scrollWidth,
  }));
  expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth);

  await page.setViewportSize({ width: 2200, height: 900 });
  const proseIcon = await page
    .getByRole("button", { name: "Prose check", exact: true })
    .locator("svg")
    .evaluate((svg: SVGElement) => svg.outerHTML);
  const setupIcon = await page
    .getByRole("button", { name: "Page setup", exact: true })
    .locator("svg")
    .evaluate((svg: SVGElement) => svg.outerHTML);
  expect(proseIcon).not.toBe(setupIcon);
});
