import { test, expect, type Page } from "@playwright/test";

async function createProject(page: Page, title: string) {
  await page.getByRole("button", { name: "Start new project" }).click();
  await page.getByRole("button", { name: "Blank", exact: true }).click();
  await page.getByLabel("Project title").fill(title);
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(
    page.getByRole("textbox", { name: "Writing editor", exact: true }),
  ).toBeVisible();
}

async function addSection(page: Page, title: string) {
  await page.getByRole("button", { name: "New section", exact: true }).click();
  await page.getByLabel("Title", { exact: true }).fill(title);
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
}

const row = (page: Page, title: string) =>
  page.locator(".sidebar .entry-main").filter({ hasText: new RegExp("^" + title) });

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.addInitScript(() =>
    localStorage.setItem("personal-word.restoreTabs", "true"),
  );
});

test("split view: two panes, one format bar, focus routing, per-pane undo, persistence", async ({
  page,
}, testInfo) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await createProject(page, "Split fixture");
  await addSection(page, "One");
  await addSection(page, "Two");
  await row(page, "One").click();
  const crumb = page.getByRole("button", { name: "Rename section" });
  await expect(crumb).toHaveText("One");

  // Cmd/Ctrl+click opens the entry beside; the right pane takes focus.
  await row(page, "Two").click({ modifiers: ["ControlOrMeta"] });
  await expect(page.locator(".split-pane")).toHaveCount(2);
  await expect(page.locator('.split-pane[data-side="right"]')).toHaveAttribute("data-focused", "");
  await expect(crumb).toHaveText("Two");
  await expect(page.locator(".format-bar")).toHaveCount(1);
  await expect(page.locator(".split-toolbar .format-bar")).toHaveCount(1);
  await expect(page.locator('.split-pane[data-side="right"] .split-pane-title')).toHaveText("Two");

  const left = page.getByRole("textbox", { name: "Writing editor", exact: true });
  const right = page.getByRole("textbox", { name: "Writing editor, right pane" });
  await right.click();
  await page.keyboard.type("Right words here");
  await expect(right).toContainText("Right words here");
  await expect(left).not.toContainText("Right words");

  // Clicking the left editor moves focus, the breadcrumb and the bar.
  await left.click();
  await expect(crumb).toHaveText("One");
  await expect(page.locator('.split-pane[data-side="left"]')).toHaveAttribute("data-focused", "");
  await expect(page.locator(".format-bar")).toHaveCount(1);
  await page.keyboard.type("Left words here");
  await page.keyboard.press("ControlOrMeta+a");
  await page.keyboard.press("ControlOrMeta+b");
  await expect(left.locator("strong")).toHaveText("Left words here");
  await expect(right.locator("strong")).toHaveCount(0);
  await expect(right).toContainText("Right words here");

  // Undo in the right pane undoes only the right pane's typing.
  await right.click();
  await expect(crumb).toHaveText("Two");
  await page.keyboard.press("ControlOrMeta+z");
  await expect(right).not.toContainText("Right words here");
  await expect(left.locator("strong")).toHaveText("Left words here");
  await page.keyboard.type("Kept right text");
  await expect(right).toContainText("Kept right text");
  await expect(left).toContainText("Left words here");

  await page.screenshot({ path: testInfo.outputPath("split-light.png") });
  await page.emulateMedia({ colorScheme: "dark" });
  await page.screenshot({ path: testInfo.outputPath("split-dark.png") });
  await page.emulateMedia({ colorScheme: "light" });

  // Both panes' edits are saved; the split comes back with the same focus.
  await expect(page.locator(".save-status")).toHaveText("Saved", { timeout: 10_000 });
  await page.reload();
  await expect(page.locator(".split-pane")).toHaveCount(2);
  await expect(page.locator('.split-pane[data-side="right"]')).toHaveAttribute("data-focused", "");
  await expect(crumb).toHaveText("Two");
  await expect(right).toContainText("Kept right text");
  await expect(left.locator("strong")).toHaveText("Left words here");

  // Dragging the divider changes the global ratio.
  const divider = page.getByRole("separator", { name: "Resize split view" });
  await expect(divider).toHaveAttribute("aria-valuenow", "50");
  const box = (await divider.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x - 150, box.y + box.height / 2, { steps: 8 });
  await page.mouse.up();
  const ratio = await page.evaluate(() => localStorage.getItem("personal-word.splitRatio"));
  expect(Number(ratio)).toBeGreaterThan(0.25);
  expect(Number(ratio)).toBeLessThan(0.5);
  await divider.focus();
  await page.keyboard.press("ArrowRight");
  const nudged = await page.evaluate(() => Number(localStorage.getItem("personal-word.splitRatio")));
  expect(nudged).toBeCloseTo(Number(ratio) + 0.02, 5);
  await page.screenshot({ path: testInfo.outputPath("split-divider.png") });

  // The ratio is global: a split in another project uses it.
  await page.getByRole("button", { name: "Projects", exact: true }).first().click();
  await createProject(page, "Second split fixture");
  await addSection(page, "Three");
  await row(page, "Opening").click({ modifiers: ["ControlOrMeta"] });
  await expect(page.locator(".split-pane")).toHaveCount(2);
  await expect(divider).toHaveAttribute("aria-valuenow", String(Math.round(nudged * 100)));

  // Back in the first project its own split is restored.
  await page.getByRole("button", { name: "Projects", exact: true }).first().click();
  await page
    .locator(".project-row")
    .filter({ hasText: /^Split fixture/ })
    .locator("button")
    .first()
    .click();
  await expect(page.locator(".split-pane")).toHaveCount(2);
  await expect(crumb).toHaveText("Two");

  // Close: one pane, the left entry is active.
  await page.getByRole("button", { name: "Close right pane" }).click();
  await expect(page.locator('.split-pane[data-side="right"]')).toHaveCount(0);
  await expect(crumb).toHaveText("One");
  await expect(page.locator(".format-bar")).toHaveCount(1);
  await expect(page.getByRole("textbox", { name: "Writing editor", exact: true })).toContainText(
    "Left words here",
  );

  // Cmd/Ctrl+click on the entry already shown on the left does not split.
  await row(page, "One").click({ modifiers: ["ControlOrMeta"] });
  await expect(page.locator('.split-pane[data-side="right"]')).toHaveCount(0);
  await expect(crumb).toHaveText("One");

  // A plain click inside a split replaces the focused pane, never duplicates.
  await row(page, "Two").click({ modifiers: ["ControlOrMeta"] });
  await expect(page.locator(".split-pane")).toHaveCount(2);
  await row(page, "One").click();
  await expect(crumb).toHaveText("One");
  await expect(page.locator('.split-pane[data-side="left"]')).toHaveAttribute("data-focused", "");
  await expect(page.locator('.split-pane[data-side="right"] .split-pane-title')).toHaveText("Two");
  expect(errors).toEqual([]);
});

