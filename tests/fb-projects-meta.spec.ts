import { test, expect, type Page } from "@playwright/test";

// FB1: the Projects page shows the same four meta fields in fixed columns in list view and as
// two columns of two lines in card view (Edited over Added, words over sections), so nothing is
// pushed around by the length of a title, date or count.

type Seed = {
  id: string;
  title: string;
  words: number;
  sections: number;
  createdAt: string;
  updatedAt: string;
};

const projects: Seed[] = [
  {
    id: "aaaa1111-1111-4111-8111-111111111111",
    title: "A very long project title that used to push the dates around",
    words: 1240,
    sections: 6,
    createdAt: "2026-09-30T09:00:00.000Z",
    updatedAt: "2026-10-02T09:00:00.000Z",
  },
  {
    id: "bbbb2222-2222-4222-8222-222222222222",
    title: "Notes",
    words: 1,
    sections: 1,
    createdAt: "2026-01-05T09:00:00.000Z",
    updatedAt: "2026-01-06T09:00:00.000Z",
  },
  {
    id: "cccc3333-3333-4333-8333-333333333333",
    title: "An essay of middling length",
    words: 999,
    sections: 3,
    createdAt: "2026-11-01T09:00:00.000Z",
    updatedAt: "2026-11-02T09:00:00.000Z",
  },
];

async function seed(page: Page) {
  await page.goto("/");
  await page.evaluate((seeds) => {
    const words = (n: number) => Array.from({ length: n }, (_, i) => "w" + i).join(" ");
    for (const seed of seeds) {
      const entries = Array.from({ length: seed.sections }, (_, i) => ({
        id: `${seed.id.slice(0, 8)}-0000-4000-8000-${String(i).padStart(12, "0")}`,
        kind: "section",
        title: "S" + i,
        content: { type: "doc", content: [{ type: "paragraph" }] },
        text: words(i === 0 ? seed.words - (seed.sections - 1) : 1),
        updatedAt: seed.updatedAt,
        origin: null,
      }));
      localStorage.setItem(
        "folio.preview.project." + seed.id,
        JSON.stringify({
          id: seed.id,
          title: seed.title,
          createdAt: seed.createdAt,
          updatedAt: seed.updatedAt,
          revision: 1,
          order: entries.map((e) => e.id),
          entries,
        }),
      );
    }
  }, projects);
  await page.reload();
  await expect(page.locator(".project-row")).toHaveCount(3);
}

const boxes = (page: Page, selector: string) =>
  page.locator(selector).evaluateAll((rows, rowSelector) => {
    return rows.map((row) => {
      const rowBox = row.getBoundingClientRect();
      const out: Record<string, { left: number; top: number; width: number; height: number }> = {};
      for (const el of Array.from(row.querySelectorAll(rowSelector + " .project-dates > span"))) {
        const box = el.getBoundingClientRect();
        out[(el as HTMLElement).className] = {
          left: box.left - rowBox.left,
          top: box.top - rowBox.top,
          width: box.width,
          height: box.height,
        };
      }
      return { row: { left: rowBox.left, top: rowBox.top, width: rowBox.width, height: rowBox.height }, fields: out };
    });
  }, selector);

test("list view: the four fields sit in fixed columns on every row and no row wraps", async ({ page }) => {
  await page.setViewportSize({ width: 1100, height: 900 });
  await seed(page);
  await expect(page.locator(".project-list--list")).toBeVisible();
  const rows = await boxes(page, ".project-list--list .project-row");
  expect(rows).toHaveLength(3);

  for (const cls of ["project-edited", "project-words", "project-sections", "project-added"]) {
    expect(rows.every((r) => r.fields[cls]), `${cls} rendered on every row`).toBe(true);
    const lefts = rows.map((r) => r.row.left + r.fields[cls].left);
    expect(Math.max(...lefts) - Math.min(...lefts), `${cls} left edge ${lefts.join(", ")}`).toBeLessThanOrEqual(1);
  }

  // Visual order left to right: Edited, words, sections, Added (the DOM order is different).
  const left = (cls: string) => rows[0].row.left + rows[0].fields[cls].left;
  expect(left("project-edited")).toBeLessThan(left("project-words"));
  expect(left("project-words")).toBeLessThan(left("project-sections"));
  expect(left("project-sections")).toBeLessThan(left("project-added"));

  // All four fields on one line: every row is the same height.
  const heights = rows.map((r) => r.row.height);
  expect(Math.max(...heights) - Math.min(...heights), `row heights ${heights.join(", ")}`).toBeLessThanOrEqual(1);

  // The text fits inside its own column, so no cell runs under its neighbour.
  const tooWide = await page.locator(".project-list--list .project-dates > span").evaluateAll((els) =>
    els
      .map((el) => {
        const range = document.createRange();
        range.selectNodeContents(el);
        return {
          cls: el.className,
          text: el.textContent ?? "",
          textWidth: range.getBoundingClientRect().width,
          cellWidth: el.getBoundingClientRect().width,
        };
      })
      .filter((r) => r.textWidth > r.cellWidth + 1),
  );
  expect(tooWide, `fields wider than their column: ${JSON.stringify(tooWide)}`).toEqual([]);
});

