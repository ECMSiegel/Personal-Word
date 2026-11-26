import { test, expect, type Page } from "@playwright/test";

// OB6 (docs/agent-work/2026-11-22-projects-outline/PLAN.md, Open question 1 defaults): pins on the
// Projects page. A pinned row moves out of its place into a band at the top of the list (under the
// header, no heading, no fill, no gap under it), with a 16px muted pin icon in the icon slot before
// its name (on a pinned folder it stands in for the folder icon); a pinned project that lives in a folder shows "-- <folder path>" after its name; a pinned
// folder shows with its contents in the band. Three pins at most. Nothing pinned: no band, no
// gap, no icon. Browser preview storage only (`folio.preview.*`), seeded per test.

type Seed = { id: string; title: string; createdAt: string; updatedAt: string };
const A = "dddd0001-0000-4000-8000-000000000001";
const B = "dddd0002-0000-4000-8000-000000000002";
const C = "dddd0003-0000-4000-8000-000000000003";
const D = "dddd0004-0000-4000-8000-000000000004";
const E1 = "dddd0005-0000-4000-8000-000000000005";
const E2 = "dddd0006-0000-4000-8000-000000000006";
const F1 = "dddd0007-0000-4000-8000-000000000007";
const stamp = (n: number) => `2026-0${n}-01T00:00:00.000Z`;
const seeds: Seed[] = [
  { id: A, title: "Alpha", createdAt: stamp(3), updatedAt: stamp(3) },
  { id: B, title: "Bravo", createdAt: stamp(2), updatedAt: stamp(1) },
  { id: C, title: "Charlie", createdAt: stamp(4), updatedAt: stamp(2) },
  { id: D, title: "Delta", createdAt: stamp(1), updatedAt: stamp(4) },
  { id: E1, title: "Essay one", createdAt: stamp(5), updatedAt: stamp(5) },
  { id: E2, title: "Essay two", createdAt: stamp(6), updatedAt: stamp(6) },
  { id: F1, title: "Novel", createdAt: stamp(5), updatedAt: stamp(5) },
];

type Lib = { version: 1; folders: object[]; placement: Record<string, string>; order: Record<string, string[]>; pins?: string[] };
/** Essays (Essay one, Essay two, subfolder Drafts), Fiction (Novel), then Alpha..Delta at the top. */
const tree = (pins?: string[]): Lib => ({
  version: 1,
  folders: [
    { id: "f-essays", name: "Essays", parent: null },
    { id: "f-fiction", name: "Fiction", parent: null },
    { id: "f-drafts", name: "Drafts", parent: "f-essays" },
  ],
  placement: { [E1]: "f-essays", [E2]: "f-essays", [F1]: "f-fiction" },
  order: {},
  ...(pins ? { pins } : {}),
});

async function seed(page: Page, lib: Lib = tree()) {
  await page.setViewportSize({ width: 1100, height: 900 });
  await page.goto("/");
  await page.evaluate(
    ({ seeds, lib }) => {
      for (const s of seeds)
        localStorage.setItem(
          "folio.preview.project." + s.id,
          JSON.stringify({ ...s, revision: 1, order: [], entries: [] }),
        );
      localStorage.setItem("folio.preview.library", JSON.stringify(lib));
      localStorage.setItem("folio.workspace.library", JSON.stringify({ sort: "name" }));
    },
    { seeds, lib },
  );
  await page.reload();
  await expect(page.locator(".outline-row").first()).toBeVisible();
}

const band = (page: Page) => page.locator(".outline-band");
const rest = (page: Page) => page.locator(".outline-body:not(.outline-band)");
const project = (page: Page, title: string) => page.locator(".project-row").filter({ hasText: title });
const folder = (page: Page, id: string) => page.locator(`.folder-row[data-folder-id="${id}"]`);
const pinIcon = (page: Page) => page.getByRole("img", { name: "Pinned" });
const stored = (page: Page) =>
  page.evaluate(() => JSON.parse(localStorage.getItem("folio.preview.library") ?? "null"));
const menuItem = (page: Page, name: string) => page.getByRole("menu").getByRole("menuitem", { name, exact: true });
async function menuFor(page: Page, row: ReturnType<typeof project>) {
  await row.locator(".project-name, .folder-name").first().click({ button: "right" });
  await expect(page.getByRole("menu")).toBeVisible();
}

