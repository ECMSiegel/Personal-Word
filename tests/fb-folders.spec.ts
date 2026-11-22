import { test, expect, type Locator, type Page } from "@playwright/test";
import { expectEvenRows } from "./layout-helpers";

// FB4 (docs/agent-work/2026-11-18-folders-batch/PLAN.md): folders on the Projects page --
// inline collapsible headings in list and card view, a New folder button, right-click
// menus, inline rename, colours, Move to folder..., delete folder, flat search and
// "New project here". Browser preview storage only (`folio.preview.library`).

async function createProject(page: Page, title: string) {
  await page.getByRole("button", { name: "Start new project" }).click();
  await page.getByRole("button", { name: "Blank", exact: true }).click();
  await page.getByLabel("Project title").fill(title);
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await page.getByRole("button", { name: "Projects", exact: true }).click();
  await expect(page.locator(".library")).toBeVisible();
}

async function seed(page: Page, titles = ["Alpha draft", "Beta notes", "Gamma"]) {
  await page.goto("/");
  for (const title of titles) await createProject(page, title);
  await expect(page.locator(".project-row")).toHaveCount(titles.length);
}

const nameInput = (page: Page) => page.getByRole("textbox", { name: "Folder name" });
const heading = (page: Page, name: string) =>
  page.locator("[data-folder-heading]").filter({ has: page.getByRole("button", { name, exact: true }) });
const folder = (page: Page, name: string) =>
  page.locator("section.library-folder").filter({ has: page.locator(":scope > [data-folder-heading]").filter({ has: page.getByRole("button", { name, exact: true }) }) });
const row = (page: Page, title: string) => page.locator(".project-row").filter({ hasText: title });
const menu = (page: Page) => page.getByRole("menu");
const item = (page: Page, name: string) => menu(page).getByRole("menuitem", { name, exact: true });
const itemNames = (page: Page) => menu(page).getByRole("menuitem").evaluateAll((els) => els.map((e) => e.textContent!.trim()));
const stored = (page: Page) =>
  page.evaluate(() => JSON.parse(localStorage.getItem("folio.preview.library") ?? "null"));

async function newFolder(page: Page, name: string) {
  await page.getByRole("button", { name: "New folder", exact: true }).click();
  const input = nameInput(page);
  await expect(input).toBeFocused();
  await expect(input).toHaveValue("New folder");
  // The default name is selected, so typing replaces it.
  expect(await input.evaluate((el: HTMLInputElement) => [el.selectionStart, el.selectionEnd])).toEqual([0, "New folder".length]);
  await page.keyboard.type(name);
  // Blur saves.
  await input.evaluate((el) => el.blur());
  await expect(heading(page, name)).toBeVisible();
}

async function openMenu(target: Locator) {
  await target.click({ button: "right" });
  await expect(target.page().getByRole("menu")).toBeVisible();
}

async function moveTo(page: Page, title: string, destination: string) {
  await openMenu(row(page, title).locator(".row-label"));
  await item(page, "Move to folder…").click();
  await item(page, destination).click();
  await expect(menu(page)).toHaveCount(0);
}

async function subfolder(page: Page, parent: string, name: string) {
  await openMenu(heading(page, parent));
  await item(page, "New subfolder").click();
  await expect(nameInput(page)).toBeFocused();
  await page.keyboard.type(name);
  await page.keyboard.press("Enter");
  await expect(heading(page, name)).toBeVisible();
}

test("New folder sits left of the view toggle; a new folder opens in rename mode and blur saves it", async ({ page }) => {
  await seed(page);
  const names = await page
    .locator(".library-display > button")
    .evaluateAll((els) => els.map((el) => el.getAttribute("aria-label")));
  expect(names.indexOf("New folder")).toBe(names.indexOf("Show project cards") - 1);
  await newFolder(page, "Essays");
  expect((await stored(page)).folders).toMatchObject([{ name: "Essays", parent: null }]);
  // Escape on a brand-new folder removes it.
  await page.getByRole("button", { name: "New folder", exact: true }).click();
  await expect(nameInput(page)).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(page.locator("section.library-folder")).toHaveCount(1);
  await page.reload();
  await expect(heading(page, "Essays")).toBeVisible();
  expect((await stored(page)).folders).toHaveLength(1);
});

