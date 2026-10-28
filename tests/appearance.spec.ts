import { test, expect } from "@playwright/test";

test("system appearance changes live and the writing area scrolls on its own", async ({
  page,
}) => {
  await page.emulateMedia({ colorScheme: "light" });
  await page.addInitScript(() =>
    localStorage.setItem("personal-word.restoreTabs", "true"),
  );
  await page.goto("/");
  await expect(page).toHaveTitle(/Personal Word/);
  await expect(page.locator(".brand")).toContainText("Personal Word");
  await expect(page.locator(".library")).toHaveCSS(
    "background-color",
    "rgb(255, 255, 255)",
  );
  await page.emulateMedia({ colorScheme: "dark", reducedMotion: "reduce" });
  await expect(page.locator(".library")).toHaveCSS(
    "background-color",
    "rgb(32, 32, 35)",
  );
  await page.getByRole("button", { name: "Start new project" }).click();
  await page.getByRole("button", { name: "Blank", exact: true }).click();
  await page.getByLabel("Project title").fill("Appearance check");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.locator(".workspace")).toHaveCSS(
    "background-color",
    "rgb(32, 32, 35)",
  );
  await page
    .getByRole("textbox", { name: "Writing editor" })
    .fill("A paragraph of writing.\n\n".repeat(100));
  await page.locator(".writer-scroll").evaluate((el) => {
    el.scrollTop = el.scrollHeight;
  });
  await expect
    .poll(() => page.locator(".writer-scroll").evaluate((el) => el.scrollTop))
    .toBeGreaterThan(100);
  await expect(
    page.getByRole("toolbar", { name: "Formatting" }),
  ).toBeInViewport();
  await expect(page.getByRole("progressbar")).toHaveCount(0);
  await page.getByRole("button", { name: "New section", exact: true }).click();
  await page.getByLabel("Title", { exact: true }).fill("Second section");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await page
    .getByRole("button", { name: "Read manuscript", exact: true })
    .click();
  await page.getByRole("button", { name: "Jump to Second section" }).click();
  await expect
    .poll(() => page.locator(".manuscript-read").evaluate((el) => el.scrollTop))
    .toBeGreaterThan(100);
  await page.screenshot({ path: "test-results/personal-word-dark.png" });
  await page.emulateMedia({ colorScheme: "light" });
  await expect(page.locator(".workspace")).toHaveCSS(
    "background-color",
    "rgb(255, 255, 255)",
  );
  await page.screenshot({ path: "test-results/personal-word-light.png" });
});

test("controls show hover, focus, pressed, disabled and selected states", async ({
  page,
}) => {
  await page.emulateMedia({ colorScheme: "light" });
  await page.goto("/");
  await page.getByRole("button", { name: "Start new project" }).click();
  await page.getByRole("button", { name: "Blank", exact: true }).click();
  await page.getByLabel("Project title").fill("States check");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  const snapshot = page.getByRole("button", { name: "Snapshot", exact: true });
  await snapshot.hover();
  // No grey box: hover keeps the fill clear and only the colour changes.
  await expect(snapshot).toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
  await expect(snapshot).toHaveCSS("color", "rgb(36, 36, 40)");
  await page.mouse.down();
  await expect(snapshot).toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
  await expect(snapshot).toHaveCSS("transform", "matrix(0.99, 0, 0, 0.99, 0, 0)");
  await page.mouse.up();
  await page.mouse.move(0, 0);
  const sidebarButton = page.locator(".sidebar button:visible").first();
  await sidebarButton.focus();
  await page.keyboard.press("Tab");
  await page.keyboard.press("Shift+Tab");
  await expect(sidebarButton).toBeFocused();
  await expect(sidebarButton).toHaveCSS("outline-width", "2px");
  await expect(
    page.getByRole("button", { name: "Move Manuscript up" }),
  ).toHaveCSS("opacity", "0.35");
  const selected = page.locator(".sidebar .entry-row.selected").first();
  await expect(selected).toHaveCSS("color", "rgb(36, 36, 40)");
  await expect(selected).toHaveCSS("font-weight", "600");
  const selectedEntry = page.locator(".sidebar .entry-row.selected .entry-main").first();
  const selectedBox = await selectedEntry.boundingBox();
  expect(selectedBox).not.toBeNull();
  await page.mouse.move(selectedBox!.x + selectedBox!.width / 2, selectedBox!.y + selectedBox!.height / 2);
  await page.mouse.down();
  await expect(selectedEntry).toHaveCSS("color", "rgb(36, 36, 40)");
  await page.mouse.up();
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect(page.locator(".group-chevron").first()).toHaveCSS(
    "transition-duration",
    "0s",
  );
});

