import { test, expect, type Locator, type Page } from "@playwright/test";

// OB5 (docs/agent-work/2026-11-22-projects-outline/PLAN.md, Decisions 4 and 10): dragging and
// Move up / down on the outline. A drag made under ANY sort moves just that one row inside the
// saved hand-made order of its folder, then switches the sort to Custom (owner rule A); with no
// saved order, the order on screen becomes the saved order (rule B). Drop zones: project row top
// half before / bottom half after; collapsed or empty folder thirds before / into / after;
// expanded folder with rows top third before, the rest into; the blank area under the list is the
// top level, last. Browser preview storage only (`folio.preview.*`), seeded per test.

type Seed = { id: string; title: string; createdAt: string; updatedAt: string };
const A = "cccc0001-0000-4000-8000-000000000001";
const B = "cccc0002-0000-4000-8000-000000000002";
const C = "cccc0003-0000-4000-8000-000000000003";
const D = "cccc0004-0000-4000-8000-000000000004";
const E1 = "cccc0005-0000-4000-8000-000000000005";
const E2 = "cccc0006-0000-4000-8000-000000000006";
// Created oldest first: Delta, Bravo, Alpha, Charlie. So Added (newest first) reads Charlie,
// Alpha, Bravo, Delta; Name reads Alpha, Bravo, Charlie, Delta.
const roots: Seed[] = [
  { id: D, title: "Delta", createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-04-01T00:00:00.000Z" },
  { id: B, title: "Bravo", createdAt: "2026-02-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z" },
  { id: A, title: "Alpha", createdAt: "2026-03-01T00:00:00.000Z", updatedAt: "2026-03-01T00:00:00.000Z" },
  { id: C, title: "Charlie", createdAt: "2026-04-01T00:00:00.000Z", updatedAt: "2026-02-01T00:00:00.000Z" },
];
const essays: Seed[] = [
  { id: E1, title: "Essay one", createdAt: "2026-05-01T00:00:00.000Z", updatedAt: "2026-05-01T00:00:00.000Z" },
  { id: E2, title: "Essay two", createdAt: "2026-05-02T00:00:00.000Z", updatedAt: "2026-05-02T00:00:00.000Z" },
];

type Lib = { version: 1; folders: object[]; placement: Record<string, string>; order: Record<string, string[]>; pins?: string[] };
/** Top level: Essays (Essay one, Essay two, subfolder Drafts), Fiction (empty), the four projects. */
const tree = (over: Partial<Lib> = {}): Lib => ({
  version: 1,
  folders: [
    { id: "f-essays", name: "Essays", parent: null },
    { id: "f-fiction", name: "Fiction", parent: null },
    { id: "f-drafts", name: "Drafts", parent: "f-essays" },
  ],
  placement: { [E1]: "f-essays", [E2]: "f-essays" },
  order: {},
  ...over,
});

async function seed(page: Page, opts: { lib?: Lib; prefs?: object; withEssays?: boolean } = {}) {
  const seeds = opts.withEssays === false ? roots : [...roots, ...essays];
  await page.setViewportSize({ width: 1100, height: 900 });
  await page.goto("/");
  await page.evaluate(
    ({ seeds, lib, prefs }) => {
      for (const s of seeds)
        localStorage.setItem(
          "folio.preview.project." + s.id,
          JSON.stringify({ ...s, revision: 1, order: [], entries: [] }),
        );
      if (lib) localStorage.setItem("folio.preview.library", JSON.stringify(lib));
      if (prefs) localStorage.setItem("folio.workspace.library", JSON.stringify(prefs));
    },
    { seeds, lib: opts.lib, prefs: opts.prefs },
  );
  await page.reload();
  await expect(page.locator(".outline-row").first()).toBeVisible();
}

/** Names of the rows in one container, top to bottom (folders and projects together). */
const names = (page: Page, container = "root") =>
  page.locator(`.outline-row[data-container="${container}"]`).evaluateAll((rows) =>
    rows.map((r) => r.querySelector(".folder-name, .project-name")!.textContent!.trim()),
  );
const project = (page: Page, title: string) => page.locator(".project-row").filter({ hasText: title });
const folder = (page: Page, id: string) => page.locator(`.folder-row[data-folder-id="${id}"]`);
const trigger = (page: Page) => page.getByRole("button", { name: "Sort projects" });
const stored = (page: Page) =>
  page.evaluate(() => JSON.parse(localStorage.getItem("folio.preview.library") ?? "null"));
const menuItem = (page: Page, name: string) => page.getByRole("menu").getByRole("menuitem", { name, exact: true });

async function sortBy(page: Page, label: "Name" | "Added" | "Edited" | "Custom") {
  await trigger(page).click();
  const menu = page.getByRole("menu", { name: "Sort projects" });
  await expect(menu).toBeVisible();
  await page.waitForTimeout(400); // reveal animation
  await menu.getByRole("menuitemradio", { name: label, exact: true }).click();
  await page.keyboard.press("Escape");
  await expect(menu).toBeHidden();
  await expect(trigger(page)).toContainText(label);
}

/** Where in the target row to release: a fraction of its height (0 = top edge). */
type Spot = number | "below";
/** A real pointer drag: press in `from`, pass the 4 px threshold, move to `spot` of `to` ("below":
 *  20 px under the last row, the blank area), run `during`, then release. */
async function drag(page: Page, from: Locator, to: Locator | null, spot: Spot, during?: () => Promise<void>) {
  const a = (await from.boundingBox())!;
  let x: number;
  let y: number;
  if (spot === "below") {
    const last = (await page.locator(".outline-row").last().boundingBox())!;
    x = last.x + last.width / 2;
    y = last.y + last.height + 20;
  } else {
    const b = (await to!.boundingBox())!;
    x = b.x + b.width / 2;
    y = b.y + b.height * spot;
  }
  await page.mouse.move(a.x + a.width / 3, a.y + a.height / 2);
  await page.mouse.down();
  await page.mouse.move(a.x + a.width / 3 + 6, a.y + a.height / 2 + 6, { steps: 2 });
  await page.mouse.move(x, y, { steps: 6 });
  await during?.();
  await page.mouse.up();
}
const TOP = 0.2;
const BOTTOM = 0.85;
const MIDDLE = 0.5;

const SHOTS = "docs/agent-work/2026-11-22-projects-outline/notes/ob5-shots";

test("rule A: under Name, a drag moves one row inside the owner's saved order (old key shape) and switches to Custom", async ({ page }) => {
  // The owner's file today: a hand-made order in the old `order.root` key, no `items:` key.
  await seed(page, {
    withEssays: false,
    lib: { version: 1, folders: [], placement: {}, order: { root: [C, B, A, D] } },
    prefs: { sort: "name" },
  });
  expect(await names(page)).toEqual(["Alpha", "Bravo", "Charlie", "Delta"]);
  await drag(page, project(page, "Alpha"), project(page, "Bravo"), BOTTOM, async () => {
    await expect(project(page, "Alpha")).toHaveAttribute("data-drag-state", "lifted");
    await expect(project(page, "Bravo")).toHaveAttribute("data-drag-edge", "end");
  });
  await expect(trigger(page)).toContainText("Custom");
  // Saved C, B, A, D with A moved after B: C, B, A, D -- not the alphabetical order plus a move.
  expect(await names(page)).toEqual(["Charlie", "Bravo", "Alpha", "Delta"]);
  await expect(page.locator("[data-drag-state], [data-drag-edge], [data-drop-into]")).toHaveCount(0);
  // The release did not open Alpha.
  await expect(page.locator(".library")).toBeVisible();
  const lib = await stored(page);
  expect(lib.order["items:root"]).toEqual([`p:${C}`, `p:${B}`, `p:${A}`, `p:${D}`]);
  // The old key is never rewritten.
  expect(lib.order.root).toEqual([C, B, A, D]);
  await page.reload();
  await expect(trigger(page)).toContainText("Custom");
  expect(await names(page)).toEqual(["Charlie", "Bravo", "Alpha", "Delta"]);
});

test("rule B then rule A end to end: the on-screen order is saved, then a drag under Name keeps it", async ({ page }) => {
  await seed(page, { withEssays: false, prefs: { sort: "added" } });
  expect(await names(page)).toEqual(["Charlie", "Alpha", "Bravo", "Delta"]);
  // Rule B: no saved order, so the order on screen (with the move) becomes the saved order.
  await drag(page, project(page, "Bravo"), project(page, "Charlie"), TOP);
  await expect(trigger(page)).toContainText("Custom");
  expect(await names(page)).toEqual(["Bravo", "Charlie", "Alpha", "Delta"]);
  await sortBy(page, "Name");
  expect(await names(page)).toEqual(["Alpha", "Bravo", "Charlie", "Delta"]);
  // Rule A: Delta goes before Alpha in the saved order; the others keep it.
  await drag(page, project(page, "Delta"), project(page, "Alpha"), TOP);
  await expect(trigger(page)).toContainText("Custom");
  expect(await names(page)).toEqual(["Bravo", "Charlie", "Delta", "Alpha"]);
  await page.reload();
  await expect(trigger(page)).toContainText("Custom");
  expect(await names(page)).toEqual(["Bravo", "Charlie", "Delta", "Alpha"]);
});

test("a project dropped on a collapsed folder lands first inside it; the folder stays collapsed", async ({ page }) => {
  const lib = tree();
  (lib.folders[0] as { collapsed?: boolean }).collapsed = true;
  await seed(page, { lib, prefs: { sort: "name" } });
  await expect(page.locator(`.outline-row[data-container="f-essays"]`)).toHaveCount(0);
  await drag(page, project(page, "Alpha"), folder(page, "f-essays"), MIDDLE, async () => {
    await expect(folder(page, "f-essays")).toHaveAttribute("data-drop-into", "");
    const accent = await page.evaluate(() => {
      const s = document.createElement("span");
      s.style.color = "var(--accent)";
      document.body.append(s);
      const c = getComputedStyle(s).color;
      s.remove();
      return c;
    });
    const name = folder(page, "f-essays").locator(".folder-name");
    expect(await name.evaluate((el) => getComputedStyle(el).color)).toBe(accent);
    // Weight and colour only: no fill.
    expect(await folder(page, "f-essays").evaluate((el) => getComputedStyle(el).backgroundColor)).toBe("rgba(0, 0, 0, 0)");
  });
  await expect(trigger(page)).toContainText("Custom");
  await expect(folder(page, "f-essays").locator(".folder-chevron")).toHaveAttribute("aria-expanded", "false");
  expect((await stored(page)).placement[A]).toBe("f-essays");
  await folder(page, "f-essays").locator(".folder-chevron").click();
  // Folders on top: Drafts, then the projects with Alpha first.
  expect(await names(page, "f-essays")).toEqual(["Drafts", "Alpha", "Essay one", "Essay two"]);
  expect(await names(page)).toEqual(["Essays", "Fiction", "Bravo", "Charlie", "Delta"]);
});

test("into a folder with a saved order lands first in that saved order, not before the first row in Name order", async ({ page }) => {
  // Old key shape, a folder with no subfolder: Fiction saved as Essay two, Essay one.
  await seed(page, {
    lib: tree({ placement: { [E1]: "f-fiction", [E2]: "f-fiction" }, order: { "f-fiction": [E2, E1] } }),
    prefs: { sort: "name" },
  });
  expect(await names(page, "f-fiction")).toEqual(["Essay one", "Essay two"]);
  await drag(page, project(page, "Alpha"), folder(page, "f-fiction"), MIDDLE);
  await expect(trigger(page)).toContainText("Custom");
  expect(await names(page, "f-fiction")).toEqual(["Alpha", "Essay two", "Essay one"]);
});

test("into, under Folders on top, goes before the head of the combined saved order", async ({ page }) => {
  // Saved Essays: Essay two, Drafts, Essay one. Under Name the screen shows Drafts first.
  await seed(page, {
    lib: tree({ order: { "items:f-essays": [`p:${E2}`, "f:f-drafts", `p:${E1}`] } }),
    prefs: { sort: "name" },
  });
  expect(await names(page, "f-essays")).toEqual(["Drafts", "Essay one", "Essay two"]);
  await drag(page, project(page, "Alpha"), folder(page, "f-essays"), MIDDLE);
  await expect(trigger(page)).toContainText("Custom");
  expect((await stored(page)).order["items:f-essays"]).toEqual([`p:${A}`, `p:${E2}`, "f:f-drafts", `p:${E1}`]);
  expect(await names(page, "f-essays")).toEqual(["Drafts", "Alpha", "Essay two", "Essay one"]);
});

test("the end line is at the top level even when the last row is nested", async ({ page }) => {
  // Every top-level project lives in Fiction, so the last row on the page is at depth 1.
  await seed(page, {
    lib: tree({ placement: { [E1]: "f-essays", [E2]: "f-essays", [A]: "f-fiction", [B]: "f-fiction", [C]: "f-fiction", [D]: "f-fiction" } }),
    prefs: { sort: "name" },
  });
  const last = page.locator(".outline-row").last();
  await expect(last).toHaveAttribute("data-depth", "1");
  await drag(page, project(page, "Essay one"), null, "below", async () => {
    await expect(last).toHaveAttribute("data-drop-end", "");
    const line = await last.evaluate((el) => ({ left: getComputedStyle(el, "::after").left, w: getComputedStyle(el, "::after").height }));
    expect(line).toEqual({ left: "0px", w: "2px" });
  });
  expect(await names(page)).toEqual(["Essays", "Fiction", "Essay one"]);
});

test("a project dragged to the blank area under the list goes to the top level, last", async ({ page }) => {
  await seed(page, { lib: tree(), prefs: { sort: "name" } });
  expect(await names(page, "f-essays")).toEqual(["Drafts", "Essay one", "Essay two"]);
  await drag(page, project(page, "Essay one"), null, "below", async () => {
    const last = page.locator(".outline-row").last();
    await expect(last).toHaveAttribute("data-drop-end", "");
    await expect(page.locator("[data-drop-end]")).toHaveCount(1);
  });
  await expect(trigger(page)).toContainText("Custom");
  expect(await names(page)).toEqual(["Essays", "Fiction", "Alpha", "Bravo", "Charlie", "Delta", "Essay one"]);
  expect(await names(page, "f-essays")).toEqual(["Drafts", "Essay two"]);
  expect((await stored(page)).placement[E1]).toBeUndefined();
});

test("a folder dropped on another folder moves inside it, first", async ({ page }) => {
  await seed(page, { lib: tree(), prefs: { sort: "name" } });
  await drag(page, folder(page, "f-fiction").locator(".folder-name"), folder(page, "f-essays"), MIDDLE, async () => {
    await expect(folder(page, "f-fiction")).toHaveAttribute("data-drag-state", "lifted");
    await expect(folder(page, "f-essays")).toHaveAttribute("data-drop-into", "");
  });
  await expect(trigger(page)).toContainText("Custom");
  expect(await names(page)).toEqual(["Essays", "Alpha", "Bravo", "Charlie", "Delta"]);
  expect(await names(page, "f-essays")).toEqual(["Fiction", "Drafts", "Essay one", "Essay two"]);
  await expect(folder(page, "f-fiction")).toHaveAttribute("data-depth", "1");
  // The release did not toggle either folder.
  await expect(folder(page, "f-essays").locator(".folder-chevron")).toHaveAttribute("aria-expanded", "true");
});

test("a folder never drops into its own subfolder", async ({ page }) => {
  await seed(page, { lib: tree(), prefs: { sort: "name" } });
  const before = await stored(page);
  await drag(page, folder(page, "f-essays").locator(".folder-name"), folder(page, "f-drafts"), MIDDLE, async () => {
    await expect(folder(page, "f-essays")).toHaveAttribute("data-drag-state", "lifted");
    await expect(page.locator("[data-drop-into], [data-drag-edge], [data-drop-end]")).toHaveCount(0);
  });
  // Nor beside a row inside itself.
  await drag(page, folder(page, "f-essays").locator(".folder-name"), project(page, "Essay one"), TOP, async () => {
    await expect(page.locator("[data-drop-into], [data-drag-edge], [data-drop-end]")).toHaveCount(0);
  });
  await expect(trigger(page)).toContainText("Name");
  expect(await stored(page)).toEqual(before);
  await expect(folder(page, "f-drafts")).toHaveAttribute("data-container", "f-essays");
});

test("a drop where the row already is changes nothing: the sort stays and nothing is written", async ({ page }) => {
  await seed(page, { withEssays: false, prefs: { sort: "name" } });
  // Bravo sits right before Charlie: dropping it on Charlie's top half puts it where it is.
  await drag(page, project(page, "Bravo"), project(page, "Charlie"), TOP, async () => {
    await expect(project(page, "Charlie")).toHaveAttribute("data-drag-edge", "start");
  });
  await expect(trigger(page)).toContainText("Name");
  expect(await stored(page)).toBeNull();
});

test("Escape cancels a drag; nothing moves and the release opens nothing", async ({ page }) => {
  await seed(page, { withEssays: false, prefs: { sort: "name" } });
  await drag(page, project(page, "Delta"), project(page, "Alpha"), TOP, async () => {
    await expect(project(page, "Alpha")).toHaveAttribute("data-drag-edge", "start");
    await page.keyboard.press("Escape");
    await expect(page.locator("[data-drag-state], [data-drag-edge], [data-drop-into], [data-drop-end]")).toHaveCount(0);
  });
  await expect(page.locator(".library")).toBeVisible();
  await expect(trigger(page)).toContainText("Name");
  expect(await names(page)).toEqual(["Alpha", "Bravo", "Charlie", "Delta"]);
  expect(await stored(page)).toBeNull();
});

test("dragging is off while searching", async ({ page }) => {
  await seed(page, { withEssays: false, prefs: { sort: "name" } });
  await page.getByRole("button", { name: "Search projects" }).click();
  await page.getByRole("searchbox", { name: "Filter projects by title" }).fill("a");
  await drag(page, project(page, "Delta"), project(page, "Alpha"), TOP, async () => {
    await expect(page.locator("[data-drag-state], [data-drag-edge], [data-drop-into], [data-drop-end]")).toHaveCount(0);
  });
  await expect(page.locator(".library")).toBeVisible();
  await expect(trigger(page)).toContainText("Name");
  expect(await stored(page)).toBeNull();
});

test("Move up under Name applies to the saved order (rule A), announces the new place and keeps focus", async ({ page }) => {
  await seed(page, {
    withEssays: false,
    lib: { version: 1, folders: [], placement: {}, order: { root: [C, B, A, D] } },
    prefs: { sort: "name" },
  });
  await project(page, "Delta").locator(".row-label").click({ button: "right" });
  await menuItem(page, "Move up").click();
  await expect(trigger(page)).toContainText("Custom");
  // Delta placed before Charlie (its on-screen neighbour) in the saved C, B, A, D.
  expect(await names(page)).toEqual(["Delta", "Charlie", "Bravo", "Alpha"]);
  await expect(page.getByRole("status").filter({ hasText: "Moved" })).toHaveText("Moved Delta to position 1 of 4");
  const alpha = project(page, "Alpha").locator(".row-label");
  await alpha.focus();
  await page.keyboard.press("Alt+ArrowUp");
  expect(await names(page)).toEqual(["Delta", "Charlie", "Alpha", "Bravo"]);
  await expect(alpha).toBeFocused();
  expect((await stored(page)).order["items:root"]).toEqual([`p:${D}`, `p:${C}`, `p:${A}`, `p:${B}`]);
});

test("under Folders on top a project cannot step above a folder, nor a folder below a project", async ({ page }) => {
  await seed(page, { lib: tree(), prefs: { sort: "name" } });
  const alpha = project(page, "Alpha").locator(".row-label");
  await alpha.focus();
  await page.keyboard.press("Alt+ArrowUp");
  await expect(page.getByRole("status").filter({ hasText: "Alpha" })).toHaveText("Alpha is already the first project");
  await expect(trigger(page)).toContainText("Name");
  await project(page, "Alpha").locator(".row-label").click({ button: "right" });
  await expect(menuItem(page, "Move up")).toHaveAttribute("aria-disabled", "true");
  await page.keyboard.press("Escape");
  await folder(page, "f-fiction").locator(".folder-chevron").focus();
  await page.keyboard.press("Alt+ArrowDown");
  await expect(page.getByRole("status").filter({ hasText: "Fiction" })).toHaveText("Fiction is already the last folder");
  expect(await stored(page)).toEqual(tree());
});

test("pinned top rows do not drag and are not before/after targets; a pinned folder accepts into", async ({ page }) => {
  await seed(page, { lib: tree({ pins: ["f:f-fiction", `p:${D}`] }), prefs: { sort: "name" } });
  const fiction = folder(page, "f-fiction");
  await expect(fiction).toHaveAttribute("data-pinned", "");
  // A band row does not lift.
  await drag(page, project(page, "Delta"), project(page, "Alpha"), TOP, async () => {
    await expect(page.locator("[data-drag-state], [data-drag-edge], [data-drop-into], [data-drop-end]")).toHaveCount(0);
  });
  // Over a band project there is no target.
  await drag(page, project(page, "Bravo"), project(page, "Delta"), TOP, async () => {
    await expect(project(page, "Bravo")).toHaveAttribute("data-drag-state", "lifted");
    await expect(page.locator("[data-drag-edge], [data-drop-into], [data-drop-end]")).toHaveCount(0);
  });
  // A band folder takes "into" over its whole height.
  await drag(page, project(page, "Bravo"), fiction, TOP, async () => {
    await expect(fiction).toHaveAttribute("data-drop-into", "");
  });
  expect((await stored(page)).placement[B]).toBe("f-fiction");
  expect(await names(page, "f-fiction")).toEqual(["Bravo"]);
});

test("Folders on top offers no before/after of the other kind; Mixed with projects still does", async ({ page }) => {
  await seed(page, { lib: tree(), prefs: { sort: "name" } });
  const fiction = folder(page, "f-fiction");
  const none = "[data-drag-edge], [data-drop-into], [data-drop-end]";
  // A project over a folder row's top third: "into" the folder, no line before it.
  await drag(page, project(page, "Delta"), fiction, TOP, async () => {
    await expect(fiction).toHaveAttribute("data-drop-into", "");
    await expect(page.locator("[data-drag-edge]")).toHaveCount(0);
    await page.keyboard.press("Escape");
  });
  // ...and its bottom third too.
  await drag(page, project(page, "Delta"), fiction, 0.9, async () => {
    await expect(fiction).toHaveAttribute("data-drop-into", "");
    await expect(page.locator("[data-drag-edge]")).toHaveCount(0);
    await page.keyboard.press("Escape");
  });
  // A folder over a project row: no target at all.
  await drag(page, fiction, project(page, "Alpha"), TOP, async () => {
    await expect(fiction).toHaveAttribute("data-drag-state", "lifted");
    await expect(page.locator(none)).toHaveCount(0);
    await page.keyboard.press("Escape");
  });
  await drag(page, fiction, project(page, "Alpha"), BOTTOM, async () => {
    await expect(page.locator(none)).toHaveCount(0);
    await page.keyboard.press("Escape");
  });
  expect(await stored(page)).toEqual(tree());
  // Mixed with projects: the line is offered beside the other kind.
  await seed(page, { lib: tree(), prefs: { sort: "name", foldersFirst: false } });
  await drag(page, project(page, "Delta"), fiction, TOP, async () => {
    await expect(fiction).toHaveAttribute("data-drag-edge", "start");
    await expect(page.locator("[data-drop-into]")).toHaveCount(0);
    await page.keyboard.press("Escape");
  });
});

// Review screenshots (OB5_SHOTS=1): mid-drag for each kind of drop, light and dark.
test("screenshots: before, into and end mid-drag", async ({ page }) => {
  test.skip(!process.env.OB5_SHOTS, "set OB5_SHOTS=1 to save the review screenshots");
  for (const scheme of ["light", "dark"] as const) {
    await page.emulateMedia({ colorScheme: scheme });
    await seed(page, { lib: tree(), prefs: { sort: "name" } });
    await drag(page, project(page, "Delta"), project(page, "Essay two"), TOP, async () => {
      await expect(project(page, "Essay two")).toHaveAttribute("data-drag-edge", "start");
      await page.screenshot({ path: `${SHOTS}/before-${scheme}.png` });
      await page.keyboard.press("Escape");
    });
    await drag(page, project(page, "Delta"), folder(page, "f-fiction"), MIDDLE, async () => {
      await expect(folder(page, "f-fiction")).toHaveAttribute("data-drop-into", "");
      await page.screenshot({ path: `${SHOTS}/into-${scheme}.png` });
      await page.keyboard.press("Escape");
    });
    await drag(page, project(page, "Essay one"), null, "below", async () => {
      await expect(page.locator("[data-drop-end]")).toHaveCount(1);
      await page.screenshot({ path: `${SHOTS}/end-${scheme}.png` });
      await page.keyboard.press("Escape");
    });
    await page.evaluate(() => localStorage.clear());
  }
});

test("L3: no trash icon shows while a drag is in progress, and it comes back after", async ({ page }) => {
  await seed(page, { lib: tree(), prefs: { sort: "name" } });
  const bravo = project(page, "Bravo");
  await bravo.hover();
  await expect(bravo.locator(".delete-entry")).toHaveCSS("visibility", "visible");
  await drag(page, bravo.locator(".row-label"), project(page, "Charlie"), MIDDLE, async () => {
    await expect(page.locator(".outline[data-dragging]")).toHaveCount(1);
    const shown = await page.locator(".outline-row .delete-entry").evaluateAll((els) =>
      els.filter((e) => getComputedStyle(e).visibility !== "hidden").length,
    );
    expect(shown).toBe(0);
  });
  await expect(page.locator(".outline[data-dragging]")).toHaveCount(0);
  await expect(project(page, "Alpha").locator(".delete-entry")).toHaveCSS("visibility", "visible");
});
