import { test, expect, type Page } from "@playwright/test";

async function createProject(page: Page) {
  await page.goto("/");
  await page.getByRole("button", { name: "Start new project" }).click();
  await page.getByRole("button", { name: "Blank", exact: true }).click();
  await page.getByLabel("Project title").fill("Research collapse fixture");
  await page.getByRole("button", { name: "Save", exact: true }).click();
}

async function openResearch(page: Page) {
  await page.locator(".group-title").filter({ hasText: /^Research$/ }).click();
  await expect(page.locator(".research-panel")).toBeVisible();
}

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.addInitScript(() => {
    localStorage.setItem("personal-word.restoreTabs", "true");
  });
});

test("research previews and Used in collapse, persist, and remain keyboard accessible", async ({ page }) => {
  await createProject(page);
  await openResearch(page);
  await page.getByRole("button", { name: "Enter manually" }).click();
  await page.getByLabel("Authors", { exact: true }).fill("Ada Example");
  await page.getByLabel("Title", { exact: true }).fill("A Testable Source");

  const source = page.locator(".source-item").filter({ hasText: "A Testable Source" });
  const sourceDisclosure = source.locator(".source-toggle.row");
  await expect(sourceDisclosure).toHaveAttribute("aria-expanded", "true");

  for (const label of ["Note", "Shortened note", "Bibliography"]) {
    const toggle = source.getByRole("button", { name: label, exact: true });
    const preview = source.locator(".preview").filter({ has: toggle });
    await expect(toggle).toHaveAttribute("aria-expanded", "true");
    await toggle.click();
    await expect(toggle).toHaveAttribute("aria-expanded", "false");
    await expect(preview.locator(".citation-preview")).toHaveCount(0);
    await toggle.focus();
    await page.keyboard.press("Space");
    await expect(toggle).toHaveAttribute("aria-expanded", "true");
  }

  // Layout: each toggle's label starts at the citation text's left edge, chevron after the label.
  for (const label of ["Note", "Shortened note", "Bibliography"]) {
    const toggle = source.getByRole("button", { name: label, exact: true });
    const preview = source.locator(".preview").filter({ has: page.getByRole("button", { name: label, exact: true }) });
    const textLeft = (await preview.locator(".citation-preview").boundingBox())!.x;
    const labelBox = (await toggle.locator("span").boundingBox())!;
    const chevron = (await toggle.locator("svg").boundingBox())!;
    expect(Math.abs(labelBox.x - textLeft)).toBeLessThanOrEqual(1);
    expect(chevron.x).toBeGreaterThan(labelBox.x + labelBox.width - 1);
  }
  {
    const usedInBox = source.getByRole("region", { name: "Used in" });
    const toggle = usedInBox.getByRole("button", { name: "Used in", exact: true });
    const labelBox = (await toggle.locator("span").boundingBox())!;
    const chevron = (await toggle.locator("svg").boundingBox())!;
    const citation = source.getByRole("heading", { name: "Citation", exact: true });
    expect(Math.abs(labelBox.x - (await citation.boundingBox())!.x)).toBeLessThanOrEqual(1);
    expect(chevron.x).toBeGreaterThan(labelBox.x + labelBox.width - 1);
    const look = (el: typeof toggle) => el.evaluate((n) => {
      const cs = getComputedStyle(n);
      return { color: cs.color, size: cs.fontSize };
    });
    expect(await look(toggle)).toEqual(await look(citation));
  }

  const usedIn = source.getByRole("region", { name: "Used in" });
  const usedInToggle = usedIn.getByRole("button", { name: "Used in", exact: true });
  await usedInToggle.click();
  await expect(usedInToggle).toHaveAttribute("aria-expanded", "false");
  await expect(usedIn.locator(".research-hint, .linked")).toHaveCount(0);
  await usedInToggle.focus();
  await page.keyboard.press("Enter");
  await expect(usedInToggle).toHaveAttribute("aria-expanded", "true");

  await source.getByRole("button", { name: "Note", exact: true }).click();
  await usedInToggle.click();
  await sourceDisclosure.click();
  await expect(sourceDisclosure).toHaveAttribute("aria-expanded", "false");
  await sourceDisclosure.click();
  await expect(sourceDisclosure).toHaveAttribute("aria-expanded", "true");
  await expect(source.getByRole("button", { name: "Note", exact: true })).toHaveAttribute("aria-expanded", "false");
  await expect(source.getByRole("button", { name: "Used in", exact: true })).toHaveAttribute("aria-expanded", "false");

  await page.reload();
  await openResearch(page);
  const restoredSource = page.locator(".source-item").filter({ hasText: "A Testable Source" });
  await restoredSource.locator(".source-toggle.row").click();
  await expect(restoredSource.getByRole("button", { name: "Note", exact: true })).toHaveAttribute("aria-expanded", "false");
  await expect(restoredSource.getByRole("button", { name: "Used in", exact: true })).toHaveAttribute("aria-expanded", "false");
});