async function openSettings(page: import("@playwright/test").Page, title: string) {
  await page.goto("/");
  await page.getByRole("button", { name: "Start new project" }).click();
  await page.getByRole("button", { name: "Blank", exact: true }).click();
  await page.getByLabel("Project title").fill(title);
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await page.locator(".group-title").filter({ hasText: /^Settings$/ }).click();
}

const KEY = "folio.workspace.appearance";

test("choosing Dark under a light system sticks across a reload", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "light" });
  await openSettings(page, "Dark choice");
  const dark = page.getByRole("button", { name: "Dark", exact: true });
  await dark.click();
  await expect(dark).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await expect(page.locator(".workspace")).toHaveCSS("background-color", "rgb(32, 32, 35)");
  await page.screenshot({ path: "test-results/appearance-forced-dark.png" });
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await expect(page.locator(".library")).toHaveCSS("background-color", "rgb(32, 32, 35)");
  const stored = await page.evaluate((key) => localStorage.getItem(key), KEY);
  expect(JSON.parse(stored!)).toEqual({
    theme: "dark",
    palette: "plain",
    sections: { manuscript: "blue", fragments: "green", research: "orange" },
  });
});

test("choosing Light under a dark system overrides the system", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "dark" });
  await openSettings(page, "Light choice");
  await page.getByRole("button", { name: "Light", exact: true }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await expect(page.locator(".workspace")).toHaveCSS("background-color", "rgb(255, 255, 255)");
  await page.screenshot({ path: "test-results/appearance-forced-light.png" });
});

test("choosing System again follows the operating system live", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "light" });
  await openSettings(page, "System choice");
  await page.getByRole("button", { name: "Dark", exact: true }).click();
  await expect(page.locator(".workspace")).toHaveCSS("background-color", "rgb(32, 32, 35)");
  const system = page.getByRole("button", { name: "System", exact: true });
  await system.click();
  await expect(system).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator("html")).not.toHaveAttribute("data-theme", /.*/);
  await expect(page.locator(".workspace")).toHaveCSS("background-color", "rgb(255, 255, 255)");
  await page.emulateMedia({ colorScheme: "dark" });
  await expect(page.locator(".workspace")).toHaveCSS("background-color", "rgb(32, 32, 35)");
});

test("Cmd/Ctrl+Shift+L flips between Light and Dark on the Projects screen", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "light" });
  await page.goto("/");
  await expect(page.locator(".library")).toHaveCSS("background-color", "rgb(255, 255, 255)");
  await page.keyboard.press("ControlOrMeta+Shift+L");
  await expect(page.locator(".library")).toHaveCSS("background-color", "rgb(32, 32, 35)");
  await page.keyboard.press("ControlOrMeta+Shift+L");
  await expect(page.locator(".library")).toHaveCSS("background-color", "rgb(255, 255, 255)");
});

test("the Appearance row has no caption and its buttons use arrow keys", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "light" });
  await openSettings(page, "Row check");
  const row = page.locator(".settings-field").filter({ has: page.getByRole("group", { name: "Appearance" }) });
  await expect(row.locator(".settings-help")).toHaveCount(0);
  await expect(row.locator(".settings-label")).toHaveText("Appearance");
  await expect(row.locator("button")).toHaveText(["System", "Light", "Dark"]);
  await expect(row.locator("button").first()).toHaveCSS("border-radius", "0px");
  const system = page.getByRole("button", { name: "System", exact: true });
  await system.focus();
  await page.keyboard.press("Tab");
  await page.keyboard.press("Shift+Tab");
  await expect(system).toBeFocused();
  await expect(system).toHaveCSS("outline-width", "2px");
  await page.keyboard.press("ArrowRight");
  await expect(page.getByRole("button", { name: "Light", exact: true })).toBeFocused();
  await expect(page.getByRole("button", { name: "Light", exact: true })).toHaveAttribute("aria-pressed", "true");
  await page.keyboard.press("ArrowRight");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.keyboard.press("ArrowRight");
  await expect(system).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator("html")).not.toHaveAttribute("data-theme", /.*/);
  await page.screenshot({ path: "test-results/appearance-focus-ring.png" });
});

