import { test, expect, type Locator, type Page } from "@playwright/test";

// UI wave 5, E4 (docs/agent-work/2026-11-01-ui-wave-5/PLAN.md, Amendment 1): a
// right-click, Shift+F10 or ContextMenu-key menu on sidebar rows and group
// headings. Moves reuse A2's move functions and live-region announcement;
// Delete uses App's confirm and safety snapshot. Extra scope (owner decision):
// the floating sidebar drops the 1 px rules between the bottom rows.

const SHOTS = process.env.E4_SHOTS;
const pdfBytes = Buffer.from("%PDF-1.4\n1 0 obj << /Type /Catalog >> endobj\n%%EOF\n", "ascii");

async function createProject(page: Page, title: string) {
  await page.addInitScript(() => localStorage.setItem("personal-word.restoreTabs", "true"));
  await page.goto("/");
  await page.getByRole("button", { name: "Start new project" }).click();
  await page.getByRole("button", { name: "Blank", exact: true }).click();
  await page.getByLabel("Project title").fill(title);
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByRole("textbox", { name: "Writing editor" })).toBeVisible();
}

async function addSection(page: Page, title: string) {
  await page.getByRole("button", { name: "New section", exact: true }).click();
  await page.getByLabel("Title", { exact: true }).fill(title);
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(mainRow(page, "manuscript", title)).toBeVisible();
}

async function addFragment(page: Page, title: string) {
  await page.locator('[data-group="fragments"] .group-heading').hover();
  await page.getByRole("button", { name: "New fragment", exact: true }).click();
  await page.getByLabel("Title", { exact: true }).fill(title);
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(mainRow(page, "fragments", title)).toBeVisible();
}

/** Two sources (the first with a PDF) and two notes, made through the Research panel. */
async function seedResearch(page: Page) {
  await page.locator(".group-title").filter({ hasText: /^Research$/ }).click();
  await expect(page.locator(".research-panel")).toBeVisible();
  await page.getByLabel("Zotero CSL JSON file").setInputFiles({
    name: "sources.json",
    mimeType: "application/json",
    buffer: Buffer.from(
      JSON.stringify([
        { type: "book", title: "Alpha source", author: [{ given: "Ann", family: "Ames" }], issued: { "date-parts": [[2020]] } },
        { type: "book", title: "Beta source", author: [{ given: "Bo", family: "Barr" }], issued: { "date-parts": [[2021]] } },
      ]),
    ),
  });
  await page.getByRole("button", { name: "Add sources", exact: true }).click();
  const alpha = page.locator(".source-item").filter({ hasText: "Alpha source" });
  const toggle = alpha.locator(".source-toggle");
  if ((await toggle.getAttribute("aria-expanded")) !== "true") await toggle.click();
  await alpha.locator('.source-pdf-field input[type="file"]').setInputFiles({
    name: "alpha.pdf",
    mimeType: "application/pdf",
    buffer: pdfBytes,
  });
  await page.locator(".research-tabs").getByRole("button", { name: "Notes", exact: true }).click();
  for (const text of ["Note one", "Note two"]) {
    await page.getByRole("button", { name: "Add note", exact: true }).click();
    await page.locator(".note-item textarea").last().fill(text);
  }
  await expect(page.locator('.sidebar [data-group="research"] .entry-row')).toHaveCount(6);
  await expect(page.locator(".save-status")).toHaveText("Saved", { timeout: 10_000 });
}

const mainRow = (page: Page, group: string, text: string) =>
  page.locator(`[data-group="${group}"] .entry-main`).filter({ hasText: text }).first();
const heading = (page: Page, group: string) => page.locator(`.sidebar-groups [data-group="${group}"] .group-title`);
const rowTitles = (page: Page, group: string) =>
  page.locator(`[data-group="${group}"] .entry-row .entry-main > span`).allTextContents();
const groupNames = (page: Page) =>
  page.locator(".sidebar-groups > .sidebar-group").evaluateAll((els) => els.map((el) => el.getAttribute("data-group")));
