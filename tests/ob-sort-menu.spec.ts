import { test, expect, type Page } from "@playwright/test";

// OB4 (docs/agent-work/2026-11-22-projects-outline/PLAN.md): the toolbar's one sort menu
// (Sort by / Direction / Folders, each with one check) and the header row's column chooser.
// Browser preview storage only (`folio.preview.*`), seeded per test.

type Seed = { id: string; title: string; words: number; createdAt: string; updatedAt: string };
const ALPHA = "bbbb0001-0000-4000-8000-000000000001";
const ZED = "bbbb0002-0000-4000-8000-000000000002";
const ESSAY = "bbbb0003-0000-4000-8000-000000000003";
const projects: Seed[] = [
  { id: ALPHA, title: "Alpha", words: 50, createdAt: "2026-10-01T12:00:00.000Z", updatedAt: "2026-11-01T12:00:00.000Z" },
  { id: ZED, title: "Zed", words: 900, createdAt: "2026-08-01T12:00:00.000Z", updatedAt: "2026-09-01T12:00:00.000Z" },
  { id: ESSAY, title: "Essay", words: 300, createdAt: "2026-10-05T12:00:00.000Z", updatedAt: "2026-10-20T12:00:00.000Z" },
];
// Folder "Mid" sorts between Alpha and Zed by name.
const library = {
  version: 1,
  folders: [{ id: "f-mid", name: "Mid", parent: null }],
  placement: { [ESSAY]: "f-mid" },
  order: {},
};

async function seed(page: Page, prefs?: object) {
  await page.goto("/");
  await page.evaluate(
    ({ seeds, lib, prefs }) => {
      for (const s of seeds) {
        const entry = {
          id: `${s.id.slice(0, 8)}-0000-4000-8000-000000000000`,
          kind: "section",
          title: "S",
          content: { type: "doc", content: [{ type: "paragraph" }] },
          text: Array.from({ length: s.words }, (_, i) => "w" + i).join(" "),
          updatedAt: s.updatedAt,
          origin: null,
        };
        localStorage.setItem(
          "folio.preview.project." + s.id,
          JSON.stringify({ id: s.id, title: s.title, createdAt: s.createdAt, updatedAt: s.updatedAt, revision: 1, order: [entry.id], entries: [entry] }),
        );
      }
      localStorage.setItem("folio.preview.library", JSON.stringify(lib));
      if (prefs) localStorage.setItem("folio.workspace.library", JSON.stringify(prefs));
    },
    { seeds: projects, lib: library, prefs },
  );
  await page.reload();
  await expect(page.locator("[data-project-id]")).toHaveCount(3);
}

/** Top-level row names, top to bottom (Essay, inside Mid, is not listed). */
const order = (page: Page) =>
  page.locator('.outline-row[data-depth="0"]').evaluateAll((rows) =>
    rows.map((r) => r.querySelector(".folder-name, .project-name")!.textContent!.trim()),
  );

const trigger = (page: Page) => page.getByRole("button", { name: "Sort projects" });
const menu = (page: Page) => page.getByRole("menu", { name: "Sort projects" });
async function openSort(page: Page) {
  await trigger(page).click();
  await expect(menu(page)).toBeVisible();
  await page.waitForTimeout(400); // reveal animation
}
const pick = (page: Page, name: string) => menu(page).getByRole("menuitemradio", { name, exact: true }).click();
const checkedIn = (page: Page, group: string) =>
  menu(page).getByRole("group", { name: group }).locator('[aria-checked="true"]').allInnerTexts();
const arrow = (page: Page) => page.locator(".outline-sort[data-active] .outline-sort-arrow").innerText();

const SHOTS = "docs/agent-work/2026-11-22-projects-outline/notes/ob4-shots";

test("the old arrow button is gone; the menu has three groups with one check each", async ({ page }) => {
  await page.setViewportSize({ width: 1100, height: 800 });
  await seed(page);
  await expect(page.getByRole("button", { name: "Reverse project sort order" })).toHaveCount(0);
  await expect(trigger(page)).toContainText("Edited");
  await openSort(page);
  for (const group of ["Sort by", "Direction", "Folders"]) {
    expect((await checkedIn(page, group)).length, group).toBe(1);
  }
  expect(await checkedIn(page, "Sort by")).toEqual(["Edited"]);
  expect(await checkedIn(page, "Direction")).toEqual(["Newest first"]);
  expect(await checkedIn(page, "Folders")).toEqual(["On top"]);
  await page.keyboard.press("Escape");
  await expect(menu(page)).toHaveCount(0);
});

