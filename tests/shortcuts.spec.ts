import { test, expect, type Page } from "@playwright/test";

async function createProject(page: Page, title: string) {
  await page.addInitScript(() =>
    localStorage.setItem("personal-word.restoreTabs", "true"),
  );
  await page.goto("/");
  await page.getByRole("button", { name: "Start new project" }).click();
  await page.getByRole("button", { name: "Blank", exact: true }).click();
  await page.getByLabel("Project title").fill(title);
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByText("Saved", { exact: true })).toBeVisible();
}

const focusStored = (page: Page) =>
  page.evaluate(() => localStorage.getItem("personal-word.focus-mode"));

async function openShortcuts(page: Page) {
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  const section = page.getByRole("region", { name: "Shortcuts" });
  await expect(section).toBeVisible();
  return section;
}

test("rebinding Focus mode moves the chord, the menu hint and survives reload", async ({
  page,
}) => {
  await page.setViewportSize({ width: 850, height: 600 });
  await createProject(page, "Shortcut test");
  const editor = page.getByRole("textbox", { name: "Writing editor" });
  await editor.click();
  await editor.press("Meta+Shift+f");
  expect(await focusStored(page)).toBe("true");
  await editor.press("Meta+Shift+f");
  expect(await focusStored(page)).toBe("false");

  const section = await openShortcuts(page);
  const row = section.locator('[data-shortcut="focusMode"]');
  await row.getByRole("button", { name: "Change" }).click();
  await page.keyboard.press("Meta+Shift+g");
  await expect(row.locator(".shortcut-chord")).toHaveText("⇧⌘G");

  await page.getByRole("button", { name: "Manuscript", exact: true }).first().click();
  await editor.click();
  await editor.press("Meta+Shift+f");
  expect(await focusStored(page)).toBe("false");
  await editor.press("Meta+Shift+g");
  expect(await focusStored(page)).toBe("true");
  await editor.press("Meta+Shift+g");

  await page
    .getByRole("toolbar", { name: "Formatting" })
    .getByRole("button", { name: "More formatting", exact: true })
    .click();
  await expect(
    page
      .getByRole("dialog", { name: "More formatting" })
      .getByRole("button", { name: "Focus mode" })
      .locator(".popover-shortcut"),
  ).toHaveText("⇧⌘G");

  await page.reload();
  await page.getByRole("textbox", { name: "Writing editor" }).click();
  await page.keyboard.press("Meta+Shift+g");
  expect(await focusStored(page)).toBe("true");
});

test("recording a reserved or taken chord is refused; Reset all restores", async ({
  page,
}) => {
  await createProject(page, "Shortcut refusals");
  const section = await openShortcuts(page);
  const row = section.locator('[data-shortcut="focusMode"]');
  await row.getByRole("button", { name: "Change" }).click();
  await page.keyboard.press("Meta+c");
  await expect(section.getByRole("status")).toHaveText(
    "That shortcut is reserved by macOS.",
  );
  await page.keyboard.press("Meta+s");
  await expect(section.getByRole("status")).toHaveText(
    "That shortcut is taken by Save.",
  );
  await page.keyboard.press("Meta+Shift+g");
  await expect(row.locator(".shortcut-chord")).toHaveText("⇧⌘G");
  await section.getByRole("button", { name: "Reset all" }).click();
  await expect(row.locator(".shortcut-chord")).toHaveText("⇧⌘F");
  await expect(
    section.locator('[data-shortcut="insertPageBreak"] .shortcut-chord'),
  ).toHaveText("⇧↩");
});

test("Cmd+Shift+S takes one snapshot and does not save", async ({ page }) => {
  await createProject(page, "Snapshot chord");
  // Freeze page timers so the 250 ms autosave cannot flip the status by itself.
  await page.clock.install();
  await page.clock.pauseAt(new Date(Date.now() + 60_000));
  const editor = page.getByRole("textbox", { name: "Writing editor" });
  await editor.click();
  await page.keyboard.type("unsaved words");
  await expect(page.getByText("Unsaved edits", { exact: true })).toBeVisible();
  await page.keyboard.press("Meta+Shift+s");
  await expect(page.getByRole("dialog")).toContainText("Snapshot name");
  await expect(page.getByText("Unsaved edits", { exact: true })).toBeVisible();
  await expect(page.getByText("Saved", { exact: true })).toHaveCount(0);
});

test("Escape cancels recording and leaves the old chord", async ({ page }) => {
  await createProject(page, "Escape recording");
  const section = await openShortcuts(page);
  const row = section.locator('[data-shortcut="focusMode"]');
  await row.getByRole("button", { name: "Change" }).click();
  await expect(row.locator(".shortcut-chord")).toHaveText("Press keys…");
  await page.keyboard.press("Escape");
  await expect(row.locator(".shortcut-chord")).toHaveText("⇧⌘F");
  await expect(row.getByRole("button", { name: "Change" })).toBeVisible();
  await expect(row.getByRole("button", { name: "Reset" })).toBeDisabled();
  // Recording is over: a chord pressed now must not rebind anything.
  await page.keyboard.press("Meta+Shift+g");
  await expect(row.locator(".shortcut-chord")).toHaveText("⇧⌘F");
  expect(
    (await page.evaluate(() => localStorage.getItem("folio.workspace.shortcuts"))) ?? "",
  ).not.toContain("focusMode");
});

test("a chord with no Command, Control or Option is refused with a reason", async ({
  page,
}) => {
  await createProject(page, "Bare chord");
  const section = await openShortcuts(page);
  const row = section.locator('[data-shortcut="save"]');
  await row.getByRole("button", { name: "Change" }).click();
  await page.keyboard.press("g");
  await expect(section.getByRole("status")).toHaveText(
    "Add Command, Control or Option to that shortcut.",
  );
  await expect(row.locator(".shortcut-chord")).toHaveText("Press keys…");
  await page.keyboard.press("Escape");
  await expect(row.locator(".shortcut-chord")).toHaveText("⌘S");
  expect(
    (await page.evaluate(() => localStorage.getItem("folio.workspace.shortcuts"))) ?? "",
  ).not.toContain("save");
  // Control+S is the same press as Command+S, so another action cannot take it.
  const other = section.locator('[data-shortcut="newSection"]');
  await other.getByRole("button", { name: "Change" }).click();
  await page.keyboard.press("Control+s");
  await expect(section.getByRole("status")).toHaveText("That shortcut is taken by Save.");
});

test("Show formatting bar is listed with its default chord and obeys the chord rules", async ({
  page,
}) => {
  await createProject(page, "Toolbar chord");
  const section = await openShortcuts(page);
  const row = section.locator('[data-shortcut="focusToolbar"]');
  await expect(row.locator(".shortcut-chord")).toHaveText("⌥⌘T");
  await row.getByRole("button", { name: "Change" }).click();
  await page.keyboard.press("Meta+c");
  await expect(section.getByRole("status")).toHaveText("That shortcut is reserved by macOS.");
  await page.keyboard.press("Meta+Shift+f");
  await expect(section.getByRole("status")).toHaveText("That shortcut is taken by Focus mode.");
  await page.keyboard.press("Meta+Alt+j");
  await expect(row.locator(".shortcut-chord")).toHaveText("⌥⌘J");
});