const status = (page: Page) => page.locator('.sidebar [role="status"]');
const menu = (page: Page) => page.getByRole("menu");
const item = (page: Page, name: string) => menu(page).getByRole("menuitem", { name, exact: true });
const itemNames = (page: Page) => menu(page).getByRole("menuitem").allTextContents();

async function rightClick(page: Page, row: Locator, dx = 20) {
  const box = (await row.boundingBox())!;
  const at = { x: box.x + dx, y: box.y + box.height / 2 };
  await page.mouse.click(at.x, at.y, { button: "right" });
  return at;
}

async function menuBox(page: Page) {
  // A pointer open fades in by a short transform; measure where it settles.
  await expect(menu(page)).toHaveAttribute("data-shown", "");
  return menu(page).evaluate(async (el) => {
    await Promise.all(el.getAnimations().map((a) => a.finished));
    const r = el.getBoundingClientRect();
    return { left: r.left, top: r.top, right: r.right, bottom: r.bottom, vw: innerWidth, vh: innerHeight };
  });
}

test("right-click on a section opens the menu at the pointer; Escape returns focus to the row", async ({ page }) => {
  await createProject(page, "Menu at pointer");
  await addSection(page, "Second section");
  const first = (await rowTitles(page, "manuscript"))[0];
  const row = mainRow(page, "manuscript", first);
  const at = await rightClick(page, row, 30);
  await expect(menu(page)).toBeVisible();
  await expect(menu(page)).toHaveAccessibleName(`${first} actions`);
  expect(await itemNames(page)).toEqual(["Open", "Open beside", "Rename", "Move up", "Move down", "Delete"]);
  const box = await menuBox(page);
  expect(Math.abs(box.left - at.x)).toBeLessThanOrEqual(1.5);
  expect(Math.abs(box.top - at.y)).toBeLessThanOrEqual(1.5);
  // A right-click never starts a drag.
  await expect(page.locator("[data-drag-state]")).toHaveCount(0);
  // Move up is disabled on the first row; Move down is not.
  await expect(item(page, "Move up")).toHaveAttribute("aria-disabled", "true");
  await expect(item(page, "Move down")).not.toHaveAttribute("aria-disabled", "true");
  // Destructive Delete is the danger colour; rows have no fill.
  const look = await item(page, "Delete").evaluate((el) => {
    const probe = document.createElement("span");
    probe.style.color = "var(--danger)";
    document.body.append(probe);
    const danger = getComputedStyle(probe).color;
    probe.remove();
    return { color: getComputedStyle(el).color, danger, bg: getComputedStyle(el).backgroundColor };
  });
  expect(look.color).toBe(look.danger);
  expect(look.bg).toBe("rgba(0, 0, 0, 0)");
  // A pointer open fades in (data-animate); the surface is the raised menu surface.
  await expect(menu(page)).toHaveAttribute("data-animate", "");
  await page.keyboard.press("Escape");
  await expect(menu(page)).toHaveCount(0);
  await expect(row).toBeFocused();
  // The sidebar is still there (Escape did not reach the sidebar's own handler).
  await expect(page.locator("aside.sidebar")).toBeVisible();
});