test("choosing Words sorts by words and the menu stays open; Direction flips and agrees with the header arrow", async ({ page }) => {
  await page.setViewportSize({ width: 1100, height: 800 });
  await seed(page);
  // Edited, newest first, folder on top: Mid (Essay edited Oct 20 inside), Alpha, Zed.
  await openSort(page);
  await pick(page, "Words");
  await expect(menu(page)).toBeVisible();
  expect(await checkedIn(page, "Sort by")).toEqual(["Words"]);
  expect(await checkedIn(page, "Direction")).toEqual(["Most first"]);
  expect(await order(page)).toEqual(["Mid", "Zed", "Alpha"]); // folder on top, then 900, 50
  expect(await arrow(page)).toBe("↓");

  await pick(page, "Fewest first");
  expect(await checkedIn(page, "Direction")).toEqual(["Fewest first"]);
  expect(await order(page)).toEqual(["Mid", "Alpha", "Zed"]);
  expect(await arrow(page)).toBe("↑");

  await pick(page, "Name");
  expect(await checkedIn(page, "Direction")).toEqual(["Z to A"]); // reverse stays on
  expect(await arrow(page)).toBe("↓"); // Name reversed reads descending
  await page.keyboard.press("Escape");
  await expect(trigger(page)).toContainText("Name");
});

test("Custom disables both Direction rows", async ({ page }) => {
  await seed(page);
  await openSort(page);
  await pick(page, "Custom");
  expect(await checkedIn(page, "Direction")).toEqual([]);
  await expect(menu(page).getByRole("menuitemradio", { name: "Newest first" })).toHaveAttribute("aria-disabled", "true");
  await page.keyboard.press("Escape");
});

test("Mixed puts a folder between projects by name; On top puts it first", async ({ page }) => {
  await seed(page, { sort: "name", fallbackSort: "name", reverse: false });
  expect(await order(page)).toEqual(["Mid", "Alpha", "Zed"]);
  await openSort(page);
  await pick(page, "Mixed with projects");
  expect(await checkedIn(page, "Folders")).toEqual(["Mixed with projects"]);
  expect(await order(page)).toEqual(["Alpha", "Mid", "Zed"]);
  await pick(page, "On top");
  expect(await order(page)).toEqual(["Mid", "Alpha", "Zed"]);
  await page.keyboard.press("Escape");
});

test("the header's right-click chooser hides Added everywhere and survives a reload; Shift+F10 opens it too", async ({ page }) => {
  await page.setViewportSize({ width: 1100, height: 800 });
  await seed(page);
  await expect(page.locator(".outline-heading.col-added")).toHaveCount(1);
  expect(await page.locator(".outline-cell.col-added").count()).toBeGreaterThan(0);

  await page.getByRole("button", { name: "Words", exact: true }).click({ button: "right" });
  const chooser = page.getByRole("menu");
  await expect(chooser.getByRole("menuitemcheckbox")).toHaveText(["Edited", "Words", "Sections", "Added"]);
  for (const row of await chooser.getByRole("menuitemcheckbox").all()) await expect(row).toHaveAttribute("aria-checked", "true");
  await chooser.getByRole("menuitemcheckbox", { name: "Added" }).click();
  await expect(page.locator(".outline-heading.col-added")).toHaveCount(0);
  await expect(page.locator(".outline-cell.col-added")).toHaveCount(0);

  await page.reload();
  await expect(page.locator(".outline-heading.col-edited")).toHaveCount(1);
  await expect(page.locator(".outline-heading.col-added")).toHaveCount(0);
  await expect(page.locator(".outline-cell.col-added")).toHaveCount(0);

  await page.getByRole("button", { name: "Name", exact: true }).focus();
  await page.keyboard.press("Shift+F10");
  await expect(page.getByRole("menuitemcheckbox", { name: "Added", exact: true })).toHaveAttribute("aria-checked", "false");
  // S2: ticked and unticked labels start at the same x (every row reserves the check column).
  const lefts = await page.getByRole("menuitemcheckbox").evaluateAll((rows) =>
    rows.map((r) => r.querySelector(".row-label")!.getBoundingClientRect().left),
  );
  expect(lefts).toHaveLength(4);
  for (const x of lefts) expect(Math.abs(x - lefts[0])).toBeLessThanOrEqual(0.5);
  // The check is the sort menu's icon, not text.
  await expect(page.getByRole("menuitemcheckbox", { name: "Words", exact: true }).locator(".dropdown-check svg")).toHaveCount(1);
  await page.keyboard.press("Escape");
});

for (const scheme of ["light", "dark"] as const) {
  test(`screenshots of the open sort menu and the column chooser (${scheme})`, async ({ page }) => {
    test.skip(!process.env.OB4_SHOTS, "set OB4_SHOTS=1 to rewrite the reviewed screenshots");
    await page.emulateMedia({ colorScheme: scheme });
    await page.setViewportSize({ width: 1100, height: 800 });
    await seed(page);
    await openSort(page);
    await page.screenshot({ path: `${SHOTS}/sort-menu-${scheme}.png` });
    await page.keyboard.press("Escape");
    await page.getByRole("button", { name: "Words", exact: true }).click({ button: "right" });
    await page.waitForTimeout(400);
    await page.screenshot({ path: `${SHOTS}/columns-${scheme}.png` });
    await page.keyboard.press("Escape");
    await openSort(page);
    await pick(page, "Custom");
    await page.screenshot({ path: `${SHOTS}/sort-menu-custom-${scheme}.png` });
  });
}

