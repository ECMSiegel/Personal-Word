import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

async function create(page: any, title: string) {
  await page.goto("/");
  await page.getByRole("button", { name: "Start new project" }).click();
  await page.getByRole("button", { name: "Blank", exact: true }).click();
  await page.getByLabel("Project title").fill(title);
  await page.getByRole("button", { name: "Save", exact: true }).click();
}

/** The menu is the Popover element (it carries both .popover and .dropdown-menu). */
async function menuRect(page: any) {
  return page
    .locator(".popover:visible")
    .last()
    .evaluate((el: Element) => {
      const r = el.getBoundingClientRect();
      return { x: r.x, y: r.y, right: r.x + r.width, bottom: r.y + r.height };
    });
}

/**
 * A bounded menu must show every item: the clamped height must fit the wrapped
 * content, so the last item's bottom may not sit below the menu's bottom edge.
 */
async function lastItemBottom(page: any) {
  return page
    .locator(".popover:visible")
    .last()
    .evaluate((el: Element) => {
      const items = [...el.querySelectorAll("[data-popover-item], [role=option]")];
      const last = items[items.length - 1];
      return {
        lastBottom: last ? last.getBoundingClientRect().bottom : null,
        menuBottom: el.getBoundingClientRect().bottom,
      };
    });
}

const within = (
  box: { x: number; y: number; width: number; height: number },
  r: { x: number; y: number; right: number; bottom: number },
  tol = 1,
) =>
  r.x >= box.x - tol &&
  r.y >= box.y - tol &&
  r.right <= box.x + box.width + tol &&
  r.bottom <= box.y + box.height + tol;

test("research menus stay inside the research aside scroll container", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await create(page, "Popover bounds");
  await page.locator(".group-title").filter({ hasText: /^Research$/ }).click();
  const aside = page.locator(".research-aside");
  await expect(aside).toBeVisible();
  const asideBox = (await aside.boundingBox())!;

  // A source must exist before Source type and Note form appear.
  await page.getByRole("button", { name: "Enter manually" }).click();
  await page.getByLabel("Title", { exact: true }).fill("Test source");
  await page.getByLabel("Authors", { exact: true }).fill("A. Writer");
  await page.getByLabel("Year", { exact: true }).fill("2020");
  await page.getByLabel("Use repeat citation rules", { exact: true }).check();

  for (const label of ["Full citation again", "Source type"]) {
    await page.getByRole("button", { name: label, exact: true }).click();
    await expect(page.locator(".popover:visible").last()).toBeVisible();
    expect(within(asideBox, await menuRect(page))).toBe(true);
    const cut = await lastItemBottom(page);
    expect(cut.lastBottom, `${label} last item is cut`).toBeLessThanOrEqual(
      cut.menuBottom + 1,
    );
    await page.keyboard.press("Escape");
  }

  // A linked footnote carries the Note form menu.
  await page.getByRole("button", { name: "Cite here" }).first().click();
  await page.getByRole("button", { name: "Note form", exact: true }).click();
  await expect(page.locator(".popover:visible").last()).toBeVisible();
  expect(within(asideBox, await menuRect(page))).toBe(true);
  const noteCut = await lastItemBottom(page);
  expect(noteCut.lastBottom).toBeLessThanOrEqual(noteCut.menuBottom + 1);
  await page.keyboard.press("Escape");
});

// Fable review finding 3: the boundary clamp may only narrow a menu. A 390 px
// aside leaves room for 374 px, but the Dropdown's own CSS cap is 320 px
// (rendered width can still be the trigger's, via min-width: 100%).
test("a menu in the 390 px research aside keeps the Dropdown's 320 px max-width", async ({
  page,
}) => {
  await page.addInitScript(() => {
    localStorage.setItem("personal-word.asidePanelWidth", "390");
  });
  await page.setViewportSize({ width: 1440, height: 900 });
  await create(page, "Popover cap");
  await page.locator(".group-title").filter({ hasText: /^Research$/ }).click();
  const aside = page.locator(".research-aside");
  await expect(aside).toBeVisible();
  expect((await aside.boundingBox())!.width).toBeGreaterThan(380);
  await page.getByRole("button", { name: "Enter manually" }).click();
  await page.getByLabel("Title", { exact: true }).fill("Test source");
  await page.getByLabel("Authors", { exact: true }).fill("A. Writer");
  await page.getByLabel("Year", { exact: true }).fill("2020");
  await page.getByLabel("Use repeat citation rules", { exact: true }).check();
  await page.getByRole("button", { name: "Full citation again", exact: true }).click();
  await expect(page.locator(".popover:visible").last()).toBeVisible();
  // The rendered width here is the trigger's (the Dropdown's min-width is
  // 100%), so assert the cap itself: inline max-width must not exceed 320 px.
  const cap = await page.locator(".popover:visible").last().evaluate((el) => parseFloat(getComputedStyle(el).maxWidth));
  expect(cap).toBeLessThanOrEqual(320);
  await page.keyboard.press("Escape");
});

