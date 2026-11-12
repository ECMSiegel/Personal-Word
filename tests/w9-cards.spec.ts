import { test, expect, type Page } from "@playwright/test";

// W9 A3: card view in the sidebar. Cards must stay inside the list at narrow
// widths, research cards are one-line rows in one column, the open-beside
// icon sits inside the card's corner, and an empty card hides its Synopsis
// and status boxes until the card is opened or takes keyboard focus.

const LONG_TITLE = "Pneumonoultramicroscopic".repeat(3).slice(0, 60);
const LONG_PREVIEW = "Antidisestablishmentarianism".repeat(8).slice(0, 200);
const pdfBytes = Buffer.from(
  "%PDF-1.4\n1 0 obj << /Type /Catalog >> endobj\n%%EOF\n",
  "ascii",
);

async function nameDialog(page: Page, title: string) {
  await page.getByLabel("Title", { exact: true }).fill(title);
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
}

async function seed(page: Page, width: number) {
  await page.addInitScript((w) => {
    localStorage.setItem(
      "folio.workspace.sidebar",
      JSON.stringify({ width: w, pinned: true, hover: true }),
    );
  }, width);
  await page.goto("/");
  await page.getByRole("button", { name: "Start new project" }).click();
  await page.getByRole("button", { name: "Blank", exact: true }).click();
  await page.getByLabel("Project title").fill(`Cards ${width}`);
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByRole("textbox", { name: "Writing editor" })).toBeVisible();

  // Section with a 60-character unbroken title; its text becomes the fragment.
  await page.locator('.sidebar-group[data-group="manuscript"] .group-heading').hover();
  await page.getByRole("button", { name: "New section", exact: true }).click();
  await nameDialog(page, LONG_TITLE);
  const editor = page.getByRole("textbox", { name: "Writing editor" });
  await editor.fill(LONG_PREVIEW);
  await editor.press("ControlOrMeta+a");
  await page.getByRole("button", { name: "Keep as fragment" }).click();
  await expect(editor).not.toContainText(LONG_PREVIEW.slice(0, 20));

  // A second section that gets a synopsis, so it always shows its boxes.
  await page.locator('.sidebar-group[data-group="manuscript"] .group-heading').hover();
  await page.getByRole("button", { name: "New section", exact: true }).click();
  await nameDialog(page, "Synopsis card");
  const synopsisCard = page
    .locator('.sidebar-group[data-group="manuscript"] .entry-row')
    .filter({ hasText: "Synopsis card" });

  // One research source with its PDF.
  await page.locator(".group-title").filter({ hasText: /^Research$/ }).click();
  await expect(page.locator(".research-panel")).toBeVisible();
  await page.getByRole("button", { name: "Enter manually" }).click();
  await page.getByLabel("Title", { exact: true }).fill("A local source");
  await page.getByLabel("Authors", { exact: true }).fill("Ada Example");
  await page.getByLabel("Year", { exact: true }).fill("2026");
  await page
    .locator(".source-item")
    .filter({ hasText: "A local source" })
    .locator('.source-pdf-field input[type="file"]')
    .setInputFiles({ name: "source.pdf", mimeType: "application/pdf", buffer: pdfBytes });
  await expect(page.locator(".save-status")).toHaveText("Saved", { timeout: 10_000 });

  // Card view for the three collapsible groups.
  for (const group of ["manuscript", "fragments", "research"]) {
    await page.locator(`.sidebar-group[data-group="${group}"] .group-heading`).hover();
    await page.locator(`.sidebar-group[data-group="${group}"] .group-title`).focus();
    const label = group[0].toUpperCase() + group.slice(1);
    await page.getByRole("button", { name: `Show ${label} cards` }).click();
    await expect(page.locator(`.sidebar-group[data-group="${group}"]`)).toHaveClass(/cards-view/);
  }
  // Synopsis boxes exist only in card view, so fill it after the toggles.
  await synopsisCard.locator(".entry-main").click();
  await synopsisCard.locator(".entry-details input").fill("A short synopsis");
  await page.mouse.move(0, 0);
}