test("split view: the shared bar's menus open in place and act on the focused pane", async ({
  page,
}, testInfo) => {
  // The shared bar is icons-only since E1, so at the fixture's default 1440 the
  // whole toolbar fits and there is no More button at all (bar 1170 px wide).
  // This case is about the menus that live in the More panel, and the marks
  // group only overflows below about 1040 px: at 980 the bar is 710 px, More
  // carries Bold, Italic, Underline and Strikethrough, and the font control the
  // second half of this test needs is still in the bar.
  await page.setViewportSize({ width: 980, height: 900 });
  await page.goto("/");
  await createProject(page, "Split menus fixture");
  await addSection(page, "One");
  await addSection(page, "Two");
  await row(page, "One").click();
  await row(page, "Two").click({ modifiers: ["ControlOrMeta"] });
  await expect(page.locator(".split-pane")).toHaveCount(2);
  const left = page.getByRole("textbox", { name: "Writing editor", exact: true });
  const right = page.getByRole("textbox", { name: "Writing editor, right pane" });
  await right.click();
  await page.keyboard.type("Right sample");
  await left.click();
  await page.keyboard.type("Left sample");
  await page.keyboard.press("ControlOrMeta+a");

  const bar = page.getByRole("toolbar", { name: "Formatting" });
  const more = bar.getByRole("button", { name: "More formatting", exact: true });
  await more.click();
  const menu = page.getByRole("dialog", { name: "More formatting" });
  await expect(menu).toBeVisible();
  // The fixture must actually put the marks group in the panel, or the rest of
  // this case would test the main bar instead. Fail here in seconds, not 90.
  await expect(menu.getByRole("button", { name: /^Bold/ })).toBeVisible();
  const trigger = (await more.boundingBox())!;
  const panel = (await menu.boundingBox())!;
  expect(panel.y).toBeGreaterThanOrEqual(trigger.y + trigger.height - 1);
  expect(panel.y).toBeLessThan(trigger.y + trigger.height + 24);
  await page.evaluate(() =>
    Promise.all(document.getAnimations().map((a) => a.finished.catch(() => undefined))),
  );
  await page.screenshot({ path: testInfo.outputPath("split-more.png") });
  await menu.getByRole("button", { name: /^Bold/ }).click();
  await expect(left.locator("strong")).toHaveText("Left sample");
  await expect(right.locator("strong")).toHaveCount(0);

  // The font dropdown opens under its button and changes only the left pane.
  await left.click();
  await expect(menu).toHaveCount(0);
  await page.keyboard.press("ControlOrMeta+a");
  const font = page.getByRole("button", { name: "Font family", exact: true });
  await font.click();
  const list = page.getByRole("listbox", { name: "Font family" });
  await expect(list).toBeVisible();
  const fontBox = (await font.boundingBox())!;
  const listBox = (await list.boundingBox())!;
  expect(listBox.y).toBeGreaterThanOrEqual(fontBox.y + fontBox.height - 1);
  await list.getByRole("option", { name: "Georgia" }).click();
  await expect(left.locator('span[style*="Georgia"]').first()).toBeVisible();
  await expect(right.locator('span[style*="Georgia"]')).toHaveCount(0);
});

