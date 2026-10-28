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

test("second citation of a source shows a shortened note", async ({ page }) => {
  await page.goto("/");
  await create(page, "Automatic short notes");
  const editor = page.getByRole("textbox", { name: "Writing editor" });
  await editor.fill("First passage. Second passage.");
  await openResearch(page);
  await page.getByRole("button", { name: "Enter manually" }).click();
  await page.getByLabel("Authors", { exact: true }).fill("Marguerite Halloway");
  await page.getByLabel("Title", { exact: true }).fill("Lamps and Ledgers: Keeping the Coastal Lights");
  await page.getByLabel("Publisher", { exact: true }).fill("Harbor Street Press");
  await page.getByLabel("Year", { exact: true }).fill("2019");
  const cite = page.getByRole("button", { name: "Cite here", exact: true });
  await cite.click();
  await editor.click();
  await page.keyboard.press("Home");
  await cite.click();
  await page.getByRole("button", { name: "Close research" }).click();
  const notes = page.locator(".footnote-area");
  await expect(notes).toContainText("Halloway, Lamps and Ledgers.");
  await expect(notes).toContainText("(Harbor Street Press, 2019)");
  await expect(notes.getByText("(Harbor Street Press, 2019)")).toHaveCount(1);
});

test("imports sources from a Zotero CSL JSON file", async ({ page }) => {
  await page.goto("/");
  await create(page, "Zotero import");
  await openResearch(page);
  const importButton = page.getByRole("button", { name: "Import from Zotero…" });
  await expect(importButton).toBeVisible({ timeout: 5000 });
  await importButton.click();
  await page.locator('input[type="file"]').setInputFiles("tests/fixtures/zotero-sample.json");
  await expect(page.getByText("3 sources to add")).toBeVisible();
  await expect(page.getByLabel("Add Unsupported thesis", { exact: true })).toBeChecked();
  await page.getByRole("button", { name: "Add sources" }).click();
  await expect(page.locator(".source-list")).toContainText("A Lantern for the Coast");
  await expect(page.locator(".source-list")).toContainText("Keeping the Harbor Lights");
});

test("captured quote inserts with its citation and one undo removes both", async ({ page }) => {
  await page.goto("/");
  await create(page, "Quote capture");
  const editor = page.getByRole("textbox", { name: "Writing editor" });
  await editor.fill("Evidence here.");
  await openResearch(page);
  await page.getByRole("button", { name: "Enter manually" }).click();
  await page.getByLabel("Authors", { exact: true }).fill("Marguerite Halloway");
  await page.getByLabel("Title", { exact: true }).fill("Lamps and Ledgers");
  const capture = page.getByRole("button", { name: "Capture quote" });
  await expect(capture).toBeVisible({ timeout: 5000 });
  await capture.click();
  await page.getByRole("button", { name: "Source", exact: true }).click();
  await page.getByRole("option", { name: /Marguerite Halloway -- Lamps and Ledgers/ }).click();
  await page.getByLabel("Quotation").fill("A captured passage");
  await page.getByLabel("Page").fill("48");
  await page.getByRole("button", { name: "Save and insert" }).click();
  await expect(editor).toContainText("“A captured passage”");
  await expect(page.locator(".footnote-area")).toContainText(", 48.");
  await editor.focus();
  await page.keyboard.press(process.platform === "darwin" ? "Meta+z" : "Control+z");
  await expect(editor).not.toContainText("A captured passage");
  await expect(editor.locator("[data-footnote-id]")).toHaveCount(0);
  await page.getByRole("button", { name: "Close research" }).click();
  await page.locator(".group-title").filter({ hasText: /^Settings$/ }).click();
  const previewPdf = page.getByRole("button", { name: "Preview PDF", exact: true });
  await previewPdf.click();
  await expect(previewPdf).toBeEnabled({ timeout: 30_000 });
  await expect(page.getByTitle("PDF export preview")).toBeVisible();
});