test("a segmented choice is weight and colour, not a fill, and Home/End jump the ends", async ({
  page,
}) => {
  await page.emulateMedia({ colorScheme: "light" });
  await openSettings(page, "Segmented keys");
  const group = page.getByRole("group", { name: "Appearance" });
  const system = group.getByRole("button", { name: "System", exact: true });
  const dark = group.getByRole("button", { name: "Dark", exact: true });
  // The pressed segment: semibold accent text on no fill; the sliding box is gone.
  await expect(group.locator(".segmented-highlight")).toHaveCount(0);
  await expect(system).toHaveAttribute("aria-pressed", "true");
  await expect(system).toHaveCSS("font-weight", "600");
  await expect(system).toHaveCSS("color", "rgb(0, 105, 217)");
  await expect(system).toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
  // Roving tabindex: only the chosen segment is in the tab order.
  await expect(system).toHaveAttribute("tabindex", "0");
  await expect(dark).toHaveAttribute("tabindex", "-1");
  await system.focus();
  await page.keyboard.press("End");
  await expect(dark).toBeFocused();
  await expect(dark).toHaveAttribute("aria-pressed", "true");
  await expect(dark).toHaveAttribute("tabindex", "0");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.keyboard.press("Home");
  await expect(system).toBeFocused();
  await expect(system).toHaveAttribute("aria-pressed", "true");
});

// ---- Palette: Plain / Color -------------------------------------------------

async function openProject(page: import("@playwright/test").Page, title: string) {
  await page.goto("/");
  await page.getByRole("button", { name: "Start new project" }).click();
  await page.getByRole("button", { name: "Blank", exact: true }).click();
  await page.getByLabel("Project title").fill(title);
  await page.getByRole("button", { name: "Save", exact: true }).click();
}

async function choosePalette(page: import("@playwright/test").Page, name: "Plain" | "Color") {
  await page.locator(".group-title").filter({ hasText: /^Settings$/ }).click();
  await page.getByRole("group", { name: "Palette" }).getByRole("button", { name, exact: true }).click();
}

test("Plain palette keeps today's blue primary button", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "light" });
  await page.goto("/");
  await page.getByRole("button", { name: "Start new project" }).click();
  await page.getByRole("button", { name: "Blank", exact: true }).click();
  const save = page.getByRole("button", { name: "Save", exact: true });
  await expect(page.locator("html")).not.toHaveAttribute("data-palette", /.*/);
  await expect(save).toHaveCSS("background-color", "rgb(0, 105, 217)");
  await expect(save).toHaveCSS("color", "rgb(255, 255, 255)");
});

test("the Palette row sits under Appearance with no caption and Plain selected", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "light" });
  await openProject(page, "Palette row");
  await page.locator(".group-title").filter({ hasText: /^Settings$/ }).click();
  const row = page.locator(".settings-field").filter({ has: page.getByRole("group", { name: "Palette" }) });
  await expect(row.locator(".settings-help")).toHaveCount(0);
  await expect(row.locator(".settings-label")).toHaveText("Palette");
  await expect(row.locator("button")).toHaveText(["Plain", "Color"]);
  await expect(page.getByRole("button", { name: "Plain", exact: true })).toHaveAttribute("aria-pressed", "true");
  const labels = await page.locator(".settings-field .settings-label").allTextContents();
  expect(labels.indexOf("Palette")).toBe(labels.indexOf("Appearance") + 1);
});