for (const width of [220, 254, 420]) {
  test(`cards fit the list, research cards are rows, and the open-beside icon is inset at ${width} px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await seed(page, width);

    // Every group's list and every card stay inside the list's box.
    const fit = await page.evaluate(() => {
      const problems: string[] = [];
      for (const group of document.querySelectorAll<HTMLElement>(".sidebar-group.cards-view")) {
        const name = group.dataset.group ?? "?";
        if (group.scrollWidth > group.clientWidth) problems.push(`${name} group scrolls sideways`);
        const list = group.querySelector<HTMLElement>(".entry-list");
        if (!list) continue;
        const lr = list.getBoundingClientRect();
        if (list.scrollWidth > list.clientWidth) problems.push(`${name} list scrolls sideways`);
        for (const card of list.querySelectorAll<HTMLElement>(".entry-row")) {
          const r = card.getBoundingClientRect();
          if (r.width === 0) continue;
          if (r.left < lr.left - 0.5 || r.right > lr.right + 0.5)
            problems.push(`${name} card "${card.textContent?.slice(0, 20)}" leaves the list`);
        }
      }
      return problems;
    });
    expect(fit).toEqual([]);

    // Synopsis input and status row sit inside their visible card.
    const inside = await page.evaluate(() => {
      const problems: string[] = [];
      for (const card of document.querySelectorAll<HTMLElement>(".cards-view .entry-row")) {
        const cr = card.getBoundingClientRect();
        for (const box of card.querySelectorAll<HTMLElement>(".entry-details input, .entry-details .entry-status")) {
          const r = box.getBoundingClientRect();
          if (r.width === 0) continue;
          if (r.left < cr.left - 0.5 || r.right > cr.right + 0.5 || r.bottom > cr.bottom + 0.5)
            problems.push(box.className || box.tagName);
        }
      }
      return problems;
    });
    expect(inside).toEqual([]);

    // Research cards: one-line rows, one column, depth-0 cards share a left edge.
    const research = await page.evaluate(() =>
      Array.from(
        document.querySelectorAll<HTMLElement>('.sidebar-group[data-group="research"] .entry-row'),
      )
        .map((row) => {
          const r = row.getBoundingClientRect();
          return {
            text: row.textContent?.slice(0, 24) ?? "",
            depth: row.dataset.depth ?? "0",
            left: r.left,
            height: r.height,
          };
        })
        .filter((x) => x.height > 0),
    );
    expect(research.length).toBeGreaterThanOrEqual(3);
    for (const row of research) {
      expect(row.height, `research card "${row.text}" height`).toBeLessThanOrEqual(40);
    }
    const roots = research.filter((x) => x.depth === "0");
    const children = research.filter((x) => x.depth === "1");
    expect(children.length, "PDF child row").toBe(1);
    for (const row of roots) {
      expect(Math.abs(row.left - roots[0].left), `root "${row.text}" left`).toBeLessThanOrEqual(0.5);
    }
    expect(children[0].left - roots[0].left, "PDF child indent").toBeGreaterThanOrEqual(8);

    // The open-beside icon sits at least 8 px inside the card's top and right edges.
    const beside = await page.evaluate(() =>
      Array.from(document.querySelectorAll<HTMLElement>('.sidebar-group[data-group="manuscript"].cards-view .entry-row'))
        .map((card) => {
          const btn = card.querySelector<HTMLElement>(".open-beside");
          if (!btn) return null;
          const cr = card.getBoundingClientRect();
          const br = btn.getBoundingClientRect();
          return { top: br.top - cr.top, right: cr.right - br.right };
        })
        .filter((x) => x !== null),
    );
    expect(beside.length).toBeGreaterThan(0);
    for (const b of beside) {
      expect(b.top).toBeGreaterThanOrEqual(8);
      expect(b.right).toBeGreaterThanOrEqual(8);
    }
  });
}

test("an empty card hides its boxes at rest and on hover, shows them when opened or focused, and a card with a synopsis always shows them", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await seed(page, 254);

  const emptyCard = page
    .locator('.sidebar-group[data-group="manuscript"] .entry-row')
    .filter({ hasText: LONG_TITLE.slice(0, 30) });
  const synopsisCard = page
    .locator('.sidebar-group[data-group="manuscript"] .entry-row')
    .filter({ hasText: "Synopsis card" });
  const emptyInput = emptyCard.locator(".entry-details input");
  const emptyStatus = emptyCard.locator(".entry-details .entry-status");

  // At rest: hidden.
  await page.mouse.move(0, 0);
  await expect(emptyInput).toBeHidden();
  await expect(emptyStatus).toBeHidden();

  // Hover alone does not reveal them.
  await emptyCard.hover();
  await expect(emptyInput).toBeHidden();
  await expect(emptyStatus).toBeHidden();
  await page.mouse.move(0, 0);

  // Keyboard focus into the card reveals them.
  await emptyCard.locator(".entry-main").focus();
  await expect(emptyInput).toBeVisible();
  await expect(emptyStatus).toBeVisible();
  await page.locator("body").click({ position: { x: 1200, y: 700 } });

  // Opening the card reveals them.
  await emptyCard.locator(".entry-main").click();
  await expect(emptyInput).toBeVisible();
  await expect(emptyStatus).toBeVisible();

  // A card with a synopsis shows its boxes at rest.
  await page.mouse.move(0, 0);
  await expect(synopsisCard.locator(".entry-details input")).toBeVisible();
  await expect(synopsisCard.locator(".entry-details .entry-status")).toBeVisible();
});
