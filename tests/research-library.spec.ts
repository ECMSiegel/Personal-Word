import { expect, test, type Page } from "@playwright/test";

async function start(page: Page, title: string) {
  await page.goto("/");
  await page.getByRole("button", { name: "Start new project" }).click();
  await page.getByRole("button", { name: "Blank", exact: true }).click();
  await page.getByLabel("Project title").fill(title);
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await page.locator(".group-title").filter({ hasText: /^Research$/ }).click();
  await expect(page.locator(".research-panel")).toBeVisible();
}
async function importItems(page: Page, items: unknown[]) {
  await page.getByLabel("Zotero CSL JSON file").setInputFiles({ name: "sources.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(items)) });
  await expect(page.getByRole("dialog", { name: "Import Zotero sources" })).toBeVisible();
}
async function savedResearch(page: Page) {
  await expect(page.locator(".save-status")).toHaveText("Saved");
  // Return serialized data: Playwright's object transport does not preserve an
  // own __proto__ key, so parse the actual stored JSON on this side instead.
  const stored = await page.evaluate(() => {
    const key = Object.keys(localStorage).find((key) => key.startsWith("folio.preview.project."))!;
    return localStorage.getItem(key)!;
  });
  return JSON.parse(stored).research;
}

test("different works survive title/surname collisions and exact DOI copies are a choice", async ({ page }) => {
  await start(page, "Reviewed source import");
  await page.getByRole("button", { name: "Enter manually" }).click();
  await page.getByLabel("Title", { exact: true }).fill("Shared title");
  await page.getByLabel("Authors", { exact: true }).fill("Jane Smith");
  await page.getByLabel("DOI", { exact: true }).fill("10.1234/old");
  await page.getByRole("button", { name: "Cite here", exact: true }).click();
  const original = await savedResearch(page);
  await importItems(page, [{ type: "book", title: "Shared title", author: [{ given: "John", family: "Smith" }], DOI: "10.1234/new" }]);
  await expect(page.getByText("1 sources to add", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Add sources", exact: true }).click();
  await expect(page.locator(".source-item")).toHaveCount(2);
  await importItems(page, [{ type: "book", title: "Imported metadata", DOI: "https://dx.doi.org/10.1234/OLD" }]);
  await expect(page.getByText("0 sources to add", { exact: true })).toBeVisible();
  await expect(page.getByLabel("Add Imported metadata", { exact: true })).not.toBeChecked();
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(page.locator(".source-item")).toHaveCount(2);
  await importItems(page, [{ type: "book", title: "Imported metadata", DOI: "doi: 10.1234/old" }]);
  await page.getByRole("dialog").screenshot({ path: "node_modules/.cache/personal-word-beta/c1-import-review-light.png" });
  await page.emulateMedia({ colorScheme: "dark" });
  await page.getByRole("dialog").screenshot({ path: "node_modules/.cache/personal-word-beta/c1-import-review-dark.png" });
  await page.emulateMedia({ colorScheme: "light" });
  await page.getByLabel("Add Imported metadata", { exact: true }).check();
  await page.getByRole("button", { name: "Add sources", exact: true }).click();
  await expect(page.locator(".source-item")).toHaveCount(3);
  const after = await savedResearch(page);
  expect(after.sources[0]).toEqual(original.sources[0]);
  expect(after.footnotes).toEqual(original.footnotes);
  expect(new Set(after.sources.map((source: { id: string }) => source.id)).size).toBe(3);
});

test("raw source fields, corporate creators and manual forms survive browser save and reopen", async ({ page }) => {
  await start(page, "Raw sources");
  const item = { type: "archive-custom", title: "Corporate archive", author: [{ literal: "Coastal Research Council" }], custom: { nested: ["保留", 17] }, ...JSON.parse('{"__proto__":{"safe":"data"}}') };
  await importItems(page, [item]);
  await expect(page.getByText("1 sources to add", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Add sources", exact: true }).click();
  await page.locator(".source-toggle").click();
  await expect(page.getByLabel("author 1 organization or literal name")).toHaveValue("Coastal Research Council");
  await page.getByLabel("Manual full note", { exact: true }).fill("Council, archival note -- preserve this text!");
  await page.getByLabel("Manual short note", { exact: true }).fill("Council, archive!");
  await page.getByLabel("Manual bibliography entry", { exact: true }).fill("Council. Archive -- exact text!");
  await expect(page.locator(".citation-preview").first()).toHaveText("Council, archival note -- preserve this text!");
  await page.getByLabel("author 1 organization or literal name").scrollIntoViewIfNeeded();
  await page.screenshot({ path: "node_modules/.cache/personal-word-beta/c1-source-light.png" });
  await page.emulateMedia({ colorScheme: "dark" });
  await page.screenshot({ path: "node_modules/.cache/personal-word-beta/c1-source-dark.png" });
  await page.emulateMedia({ colorScheme: "light" });
  const data = await savedResearch(page);
  expect(data.sources[0].cslData).toEqual(item);
  expect(data.sources[0].creators).toEqual([{ role: "author", literal: "Coastal Research Council" }]);
  await page.reload();
  await page.locator(".project-row").filter({ has: page.getByText("Raw sources", { exact: true }) }).locator("button").first().click();
  await page.locator(".group-title").filter({ hasText: /^Research$/ }).click();
  await page.locator(".source-toggle").click();
  await expect(page.getByLabel("Manual full note", { exact: true })).toHaveValue("Council, archival note -- preserve this text!");
  expect((await savedResearch(page)).sources[0]).toEqual(data.sources[0]);
});

test("editing an editor keeps a chapter's legacy author and enables the bounded chapter preview", async ({ page }) => {
  await start(page, "Chapter source");
  await page.getByRole("button", { name: "Enter manually" }).click();
  await page.getByLabel("Authors", { exact: true }).fill("Mina Chen");
  await page.getByLabel("Title", { exact: true }).fill("Mapping Estuaries");
  await page.getByRole("button", { name: "Source type", exact: true }).click();
  await page.getByRole("option", { name: "Book chapter", exact: true }).click();
  await page.getByLabel("Container title", { exact: true }).fill("Coastal Methods");
  await page.getByLabel("Publisher", { exact: true }).fill("Harbor Press");
  await page.getByLabel("Year", { exact: true }).fill("2024");
  await page.getByRole("button", { name: "Add editor", exact: true }).click();
  await page.getByLabel("editor 1 organization or literal name", { exact: true }).fill("Ravi Patel");
  await expect(page.getByLabel("Authors", { exact: true })).toHaveValue("Mina Chen");
  await expect(page.locator(".citation-preview").first()).toHaveText("Mina Chen, “Mapping Estuaries,” in Coastal Methods, ed. Ravi Patel (Harbor Press, 2024).");
});

async function prepareFieldUpdate(page: Page, title: string) {
  await start(page, title);
  await page.getByRole("button", { name: "Enter manually" }).click();
  await page.getByLabel("Title", { exact: true }).fill("Locally edited title");
  await page.getByLabel("Authors", { exact: true }).fill("Local Writer");
  await page.getByLabel("Publisher", { exact: true }).fill("Local Press");
  await page.getByLabel("Year", { exact: true }).fill("2020");
  await page.getByLabel("DOI", { exact: true }).fill("10.1234/update");
  await page.getByLabel("Manual full note", { exact: true }).fill("Keep locally reviewed note!");
  await page.getByRole("button", { name: "Cite here", exact: true }).click();
  const before = await savedResearch(page);
  await importItems(page, [{ type: "book", title: "External record", author: [{ given: "Imported", family: "Author" }], publisher: "External Press", issued: { "date-parts": [[2025]] }, DOI: "doi: 10.1234/update" }]);
  await expect(page.getByRole("button", { name: "Review field updates for External record", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Review field updates for External record", exact: true }).click();
  await page.getByRole("button", { name: "Update target for External record", exact: true }).click();
  await page.getByRole("option", { name: "Record 1 -- Locally edited title -- Local Writer -- 2020", exact: true }).click();
  return before;
}

test("selected imported fields update one stable source without overwriting local edits or note references", async ({ page }) => {
  const before = await prepareFieldUpdate(page, "Reviewed field update");
  await expect(page.getByRole("button", { name: "Apply source choices", exact: true })).toBeDisabled();
  await page.getByLabel("Update Publisher for External record", { exact: true }).check();
  await page.getByLabel("Update Year for External record", { exact: true }).check();
  await page.getByRole("dialog").screenshot({ path: "node_modules/.cache/personal-word-beta/c1-field-review-light.png" });
  await page.emulateMedia({ colorScheme: "dark" });
  await page.getByRole("dialog").screenshot({ path: "node_modules/.cache/personal-word-beta/c1-field-review-dark.png" });
  await page.emulateMedia({ colorScheme: "light" });
  await page.getByRole("button", { name: "Apply source choices", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "Import Zotero sources" })).not.toBeVisible();
  const after = await savedResearch(page);
  expect(after.sources).toHaveLength(1);
  expect(after.sources[0]).toEqual({ ...before.sources[0], publisher: "External Press", year: "2025" });
  expect(after.footnotes).toEqual(before.footnotes);
  expect(after.notes).toEqual(before.notes);
  const safety = await page.evaluate(() => {
    const key = Object.keys(localStorage).find((key) => key.startsWith("folio.preview.snapshots."))!;
    return localStorage.getItem(key)!;
  });
  expect(JSON.parse(safety)[0].project.research).toEqual(before);
});

test("a mismatched source-update safety snapshot blocks every field change", async ({ page }) => {
  await page.addInitScript(() => {
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function(key: string, value: string) {
      if (key.startsWith("folio.preview.snapshots.") && (window as any).__corruptNextSourceSnapshot) {
        (window as any).__corruptNextSourceSnapshot = false;
        const versions = JSON.parse(value);
        versions[0].project.title = "Corrupted source safety copy";
        value = JSON.stringify(versions);
      }
      original.call(this, key, value);
    };
  });
  const before = await prepareFieldUpdate(page, "Source safety rejection");
  await page.getByLabel("Update Publisher for External record", { exact: true }).check();
  await page.evaluate(() => { (window as any).__corruptNextSourceSnapshot = true; });
  await page.getByRole("button", { name: "Apply source choices", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText(/safety snapshot/i);
  expect(await savedResearch(page)).toEqual(before);
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(page.getByLabel("Publisher", { exact: true })).toHaveValue("Local Press");
});

test("same-title update targets are distinguishable and update only the chosen stable record", async ({ page }) => {
  await start(page, "Duplicate source targets");
  for (const publisher of ["First Press", "Second Press"]) {
    await page.getByRole("button", { name: "Enter manually" }).click();
    await page.getByLabel("Title", { exact: true }).fill("Shared source title");
    await page.getByLabel("Authors", { exact: true }).fill("Same Writer");
    await page.getByLabel("Year", { exact: true }).fill("2020");
    await page.getByLabel("Publisher", { exact: true }).fill(publisher);
    await page.getByLabel("DOI", { exact: true }).fill("10.1234/shared-target");
  }
  await page.getByRole("button", { name: "Cite here", exact: true }).click();
  const before = await savedResearch(page);
  await importItems(page, [{ type: "book", title: "External record", publisher: "External Press", DOI: "10.1234/shared-target" }]);
  await page.getByRole("button", { name: "Review field updates for External record", exact: true }).click();
  await page.getByRole("button", { name: "Update target for External record", exact: true }).click();
  const target = page.getByRole("option", { name: "Record 2 -- Shared source title -- Same Writer -- 2020", exact: true });
  await expect(target).toBeVisible();
  await target.click();
  await page.getByLabel("Update Publisher for External record", { exact: true }).check();
  await page.getByRole("button", { name: "Apply source choices", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "Import Zotero sources" })).not.toBeVisible();
  const after = await savedResearch(page);
  expect(after.sources[0]).toEqual(before.sources[0]);
  expect(after.sources[1]).toEqual({ ...before.sources[1], publisher: "External Press" });
  expect(after.footnotes).toEqual(before.footnotes);
});

test("a recovered duplicate source identity cannot update multiple existing records", async ({ page }) => {
  await start(page, "Legacy duplicate identities");
  await page.getByRole("button", { name: "Enter manually" }).click();
  await page.getByLabel("Title", { exact: true }).fill("Duplicate IDs source");
  await page.getByLabel("Publisher", { exact: true }).fill("Local Press");
  await page.getByLabel("DOI", { exact: true }).fill("10.1234/duplicate-ids");
  await savedResearch(page);
  // A malformed legacy/recovered project remains readable, but must not let an
  // update-by-ID apply to multiple records. This storage is isolated to the test.
  await page.evaluate(() => {
    const key = Object.keys(localStorage).find((key) => key.startsWith("folio.preview.project."))!;
    const project = JSON.parse(localStorage.getItem(key)!);
    project.research.sources.push({ ...project.research.sources[0], publisher: "Other local press" });
    localStorage.setItem(key, JSON.stringify(project));
  });
  await page.reload();
  await page.locator(".project-row").filter({ has: page.getByText("Legacy duplicate identities", { exact: true }) }).locator("button").first().click();
  await page.locator(".group-title").filter({ hasText: /^Research$/ }).click();
  const before = await savedResearch(page);
  await importItems(page, [{ type: "book", title: "External record", publisher: "External Press", DOI: "10.1234/duplicate-ids" }]);
  await page.getByRole("button", { name: "Review field updates for External record", exact: true }).click();
  await page.getByRole("button", { name: "Update target for External record", exact: true }).click();
  await page.getByRole("option").filter({ hasText: "Duplicate IDs source" }).click();
  await page.getByLabel("Update Publisher for External record", { exact: true }).check();
  await page.getByRole("button", { name: "Apply source choices", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText(/identity is not unique/i);
  expect(await savedResearch(page)).toEqual(before);
});


test("required-detail hints recognize structured corporate authors without legacy author strings", async ({ page }) => {
  await start(page, "Structured author hints");
  await importItems(page, [{ type: "book", title: "Council indicators", author: [{ literal: "Coastal Research Council" }], publisher: "Council Press", issued: { "date-parts": [[2024]] } }]);
  await page.getByRole("button", { name: "Add sources", exact: true }).click();
  await savedResearch(page);
  // Structured-only sources are valid additive records, including after recovery.
  await page.evaluate(() => {
    const key = Object.keys(localStorage).find((key) => key.startsWith("folio.preview.project."))!;
    const project = JSON.parse(localStorage.getItem(key)!);
    project.research.sources[0].authors = [];
    localStorage.setItem(key, JSON.stringify(project));
  });
  await page.reload();
  await page.locator(".project-row").filter({ has: page.getByText("Structured author hints", { exact: true }) }).locator("button").first().click();
  await page.locator(".group-title").filter({ hasText: /^Research$/ }).click();
  await page.locator(".source-toggle").click();
  const hint = page.locator(".research-hint").filter({ hasText: "Review required details:" });
  await expect(hint).toHaveText("Review required details: core fields present -- verify names, dates and publication details.");
  await page.getByLabel("author 1 organization or literal name", { exact: true }).fill("");
  await expect(hint).toContainText("creator or intentional no-author entry");
});
