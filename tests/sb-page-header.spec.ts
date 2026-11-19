import { test, expect, type Page } from "@playwright/test";
import { create, dense, seedBlocks, select, settle, togglePageView } from "./pages-helpers";

// Page header text, corner placement and "Different first page" (page-header plan T1-T5).
// On-screen labels are `.page-label` (data-page = 0-based page index, data-position).

test.use({ viewport: { width: 1280, height: 900 } });

const editorOf = (page: Page) =>
  page.getByRole("textbox", { name: "Writing editor", exact: true });

async function openSetup(page: Page) {
  const bar = page.getByRole("toolbar", { name: "Formatting" });
  const direct = bar.getByRole("button", { name: "Page setup", exact: true });
  if (await direct.isVisible().catch(() => false)) await direct.click();
  else {
    await bar.getByRole("button", { name: "More formatting", exact: true }).click();
    await page.getByRole("button", { name: "Page setup", exact: true }).last().click();
  }
  const dialog = page.getByRole("dialog", { name: "Page setup" });
  await expect(dialog).toBeVisible();
  return dialog;
}

async function configure(
  page: Page,
  o: { text?: string; position?: string; first?: boolean; numbers?: boolean },
) {
  const dialog = await openSetup(page);
  if (o.numbers !== undefined) {
    const box = dialog.getByRole("checkbox", { name: "Page numbers" });
    if (o.numbers) await box.check();
    else await box.uncheck();
  }
  if (o.text !== undefined) {
    const field = dialog.getByRole("textbox", { name: "Page header text" });
    await field.fill("");
    // Key by key: the field must keep focus and caret while the setting changes.
    await field.pressSequentially(o.text);
    await expect(field).toBeFocused();
    await expect(field).toHaveValue(o.text);
    await field.press("Enter");
  }
  if (o.position) {
    await dialog.getByRole("button", { name: "Page number position" }).click();
    await page.getByRole("option", { name: o.position, exact: true }).click();
  }
  if (o.first !== undefined) {
    const box = dialog.getByRole("checkbox", { name: "Different first page" });
    if (o.first) await box.check();
    else await box.uncheck();
  }
  await page.keyboard.press("Escape");
  await settle(page);
}

async function threePages(page: Page, title: string) {
  await create(page, title);
  await seedBlocks(page, dense(30));
  await togglePageView(page);
  await expect.poll(() => page.locator(".page-sheet").count()).toBeGreaterThanOrEqual(3);
  await settle(page);
}

const labels = (page: Page) =>
  page.evaluate(() =>
    [...document.querySelectorAll<HTMLElement>(".page-label")].map((el) => ({
      page: Number(el.dataset.page),
      position: el.dataset.position,
      text: (el.textContent ?? "").trim(),
    })),
  );

/** Where each label sits against its own sheet and the text area, in screen px. */
const boxes = (page: Page) =>
  page.evaluate(() => {
    const sheets = [...document.querySelectorAll<HTMLElement>(".page-sheet")].map((s) =>
      s.getBoundingClientRect(),
    );
    const area = document.querySelector<HTMLElement>(".writing-surface")!.getBoundingClientRect();
    const margin = area.left - sheets[0].left;
    return [...document.querySelectorAll<HTMLElement>(".page-label")].map((el) => {
      const r = el.getBoundingClientRect();
      const s = sheets[Number(el.dataset.page)];
      return {
        page: Number(el.dataset.page),
        topBand: r.top >= s.top - 1 && r.bottom <= s.top + margin + 1,
        bottomBand: r.top >= s.bottom - margin - 1 && r.bottom <= s.bottom + 1,
        leftGap: r.left - area.left,
        rightGap: area.right - r.right,
        centreGap: (r.left + r.right) / 2 - (area.left + area.right) / 2,
      };
    });
  });

test("(a) text plus number in Top right on every page, inside the top margin", async ({ page }) => {
  await threePages(page, "Header a");
  await configure(page, { numbers: true, text: "Siegel", position: "Top right" });
  const sheets = await page.locator(".page-sheet").count();
  const got = await labels(page);
  expect(got.length).toBe(sheets);
  got.forEach((l, i) => expect(l.text).toBe(`Siegel ${i + 1}`));
  for (const b of await boxes(page)) {
    expect(b.topBand).toBe(true);
    expect(Math.abs(b.rightGap)).toBeLessThanOrEqual(1);
  }
});

