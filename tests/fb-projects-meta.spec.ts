import { test, expect, type Page } from "@playwright/test";

// FB1: the Projects page shows the same four meta fields in fixed columns, so nothing is
// pushed around by the length of a title, date or count. Rewritten for the outline (OB7): the
// card view and its two-line layout were removed; cells are `.outline-cell.col-<column>`.

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

const COLS = ["col-edited", "col-words", "col-sections", "col-added"];

const boxes = (page: Page, selector: string) =>
  page.locator(selector).evaluateAll((rows) => {
    return rows.map((row) => {
      const rowBox = row.getBoundingClientRect();
      const out: Record<string, { left: number; top: number; width: number; height: number }> = {};
      for (const el of Array.from(row.querySelectorAll(".outline-cell"))) {
        const box = el.getBoundingClientRect();
        const cls = Array.from(el.classList).find((c) => c.startsWith("col-")) ?? "";
        out[cls] = {
          left: box.left - rowBox.left,
          top: box.top - rowBox.top,
          width: box.width,
          height: box.height,
        };
      }
      return { row: { left: rowBox.left, top: rowBox.top, width: rowBox.width, height: rowBox.height }, fields: out };
    });
  });

test("the four fields sit in fixed columns on every row and no row wraps", async ({ page }) => {
  await page.setViewportSize({ width: 1100, height: 900 });
  await seed(page);
  await expect(page.locator(".outline")).toBeVisible();
  const rows = await boxes(page, ".outline .project-row");
  expect(rows).toHaveLength(3);

  for (const cls of COLS) {
    expect(rows.every((r) => r.fields[cls]), `${cls} rendered on every row`).toBe(true);
    const lefts = rows.map((r) => r.row.left + r.fields[cls].left);
    expect(Math.max(...lefts) - Math.min(...lefts), `${cls} left edge ${lefts.join(", ")}`).toBeLessThanOrEqual(1);
  }

  // Visual order left to right: Edited, words, sections, Added.
  const left = (cls: string) => rows[0].row.left + rows[0].fields[cls].left;
  expect(left("col-edited")).toBeLessThan(left("col-words"));
  expect(left("col-words")).toBeLessThan(left("col-sections"));
  expect(left("col-sections")).toBeLessThan(left("col-added"));

  // All four fields on one line: every row is the same height.
  const heights = rows.map((r) => r.row.height);
  expect(Math.max(...heights) - Math.min(...heights), `row heights ${heights.join(", ")}`).toBeLessThanOrEqual(1);

  // The text fits inside its own column, so no cell runs under its neighbour.
  const tooWide = await page.locator(".outline .outline-cell").evaluateAll((els) =>
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

// One line tall: a date or count that wraps is about twice the line height of its neighbours.
const wrapped = (page: Page, scope: string) =>
  page.locator(scope + " .outline-cell").evaluateAll((els) =>
    els
      .filter((el) => getComputedStyle(el).display !== "none")
      .map((el) => {
        const lineHeight = parseFloat(getComputedStyle(el).lineHeight) || 1.4 * parseFloat(getComputedStyle(el).fontSize);
        return { text: el.textContent ?? "", height: el.getBoundingClientRect().height, lineHeight };
      })
      .filter((r) => r.height > r.lineHeight * 1.5),
  );

test("narrow window (680 px): only Edited shows, no date wraps, every row is the same height, Edited shares one edge", async ({ page }) => {
  await page.setViewportSize({ width: 680, height: 900 });
  await seed(page);
  expect(await wrapped(page, ".outline .project-row"), "wrapped fields").toEqual([]);
  const rows = await boxes(page, ".outline .project-row");
  const heights = rows.map((r) => r.row.height);
  expect(Math.max(...heights) - Math.min(...heights), `row heights ${heights.join(", ")}`).toBeLessThanOrEqual(1);
  const lefts = rows.map((r) => r.row.left + r.fields["col-edited"].left);
  expect(Math.max(...lefts) - Math.min(...lefts), `Edited left edge ${lefts.join(", ")}`).toBeLessThanOrEqual(1);
  // Under 700 px the header and the Words, Sections and Added cells are hidden (Decision 11).
  expect(rows.every((r) => r.fields["col-words"].width === 0 && r.fields["col-added"].width === 0)).toBe(true);
});

test("dates and counts fit inside their cells and the row at 680, 720, 800, 870, 1100 and 1440 px, top level and in a folder", async ({ page }) => {
  await seed(page);
  await page.getByRole("button", { name: "New folder", exact: true }).click();
  const input = page.getByRole("textbox", { name: "Folder name" });
  await input.fill("Essays");
  await input.evaluate((el) => (el as HTMLInputElement).blur());
  const target = page.locator(".project-row").filter({ hasText: "Notes" }).locator(".row-label");
  await target.click({ button: "right" });
  await page.getByRole("menuitem", { name: "Move to folder…", exact: true }).click();
  await page.getByRole("menuitem", { name: "Essays", exact: true }).click();
  await expect(page.locator('.project-row[data-depth="1"]')).toHaveCount(1);
  for (const width of [680, 720, 800, 870, 1100, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.waitForTimeout(150);
    expect(await wrapped(page, ".outline .outline-row"), `wrapped at ${width}`).toEqual([]);
    const clipped = await page.locator(".outline .outline-row").evaluateAll((rows) =>
      rows.flatMap((row) => {
        const edge = row.getBoundingClientRect().right;
        return Array.from(row.querySelectorAll(".outline-cell")).flatMap((el) => {
          if (getComputedStyle(el).display === "none") return [];
          const range = document.createRange();
          range.selectNodeContents(el);
          const r = range.getBoundingClientRect();
          return r.right > edge - 1 || r.width > el.getBoundingClientRect().width + 1 ? [el.textContent] : [];
        });
      }),
    );
    expect(clipped, `text clipped or outside the row at ${width}`).toEqual([]);
  }
});

test("the longest counts, 999,999 words and 999 projects, fit their column and the row", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await seed(page);
  const out = await page.locator(".outline .project-row").first().evaluate((row) => {
    row.querySelector(".col-words")!.textContent = "999,999";
    row.querySelector(".col-sections")!.textContent = "999 projects";
    const edge = row.getBoundingClientRect().right;
    return ["col-words", "col-sections"].map((cls) => {
      const el = row.querySelector("." + cls)!;
      const range = document.createRange();
      range.selectNodeContents(el);
      return { cls, text: range.getBoundingClientRect().width, cell: el.getBoundingClientRect().width, spare: edge - range.getBoundingClientRect().right };
    });
  });
  for (const r of out) {
    expect(r.text, `${r.cls} text ${r.text} in cell ${r.cell}`).toBeLessThanOrEqual(r.cell + 0.5);
    expect(r.spare, `${r.cls} ends ${r.spare} px inside the row`).toBeGreaterThanOrEqual(1);
  }
});
