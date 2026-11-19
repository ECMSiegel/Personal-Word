import { test, expect } from "@playwright/test";

test.use({ viewport: { width: 1440, height: 900 } });

async function create(page: any, title: string) {
  await page.getByRole("button", { name: "Start new project" }).click();
  await page.getByRole("button", { name: "Blank", exact: true }).click();
  await page.getByLabel("Project title").fill(title);
  await page.getByRole("button", { name: "Save", exact: true }).click();
}

async function showAids(page: any) {
  const focus = page.getByRole("button", { name: "Focus mode", exact: true });
  if (!(await focus.isVisible().catch(() => false))) {
    const more = page.getByRole("button", { name: "More formatting", exact: true });
    if (await more.isVisible().catch(() => false)) await more.click();
  }
  await expect(focus).toBeVisible({ timeout: 5_000 });
}

const RULE_NAMES = ["Repeated words", "Possible passive voice", "Filler words", "Long sentences"];

async function openProseCheck(page: any) {
  await page.goto("/");
  await create(page, "Prose menu layout");
  const editor = page.getByRole("textbox", { name: "Writing editor" });
  await editor.fill("The the cat.");
  await showAids(page);
  await page.getByRole("button", { name: "Prose check", exact: true }).click();
  await page.getByRole("checkbox", { name: "On", exact: true }).check();
  return page.getByRole("region", { name: "Prose issues" });
}

test("prose check rule checkboxes share one right edge with the On row", async ({ page }) => {
  const issues = await openProseCheck(page);
  const boxes = [
    page.getByRole("checkbox", { name: "On", exact: true }),
    ...RULE_NAMES.map((name) => issues.getByRole("checkbox", { name, exact: true })),
  ];
  const rights: number[] = [];
  for (const box of boxes) {
    const rect = await box.boundingBox();
    expect(rect).not.toBeNull();
    rights.push(rect!.x + rect!.width);
  }
  for (const right of rights) expect(Math.abs(right - rights[0])).toBeLessThanOrEqual(0.5);
});

test("each prose rule row shows its own count", async ({ page }) => {
  const issues = await openProseCheck(page);
  // "The the cat." has one repeated word and no passive, filler or long-sentence issues.
  const expected = ["1", "0", "0", "0"];
  for (let i = 0; i < RULE_NAMES.length; i++) {
    const row = issues.locator("label.prose-rule").filter({ hasText: RULE_NAMES[i] });
    await expect(row.locator(".prose-rule-count")).toHaveText(expected[i]);
  }
});

test("hovering a prose rule row does not move its checkbox", async ({ page }) => {
  const issues = await openProseCheck(page);
  const row = issues.locator("label.prose-rule").filter({ hasText: "Filler words" });
  const box = issues.getByRole("checkbox", { name: "Filler words", exact: true });
  const before = await box.boundingBox();
  await row.hover();
  const during = await box.boundingBox();
  expect(before).not.toBeNull();
  expect(during).not.toBeNull();
  expect(Math.abs(during!.x - before!.x)).toBeLessThanOrEqual(0.5);
  expect(Math.abs(during!.y - before!.y)).toBeLessThanOrEqual(0.5);
});

test("the status line is one short line and pagination is hidden on one page", async ({ page }) => {
  const issues = await openProseCheck(page);
  await expect(issues.getByText("1 issue", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Previous issue page" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Next issue page" })).toHaveCount(0);
});

for (const scheme of ["light", "dark"] as const) {
  test(`issue list focus rings are not clipped by the scroller (${scheme})`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: scheme });
    const issues = await openProseCheck(page);
    const scroller = issues.locator(".prose-issues");
    const targets = [
      issues.locator(".prose-issue-select").first(),
      issues.locator(".prose-issue-dismiss").first(),
    ];
    for (const target of targets) {
      // Arrive by keyboard, so the ring is the :focus-visible one (a scripted focus after a click is not).
      await target.focus();
      await page.keyboard.press("Shift+Tab");
      await page.keyboard.press("Tab");
      await expect(target).toBeFocused();
      expect(await target.evaluate((el) => el.matches(":focus-visible"))).toBe(true);
      // Outline box = the element's border box grown by outline-offset + outline-width.
      const { ring, view } = await target.evaluate((el) => {
        const style = getComputedStyle(el);
        const grow = parseFloat(style.outlineOffset) + parseFloat(style.outlineWidth);
        const rect = el.getBoundingClientRect();
        const box = el.closest(".prose-issues")!;
        const scroll = box.getBoundingClientRect();
        return {
          ring: { left: rect.left - grow, top: rect.top - grow, right: rect.right + grow, bottom: rect.bottom + grow },
          // The scroller's visible client rect: its border box minus borders and scrollbars.
          view: {
            left: scroll.left + box.clientLeft,
            top: scroll.top + box.clientTop,
            right: scroll.left + box.clientLeft + box.clientWidth,
            bottom: scroll.top + box.clientTop + box.clientHeight,
          },
        };
      });
      await expect(scroller).toBeVisible();
      expect(ring.left).toBeGreaterThanOrEqual(view.left - 0.01);
      expect(ring.top).toBeGreaterThanOrEqual(view.top - 0.01);
      expect(ring.right).toBeLessThanOrEqual(view.right + 0.01);
      expect(ring.bottom).toBeLessThanOrEqual(view.bottom + 0.01);
    }
  });
}