test("Shift+F10 and the ContextMenu key open it on the focused row; arrows, Home/End and Enter work", async ({ page }) => {
  await createProject(page, "Keyboard menu");
  await addSection(page, "Second section");
  const [first, second] = await rowTitles(page, "manuscript");
  const row = mainRow(page, "manuscript", first);
  await row.focus();
  await page.keyboard.press("Shift+F10");
  await expect(menu(page)).toBeVisible();
  // Keyboard open: at the row's left-bottom, instant (no fade).
  const rowBox = (await row.boundingBox())!;
  const box = await menuBox(page);
  expect(Math.abs(box.left - rowBox.x)).toBeLessThanOrEqual(1.5);
  expect(Math.abs(box.top - (rowBox.y + rowBox.height))).toBeLessThanOrEqual(1.5);
  await expect(menu(page)).not.toHaveAttribute("data-animate", "");
  await expect(menu(page)).toBeFocused();
  const active = () => menu(page).locator('[role="menuitem"][data-highlighted]');
  await expect(active()).toHaveText("Open");
  await page.keyboard.press("End");
  await expect(active()).toHaveText("Delete");
  await page.keyboard.press("Home");
  await expect(active()).toHaveText("Open");
  // Down skips the disabled Move up.
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("ArrowDown");
  await expect(active()).toHaveText("Move down");
  await page.keyboard.press("ArrowUp");
  await expect(active()).toHaveText("Rename");
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("Enter");
  await expect(menu(page)).toHaveCount(0);
  expect(await rowTitles(page, "manuscript")).toEqual([second, first]);
  await expect(status(page)).toHaveText(`Moved ${first} to position 2 of 2`);
  await expect(row).toBeFocused();

  // The ContextMenu key opens it too; Move down is now disabled at the end.
  await page.keyboard.press("ContextMenu");
  await expect(menu(page)).toBeVisible();
  await expect(item(page, "Move down")).toHaveAttribute("aria-disabled", "true");
  await item(page, "Move up").click();
  expect(await rowTitles(page, "manuscript")).toEqual([first, second]);
  await expect(status(page)).toHaveText(`Moved ${first} to position 1 of 2`);
});

