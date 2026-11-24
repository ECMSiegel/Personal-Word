import { test, expect, type Page } from "@playwright/test";

// Wave 9 P1: the reworked Projects page (caption controls, remembered sort, empty state).

async function createProject(page: Page, title: string) {
  await page.getByRole("button", { name: "Start new project" }).click();
  await page.getByRole("button", { name: "Blank", exact: true }).click();
  await page.getByLabel("Project title").fill(title);
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await page.getByRole("button", { name: "Projects", exact: true }).click();
  await expect(page.locator(".library")).toBeVisible();
}

async function seed(page: Page) {
  await page.goto("/");
  for (const title of ["Alpha draft", "Beta notes", "Gamma"]) await createProject(page, title);
  await expect(page.locator(".project-row")).toHaveCount(3);
}

const colours = (page: Page) =>
  page.evaluate(() => {
    const probe = (v: string) => {
      const s = document.createElement("span");
      s.style.color = `var(${v})`;
      document.body.append(s);
      const c = getComputedStyle(s).color;
      s.remove();
      return c;
    };
    return { text: probe("--text"), muted: probe("--muted") };
  });

test("the toolbar holds Start, Import writing, the search, Sort, New folder and the gear", async ({ page }) => {
  await seed(page);
  const toolbar = page.locator(".library-toolbar");
  const names = await toolbar
    .locator("button")
    .evaluateAll((els) => els.map((el) => el.getAttribute("aria-label") ?? el.textContent!.trim()));
  expect(names).toHaveLength(6);
  expect(names[0]).toContain("Start new project");
  expect(names[1]).toMatch(/^Import writing/);
  expect(names[2]).toBe("Search projects");
  expect(names[3]).toBe("Sort projects");
  expect(names[4]).toBe("New folder");
  expect(names[5]).toBe("Settings");
  await expect(page.locator(".library-caption")).toHaveCount(0);
});

test("Sort sits on the same toolbar row as Start new project", async ({ page }) => {
  await seed(page);
  const centreY = async (name: string) => {
    const b = (await page.getByRole("button", { name }).first().boundingBox())!;
    return b.y + b.height / 2;
  };
  expect(Math.abs((await centreY("Sort projects")) - (await centreY("Start new project")))).toBeLessThanOrEqual(4);
});

test("New folder and Settings are icon-sized toolbar buttons with no text stroke on hover", async ({ page }) => {
  await seed(page);
  const toolbar = page.locator(".library-toolbar");
  const folder = toolbar.getByRole("button", { name: "New folder" });
  const settings = toolbar.getByRole("button", { name: "Settings" });
  await expect(folder).toBeVisible();
  await expect(settings).toBeVisible();
  // The icon-only ones are outside the text hover rule: no stroke on hover.
  for (const control of [folder, settings]) {
    await expect(control).toHaveClass(/\b(icon-button|slot)\b/);
    await control.hover();
    const stroke = await control.evaluate((el) => (getComputedStyle(el).textShadow === "none" ? 0 : parseFloat(/(-?[\d.]+)px/.exec(getComputedStyle(el).textShadow)?.[1] ?? "0")));
    expect(stroke).toBe(0);
  }
});

test("row names are 13 px and first; Edited is normal colour, Added is muted; Edited comes before Added", async ({ page }) => {
  await seed(page);
  const { text, muted } = await colours(page);
  const row = page.locator(".project-row").first();
  const name = row.locator(".project-name");
  const edited = row.locator(".col-edited");
  const added = row.locator(".col-added");
  await expect(edited).toHaveAttribute("aria-label", /^Edited \S/);
  await expect(added).toHaveAttribute("aria-label", /^Added \S/);
  expect(await name.evaluate((el) => getComputedStyle(el).fontSize)).toBe("13px");
  expect(await edited.evaluate((el) => getComputedStyle(el).color)).toBe(text);
  expect(await added.evaluate((el) => getComputedStyle(el).color)).toBe(muted);
  const n = (await name.boundingBox())!;
  const e = (await edited.boundingBox())!;
  const a = (await added.boundingBox())!;
  // The name is first: left of the dates. Edited comes before Added.
  expect(n.x).toBeLessThan(e.x);
  expect(e.x).toBeLessThan(a.x);
});

test("sort and direction survive a reload", async ({ page }) => {
  await seed(page);
  await page.getByRole("button", { name: "Sort projects" }).click();
  await page.getByRole("menuitemradio", { name: "Name", exact: true }).click();
  await expect(page.locator(".project-row .project-name").first()).toHaveText("Alpha draft");
  await page.getByRole("menuitemradio", { name: "Z to A" }).click();
  await expect(page.locator(".project-row .project-name").first()).toHaveText("Gamma");
  await page.keyboard.press("Escape");
  await expect
    .poll(() => page.evaluate(() => JSON.parse(localStorage.getItem("folio.workspace.library") ?? "{}")))
    .toEqual({
      sort: "name",
      fallbackSort: "edited",
      reverse: true,
      foldersFirst: true,
      columns: ["edited", "words", "sections", "added"],
    });
  await page.reload();
  await expect(page.getByRole("button", { name: "Sort projects" })).toContainText("Name");
  await expect(page.locator(".project-row .project-name").first()).toHaveText("Gamma");
});