test("opt-in Ibid. rules reach the page notes and research preview, persist, and turn off cleanly", async ({ page }) => {
  await page.goto("/");
  await create(page, "Ibid rules");
  const editor = page.getByRole("textbox", { name: "Writing editor" });
  await editor.fill("First passage. Second passage.");
  await openResearch(page);
  await page.getByRole("button", { name: "Enter manually" }).click();
  await page.getByLabel("Authors", { exact: true }).fill("Marguerite Halloway");
  await page.getByLabel("Title", { exact: true }).fill("Lamps and Ledgers");
  await page.getByLabel("Publisher", { exact: true }).fill("Harbor Street Press");
  await page.getByLabel("Year", { exact: true }).fill("2019");
  const cite = page.getByRole("button", { name: "Cite here", exact: true });
  await cite.click();
  await editor.click();
  await page.keyboard.press("Home");
  await cite.click();
  const notes = page.locator(".footnote-area");
  // Old projects and new ones without rules keep the legacy short note.
  await expect(notes).toContainText("Halloway, Lamps and Ledgers.");
  await expect(notes).not.toContainText("Ibid.");
  await page.getByLabel("Use repeat citation rules", { exact: true }).check();
  await page.getByRole("button", { name: "Back-to-back repeat", exact: true }).click();
  await page.getByRole("option", { name: "Ibid.", exact: true }).click();
  await expect(notes).toContainText("Ibid.");
  await expect(notes).not.toContainText("Halloway, Lamps and Ledgers.");
  await expect(page.locator(".footnote-item .citation-preview")).toContainText(["Ibid."]);
  await page.locator(".research-panel").screenshot({ path: "node_modules/.cache/personal-word-beta/c2-rules-light.png" });
  await page.emulateMedia({ colorScheme: "dark" });
  await page.locator(".research-panel").screenshot({ path: "node_modules/.cache/personal-word-beta/c2-rules-dark.png" });
  await page.emulateMedia({ colorScheme: "light" });
  await expect(page.getByRole("button", { name: "Note form" }).filter({ hasText: "Automatic (Ibid.)" })).toHaveCount(1);
  await expect(page.locator(".save-status")).toHaveText("Saved");
  const stored = async () => JSON.parse(await page.evaluate(() => {
    const key = Object.keys(localStorage).find((key) => key.startsWith("folio.preview.project."))!;
    return localStorage.getItem(key)!;
  })).research;
  expect((await stored()).citationPolicy).toEqual({ scope: "manuscript", repeats: "ibid" });
  await page.reload();
  await page.locator(".project-row").filter({ has: page.getByText("Ibid rules", { exact: true }) }).locator("button").first().click();
  await expect(page.locator(".footnote-area")).toContainText("Ibid.");
  await openResearch(page);
  await page.getByLabel("Use repeat citation rules", { exact: true }).uncheck();
  await expect(page.locator(".footnote-area")).toContainText("Halloway, Lamps and Ledgers.");
  await expect(page.locator(".footnote-area")).not.toContainText("Ibid.");
  await expect(page.locator(".save-status")).toHaveText("Saved");
  expect("citationPolicy" in (await stored())).toBe(false);
});

