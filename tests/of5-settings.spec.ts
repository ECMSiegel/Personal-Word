import { test, expect, type Locator, type Page } from "@playwright/test";

// OF5 (owner fixes 2026-11-11): the Add font row in both Settings places.

async function openProjectSettings(page: Page) {
  await page.setViewportSize({ width: 1200, height: 900 });
  await page.goto("/");
  await page.getByRole("button", { name: "Start new project" }).click();
  await page.getByRole("button", { name: "Blank", exact: true }).click();
  await page.getByLabel("Project title").fill("OF5 settings");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await expect(page.locator(".project-settings .settings-nav")).toBeVisible();
}

async function openDialogSettings(page: Page) {
  await page.setViewportSize({ width: 1200, height: 900 });
  await page.goto("/");
  await page.locator(".library-display > .library-settings").click();
  await expect(page.getByRole("dialog", { name: "Settings" })).toBeVisible();
}

const box = async (locator: Locator) => (await locator.boundingBox())!;

async function expectSharedRow(page: Page, where: string) {
  const addButton = page.getByRole("button", { name: "Add font..." });
  const menu = page.locator(".appearance-fonts__menu .dropdown-button");
  const b = await box(addButton);
  const m = await box(menu);
  expect(Math.abs(b.y + b.height / 2 - (m.y + m.height / 2)), `${where}: vertical centres`).toBeLessThanOrEqual(4);
  expect(b.x, `${where}: Add font is to the right of the dropdown`).toBeGreaterThanOrEqual(m.x + m.width);
}

test("the hidden font file input stays hidden and Add font matches project Settings", async ({ page }) => {
  await openDialogSettings(page);
  const dialog = page.getByRole("dialog", { name: "Settings" });
  await expect(dialog.locator('input[type="file"][accept=".ttf,.otf"]')).toBeHidden();
  const dialogButton = await box(dialog.getByRole("button", { name: "Add font..." }));
  await dialog.getByRole("button", { name: "Close" }).click();

  await openProjectSettings(page);
  const projectButton = await box(page.getByRole("button", { name: "Add font..." }));
  await expect(page.locator('input[type="file"][accept=".ttf,.otf"]')).toBeHidden();
  expect(Math.abs(dialogButton.height - projectButton.height), `dialog ${dialogButton.height}px vs project ${projectButton.height}px`).toBeLessThanOrEqual(1);
});

test("Add font sits on the Interface font row, to its right, in the project Settings", async ({ page }) => {
  await openProjectSettings(page);
  await expectSharedRow(page, "project Settings");
});

test("Add font sits on the Interface font row, to its right, in the Projects dialog", async ({ page }) => {
  await openDialogSettings(page);
  await expectSharedRow(page, "Projects dialog");
});

test("project Settings shows exactly one rule between the section strip and General", async ({ page }) => {
  await openProjectSettings(page);
  const result = await page.evaluate(() => {
    const nav = document.querySelector<HTMLElement>(".project-settings .settings-nav")!;
    const heading = Array.from(document.querySelectorAll<HTMLElement>(".project-settings .settings-section h2"))
      .find((h) => (h.textContent ?? "").trim() === "General")!;
    const navRect = nav.getBoundingClientRect();
    const headRect = heading.getBoundingClientRect();
    const lines: string[] = [];
    const visibleRule = (style: CSSStyleDeclaration, side: "Top" | "Bottom") =>
      parseFloat(style[`border${side}Width` as "borderTopWidth"]) > 0 && style[`border${side}Style` as "borderTopStyle"] !== "none" &&
      style[`border${side}Color` as "borderTopColor"] !== "rgba(0, 0, 0, 0)";
    const navStyle = getComputedStyle(nav);
    if (visibleRule(navStyle, "Bottom")) lines.push(`strip bottom at ${navRect.bottom.toFixed(1)}`);
    for (const el of Array.from(document.querySelectorAll<HTMLElement>(".project-settings *"))) {
      const r = el.getBoundingClientRect();
      if (r.top < navRect.bottom - 1 || r.top > headRect.top) continue;
      const style = getComputedStyle(el);
      if (visibleRule(style, "Top")) lines.push(`${el.tagName.toLowerCase()}.${String(el.className)} top at ${r.top.toFixed(1)}`);
    }
    return { lines, gap: headRect.top - navRect.bottom };
  });
  expect(result.lines, `rules between the strip and General (gap ${result.gap.toFixed(1)}px)`).toHaveLength(1);
});

async function expectRemoveIsDanger(page: Page, where: string) {
  await page.locator('input[type="file"][accept=".ttf,.otf"]').setInputFiles("/System/Library/Fonts/Supplemental/Trebuchet MS.ttf");
  const remove = page.getByRole("button", { name: "Remove", exact: true });
  await expect(remove).toBeVisible();
  const danger = await page.evaluate(() => {
    const probe = document.createElement("span");
    probe.style.color = "var(--danger)";
    document.body.appendChild(probe);
    const colour = getComputedStyle(probe).color;
    probe.remove();
    return colour;
  });
  const colour = () => remove.evaluate((element) => getComputedStyle(element).color);
  expect(await colour(), `${where}: Remove at rest`).toBe(danger);
  await remove.hover();
  expect(await colour(), `${where}: Remove on hover`).toBe(danger);
  await remove.focus();
  expect(await colour(), `${where}: Remove on focus`).toBe(danger);
}

test("Remove font button is the danger colour in both Settings places", async ({ page }) => {
  await openDialogSettings(page);
  await expectRemoveIsDanger(page, "Projects dialog");
  await page.getByRole("dialog", { name: "Settings" }).getByRole("button", { name: "Close" }).click();
  await openProjectSettings(page);
  await expectRemoveIsDanger(page, "project Settings");
});
