import { test, expect } from "@playwright/test";

async function create(page: any, title: string) {
  await page.getByRole("button", { name: "Start new project" }).click();
  await page.getByRole("button", { name: "Blank", exact: true }).click();
  await page.getByLabel("Project title").fill(title);
  await page.getByRole("button", { name: "Save", exact: true }).click();
}

async function ensureToolbarControl(page: any, name: string) {
  const control = page.getByRole("button", { name, exact: true });
  if (!(await control.isVisible())) {
    await page.getByRole("button", { name: "More formatting" }).click();
  }
  await expect(control).toBeVisible();
  return control;
}

test.use({ viewport: { width: 850, height: 600 } });

test("dropdown listbox owns keyboard focus and returns it on Escape or selection", async ({
  page,
}) => {
  await page.goto("/");
  await create(page, "Accessible dropdown");
  const editor = page.getByRole("textbox", { name: "Writing editor" });
  await editor.fill("Keep this selection.");
  await editor.press("ControlOrMeta+a");

  const font = await ensureToolbarControl(page, "Font family");
  await font.focus();
  await font.press("Enter");
  const listbox = page.getByRole("listbox", { name: "Font family" });
  await expect(listbox).toBeFocused();
  await expect(listbox).toHaveAttribute("aria-activedescendant", /.+/);
  const initial = await listbox.getAttribute("aria-activedescendant");
  await listbox.press("ArrowDown");
  await expect(listbox).not.toHaveAttribute("aria-activedescendant", initial ?? "");
  await listbox.press("End");
  let active = await listbox.getAttribute("aria-activedescendant");
  await expect(page.locator(`[id="${active}"]`)).toHaveText("Courier New");
  await listbox.press("Home");
  active = await listbox.getAttribute("aria-activedescendant");
  await expect(page.locator(`[id="${active}"]`)).toHaveText("Futura");
  await page.keyboard.type("geo");
  active = await listbox.getAttribute("aria-activedescendant");
  await expect(page.locator(`[id="${active}"]`)).toHaveText("Georgia");
  await listbox.press("Escape");
  await expect(font).toBeFocused();
  await expect(listbox).toHaveCount(0);

  await font.press("Enter");
  await expect(listbox).toBeFocused();
  await listbox.press("ArrowDown");
  await listbox.press("Enter");
  await expect(listbox).toHaveCount(0);
  await expect(font).toHaveAttribute("aria-expanded", "false");
  await expect(editor.locator("span[style*='font-family']")).toHaveCount(1);
  // Applying a toolbar format deliberately returns focus to the editor so the
  // user can keep typing; only Escape leaves focus on the trigger.
  await expect(editor).toBeFocused();
});

test("dropdown closes on Tab and its menu stays inside a compact viewport", async ({
  page,
}) => {
  await page.goto("/");
  await create(page, "Compact dropdown");
  const font = await ensureToolbarControl(page, "Font family");

  for (const colorScheme of ["light", "dark"] as const) {
    await page.emulateMedia({ colorScheme, reducedMotion: "reduce" });
    if (!(await font.isVisible())) {
      await page.getByRole("button", { name: "More formatting" }).click();
    }
    await font.focus();
    await font.press("Enter");
    const listbox = page.getByRole("listbox", { name: "Font family" });
    await expect(listbox).toBeVisible();
    await expect(listbox).toBeFocused();
    const rect = await listbox.boundingBox();
    expect(rect).not.toBeNull();
    expect(rect!.x).toBeGreaterThanOrEqual(0);
    expect(rect!.y).toBeGreaterThanOrEqual(0);
    expect(rect!.x + rect!.width).toBeLessThanOrEqual(850);
    expect(rect!.y + rect!.height).toBeLessThanOrEqual(600);
    await page.keyboard.press("Tab");
    await expect(listbox).toHaveCount(0);
    await expect(font).not.toBeFocused();
  }
});

test("page layout measurement preserves the editor element and undo history", async ({
  page,
}) => {
  await page.goto("/");
  await create(page, "Editor identity");
  const editor = page.getByRole("textbox", { name: "Writing editor" });
  const originalElement = await editor.elementHandle();
  await editor.fill("Undo remains available.");
  // ProseMirror groups history by time; let the fill settle so the typed
  // suffix is its own undo step (same pattern as features.spec.ts).
  await page.waitForTimeout(600);
  await editor.press("End");
  await editor.pressSequentially(" after layout change");

  const pageView = await ensureToolbarControl(page, "Page view");
  await pageView.click();
  await page.keyboard.press("Escape");
  await expect(page.locator(".editor-viewport")).toHaveClass(/is-paged/);
  await expect.poll(() => originalElement!.evaluate((node) => node.isConnected)).toBe(true);

  await editor.press("ControlOrMeta+z");
  await expect(editor).toHaveText("Undo remains available.");
});

test("an overlong page footnote offers a keyboard-operated continuous view", async ({
  page,
}) => {
  await page.goto("/");
  await create(page, "Long footnote fallback");
  const editor = page.getByRole("textbox", { name: "Writing editor" });
  await editor.fill("A source needs a long note.");
  await page
    .locator(".group-title")
    .filter({ hasText: /^Research$/ })
    .click();
  await page.getByRole("button", { name: "Insert footnote at cursor" }).click();
  await page.getByLabel("Footnote text", { exact: true }).fill(
    "A long note that cannot fit in the page footnote area. ".repeat(450),
  );
  await page.getByRole("button", { name: "Close research", exact: true }).click();

  const pageView = await ensureToolbarControl(page, "Page view");
  await pageView.click();
  await page.keyboard.press("Escape");
  const fallback = page.getByRole("button", {
    name: "Switch to continuous view",
  });
  await expect(fallback).toBeVisible();
  await fallback.focus();
  await fallback.press("Enter");
  await expect(page.locator(".editor-viewport")).toHaveClass(/is-continuous/);
  await expect(page.locator(".footnote-area")).toContainText(
    "A long note that cannot fit",
  );
});
