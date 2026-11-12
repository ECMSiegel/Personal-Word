import { test, expect, type Page } from "@playwright/test";

// HS3 (home stretch 2026-11-11): every checkbox is a square 14px box, not the stock rounded control.

async function openProjectSettings(page: Page) {
  await page.setViewportSize({ width: 1200, height: 900 });
  await page.goto("/");
  await page.getByRole("button", { name: "Start new project" }).click();
  await page.getByRole("button", { name: "Blank", exact: true }).click();
  await page.getByLabel("Project title").fill("HS3 checkbox");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await expect(page.locator(".project-settings .settings-nav")).toBeVisible();
}

async function checkboxStyles(page: Page, scope: string) {
  return page.locator(`${scope} input[type="checkbox"]`).evaluateAll((els) =>
    els.map((el) => {
      const cs = getComputedStyle(el);
      const r = el.getBoundingClientRect();
      return {
        appearance: cs.appearance,
        radius: [cs.borderTopLeftRadius, cs.borderTopRightRadius, cs.borderBottomLeftRadius, cs.borderBottomRightRadius],
        w: Math.round(r.width),
        h: Math.round(r.height),
        borderWidth: cs.borderTopWidth,
      };
    }),
  );
}

function expectSquare(styles: Awaited<ReturnType<typeof checkboxStyles>>, where: string) {
  expect(styles.length, `${where}: has checkboxes`).toBeGreaterThan(0);
  for (const s of styles) {
    expect(s.appearance, `${where}: appearance`).toBe("none");
    expect(s.radius, `${where}: radius`).toEqual(["0px", "0px", "0px", "0px"]);
    expect([s.w, s.h], `${where}: size`).toEqual([14, 14]);
    expect(s.borderWidth, `${where}: border`).toBe("1px");
  }
}

test("checkboxes in Settings (General and Export) are square 14px boxes that fill with the accent", async ({ page }) => {
  await openProjectSettings(page);
  expectSquare(await checkboxStyles(page, ".project-settings"), "project settings");

  const box = page.locator('.project-settings input[type="checkbox"]').first();
  const accent = await page.evaluate(() => {
    const probe = document.createElement("span");
    probe.style.color = "var(--accent)";
    document.body.appendChild(probe);
    const c = getComputedStyle(probe).color;
    probe.remove();
    return c;
  });
  if (await box.isChecked()) await box.uncheck();
  const before = await box.evaluate((el) => getComputedStyle(el).backgroundColor);
  await box.check();
  const after = await box.evaluate((el) => getComputedStyle(el).backgroundColor);
  expect(before).not.toBe(accent);
  expect(after).toBe(accent);
  for (const scheme of ["light", "dark"] as const) {
    await page.emulateMedia({ colorScheme: scheme });
    await page.locator(".project-settings").first().screenshot({
      path: `docs/agent-work/2026-11-11-home-stretch/notes/HS3-${scheme}.png`,
    });
  }
});

test("checkboxes in the Projects-screen Settings dialog are square too", async ({ page }) => {
  await page.setViewportSize({ width: 1200, height: 900 });
  await page.goto("/");
  await page.locator(".library-display > .library-settings").click();
  const dialog = page.getByRole("dialog", { name: "Settings" });
  await expect(dialog).toBeVisible();
  expectSquare(await checkboxStyles(page, '[role="dialog"]'), "settings dialog");
});

test("checkboxes in the prose check panel are 14px squares", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");
  await page.getByRole("button", { name: "Start new project" }).click();
  await page.getByRole("button", { name: "Blank", exact: true }).click();
  await page.getByLabel("Project title").fill("HS3 prose");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  const focus = page.getByRole("button", { name: "Focus mode", exact: true });
  if (!(await focus.isVisible().catch(() => false))) {
    const more = page.getByRole("button", { name: "More formatting", exact: true });
    if (await more.isVisible().catch(() => false)) await more.click();
  }
  await page.getByRole("button", { name: "Prose check", exact: true }).click();
  await expect(page.locator(".prose-check-panel")).toBeVisible();
  expectSquare(await checkboxStyles(page, ".prose-check-panel"), "prose check panel");
});
