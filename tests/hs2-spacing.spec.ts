import { test, expect } from "@playwright/test";

test.use({ viewport: { width: 1280, height: 800 } });

test("line spacing popover: three equal right-aligned boxes and no pt text", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Start new project" }).click();
  await page.getByRole("button", { name: "Blank", exact: true }).click();
  await page.getByLabel("Project title").fill("HS2 spacing");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  const trigger = page.getByRole("button", {
    name: "Line and paragraph spacing",
    exact: true,
  });
  if (!(await trigger.count()))
    await page.getByRole("button", { name: "More formatting" }).click();
  await trigger.click();
  const dialog = page.getByRole("dialog", { name: "Line and paragraph spacing" });
  await expect(dialog).toBeVisible();
  const boxes = [
    dialog.getByLabel("Custom line spacing"),
    dialog.getByLabel("Space before, points"),
    dialog.getByLabel("Space after, points"),
  ];
  const rects = [];
  for (const b of boxes) {
    await expect(b).toBeVisible();
    rects.push((await b.boundingBox())!);
  }
  for (const r of rects.slice(1)) {
    expect(Math.abs(r.width - rects[0].width)).toBeLessThanOrEqual(0.5);
    expect(
      Math.abs(r.x + r.width - (rects[0].x + rects[0].width)),
    ).toBeLessThanOrEqual(0.5);
  }
  const text = await dialog.innerText();
  expect(text).not.toMatch(/(^|\s)pt(\s|$)/);
});
