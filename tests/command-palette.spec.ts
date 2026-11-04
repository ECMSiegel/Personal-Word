import { test, expect, type Page } from "@playwright/test";

async function createProject(page: Page, title: string) {
  await page.goto("/");
  await page.getByRole("button", { name: "Start new project" }).click();
  await page.getByRole("button", { name: "Blank", exact: true }).click();
  await page.getByLabel("Project title").fill(title);
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByText("Saved", { exact: true })).toBeVisible();
}

async function addSection(page: Page, title: string) {
  await page.getByRole("button", { name: "New section", exact: true }).click();
  await page.getByLabel("Title", { exact: true }).fill(title);
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByRole("button", { name: "Rename section" })).toHaveText(title);
}

const palette = (page: Page) => page.getByRole("dialog", { name: "Command palette" });
const options = (page: Page) => palette(page).getByRole("option");
const editor = (page: Page) => page.getByRole("textbox", { name: "Writing editor" });

async function openPalette(page: Page) {
  await editor(page).click();
  await page.keyboard.press("Meta+Shift+p");
  await expect(palette(page)).toBeVisible();
  await expect(page.getByRole("combobox", { name: "Search commands" })).toBeFocused();
}

test("Cmd+Shift+P opens, typing filters, Escape returns focus to the editor", async ({ page }) => {
  await createProject(page, "Palette open");
  await openPalette(page);
  // Opened by keyboard: no animation attribute.
  expect(await palette(page).getAttribute("data-animate")).toBeNull();
  await expect(options(page).filter({ hasText: "Take snapshot" })).toHaveCount(1);
  await expect(options(page).filter({ hasText: "Command palette" })).toHaveCount(0);
  const all = await options(page).count();
  await page.keyboard.type("snap");
  expect(await options(page).count()).toBeLessThan(all);
  await expect(options(page).first()).toContainText(/snapshot/i);
  await page.keyboard.press("Escape");
  await expect(palette(page)).toHaveCount(0);
  await expect(editor(page)).toBeFocused();
  // Cmd+Shift+P again toggles it shut.
  await page.keyboard.press("Meta+Shift+p");
  await expect(palette(page)).toBeVisible();
  await page.keyboard.press("Meta+Shift+p");
  await expect(palette(page)).toHaveCount(0);
});

test("Enter on Take snapshot opens the snapshot prompt", async ({ page }) => {
  await createProject(page, "Palette snapshot");
  await openPalette(page);
  await page.keyboard.type("take snapshot");
  await expect(options(page)).toHaveCount(1);
  await expect(options(page).first().locator(".command-palette-hint")).toHaveText("⇧⌘S");
  await page.keyboard.press("Enter");
  await expect(palette(page)).toHaveCount(0);
  await expect(page.getByRole("dialog", { name: "Keep a named snapshot" })).toBeVisible();
  await expect(page.getByLabel("Snapshot name")).toBeFocused();
});

test("Go to opens the entry; New fragment is listed and works", async ({ page }) => {
  await createProject(page, "Palette goto");
  await addSection(page, "Alpha");
  await addSection(page, "Beta");
  await openPalette(page);
  await page.keyboard.type("go to alpha");
  await expect(options(page)).toHaveCount(1);
  await page.keyboard.press("Enter");
  await expect(page.getByRole("button", { name: "Rename section" })).toHaveText("Alpha");
  // Destinations.
  await openPalette(page);
  for (const name of ["Go to Research", "Go to Comments", "Go to Snapshots & history", "Go to Settings", "Go to Read"])
    await expect(options(page).filter({ hasText: name })).toHaveCount(1);
  await page.keyboard.type("go to settings");
  await page.keyboard.press("Enter");
  await expect(page.getByRole("heading", { name: "Project settings" })).toBeVisible();
  await page.keyboard.press("Meta+Shift+p");
  await expect(palette(page)).toBeVisible();
  await page.keyboard.type("new fragment");
  await page.keyboard.press("Enter");
  await page.getByLabel("Title", { exact: true }).fill("Loose idea");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByRole("button", { name: "Rename fragment" })).toHaveText("Loose idea");
  await openPalette(page);
  await page.keyboard.type("go to loose");
  await expect(options(page)).toHaveCount(1);
});