test("card view: Edited over Added and words over sections, the same offsets on every card", async ({ page }) => {
  await page.setViewportSize({ width: 1100, height: 900 });
  await seed(page);
  await page.getByRole("button", { name: "Show project cards" }).click();
  await expect(page.locator(".project-list--cards")).toBeVisible();
  const cards = await boxes(page, ".project-list--cards .project-row");
  expect(cards).toHaveLength(3);

  for (const card of cards) {
    const f = card.fields;
    expect(Math.abs(f["project-added"].left - f["project-edited"].left), "Added below Edited").toBeLessThanOrEqual(1);
    expect(f["project-added"].top).toBeGreaterThan(f["project-edited"].top);
    expect(Math.abs(f["project-sections"].left - f["project-words"].left), "sections below words").toBeLessThanOrEqual(1);
    expect(f["project-sections"].top).toBeGreaterThan(f["project-words"].top);
    expect(f["project-words"].left).toBeGreaterThan(f["project-edited"].left);
    // The two lines line up with each other.
    expect(
      Math.abs(f["project-added"].top - f["project-edited"].top - (f["project-sections"].top - f["project-words"].top)),
    ).toBeLessThanOrEqual(1);
  }

  // The same position on every card, whatever the title, dates and counts.
  for (const cls of ["project-edited", "project-added", "project-words", "project-sections"]) {
    const lefts = cards.map((c) => c.fields[cls].left);
    expect(Math.max(...lefts) - Math.min(...lefts), `${cls} left ${lefts.join(", ")}`).toBeLessThanOrEqual(1);
  }
  const gaps = cards.map((c) => c.fields["project-words"].left - c.fields["project-edited"].left);
  expect(Math.max(...gaps) - Math.min(...gaps), `column gap ${gaps.join(", ")}`).toBeLessThanOrEqual(1);
});

// One line tall: a date or count that wraps is about twice the line height of its neighbours.
const wrapped = (page: Page, scope: string) =>
  page.locator(scope + " .project-dates > span").evaluateAll((els) =>
    els
      .map((el) => {
        const lineHeight = parseFloat(getComputedStyle(el).lineHeight) || 1.4 * parseFloat(getComputedStyle(el).fontSize);
        return { text: el.textContent ?? "", height: el.getBoundingClientRect().height, lineHeight };
      })
      .filter((r) => r.height > r.lineHeight * 1.5),
  );

test("narrow window (680 px): no date wraps, every row is the same height, the counts share one edge", async ({ page }) => {
  await page.setViewportSize({ width: 680, height: 900 });
  await seed(page);
  expect(await wrapped(page, ".project-list--list .project-row"), "wrapped list fields").toEqual([]);
  const rows = await boxes(page, ".project-list--list .project-row");
  const heights = rows.map((r) => r.row.height);
  expect(Math.max(...heights) - Math.min(...heights), `row heights ${heights.join(", ")}`).toBeLessThanOrEqual(1);
  for (const cls of ["project-edited", "project-added", "project-words", "project-sections"]) {
    const lefts = rows.map((r) => r.row.left + r.fields[cls].left);
    expect(Math.max(...lefts) - Math.min(...lefts), `${cls} left edge ${lefts.join(", ")}`).toBeLessThanOrEqual(1);
  }
  await page.getByRole("button", { name: "Show project cards" }).click();
  expect(await wrapped(page, ".project-list--cards .project-row"), "wrapped card fields").toEqual([]);
});