test("citation rules agree across page notes, preview and reader through section scope, reorder and reload", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("personal-word.restoreTabs", "true"));
  await page.goto("/");
  await create(page, "Citation rule renderers");
  await expect(page.locator(".save-status")).toHaveText("Saved");
  await page.evaluate(() => {
    const key = Object.keys(localStorage).find((key) => key.startsWith("folio.preview.project."))!;
    const p = JSON.parse(localStorage.getItem(key)!);
    const section = (title: string, passages: [string, string][]) => ({
      ...p.entries[0], id: crypto.randomUUID(), title,
      content: { type: "doc", content: passages.map(([text, id]) => ({ type: "paragraph", content: [{ type: "text", text }, { type: "footnoteReference", attrs: { id } }] })) },
      text: passages.map(([text]) => text).join("\n"),
    });
    p.entries = [section("Opening", [["First passage.", "n1"], ["Second passage.", "n2"]]), section("Ending", [["Third passage.", "n3"]])];
    p.order = p.entries.map((e: { id: string }) => e.id);
    p.research = {
      sources: [{ id: "lamps", kind: "book", title: "Lamps and Ledgers", authors: ["Marguerite Halloway"], publisher: "Harbor Street Press", year: "2019" }],
      notes: [],
      footnotes: [["n1", "4"], ["n2", "9"], ["n3", "9"]].map(([id, locator]) => ({ id, text: "", sourceId: "lamps", locator })),
      autoShortNotes: true,
    };
    localStorage.setItem(key, JSON.stringify(p));
    localStorage.setItem("folio.lastProject", p.id);
  });
  await page.reload();
  const full4 = "Marguerite Halloway, Lamps and Ledgers (Harbor Street Press, 2019), 4.";
  const full9 = "Marguerite Halloway, Lamps and Ledgers (Harbor Street Press, 2019), 9.";
  const reader = async (expected: string[]) => {
    await page.getByRole("button", { name: "Read manuscript", exact: true }).click();
    await expect(page.locator(".reader-footnotes p")).toHaveText(expected);
    await page.locator(".entry-main").filter({ hasText: "Opening" }).click();
  };
  const notes = page.locator(".footnote-area");
  await expect(notes).toContainText("Halloway, Lamps and Ledgers, 9.");
  await reader([`1 ${full4}`, "2 Halloway, Lamps and Ledgers, 9.", "3 Halloway, Lamps and Ledgers, 9."]);

  await openResearch(page);
  await page.locator(".source-toggle").click();
  await page.getByLabel("Use repeat citation rules", { exact: true }).check();
  await page.getByRole("button", { name: "Back-to-back repeat", exact: true }).click();
  await page.getByRole("option", { name: "Ibid.", exact: true }).click();
  await expect(page.locator(".footnote-item .citation-preview")).toHaveText([full4, "Ibid., 9.", "Ibid."]);
  await page.getByRole("button", { name: "Close research" }).click();
  await expect(notes).toContainText("Ibid., 9.");
  await reader([`1 ${full4}`, "2 Ibid., 9.", "3 Ibid."]);

  await openResearch(page);
  if (await page.locator(".footnote-item").count() === 0) await page.locator(".source-toggle").click();
  await page.getByRole("button", { name: "Full citation again", exact: true }).click();
  await page.getByRole("option", { name: "In each section (one manuscript entry)", exact: true }).click();
  await expect(page.locator(".footnote-item .citation-preview")).toHaveText([full4, "Ibid., 9.", full9]);
  await page.getByRole("button", { name: "Close research" }).click();
  await reader([`1 ${full4}`, "2 Ibid., 9.", `3 ${full9}`]);

  await page.locator(".entry-row").nth(1).dragTo(page.locator(".entry-row").nth(0));
  await expect(page.locator(".entry-main").first()).toContainText("Ending");
  const reordered = [`1 ${full9}`, `2 ${full4}`, "3 Ibid., 9."];
  await reader(reordered);
  await expect(page.locator(".save-status")).toHaveText("Saved");
  await page.reload();
  await reader(reordered);
});

