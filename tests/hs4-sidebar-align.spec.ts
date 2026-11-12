import { test, expect, type Page } from "@playwright/test";

// HS4: in the docked sidebar the project title lines up with the top bar and the
// "Find in project" row lines up with the format bar. Floating keeps its place.
test.use({ viewport: { width: 1280, height: 800 } });

async function openProject(page: Page) {
  await page.goto("/");
  await page.getByRole("button", { name: "Start new project" }).click();
  await page.getByRole("button", { name: "Chicago", exact: true }).click();
  await page.getByLabel("Project title").fill("HS4 align");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await page.getByRole("textbox", { name: "Writing editor" }).waitFor();
}

const centreY = (page: Page, selector: string) =>
  page.locator(selector).first().evaluate((el) => {
    const r = el.getBoundingClientRect();
    return (r.top + r.bottom) / 2;
  });

test("docked sidebar title and search line up with the top bar and format bar", async ({ page }) => {
  await openProject(page);
  await expect(page.locator(".sidebar-shell")).not.toHaveClass(/is-floating/);
  const title = await centreY(page, ".sidebar-title-row .project-switch");
  const top = await centreY(page, ".topbar");
  const search = await centreY(page, ".sidebar .search input");
  const format = await centreY(page, ".writer > .format-bar");
  expect(Math.abs(title - top), `title ${title} topbar ${top}`).toBeLessThanOrEqual(1);
  expect(Math.abs(search - format), `search ${search} format bar ${format}`).toBeLessThanOrEqual(1);
});

test("narrow docked sidebar keeps the same lines", async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("folio.workspace.sidebar", JSON.stringify({ width: 190 }));
  });
  await openProject(page);
  const title = await centreY(page, ".sidebar-title-row .project-switch");
  const top = await centreY(page, ".topbar");
  const search = await centreY(page, ".sidebar .search input");
  const format = await centreY(page, ".writer > .format-bar");
  expect(Math.abs(title - top)).toBeLessThanOrEqual(1);
  expect(Math.abs(search - format)).toBeLessThanOrEqual(1);
});

test("floating sidebar title position is unchanged", async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("personal-word.restoreTabs", "true");
    localStorage.setItem("folio.workspace.sidebar", JSON.stringify({ floating: true }));
  });
  await openProject(page);
  await expect(page.locator(".sidebar-shell")).toHaveClass(/is-floating/);
  const t = await page.locator(".sidebar-title-row").first().evaluate((el) => {
    const r = el.getBoundingClientRect();
    return { top: Math.round(r.top * 10) / 10, height: Math.round(r.height * 10) / 10 };
  });
  const s = await centreY(page, ".sidebar .search input");
  expect(t.top).toBeCloseTo(FLOAT_TITLE_TOP, 0);
  expect(s).toBeCloseTo(FLOAT_SEARCH_Y, 0);
});

const FLOAT_TITLE_TOP = 130; // recorded before the HS4 fix
const FLOAT_SEARCH_Y = 190; // recorded before the HS4 fix
