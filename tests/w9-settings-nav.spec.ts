import { test, expect, type Page } from "@playwright/test";

async function createProject(page: Page, title: string) {
  await page.setViewportSize({ width: 1100, height: 520 });
  await page.goto("/");
  await page.getByRole("button", { name: "Start new project" }).click();
  await page.getByRole("button", { name: "Blank", exact: true }).click();
  await page.getByLabel("Project title").fill(title);
  await page.getByRole("button", { name: "Save", exact: true }).click();
}

async function openSettings(page: Page, title: string) {
  await createProject(page, title);
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await expect(page.locator(".project-settings .settings-nav")).toBeVisible();
}

const headings = (page: Page) =>
  page
    .locator(".project-settings .settings-section h2")
    .evaluateAll((els) => els.map((e) => (e.textContent ?? "").trim()));

test("the strip lists every section in order and stays at the top while scrolling", async ({
  page,
}) => {
  await openSettings(page, "Settings strip");
  const names = await headings(page);
  expect(names.length).toBeGreaterThan(3);
  const links = page.locator(".settings-nav a");
  await expect(links).toHaveText(names);
  const scroller = page.locator("div.project-settings");
  await scroller.evaluate((el) => (el.scrollTop = el.scrollHeight));
  const top = await scroller.evaluate((el) => el.getBoundingClientRect().top);
  const navTop = await page
    .locator(".settings-nav")
    .evaluate((el) => el.getBoundingClientRect().top);
  expect(navTop).toBeGreaterThanOrEqual(top - 1);
  expect(navTop).toBeLessThan(top + 4);
  await expect(page.locator(".settings-nav")).toBeInViewport();
});

test("clicking a link brings that heading just under the strip and marks it", async ({
  page,
}) => {
  await openSettings(page, "Settings strip click");
  await page.emulateMedia({ reducedMotion: "reduce" });
  const names = await headings(page);
  const last = names[names.length - 1];
  await page.locator(".settings-nav a", { hasText: last }).click();
  const h2 = page.locator(".settings-section h2", { hasText: last });
  await expect
    .poll(async () => {
      const navBottom = await page
        .locator(".settings-nav")
        .evaluate((el) => el.getBoundingClientRect().bottom);
      const hTop = await h2.evaluate((el) => el.getBoundingClientRect().top);
      return hTop - navBottom;
    })
    .toBeGreaterThanOrEqual(-1);
  const gap = await page.evaluate(() => {
    const nav = document.querySelector(".settings-nav")!;
    const sc = document.querySelector("div.project-settings")!;
    return {
      scrolled: sc.scrollTop,
      max: sc.scrollHeight - sc.clientHeight,
      navBottom: nav.getBoundingClientRect().bottom,
    };
  });
  expect(gap.scrolled).toBeGreaterThan(0);
  const current = page.locator('.settings-nav a[aria-current="true"]');
  await expect(current).toHaveCount(1);
  await expect(current).toHaveText(last);
  // weight and colour, no fill
  await expect(current).toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
  await expect(current).toHaveCSS("font-weight", "600");
});

test("links work from the keyboard and scroll instantly", async ({ page }) => {
  await openSettings(page, "Settings strip keys");
  const names = await headings(page);
  const second = page.locator(".settings-nav a").nth(2);
  await second.focus();
  await page.keyboard.press("Enter");
  const target = page.locator(".settings-section h2", { hasText: names[2] });
  // instant: no waiting for an animation
  const navBottom = await page
    .locator(".settings-nav")
    .evaluate((el) => el.getBoundingClientRect().bottom);
  const hTop = await target.evaluate((el) => el.getBoundingClientRect().top);
  expect(hTop - navBottom).toBeGreaterThanOrEqual(-1);
  expect(hTop - navBottom).toBeLessThan(60);
  await expect(second).toHaveAttribute("aria-current", "true");
  // Tab reaches the links
  await page.locator("div.project-settings").evaluate((el) => (el.scrollTop = 0));
  await page.locator(".settings-nav a").first().focus();
  await page.keyboard.press("Tab");
  await expect(page.locator(".settings-nav a").nth(1)).toBeFocused();
});

test("scrollToSettingsSection works in the same tick that opens Settings", async ({
  page,
}) => {
  await createProject(page, "Settings strip tick");
  await expect(page.locator(".project-settings")).toHaveCount(0);
  await page.locator(".topbar").getByRole("button", { name: "Export", exact: true }).click();
  await page
    .getByRole("menu", { name: "Export" })
    .getByRole("menuitem", { name: "Export settings..." })
    .click();
  const h2 = page.locator(".settings-section h2", { hasText: "Export document" });
  await expect
    .poll(async () => {
      if ((await h2.count()) === 0) return 99999;
      const navBottom = await page
        .locator(".settings-nav")
        .evaluate((el) => el.getBoundingClientRect().bottom);
      const hTop = await h2.evaluate((el) => el.getBoundingClientRect().top);
      return Math.abs(hTop - navBottom);
    })
    .toBeLessThan(60);
});