test("helper captions are gone; hints live in placeholder and a keyboard-reachable tooltip", async ({
  page,
}) => {
  const privacy =
    "Look up sends only this identifier to Crossref, Open Library, or the website.";
  await page.goto("/");
  await create(page, "No captions");
  const editor = page.getByRole("textbox", { name: "Writing editor" });
  await editor.fill("Evidence here.");
  await openResearch(page);

  // Empty footnote: no "Write a note or choose a source." caption.
  await page.getByRole("button", { name: "Insert footnote at cursor" }).click();
  await expect(page.getByLabel("Footnote text", { exact: true })).toBeVisible();
  await expect(page.getByText("Write a note or choose a source.")).toHaveCount(0);

  // Zotero export hint is not visible text.
  await expect(page.getByText("In Zotero, export CSL JSON or BibTeX")).toHaveCount(0);
  await expect(page.locator(".research-privacy")).toHaveCount(0);

  // Authors hint is a placeholder only.
  await page.getByRole("button", { name: "Enter manually" }).click();
  await expect(page.getByLabel("Authors", { exact: true })).toHaveAttribute(
    "placeholder",
    "One name per line, first name first",
  );
  await expect(page.getByText("One name per line, first name first")).toHaveCount(0);

  // Privacy line: keyboard-reachable tooltip on Look up.
  const input = page.getByRole("textbox", { name: "DOI, ISBN, or web address" });
  await input.fill("10.1000/xyz");
  await page.keyboard.press("Tab");
  const lookup = page.getByRole("button", { name: "Look up", exact: true });
  await expect(lookup).toBeFocused();
  await expect(lookup).toHaveAttribute("title", privacy);
  const tip = page.getByRole("tooltip", { name: privacy });
  await expect(tip).toBeVisible();
  await expect(tip).toHaveText(privacy);
  const tipId = await tip.getAttribute("id");
  expect(tipId).toBeTruthy();
  await expect(lookup).toHaveAttribute("aria-describedby", tipId!);
});