test("window 800 px: no card date wraps, at the top level or inside a folder, and the columns have room", async ({ page }) => {
  await page.setViewportSize({ width: 800, height: 900 });
  await seed(page);
  await page.getByRole("button", { name: "Show project cards" }).click();
  await expect(page.locator(".project-list--cards")).toBeVisible();
  expect(await wrapped(page, ".project-list--cards .project-row"), "wrapped card fields").toEqual([]);
  const cards = await boxes(page, ".project-list--cards .project-row");
  for (const card of cards) {
    expect(card.row.width, "card width").toBeGreaterThanOrEqual(255);
    // The date column and the counts column are at least 8 px apart (room to read as two items).
    const f = card.fields;
    const gap = f["project-words"].left - (f["project-edited"].left + f["project-edited"].width);
    expect(gap, `gap between dates and counts ${gap}`).toBeGreaterThanOrEqual(8);
  }
});

test("window 800 px: a folder's cards do not wrap either", async ({ page }) => {
  await page.setViewportSize({ width: 800, height: 900 });
  await seed(page);
  await page.getByRole("button", { name: "New folder", exact: true }).click();
  const input = page.getByRole("textbox", { name: "Folder name" });
  await input.fill("Essays");
  await input.evaluate((el) => (el as HTMLInputElement).blur());
  await page.getByRole("button", { name: "Show project cards" }).click();
  const target = page.locator(".project-row").filter({ hasText: "Notes" }).locator(".row-label");
  await target.click({ button: "right" });
  await page.getByRole("menuitem", { name: "Move to folder…", exact: true }).click();
  await page.getByRole("menuitem", { name: "Essays", exact: true }).click();
  const inside = page.locator(".folder-body .project-list--cards .project-row");
  await expect(inside).toHaveCount(1);
  expect(await wrapped(page, ".folder-body .project-list--cards .project-row"), "wrapped folder card fields").toEqual([]);
  const box = (await inside.first().boundingBox())!;
  expect(box.width, "folder card width").toBeGreaterThanOrEqual(255);
});

test("cards: dates and counts fit inside the card at 680, 720, 800, 870, 1100 and 1440 px; 1440 fits three in a row", async ({ page }) => {
  await seed(page);
  await page.getByRole("button", { name: "Show project cards" }).click();
  for (const width of [680, 720, 800, 870, 1100, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.waitForTimeout(150);
    expect(await wrapped(page, ".project-list--cards .project-row"), `wrapped at ${width}`).toEqual([]);
    const clipped = await page.locator(".project-list--cards .project-row").evaluateAll((cards) =>
      cards.flatMap((card) => {
        const edge = card.getBoundingClientRect().right;
        return Array.from(card.querySelectorAll(".project-dates > span")).flatMap((el) => {
          const range = document.createRange();
          range.selectNodeContents(el);
          const r = range.getBoundingClientRect();
          return r.right > edge - 1 || r.width > el.getBoundingClientRect().width + 1 ? [el.textContent] : [];
        });
      }),
    );
    expect(clipped, `text clipped or outside the card at ${width}`).toEqual([]);
    if (width === 1440) {
      const tops = await page.locator(".project-list--cards .project-row").evaluateAll((els) => els.map((e) => e.getBoundingClientRect().top));
      expect(new Set(tops.map(Math.round)).size, `three cards share one row at 1440: ${tops}`).toBe(1);
    }
  }
});

test("cards: the longest counts, 999,999 words and 999 sections, fit their track and the card", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await seed(page);
  await page.getByRole("button", { name: "Show project cards" }).click();
  const out = await page.locator(".project-list--cards .project-row").first().evaluate((card) => {
    card.querySelector(".project-words")!.textContent = "999,999 words";
    card.querySelector(".project-sections")!.textContent = "999 sections";
    const edge = card.getBoundingClientRect().right;
    return ["project-words", "project-sections"].map((cls) => {
      const el = card.querySelector("." + cls)!;
      const range = document.createRange();
      range.selectNodeContents(el);
      return { cls, text: range.getBoundingClientRect().width, cell: el.getBoundingClientRect().width, spare: edge - range.getBoundingClientRect().right };
    });
  });
  for (const r of out) {
    expect(r.text, `${r.cls} text ${r.text} in cell ${r.cell}`).toBeLessThanOrEqual(r.cell + 0.5);
    expect(r.spare, `${r.cls} ends ${r.spare} px inside the card`).toBeGreaterThanOrEqual(1);
  }
});
