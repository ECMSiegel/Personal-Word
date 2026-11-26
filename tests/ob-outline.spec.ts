import { test, expect, type Page } from "@playwright/test";

// OB2 (docs/agent-work/2026-11-22-projects-outline/PLAN.md): the Projects page is one outline
// list. Folders and projects are rows of one height; at every depth sibling names share a left
// edge and a child's name starts one step (--slot, 24 px) right of its parent's; every column's
// right edge is the same on every row; a header row sorts; folder rows show their totals.
// Browser preview storage only (`folio.preview.*`), seeded per test.

type Seed = { id: string; title: string; words: number; sections: number; createdAt: string; updatedAt: string };

const TOP = "aaaa0001-0000-4000-8000-000000000001";
const ZEBRA = "aaaa0002-0000-4000-8000-000000000002";
const ESSAY = "aaaa0003-0000-4000-8000-000000000003";
const DEEP = "aaaa0004-0000-4000-8000-000000000004";

const projects: Seed[] = [
  { id: TOP, title: "Top note", words: 120, sections: 2, createdAt: "2026-10-01T12:00:00.000Z", updatedAt: "2026-11-10T12:00:00.000Z" },
  { id: ZEBRA, title: "Zebra notes", words: 30, sections: 1, createdAt: "2026-08-01T12:00:00.000Z", updatedAt: "2026-09-01T12:00:00.000Z" },
  { id: ESSAY, title: "Essay one", words: 1000, sections: 3, createdAt: "2026-10-05T12:00:00.000Z", updatedAt: "2026-11-05T12:00:00.000Z" },
  { id: DEEP, title: "Deep draft", words: 1117, sections: 1, createdAt: "2026-10-12T12:00:00.000Z", updatedAt: "2026-11-12T12:00:00.000Z" },
];

// Top level: Essays (folder), Top note, Zebra notes. Essays: Drafts (subfolder), Essay one.
// Drafts: Deep draft. Three depths, and a project beside a subfolder (the owner's case).
const library = {
  version: 1,
  folders: [
    { id: "f-essays", name: "Essays", parent: null },
    { id: "f-drafts", name: "Drafts", parent: "f-essays" },
  ],
  placement: { [ESSAY]: "f-essays", [DEEP]: "f-drafts" },
  order: {},
};

async function seed(page: Page, prefs?: object, extra: Seed[] = []) {
  await page.goto("/");
  await page.evaluate(
    ({ seeds, lib, prefs }) => {
      const words = (n: number) => Array.from({ length: n }, (_, i) => "w" + i).join(" ");
      for (const s of seeds) {
        const entries = Array.from({ length: s.sections }, (_, i) => ({
          id: `${s.id.slice(0, 8)}-0000-4000-8000-${String(i).padStart(12, "0")}`,
          kind: "section",
          title: "S" + i,
          content: { type: "doc", content: [{ type: "paragraph" }] },
          text: words(i === 0 ? s.words - (s.sections - 1) : 1),
          updatedAt: s.updatedAt,
          origin: null,
        }));
        localStorage.setItem(
          "folio.preview.project." + s.id,
          JSON.stringify({ id: s.id, title: s.title, createdAt: s.createdAt, updatedAt: s.updatedAt, revision: 1, order: entries.map((e) => e.id), entries }),
        );
      }
      localStorage.setItem("folio.preview.library", JSON.stringify(lib));
      if (prefs) localStorage.setItem("folio.workspace.library", JSON.stringify(prefs));
    },
    { seeds: [...projects, ...extra], lib: library, prefs },
  );
  await page.reload();
  await expect(page.locator("[data-project-id]")).toHaveCount(4 + extra.length);
}

/** The left edge of each named row's name text (works on the old nested tree too). */
const nameLeft = (page: Page) =>
  page.locator(".folder-name, .project-name").evaluateAll((els) =>
    Object.fromEntries(els.map((el) => [el.textContent!.trim(), el.getBoundingClientRect().left])),
  );

/** Row order, as the names read top to bottom. */
const order = (page: Page) =>
  page.locator(".outline-row").evaluateAll((rows) =>
    rows.map((r) => r.querySelector(".folder-name, .project-name")!.textContent!.trim()),
  );

const NOTES = "docs/agent-work/2026-11-22-projects-outline/notes/ob2-shots";