// Data safety with two live editors (T110 cycle 2). Each case first proves the
// text was saved, then that it survives later typing in the pane editors.
async function storedProject(page: Page) {
  return page.evaluate(() => {
    const key = Object.keys(localStorage).find((k) => k.startsWith("folio.preview.project."));
    return JSON.parse(localStorage.getItem(key!)!) as {
      id: string;
      entries: { title: string; kind: string; text: string }[];
    };
  });
}
const storedText = (p: { entries: { title: string; text: string }[] }, title: string) =>
  p.entries.find((e) => e.title === title)?.text ?? "";
const saved = (page: Page) =>
  expect(page.locator(".save-status")).toHaveText("Saved", { timeout: 15_000 });
const leftEditor = (page: Page) =>
  page.getByRole("textbox", { name: "Writing editor", exact: true });
const rightEditor = (page: Page) =>
  page.getByRole("textbox", { name: "Writing editor, right pane" });

async function keepFragment(page: Page, text: string) {
  const editor = leftEditor(page);
  await editor.fill(text);
  await editor.press("ControlOrMeta+a");
  await page.getByRole("button", { name: "Keep as fragment" }).click();
}

test("split safety: a fragment live in a pane is read-only in the Fragments panel", async ({ page }) => {
  await page.goto("/");
  await createProject(page, "Split frag fixture");
  await keepFragment(page, "Frag base text");
  await addSection(page, "One");
  await row(page, "One").click();
  await row(page, "Frag base text").click({ modifiers: ["ControlOrMeta"] });
  await expect(page.locator(".split-pane")).toHaveCount(2);
  await leftEditor(page).click(); // the fragment is now in the unfocused pane
  await page.locator(".group-title").filter({ hasText: /^Fragments$/ }).click();
  await expect(page.locator(".fragment-library")).toBeVisible();
  await expect(page.locator(".split-pane")).toHaveCount(2);
  const card = page.getByRole("textbox", { name: "Fragment text: Frag base text" });
  await expect(card).toHaveAttribute("contenteditable", "false");
  await expect(page.locator(".fragment-library")).toContainText("Open in the main editor. Edit it there.");

  await rightEditor(page).click();
  await page.keyboard.press("ControlOrMeta+End");
  await page.keyboard.type(" PANE EDIT");
  await saved(page);
  const frag = (await storedProject(page)).entries.find((e) => e.kind === "fragment")!;
  expect(frag.text).toContain("Frag base text PANE EDIT");

  // Open in editor focuses the pane that already shows the fragment.
  await leftEditor(page).click();
  await page.getByRole("button", { name: "Open in editor" }).click();
  await expect(page.locator(".split-pane")).toHaveCount(2);
  await expect(page.locator('.split-pane[data-side="right"]')).toHaveAttribute("data-focused", "");
  await expect(page.locator('.split-pane[data-side="right"] .split-pane-title')).toHaveText("Frag base text");
});

