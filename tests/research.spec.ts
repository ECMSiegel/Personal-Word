import { test, expect, type Page } from "@playwright/test";

const crossrefWork = {
  status: "ok",
  message: {
    type: "journal-article",
    DOI: "10.1234/example",
    title: ["Narrative Structure in Practice"],
    "container-title": ["Journal of Examples"],
    author: [
      { given: "Jane", family: "Smith" },
      { given: "Omar", family: "Reyes" },
    ],
    volume: "12",
    issue: "3",
    page: "45-67",
    issued: { "date-parts": [[2024, 5, 2]] },
  },
};

async function create(page: Page, title: string, template = "Blank") {
  await page.getByRole("button", { name: "Start new project" }).click();
  await page.getByRole("button", { name: template, exact: true }).click();
  await page.getByLabel("Project title").fill(title);
  await page.getByRole("button", { name: "Save", exact: true }).click();
}

async function openResearch(page: Page) {
  await page
    .locator(".group-title")
    .filter({ hasText: /^Research$/ })
    .click();
  await expect(page.locator(".research-panel")).toBeVisible();
}

test("research panel has Sources and Notes tabs in the app font", async ({
  page,
}) => {
  await page.goto("/");
  await create(page, "Research tabs");
  await openResearch(page);
  await expect(page.locator(".research-tabs button")).toHaveText([
    "Sources",
    "Notes",
  ]);
  await expect(page.locator(".research-panel select")).toHaveCount(0);
  const family = await page
    .locator(".research-panel")
    .evaluate((el) => getComputedStyle(el).fontFamily);
  expect(family).toMatch(/^(Futura|"Avenir Next")/);
  await page.getByRole("button", { name: "Notes", exact: true }).click();
  await expect(
    page.getByText(
      "Ideas and reminders. Quotes from a source live under that source.",
    ),
  ).toBeVisible();
});

test("manual source shows a Chicago bibliography preview and lookup fills a new source", async ({
  page,
}) => {
  await page.route("https://api.crossref.org/works/**", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      headers: { "access-control-allow-origin": "*" },
      body: JSON.stringify(crossrefWork),
    }),
  );
  await page.goto("/");
  await create(page, "Research sources");
  await openResearch(page);
  await page.getByRole("button", { name: "Enter manually" }).click();
  await page.getByLabel("Title", { exact: true }).fill("Interior Chinatown");
  await page.getByLabel("Authors", { exact: true }).fill("Charles Yu");
  await page.getByLabel("Publisher", { exact: true }).fill("Pantheon Books");
  await page.getByLabel("Year", { exact: true }).fill("2020");
  await expect(
    page.locator(".citation-preview", { hasText: "Yu, Charles" }),
  ).toHaveText("Yu, Charles. Interior Chinatown. Pantheon Books, 2020.");

  await page
    .getByRole("textbox", { name: "DOI, ISBN, or web address" })
    .fill("10.1234/example");
  await page.getByRole("button", { name: "Look up", exact: true }).click();
  await expect(page.locator(".research-status")).toHaveText(
    "Found on Crossref -- review the details",
  );
  await expect(page.getByLabel("Title", { exact: true })).toHaveValue(
    "Narrative Structure in Practice",
  );
  await expect(page.getByLabel("Authors", { exact: true })).toHaveValue(
    "Jane Smith\nOmar Reyes",
  );
  await expect(page.getByLabel("Journal", { exact: true })).toHaveValue(
    "Journal of Examples",
  );
  await expect(
    page.getByRole("button", { name: "Source type", exact: true }),
  ).toHaveText("Journal article");
});

test("a cited footnote appears under its source and in the manuscript", async ({
  page,
}) => {
  await page.goto("/");
  await create(page, "Research footnotes");
  const editor = page.getByRole("textbox", { name: "Writing editor" });
  await editor.fill("Evidence here.");
  await openResearch(page);
  await page.getByRole("button", { name: "Enter manually" }).click();
  await page.getByLabel("Title", { exact: true }).fill("Interior Chinatown");
  await page.getByLabel("Authors", { exact: true }).fill("Charles Yu");
  await page.getByLabel("Year", { exact: true }).fill("2020");
  await page.getByRole("button", { name: "Cite here", exact: true }).click();
  await expect(editor.locator("[data-footnote-id]")).toHaveText("1");
  await page
    .getByLabel("Footnote text", { exact: true })
    .fill("A supporting note.");
  await expect(
    page.locator(".footnote-item .citation-preview").first(),
  ).toContainText("Charles Yu, Interior Chinatown");
});

test("text-only footnotes keep the insert-at-cursor flow", async ({ page }) => {
  await page.goto("/");
  await create(page, "Text-only footnotes");
  const editor = page.getByRole("textbox", { name: "Writing editor" });
  await editor.fill("Evidence here.");
  await openResearch(page);
  await page.getByRole("button", { name: "Insert footnote at cursor" }).click();
  await page
    .getByLabel("Footnote text", { exact: true })
    .fill("A supporting note.");
  await expect(editor.locator("[data-footnote-id]")).toHaveText("1");
});