test("nothing pinned: no band, no gap, no pin icon, and the menu offers Pin to top", async ({ page }) => {
  await seed(page);
  await expect(band(page)).toHaveCount(0);
  await expect(pinIcon(page)).toHaveCount(0);
  await expect(page.locator("[data-pinned]")).toHaveCount(0);
  // The first row sits directly under the header: no gap made of the band.
  const header = (await page.locator(".outline-header").boundingBox())!;
  const first = (await page.locator(".outline-row").first().boundingBox())!;
  expect(first.y - (header.y + header.height)).toBeLessThanOrEqual(1);
  await menuFor(page, project(page, "Alpha"));
  await expect(menuItem(page, "Pin to top")).not.toHaveAttribute("aria-disabled", "true");
  await expect(menuItem(page, "Unpin")).toHaveCount(0);
});

test("pinning a project that lives in a folder: once, in the band, with its path; the folder count is unchanged", async ({ page }) => {
  await seed(page);
  const count = folder(page, "f-essays").locator(".col-sections");
  await expect(count).toHaveText("2 projects");
  await menuFor(page, project(page, "Essay one"));
  await menuItem(page, "Pin to top").click();
  await expect(project(page, "Essay one")).toHaveCount(1);
  const row = band(page).locator(".project-row").filter({ hasText: "Essay one" });
  await expect(row).toHaveCount(1);
  await expect(row).toContainText("-- Essays");
  await expect(row.getByRole("img", { name: "Pinned" })).toHaveCount(1);
  await expect(pinIcon(page)).toHaveCount(1);
  await expect(count).toHaveText("2 projects");
  // The band comes before everything else, and the pin is saved.
  expect((await stored(page)).pins).toEqual([`p:${E1}`]);
  // The icon is 16px and muted; the path is muted.
  const icon = await row.getByRole("img", { name: "Pinned" }).evaluate((el) => {
    const r = el.getBoundingClientRect();
    return { w: r.width, h: r.height, color: getComputedStyle(el).color };
  });
  expect(icon.w).toBe(16);
  expect(icon.h).toBe(16);
  const muted = await page.evaluate(() => {
    const probe = document.createElement("span");
    probe.style.color = "var(--muted)";
    document.body.append(probe);
    const c = getComputedStyle(probe).color;
    probe.remove();
    return c;
  });
  expect(icon.color).toBe(muted);
  // The icon sits in the icon slot, before the name on the same line.
  const name = (await row.locator(".project-name").boundingBox())!;
  const ibox = (await row.getByRole("img", { name: "Pinned" }).boundingBox())!;
  expect(ibox.x + ibox.width).toBeLessThanOrEqual(name.x + 0.5);
  expect(Math.abs(ibox.y + ibox.height / 2 - (name.y + name.height / 2))).toBeLessThanOrEqual(1.5);
  // Its menu now says Unpin.
  await menuFor(page, row);
  await expect(menuItem(page, "Unpin")).toBeVisible();
  await expect(menuItem(page, "Pin to top")).toHaveCount(0);
});

test("the band sits under the header, has no heading or fill, and the list follows with one rule and no gap", async ({ page }) => {
  await seed(page, tree([`p:${D}`, `p:${E1}`]));
  const header = (await page.locator(".outline-header").boundingBox())!;
  const rows = band(page).locator(".outline-row");
  await expect(rows).toHaveCount(2);
  const first = (await rows.first().boundingBox())!;
  expect(first.y - (header.y + header.height)).toBeLessThanOrEqual(1);
  const last = (await rows.last().boundingBox())!;
  const next = (await rest(page).locator(".outline-row").first().boundingBox())!;
  // The list's first row touches the band's last row; the one rule between them is that row's own.
  expect(Math.abs(next.y - (last.y + last.height))).toBeLessThanOrEqual(0.5);
  await expect(band(page)).toHaveCSS("border-bottom-width", "0px");
  await expect(rest(page).locator(".outline-row").first()).toHaveCSS("border-top-width", "1px");
  expect(await band(page).evaluate((el) => getComputedStyle(el).backgroundColor)).toBe("rgba(0, 0, 0, 0)");
  await expect(band(page).getByRole("heading")).toHaveCount(0);
  // Pinned rows leave their own place: Delta shows once.
  await expect(project(page, "Delta")).toHaveCount(1);
});