test("sibling names share a left edge at every depth; a child starts one slot right of its parent", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await seed(page);
  const x = await nameLeft(page);
  const near = (a: number, b: number, what: string) => expect.soft(Math.abs(a - b), `${what}: ${a} vs ${b}`).toBeLessThanOrEqual(1);
  // Depth 0: a folder and two projects.
  near(x["Essays"], x["Top note"], "top-level folder vs project");
  near(x["Top note"], x["Zebra notes"], "top-level projects");
  // Depth 1: a subfolder and a project beside it (the owner's screenshot).
  near(x["Drafts"], x["Essay one"], "subfolder vs project in the same folder");
  // One step per depth.
  near(x["Drafts"] - x["Essays"], 24, "depth 1 step");
  near(x["Deep draft"] - x["Drafts"], 24, "depth 2 step");
});

test("columns line up at every depth; rows are one height; one rule between rows and none doubled", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await seed(page);
  await expect(page.locator(".outline-row")).toHaveCount(6);
  for (const col of ["edited", "words", "sections", "added"]) {
    const rights = await page
      .locator(`.outline-row .col-${col}, .outline-header .col-${col}`)
      .evaluateAll((els) => els.map((e) => e.getBoundingClientRect().right));
    expect(rights.length, col).toBe(7);
    for (const r of rights) expect(Math.abs(r - rights[0]), `${col} right edges ${rights}`).toBeLessThanOrEqual(0.5);
  }
  const rows = await page.locator(".outline-row").evaluateAll((els) =>
    els.map((e) => {
      const r = e.getBoundingClientRect();
      const s = getComputedStyle(e);
      return { top: r.top, bottom: r.bottom, height: r.height, borderTop: s.borderTopWidth, borderBottom: s.borderBottomWidth };
    }),
  );
  for (const r of rows) {
    expect(Math.abs(r.height - rows[0].height), `row heights ${rows.map((x) => x.height)}`).toBeLessThanOrEqual(0.5);
    expect(r.borderTop).toBe("1px");
    expect(r.borderBottom).toBe("0px");
  }
  // Rows touch: no gap (and so no second rule) at the end of a folder.
  for (let i = 1; i < rows.length; i++) expect(Math.abs(rows[i].top - rows[i - 1].bottom), `gap above row ${i}`).toBeLessThanOrEqual(0.5);
  // The list closes with one rule under its last row, drawn by the list, not the row.
  const body = page.locator(".outline-body");
  await expect(body).toHaveCSS("border-bottom-width", "1px");
  const bodyBottom = await body.evaluate((e) => e.getBoundingClientRect().bottom);
  expect(Math.abs(bodyBottom - 1 - rows[rows.length - 1].bottom)).toBeLessThanOrEqual(0.5);
});

test("names: project 13px regular, folder 13px bold; project rows carry no icon and their names line up with folder names", async ({ page }) => {
  await seed(page);
  const project = page.locator(`[data-project-id="${TOP}"] .project-name`);
  await expect(project).toHaveCSS("font-size", "13px");
  await expect(project).toHaveCSS("font-weight", "400");
  const folder = page.locator('[data-folder-id="f-essays"] .folder-name');
  await expect(folder).toHaveCSS("font-size", "13px");
  await expect(folder).toHaveCSS("font-weight", "700");
  await expect(page.locator(`[data-project-id="${TOP}"] .outline-icon`)).toHaveCount(0);
  const nameLeft = (sel: string) => page.locator(sel).first().evaluate((el) => el.getBoundingClientRect().left);
  expect(Math.abs((await nameLeft('.outline-row[data-depth="0"] .project-name')) - (await nameLeft('.outline-row[data-depth="0"] .folder-name')))).toBeLessThanOrEqual(0.5);
  const row = page.locator(`[data-project-id="${DEEP}"]`);
  await expect(row).toHaveAttribute("data-depth", "2");
  await expect(row).toHaveAttribute("data-container", "f-drafts");
  await expect(row).toHaveAttribute("data-kind", "project");
  await expect(page.locator('[data-folder-id="f-drafts"]')).toHaveAttribute("data-depth", "1");
});

test("folder rows show total words, n projects and the latest edit inside them", async ({ page }) => {
  await seed(page);
  const essays = page.locator('.outline-row[data-folder-id="f-essays"]');
  await expect(essays.locator(".col-words")).toHaveText("2,117");
  await expect(essays.locator(".col-sections")).toHaveText("2 projects");
  await expect(essays.locator(".col-edited")).toHaveText("Nov 12, 2026");
  await expect(essays.locator(".col-edited")).toHaveAttribute("aria-label", "Edited Nov 12, 2026");
  await expect(essays.locator(".col-added")).toHaveText("");
  const drafts = page.locator('.outline-row[data-folder-id="f-drafts"]');
  await expect(drafts.locator(".col-sections")).toHaveText("1 project");
  // Project cells hold values only; the header labels them.
  const top = page.locator(`[data-project-id="${TOP}"]`);
  await expect(top.locator(".col-words")).toHaveText("120");
  await expect(top.locator(".col-sections")).toHaveText("2");
  await expect(top.locator(".col-edited")).toHaveText("Nov 10, 2026");
});

