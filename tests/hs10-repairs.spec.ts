import { test, expect } from "@playwright/test";

test.use({ viewport: { width: 1280, height: 800 } });

// HS10: on a project with no saved document settings, changing Page setup page
// numbers must not change the editor's font, size or line spacing.
test("Page setup page numbers on a project without document settings keep the editor look", async ({
  page,
}) => {
  await page.addInitScript(() =>
    localStorage.setItem("personal-word.restoreTabs", "true"),
  );
  await page.goto("/");
  await page.getByRole("button", { name: "Start new project" }).click();
  await page.getByRole("button", { name: "Blank", exact: true }).click();
  await page.getByLabel("Project title").fill("HS10 old project");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  const bar = page.getByRole("toolbar", { name: "Formatting" });
  await expect(bar).toBeVisible();
  await page.evaluate(() => {
    const key = Object.keys(localStorage).find((k) =>
      k.startsWith("folio.preview.project."),
    )!;
    const p = JSON.parse(localStorage.getItem(key)!);
    delete p.documentSettings;
    localStorage.setItem(key, JSON.stringify(p));
    localStorage.setItem("folio.lastProject", p.id);
  });
  await page.reload();
  await expect(bar).toBeVisible();

  const look = () =>
    page.evaluate(() => {
      const el = document.querySelector<HTMLElement>(".ProseMirror")!;
      el.focus();
      const para = el.querySelector("p") ?? el;
      const cs = getComputedStyle(para);
      const root = getComputedStyle(el);
      return {
        font: root.fontFamily,
        size: root.fontSize,
        line: cs.lineHeight,
        indent: cs.textIndent,
      };
    });
  const before = await look();
  const exportLook = async () => {
    await page.locator(".export-menu-button").click();
    await page.getByRole("menuitem", { name: "Export settings..." }).click();
    const panel = page.locator(".settings-section", { hasText: "Export typeface" });
    const out = {
      typeface: await panel.getByRole("button", { name: "Export typeface" }).innerText(),
      inputs: await panel.locator("input[type=number]").evaluateAll((els) =>
        els.map((e) => (e as HTMLInputElement).value),
      ),
    };
    return out;
  };
  const exportBefore = await exportLook();
  await page.reload();
  await expect(bar).toBeVisible();
  const stored = () =>
    page.evaluate(() => {
      const key = Object.keys(localStorage).find((k) =>
        k.startsWith("folio.preview.project."),
      )!;
      return JSON.parse(localStorage.getItem(key)!).documentSettings;
    });
  expect(await stored()).toBeUndefined();

  const direct = bar.getByRole("button", { name: "Page setup", exact: true });
  if (await direct.isVisible().catch(() => false)) await direct.click();
  else {
    await bar.getByRole("button", { name: "More formatting", exact: true }).click();
    await page.getByRole("button", { name: "Page setup", exact: true }).last().click();
  }
  const dialog = page.getByRole("dialog", { name: "Page setup" });
  await expect(dialog).toBeVisible();
  await dialog.getByRole("checkbox", { name: "Page numbers" }).uncheck();
  await dialog.getByRole("checkbox", { name: "Page numbers" }).check();
  await page.keyboard.press("Escape");

  expect(await look()).toEqual(before);
  await expect.poll(stored).toEqual({ pageNumbers: true });
  expect(await exportLook()).toEqual(exportBefore);
});

test("Export typeface option says what sans really is", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Start new project" }).click();
  await page.getByRole("button", { name: "Blank", exact: true }).click();
  await page.getByLabel("Project title").fill("HS10 label");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByRole("toolbar", { name: "Formatting" })).toBeVisible();
  await page.locator(".export-menu-button").click();
  await page.getByRole("menuitem", { name: "Export settings..." }).click();
  await page.getByRole("button", { name: "Export typeface" }).click();
  await expect(
    page.getByRole("option", { name: "Sans (Arial in Word, Noto Sans in PDF)" }),
  ).toBeVisible();
});

test("Font box shows System, not -apple-system, when the interface font is System", async ({ page }) => {
  await page.addInitScript(() =>
    localStorage.setItem(
      "folio.workspace.interfaceFont",
      "-apple-system, BlinkMacSystemFont, sans-serif",
    ),
  );
  await page.goto("/");
  await page.getByRole("button", { name: "Start new project" }).click();
  await page.getByRole("button", { name: "Blank", exact: true }).click();
  await page.getByLabel("Project title").fill("HS10 font box");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  const bar = page.getByRole("toolbar", { name: "Formatting" });
  await expect(bar).toBeVisible();
  const box = bar.getByRole("button", { name: "Font family" });
  await expect(box).toBeVisible();
  await expect(box).not.toContainText("-apple-system");
  await expect(box).toContainText("System");
});