test("pinning a folder: it and its contents show only in the band, and it expands and collapses there", async ({ page }) => {
  await seed(page);
  await menuFor(page, folder(page, "f-essays"));
  await menuItem(page, "Pin to top").click();
  const f = band(page).locator('.folder-row[data-folder-id="f-essays"]');
  await expect(f).toHaveCount(1);
  await expect(folder(page, "f-essays")).toHaveCount(1);
  await expect(f.getByRole("img", { name: "Pinned" })).toHaveCount(1);
  // The pin stands in for the folder icon, in the same slot the list's folder icons use.
  await expect(f.locator(".folder-icon")).toHaveCount(0);
  // Its contents are under it in the band and nowhere else.
  for (const title of ["Essay one", "Essay two"]) {
    await expect(band(page).locator(".project-row").filter({ hasText: title })).toHaveCount(1);
    await expect(rest(page).locator(".project-row").filter({ hasText: title })).toHaveCount(0);
  }
  await expect(band(page).locator('.folder-row[data-folder-id="f-drafts"]')).toHaveCount(1);
  await expect(rest(page).locator('.folder-row[data-folder-id="f-drafts"]')).toHaveCount(0);
  // No pin icon on its contents.
  await expect(pinIcon(page)).toHaveCount(1);
  // Collapse in the band.
  await f.locator(".folder-chevron").click();
  await expect(band(page).locator(".project-row")).toHaveCount(0);
  await expect(rest(page).locator(".project-row").filter({ hasText: "Essay one" })).toHaveCount(0);
  await f.locator(".folder-chevron").click();
  await expect(band(page).locator(".project-row")).toHaveCount(2);
});

test("a project pinned and inside a pinned folder shows once, inside the folder, with its own pin mark", async ({ page }) => {
  await seed(page, tree(["f:f-essays", `p:${E1}`]));
  await expect(project(page, "Essay one")).toHaveCount(1);
  const inside = band(page).locator(".project-row").filter({ hasText: "Essay one" });
  await expect(inside).toHaveAttribute("data-depth", "1");
  // S1: it uses a pin slot, so it wears the mark (and no folder path: it is not a top row).
  await expect(inside.getByRole("img", { name: "Pinned" })).toHaveCount(1);
  await expect(inside).not.toContainText("--");
  await expect(pinIcon(page)).toHaveCount(2);
  // The unpinned sibling inside the pinned folder has no mark.
  await expect(band(page).locator(".project-row").filter({ hasText: "Essay two" }).getByRole("img", { name: "Pinned" })).toHaveCount(0);
  // The menu still says Unpin; using it takes it off the list but not out of the folder.
  await menuFor(page, inside);
  await menuItem(page, "Unpin").click();
  expect((await stored(page)).pins).toEqual(["f:f-essays"]);
  await expect(project(page, "Essay one")).toHaveCount(1);
  await expect(pinIcon(page)).toHaveCount(1);
});

test("B1: deleting a pinned project frees its pin slot and removes its pin", async ({ page }) => {
  await seed(page, tree([`p:${A}`, `p:${B}`, `p:${C}`]));
  await menuFor(page, project(page, "Delta"));
  await expect(menuItem(page, "Pin to top (3 of 3 used)")).toHaveAttribute("aria-disabled", "true");
  await page.keyboard.press("Escape");
  await project(page, "Charlie").locator(".delete-entry").click();
  await page.getByRole("button", { name: "Delete project", exact: true }).click();
  await expect(project(page, "Charlie")).toHaveCount(0);
  await expect.poll(async () => (await stored(page)).pins).toEqual([`p:${A}`, `p:${B}`]);
  await expect(pinIcon(page)).toHaveCount(2);
  await menuFor(page, project(page, "Delta"));
  await expect(menuItem(page, "Pin to top")).not.toHaveAttribute("aria-disabled", "true");
  await menuItem(page, "Pin to top").click();
  expect((await stored(page)).pins).toEqual([`p:${A}`, `p:${B}`, `p:${D}`]);
  // Still right after a reload.
  await page.reload();
  await expect(pinIcon(page)).toHaveCount(3);
});

test("B1: a pin left behind by an old delete holds no slot and is dropped by the next pin", async ({ page }) => {
  const ghost = "dddd0099-0000-4000-8000-000000000099";
  await seed(page, tree([`p:${A}`, `p:${ghost}`, `p:${C}`]));
  await expect(pinIcon(page)).toHaveCount(2);
  await menuFor(page, project(page, "Delta"));
  await expect(menuItem(page, "Pin to top")).not.toHaveAttribute("aria-disabled", "true");
  await menuItem(page, "Pin to top").click();
  expect((await stored(page)).pins).toEqual([`p:${A}`, `p:${C}`, `p:${D}`]);
});