test("clicking a header sorts by it; clicking it again flips the direction", async ({ page }) => {
  await seed(page);
  const header = page.locator(".outline-header");
  await header.getByRole("button", { name: "Name", exact: true }).click();
  expect(await order(page)).toEqual(["Essays", "Drafts", "Deep draft", "Essay one", "Top note", "Zebra notes"]);
  await expect(header.locator('[role="columnheader"][aria-sort="ascending"]')).toHaveText(/Name/);
  await header.getByRole("button", { name: "Name", exact: true }).click();
  expect(await order(page)).toEqual(["Essays", "Drafts", "Deep draft", "Essay one", "Zebra notes", "Top note"]);
  await expect(header.locator('[role="columnheader"][aria-sort="descending"]')).toHaveText(/Name/);
  // Another column: that sort, direction reset (Words: most first).
  await header.getByRole("button", { name: "Words", exact: true }).click();
  expect(await order(page)).toEqual(["Essays", "Drafts", "Deep draft", "Essay one", "Top note", "Zebra notes"]);
  // Fewest first; "Folders on top" still keeps Drafts above Essay one.
  await header.getByRole("button", { name: "Words", exact: true }).click();
  expect(await order(page)).toEqual(["Essays", "Drafts", "Deep draft", "Essay one", "Zebra notes", "Top note"]);
  await expect(header.locator('[role="columnheader"][aria-sort="ascending"]')).toHaveText(/Words/);
  // The choice is saved.
  await page.reload();
  expect(await order(page)).toEqual(["Essays", "Drafts", "Deep draft", "Essay one", "Zebra notes", "Top note"]);
});

test("a folder row toggles on click; Left and Right on its chevron collapse and expand", async ({ page }) => {
  await seed(page);
  const essays = page.locator('.outline-row[data-folder-id="f-essays"]');
  await essays.locator(".col-words").click();
  await expect(page.locator(".outline-row")).toHaveCount(3);
  await essays.click();
  await expect(page.locator(".outline-row")).toHaveCount(6);
  const chevron = essays.locator(".folder-chevron");
  await chevron.focus();
  await page.keyboard.press("ArrowLeft");
  await expect(chevron).toHaveAttribute("aria-expanded", "false");
  await expect(page.locator(".outline-row")).toHaveCount(3);
  await page.keyboard.press("ArrowRight");
  await expect(chevron).toHaveAttribute("aria-expanded", "true");
  await expect(page.locator(".outline-row")).toHaveCount(6);
});

test("no card view: no card list and no card toggle", async ({ page }) => {
  await seed(page);
  await expect(page.locator(".project-list--cards")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Show project cards" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Show project list" })).toHaveCount(0);
});

test("hidden columns leave no gap", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await seed(page, { sort: "edited", fallbackSort: "edited", reverse: false, foldersFirst: true, columns: ["edited", "added"] });
  await expect(page.locator(".col-words")).toHaveCount(0);
  await expect(page.locator(".col-sections")).toHaveCount(0);
  const top = page.locator(`[data-project-id="${TOP}"]`);
  const edited = await top.locator(".col-edited").evaluate((e) => e.getBoundingClientRect());
  const added = await top.locator(".col-added").evaluate((e) => e.getBoundingClientRect());
  const trash = await top.locator(".delete-entry").evaluate((e) => e.getBoundingClientRect());
  // Edited is followed directly by Added, Added directly by the trash slot: one column gap each.
  const gap = added.left - edited.right;
  expect(gap).toBeGreaterThan(0);
  expect(gap).toBeLessThanOrEqual(8.5);
  // The trash slot is pulled 4 px to the end (.flush-end, so its ink sits on the edge): 8 + 4.
  expect(trash.left - added.right).toBeLessThanOrEqual(12.5);
});