test("S3: a right-click anywhere on the header row opens the chooser; a click anywhere in a header cell sorts", async ({ page }) => {
  await page.setViewportSize({ width: 1100, height: 800 });
  await seed(page);
  const header = (await page.locator(".outline-header").boundingBox())!;
  const words = page.locator(".outline-heading.col-words");
  const cell = (await words.boundingBox())!;
  const label = (await words.getByRole("button", { name: "Words", exact: true }).evaluate((b) => {
    const r = document.createRange();
    r.selectNodeContents(b);
    const t = r.getBoundingClientRect();
    return { left: t.left, right: t.right };
  }));
  // Blank space in the header row (left of the Name label's column? no: between the icon slot and
  // the first label, and above the label text inside the cell).
  await page.mouse.click(cell.x + 2, header.y + 3, { button: "right" });
  await expect(page.getByRole("menu", { name: "Columns" })).toBeVisible();
  await page.keyboard.press("Escape");
  await page.mouse.click(header.x + header.width - 3, header.y + header.height - 3, { button: "right" });
  await expect(page.getByRole("menu", { name: "Columns" })).toBeVisible();
  await page.keyboard.press("Escape");
  // The label sits on the column's right edge (the shared edge of the values below it).
  expect(Math.abs(label.right - (cell.x + cell.width))).toBeLessThanOrEqual(0.5);
  // The Words cell sorts from the top corner of the cell, not only from its label text.
  await page.mouse.click(cell.x + cell.width - 2, cell.y + 2);
  await expect(page.locator(".outline-sort[data-active]")).toHaveText(/Words/);
  // The label did not move (still ends on the column's right edge).
  const after = await words.getByRole("button", { name: "Words", exact: true }).evaluate((b) => {
    const r = document.createRange();
    r.selectNodeContents(b);
    return r.getBoundingClientRect().right;
  });
  expect(Math.abs(after - label.right), JSON.stringify({ label, after, cell })).toBeLessThanOrEqual(0.5);
});

test("S-new-1: keyboard focus rings the label and arrow only; the whole cell still sorts", async ({ page }) => {
  await page.setViewportSize({ width: 1100, height: 800 });
  await seed(page);
  for (const name of ["Name", "Edited"]) {
    const cell = page.locator(`.outline-heading.col-${name.toLowerCase()}`);
    await page.keyboard.press("Tab"); // a keyboard press first, so the focus counts as :focus-visible
    await cell.getByRole("button", { name, exact: true }).focus();
    const m = await cell.evaluate((c) => {
      const b = c.querySelector("button")!;
      const l = b.querySelector(".outline-sort-label")!;
      const bs = getComputedStyle(b);
      const ls = getComputedStyle(l);
      const lr = l.getBoundingClientRect();
      const cr = c.getBoundingClientRect();
      return { btn: bs.outlineStyle, label: ls.outlineStyle, width: ls.outlineWidth, cell: cr.width, ring: lr.width };
    });
    expect(m.btn, name).toBe("none");
    expect(m.label, name).toBe("solid");
    expect(m.width, name).toBe("2px");
    expect(m.ring, JSON.stringify(m)).toBeLessThan(name === "Name" ? m.cell / 2 : m.cell - 20);
  }
});

test("L-new-2: Home and End in a cut-off sort menu bring the first and last group into view", async ({ page }) => {
  await page.setViewportSize({ width: 1100, height: 500 });
  await seed(page);
  await trigger(page).focus();
  await page.keyboard.press("ArrowDown");
  await expect(menu(page)).toBeVisible();
  await page.waitForTimeout(400);
  await page.keyboard.press("End");
  const end = await menu(page).evaluate((m) => ({ top: m.scrollTop, max: m.scrollHeight - m.clientHeight }));
  expect(end.max, "the menu is cut off").toBeGreaterThan(0);
  expect(Math.abs(end.top - end.max)).toBeLessThanOrEqual(1);
  await page.keyboard.press("Home");
  await expect.poll(() => menu(page).evaluate((m) => m.scrollTop)).toBe(0);
});

// OB10b review shots (OB10B_SHOTS=1): the header focus ring on Name and Edited, light and dark.
for (const scheme of ["light", "dark"] as const) {
  test(`OB10b header focus ring screenshots (${scheme})`, async ({ page }) => {
    test.skip(!process.env.OB10B_SHOTS, "set OB10B_SHOTS=1 to write the review screenshots");
    await page.emulateMedia({ colorScheme: scheme });
    await page.setViewportSize({ width: 1100, height: 600 });
    await seed(page);
    for (const name of ["Name", "Edited"]) {
      await page.keyboard.press("Tab");
      await page.locator(`.outline-heading.col-${name.toLowerCase()}`).getByRole("button", { name, exact: true }).focus();
      await page.locator(".outline-header").screenshot({ path: `docs/agent-work/2026-11-22-projects-outline/notes/ob10b-shots/focus-${name.toLowerCase()}-${scheme}.png` });
    }
  });
}