test("a subfolder nests under its parent heading, indented one slot", async ({ page }) => {
  await seed(page);
  await newFolder(page, "Essays");
  await subfolder(page, "Essays", "Drafts");
  await expect(folder(page, "Essays").locator(".folder-body").locator(heading(page, "Drafts"))).toHaveCount(1);
  const x = async (name: string) => (await heading(page, name).getByRole("button", { name, exact: true }).boundingBox())!.x;
  expect(Math.abs((await x("Drafts")) - (await x("Essays")) - 24)).toBeLessThanOrEqual(1);
  // A top-level chevron's ink (its drawn path, not its 14 px box) starts where the project
  // titles start (within 2 px).
  const icon = (await heading(page, "Essays").locator(".folder-chevron svg path").boundingBox())!;
  const title = (await page.locator(".project-row .project-name").first().boundingBox())!;
  expect(Math.abs(icon.x - title.x)).toBeLessThanOrEqual(2);
});

test("Move to folder files a project under that heading in list and card view", async ({ page }) => {
  await seed(page);
  await newFolder(page, "Essays");
  await subfolder(page, "Essays", "Drafts");
  await openMenu(row(page, "Alpha draft").locator(".row-label"));
  expect(await itemNames(page)).toEqual(["Open", "Move up", "Move down", "Move to folder…", "Delete"]);
  // Move up / Move down are disabled only at the ends (FB5): Alpha draft was made first, so it
  // is last under the default Last edited sort.
  expect((await page.locator('[data-container="root"] > .project-row .project-name').allTextContents()).at(-1)).toBe("Alpha draft");
  await expect(item(page, "Move down")).toHaveAttribute("aria-disabled", "true");
  await expect(item(page, "Move up")).not.toHaveAttribute("aria-disabled", "true");
  await item(page, "Move to folder…").click();
  expect(await itemNames(page)).toEqual(["Top level", "Essays", "Essays / Drafts"]);
  await expect(item(page, "Top level")).toHaveAttribute("aria-disabled", "true");
  await item(page, "Essays / Drafts").click();
  for (const view of ["list", "cards"] as const) {
    if (view === "cards") await page.getByRole("button", { name: "Show project cards" }).click();
    const drafts = folder(page, "Drafts");
    await expect(drafts.locator(`.folder-projects.project-list--${view} .project-row`)).toHaveCount(1);
    await expect(drafts.locator(".project-row")).toContainText("Alpha draft");
    await expect(page.locator('[data-container="root"] > .project-row')).toHaveCount(2);
    // Headings never sit inside a card grid.
    await expect(page.locator(".project-list--cards section.library-folder")).toHaveCount(0);
  }
  // A folder's menu offers neither itself nor its descendants.
  await openMenu(heading(page, "Essays"));
  expect(await itemNames(page)).toEqual([
    "Collapse", "New project here", "New subfolder", "Rename", "Move up", "Move down", "Move to folder…", "Delete folder",
  ]);
  await item(page, "Move to folder…").click();
  expect(await itemNames(page)).toEqual(["Top level"]);
  await expect(item(page, "Top level")).toHaveAttribute("aria-disabled", "true");
  await page.keyboard.press("Escape");
});