test("split safety: Append to section from the fragment pane goes through the left editor", async ({ page }) => {
  await page.goto("/");
  await createProject(page, "Split append fixture");
  await keepFragment(page, "Appendable words");
  await addSection(page, "One");
  await row(page, "One").click();
  await leftEditor(page).click();
  await page.keyboard.type("Section start");
  await row(page, "Appendable words").click({ modifiers: ["ControlOrMeta"] });
  await expect(page.locator(".split-pane")).toHaveCount(2);
  await page.getByRole("button", { name: "Restore fragment to section" }).click();
  await page.getByRole("option", { name: "One" }).click();
  await page.getByRole("button", { name: /Append to section/ }).click();
  await saved(page);
  expect(storedText(await storedProject(page), "One")).toContain("Appendable words");
  await expect(leftEditor(page)).toContainText("Appendable words");
  // The append moves focus to the pane holding the section: active stays activeOf(split).
  await expect(page.locator('.split-pane[data-side="left"]')).toHaveAttribute("data-focused", "");
  await expect(page.getByRole("button", { name: "Rename section" })).toHaveText("One");
  await expect(page.locator(".split-pane")).toHaveCount(2);

  await leftEditor(page).click();
  await page.keyboard.press("ControlOrMeta+End");
  await page.keyboard.type(" more");
  await saved(page);
  const text = storedText(await storedProject(page), "One");
  expect(text).toContain("Section start");
  expect(text).toContain("Appendable words");
  expect(text).toContain("more");
});

test("split safety: Fragments panel Append into the unfocused pane's section is kept", async ({ page }) => {
  await page.goto("/");
  await createProject(page, "Split panel append fixture");
  await keepFragment(page, "Panel words");
  await addSection(page, "One");
  await addSection(page, "Two");
  await row(page, "One").click();
  await leftEditor(page).click();
  await page.keyboard.type("Left start");
  await row(page, "Two").click({ modifiers: ["ControlOrMeta"] });
  await rightEditor(page).click(); // One is open but unfocused on the left
  await page.locator(".group-title").filter({ hasText: /^Fragments$/ }).click();
  await expect(page.locator(".fragment-library")).toBeVisible();
  await page.getByRole("button", { name: "Section to append Panel words to" }).click();
  await page.getByRole("option", { name: "One" }).click();
  await page.getByRole("button", { name: "Append Panel words to section" }).click();
  await saved(page);
  expect(storedText(await storedProject(page), "One")).toContain("Panel words");
  await expect(leftEditor(page)).toContainText("Panel words");

  await leftEditor(page).click();
  await page.keyboard.press("ControlOrMeta+End");
  await page.keyboard.type(" later");
  await saved(page);
  const text = storedText(await storedProject(page), "One");
  expect(text).toContain("Left start");
  expect(text).toContain("Panel words");
  expect(text).toContain("later");
});

