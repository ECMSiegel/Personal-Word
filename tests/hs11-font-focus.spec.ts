import { test, expect } from "@playwright/test";

// HS11: choosing from a toolbar dropdown must hand the keyboard back to the editor at once.
// Tiptap's focus() waits one frame, and until then keys landed on the dropdown button and were lost
// ("Trebuchet specimen" became "ebuchet specimen"). Clicking the option and reading the focused
// element in the same task pins that without depending on typing speed.
for (const [control, option] of [
  ["Font family", "Georgia"],
  ["Paragraph style", "Heading 1"],
] as const) {
  test(`choosing "${option}" from ${control} focuses the editor immediately`, async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Start new project" }).click();
    await page.getByRole("button", { name: "Blank", exact: true }).click();
    await page.getByLabel("Project title").fill("Focus handoff");
    await page.getByRole("button", { name: "Save", exact: true }).click();
    await page.getByRole("textbox", { name: "Writing editor" }).click();
    await page.getByRole("button", { name: control }).click();
    const focused = await page.getByRole("option", { name: option, exact: true }).first().evaluate((el) => {
      (el as HTMLElement).click();
      return document.activeElement?.getAttribute("aria-label") ?? document.activeElement?.tagName;
    });
    expect(focused).toBe("Writing editor");
    await page.keyboard.type("Typed after choosing");
    await expect(page.getByRole("textbox", { name: "Writing editor" })).toContainText("Typed after choosing");
  });
}

// HS12: the toolbar icon buttons and the font size +/- must also hand the keyboard back at once -- for POINTER
// clicks only. Keyboard activation (Space/Enter, click detail 0) must leave things as they were.
type Pg = import("@playwright/test").Page;
async function openBlankEditor(page: Pg) {
  await page.goto("/");
  await page.getByRole("button", { name: "Start new project" }).click();
  await page.getByRole("button", { name: "Blank", exact: true }).click();
  await page.getByLabel("Project title").fill("Focus handoff");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  const editor = page.getByRole("textbox", { name: "Writing editor" });
  await editor.click();
  return editor;
}
// A pointer click: the button takes focus on mousedown, then a click with detail 1; read focus in the same task.
const pointerClick = (page: Pg, name: string) =>
  page.getByRole("button", { name, exact: true }).evaluate((el) => {
    (el as HTMLElement).focus();
    el.dispatchEvent(new MouseEvent("click", { bubbles: true, detail: 1 }));
    return document.activeElement?.getAttribute("aria-label") ?? document.activeElement?.tagName;
  });
async function toolbarButton(page: Pg, name: string) {
  const button = page.getByRole("button", { name, exact: true });
  if (!(await button.isVisible())) {
    await page.getByRole("button", { name: "More formatting", exact: true }).click();
  }
  await expect(button).toBeVisible();
  return button;
}
const sizeBox = (page: Pg) => page.getByLabel("Font size", { exact: true });
const focusedName = (page: Pg) =>
  page.evaluate(() => document.activeElement?.getAttribute("aria-label") ?? document.activeElement?.tagName);

for (const name of ["Bold (⌘B)", "Bullet list", "Increase font size", "Decrease font size", "Increase indent"]) {
  test(`pointer click on "${name}" focuses the editor immediately`, async ({ page }) => {
    const editor = await openBlankEditor(page);
    await page.keyboard.type("Hello");
    expect(await pointerClick(page, name)).toBe("Writing editor");
    await page.keyboard.type(" there");
    await expect(editor).toContainText("Hello there");
  });
}

test("pointer click on Undo focuses the editor immediately and undoes the typing", async ({ page }) => {
  const editor = await openBlankEditor(page);
  await page.keyboard.type("Hello");
  await page.waitForTimeout(700); // its own undo step
  await page.keyboard.type(" more");
  await expect(editor).toHaveText("Hello more");
  expect(await pointerClick(page, "Undo")).toBe("Writing editor");
  await expect(editor).toHaveText("Hello");
});

test("pointer click on font size + changes the selection's size and keeps the selection", async ({ page }) => {
  const editor = await openBlankEditor(page);
  await page.keyboard.type("Alpha Beta");
  for (let i = 0; i < 4; i++) await page.keyboard.press("Shift+ArrowLeft");
  const before = parseFloat(await sizeBox(page).inputValue());
  expect(await pointerClick(page, "Increase font size")).toBe("Writing editor");
  expect(await page.evaluate(() => window.getSelection()?.toString())).toBe("Beta");
  expect(parseFloat(await sizeBox(page).inputValue())).toBe(before + 1);
  await expect(editor).toHaveText("Alpha Beta");
});

test("font size + sets the size of the next typed text", async ({ page }) => {
  const editor = await openBlankEditor(page);
  await page.keyboard.type("Alpha ");
  const before = parseFloat(await sizeBox(page).inputValue());
  expect(await pointerClick(page, "Increase font size")).toBe("Writing editor");
  await page.keyboard.type("Big");
  await expect(editor).toHaveText("Alpha Big");
  expect(parseFloat(await sizeBox(page).inputValue())).toBe(before + 1);
});

for (const [name, delta] of [["Increase font size", 1], ["Decrease font size", -1]] as const) {
  test(`Space x3 on "${name}" leaves the text alone, steps the size and keeps focus on the button`, async ({ page }) => {
    const editor = await openBlankEditor(page);
    await page.keyboard.type("Alpha Beta");
    for (let i = 0; i < 4; i++) await page.keyboard.press("Shift+ArrowLeft");
    const before = parseFloat(await sizeBox(page).inputValue());
    await page.getByRole("button", { name, exact: true }).focus();
    for (let i = 0; i < 3; i++) await page.keyboard.press("Space");
    await expect(editor).toHaveText("Alpha Beta");
    expect(parseFloat(await sizeBox(page).inputValue())).toBe(before + 3 * delta);
    expect(await focusedName(page)).toBe(name);
  });
}

test("Space on a focused Bold button toggles it and types nothing", async ({ page }) => {
  const editor = await openBlankEditor(page);
  await page.keyboard.type("Hello");
  await page.getByRole("button", { name: "Bold (⌘B)", exact: true }).focus();
  await page.keyboard.press("Space");
  await expect(page.getByRole("button", { name: "Bold (⌘B)", exact: true })).toHaveAttribute("aria-pressed", "true");
  await expect(editor).toHaveText("Hello");
});

test("Enter on a focused Bullet list button toggles the list and does not split it", async ({ page }) => {
  const editor = await openBlankEditor(page);
  await page.keyboard.type("Hello");
  await page.getByRole("button", { name: "Bullet list", exact: true }).focus();
  await page.keyboard.press("Enter");
  await expect(editor.locator("ul")).toHaveCount(1);
  await page.waitForTimeout(200);
  // the editor always keeps an empty paragraph after a trailing list, so count list items, not blocks
  await expect(editor.locator("ul > li")).toHaveCount(1);
  await expect(editor).toHaveText("Hello");
});

test("pointer click on Delete table returns focus to the editor at once", async ({ page }) => {
  const editor = await openBlankEditor(page);
  await (await toolbarButton(page, "Insert table")).click();
  await editor.locator("table td").first().click();
  await (await toolbarButton(page, "Table controls")).click();
  expect(await pointerClick(page, "Delete table")).toBe("Writing editor");
});

test("pointer click on Insert page break returns focus to the editor at once", async ({ page }) => {
  await openBlankEditor(page);
  await page.keyboard.type("Hello");
  await (await toolbarButton(page, "Page setup")).click();
  expect(await pointerClick(page, "Insert page break")).toBe("Writing editor");
});