test("Color palette tints the interface in light and keeps the document colours", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "light" });
  await openProject(page, "Color light");
  await choosePalette(page, "Color");
  await expect(page.getByRole("button", { name: "Color", exact: true })).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator("html")).toHaveAttribute("data-palette", "color");
  expect(JSON.parse((await page.evaluate((k) => localStorage.getItem(k), KEY))!)).toEqual({
    theme: "system",
    palette: "color",
    sections: { manuscript: "blue", fragments: "green", research: "orange" },
  });
  // Saved check is green.
  await expect(page.locator(".save-status.saved svg")).toHaveCSS("color", "rgb(30, 116, 52)");
  // Section icons carry the tint; Read, Comments, History and Settings stay accent blue.
  const group = (id: string) => page.locator(`.sidebar-group[data-group="${id}"]`);
  await expect(group("manuscript").locator(".group-title svg").first()).toHaveCSS("color", "rgb(0, 98, 205)");
  await expect(group("fragments").locator(".group-title svg").first()).toHaveCSS("color", "rgb(30, 116, 52)");
  await expect(group("research").locator(".group-title svg").first()).toHaveCSS("color", "rgb(149, 86, 0)");
  // Selected rows: Manuscript entry blue and semibold, Research title orange, Settings stays accent.
  await page.locator('.sidebar-group[data-group="manuscript"] .entry-row .entry-main').first().click();
  const selected = page.locator(".sidebar .entry-row.selected").first();
  await expect(selected).toHaveCSS("color", "rgb(0, 98, 205)");
  await expect(selected.locator(".entry-main")).toHaveCSS("color", "rgb(0, 98, 205)");
  await expect(selected.locator(".entry-main")).toHaveCSS("font-weight", "600");
  await group("research").locator(".group-title").click();
  await expect(group("research").locator(".group-title")).toHaveCSS("color", "rgb(149, 86, 0)");
  await expect(group("research").locator(".group-title")).toHaveCSS("font-weight", "600");
  await page.locator(".group-title").filter({ hasText: /^Settings$/ }).click();
  await expect(group("settings").locator(".group-title")).toHaveCSS("color", "rgb(0, 98, 205)");
  await expect(group("settings").locator(".group-title")).toHaveCSS("font-weight", "600");
  // Fragments: a selected fragment takes the green tint.
  await page.getByRole("button", { name: "New fragment", exact: true }).click();
  const title = page.getByLabel("Title", { exact: true });
  if (await title.count()) {
    await title.fill("Tint fragment");
    await page.getByRole("button", { name: "Save", exact: true }).click();
  }
  await expect(page.locator('.sidebar-group[data-group="fragments"] .entry-row.selected')).toHaveCSS(
    "color",
    "rgb(30, 116, 52)",
  );
  // The document area keeps today's accent and danger colours.
  await page.locator(".writer-scroll").first().waitFor();
  const docAccent = await page.locator(".writer-scroll").first().evaluate((el) =>
    getComputedStyle(el).getPropertyValue("--accent").trim(),
  );
  expect(docAccent).toBe("#0069d9");
  const docDanger = await page.locator(".writer-scroll").first().evaluate((el) =>
    getComputedStyle(el).getPropertyValue("--danger").trim(),
  );
  expect(docDanger).toBe("#b42318");
  // Active toolbar toggle is the Color blue.
  await page.getByRole("textbox", { name: "Writing editor" }).fill("Bold me");
  await page.getByRole("textbox", { name: "Writing editor" }).press("ControlOrMeta+a");
  await page.keyboard.press("ControlOrMeta+b");
  const bold = page.getByRole("toolbar", { name: "Formatting" }).locator('button[aria-pressed="true"]').first();
  await expect(bold).toHaveCSS("color", "rgb(0, 98, 205)");
  await page.screenshot({ path: "test-results/palette-color-light.png" });
  // Reload keeps Color.
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-palette", "color");
});

test("Color palette fills primary buttons blue and destructive confirms red", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "light" });
  await page.goto("/");
  await page.getByRole("button", { name: "Start new project" }).click();
  await page.getByRole("button", { name: "Blank", exact: true }).click();
  await page.getByLabel("Project title").fill("Fill check");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await choosePalette(page, "Color");
  await page.getByRole("button", { name: "Projects", exact: true }).first().click();
  await page.getByRole("button", { name: "Start new project" }).click();
  await page.getByRole("button", { name: "Blank", exact: true }).click();
  const save = page.getByRole("button", { name: "Save", exact: true });
  await expect(save).toHaveCSS("background-color", "rgb(0, 114, 239)");
  await expect(save).toHaveCSS("color", "rgb(255, 255, 255)");
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await page.getByRole("button", { name: "Delete project Fill check" }).click();
  const confirm = page.getByRole("button", { name: "Delete project", exact: true });
  await expect(confirm).toHaveCSS("background-color", "rgb(237, 13, 0)");
  await expect(confirm).toHaveCSS("color", "rgb(255, 255, 255)");
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
});

