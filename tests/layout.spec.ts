import { test, expect, type Page } from "@playwright/test";

async function create(page: Page, title: string, template = "Blank") {
  await page.getByRole("button", { name: "Start new project" }).click();
  await page.getByRole("button", { name: template, exact: true }).click();
  await page.getByLabel("Project title").fill(title);
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(
    page.getByRole("textbox", { name: "Writing editor" }),
  ).toBeVisible();
}

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/");
});

test("the blue reading progress bar is gone", async ({ page }) => {
  await create(page, "Progress");
  await page
    .getByRole("textbox", { name: "Writing editor" })
    .fill("Some words for scrolling. ".repeat(200));
  await expect(page.locator(".scroll-progress")).toHaveCount(0);
  await expect(page.getByRole("progressbar")).toHaveCount(0);
});

test("the selected sidebar group title is semibold with no box", async ({
  page,
}) => {
  await create(page, "Weights");
  const title = page.locator(".group-title.selected").first();
  await expect(title).toContainText("Manuscript");
  const style = await title.evaluate((el) => {
    const s = getComputedStyle(el);
    return { weight: Number(s.fontWeight), background: s.backgroundColor };
  });
  expect(style.weight).toBeGreaterThanOrEqual(600);
  expect(style.background).toBe("rgba(0, 0, 0, 0)");
  const row = page.locator(".entry-row.selected").first();
  await expect(row).toBeVisible();
  expect(
    Number(await row.evaluate((el) => getComputedStyle(el).fontWeight)),
  ).toBeGreaterThanOrEqual(600);
});

test("an unpinned sidebar has an invisible edge strip that reveals it on hover", async ({
  page,
}) => {
  await create(page, "Edge");
  await page.getByRole("button", { name: "Unpin sidebar" }).click();
  const strip = page.getByRole("button", { name: "Show sidebar" });
  await expect(strip).toHaveAttribute("aria-expanded", "false");
  const box = await strip.boundingBox();
  expect(box!.width).toBeLessThanOrEqual(10);
  await expect(strip).toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
  await expect(page.locator(".sidebar-shell")).not.toHaveClass(/is-revealed/);
  await page.mouse.move(700, 400);
  await page.mouse.move(3, 400);
  await expect(page.locator(".sidebar-shell")).toHaveClass(/is-revealed/);
  await page.mouse.move(700, 400);
  await expect(page.locator(".sidebar-shell")).not.toHaveClass(/is-revealed/);
});

test("page view typing and caret movement never shift the layout sideways", async ({
  page,
}) => {
  await create(page, "Wide", "Chicago student paper");
  const editor = page.getByRole("textbox", { name: "Writing editor" });
  await expect(page.getByLabel("Page count")).toBeVisible();
  await editor.fill(
    "A long sentence with enough words to flow across paper. ".repeat(300),
  );
  await editor.press("End");
  await editor.press("ControlOrMeta+ArrowRight");
  await editor.press("ControlOrMeta+ArrowLeft");
  await editor.press("ControlOrMeta+End");
  await expect
    .poll(() =>
      page.evaluate(
        () => document.querySelector<HTMLElement>(".app")!.scrollLeft,
      ),
    )
    .toBe(0);
  const sidebar = await page.locator(".sidebar").boundingBox();
  expect(sidebar!.x).toBe(0);
});

test("the research side panel resizes from its left edge with the arrow keys", async ({
  page,
}) => {
  await create(page, "Panel");
  await page
    .locator(".group-title")
    .filter({ hasText: /^Research$/ })
    .click();
  const aside = page.locator("aside.research-aside");
  await expect(aside).toBeVisible();
  const before = (await aside.boundingBox())!.width;
  const handle = page.getByRole("separator", { name: "Resize side panel" });
  await handle.focus();
  await handle.press("ArrowLeft");
  await handle.press("ArrowLeft");
  await expect
    .poll(async () => (await aside.boundingBox())!.width)
    .toBeGreaterThanOrEqual(before + 31);
});

test("the writing area starts near the top of the workspace at 1280x800", async ({
  page,
}) => {
  await create(page, "Room");
  const editor = page.getByRole("textbox", { name: "Writing editor" });
  const workspace = await page.locator(".workspace").boundingBox();
  const box = await editor.boundingBox();
  expect(box!.y - workspace!.y).toBeLessThan(140);
});