test("Research sidebar lists Bibliography and sources; the Bibliography page orders, persists, matches Markdown and opens sources", async ({
  page,
}) => {
  await page.goto("/");
  await create(page, "Bibliography page");
  const editor = page.getByRole("textbox", { name: "Writing editor" });
  await editor.fill("Evidence here.");
  await openResearch(page);
  await page.getByRole("button", { name: "Enter manually" }).click();
  await page.getByLabel("Title", { exact: true }).fill("Interior Chinatown");
  await page.getByLabel("Authors", { exact: true }).fill("Charles Yu");
  await page.getByLabel("Year", { exact: true }).fill("2020");
  await page.getByRole("button", { name: "Cite here", exact: true }).click();
  await expect(editor.locator("[data-footnote-id]")).toHaveText("1");
  await page.getByRole("button", { name: "Enter manually" }).click();
  await page.getByLabel("Title", { exact: true }).fill("Atlas of Tides");
  await page.getByLabel("Authors", { exact: true }).fill("Ana Brook");
  await page.getByLabel("Year", { exact: true }).fill("2019");
  await page.getByRole("button", { name: "Source type", exact: true }).click();
  await page.getByRole("option", { name: "Journal article", exact: true }).click();
  await page.getByRole("button", { name: "Close research", exact: true }).click();

  const research = page.locator('.sidebar [data-group="research"] .entry-main');
  await expect(research).toHaveText([
    "Bibliography",
    "Yu -- Interior Chinatown (2020)",
    "Brook -- Atlas of Tides (2019)",
  ]);
  await research.filter({ hasText: /^Bibliography$/ }).click();
  const bibliographyPage = page.locator(".bibliography-page");
  await expect(bibliographyPage.getByRole("heading", { name: "Bibliography", level: 1 })).toBeVisible();
  await expect(page.locator(".breadcrumb")).toContainText("Bibliography");
  const entries = bibliographyPage.locator(".bibliography-entries p");
  await expect(entries).toHaveCount(1);
  await expect(entries.first()).toContainText("Interior Chinatown");

  await bibliographyPage.getByLabel("Include uncited sources").check();
  await expect(entries).toHaveCount(2);
  await expect(entries.nth(0)).toContainText("Atlas of Tides");
  await expect(entries.nth(1)).toContainText("Interior Chinatown");
  await bibliographyPage.getByRole("button", { name: "Bibliography order" }).click();
  await page.getByRole("option", { name: "By source type" }).click();
  await expect(bibliographyPage.locator(".bibliography-entries h2")).toHaveText(["Books", "Journal articles"]);
  const pageLines = await bibliographyPage
    .locator(".bibliography-entries > *")
    .evaluateAll((nodes) => nodes.map((node) => (node.tagName === "H2" ? "### " : "- ") + node.textContent));

  await expect(page.locator(".save-status")).toHaveText("Saved", { timeout: 10_000 });
  await page.reload();
  await page.locator(".project-row").filter({ hasText: "Bibliography page" }).locator("button").first().click();
  await page.locator('.sidebar [data-group="research"] .entry-main').filter({ hasText: /^Bibliography$/ }).click();
  await expect(bibliographyPage.getByLabel("Include uncited sources")).toBeChecked();
  await expect(bibliographyPage.getByRole("button", { name: "Bibliography order" })).toHaveText(/By source type/);
  await expect(bibliographyPage.locator(".bibliography-entries h2")).toHaveText(["Books", "Journal articles"]);

  await page.getByRole("button", { name: "Read manuscript", exact: true }).click();
  await expect(page.locator(".reader-bibliography h3")).toHaveText(["Books", "Journal articles"]);
  await expect(page.locator(".reader-bibliography p")).toHaveCount(2);

  await page.locator(".group-title").filter({ hasText: /^Settings$/ }).click();
  const downloaded = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export Markdown", exact: true }).click();
  const stream = await (await downloaded).createReadStream();
  const chunks: Buffer[] = [];
  for await (const chunk of stream!) chunks.push(Buffer.from(chunk));
  const markdown = Buffer.concat(chunks).toString("utf8").replace(/\\(.)/g, "$1");
  const block = markdown.split("## Bibliography")[1].split(/\n## /)[0];
  const exported = block.split("\n").map((line) => line.trim()).filter(Boolean);
  expect(exported).toEqual(pageLines);

  await page.locator('.sidebar [data-group="research"] .entry-main').filter({ hasText: "Atlas of Tides" }).click();
  await expect(page.locator(".research-panel")).toBeVisible();
  await expect(page.getByLabel("Title", { exact: true })).toHaveValue("Atlas of Tides");
});

test("Research sidebar group: no Bibliography without sources, Chicago always has it, notes sit under Research", async ({
  page,
}) => {
  const rows = page.locator('.sidebar [data-group="research"] .entry-main');
  await page.goto("/");
  await create(page, "Empty research");
  await expect(page.locator('.sidebar [data-group="research"]')).toBeVisible();
  await expect(rows).toHaveCount(0);

  await openResearch(page);
  await page.getByRole("button", { name: "Notes", exact: true }).click();
  await page.getByRole("button", { name: "Add note", exact: true }).click();
  await page.getByLabel("Note text").first().fill("Remember the tide table");
  await page.getByRole("button", { name: "Close research", exact: true }).click();
  await expect(rows).toHaveText(["Remember the tide table"]);

  // A prior source selection must not override the Notes tab when opening a
  // research note from the sidebar.
  await openResearch(page);
  await page.getByRole("button", { name: "Enter manually" }).click();
  await page.getByLabel("Title", { exact: true }).fill("Lamps and Ledgers");
  await page.getByLabel("Authors", { exact: true }).fill("Marguerite Halloway");
  await page.getByLabel("Year", { exact: true }).fill("2019");
  await page.getByRole("button", { name: "Close research", exact: true }).click();
  await expect(rows).toHaveText([
    "Bibliography",
    "Halloway -- Lamps and Ledgers (2019)",
    "Remember the tide table",
  ]);

  await page.getByRole("button", { name: "Read manuscript", exact: true }).click();
  await rows.nth(1).click();
  await expect(page.getByLabel("Title", { exact: true })).toHaveValue(
    "Lamps and Ledgers",
  );
  await page.getByRole("button", { name: "Close research", exact: true }).click();
  await rows.nth(2).click();
  await expect(page.locator(".research-panel")).toBeVisible();
  await expect(page.getByLabel("Note text").first()).toBeVisible();
  await expect(page.getByRole("button", { name: "Notes", exact: true })).toHaveAttribute("aria-pressed", "true");

  await page.goto("/");
  await create(page, "Chicago research", "Chicago");
  await expect(rows.first()).toHaveText("Bibliography");
});