test("Color palette in dark uses the dark tints", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "dark" });
  await openProject(page, "Color dark");
  await choosePalette(page, "Color");
  await page.locator('.sidebar-group[data-group="manuscript"] .entry-row .entry-main').first().click();
  await expect(page.locator(".sidebar .entry-row.selected").first()).toHaveCSS("color", "rgb(65, 160, 255)");
  await expect(page.locator(".save-status.saved svg")).toHaveCSS("color", "rgb(48, 209, 88)");
  await expect(
    page.locator('.sidebar-group[data-group="research"] .group-title svg').first(),
  ).toHaveCSS("color", "rgb(255, 159, 10)");
  await page.getByRole("button", { name: "Projects", exact: true }).first().click();
  await page.getByRole("button", { name: "Start new project" }).click();
  await page.getByRole("button", { name: "Blank", exact: true }).click();
  await expect(page.getByRole("button", { name: "Save", exact: true })).toHaveCSS(
    "background-color",
    "rgb(0, 116, 232)",
  );
  await page.screenshot({ path: "test-results/palette-color-dark.png" });
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
});

test("Choosing Plain again restores Plain selected text color", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "light" });
  await openProject(page, "Back to plain");
  await choosePalette(page, "Color");
  await expect(page.locator("html")).toHaveAttribute("data-palette", "color");
  await page.getByRole("button", { name: "Plain", exact: true }).click();
  await expect(page.locator("html")).not.toHaveAttribute("data-palette", /.*/);
  await page.locator('.sidebar-group[data-group="manuscript"] .entry-row .entry-main').first().click();
  await expect(page.locator(".sidebar .entry-row.selected").first()).toHaveCSS("color", "rgb(36, 36, 40)");
  await expect(page.locator('.sidebar-group[data-group="research"] .group-title svg').first()).toHaveCSS(
    "color",
    "rgb(36, 36, 40)",
  );
});

test("a selected entry is bold alone: its section title steps back and no highlight box shows", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "light" });
  await page.goto("/");
  await page.getByRole("button", { name: "Start new project" }).click();
  await page.getByRole("button", { name: "Blank", exact: true }).click();
  await page.getByLabel("Project title").fill("Doubling check");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  const hasHas = await page.evaluate(() => CSS.supports("selector(:has(*))"));
  test.skip(!hasHas, "engine without :has");

  const entry = page.locator('.sidebar-group[data-group="manuscript"] .entry-row .entry-main').first();
  await entry.click();
  const selectedRow = page.locator('.sidebar-group[data-group="manuscript"] .entry-row.selected');
  await expect(selectedRow.locator(".entry-main")).toHaveCSS("font-weight", "600");
  await expect(page.locator('.sidebar-group[data-group="manuscript"] .group-title')).not.toHaveCSS("font-weight", "600");
  for (const box of await page.locator(".sidebar-highlight, .segmented-highlight").all()) {
    await expect(box).toBeHidden();
  }
});

