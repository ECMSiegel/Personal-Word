import { expect, test, type Page } from "@playwright/test";

async function createWithNotice(page: Page) {
  await page.goto("/");
  await page.getByRole("button", { name: "Start new project" }).click();
  await page.getByRole("button", { name: "Blank", exact: true }).click();
  await page.getByLabel("Project title").fill("Notice test");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await page.getByRole("button", { name: "Snapshot", exact: true }).click();
  await page.getByLabel("Snapshot name").fill("A long snapshot name that widens the notice toast");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.locator(".notice")).toBeVisible();
}

type Box = { x: number; y: number; width: number; height: number };
function intersects(a: Box, b: Box) {
  return a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
}

async function expectClear(page: Page, scope: string, label: string, toast: Box) {
  const buttons = page.locator(scope);
  const n = await buttons.count();
  expect(n, `${label}: found buttons`).toBeGreaterThan(0);
  for (let i = 0; i < n; i++) {
    const button = buttons.nth(i);
    if (!(await button.isVisible())) continue;
    await button.evaluate((el) => el.scrollIntoView({ block: "end" }));
    const box = await button.boundingBox();
    if (box) expect(intersects(toast, box), `${label} button ${i} ${JSON.stringify(box)} vs toast ${JSON.stringify(toast)}`).toBe(false);
  }
}

for (const scheme of ["light", "dark"] as const) {
  test(`notice never covers Export PDF and dismisses itself (${scheme})`, async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 480 });
    await page.emulateMedia({ colorScheme: scheme });
    await createWithNotice(page);
    await page.locator(".group-title").filter({ hasText: /^Settings$/ }).click();
    const pdf = page.getByRole("button", { name: "Export PDF", exact: true });
    await expect(pdf).toBeVisible();
    // Scroll the button to the bottom of its panel, where a bottom toast used to sit.
    await pdf.evaluate((el) => el.scrollIntoView({ block: "end" }));
    const toast = (await page.locator(".notice").boundingBox())!;
    const button = (await pdf.boundingBox())!;
    expect(intersects(toast, button), `toast ${JSON.stringify(toast)} vs button ${JSON.stringify(button)}`).toBe(false);
    await page.screenshot({ path: `${process.env.NOTICE_SHOTS ?? "node_modules/.cache/personal-word-beta/notice-shots"}/notice-${scheme}.png` });
    const download = page.waitForEvent("download");
    await pdf.click();
    expect((await download).suggestedFilename()).toMatch(/\.pdf$/);
    await expect(page.locator(".notice")).toHaveCount(0, { timeout: 7000 });
  });
}

test("notice stays clear of the comments and research panels at 1280x800", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await createWithNotice(page);
  const toast = (await page.locator(".notice").boundingBox())!;
  for (const name of ["Comments", "Research"]) {
    await page.locator(".group-title").filter({ hasText: new RegExp(`^${name}$`) }).click();
    await expectClear(page, "aside button", name, toast);
  }
});

for (const size of [
  { width: 1280, height: 800 },
  { width: 1024, height: 700 },
]) {
  for (const scheme of ["light", "dark"] as const) {
    test(`notice covers nothing in the writing view at ${size.width}x${size.height} (${scheme})`, async ({ page }) => {
      await page.setViewportSize(size);
      await page.emulateMedia({ colorScheme: scheme });
      await createWithNotice(page);
      const notice = page.locator(".notice");
      const toast = (await notice.boundingBox())!;
      const dismiss = notice.locator("button");
      await expect(dismiss).toBeVisible();
      const dismissBox = (await dismiss.boundingBox())!;
      // The dismiss button must be the topmost thing at its own centre.
      const topmost = await page.evaluate(
        ([x, y]) => {
          const el = document.elementFromPoint(x, y);
          return !!el && !!el.closest(".notice button");
        },
        [dismissBox.x + dismissBox.width / 2, dismissBox.y + dismissBox.height / 2],
      );
      expect(topmost, "dismiss button is not covered").toBe(true);
      // No other visible control may sit under the toast.
      const controls = page.locator("button:visible, input:visible, select:visible, [role=textbox]:visible");
      const n = await controls.count();
      expect(n).toBeGreaterThan(5);
      for (let i = 0; i < n; i++) {
        const control = controls.nth(i);
        if (await control.evaluate((el) => !!el.closest(".notice"))) continue;
        const box = await control.boundingBox();
        if (box && box.width > 0 && box.height > 0) {
          expect(
            intersects(toast, box),
            `control ${i} ${await control.evaluate((el) => el.outerHTML.slice(0, 80))} ${JSON.stringify(box)} vs toast ${JSON.stringify(toast)}`,
          ).toBe(false);
        }
      }
      // With the page view scrolled to its end, the last line must stay clear too.
      await page.locator(".ProseMirror").first().click();
      for (let i = 1; i <= 60; i++) {
        await page.keyboard.insertText(`Line ${i} of the notice scroll test.`);
        await page.keyboard.press("Enter");
      }
      await page.keyboard.insertText("Last line of the notice scroll test.");
      await expect(notice, "toast still showing for the screenshot").toBeVisible();
      await page.evaluate(() => {
        document.querySelectorAll("*").forEach((el) => {
          if (el.scrollHeight > el.clientHeight + 4 && getComputedStyle(el).overflowY !== "visible") el.scrollTop = el.scrollHeight;
        });
      });
      const editor = page.locator("[role=textbox]").first();
      await editor.evaluate((el) => el.scrollIntoView({ block: "end" }));
      const editorBox = (await editor.boundingBox())!;
      const textBox = await editor.evaluate((el) => {
        const last = el.lastElementChild as HTMLElement | null;
        // Measure the glyphs of the last line, not the full-width paragraph box.
        const range = document.createRange();
        range.selectNodeContents(last ?? el);
        const r = range.getBoundingClientRect();
        return { x: r.x, y: r.y, width: r.width, height: r.height };
      });
      expect(editorBox).toBeTruthy();
      expect(intersects(toast, textBox), `last line ${JSON.stringify(textBox)} vs toast ${JSON.stringify(toast)}`).toBe(false);
      await page.screenshot({ path: `${process.env.NOTICE_SHOTS ?? "node_modules/.cache/personal-word-beta/notice-shots"}/notice-writing-${size.width}-${scheme}.png` });
    });
  }
}