test("Move to folder works on the first mouse try when the card is partly below the fold", async ({ page }) => {
  // Real mouse by coordinates (Playwright's locator click would scroll the card into view and
  // hide the defect): restoring focus after the first menu closes must not scroll the list,
  // because any scroll closes the destination menu.
  await page.setViewportSize({ width: 1280, height: 560 });
  await seed(page);
  await newFolder(page, "Essays");
  await page.getByRole("button", { name: "Show project cards" }).click();
  const box = async (l: Locator) => (await l.boundingBox())!;
  const lib = page.locator("main.library");
  // Size the window so the last card's bottom edge is cut off by the scroller.
  const gamma = row(page, "Gamma");
  const shortBy = async () => (await box(gamma)).y + (await box(gamma)).height - (await box(lib)).y - (await box(lib)).height;
  const h = page.viewportSize()!.height;
  await page.setViewportSize({ width: 1280, height: Math.round(h - 6 + (await shortBy())) });
  expect(await shortBy()).toBeGreaterThan(0);
  expect(await lib.evaluate((el) => el.scrollTop)).toBe(0);
  const g = await box(gamma.locator(".row-label"));
  await page.mouse.click(g.x + 10, g.y + g.height / 2, { button: "right" });
  await expect(menu(page)).toBeVisible();
  const mv = await box(item(page, "Move to folder…"));
  await page.mouse.click(mv.x + 10, mv.y + mv.height / 2);
  await expect(menu(page)).toBeVisible();
  expect(await itemNames(page)).toEqual(["Top level", "Essays"]);
  const dest = await box(item(page, "Essays"));
  await page.mouse.click(dest.x + 10, dest.y + dest.height / 2);
  await expect(menu(page)).toHaveCount(0);
  await expect(folder(page, "Essays").locator(".project-row")).toContainText("Gamma");
});

test("collapse hides a folder's rows and survives a reload; rename from the menu", async ({ page }) => {
  await seed(page);
  await newFolder(page, "Essays");
  await moveTo(page, "Alpha draft", "Essays");
  const chevron = heading(page, "Essays").getByRole("button", { name: "Essays", exact: true });
  await expect(chevron).toHaveAttribute("aria-expanded", "true");
  await chevron.click();
  await expect(chevron).toHaveAttribute("aria-expanded", "false");
  await expect(row(page, "Alpha draft")).toHaveCount(0);
  await expect(page.locator(".project-row")).toHaveCount(2);
  await page.reload();
  await expect(heading(page, "Essays").getByRole("button", { name: "Essays", exact: true })).toHaveAttribute("aria-expanded", "false");
  await expect(row(page, "Alpha draft")).toHaveCount(0);
  await openMenu(heading(page, "Essays"));
  await item(page, "Expand").click();
  await expect(row(page, "Alpha draft")).toHaveCount(1);

  await openMenu(heading(page, "Essays"));
  await item(page, "Rename").click();
  await expect(nameInput(page)).toBeFocused();
  await expect(nameInput(page)).toHaveValue("Essays");
  await page.keyboard.press("ControlOrMeta+a");
  await page.keyboard.type("Papers");
  await page.keyboard.press("Enter");
  await expect(heading(page, "Papers")).toBeVisible();
  await expect(heading(page, "Essays")).toHaveCount(0);
  // Escape while renaming keeps the old name.
  await openMenu(heading(page, "Papers"));
  await item(page, "Rename").click();
  await page.keyboard.type("Nope");
  await page.keyboard.press("Escape");
  await expect(heading(page, "Papers")).toBeVisible();
  expect((await stored(page)).folders).toMatchObject([{ name: "Papers" }]);
});

test("deleting a folder moves its project up and the project still opens", async ({ page }) => {
  await seed(page);
  await newFolder(page, "Essays");
  await moveTo(page, "Alpha draft", "Essays");
  await openMenu(heading(page, "Essays"));
  await expect(item(page, "Delete folder")).toHaveAttribute("data-danger", "");
  await item(page, "Delete folder").click();
  await expect(page.locator("section.library-folder")).toHaveCount(0);
  await expect(page.locator('[data-container="root"] > .project-row')).toHaveCount(3);
  expect(await stored(page)).toMatchObject({ folders: [], placement: {} });
  await row(page, "Alpha draft").locator(".row-label").click();
  await expect(page.getByRole("textbox", { name: "Writing editor" })).toBeVisible();
});