test("bad saved library preferences fall back to the defaults", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("folio.workspace.library", "{not json"));
  await page.goto("/");
  await expect(page.getByRole("button", { name: "Search projects" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Sort projects" })).toContainText("Edited");
});

test("the page's icon buttons carry icon-grow", async ({ page }) => {
  await seed(page);
  for (const name of ["Search projects", "New folder", "Settings"]) {
    await expect(page.getByRole("button", { name, exact: true })).toHaveClass(/\bicon-grow\b/);
  }
  const trash = page.locator(".project-row .delete-entry").first();
  await expect(trash).toHaveClass(/\bdelete-entry\b/);
  await expect(trash).toHaveClass(/\bicon-grow\b/);
});

test("with no projects the list area offers one sentence and text controls, no illustration", async ({ page }) => {
  await page.goto("/");
  const area = page.locator(".library .drop-target");
  await expect(area).toContainText("Start with a blank page or a template, or bring in writing you already have.");
  await expect(area.getByText("No projects yet.")).toHaveCount(0);
  await expect(area.locator("img, svg, canvas")).toHaveCount(0);
  const labels = await area.locator(".library-empty-actions button").allTextContents();
  expect(labels.map((l) => l.trim())).toEqual(["Blank", "Chicago", "Screenplay", "Import writing"]);

  // Blank does what the menu's Blank does.
  await area.locator(".library-empty-actions button", { hasText: "Chicago" }).click();
  await expect(page.getByLabel("Project title")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByLabel("Project title")).toHaveCount(0);

  // Import writing does what the menu's Import a file does: opens the writing picker.
  const chooser = page.waitForEvent("filechooser");
  await area.locator(".library-empty-actions button", { hasText: "Import writing" }).click();
  const picker = await chooser;
  expect(await picker.element().evaluate((el) => el.id)).toBe("import-writing-text");
  await picker.setFiles({ name: "Empty.md", mimeType: "text/markdown", buffer: Buffer.from("# Hello\n\nBody.") });
  await expect(page.getByRole("dialog", { name: "Import writing" })).toBeVisible();
});

test("an empty search keeps 'No matching projects.' and not the empty-state block", async ({ page }) => {
  await seed(page);
  await page.getByRole("button", { name: "Search projects", exact: true }).click();
  await page.getByRole("searchbox", { name: "Filter projects by title" }).fill("zzz");
  await expect(page.getByText("No matching projects.")).toBeVisible();
  await expect(page.locator(".library-empty-actions")).toHaveCount(0);
});

test("each project shows its word and section counts beside Edited and Added", async ({ page }) => {
  await page.goto("/");
  const id = "22222222-2222-4222-8222-222222222222";
  await page.evaluate((id) => {
    const words = (n: number) => Array.from({ length: n }, (_, i) => "w" + i).join(" ");
    const section = (n: number, i: number) => ({
      id: `33333333-3333-4333-8333-33333333333${i}`,
      kind: "section",
      title: "S" + i,
      content: { type: "doc", content: [{ type: "paragraph" }] },
      text: words(n),
      updatedAt: "2026-11-01T00:00:00.000Z",
      origin: null,
    });
    const entries = [section(1000, 1), section(150, 2), section(50, 3)];
    localStorage.setItem(
      "folio.preview.project." + id,
      JSON.stringify({
        id,
        title: "Counted project",
        createdAt: "2026-11-01T00:00:00.000Z",
        updatedAt: "2026-11-04T00:00:00.000Z",
        revision: 1,
        order: entries.map((e) => e.id),
        entries,
      }),
    );
  }, id);
  await page.reload();
  const row = page.locator(".project-row", { hasText: "Counted project" });
  await expect(row.locator(".col-edited")).toHaveAttribute("aria-label", /^Edited \S/);
  await expect(row.locator(".col-added")).toHaveAttribute("aria-label", /^Added \S/);
  await expect(row.locator(".col-words")).toHaveText("1,200");
  await expect(row.locator(".col-words")).toHaveAttribute("aria-label", "1,200 words");
  await expect(row.locator(".col-sections")).toHaveText("3");
  await expect(row.locator(".col-sections")).toHaveAttribute("aria-label", "3 sections");
  const at = async (selector: string) => (await row.locator(selector).boundingBox())!;
  const edited = await at(".col-edited");
  const added = await at(".col-added");
  const words = await at(".col-words");
  const sections = await at(".col-sections");
  // Four columns; the visual order is edited, words, sections, added, on one line.
  expect(words.x).toBeGreaterThan(edited.x);
  expect(sections.x).toBeGreaterThan(words.x);
  expect(added.x).toBeGreaterThan(sections.x);
  expect(Math.abs(added.y - edited.y)).toBeLessThanOrEqual(1);
});