test("Open, Open beside, Rename and Delete from a section and a fragment", async ({ page }) => {
  await createProject(page, "Menu actions");
  await addSection(page, "Second section");
  await addFragment(page, "Loose idea");
  const first = (await rowTitles(page, "manuscript"))[0];

  // Open
  await rightClick(page, mainRow(page, "manuscript", first));
  await item(page, "Open").click();
  await expect(menu(page)).toHaveCount(0);
  await expect(page.locator('[data-group="manuscript"] .entry-row.selected .entry-main')).toContainText(first);

  // Open beside
  await rightClick(page, mainRow(page, "manuscript", "Second section"));
  await item(page, "Open beside").click();
  await expect(page.locator(".split-pane")).toHaveCount(2);
  await expect(page.locator('.split-pane[data-side="right"] .split-pane-title')).toHaveText("Second section");
  await page.getByRole("button", { name: "Close right pane" }).click();
  await expect(page.locator('.split-pane[data-side="right"]')).toHaveCount(0);

  // Rename (the fragment's own items match a section's)
  await rightClick(page, mainRow(page, "fragments", "Loose idea"));
  expect(await itemNames(page)).toEqual(["Open", "Open beside", "Rename", "Move up", "Move down", "Delete"]);
  await expect(item(page, "Move up")).toHaveAttribute("aria-disabled", "true");
  await expect(item(page, "Move down")).toHaveAttribute("aria-disabled", "true");
  await item(page, "Rename").click();
  await expect(page.getByRole("dialog")).toContainText("Rename fragment");
  await page.getByLabel("Title", { exact: true }).fill("Better idea");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(mainRow(page, "fragments", "Better idea")).toBeVisible();

  // Delete: App's confirm, then the safety snapshot
  await rightClick(page, mainRow(page, "fragments", "Better idea"));
  await item(page, "Delete").click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toContainText("A safety snapshot is kept first");
  await dialog.getByRole("button", { name: "Delete fragment" }).click();
  await expect(dialog).toHaveCount(0);
  await expect(page.locator('[data-group="fragments"]')).not.toContainText("Better idea");
  await expect(page.getByText("Saved", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Snapshots & history", exact: true }).click();
  await expect(page.locator(".versions").getByRole("button", { name: /Before deleting “Better idea”/ })).toBeVisible();
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/after-delete.png` });
});

test("group heading: Collapse/Expand, Move up, Move down", async ({ page }) => {
  await createProject(page, "Group menu");
  await rightClick(page, heading(page, "manuscript"));
  expect(await itemNames(page)).toEqual(["Collapse", "Move up", "Move down"]);
  await expect(item(page, "Move up")).toHaveAttribute("aria-disabled", "true");
  await item(page, "Collapse").click();
  await expect(page.locator('[data-group="manuscript"]')).toHaveClass(/is-collapsed/);
  await expect(heading(page, "manuscript")).toBeFocused();
  await page.keyboard.press("Shift+F10");
  await expect(item(page, "Expand")).toBeVisible();
  await page.keyboard.press("Enter");
  await expect(page.locator('[data-group="manuscript"]')).not.toHaveClass(/is-collapsed/);

  await rightClick(page, heading(page, "manuscript"));
  await item(page, "Move down").click();
  expect(await groupNames(page)).toEqual(["fragments", "manuscript", "research"]);
  await expect(status(page)).toHaveText("Moved Manuscript to position 2 of 3");
  await expect(heading(page, "manuscript")).toBeFocused();
  await rightClick(page, heading(page, "research"));
  await expect(item(page, "Move down")).toHaveAttribute("aria-disabled", "true");
  await item(page, "Move up").click();
  expect(await groupNames(page)).toEqual(["fragments", "research", "manuscript"]);

  // Bottom rows (Read, Comments, History, Settings) keep the browser's default: no menu.
  await rightClick(page, page.locator(".sidebar-bottom-groups .group-title").first());
  await expect(menu(page)).toHaveCount(0);
});

test("research rows: source, PDF, note and Bibliography items; moves are announced", async ({ page }) => {
  await createProject(page, "Research menu");
  await seedResearch(page);

  await rightClick(page, mainRow(page, "research", "Bibliography"));
  expect(await itemNames(page)).toEqual(["Open"]);
  await item(page, "Open").click();
  await expect(page.locator('.sidebar [data-group="research"] .entry-row.selected')).toContainText("Bibliography");

  await rightClick(page, mainRow(page, "research", "Alpha source"));
  expect(await itemNames(page)).toEqual(["Open", "Move up", "Move down"]);
  await expect(item(page, "Move up")).toHaveAttribute("aria-disabled", "true");
  await item(page, "Move down").click();
  const research = await rowTitles(page, "research");
  expect(research[1]).toContain("Beta source");
  expect(research[2]).toContain("Alpha source");
  expect(research[3]).toBe("alpha.pdf");
  await expect(status(page)).toContainText("to position 2 of 2");
  await expect(mainRow(page, "research", "Alpha source")).toBeFocused();

  await rightClick(page, mainRow(page, "research", "alpha.pdf"));
  expect(await itemNames(page)).toEqual(["Open", "Open beside", "Move up", "Move down"]);
  await expect(item(page, "Move down")).toHaveAttribute("aria-disabled", "true");
  await item(page, "Open beside").click();
  await expect(page.locator(".split-pane")).toHaveCount(2);
  await page.getByRole("button", { name: "Close right pane" }).click();

  await rightClick(page, mainRow(page, "research", "Note one"));
  expect(await itemNames(page)).toEqual(["Open", "Move up", "Move down"]);
  await item(page, "Move down").click();
  expect((await rowTitles(page, "research")).slice(4)).toEqual(["Note two", "Note one"]);
  await expect(status(page)).toHaveText("Moved Note one to position 2 of 2");
  await rightClick(page, mainRow(page, "research", "Note one"));
  await item(page, "Open").click();
  await expect(page.locator(".research-panel")).toBeVisible();
});

test("the menu stays inside the window near its edges", async ({ page }) => {
  await page.setViewportSize({ width: 900, height: 600 });
  await createProject(page, "Edges");
  const row = mainRow(page, "manuscript", (await rowTitles(page, "manuscript"))[0]);
  // A context-menu event at the very bottom-right corner of the window.
  await row.evaluate((el) =>
    el.dispatchEvent(
      new MouseEvent("contextmenu", { bubbles: true, cancelable: true, clientX: innerWidth - 4, clientY: innerHeight - 4 }),
    ),
  );
  await expect(menu(page)).toBeVisible();
  const box = await menuBox(page);
  expect(box.left).toBeGreaterThanOrEqual(0);
  expect(box.top).toBeGreaterThanOrEqual(0);
  expect(box.right).toBeLessThanOrEqual(box.vw);
  expect(box.bottom).toBeLessThanOrEqual(box.vh);
  // Clicking elsewhere closes it.
  await page.mouse.click(600, 100);
  await expect(menu(page)).toHaveCount(0);
});

test("a right-click in the editor gets no sidebar menu", async ({ page }) => {
  await createProject(page, "Editor right-click");
  const editor = page.getByRole("textbox", { name: "Writing editor" });
  await editor.fill("Some words");
  const box = (await editor.boundingBox())!;
  await page.mouse.click(box.x + 20, box.y + 10, { button: "right" });
  await expect(menu(page)).toHaveCount(0);
});

test("Reduce Motion: a pointer-opened menu is instant", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await createProject(page, "Reduced menu");
  await rightClick(page, mainRow(page, "manuscript", (await rowTitles(page, "manuscript"))[0]));
  await expect(menu(page)).toBeVisible();
  const state = await menu(page).evaluate((el) => ({
    opacity: getComputedStyle(el).opacity,
    duration: getComputedStyle(el).transitionDuration,
    animations: el.getAnimations().length,
  }));
  expect(state.opacity).toBe("1");
  expect(state.animations).toBe(0);
  expect(state.duration.split(",").every((d) => parseFloat(d) === 0)).toBe(true);
});

// Floating mode (C3): the bottom rows lose their 1 px separators; the normal sidebar keeps them.
function seedFloating(page: Page, floating: boolean) {
  return page.addInitScript((on) => {
    let saved: Record<string, unknown> = {};
    try {
      saved = JSON.parse(localStorage.getItem("folio.workspace.sidebar") ?? "{}") ?? {};
    } catch {
      saved = {};
    }
    localStorage.setItem("folio.workspace.sidebar", JSON.stringify({ ...saved, floating: on }));
  }, floating);
}

const bottomBorders = (page: Page) =>
  page.locator(".sidebar-bottom-groups > .sidebar-group").evaluateAll((els) =>
    els.map((el) => ({ group: el.getAttribute("data-group"), width: getComputedStyle(el).borderTopWidth })),
  );

test.describe("floating sidebar", () => {
  test.use({ viewport: { width: 1600, height: 900 } });

  test("floating: no separators above the bottom rows; the menu still opens at the pointer", async ({ page }) => {
    await seedFloating(page, true);
    await createProject(page, "Floating menu");
    await expect(page.locator(".sidebar-shell")).toHaveClass(/is-floating/);
    const borders = await bottomBorders(page);
    expect(borders.map((b) => b.group)).toEqual(["read", "comments", "history", "settings"]);
    for (const b of borders) expect(b.width, b.group!).toBe("0px");
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/floating-no-dividers.png` });
    const at = await rightClick(page, heading(page, "manuscript"), 30);
    const box = await menuBox(page);
    expect(Math.abs(box.left - at.x)).toBeLessThanOrEqual(1.5);
    expect(Math.abs(box.top - at.y)).toBeLessThanOrEqual(1.5);
  });

  test("normal: the separators stay above Comments, History and Settings", async ({ page }) => {
    await seedFloating(page, false);
    await createProject(page, "Normal dividers");
    await expect(page.locator(".sidebar-shell")).not.toHaveClass(/is-floating/);
    const borders = await bottomBorders(page);
    for (const b of borders.slice(1)) expect(parseFloat(b.width), b.group!).toBeGreaterThan(0);
    await expect(page.locator(".sidebar-groups")).not.toHaveAttribute("data-scroll-bottom", /.*/);
  });
});