test("rebinding in Settings > Shortcuts changes the chord the palette shows", async ({ page }) => {
  await page.setViewportSize({ width: 1100, height: 800 });
  await createProject(page, "Palette rebind");
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  const section = page.getByRole("region", { name: "Shortcuts" });
  const row = section.locator('[data-shortcut="snapshot"]');
  await row.getByRole("button", { name: "Change" }).click();
  await page.keyboard.press("Meta+Shift+j");
  await expect(row.locator(".shortcut-chord")).toHaveText("⇧⌘J");
  await page.getByRole("button", { name: "Manuscript", exact: true }).first().click();
  await openPalette(page);
  await page.keyboard.type("take snapshot");
  await expect(options(page).first().locator(".command-palette-hint")).toHaveText("⇧⌘J");
});

test("an outside click closes the palette", async ({ page }) => {
  await page.setViewportSize({ width: 1100, height: 800 });
  await createProject(page, "Palette outside");
  await openPalette(page);
  await page.mouse.click(30, 780);
  await expect(palette(page)).toHaveCount(0);
});

test("a modal closes the palette, and the palette will not open over a modal", async ({ page }) => {
  await createProject(page, "Palette modal");
  await openPalette(page);
  // The snapshot chord pressed inside the palette opens its dialog and closes the palette.
  await page.keyboard.press("Meta+Shift+s");
  const dialog = page.getByRole("dialog", { name: "Keep a named snapshot" });
  await expect(dialog).toBeVisible();
  await expect(palette(page)).toHaveCount(0);
  await expect(page.getByLabel("Snapshot name")).toBeFocused();
  await page.keyboard.press("Meta+Shift+p");
  await expect(palette(page)).toHaveCount(0);
  await expect(dialog).toBeVisible();
});

async function caretMidText(page: Page) {
  await editor(page).click();
  await page.keyboard.type("hello world");
  await page.keyboard.press("ArrowLeft");
  await page.keyboard.press("ArrowLeft");
  await page.keyboard.press("ArrowLeft");
  await page.keyboard.press("Meta+Shift+p");
  await expect(palette(page)).toBeVisible();
}

test("Escape puts the caret back where it was", async ({ page }) => {
  await createProject(page, "Palette caret esc");
  await caretMidText(page);
  await page.keyboard.press("Escape");
  await expect(palette(page)).toHaveCount(0);
  await page.keyboard.type("X");
  await expect(editor(page)).toContainText("hello woXrld");
});

test("Enter on a command that does not move focus keeps the caret", async ({ page }) => {
  await createProject(page, "Palette caret enter");
  await caretMidText(page);
  await page.keyboard.type("switch light");
  await page.keyboard.press("Enter");
  await expect(palette(page)).toHaveCount(0);
  await page.keyboard.type("X");
  await expect(editor(page)).toContainText("hello woXrld");
});

test("the highlighted row's hint does not move and its padding is equal", async ({ page }) => {
  await createProject(page, "Palette spacing");
  await openPalette(page);
  const option = page.getByRole("option").filter({ hasText: "Take snapshot" });
  await expect(option).not.toContainText("//");
  const hint = option.locator(".command-palette-hint");
  const right = async () => {
    const box = (await hint.boundingBox())!;
    return box.x + box.width;
  };
  const before = await right();
  await option.hover();
  const after = await right();
  expect(Math.abs(before - after)).toBeLessThanOrEqual(0.5);
  // Left and right padding are equal on every option.
  const pad = await option.evaluate((el) => {
    const s = getComputedStyle(el);
    return { left: parseFloat(s.paddingLeft), right: parseFloat(s.paddingRight) };
  });
  expect(pad.left).toBe(pad.right);
});

const SHOTS = process.env.PALETTE_SHOTS;
for (const scheme of ["light", "dark"] as const)
  for (const palettePick of ["Plain", "Color"] as const)
    test(`screenshot ${scheme} ${palettePick}`, async ({ page }) => {
      test.skip(!SHOTS, "set PALETTE_SHOTS to a folder to capture");
      await page.setViewportSize({ width: 1100, height: 800 });
      await page.emulateMedia({ colorScheme: scheme });
      await createProject(page, "Palette shot");
      await addSection(page, "Alpha");
      await page.getByRole("button", { name: "Settings", exact: true }).click();
      await page.getByRole("group", { name: "Palette" }).getByRole("button", { name: palettePick, exact: true }).click();
      await page.getByRole("button", { name: "Manuscript", exact: true }).first().click();
      await openPalette(page);
      await page.keyboard.type("s");
      await page.keyboard.press("ArrowDown");
      await page.waitForTimeout(300);
      await page.screenshot({ path: `${SHOTS}/palette-${scheme}-${palettePick.toLowerCase()}.png` });
    });
