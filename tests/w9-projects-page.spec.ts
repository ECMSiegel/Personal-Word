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

test("the toolbar holds Start, Import writing, the search, Sort, reverse, the view toggle and the gear", async ({ page }) => {
  await seed(page);
  const toolbar = page.locator(".library-toolbar");
  const names = await toolbar
    .locator("button")
    .evaluateAll((els) => els.map((el) => el.getAttribute("aria-label") ?? el.textContent!.trim()));
  expect(names).toHaveLength(7);
  expect(names[0]).toContain("Start new project");
  expect(names[1]).toMatch(/^Import writing/);
  expect(names[2]).toBe("Search projects");
  expect(names[3]).toBe("Sort projects");
  expect(names[4]).toBe("Reverse project sort order");
  expect(names[5]).toBe("Show project cards");
  expect(names[6]).toBe("Settings");
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

test("Sort, reverse and the view toggle are icon-sized toolbar buttons with no text stroke on hover", async ({ page }) => {
  await seed(page);
  const toolbar = page.locator(".library-toolbar");
  const reverse = toolbar.getByRole("button", { name: "Reverse project sort order" });
  const view = toolbar.getByRole("button", { name: "Show project cards" });
  await expect(reverse).toBeVisible();
  await expect(view).toBeVisible();
  // The icon-only ones are outside the text hover rule: no stroke on hover.
  for (const control of [reverse, view]) {
    await expect(control).toHaveClass(/\bicon-button\b/);
    await control.hover();
    const stroke = await control.evaluate((el) => (getComputedStyle(el).textShadow === "none" ? 0 : parseFloat(/(-?[\d.]+)px/.exec(getComputedStyle(el).textShadow)?.[1] ?? "0")));
    expect(stroke).toBe(0);
  }
});

test("row titles are 15 px and first; Edited is normal colour, Added is muted; cards keep the order", async ({ page }) => {
  await seed(page);
  const { text, muted } = await colours(page);
  for (const view of ["list", "cards"] as const) {
    if (view === "cards") await page.getByRole("button", { name: "Show project cards" }).click();
    const row = page.locator(".project-row").first();
    const name = row.locator(".project-name");
    const edited = row.locator(".project-dates > span").nth(0);
    const added = row.locator(".project-dates > span").filter({ hasText: /^Added/ });
    await expect(edited).toHaveText(/^Edited \S/);
    await expect(added).toHaveText(/^Added \S/);
    expect(await name.evaluate((el) => getComputedStyle(el).fontSize)).toBe("15px");
    expect(await edited.evaluate((el) => getComputedStyle(el).color)).toBe(text);
    expect(await added.evaluate((el) => getComputedStyle(el).color)).toBe(muted);
    const n = (await name.boundingBox())!;
    const e = (await edited.boundingBox())!;
    const a = (await added.boundingBox())!;
    // Title first: in a list it is left of the dates, in a card it is above them.
    expect(n.x < e.x || n.y + n.height <= e.y + 1).toBe(true);
    // Edited comes before Added in reading order.
    expect(e.y < a.y || e.x < a.x).toBe(true);
  }
});

test("sort, direction and view survive a reload", async ({ page }) => {
  await seed(page);
  await page.getByRole("button", { name: "Sort projects" }).click();
  await page.getByRole("option", { name: "Name", exact: true }).click();
  await expect(page.locator(".project-row .project-name").first()).toHaveText("Alpha draft");
  await page.getByRole("button", { name: "Reverse project sort order" }).click();
  await expect(page.locator(".project-row .project-name").first()).toHaveText("Gamma");
  await page.getByRole("button", { name: "Show project cards" }).click();
  await expect(page.locator(".project-list--cards")).toBeVisible();
  await expect
    .poll(() => page.evaluate(() => JSON.parse(localStorage.getItem("folio.workspace.library") ?? "{}")))
    .toEqual({ sort: "name", reverse: true, view: "cards" });
  await page.reload();
  await expect(page.locator(".project-list--cards")).toBeVisible();
  await expect(page.getByRole("button", { name: "Show project list" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Sort projects" })).toContainText("Name");
  await expect(page.locator(".project-row .project-name").first()).toHaveText("Gamma");
});

test("bad saved library preferences fall back to the defaults", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("folio.workspace.library", "{not json"));
  await page.goto("/");
  await expect(page.getByRole("button", { name: "Show project cards" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Sort projects" })).toContainText("Last edited");
});

test("the page's icon buttons carry icon-grow and the arrow sits in a span", async ({ page }) => {
  await seed(page);
  for (const name of ["Search projects", "Reverse project sort order", "Show project cards", "Settings"]) {
    await expect(page.getByRole("button", { name, exact: true })).toHaveClass(/\bicon-grow\b/);
  }
  await expect(page.getByRole("button", { name: "Reverse project sort order" }).locator(":scope > span")).toHaveCount(1);
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

test("in cards view a very long title stays inside its card and clear of the trash button", async ({ page }) => {
  await page.goto("/");
  await createProject(page, "Short one");
  await createProject(page, "Long title ".repeat(10).trim());
  await page.getByRole("button", { name: "Show project cards" }).click();
  const card = page.locator(".project-row").filter({ hasText: "Long title" });
  await card.hover();
  const name = (await card.locator(".project-name").boundingBox())!;
  const box = (await card.boundingBox())!;
  const trash = (await card.locator(".delete-entry").boundingBox())!;
  expect(name.x + name.width).toBeLessThanOrEqual(box.x + box.width);
  const overlapsTrash = name.x < trash.x + trash.width && name.x + name.width > trash.x && name.y < trash.y + trash.height && name.y + name.height > trash.y;
  expect(overlapsTrash).toBe(false);
});

test("each project shows its word and section counts between Edited and Added, in list and cards", async ({ page }) => {
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
  for (const view of ["list", "cards"] as const) {
    if (view === "cards") await page.getByRole("button", { name: "Show project cards" }).click();
    const dates = page.locator(".project-row", { hasText: "Counted project" }).locator(".project-dates > span");
    await expect(dates).toHaveCount(4);
    await expect(dates.nth(0)).toHaveText(/^Edited \S/);
    await expect(dates.nth(1)).toHaveText("1,200 words");
    await expect(dates.nth(2)).toHaveText("3 sections");
    await expect(dates.nth(3)).toHaveText(/^Added \S/);
  }
});

test("in cards view the counts line stays inside the card and clear of the trash button", async ({ page }) => {
  await page.goto("/");
  await createProject(page, "Long title ".repeat(10).trim());
  await page.getByRole("button", { name: "Show project cards" }).click();
  const card = page.locator(".project-row").first();
  await card.hover();
  const box = (await card.boundingBox())!;
  const trash = (await card.locator(".delete-entry").boundingBox())!;
  const dates = await card.locator(".project-dates > span").evaluateAll((els) =>
    els.map((el) => {
      const r = el.getBoundingClientRect();
      return { x: r.x, y: r.y, w: r.width, h: r.height };
    }),
  );
  expect(dates).toHaveLength(4);
  for (const d of dates) {
    expect(d.x + d.w).toBeLessThanOrEqual(box.x + box.width);
    expect(d.y + d.h).toBeLessThanOrEqual(box.y + box.height);
    const overlaps = d.x < trash.x + trash.width && d.x + d.w > trash.x && d.y < trash.y + trash.height && d.y + d.h > trash.y;
    expect(overlaps).toBe(false);
  }
});