test("split safety: deleting a pane's entry closes the split; Cmd+click still opens beside", async ({ page }) => {
  await page.goto("/");
  await createProject(page, "Split prune fixture");
  await addSection(page, "One");
  await addSection(page, "Two");
  await addSection(page, "Three");
  await row(page, "One").click();
  await row(page, "Two").click({ modifiers: ["ControlOrMeta"] });
  await expect(page.locator(".split-pane")).toHaveCount(2);
  await leftEditor(page).click();
  await expect(page.getByRole("button", { name: "Rename section" })).toHaveText("One");
  await page.getByRole("button", { name: "Delete section" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Delete section" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.locator('.split-pane[data-side="right"]')).toHaveCount(0);
  const stale = await page.evaluate(() =>
    Object.keys(localStorage).filter((k) => k.startsWith("personal-word.split.")),
  );
  expect(stale).toEqual([]);

  await row(page, "Three").click({ modifiers: ["ControlOrMeta"] });
  await expect(page.locator(".split-pane")).toHaveCount(2);
  await expect(page.locator('.split-pane[data-side="right"] .split-pane-title')).toHaveText("Three");
  // The surviving pane's entry (Two) became the left pane.
  await leftEditor(page).click();
  await expect(page.getByRole("button", { name: "Rename section" })).toHaveText("Two");
  await rightEditor(page).click();
  await expect(page.getByRole("button", { name: "Rename section" })).toHaveText("Three");
});

test("split jumps: New section opens in the focused pane; the split stays and pane edits stay put", async ({ page }) => {
  await page.goto("/");
  await createProject(page, "Split jump fixture");
  await addSection(page, "One");
  await addSection(page, "Two");
  await row(page, "One").click();
  await leftEditor(page).click();
  await page.keyboard.type("One words");
  await row(page, "Two").click({ modifiers: ["ControlOrMeta"] });
  await rightEditor(page).click();
  await page.keyboard.type("Two words");
  await addSection(page, "Three");
  // The new section replaces the focused (right) pane; the left pane keeps One.
  await expect(page.locator(".split-pane")).toHaveCount(2);
  await expect(page.locator('.split-pane[data-side="right"]')).toHaveAttribute("data-focused", "");
  await expect(page.locator('.split-pane[data-side="right"] .split-pane-title')).toHaveText("Three");
  await expect(page.getByRole("button", { name: "Rename section" })).toHaveText("Three");
  await expect(leftEditor(page)).toContainText("One words");
  const editor = rightEditor(page);
  await editor.click();
  await page.keyboard.type("Three words");
  await editor.press("ControlOrMeta+a");
  await page.getByRole("button", { name: "Keep as fragment" }).click();
  await saved(page);
  const p = await storedProject(page);
  expect(storedText(p, "One")).toBe("One words");
  expect(storedText(p, "Two")).toBe("Two words");
  expect(storedText(p, "Three").trim()).toBe("");
  expect(p.entries.find((e) => e.kind === "fragment")?.text).toBe("Three words");
});

const actions = (page: Page, title: string) =>
  page
    .locator(".sidebar .entry-row")
    .filter({ has: page.locator(".entry-main", { hasText: new RegExp("^" + title) }) })
    .locator(".reorder");

test("open beside: the row button shows on hover and keyboard focus and opens the right pane", async ({ page }) => {
  await page.goto("/");
  await createProject(page, "Open beside fixture");
  await keepFragment(page, "Beside fragment");
  await addSection(page, "One");
  await addSection(page, "Two");
  await row(page, "One").click();
  await page.mouse.move(900, 450);
  await expect(actions(page, "Two")).toHaveCSS("opacity", "0");
  await row(page, "Two").hover();
  await expect(actions(page, "Two")).toHaveCSS("opacity", "1");
  const button = page.getByRole("button", { name: "Open Two beside" });
  await expect(button).toBeVisible();
  await button.click();
  await expect(page.locator(".split-pane")).toHaveCount(2);
  await expect(page.locator('.split-pane[data-side="right"] .split-pane-title')).toHaveText("Two");
  await expect(page.locator('.split-pane[data-side="right"]')).toHaveAttribute("data-focused", "");
  await expect(page.getByRole("button", { name: "Rename section" })).toHaveText("Two");

  // Keyboard: Tab from the fragment row reaches its open-beside button, which is
  // then shown; Enter opens the fragment beside the section on the left.
  await page.mouse.move(900, 450);
  await expect(actions(page, "Beside fragment")).toHaveCSS("opacity", "0");
  await row(page, "Beside fragment").focus();
  await page.keyboard.press("Tab");
  const fragmentButton = page.getByRole("button", { name: "Open Beside fragment beside" });
  await expect(fragmentButton).toBeFocused();
  await expect(actions(page, "Beside fragment")).toHaveCSS("opacity", "1");
  await page.keyboard.press("Enter");
  await expect(page.locator(".split-pane")).toHaveCount(2);
  await expect(page.locator('.split-pane[data-side="right"] .split-pane-title')).toHaveText("Beside fragment");
  await expect(rightEditor(page)).toContainText("Beside fragment");

  // The entry already on the left never opens in both panes.
  await row(page, "One").hover();
  await page.getByRole("button", { name: "Open One beside" }).click();
  await expect(page.locator('.split-pane[data-side="right"] .split-pane-title')).toHaveText("Beside fragment");
  await expect(page.locator(".ProseMirror")).toHaveCount(2);

  // Deleting the right pane's entry closes the split.
  await row(page, "Two").hover();
  await page.getByRole("button", { name: "Open Two beside" }).click();
  await expect(page.locator('.split-pane[data-side="right"] .split-pane-title')).toHaveText("Two");
  await rightEditor(page).click();
  await page.getByRole("button", { name: "Delete section" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Delete section" }).click();
  await expect(page.locator('.split-pane[data-side="right"]')).toHaveCount(0);
  await expect(page.locator(".split-pane")).toHaveCount(1);
  await expect(page.getByRole("button", { name: "Rename section" })).toHaveText("One");
});

test("split jumps: Go to passage focuses the pane that shows the commented section", async ({ page }) => {
  await page.goto("/");
  await createProject(page, "Split comment fixture");
  await addSection(page, "One");
  await addSection(page, "Two");
  await row(page, "One").click();
  await leftEditor(page).click();
  await page.keyboard.type("Left text");
  await row(page, "Two").click({ modifiers: ["ControlOrMeta"] });
  const right = rightEditor(page);
  await right.click();
  await page.keyboard.type("Alpha Beta");
  await right.evaluate((el: any) => el.editor.commands.setTextSelection({ from: 7, to: 11 }));
  await page.getByRole("button", { name: "Comment on selection" }).click();
  await page.getByLabel("Note", { exact: true }).fill("About beta");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await leftEditor(page).click(); // the commented section is now in the unfocused pane
  await page.locator(".group-title").filter({ hasText: /^Comments$/ }).click();
  await page.locator("article.feature-item").filter({ hasText: "About beta" })
    .getByRole("button", { name: "Go to passage" }).click();
  await expect(page.locator(".split-pane")).toHaveCount(2);
  await expect(page.locator('.split-pane[data-side="right"]')).toHaveAttribute("data-focused", "");
  await expect(page.getByRole("button", { name: "Rename section" })).toHaveText("Two");
  await expect.poll(() => right.evaluate(() => window.getSelection()?.toString() ?? "")).toBe("Beta");
  await page.getByRole("button", { name: "Keep as fragment" }).click();
  await saved(page);
  const p = await storedProject(page);
  expect(storedText(p, "One")).toBe("Left text");
  expect(storedText(p, "Two").trim()).toBe("Alpha");
  expect(p.entries.find((e) => e.kind === "fragment")?.text).toBe("Beta");
});

test("split jumps: restoring a section from a snapshot keeps both panes and shows the restored text", async ({ page }) => {
  await page.goto("/");
  await createProject(page, "Split restore fixture");
  await addSection(page, "One");
  await addSection(page, "Two");
  await row(page, "One").click();
  await leftEditor(page).click();
  await page.keyboard.type("One before");
  await row(page, "Two").click({ modifiers: ["ControlOrMeta"] });
  await rightEditor(page).click();
  await page.keyboard.type("Two before");
  await saved(page);
  await page.getByRole("button", { name: "Snapshot", exact: true }).click();
  await page.getByLabel("Snapshot name").fill("Split base");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await rightEditor(page).click();
  await page.keyboard.press("ControlOrMeta+End");
  await page.keyboard.type(" after");
  await leftEditor(page).click();
  await page.keyboard.press("ControlOrMeta+End");
  await page.keyboard.type(" after");
  await saved(page);
  await page.getByRole("button", { name: "Snapshots & history", exact: true }).click();
  await page.locator(".versions").getByRole("button", { name: /Split base/ }).click();
  const dialog = page.locator(".preview-dialog");
  await dialog.getByRole("button", { name: "Compare section" }).click();
  await page.getByRole("option", { name: "Two", exact: true }).click();
  await dialog.getByRole("button", { name: "Restore this section" }).click();
  await expect(page.locator(".split-pane")).toHaveCount(2);
  await expect(rightEditor(page)).toHaveText("Two before");
  await expect(leftEditor(page)).toHaveText("One before after");
  await expect(page.locator('.split-pane[data-side="right"]')).toHaveAttribute("data-focused", "");
  await expect(page.getByRole("button", { name: "Rename section" })).toHaveText("Two");
  await rightEditor(page).click();
  await page.keyboard.press("ControlOrMeta+End");
  await page.keyboard.type(" again");
  await saved(page);
  const p = await storedProject(page);
  expect(storedText(p, "One")).toBe("One before after");
  expect(storedText(p, "Two")).toBe("Two before again");
});

// ---- A3: the left editor survives opening and closing a split ----

const longBody = Array.from(
  { length: 90 },
  (_, i) => "Paragraph " + i + " with enough words to wrap a little.",
).join("\n");

const scrollerTop = (page: Page, side: "left" | "right") =>
  page.evaluate((side) => {
    const pm =
      document.querySelector(`.split-pane[data-side="${side}"] .ProseMirror`) ??
      document.querySelector(".ProseMirror");
    let el: HTMLElement | null = pm as HTMLElement | null;
    while (el && el.scrollHeight <= el.clientHeight + 1) el = el.parentElement;
    return el ? Math.round(el.scrollTop) : -1;
  }, side);

test("split view: undo history survives opening a split", async ({ page }) => {
  await page.goto("/");
  await createProject(page, "Undo keeper fixture");
  await addSection(page, "Two");
  await row(page, "Opening").click();
  const editor = leftEditor(page);
  await editor.fill("Undo survives the split.");
  await row(page, "Two").hover();
  await page.getByRole("button", { name: "Open Two beside" }).click();
  await expect(page.locator(".split-pane")).toHaveCount(2);
  await leftEditor(page).click();
  await leftEditor(page).press("ControlOrMeta+z");
  await expect(leftEditor(page)).toHaveText("");
});

test("split view: the left pane keeps its scroll position across a split round trip", async ({
  page,
}) => {
  await page.goto("/");
  await createProject(page, "Scroll keeper fixture");
  await addSection(page, "Two");
  await row(page, "Opening").click();
  const editor = leftEditor(page);
  await editor.fill(longBody);
  const box = await editor.boundingBox();
  await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2);
  await page.mouse.wheel(0, 1200);
  await page.waitForTimeout(200);
  const before = await scrollerTop(page, "left");
  expect(before).toBeGreaterThan(10);
  await row(page, "Two").hover();
  await page.getByRole("button", { name: "Open Two beside" }).click();
  await expect(page.locator(".split-pane")).toHaveCount(2);
  await page.getByRole("button", { name: "Close right pane" }).click();
  await expect(page.locator('.split-pane[data-side="right"]')).toHaveCount(0);
  const after = await scrollerTop(page, "left");
  expect(Math.abs(after - before)).toBeLessThanOrEqual(2);
});

test("split view: both panes' first text lines start at the same y in continuous and page view", async ({
  page,
}) => {
  await page.goto("/");
  await createProject(page, "Level panes fixture");
  await keepFragment(page, "Kept fragment body");
  await addSection(page, "One");
  await leftEditor(page).fill("Section One text lives here.");
  await row(page, "Kept fragment body").hover();
  await page
    .getByRole("button", { name: "Open Kept fragment body beside" })
    .click();
  await expect(page.locator(".split-pane")).toHaveCount(2);
  const tops = () =>
    page.evaluate(() =>
      Array.from(document.querySelectorAll(".split-pane .ProseMirror")).map(
        (el) => Math.round(el.getBoundingClientRect().top),
      ),
    );
  const [leftTop, rightTop] = await tops();
  expect(Math.abs(leftTop - rightTop)).toBeLessThanOrEqual(1);
  await page.getByRole("button", { name: "Page view", exact: true }).click();
  await expect(
    page.locator('.split-pane[data-side="left"] .editor-viewport'),
  ).toHaveClass(/is-paged/);
  const [pagedLeftTop, pagedRightTop] = await tops();
  expect(Math.abs(pagedLeftTop - pagedRightTop)).toBeLessThanOrEqual(1);
});

test("split view: the footer page status follows the focused pane at once", async ({
  page,
}) => {
  await page.goto("/");
  await createProject(page, "Status follower fixture");
  await addSection(page, "Two");
  await row(page, "Opening").click();
  await leftEditor(page).fill(longBody);
  await page.getByRole("button", { name: "Page view", exact: true }).click();
  await expect(
    page.locator('.split-pane[data-side="left"] .editor-viewport'),
  ).toHaveClass(/is-paged/);
  await row(page, "Two").hover();
  await page.getByRole("button", { name: "Open Two beside" }).click();
  await expect(page.locator(".split-pane")).toHaveCount(2);
  const status = page.locator('[aria-label="Page count"]');
  // The open-beside flow focuses the right pane: its status is page 1.
  await expect(status).toHaveText(/Section page 1 /, { timeout: 2_000 });
  // Scroll the left pane deep into the document, then focus it.
  await leftEditor(page).click();
  const box = await leftEditor(page).boundingBox();
  await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2);
  await page.mouse.wheel(0, 3000);
  await expect(status).not.toHaveText(/Section page 1 /, { timeout: 2_000 });
  // Focus the right pane and back: the footer follows focus immediately.
  await rightEditor(page).click();
  await expect(status).toHaveText(/Section page 1 /, { timeout: 300 });
  await leftEditor(page).click();
  await expect(status).not.toHaveText(/Section page 1 /, { timeout: 300 });
});

// ---- T159: close-side undo, DOM identity and scroll, asserted directly ----

test("split view: undo still works after closing the split, and the left editor DOM node never changes", async ({
  page,
}) => {
  await page.goto("/");
  await createProject(page, "Close undo fixture");
  await addSection(page, "Two");
  await row(page, "Opening").click();
  await leftEditor(page).fill("Typed before the split.");
  // Tag the left Writer's editor, its pane section and the panes wrapper.
  await page.evaluate(() => {
    document.querySelector(".split-panes")?.setAttribute("data-tag159", "panes");
    document
      .querySelector('.split-pane[data-side="left"]')
      ?.setAttribute("data-tag159", "pane");
    document
      .querySelector('.split-pane[data-side="left"] .ProseMirror')
      ?.setAttribute("data-tag159", "editor");
  });
  const tags = () =>
    page.evaluate(() => ({
      panes: document.querySelector(".split-panes")?.getAttribute("data-tag159"),
      pane: document
        .querySelector('.split-pane[data-side="left"]')
        ?.getAttribute("data-tag159"),
      editor: document
        .querySelector('.split-pane[data-side="left"] .ProseMirror')
        ?.getAttribute("data-tag159"),
    }));
  const kept = { panes: "panes", pane: "pane", editor: "editor" };
  expect(await tags()).toEqual(kept);

  await row(page, "Two").hover();
  await page.getByRole("button", { name: "Open Two beside" }).click();
  await expect(page.locator(".split-pane")).toHaveCount(2);
  expect(await tags()).toEqual(kept); // no remount on open

  await page.getByRole("button", { name: "Close right pane" }).click();
  await expect(page.locator('.split-pane[data-side="right"]')).toHaveCount(0);
  expect(await tags()).toEqual(kept); // no remount on close

  // Undo history survived BOTH transitions: Cmd+Z removes the typed text.
  await leftEditor(page).click();
  await leftEditor(page).press("ControlOrMeta+z");
  await expect(leftEditor(page)).toHaveText("");
});

test("split view: the left scroll position holds on open and again on close", async ({
  page,
}) => {
  await page.goto("/");
  await createProject(page, "Scroll both ways fixture");
  await addSection(page, "Two");
  await row(page, "Opening").click();
  await leftEditor(page).fill(longBody);
  const box = await leftEditor(page).boundingBox();
  await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2);
  await page.mouse.wheel(0, 1200);
  await page.waitForTimeout(200);
  const beforeOpen = await scrollerTop(page, "left");
  expect(beforeOpen).toBeGreaterThan(10);
  await row(page, "Two").hover();
  await page.getByRole("button", { name: "Open Two beside" }).click();
  await expect(page.locator(".split-pane")).toHaveCount(2);
  await page.waitForTimeout(200);
  const whileOpen = await scrollerTop(page, "left");
  expect(Math.abs(whileOpen - beforeOpen)).toBeLessThanOrEqual(2);
  await page.getByRole("button", { name: "Close right pane" }).click();
  await expect(page.locator('.split-pane[data-side="right"]')).toHaveCount(0);
  await page.waitForTimeout(200);
  const afterClose = await scrollerTop(page, "left");
  expect(Math.abs(afterClose - beforeOpen)).toBeLessThanOrEqual(2);
});