test("at 600 px the header is hidden and rows show Name and Edited only", async ({ page }) => {
  await page.setViewportSize({ width: 600, height: 800 });
  await seed(page);
  await expect(page.locator(".outline-header")).toBeHidden();
  await expect(page.locator(".outline-row .col-edited").first()).toBeVisible();
  for (const col of ["words", "sections", "added"]) {
    const shown = await page.locator(`.outline-row .col-${col}`).evaluateAll((els) => els.filter((e) => (e as HTMLElement).offsetParent !== null).length);
    expect(shown, col).toBe(0);
  }
  // Still aligned at this width.
  const x = await nameLeft(page);
  expect(Math.abs(x["Drafts"] - x["Essay one"])).toBeLessThanOrEqual(1);
  const rights = await page.locator(".outline-row .col-edited").evaluateAll((els) => els.map((e) => e.getBoundingClientRect().right));
  for (const r of rights) expect(Math.abs(r - rights[0])).toBeLessThanOrEqual(0.5);
  const overflow = await page.locator(".library").evaluate((e) => e.scrollWidth - e.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
});

test("screenshots: three-level tree, light and dark, 1280 and 600 wide", async ({ page }) => {
  // Rewrites the reviewed PNGs, so it runs only when asked for (OB2_SHOTS=1).
  test.skip(!process.env.OB2_SHOTS, "set OB2_SHOTS=1 to refresh the task screenshots");
  for (const width of [1280, 600]) {
    for (const scheme of ["light", "dark"] as const) {
      await page.emulateMedia({ colorScheme: scheme, reducedMotion: "reduce" });
      await page.setViewportSize({ width, height: 640 });
      await seed(page);
      await page.mouse.move(0, 0);
      await page.screenshot({ path: `${NOTES}/outline-${width}-${scheme}.png` });
    }
  }
  // A hovered project row: the trash shows at the row's end edge.
  await page.emulateMedia({ colorScheme: "light", reducedMotion: "reduce" });
  await page.setViewportSize({ width: 1280, height: 640 });
  await seed(page);
  await page.locator(`[data-project-id="${ESSAY}"] .project-name`).hover();
  await page.screenshot({ path: `${NOTES}/outline-1280-light-hover.png` });
});

const menu = (page: Page) => page.getByRole("menu");
const item = (page: Page, name: string) => menu(page).getByRole("menuitem", { name, exact: true });

test("right-click menus open on folder and project rows; Escape returns focus to the row", async ({ page }) => {
  await seed(page);
  await page.locator('[data-folder-id="f-drafts"] .folder-name').click({ button: "right" });
  await expect(item(page, "Rename")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(menu(page)).toHaveCount(0);
  await expect(page.locator('[data-folder-id="f-drafts"] .folder-chevron')).toBeFocused();
  await page.locator(`[data-project-id="${TOP}"] .project-name`).click({ button: "right" });
  await expect(item(page, "Open")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.locator(`[data-project-id="${TOP}"] .row-label`)).toBeFocused();
});

test("renaming happens in the row: the field sits on the name edge and the row keeps its height", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await seed(page);
  const height = await page.locator(`[data-project-id="${TOP}"]`).evaluate((e) => e.getBoundingClientRect().height);
  // From the menu.
  await page.locator('[data-folder-id="f-drafts"] .folder-name').click({ button: "right" });
  await item(page, "Rename").click();
  const input = page.getByRole("textbox", { name: "Folder name" });
  await expect(input).toBeFocused();
  // L1: the TEXT starts on the name edge (box left + border + padding), not just the box.
  const left = await input.evaluate((e) => {
    const c = getComputedStyle(e);
    return e.getBoundingClientRect().left + parseFloat(c.borderLeftWidth) + parseFloat(c.paddingLeft);
  });
  const sibling = await page.locator(`[data-project-id="${ESSAY}"] .project-name`).evaluate((e) => e.getBoundingClientRect().left);
  expect(Math.abs(left - sibling)).toBeLessThanOrEqual(1);
  const row = await page.locator('[data-folder-id="f-drafts"]').evaluate((e) => e.getBoundingClientRect().height);
  expect(Math.abs(row - height)).toBeLessThanOrEqual(0.5);
  await input.fill("Rough drafts");
  await page.keyboard.press("Enter");
  await expect(page.locator('[data-folder-id="f-drafts"] .folder-name')).toHaveText("Rough drafts");
  await expect(page.locator('[data-folder-id="f-drafts"] .folder-chevron')).toBeFocused();
  // From the New folder button: Enter saves; Escape on a fresh one removes it.
  await page.getByRole("button", { name: "New folder", exact: true }).click();
  await expect(input).toBeFocused();
  const fresh = await input.evaluate((e) => {
    const c = getComputedStyle(e);
    return e.getBoundingClientRect().left + parseFloat(c.borderLeftWidth) + parseFloat(c.paddingLeft);
  });
  const top = await page.locator(`[data-project-id="${TOP}"] .project-name`).evaluate((e) => e.getBoundingClientRect().left);
  expect(Math.abs(fresh - top)).toBeLessThanOrEqual(1);
  await page.keyboard.type("Archive");
  await page.keyboard.press("Enter");
  await expect(page.locator(".folder-name", { hasText: "Archive" })).toHaveCount(1);
  await page.getByRole("button", { name: "New folder", exact: true }).click();
  await expect(input).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(page.locator('.outline-row[data-kind="folder"]')).toHaveCount(3);
});

test("Option+Down after a header sort moves the row, switches to Custom and keeps focus", async ({ page }) => {
  await seed(page);
  await page.locator(".outline-header").getByRole("button", { name: "Words", exact: true }).click();
  expect(await order(page)).toEqual(["Essays", "Drafts", "Deep draft", "Essay one", "Top note", "Zebra notes"]);
  const label = page.locator(`[data-project-id="${TOP}"] .row-label`);
  await label.focus();
  await page.keyboard.press("Alt+ArrowDown");
  expect(await order(page)).toEqual(["Essays", "Drafts", "Deep draft", "Essay one", "Zebra notes", "Top note"]);
  await expect(page.getByRole("button", { name: "Sort projects" })).toHaveText(/Custom/);
  await expect(label).toBeFocused();
});

test("search: matching projects only, with their folder path; a miss says so", async ({ page }) => {
  await seed(page);
  await page.getByRole("button", { name: "Search projects" }).click();
  await page.getByRole("searchbox", { name: "Filter projects by title" }).fill("draft");
  await expect(page.locator(".outline-row")).toHaveCount(1);
  await expect(page.locator('.outline-row[data-kind="folder"]')).toHaveCount(0);
  await expect(page.locator(`[data-project-id="${DEEP}"] .project-name`)).toHaveText("Deep draft -- Essays / Drafts");
  await page.getByRole("searchbox", { name: "Filter projects by title" }).fill("zzz");
  await expect(page.locator(".outline-row")).toHaveCount(0);
  await expect(page.getByText("No matching projects.")).toBeVisible();
  await expect(page.locator(".outline-header")).toHaveCount(0);
});

test("an empty library shows the empty state and no header", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator(".library-empty")).toBeVisible();
  await expect(page.locator(".outline-header")).toHaveCount(0);
  await expect(page.locator(".outline-row")).toHaveCount(0);
});

