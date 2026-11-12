import { expect, test } from "@playwright/test";
import { create } from "./pages-helpers";

// W9 A2 (docs/agent-work/2026-11-10-ui-wave-9/PLAN.md): the sidebar's group list scrolls
// vertically with no visible scrollbar (which would cover the interface on small screens)
// and never scrolls sideways.

test("sidebar group list hides its scrollbar and never scrolls sideways", async ({ page }) => {
  await page.setViewportSize({ width: 1100, height: 500 });
  await create(page, "Scroll sidebar");
  const list = page.locator(".sidebar-groups").first();
  await expect(list).toBeVisible();

  // Enough sections to overflow the list vertically. Each one goes through the
  // New section dialog (Title, then Save), as in tests/command-palette.spec.ts.
  for (let i = 0; i < 25; i++) {
    await page.getByRole("button", { name: "New section", exact: true }).click();
    await page.getByLabel("Title", { exact: true }).fill(`Section ${i + 1}`);
    await page.getByRole("button", { name: "Save", exact: true }).click();
    await expect(page.locator(".modal-backdrop")).toHaveCount(0);
  }
  await expect.poll(() => list.evaluate((el) => el.scrollHeight > el.clientHeight + 1)).toBe(true);

  const style = await list.evaluate((el) => {
    const s = getComputedStyle(el);
    return { overflowX: s.overflowX, overflowY: s.overflowY, scrollbarWidth: s.scrollbarWidth };
  });
  expect(style.overflowX).toBe("hidden");
  expect(style.overflowY).toBe("auto");
  expect(style.scrollbarWidth).toBe("none");

  // No scrollbar gutter takes width from the list.
  const gutter = await list.evaluate((el) => el.offsetWidth - el.clientWidth);
  expect(gutter).toBe(0);

  // The list still scrolls vertically with the wheel.
  const box = await list.boundingBox();
  await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2);
  await page.mouse.wheel(0, 300);
  await expect.poll(() => list.evaluate((el) => el.scrollTop)).toBeGreaterThan(0);
});