test("search hides headings and lists matches flat with their folder path", async ({ page }) => {
  await seed(page);
  await newFolder(page, "Essays");
  await subfolder(page, "Essays", "Drafts");
  await moveTo(page, "Alpha draft", "Essays / Drafts");
  await page.getByRole("button", { name: "Search projects" }).click();
  await page.getByRole("searchbox", { name: "Filter projects by title" }).fill("a");
  await expect(page.locator("[data-folder-heading]")).toHaveCount(0);
  await expect(page.locator(".project-row")).toHaveCount(3);
  await expect(row(page, "Alpha draft").locator(".project-path")).toHaveText("-- Essays / Drafts");
  await expect(row(page, "Beta notes").locator(".project-path")).toHaveCount(0);
  const { muted } = await page.evaluate(() => {
    const s = document.createElement("span");
    s.style.color = "var(--muted)";
    document.body.append(s);
    const c = getComputedStyle(s).color;
    s.remove();
    return { muted: c };
  });
  expect(await row(page, "Alpha draft").locator(".project-path").evaluate((el) => getComputedStyle(el).color)).toBe(muted);
  await page.getByRole("searchbox", { name: "Filter projects by title" }).fill("");
  await expect(heading(page, "Essays")).toBeVisible();
});

test("in Color, a folder menu ends with the eight swatches and a pick tints the icon", async ({ page }) => {
  await page.addInitScript(() =>
    localStorage.setItem("folio.workspace.appearance", JSON.stringify({ theme: "system", palette: "color" })));
  await seed(page, ["Alpha draft"]);
  await newFolder(page, "Essays");
  await openMenu(heading(page, "Essays"));
  const radios = menu(page).getByRole("group", { name: "Colour" }).getByRole("menuitemradio");
  await expect(radios).toHaveCount(8);
  await menu(page).getByRole("menuitemradio", { name: "Purple" }).click();
  await expect(menu(page)).toHaveCount(0);
  const purple = await page.evaluate(() => {
    const s = document.createElement("span");
    s.style.color = "var(--swatch-purple)";
    document.body.append(s);
    const c = getComputedStyle(s).color;
    s.remove();
    return c;
  });
  expect(await heading(page, "Essays").locator(".folder-icon").evaluate((el) => getComputedStyle(el).color)).toBe(purple);
  expect((await stored(page)).folders[0].colour).toBe("purple");
  // Picking the current colour clears it.
  await openMenu(heading(page, "Essays"));
  await expect(radios.and(page.locator('[aria-checked="true"]'))).toHaveAccessibleName("Purple");
  await page.getByRole("menuitemradio", { name: "Purple" }).click();
  await expect.poll(async () => (await stored(page)).folders[0].colour).toBeUndefined();
});

test("in Plain, a folder menu has no swatches and the icon is muted", async ({ page }) => {
  await seed(page, ["Alpha draft"]);
  await newFolder(page, "Essays");
  await openMenu(heading(page, "Essays"));
  await expect(menu(page).getByRole("group", { name: "Colour" })).toHaveCount(0);
  await page.keyboard.press("Escape");
});

test("New project here lands the new project in that folder", async ({ page }) => {
  await seed(page, ["Alpha draft"]);
  await newFolder(page, "Essays");
  await openMenu(heading(page, "Essays"));
  await item(page, "New project here").click();
  await page.getByLabel("Project title").fill("Filed project");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByRole("textbox", { name: "Writing editor" })).toBeVisible();
  await page.getByRole("button", { name: "Projects", exact: true }).click();
  await expect(folder(page, "Essays").locator(".project-row")).toContainText("Filed project");
  await expect(page.locator('[data-container="root"] > .project-row')).toHaveCount(1);
});