test("(b) each corner lands in the matching band and side", async ({ page }) => {
  await threePages(page, "Header b");
  await configure(page, { numbers: true, text: "Siegel" });
  const cases: [string, "topBand" | "bottomBand", "left" | "right" | "centre"][] = [
    ["Top left", "topBand", "left"],
    ["Top center", "topBand", "centre"],
    ["Top right", "topBand", "right"],
    ["Bottom left", "bottomBand", "left"],
    ["Bottom center", "bottomBand", "centre"],
    ["Bottom right", "bottomBand", "right"],
  ];
  for (const [name, band, side] of cases) {
    await configure(page, { position: name });
    const all = await boxes(page);
    expect(all.length, name).toBeGreaterThanOrEqual(3);
    for (const b of all) {
      expect(b[band], `${name} band`).toBe(true);
      if (side === "left") expect(Math.abs(b.leftGap), name).toBeLessThanOrEqual(1);
      if (side === "right") expect(Math.abs(b.rightGap), name).toBeLessThanOrEqual(1);
      if (side === "centre") expect(Math.abs(b.centreGap), name).toBeLessThanOrEqual(1);
    }
  }
});

test("(c) Different first page: nothing on page one, Siegel 2 on page two", async ({ page }) => {
  await threePages(page, "Header c");
  await configure(page, { numbers: true, text: "Siegel", position: "Top right", first: true });
  const got = await labels(page);
  expect(got.some((l) => l.page === 0)).toBe(false);
  expect(got.find((l) => l.page === 1)?.text).toBe("Siegel 2");
});

test("(d) numbers off, text on: the text alone on every page", async ({ page }) => {
  await threePages(page, "Header d");
  await configure(page, { numbers: false, text: "Siegel", position: "Top right" });
  const got = await labels(page);
  expect(got.length).toBe(await page.locator(".page-sheet").count());
  got.forEach((l) => expect(l.text).toBe("Siegel"));
});

test("(e) continuous view shows no labels", async ({ page }) => {
  await threePages(page, "Header e");
  await configure(page, { numbers: true, text: "Siegel", position: "Top right" });
  expect((await labels(page)).length).toBeGreaterThan(0);
  await togglePageView(page);
  await settle(page);
  await expect(page.locator(".page-label")).toHaveCount(0);
});

test("(f) a click on a label keeps editor focus and the label moves no text", async ({ page }) => {
  await threePages(page, "Header f");
  const editor = editorOf(page);
  const firstTop = () =>
    editor.evaluate((el) => el.querySelector("p")!.getBoundingClientRect().top);
  const before = await firstTop();
  await configure(page, { numbers: true, text: "Siegel", position: "Top right" });
  expect(await firstTop()).toBe(before);
  const box = (await page.locator(".page-label").first().boundingBox())!;
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;
  // The label takes no clicks: the hit test at its centre finds something else.
  expect(
    await page.evaluate(([x, y]) => !!document.elementFromPoint(x, y)?.closest(".page-label"), [cx, cy]),
  ).toBe(false);
  const focusAfterClick = async (x: number) => {
    await select(editor, 5);
    await page.mouse.click(x, cy);
    return editor.evaluate((el) => document.activeElement === el);
  };
  const onLabel = await focusAfterClick(cx);
  // Same click with the label hidden: identical outcome, so the label changes nothing.
  await page.addStyleTag({ content: ".page-label { display: none !important; }" });
  const without = await focusAfterClick(cx);
  expect(onLabel).toBe(without);
  expect(await firstTop()).toBe(before);
});

test("(g) text and checkbox survive a reload", async ({ page }) => {
  await threePages(page, "Header g");
  await configure(page, { numbers: true, text: "Siegel", position: "Top right", first: true });
  await expect(page.locator(".save-status")).toHaveText(/Saved/);
  await page.reload();
  await expect(editorOf(page)).toBeVisible();
  const dialog = await openSetup(page);
  await expect(dialog.getByRole("textbox", { name: "Page header text" })).toHaveValue("Siegel");
  await expect(dialog.getByRole("checkbox", { name: "Different first page" })).toBeChecked();
});

test("(h) Chicago: page one blank, page two reads 1", async ({ page }) => {
  await create(page, "Header h");
  await page.evaluate(() => {
    const key = Object.keys(localStorage).find((k) => k.startsWith("folio.preview.project."))!;
    const p = JSON.parse(localStorage.getItem(key)!);
    p.templateId = "chicago";
    localStorage.setItem(key, JSON.stringify(p));
  });
  await seedBlocks(page, dense(30));
  await togglePageView(page);
  await expect.poll(() => page.locator(".page-sheet").count()).toBeGreaterThanOrEqual(2);
  await settle(page);
  const got = await labels(page);
  expect(got.some((l) => l.page === 0)).toBe(false);
  expect(got.find((l) => l.page === 1)?.text).toBe("1");
});
