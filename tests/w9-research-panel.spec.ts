import { test, expect, type Page } from "@playwright/test";

async function create(page: Page, title: string) {
  await page.getByRole("button", { name: "Start new project" }).click();
  await page.getByRole("button", { name: "Blank", exact: true }).click();
  await page.getByLabel("Project title").fill(title);
  await page.getByRole("button", { name: "Save", exact: true }).click();
}

async function openResearch(page: Page) {
  await page.locator(".group-title").filter({ hasText: /^Research$/ }).click();
  await expect(page.locator(".research-panel")).toBeVisible();
}

test("an open source reads Source, Citation, More details, Used in", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");
  await create(page, "W9 research zones");
  const editor = page.getByRole("textbox", { name: "Writing editor" });
  await editor.fill("Evidence here.");
  await openResearch(page);
  await page.evaluate(() => {
    const aside = document.querySelector<HTMLElement>(".research-aside")!;
    aside.style.width = "420px";
    aside.style.flexBasis = "420px";
  });

  // (g) the lookup line, visible with no source open.
  await expect(page.getByText("needs an internet connection")).toBeVisible();

  await page.getByRole("button", { name: "Enter manually" }).click();
  await page.getByRole("button", { name: "Source type", exact: true }).click();
  await page.getByRole("option", { name: "Journal article", exact: true }).click();
  await page.getByLabel("Authors", { exact: true }).fill("Ada One\nBea Two\nCy Three\nDi Four");
  await page.getByLabel("Title", { exact: true }).fill("A Study of Zones");
  await page.getByLabel("Journal", { exact: true }).fill("Journal of Layout");
  await page.getByLabel("Year", { exact: true }).fill("2024");
  await page.getByRole("button", { name: "Cite here", exact: true }).click();
  await expect(editor.locator("[data-footnote-id]")).toHaveText("1");

  const panel = page.locator(".research-panel");
  // (a) three headings, in order.
  const heads = await panel.locator("h4.research-subhead").allTextContents();
  const picked = heads.filter((t) => ["Source", "Citation", "Used in"].includes(t));
  expect(picked).toEqual(["Source", "Citation", "Used in"]);
  for (const name of ["Source", "Citation", "Used in"]) {
    await expect(panel.getByRole("heading", { name, exact: true })).toHaveCount(1);
  }

  // (b) Cite here is close to the top of the open source.
  const titleTop = (await page.locator(".source-title").first().boundingBox())!.y;
  const citeTop = (await page.getByRole("button", { name: "Cite here", exact: true }).boundingBox())!.y;
  expect(citeTop - titleTop).toBeLessThan(700);

  // (c) More details is collapsed and holds the rest.
  const more = panel.locator("details.source-more");
  await expect(more.locator("summary")).toHaveText("More details");
  await expect(more).not.toHaveAttribute("open", "");
  for (const label of ["Short title", "Edition", "DOI", "URL", "Manual full note", "Manual short note", "Manual bibliography entry"]) {
    await expect(more.getByLabel(label, { exact: true })).toBeHidden();
  }
  await expect(more.locator(".source-pdf-field")).toBeHidden();
  await more.locator("summary").click();
  for (const label of ["Short title", "Edition", "DOI", "URL", "Manual full note", "Manual short note", "Manual bibliography entry"]) {
    await expect(more.getByLabel(label, { exact: true })).toBeVisible();
  }
  await expect(more.locator(".source-pdf-field")).toBeVisible();

  // (d) the override sentence appears once.
  await expect(page.getByText("When supplied, this exact text overrides automatic formatting.")).toHaveCount(1);

  // (e) Authors label sits above its first input.
  const geo = await page.evaluate(() => {
    const label = document.querySelector<HTMLElement>('.research-panel label[for$="-authors"]')!.getBoundingClientRect();
    const input = document.querySelector<HTMLElement>('.research-panel [id$="-authors"]')!.getBoundingClientRect();
    return { labelBottom: label.bottom, inputTop: input.top };
  });
  expect(geo.labelBottom).toBeLessThanOrEqual(geo.inputTop);

  // (f) the repeat-citation boxes live in a collapsed Citation rules row below the list.
  const rules = panel.locator("details.citation-rules");
  await expect(rules.locator("summary")).toHaveText("Citation rules");
  await expect(rules).not.toHaveAttribute("open", "");
  await expect(page.getByLabel("Use repeat citation rules", { exact: true })).toBeHidden();
  const listBottom = (await panel.locator(".source-list").boundingBox())!.y + (await panel.locator(".source-list").boundingBox())!.height;
  expect((await rules.boundingBox())!.y).toBeGreaterThanOrEqual(listBottom - 1);
  await rules.locator("summary").click();
  await expect(page.getByLabel("Use repeat citation rules", { exact: true })).toBeVisible();

  // Used in: count line, the footnote's section, and Go to (G1 supplies the locations).
  await expect(panel.locator(".used-in")).toContainText("1 footnote, 0 quotes");
  await expect(panel.locator(".footnote-where")).toHaveCount(1);
  await expect(panel.locator(".footnote-where")).toContainText(/^in \S/);
  await expect(panel.getByRole("button", { name: "Go to", exact: true })).toHaveCount(1);

  // The required-details sentence is gone when core fields are present, back when one is missing.
  await expect(panel.getByText("Review required details")).toHaveCount(0);
  await page.getByLabel("Title", { exact: true }).fill("");
  await expect(panel.getByText("Review required details: title.")).toBeVisible();
});