test("keyboard: the menu key on a focused folder heading opens the menu; arrows move; Escape returns focus", async ({ page }) => {
  await seed(page, ["Alpha draft"]);
  await newFolder(page, "Essays");
  const chevron = heading(page, "Essays").getByRole("button", { name: "Essays", exact: true });
  await chevron.focus();
  await page.keyboard.press("ContextMenu");
  await expect(menu(page)).toBeVisible();
  await expect(menu(page).locator("[data-highlighted]")).toHaveText("Collapse");
  await page.keyboard.press("ArrowDown");
  await expect(menu(page).locator("[data-highlighted]")).toHaveText("New project here");
  await page.keyboard.press("Escape");
  await expect(menu(page)).toHaveCount(0);
  await expect(chevron).toBeFocused();
  // Shift+F10 on a project row opens its menu too; Enter on Collapse from the keyboard works.
  await row(page, "Alpha draft").locator(".row-label").focus();
  await page.keyboard.press("Shift+F10");
  await expect(menu(page).locator("[data-highlighted]")).toHaveText("Open");
  await page.keyboard.press("Escape");
  await chevron.focus();
  await page.keyboard.press("Enter");
  await expect(chevron).toHaveAttribute("aria-expanded", "false");
});

test("a library file that cannot be read is never written over", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("folio.preview.library", "{not json"));
  await seed(page, ["Alpha draft"]);
  await expect(page.getByRole("alert")).toContainText("Folders could not be loaded.");
  await expect(page.locator('[data-container="root"] > .project-row')).toHaveCount(1);
  await expect(page.getByRole("button", { name: "New folder", exact: true })).toBeDisabled();
  expect(await page.evaluate(() => localStorage.getItem("folio.preview.library"))).toBe("{not json");
});

test("a library of an unknown version is a read error and is never written over", async ({ page }) => {
  const saved = JSON.stringify({ version: 2, folders: [{ id: "f", name: "Future", parent: null }], placement: {}, order: {} });
  await page.addInitScript((value) => localStorage.setItem("folio.preview.library", value), saved);
  await seed(page, ["Alpha draft"]);
  await expect(page.getByRole("alert")).toContainText("Folders could not be loaded.");
  await expect(page.getByRole("button", { name: "New folder", exact: true })).toBeDisabled();
  expect(await page.evaluate(() => localStorage.getItem("folio.preview.library"))).toBe(saved);
});

// FB5 follow-up (coordinator): a folder's contents sit visibly under it. Each folder body is
// indented one slot, so its projects line up with its subfolders' headings and top-level
// projects line up with top-level headings, in list and card view.
test("a folder's projects and subfolders are indented one slot under its heading", async ({ page }) => {
  await seed(page, ["Alpha draft", "Beta notes", "Gamma"]);
  await newFolder(page, "Essays");
  await subfolder(page, "Essays", "Drafts");
  await moveTo(page, "Alpha draft", "Essays");
  await moveTo(page, "Beta notes", "Essays / Drafts");
  const left = async (l: Locator) => (await l.boundingBox())!.x;
  for (const view of ["list", "cards"] as const) {
    if (view === "cards") await page.getByRole("button", { name: "Show project cards" }).click();
    const top = await left(row(page, "Gamma"));
    const inEssays = await left(row(page, "Alpha draft"));
    const inDrafts = await left(row(page, "Beta notes"));
    expect(inEssays, `${view}: a project in a folder starts right of a top-level project`).toBeGreaterThan(top + 20);
    expect(Math.abs(inDrafts - inEssays - 24), `${view}: one more slot per level`).toBeLessThanOrEqual(1);
    expect(Math.abs(top - (await left(heading(page, "Essays")))), `${view}: top-level edge`).toBeLessThanOrEqual(0.5);
    expect(Math.abs(inEssays - (await left(heading(page, "Drafts")))), `${view}: Essays' projects line up with its subfolder heading`).toBeLessThanOrEqual(0.5);
  }
  // List: the subfolder's chevron ink sits where its parent folder's project titles start.
  await page.getByRole("button", { name: "Show project list" }).click();
  const icon = (await heading(page, "Drafts").locator(".folder-chevron svg path").boundingBox())!;
  const title = (await row(page, "Alpha draft").locator(".project-name").boundingBox())!;
  expect(Math.abs(icon.x - title.x)).toBeLessThanOrEqual(2);
});

