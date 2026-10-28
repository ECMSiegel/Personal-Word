import { test, expect, type Page } from "@playwright/test";
import { ALLOWED, animatedProperties, installProbe, sampleDuring } from "./motion-helpers";

// Shared probe helpers live in tests/motion-helpers.ts so later tasks can add their own motion specs.

async function openSearch(page: Page) {
  await page.goto("/");
  await expect(page.locator(".library")).toBeVisible();
  return sampleDuring(page, () => page.getByRole("button", { name: "Search projects", exact: true }).click());
}

async function revealSidebar(page: Page) {
  await page.goto("/");
  await page.getByRole("button", { name: "Start new project" }).click();
  await page.getByRole("button", { name: "Blank", exact: true }).click();
  await page.getByLabel("Project title").fill("Motion");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByRole("textbox", { name: "Writing editor" })).toBeVisible();
  await page.getByRole("button", { name: "Unpin sidebar" }).click();
  await page.mouse.move(700, 400);
  await expect(page.locator(".sidebar-shell")).not.toHaveClass(/is-revealed/);
  await page.waitForFunction(() => document.getAnimations().length === 0);
  return sampleDuring(page, () => page.mouse.move(3, 400));
}

async function openProjects(page: Page) {
  await page.goto("/");
  await expect(page.locator(".library")).toBeVisible();
  await page.waitForFunction(() => document.getAnimations().length === 0);
}

const sortButton = (page: Page) => page.getByRole("button", { name: "Sort projects" });

test.beforeEach(async ({ page }) => installProbe(page));

test("(a) opening the projects search animates only transform, opacity, clip-path or visibility", async ({ page }) => {
  const samples = await openSearch(page);
  const props = samples.flatMap((s) => s.props);
  expect(props.length).toBeGreaterThan(0);
  expect(props.filter((p) => !ALLOWED.includes(p))).toEqual([]);
  expect(await animatedProperties(page)).toEqual([]);
});

test("(b) revealing the unpinned sidebar animates only allowed properties", async ({ page }) => {
  const samples = await revealSidebar(page);
  await expect(page.locator(".sidebar-shell")).toHaveClass(/is-revealed/);
  const props = samples.flatMap((s) => s.props);
  expect(props.length).toBeGreaterThan(0);
  expect(props.filter((p) => !ALLOWED.includes(p))).toEqual([]);
});

test("(c) with Reduce Motion there are no running animations and panels change at once", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  const search = await openSearch(page);
  expect(search.length).toBeGreaterThan(0);
  expect(search.map((s) => s.count).filter((n) => n !== 0)).toEqual([]);
  const field = page.locator(".library-search-field");
  expect(await field.evaluate((el) => getComputedStyle(el).clipPath)).toBe("inset(0px)");

  const sidebar = await revealSidebar(page);
  expect(sidebar.length).toBeGreaterThan(0);
  expect(sidebar.map((s) => s.count).filter((n) => n !== 0)).toEqual([]);
  await expect(page.locator(".sidebar-shell")).toHaveClass(/is-revealed/);
});

test("(d) opening the Sort dropdown animates only allowed properties and marks one item highlighted without a box", async ({ page }) => {
  await openProjects(page);
  const samples = await sampleDuring(page, () => sortButton(page).click());
  const listbox = page.getByRole("listbox", { name: "Sort projects" });
  await expect(listbox).toBeVisible();
  const props = samples.flatMap((s) => s.props);
  expect(props.length).toBeGreaterThan(0);
  expect(props.filter((p) => !ALLOWED.includes(p))).toEqual([]);
  await expect(listbox).toHaveClass(/\bpopover\b/);
  await expect(listbox.locator(".popover-highlight")).toHaveCount(0);
  await expect(listbox.locator("[data-popover-item][data-highlighted]")).toHaveCount(1);
  // Items are opaque from the first frame.
  const opacities = await listbox
    .locator("[data-popover-item]")
    .evaluateAll((els) => els.map((el) => getComputedStyle(el).opacity));
  expect(opacities.length).toBe(3);
  expect(opacities.filter((o) => o !== "1")).toEqual([]);
});

test("(e) a menu reopened mid-close reverses from its current frame without remounting", async ({ page }) => {
  await openProjects(page);
  const result = await page.evaluate(async () => {
    const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
    const trigger = document.querySelector<HTMLButtonElement>('button[aria-label="Sort projects"]')!;
    trigger.click();
    await wait(0);
    const menu = document.querySelector<HTMLElement>('[role="listbox"][aria-label="Sort projects"]')!;
    menu.dataset.probe = "1";
    await wait(40);
    menu.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    await wait(40);
    const closing = menu.dataset.state ?? null;
    trigger.click();
    await wait(300);
    const probe = document.querySelector<HTMLElement>("[data-probe]");
    return {
      closing,
      same: probe === menu,
      connected: menu.isConnected,
      role: probe?.getAttribute("role") ?? null,
      state: probe?.dataset.state ?? null,
    };
  });
  expect(result.closing).toBe("closing");
  expect(result).toMatchObject({ same: true, connected: true, role: "listbox", state: null });
});

test("(f) with Reduce Motion a dropdown opens and closes at once with no animations", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await openProjects(page);
  const samples = await sampleDuring(page, () => sortButton(page).click());
  const listbox = page.getByRole("listbox", { name: "Sort projects" });
  await expect(listbox).toBeVisible();
  expect(await page.evaluate(() => document.querySelectorAll(".popover").length)).toBe(1);
  expect(samples.length).toBeGreaterThan(0);
  expect(samples.map((s) => s.count).filter((n) => n !== 0)).toEqual([]);
  await listbox.press("Escape");
  expect(await page.evaluate(() => document.querySelectorAll(".popover").length)).toBe(0);
  expect(await page.evaluate(() => document.getAnimations().length)).toBe(0);
});

test("(g) the highlighted item is the active descendant and bold, inside a bordered, scrolled popover", async ({ page }) => {
  await openProjects(page);
  await sortButton(page).click();
  const listbox = page.getByRole("listbox", { name: "Sort projects" });
  await expect(listbox).toBeFocused();
  // Make the 3-item menu scroll so the highlighted item must follow the keys.
  await listbox.evaluate((el) => (el.style.maxHeight = "60px"));
  await listbox.press("End");
  await listbox.press("ArrowUp");
  await page.waitForFunction(() => document.getAnimations().length === 0);
  const state = await listbox.evaluate((el) => {
    const active = document.getElementById(el.getAttribute("aria-activedescendant")!)!;
    return {
      scrollTop: el.scrollTop,
      border: getComputedStyle(el).borderTopWidth,
      marked: active.hasAttribute("data-highlighted"),
      count: el.querySelectorAll("[data-highlighted]").length,
      weight: getComputedStyle(active).fontWeight,
      background: getComputedStyle(active).backgroundColor,
    };
  });
  expect(state.scrollTop).toBeGreaterThan(0);
  expect(state.border).toBe("1px");
  expect(state.marked).toBe(true);
  expect(state.count).toBe(1);
  expect(Number(state.weight)).toBeGreaterThanOrEqual(600);
  expect(state.background).toBe("rgba(0, 0, 0, 0)");
});