// N1 (REVIEW-2): while the project listing has not come back, a folder's Pin/Unpin must not delete
// project pins from library.json. The listing is hidden for one load by filtering localStorage keys.
test("N1: pinning a folder while the project listing is empty keeps every project pin", async ({ page }) => {
  await page.addInitScript(() => {
    const orig = Object.keys;
    Object.keys = function (o: object) {
      const k = orig(o);
      if (o === localStorage && sessionStorage.getItem("n1-hide")) return k.filter((x) => !x.startsWith("folio.preview.project."));
      return k;
    } as typeof Object.keys;
  });
  await seed(page, tree([`f:f-essays`, `p:${A}`]));
  await page.evaluate(() => sessionStorage.setItem("n1-hide", "1"));
  await page.reload();
  await expect(folder(page, "f-fiction")).toBeVisible();
  await expect(page.locator(".project-row")).toHaveCount(0);
  await menuFor(page, folder(page, "f-fiction"));
  await menuItem(page, "Pin to top").click();
  await expect.poll(async () => (await stored(page)).pins).toEqual([`f:f-essays`, `p:${A}`, `f:f-fiction`]);
  // Unpinning a folder in the same state also keeps the project pin.
  await menuFor(page, folder(page, "f-fiction"));
  await menuItem(page, "Unpin").click();
  await expect.poll(async () => (await stored(page)).pins).toEqual([`f:f-essays`, `p:${A}`]);
  await page.evaluate(() => sessionStorage.removeItem("n1-hide"));
  await page.reload();
  await expect(project(page, "Alpha")).toBeVisible();
  expect((await stored(page)).pins).toEqual([`f:f-essays`, `p:${A}`]);
  await expect(band(page).locator(".project-row").filter({ hasText: "Alpha" }).getByRole("img", { name: "Pinned" })).toHaveCount(1);
});

test("B3: a very long pinned name keeps its pin mark, and its path stays inside the name column", async ({ page }) => {
  const long = "A very long pinned project title that keeps going well past the width of the name column on any window at all";
  for (const width of [1280, 600]) {
    await page.setViewportSize({ width, height: 800 });
    await seed(page, tree([`p:${F1}`]));
    await page.evaluate(({ id, title }) => {
      const key = "folio.preview.project." + id;
      localStorage.setItem(key, JSON.stringify({ ...JSON.parse(localStorage.getItem(key)!), title }));
    }, { id: F1, title: long });
    await page.reload();
    const row = band(page).locator(".project-row");
    await expect(row).toHaveCount(1);
    const m = await row.evaluate((r) => {
      const box = (el: Element | null) => el!.getBoundingClientRect();
      const title = r.querySelector(".outline-title")!;
      return {
        nameRight: box(r.querySelector(".project-name")).right,
        pinWidth: box(r.querySelector(".outline-pin")).width,
        nameLeft: box(r.querySelector(".project-name")).left,
        pinRight: box(r.querySelector(".outline-pin")).right,
        pathRight: box(r.querySelector(".project-path")).right,
        pathWidth: box(r.querySelector(".project-path")).width,
        titleRight: box(title).right,
        clipped: title.scrollWidth > title.clientWidth,
        ellipsis: getComputedStyle(title).textOverflow,
      };
    });
    expect(m.clipped, `${width} title is cut with an ellipsis`).toBe(true);
    expect(m.ellipsis).toBe("ellipsis");
    expect(m.pinWidth, `${width} pin keeps its size`).toBe(16);
    expect(m.pinRight, `${width} pin before the name`).toBeLessThanOrEqual(m.nameLeft + 0.5);
    expect(m.pathRight, `${width} path inside the name column`).toBeLessThanOrEqual(m.nameRight + 0.5);
    expect(m.titleRight).toBeLessThanOrEqual(m.pathRight);
    expect(m.pathWidth).toBeGreaterThan(40);
  }
});

test("a fourth pin is refused; Unpin on a pinned row still works", async ({ page }) => {
  await seed(page, tree([`p:${A}`, `p:${B}`, `p:${C}`]));
  await menuFor(page, project(page, "Delta"));
  const item = menuItem(page, "Pin to top (3 of 3 used)");
  await expect(item).toHaveAttribute("aria-disabled", "true");
  await item.click({ force: true });
  await page.keyboard.press("Escape");
  expect((await stored(page)).pins).toEqual([`p:${A}`, `p:${B}`, `p:${C}`]);
  await expect(pinIcon(page)).toHaveCount(3);
  await expect(project(page, "Delta")).not.toHaveAttribute("data-pinned", "");
  // A folder is refused the same way.
  await menuFor(page, folder(page, "f-fiction"));
  await expect(menuItem(page, "Pin to top (3 of 3 used)")).toHaveAttribute("aria-disabled", "true");
  await page.keyboard.press("Escape");
  // Unpinning one frees a place.
  await menuFor(page, project(page, "Bravo"));
  await menuItem(page, "Unpin").click();
  await menuFor(page, project(page, "Delta"));
  await menuItem(page, "Pin to top").click();
  expect((await stored(page)).pins).toEqual([`p:${A}`, `p:${C}`, `p:${D}`]);
});

