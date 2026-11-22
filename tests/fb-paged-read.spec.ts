import { expect, test, type Page } from "@playwright/test";

// FB12: Read and Bibliography draw real pages (white sheets, page breaks, page
// labels) with a "Page view" toggle, on by default, shared by both screens.

const SHOTS = "test-results/fb-FB12";

async function create(page: Page, title: string) {
  await page.goto("/");
  await page.getByRole("button", { name: "Start new project" }).click();
  await page.getByRole("button", { name: "Blank", exact: true }).click();
  await page.getByLabel("Project title").fill(title);
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByText("Saved", { exact: true })).toBeVisible();
}

const WORDS = ["alpha", "beta", "gamma", "delta", "evidence", "measure", "page", "ledger"];
const long = (seed: number) =>
  `P${seed} ` + Array.from({ length: 60 + (seed % 7) * 9 }, (_, j) => WORDS[(seed + j) % 8]).join(" ") + ".";

/** Three sections of long paragraphs (enough for three or more pages), sixty sources, page labels top right. */
async function seed(page: Page) {
  const texts = Array.from({ length: 60 }, (_, i) => long(i));
  await page.evaluate((texts) => {
    const key = Object.keys(localStorage).find((k) => k.startsWith("folio.preview.project."))!;
    const p = JSON.parse(localStorage.getItem(key)!);
    const base = p.entries.find((e: { kind: string }) => e.kind === "section");
    const section = (title: string, n: number, offset: number) => {
      const paragraphs = texts.slice(offset, offset + n);
      return {
        ...base,
        id: crypto.randomUUID(),
        title,
        content: { type: "doc", content: paragraphs.map((t) => ({ type: "paragraph", content: [{ type: "text", text: t }] })) },
        text: paragraphs.join("\n"),
      };
    };
    p.entries = [section("Opening", 9, 0), section("Middle", 9, 20), section("Ending", 9, 40)];
    p.order = p.entries.map((e: { id: string }) => e.id);
    p.documentSettings = {
      ...(p.documentSettings ?? {}),
      pageNumbers: true,
      pageNumberPosition: "top-right",
      pageHeaderText: "Halloway",
      bibliographyScope: "all",
    };
    p.research = {
      sources: Array.from({ length: 60 }, (_, i) => ({
        id: "s" + i,
        kind: "book",
        title: `Lamps and Ledgers volume ${i + 1}: an account of measures, harbours and the long evidence of the page`,
        authors: [`Marguerite Halloway${String.fromCharCode(65 + (i % 26))}`],
        publisher: "Harbor Street Press",
        year: String(1950 + i),
      })),
      notes: [],
      footnotes: [],
      autoShortNotes: true,
    };
    localStorage.setItem(key, JSON.stringify(p));
    localStorage.setItem("folio.lastProject", p.id);
    localStorage.setItem("personal-word.restoreTabs", "true");
    localStorage.setItem("personal-word.prose-check", "false");
  }, texts);
  await page.reload();
}

/**
 * Every text line inside `root`'s writing surface lies inside one sheet's
 * content box (between its top and bottom margins). Returns the offenders.
 */
async function linesCrossing(page: Page, root: string) {
  return page.evaluate((rootSelector) => {
    const scope = document.querySelector(rootSelector)!;
    const paper = scope.querySelector<HTMLElement>(".editor-paper")!;
    const surface = scope.querySelector<HTMLElement>(".writing-surface")!;
    const style = getComputedStyle(paper);
    const pageHeight = parseFloat(style.getPropertyValue("--page-height"));
    const margin = parseFloat(style.getPropertyValue("--page-margin"));
    const sheets = [...scope.querySelectorAll(".page-sheet")].map((s) => s.getBoundingClientRect());
    const scale = sheets[0].height / pageHeight;
    const boxes = sheets.map((s) => ({ top: s.top + margin * scale, bottom: s.bottom - margin * scale }));
    const bad: string[] = [];
    const walker = document.createTreeWalker(surface, NodeFilter.SHOW_TEXT);
    const range = document.createRange();
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      range.selectNodeContents(node);
      for (const r of range.getClientRects()) {
        if (r.height <= 0 || r.width <= 0) continue;
        if (!boxes.some((b) => r.top >= b.top - 1 && r.bottom <= b.bottom + 1))
          bad.push(`${(node.textContent ?? "").slice(0, 24)} @ ${Math.round(r.top)}-${Math.round(r.bottom)}`);
      }
    }
    return { bad, sheets: sheets.length, scale };
  }, root);
}

/** Scrolls `root` so the gap between sheets 1 and 2 sits mid-view, then saves a screenshot. */
async function shotAtBreak(page: Page, root: string, path: string) {
  await page.locator(root).evaluate((el) => {
    const second = el.querySelectorAll(".page-sheet")[1]!.getBoundingClientRect();
    el.scrollTop += second.top - el.getBoundingClientRect().top - el.clientHeight / 2;
  });
  await page.locator(root).screenshot({ path });
}