test("a long title ellipsizes and the columns still line up at 1280 and 600", async ({ page }) => {
  const long: Seed = {
    id: "aaaa0005-0000-4000-8000-000000000005",
    title: "A very long project title that keeps going well past the width of the name column on any window",
    words: 12345, sections: 12, createdAt: "2026-10-20T12:00:00.000Z", updatedAt: "2026-11-11T12:00:00.000Z",
  };
  for (const width of [1280, 600]) {
    await page.setViewportSize({ width, height: 800 });
    await seed(page, undefined, [long]);
    const name = page.locator(`[data-project-id="${long.id}"] .outline-title`);
    expect(await name.evaluate((e) => e.scrollWidth > e.clientWidth)).toBe(true);
    await expect(name).toHaveCSS("text-overflow", "ellipsis");
    const cols = width === 1280 ? ["edited", "words", "sections", "added"] : ["edited"];
    for (const col of cols) {
      const rights = await page.locator(`.outline-row .col-${col}`).evaluateAll((els) => els.map((e) => e.getBoundingClientRect().right));
      for (const r of rights) expect(Math.abs(r - rights[0]), `${width} ${col} ${rights}`).toBeLessThanOrEqual(0.5);
    }
    const overflow = await page.locator(".library").evaluate((e) => e.scrollWidth - e.clientWidth);
    expect(overflow).toBeLessThanOrEqual(0);
  }
});


test("L2: hovering a folder's chevron grows the icon; nothing moves", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await seed(page);
  const essays = page.locator('.outline-row[data-folder-id="f-essays"]');
  const before = await page.locator(".outline-row").evaluateAll((rows) => rows.map((r) => r.getBoundingClientRect().top));
  const names = await nameLeft(page);
  await essays.locator(".folder-chevron").hover();
  await page.waitForTimeout(400);
  const scale = await essays.locator(".folder-chevron svg").evaluate((e) => getComputedStyle(e).transform);
  expect(scale).toBe("matrix(1.25, 0, 0, 1.25, 0, 0)");
  expect(await page.locator(".outline-row").evaluateAll((rows) => rows.map((r) => r.getBoundingClientRect().top))).toEqual(before);
  expect(await nameLeft(page)).toEqual(names);
});