test("unpin returns the row to its place; the band and gap go when the last pin goes", async ({ page }) => {
  await seed(page, tree([`p:${E1}`]));
  await expect(band(page)).toHaveCount(1);
  await menuFor(page, project(page, "Essay one"));
  await menuItem(page, "Unpin").click();
  await expect(band(page)).toHaveCount(0);
  await expect(pinIcon(page)).toHaveCount(0);
  const inFolder = rest(page).locator(".project-row").filter({ hasText: "Essay one" });
  await expect(inFolder).toHaveAttribute("data-container", "f-essays");
  await expect(inFolder).not.toContainText("--");
  expect((await stored(page)).pins ?? []).toEqual([]);
});

test("pins survive a reload", async ({ page }) => {
  await seed(page);
  await menuFor(page, project(page, "Charlie"));
  await menuItem(page, "Pin to top").click();
  await expect(band(page).locator(".project-row")).toHaveCount(1);
  await page.reload();
  await expect(band(page).locator(".project-row").filter({ hasText: "Charlie" })).toHaveCount(1);
  await expect(pinIcon(page)).toHaveCount(1);
});

test("search ignores pins: matches in their normal order, no band, no icon", async ({ page }) => {
  await seed(page, tree([`p:${E1}`, `p:${D}`]));
  await page.getByRole("button", { name: "Search projects" }).click();
  await page.getByRole("searchbox", { name: "Filter projects by title" }).fill("e");
  await expect(band(page)).toHaveCount(0);
  await expect(pinIcon(page)).toHaveCount(0);
  await expect(page.locator(".folder-row")).toHaveCount(0);
  await expect(project(page, "Essay one")).toHaveCount(1);
  await expect(project(page, "Essay one")).toContainText("-- Essays");
});

test("pinned top rows cannot step with Move up / Move down", async ({ page }) => {
  await seed(page, tree([`p:${D}`]));
  await menuFor(page, project(page, "Delta"));
  await expect(menuItem(page, "Move up")).toHaveAttribute("aria-disabled", "true");
  await expect(menuItem(page, "Move down")).toHaveAttribute("aria-disabled", "true");
});

// Review screenshots (OB6_SHOTS=1): a band holding one pinned folder (expanded) and one pinned
// project that lives in another folder, light and dark.
test("screenshots: the band", async ({ page }) => {
  test.skip(!process.env.OB6_SHOTS, "set OB6_SHOTS=1 to save the review screenshots");
  for (const scheme of ["light", "dark"] as const) {
    await page.emulateMedia({ colorScheme: scheme });
    await seed(page, tree(["f:f-essays", `p:${F1}`]));
    await expect(band(page)).toHaveCount(1);
    await page.screenshot({
      path: `docs/agent-work/2026-11-22-projects-outline/notes/ob6-shots/band-${scheme}.png`,
    });
    await page.evaluate(() => localStorage.clear());
  }
});

// OB10 review shots (OB10_SHOTS=1): a long pinned name with its pin; the column chooser; three pins
// with one inside a pinned folder. Light and dark.
for (const scheme of ["light", "dark"] as const) {
  test(`OB10 screenshots (${scheme})`, async ({ page }) => {
    test.skip(!process.env.OB10_SHOTS, "set OB10_SHOTS=1 to write the review screenshots");
    const dir = "docs/agent-work/2026-11-22-projects-outline/notes/ob10-shots";
    await page.emulateMedia({ colorScheme: scheme });
    await page.setViewportSize({ width: 1100, height: 700 });
    await seed(page, tree([`p:${F1}`, "f:f-essays", `p:${E1}`]));
    await page.evaluate(({ id, title }) => {
      const key = "folio.preview.project." + id;
      localStorage.setItem(key, JSON.stringify({ ...JSON.parse(localStorage.getItem(key)!), title }));
    }, { id: F1, title: "A very long pinned project title that keeps going well past the width of the name column on any window at all" });
    await page.reload();
    await expect(pinIcon(page)).toHaveCount(3);
    await page.mouse.move(2, 2);
    await page.screenshot({ path: `${dir}/band-long-name-inner-pin-${scheme}.png` });
    await page.setViewportSize({ width: 600, height: 700 });
    await page.screenshot({ path: `${dir}/band-600-${scheme}.png` });
    await page.setViewportSize({ width: 1100, height: 700 });
    await page.locator(".outline-header").click({ button: "right", position: { x: 500, y: 20 } });
    await page.waitForTimeout(400);
    await page.screenshot({ path: `${dir}/columns-${scheme}.png` });
    await page.keyboard.press("Escape");
  });
}