const openRead = (page: Page) => page.getByRole("button", { name: "Read manuscript", exact: true }).click();

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
});

test("Read shows real pages with labels; the Page view toggle returns the continuous look and persists; font size repaginates", async ({ page }) => {
  await create(page, "Paged read");
  await seed(page);
  await openRead(page);
  const read = page.locator(".manuscript-read");
  const toggle = read.getByRole("button", { name: "Page view", exact: true });
  await expect(toggle).toHaveAttribute("aria-pressed", "true");
  await expect(read.locator(".eyebrow")).toHaveText("MANUSCRIPT -- READ ONLY");
  await expect.poll(async () => read.locator(".page-sheet").count()).toBeGreaterThanOrEqual(3);
  // The toolbar stays outside the sheet; the section anchors survive on the title blocks.
  await expect(read.locator(".editor-paper [aria-label='Reading display']")).toHaveCount(0);
  await expect(read.locator(".writing-surface > [id^='read-']")).toHaveCount(3);

  const first = await linesCrossing(page, ".manuscript-read");
  expect(first.bad).toEqual([]);
  expect(first.scale).toBeCloseTo(1, 2);
  // At least one paragraph is split between lines (a spacer inside it), not only moved whole.
  expect(await read.locator(".writing-surface > p .page-spacer[data-static]").count()).toBeGreaterThan(0);
  const sheets = first.sheets;
  await expect(read.locator(".page-label")).toHaveText(
    Array.from({ length: sheets }, (_, i) => `Halloway ${i + 1}`),
  );
  await page.emulateMedia({ colorScheme: "light" });
  await read.screenshot({ path: `${SHOTS}/read-light.png` });
  await page.emulateMedia({ colorScheme: "dark" });
  await read.screenshot({ path: `${SHOTS}/read-dark.png` });
  await shotAtBreak(page, ".manuscript-read", `${SHOTS}/read-break-dark.png`);
  await page.emulateMedia({ colorScheme: "light" });

  // Bigger reading type: more pages, still no line across a page end.
  await read.getByLabel("Reading font size").fill("26");
  await expect.poll(async () => read.locator(".page-sheet").count()).toBeGreaterThan(sheets);
  expect((await linesCrossing(page, ".manuscript-read")).bad).toEqual([]);

  // A narrow window scales the sheet down; lines still stay on their pages.
  await page.setViewportSize({ width: 900, height: 900 });
  await expect
    .poll(async () => (await linesCrossing(page, ".manuscript-read")).scale)
    .toBeLessThan(0.99);
  expect((await linesCrossing(page, ".manuscript-read")).bad).toEqual([]);
  await page.setViewportSize({ width: 1440, height: 900 });

  // Off: today's continuous markup, and the choice survives a reload.
  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-pressed", "false");
  await expect(read.locator(".page-sheet")).toHaveCount(0);
  await expect(read.locator("section[id^='read-'] .read-prose")).toHaveCount(3);
  await expect(read.locator(".eyebrow")).toHaveText("CONTINUOUS MANUSCRIPT -- READ ONLY");
  await page.reload();
  await openRead(page);
  await expect(page.locator(".manuscript-read").getByRole("button", { name: "Page view", exact: true })).toHaveAttribute("aria-pressed", "false");
  await expect(page.locator(".manuscript-read .page-sheet")).toHaveCount(0);
});

test("Bibliography shows real pages with no entry across a page end, and shares the Page view choice", async ({ page }) => {
  await create(page, "Paged bibliography");
  await seed(page);
  await page
    .locator(`.sidebar-group[data-group="research"] .entry-row`)
    .filter({ has: page.locator(".entry-main").filter({ hasText: "Bibliography" }) })
    .first()
    .locator(".entry-main")
    .click();
  const bib = page.getByRole("region", { name: "Bibliography" });
  const toggle = bib.getByRole("button", { name: "Page view", exact: true });
  await expect(toggle).toHaveAttribute("aria-pressed", "true");
  await expect.poll(async () => bib.locator(".page-sheet").count()).toBeGreaterThanOrEqual(2);
  await expect(bib.locator(".editor-paper .bibliography-controls")).toHaveCount(0);
  const result = await linesCrossing(page, ".bibliography-page");
  expect(result.bad).toEqual([]);
  await page.emulateMedia({ colorScheme: "light" });
  await bib.screenshot({ path: `${SHOTS}/bibliography-light.png` });
  await shotAtBreak(page, ".bibliography-page", `${SHOTS}/bibliography-break-light.png`);
  await page.emulateMedia({ colorScheme: "dark" });
  await bib.screenshot({ path: `${SHOTS}/bibliography-dark.png` });
  await page.emulateMedia({ colorScheme: "light" });

  await toggle.click();
  await expect(bib.locator(".page-sheet")).toHaveCount(0);
  await expect(bib.locator(".bibliography-entries p")).toHaveCount(60);
  // One preference drives both screens.
  await openRead(page);
  await expect(page.locator(".manuscript-read").getByRole("button", { name: "Page view", exact: true })).toHaveAttribute("aria-pressed", "false");
});