// Coordinator item (E2 review): at 560 px the floating group list must scroll in
// its own region that ends above the bottom rows, so no list text paints under them.
test.describe("floating sidebar, short window", () => {
  test.use({ viewport: { width: 1600, height: 560 } });

  test("the scrolling group list ends above the bottom rows; no row overlaps them", async ({ page }) => {
    await seedFloating(page, true);
    await createProject(page, "Floating short");
    await expect(page.locator(".sidebar-shell")).toHaveClass(/is-floating/);
    for (const title of ["Two", "Three", "Four", "Five"]) await addSection(page, title);
    const geo = await page.evaluate(() => {
      const list = document.querySelector(".sidebar-groups")!;
      const l = list.getBoundingClientRect();
      const firstBottom = document.querySelector(".sidebar-bottom-groups > .sidebar-group")!.getBoundingClientRect();
      // Every row's painted part (clipped by the list), lowest first.
      const painted = [...list.querySelectorAll(".entry-main, .group-title")]
        .map((el) => el.getBoundingClientRect())
        .filter((r) => r.top < l.bottom && r.bottom > l.top)
        .map((r) => ({ top: Math.max(r.top, l.top), bottom: Math.min(r.bottom, l.bottom) }));
      return {
        scrolls: list.scrollHeight > list.clientHeight,
        listBottom: l.bottom,
        lastRowBottom: Math.max(...painted.map((r) => r.bottom)),
        bottomTop: firstBottom.top,
        overflow: getComputedStyle(list).overflowY,
        // The cut-off row fades at the list's bottom edge (E2 mask, floating only).
        mask: getComputedStyle(list).maskImage || getComputedStyle(list).getPropertyValue("-webkit-mask-image"),
      };
    });
    expect(geo.scrolls).toBe(true);
    expect(geo.overflow).toBe("auto");
    expect(geo.listBottom).toBeLessThanOrEqual(geo.bottomTop + 0.5);
    expect(geo.lastRowBottom).toBeLessThanOrEqual(geo.bottomTop + 0.5);
    expect(geo.mask).toContain("linear-gradient");
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/floating-560.png` });
  });
});

for (const mode of ["light", "dark"] as const) {
  for (const accent of ["plain", "color"] as const) {
    test(`screenshots ${mode} ${accent}: menu on a section and a group heading; floating without dividers`, async ({ page }) => {
      test.skip(!SHOTS, "set E4_SHOTS to a folder to write screenshots");
      await page.emulateMedia({ colorScheme: mode });
      await page.setViewportSize({ width: 1600, height: 900 });
      await page.addInitScript(
        ([m, a]) =>
          localStorage.setItem(
            "folio.workspace.appearance",
            JSON.stringify({ theme: m, palette: a, sections: { manuscript: "blue", fragments: "green", research: "orange" } }),
          ),
        [mode, accent],
      );
      await createProject(page, "Menu screenshots");
      await addSection(page, "Second section");
      const name = `${SHOTS}/${mode}-${accent}`;
      await rightClick(page, mainRow(page, "manuscript", "Second section"), 40);
      await menuBox(page);
      await item(page, "Rename").hover();
      await page.screenshot({ path: `${name}-menu-section.png`, clip: { x: 0, y: 0, width: 520, height: 520 } });
      await page.keyboard.press("Escape");
      await rightClick(page, heading(page, "fragments"), 40);
      await menuBox(page);
      await page.screenshot({ path: `${name}-menu-group.png`, clip: { x: 0, y: 0, width: 520, height: 520 } });
      await page.keyboard.press("Escape");
      // Floating: switch the setting on and reload.
      await page.evaluate(() => {
        const saved = JSON.parse(localStorage.getItem("folio.workspace.sidebar") ?? "{}");
        localStorage.setItem("folio.workspace.sidebar", JSON.stringify({ ...saved, floating: true }));
      });
      await page.reload();
      await expect(page.locator(".sidebar-shell")).toHaveClass(/is-floating/);
      await page.screenshot({ path: `${name}-floating.png`, clip: { x: 0, y: 0, width: 520, height: 900 } });
    });
  }
}