for (const mode of [
  { name: "light", colorScheme: "light" as const, purple: "rgb(154, 40, 212)", plain: "rgb(36, 36, 40)" },
  { name: "dark", colorScheme: "dark" as const, purple: "rgb(202, 117, 244)", plain: "rgb(237, 237, 240)" },
]) {
  test(`section swatches persist and Plain hides them in ${mode.name}`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: mode.colorScheme });
    await openProject(page, `Section swatches ${mode.name}`);
    await choosePalette(page, "Color");
    const settings = page.locator(".project-settings");
    await expect(settings.getByText("Section colours", { exact: true })).toBeVisible();
    const generalLabels = await settings.locator(".settings-section").first().locator(".settings-label").allTextContents();
    expect(generalLabels.slice(generalLabels.indexOf("Palette"), generalLabels.indexOf("Palette") + 2)).toEqual(["Palette", "Section colours"]);
    const sectionRow = settings.locator(".settings-field").filter({ hasText: "Section colours" });
    await expect(sectionRow.locator(".settings-help")).toHaveCount(0);
    const manuscriptColour = page.getByRole("button", { name: "Manuscript colour" });
    await manuscriptColour.click();
    await page.getByRole("option", { name: "Purple" }).click();
    await expect(page.locator("html")).toHaveAttribute("data-tint-manuscript", "purple");
    await expect(page.locator('.sidebar-group[data-group="manuscript"] .group-title svg').first()).toHaveCSS("color", mode.purple);
    const saved = JSON.parse((await page.evaluate((key) => localStorage.getItem(key), KEY))!);
    expect(saved.sections).toEqual({ manuscript: "purple", fragments: "green", research: "orange" });

    await page.reload();
    await expect(page.locator("html")).toHaveAttribute("data-tint-manuscript", "purple");
    await openProject(page, `Section swatches reload ${mode.name}`);
    await expect(page.locator('.sidebar-group[data-group="manuscript"] .group-title svg').first()).toHaveCSS("color", mode.purple);
    await choosePalette(page, "Plain");
    await expect(page.getByText("Section colours", { exact: true })).toHaveCount(0);
    await expect(page.locator('.sidebar-group[data-group="manuscript"] .group-title svg').first()).toHaveCSS("color", mode.plain);
  });
}

// Icon-only buttons: hover/focus -> text, pressed -> accent, trash hover and
// keyboard focus -> danger. These fail when the base muted rule out-ranks the
// state rules (a specificity bug the old Snapshot-hover check could not see).
async function tokenColor(page: import("@playwright/test").Page, token: string) {
  return page.evaluate((t) => {
    const probe = document.createElement("span");
    probe.style.color = `var(${t})`;
    document.body.appendChild(probe);
    const value = getComputedStyle(probe).color;
    probe.remove();
    return value;
  }, token);
}

for (const scheme of ["light", "dark"] as const) {
  test(`icon buttons recolour on hover, focus and press (${scheme})`, async ({
    page,
  }) => {
    await page.emulateMedia({ colorScheme: scheme, reducedMotion: "reduce" });
    await page.goto("/");
    await page.getByRole("button", { name: "Start new project" }).click();
    await page.getByRole("button", { name: "Blank", exact: true }).click();
    await page.getByLabel("Project title").fill("Icon colours");
    await page.getByRole("button", { name: "Save", exact: true }).click();
    const text = await tokenColor(page, "--text");
    const muted = await tokenColor(page, "--muted");
    const accent = await tokenColor(page, "--accent");
    const danger = await tokenColor(page, "--danger");
    expect(new Set([text, muted, accent, danger]).size).toBe(4);

    // Reorder arrow: muted at rest, text on hover.
    const row = page.locator(".sidebar .entry-row, .sidebar .group-title").first();
    await row.hover();
    const arrow = page.locator(".sidebar .reorder button:not(:disabled)").first();
    await expect(arrow).toBeVisible();
    await arrow.hover();
    await expect.soft(arrow).toHaveCSS("color", text);

    // Pressed icon: the pinned-sidebar toggle reads accent when aria-pressed.
    const pin = page.locator(".sidebar-pin");
    if ((await pin.getAttribute("aria-pressed")) !== "true") await pin.click();
    await expect(pin).toHaveAttribute("aria-pressed", "true");
    await page.mouse.move(600, 400);
    await expect.soft(pin).toHaveCSS("color", accent);
    await pin.click(); // restore the default
    await page.mouse.move(600, 400);
    await expect.soft(pin).toHaveCSS("color", muted);

    // Trash on the Projects screen: muted, danger on hover and on keyboard focus.
    await page.getByRole("button", { name: "Projects", exact: true }).click();
    const trash = page.locator(".project-row .delete-entry").first();
    await page.locator(".project-row").first().hover();
    await trash.hover();
    await expect.soft(trash).toHaveCSS("color", danger);
    await page.mouse.move(0, 0);
    await trash.focus();
    await page.keyboard.press("Shift+Tab");
    await page.keyboard.press("Tab");
    await expect(trash).toBeFocused();
    await expect.soft(trash).toHaveCSS("color", danger);
  });
}