// The 16.png case: at the aside's minimum width (asideMin 260, App.tsx) the
// repeat-rule menu is wider than the panel, so the window end-flip
// right-aligns it and its left part is cut at the aside's left border.
test("repeat-rule menus stay inside a narrow research aside", async ({
  page,
}) => {
  await page.addInitScript(() => {
    localStorage.setItem("personal-word.asidePanelWidth", "260");
  });
  await page.setViewportSize({ width: 1440, height: 900 });
  await create(page, "Popover bounds narrow");
  await page.locator(".group-title").filter({ hasText: /^Research$/ }).click();
  const aside = page.locator(".research-aside");
  await expect(aside).toBeVisible();
  const asideBox = (await aside.boundingBox())!;
  expect(asideBox.width).toBeLessThanOrEqual(262);

  await page.getByLabel("Use repeat citation rules", { exact: true }).check();
  for (const label of ["Full citation again", "Back-to-back repeat"]) {
    await page.getByRole("button", { name: label, exact: true }).click();
    await expect(page.locator(".popover:visible").last()).toBeVisible();
    const menu = await menuRect(page);
    expect(within(asideBox, menu)).toBe(true);
    // The narrow case is where the clamp wraps labels: the wrapped menu must
    // still be tall enough to show its last item (this failed before the fix).
    const cut = await lastItemBottom(page);
    expect(cut.lastBottom, `${label} last item is cut`).toBeLessThanOrEqual(
      cut.menuBottom + 1,
    );
    await page.keyboard.press("Escape");
  }
});

test("cards-view status dropdown stays inside the sidebar scroll container", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await create(page, "Popover bounds cards");
  await page.getByRole("button", { name: "Show Manuscript cards" }).click();
  const container = page.locator(".sidebar-groups");
  await expect(container).toBeVisible();
  await page.locator(".entry-status").first().locator("button").click();
  await expect(page.locator(".popover:visible").last()).toBeVisible();
  const containerBox = (await container.boundingBox())!;
  expect(within(containerBox, await menuRect(page))).toBe(true);
});

test("toolbar popovers keep their recorded untouched-tree placement", async ({
  page,
}) => {
  const baselinePath =
    process.env.RECTS_BASELINE ??
    join(
      process.cwd(),
      "tests/fixtures/popover-baseline-rects.json",
    );
  const baseline = JSON.parse(readFileSync(baselinePath, "utf8")) as Record<
    string,
    { x: number; y: number; width: number; height: number }
  >;
  await page.setViewportSize({ width: 1440, height: 900 });
  await create(page, "Toolbar baseline");
  await page.locator(".ProseMirror").first().click();

  const triggers = await page
    .locator(".format-bar button[aria-haspopup], .format-bar button[aria-expanded]")
    .all();
  const seen: string[] = [];
  for (const t of triggers) {
    const name =
      (await t.getAttribute("aria-label")) || (await t.textContent()) || "?";
    if (!(name in baseline) || !(await t.isVisible())) continue;
    await t.click();
    await page.waitForTimeout(400);
    const pop = page.locator(".popover:visible, .dropdown-menu:visible").last();
    if (!(await pop.count())) continue;
    const b = await pop.boundingBox();
    const want = baseline[name];
    expect(
      Math.abs(b!.x - want.x),
      `${name} x moved`,
    ).toBeLessThanOrEqual(1);
    expect(
      Math.abs(b!.y - want.y),
      `${name} y moved`,
    ).toBeLessThanOrEqual(1);
    expect(
      Math.abs(b!.width - want.width),
      `${name} width changed`,
    ).toBeLessThanOrEqual(1);
    expect(
      Math.abs(b!.height - want.height),
      `${name} height changed`,
    ).toBeLessThanOrEqual(1);
    seen.push(name);
    await page.keyboard.press("Escape");
    await page.waitForTimeout(300);
  }
  expect(seen).toEqual(Object.keys(baseline));
});