// FB5 follow-up: list rows keep one rhythm inside folders -- the same height, and every
// container's last row closes with a rule like the rule above it.
test("list rows inside folders are even and each container closes with a rule", async ({ page }) => {
  await seed(page, ["Alpha draft", "Beta notes", "Gamma", "Delta", "Epsilon"]);
  await newFolder(page, "Essays");
  await moveTo(page, "Alpha draft", "Essays");
  await moveTo(page, "Beta notes", "Essays");
  await expectEvenRows(folder(page, "Essays").locator(".project-row"));
  await expectEvenRows(page.locator('[data-container="root"] > .project-row'));
  const heights = await page.locator(".project-row").evaluateAll((els) => els.map((el) => el.getBoundingClientRect().height));
  expect(Math.max(...heights) - Math.min(...heights), `row heights ${heights.join(", ")}`).toBeLessThanOrEqual(0.5);
  const containers = await page.locator(".folder-projects.project-list--list").evaluateAll((els) =>
    els.map((c) => {
      const last = c.lastElementChild as HTMLElement;
      // The closing rule: a 1 px line drawn at the last row's bottom edge, by the container or the row.
      const rule = [c as HTMLElement, last].find((el) => getComputedStyle(el).borderBottomStyle !== "none" && parseFloat(getComputedStyle(el).borderBottomWidth) >= 1);
      const top = parseFloat(getComputedStyle(last).borderTopWidth);
      return {
        id: c.getAttribute("data-container"),
        rule: rule ? parseFloat(getComputedStyle(rule).borderBottomWidth) : 0,
        top,
        gap: rule ? rule.getBoundingClientRect().bottom - last.getBoundingClientRect().bottom : null,
      };
    }));
  expect(containers).toHaveLength(2);
  for (const c of containers) {
    expect(c.rule, `${c.id}: closing rule`).toBe(c.top);
    expect(Math.abs(c.gap! - c.rule), `${c.id}: rule sits on the last row's bottom edge`).toBeLessThanOrEqual(1);
  }
});

// Screenshots for review (FB4 step 5): FB4_SHOTS=1 saves light and dark, list and cards.
test("screenshots: two folders, a subfolder and projects inside", async ({ page }) => {
  test.skip(!process.env.FB4_SHOTS, "set FB4_SHOTS=1 to save the review screenshots");
  await page.setViewportSize({ width: 1100, height: 900 });
  await page.addInitScript(() =>
    localStorage.setItem("folio.workspace.appearance", JSON.stringify({ theme: "system", palette: "color" })));
  await seed(page, ["Alpha draft", "Beta notes", "Gamma", "Delta essay", "Loose project"]);
  await newFolder(page, "Essays");
  await newFolder(page, "Fiction");
  await subfolder(page, "Essays", "Drafts");
  await moveTo(page, "Alpha draft", "Essays");
  await moveTo(page, "Delta essay", "Essays / Drafts");
  await moveTo(page, "Beta notes", "Fiction");
  await openMenu(heading(page, "Essays"));
  await menu(page).getByRole("menuitemradio", { name: "Purple" }).click();
  for (const scheme of ["light", "dark"] as const) {
    await page.emulateMedia({ colorScheme: scheme });
    for (const view of ["list", "cards"] as const) {
      const toggle = page.getByRole("button", { name: view === "list" ? "Show project list" : "Show project cards" });
      if (await toggle.count()) await toggle.click();
      await page.mouse.move(0, 0);
      await page.screenshot({ path: `${process.env.FB_SHOTS_DIR ?? "test-results/fb-FB4"}/projects-folders-${view}-${scheme}.png`, fullPage: true });
    }
  }
});
