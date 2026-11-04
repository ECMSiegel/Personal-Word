import { test, expect, type Locator, type Page } from "@playwright/test";

// UI wave 4 R1: scrollspy line column in the sidebar's Manuscript rows
// (docs/agent-work/2026-10-28-ui-wave-4/PLAN.md, R1 and Approach item 8).

const SECTIONS = ["Alpha part", "Beta part", "Gamma part", "Delta part"];

async function createProject(page: Page, title: string) {
  await page.goto("/");
  await page.getByRole("button", { name: "Start new project" }).click();
  await page.getByRole("button", { name: "Blank", exact: true }).click();
  await page.getByLabel("Project title").fill(title);
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByRole("textbox", { name: "Writing editor" })).toBeVisible();
}

async function addSection(page: Page, title: string, words = 0) {
  // Group actions show on heading hover (at narrow widths they take no pointer until then).
  await page.locator('.sidebar-group[data-group="manuscript"] .group-heading').hover();
  await page.getByRole("button", { name: "New section", exact: true }).click();
  await page.getByLabel("Title", { exact: true }).fill(title);
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  if (words) {
    await row(page, title).locator(".entry-main").click();
    await page
      .getByRole("textbox", { name: "Writing editor" })
      .first()
      .fill(Array.from({ length: words / 10 }, (_, i) => `${title} line ${i} has some ordinary words in it.`).join("\n"));
  }
}

async function seed(page: Page, title: string, words = 0) {
  await createProject(page, title);
  for (const name of SECTIONS) await addSection(page, name, words);
  await expect(page.locator(".save-status")).toHaveText("Saved", { timeout: 10_000 });
}

const row = (page: Page, title: string) =>
  page.locator('.sidebar-group[data-group="manuscript"] .entry-row').filter({
    has: page.locator(".entry-main").filter({ hasText: new RegExp("^" + title) }),
  });
// Wave 6 T7b: one rail of lines per group (not one line per row); a line's name is its item title.
const railLine = (page: Page, group: string, title: string) =>
  page.locator(`.sidebar-group[data-group="${group}"] .spy-rail > button.spy-line[aria-label="Go to ${title}"]`);
const line = (page: Page, title: string) => railLine(page, "manuscript", title);
const matrix = (l: Locator, pseudo?: string) =>
  l.evaluate((el, p) => {
    const m = /matrix\(([^)]+)\)/.exec(getComputedStyle(el, p).transform);
    const v = m ? m[1].split(",").map(Number) : [1, 0, 0, 1];
    return { x: v[0], y: v[3] };
  }, pseudo ?? null);
const scaleX = async (l: Locator) => (await matrix(l)).x;
const scaleY = async (l: Locator) => (await matrix(l)).y;
/** The muted progress remainder drawn by the active line's ::after (1 = nothing read yet). */
const remainder = async (l: Locator) => (await matrix(l, "::after")).x;
const states = (page: Page) =>
  Promise.all(SECTIONS.map((s) => line(page, s).getAttribute("data-state")));

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
});

test("(a) Read mode: the line follows the reading position; a line click eases there; Reduce Motion is instant", async ({ page }) => {
  await seed(page, "Spy read", 600);
  await page.locator(".group-title").filter({ hasText: /^Read manuscript$/ }).click();
  const scroller = page.locator(".manuscript-read");
  await expect(scroller).toBeVisible();
  const targetTop = (title: string) =>
    page.evaluate((t) => {
      const sc = document.querySelector(".manuscript-read")!;
      const sec = [...sc.querySelectorAll("section[id^='read-']")].find((s) =>
        s.textContent?.includes(t + " line 0"),
      )!;
      return sec.getBoundingClientRect().top - sc.getBoundingClientRect().top;
    }, title);

  // Scroll so Gamma's top sits just under the top of the view.
  const gamma = await targetTop("Gamma part");
  await scroller.evaluate((el, by) => (el.scrollTop += by - 40), gamma);
  await expect(line(page, "Gamma part")).toHaveAttribute("data-state", "active");
  expect((await states(page)).filter((s) => s === "active")).toHaveLength(1);
  await expect(line(page, "Gamma part")).toHaveCSS("background-color", "rgb(0, 105, 217)");

  // Pointer click on Beta's line: an eased scroll (intermediate values) that stops 100 px above it.
  const samples = page.evaluate(
    () =>
      new Promise<number[]>((resolve) => {
        const sc = document.querySelector(".manuscript-read") as HTMLElement;
        const out: number[] = [];
        const start = performance.now();
        const tick = () => {
          out.push(sc.scrollTop);
          if (performance.now() - start < 1000) requestAnimationFrame(tick);
          else resolve(out);
        };
        requestAnimationFrame(tick);
      }),
  );
  await line(page, "Beta part").click();
  const seen = await samples;
  const first = seen[0];
  const last = seen.at(-1)!;
  expect(last).toBeLessThan(first);
  expect(seen.some((v) => v < first - 5 && v > last + 5), "intermediate scroll positions").toBe(true);
  expect(Math.abs((await targetTop("Beta part")) - 100)).toBeLessThanOrEqual(4);
  await expect(line(page, "Beta part")).toHaveAttribute("data-state", "active");

  // Reduce Motion: the jump lands at once.
  await page.emulateMedia({ reducedMotion: "reduce" });
  await line(page, "Delta part").click();
  const delta = await targetTop("Delta part");
  const atBottom = await scroller.evaluate((el) => el.scrollTop + el.clientHeight >= el.scrollHeight - 1);
  expect(atBottom || Math.abs(delta - 100) <= 4, `Delta top ${delta}`).toBe(true);
  await expect(line(page, "Delta part")).toHaveAttribute("data-state", "active");
});

test("(b) Write mode: the open section's line is active; a section open beside is half-expanded", async ({ page }) => {
  await seed(page, "Spy write");
  await row(page, "Beta part").locator(".entry-main").click();
  await expect(line(page, "Beta part")).toHaveAttribute("data-state", "active");
  await expect(line(page, "Alpha part")).toHaveAttribute("data-state", "idle");
  await page.mouse.move(900, 500);
  await expect.poll(() => scaleX(line(page, "Beta part"))).toBeCloseTo(1, 2);
  await expect.poll(() => scaleX(line(page, "Alpha part"))).toBeCloseTo(0.375, 2);

  await row(page, "Gamma part").locator(".entry-main").click({ modifiers: ["ControlOrMeta"] });
  await expect(page.locator(".split-pane")).toHaveCount(2);
  // The focused pane's section is active, the other pane's is half-expanded.
  await page.locator('.split-pane[data-side="left"] .ProseMirror').click();
  await expect(line(page, "Beta part")).toHaveAttribute("data-state", "active");
  await expect(line(page, "Gamma part")).toHaveAttribute("data-state", "open");
  await page.mouse.move(900, 500);
  await expect.poll(() => scaleX(line(page, "Gamma part"))).toBeCloseTo(0.75, 2);
  await page.locator('.split-pane[data-side="right"] .ProseMirror').click();
  await expect(line(page, "Gamma part")).toHaveAttribute("data-state", "active");
  await expect(line(page, "Beta part")).toHaveAttribute("data-state", "open");

  // Clicking a line in Write mode does what its row does: opens that section.
  await line(page, "Delta part").click();
  await expect(line(page, "Delta part")).toHaveAttribute("data-state", "active");
});

test("(c) hover or keyboard focus on a row expands its line; the keyboard change is not animated", async ({ page }) => {
  await seed(page, "Spy hover");
  await row(page, "Alpha part").locator(".entry-main").click();
  await page.mouse.move(900, 500);
  await expect.poll(() => scaleX(line(page, "Gamma part"))).toBeCloseTo(0.375, 2);
  // Wave 5 A3 (T7b: the pointer on the line itself): magnifies it to full length, twice as thick.
  await line(page, "Gamma part").hover();
  await expect.poll(() => scaleX(line(page, "Gamma part"))).toBeCloseTo(1, 2);
  await expect.poll(() => scaleY(line(page, "Gamma part"))).toBeCloseTo(2, 2);
  await page.mouse.move(900, 500);
  await expect.poll(() => scaleX(line(page, "Gamma part"))).toBeCloseTo(0.375, 2);
  // Keyboard: Tab from the row before reaches Gamma's row button (the accessible path).
  await row(page, "Beta part").locator(".entry-main").focus();
  for (let i = 0; i < 6; i++) {
    await page.keyboard.press("Tab");
    if (await row(page, "Gamma part").locator(".entry-main").evaluate((el) => el === document.activeElement)) break;
  }
  await expect(row(page, "Gamma part").locator(".entry-main")).toBeFocused();
  await expect(line(page, "Gamma part")).toHaveCSS("transition-duration", "0s");
  expect(await scaleX(line(page, "Gamma part"))).toBeCloseTo(1, 2);
  // T7b: the line is a real button named by the item title (a Tab stop, not hidden).
  await expect(line(page, "Gamma part")).not.toHaveAttribute("tabindex", "-1");
  await expect(line(page, "Gamma part")).not.toHaveAttribute("aria-hidden", "true");
  await expect(page.getByRole("button", { name: "Go to Gamma part", exact: true })).toBeVisible();
  // Enter on the focused row opens the section; its line becomes active.
  await page.keyboard.press("Enter");
  await expect(line(page, "Gamma part")).toHaveAttribute("data-state", "active");
  // The line carries no text-emphasis stroke or scale of its own.
  await line(page, "Alpha part").hover();
  expect(await line(page, "Alpha part").evaluate((el) => parseFloat(getComputedStyle(el).webkitTextStrokeWidth) || 0)).toBe(0);
});

test("(d) the lines hide with a hover-reveal sidebar", async ({ page }) => {
  await seed(page, "Spy hidden");
  await page.getByRole("button", { name: "Unpin sidebar" }).click();
  await page.mouse.move(900, 500);
  await expect(page.locator(".sidebar-shell")).not.toHaveClass(/is-revealed/);
  // The sidebar slides out over --duration-base; wait for it to finish.
  await expect
    .poll(() =>
      line(page, "Alpha part").evaluate((el) => {
        const r = el.getBoundingClientRect();
        return getComputedStyle(el).visibility === "hidden" || r.right <= 0;
      }),
    )
    .toBe(true);
  await page.mouse.move(3, 400);
  await expect(page.locator(".sidebar-shell")).toHaveClass(/is-revealed/);
  await expect(line(page, "Alpha part")).toBeVisible();
});

test("(e, f) a dragged row keeps the rail in row order; collapsing Manuscript removes the rail", async ({ page }) => {
  await seed(page, "Spy drag");
  const rows = page.locator('.sidebar-group[data-group="manuscript"] .entry-row');
  await rows.nth(1).dragTo(rows.nth(3), { sourcePosition: { x: 6, y: 6 } });
  const names = await rows.locator(".entry-main span").allTextContents();
  const labels = await page.locator('.sidebar-group[data-group="manuscript"] .spy-rail > .spy-line').evaluateAll((els) => els.map((e) => (e.getAttribute("aria-label") ?? "").replace(/^Go to /, "")));
  expect(labels).toEqual(names);
  await page.getByRole("button", { name: "Hide Manuscript", exact: true }).click();
  await expect(page.locator('[data-group="manuscript"] .spy-line')).toHaveCount(0);
});

test("(g) at the 190 px sidebar the heading and titles stay readable (labels fit or ellipsize)", async ({ page }) => {
  await page.addInitScript(() =>
    localStorage.setItem("folio.workspace.sidebar", JSON.stringify({ width: 190, pinned: true, hover: true })),
  );
  await seed(page, "Spy narrow");
  await page.mouse.move(900, 500);
  const heading = page.locator('.sidebar-group[data-group="manuscript"] .group-label');
  expect(
    await heading.evaluate((el) => {
      const cs = getComputedStyle(el);
      return el.scrollWidth <= el.clientWidth || (cs.textOverflow === "ellipsis" && cs.whiteSpace === "nowrap");
    }),
    "heading label fits or ellipsizes",
  ).toBe(true);
  for (const name of SECTIONS) {
    const r = row(page, name);
    const fits = await r.locator(".entry-main span").evaluate((span) => {
      const node = span.firstChild!;
      const range = document.createRange();
      range.setStart(node, 0);
      const whole = document.createRange();
      whole.selectNodeContents(span);
      const sb = span.getBoundingClientRect();
      if (whole.getBoundingClientRect().width <= sb.width + 0.01) return true;
      // T6: titles ellipsize before the count shrinks; the first 6 characters must stay visible.
      range.setEnd(node, Math.min(6, node.textContent!.length));
      return getComputedStyle(span).textOverflow === "ellipsis" && range.getBoundingClientRect().right <= sb.right + 0.5;
    });
    expect(fits, name + " title fits, or ellipsizes with its first 6 characters visible").toBe(true);
    const gap = await line(page, name).evaluate((l) => {
      const sidebar = document.querySelector(".sidebar")!.getBoundingClientRect();
      return { inside: l.getBoundingClientRect().right <= sidebar.right };
    });
    expect(gap.inside, name + " line inside the sidebar").toBe(true);
  }
});

test("(h) cards view draws no lines and no gutter", async ({ page }) => {
  await seed(page, "Spy cards");
  await page.locator('.sidebar-group[data-group="manuscript"] .group-heading').hover();
  await page.getByRole("button", { name: "Show Manuscript cards" }).click();
  await expect(page.locator('[data-group="manuscript"] .spy-line')).toHaveCount(0);
  await expect(page.locator('.sidebar-group[data-group="manuscript"] .entry-list')).toHaveCSS("padding-right", "0px");
  await page.getByRole("button", { name: "Show Manuscript list" }).click();
  await expect(page.locator('[data-group="manuscript"] .spy-line')).toHaveCount(SECTIONS.length + 1);
  await expect(page.locator('.sidebar-group[data-group="manuscript"] .entry-list')).toHaveCSS("padding-right", "14px");
});

for (const palette of ["plain", "color"] as const)
  for (const scheme of ["light", "dark"] as const)
    test(`screens: ${palette} ${scheme}, single, split and Read`, async ({ page }, testInfo) => {
      await page.addInitScript((p) => {
        if (p === "color")
          localStorage.setItem(
            "folio.workspace.appearance",
            JSON.stringify({ theme: "system", palette: "color", sections: { manuscript: "blue", fragments: "green", research: "orange" } }),
          );
      }, palette);
      await page.emulateMedia({ colorScheme: scheme });
      await seed(page, `Spy ${palette} ${scheme}`, 300);
      await row(page, "Beta part").locator(".entry-main").click();
      await page.mouse.move(900, 500);
      await expect.poll(() => scaleX(line(page, "Beta part"))).toBeCloseTo(1, 2);
      const accent = await page.locator(".sidebar").evaluate((el) => {
        const probe = document.createElement("span");
        probe.style.color = "var(--accent)";
        el.appendChild(probe);
        const c = getComputedStyle(probe).color;
        probe.remove();
        return c;
      });
      await expect(line(page, "Beta part")).toHaveCSS("background-color", accent);
      await page.locator(".sidebar").screenshot({ path: testInfo.outputPath(`spy-${palette}-${scheme}-single.png`) });
      await row(page, "Delta part").locator(".entry-main").click({ modifiers: ["ControlOrMeta"] });
      await expect(page.locator(".split-pane")).toHaveCount(2);
      await page.mouse.move(900, 500);
      await page.locator(".sidebar").screenshot({ path: testInfo.outputPath(`spy-${palette}-${scheme}-split.png`) });
      await page.getByRole("button", { name: "Close right pane" }).click();
      await page.locator(".group-title").filter({ hasText: /^Read manuscript$/ }).click();
      await page.locator(".manuscript-read").evaluate((el) => (el.scrollTop = el.scrollHeight / 2));
      await expect(page.locator('.spy-line[data-state="active"]')).toHaveCount(1);
      await page.mouse.move(900, 500);
      await page.screenshot({ path: testInfo.outputPath(`spy-${palette}-${scheme}-read.png`) });
    });

// ---- Wave 5 A3 (docs/agent-work/2026-11-01-ui-wave-5/PLAN.md): lines on every row of
// Manuscript, Fragments and Research; proximity magnify; scroll progress on the active line.

/** The cosine falloff the sidebar uses (spyMagnify, radius 84 px): 1 at 0, 0 at the radius. */
const RADIUS = 36; // T7b: the rail pitch is 12 px, so the falloff is 3 lines, not 84 px
const mag = (dy: number) => (Math.abs(dy) >= RADIUS ? 0 : 0.5 + 0.5 * Math.cos((Math.PI * Math.abs(dy)) / RADIUS));
const centreY = async (l: Locator) => {
  const b = (await l.boundingBox())!;
  return b.y + b.height / 2;
};
const groupRows = (page: Page, group: string) => page.locator(`.sidebar-group[data-group="${group}"] .entry-row`);
const groupRow = (page: Page, group: string, text: string) =>
  groupRows(page, group).filter({ has: page.locator(".entry-main").filter({ hasText: text }) }).first();

const pdfBytes = Buffer.from("%PDF-1.4\n1 0 obj << /Type /Catalog >> endobj\n%%EOF\n", "ascii");

async function addFragment(page: Page, title: string, words = 0) {
  await page.locator('.sidebar-group[data-group="fragments"] .group-heading').hover();
  await page.getByRole("button", { name: "New fragment", exact: true }).click();
  await page.getByLabel("Title", { exact: true }).fill(title);
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(groupRow(page, "fragments", title)).toBeVisible();
  if (words) {
    await groupRow(page, "fragments", title).locator(".entry-main").click();
    await page
      .getByRole("textbox", { name: "Writing editor" })
      .first()
      .fill(Array.from({ length: words / 10 }, (_, i) => `${title} line ${i} has some ordinary words in it.`).join("\n"));
  }
}

/** One source with a PDF and one note, made through the Research panel. */
async function seedResearch(page: Page) {
  await page.locator(".group-title").filter({ hasText: /^Research$/ }).click();
  await expect(page.locator(".research-panel")).toBeVisible();
  await page.getByLabel("Zotero CSL JSON file").setInputFiles({
    name: "sources.json",
    mimeType: "application/json",
    buffer: Buffer.from(
      JSON.stringify([{ type: "book", title: "Alpha source", author: [{ given: "Ann", family: "Ames" }], issued: { "date-parts": [[2020]] } }]),
    ),
  });
  await page.getByRole("button", { name: "Add sources", exact: true }).click();
  const alpha = page.locator(".source-item").filter({ hasText: "Alpha source" });
  const toggle = alpha.locator(".source-toggle");
  if ((await toggle.getAttribute("aria-expanded")) !== "true") await toggle.click();
  await alpha.locator('.source-pdf-field input[type="file"]').setInputFiles({ name: "alpha.pdf", mimeType: "application/pdf", buffer: pdfBytes });
  await page.locator(".research-tabs").getByRole("button", { name: "Notes", exact: true }).click();
  await page.getByRole("button", { name: "Add note", exact: true }).click();
  await page.locator(".note-item textarea").last().fill("Note one");
  // Bibliography, Alpha, its PDF, Note one.
  await expect(groupRows(page, "research")).toHaveCount(4);
  await expect(page.locator(".save-status")).toHaveText("Saved", { timeout: 10_000 });
}

test("(i) Fragments and Research rows have lines with idle/open/active states and a 14 px gutter", async ({ page }) => {
  await createProject(page, "Spy groups");
  await addFragment(page, "Frag one");
  await addFragment(page, "Frag two");
  await seedResearch(page);
  for (const group of ["fragments", "research"]) {
    const rows = groupRows(page, group);
    const n = await rows.count();
    expect(n, group + " rows").toBeGreaterThan(1);
    await expect(page.locator(`.sidebar-group[data-group="${group}"] .spy-rail > button.spy-line`), `${group} lines`).toHaveCount(n);
    await expect(page.locator(`.sidebar-group[data-group="${group}"] .entry-list`)).toHaveCSS("padding-right", "14px");
  }
  const fragLine = (t: string) => railLine(page, "fragments", t);
  const resLine = (t: string) => railLine(page, "research", t === "Alpha source" ? "Ames -- Alpha source (2020)" : t);

  // A fragment open in Write mode: its line is active, the other idle.
  await groupRow(page, "fragments", "Frag one").locator(".entry-main").click();
  await expect(fragLine("Frag one")).toHaveAttribute("data-state", "active");
  await expect(fragLine("Frag two")).toHaveAttribute("data-state", "idle");
  // Open beside: the other pane's fragment is half-expanded.
  await groupRow(page, "fragments", "Frag two").locator(".entry-main").click({ modifiers: ["ControlOrMeta"] });
  await expect(page.locator(".split-pane")).toHaveCount(2);
  await page.locator('.split-pane[data-side="left"] .ProseMirror').click();
  await expect(fragLine("Frag two")).toHaveAttribute("data-state", "open");
  await page.mouse.move(900, 500);
  await expect.poll(() => scaleX(fragLine("Frag two"))).toBeCloseTo(0.75, 2);
  await page.getByRole("button", { name: "Close right pane" }).click();

  // Research: Bibliography's line is active on the Bibliography page; a source's when it is open.
  await groupRow(page, "research", "Bibliography").locator(".entry-main").click();
  await expect(resLine("Bibliography")).toHaveAttribute("data-state", "active");
  await expect(fragLine("Frag one")).toHaveAttribute("data-state", "idle");
  await groupRow(page, "research", "Alpha source").locator(".entry-main").click();
  await expect(resLine("Alpha source")).toHaveAttribute("data-state", "active");
  await expect(resLine("Bibliography")).toHaveAttribute("data-state", "idle");
  await page.mouse.move(900, 500);
  await expect.poll(() => scaleX(resLine("Alpha source"))).toBeCloseTo(1, 2);
  // Research rows have no progress: the active line is plain accent, no remainder drawn.
  expect(await resLine("Alpha source").evaluate((el) => getComputedStyle(el, "::after").backgroundColor)).toMatch(/rgba\(0, 0, 0, 0\)|transparent/);
  // A line click does what its row does: the note's line opens the Notes tab.
  await resLine("Note one").click();
  await expect(page.locator(".research-tabs").getByRole("button", { name: "Notes", exact: true })).toHaveAttribute("aria-pressed", "true");
  // A press on a research line never starts a drag.
  await expect(page.locator("[data-drag-state]")).toHaveCount(0);
});

test("(j) lines grow toward the pointer with a cosine falloff; keyboard focus magnifies at once", async ({ page }) => {
  await seed(page, "Spy magnify");
  await row(page, "Alpha part").locator(".entry-main").click();
  await page.mouse.move(900, 500);
  for (const s of SECTIONS.slice(1)) await expect.poll(() => scaleX(line(page, s))).toBeCloseTo(0.375, 2);

  // Pointer on Gamma's line height, over the row: Gamma peaks, neighbours fall off with distance.
  const x = ((await line(page, "Gamma part").boundingBox())!).x + 4;
  const yG = await centreY(line(page, "Gamma part"));
  await page.mouse.move(x, yG - 6);
  await page.mouse.move(x, yG, { steps: 2 });
  await expect.poll(() => scaleX(line(page, "Gamma part"))).toBeCloseTo(1, 2);
  await expect.poll(() => scaleY(line(page, "Gamma part"))).toBeCloseTo(2, 2);
  const dD = (await centreY(line(page, "Delta part"))) - yG;
  const dB = (await centreY(line(page, "Beta part"))) - yG;
  const dA = (await centreY(line(page, "Alpha part"))) - yG;
  expect(mag(dD), "one line away is partly magnified").toBeGreaterThan(0.2);
  expect(mag(dA), "three lines away is not magnified").toBeLessThan(mag(dB));
  await expect.poll(() => scaleX(line(page, "Delta part"))).toBeCloseTo(0.375 + mag(dD) * 0.625, 2);
  await expect.poll(() => scaleY(line(page, "Delta part"))).toBeCloseTo(1 + mag(dD), 2);
  await expect.poll(() => scaleY(line(page, "Beta part"))).toBeCloseTo(1 + mag(dB), 2);
  // The active line keeps full length and only thickens.
  await expect.poll(() => scaleX(line(page, "Alpha part"))).toBeCloseTo(1, 2);
  await expect.poll(() => scaleY(line(page, "Alpha part"))).toBeCloseTo(1 + mag(dA), 2);

  // Pointer exactly between Beta and Gamma: both lines grow by the same amount.
  const mid = ((await centreY(line(page, "Beta part"))) + yG) / 2;
  await page.mouse.move(x, mid, { steps: 2 });
  await expect.poll(async () => Math.abs((await scaleY(line(page, "Beta part"))) - (await scaleY(line(page, "Gamma part"))))).toBeLessThan(0.01);
  expect(await scaleY(line(page, "Beta part"))).toBeGreaterThan(1.3);

  // Leaving the list drops every magnification.
  await page.mouse.move(900, 500);
  await expect.poll(() => scaleY(line(page, "Gamma part"))).toBeCloseTo(1, 2);
  await expect.poll(() => scaleX(line(page, "Gamma part"))).toBeCloseTo(0.375, 2);

  // Keyboard: Tab onto Beta's row -> 1 on Beta, 0.5 on its neighbours, 0.2 two rows away, all instant.
  await row(page, "Alpha part").locator(".entry-main").focus();
  for (let i = 0; i < 6; i++) {
    await page.keyboard.press("Tab");
    if (await row(page, "Beta part").locator(".entry-main").evaluate((el) => el === document.activeElement)) break;
  }
  await expect(row(page, "Beta part").locator(".entry-main")).toBeFocused();
  for (const s of SECTIONS) await expect(line(page, s)).toHaveCSS("transition-duration", "0s");
  expect(await scaleY(line(page, "Beta part"))).toBeCloseTo(2, 2);
  expect(await scaleY(line(page, "Alpha part"))).toBeCloseTo(1.5, 2);
  expect(await scaleY(line(page, "Gamma part"))).toBeCloseTo(1.5, 2);
  expect(await scaleY(line(page, "Delta part"))).toBeCloseTo(1.2, 2);
  expect(await scaleX(line(page, "Gamma part"))).toBeCloseTo(0.375 + 0.5 * 0.625, 2);
});

/** The editor's scroll container for the focused pane (measured: .writer-scroll in every mode). */
const writeScroller = (page: Page) => page.locator('.split-pane[data-side="left"] .writer-scroll');
const scrollTo = (page: Page, where: "top" | "middle" | "bottom") =>
  writeScroller(page).evaluate((el, w) => {
    const max = el.scrollHeight - el.clientHeight;
    el.scrollTop = w === "top" ? 0 : w === "middle" ? max / 2 : max;
  }, where);

test("(k) Write mode: the active line fills as the open section or fragment scrolls (continuous and page view)", async ({ page }) => {
  await seed(page, "Spy progress write", 600);
  await row(page, "Beta part").locator(".entry-main").click();
  await page.mouse.move(900, 500);
  expect(await writeScroller(page).evaluate((el) => el.scrollHeight > el.clientHeight * 2)).toBe(true);
  await scrollTo(page, "top");
  await expect.poll(() => remainder(line(page, "Beta part"))).toBeCloseTo(1, 2);
  await scrollTo(page, "middle");
  await expect.poll(() => remainder(line(page, "Beta part"))).toBeCloseTo(0.5, 1);
  await scrollTo(page, "bottom");
  await expect.poll(() => remainder(line(page, "Beta part"))).toBeCloseTo(0, 2);
  // The remainder is muted, the line itself stays accent; idle lines draw no remainder.
  await expect(line(page, "Beta part")).toHaveCSS("background-color", "rgb(0, 105, 217)");
  expect(await line(page, "Alpha part").evaluate((el) => getComputedStyle(el, "::after").backgroundColor)).toMatch(/rgba\(0, 0, 0, 0\)|transparent/);
  await page.locator(".sidebar").screenshot({ path: test.info().outputPath("spy-progress-write-bottom.png") });
  await scrollTo(page, "middle");
  await page.locator(".sidebar").screenshot({ path: test.info().outputPath("spy-progress-write-middle.png") });

  // Page view: the same scroller, the same fill.
  const pageView = page.getByRole("button", { name: "Page view", exact: true });
  if (!(await pageView.count())) await page.getByRole("button", { name: "More formatting" }).click();
  await pageView.first().click();
  await expect(page.locator(".editor-viewport")).toHaveClass(/is-paged/);
  await scrollTo(page, "top");
  await expect.poll(() => remainder(line(page, "Beta part"))).toBeCloseTo(1, 2);
  await scrollTo(page, "bottom");
  await expect.poll(() => remainder(line(page, "Beta part"))).toBeCloseTo(0, 2);

  // A long fragment fills its own line too.
  await addFragment(page, "Long frag", 600);
  const fragLine = railLine(page, "fragments", "Long frag");
  await expect(fragLine).toHaveAttribute("data-state", "active");
  await scrollTo(page, "top");
  await expect.poll(() => remainder(fragLine)).toBeCloseTo(1, 2);
  await scrollTo(page, "bottom");
  await expect.poll(() => remainder(fragLine)).toBeCloseTo(0, 2);
});

test("(l) Read mode: the active line fills through its section", async ({ page }) => {
  await seed(page, "Spy progress read", 600);
  await page.locator(".group-title").filter({ hasText: /^Read manuscript$/ }).click();
  const scroller = page.locator(".manuscript-read");
  await expect(scroller).toBeVisible();
  await page.mouse.move(900, 500);
  /** Scrolls so the one-third line sits `fraction` of the way down the section holding `title`. */
  const place = (title: string, fraction: number) =>
    scroller.evaluate(
      (sc, [t, f]) => {
        const sec = [...sc.querySelectorAll("section[id^='read-']")].find((s) => s.textContent?.includes(t + " line 0"))!;
        const r = sec.getBoundingClientRect();
        const top = r.top - sc.getBoundingClientRect().top;
        sc.scrollTop += top + r.height * (f as number) - sc.clientHeight / 3;
      },
      [title, fraction] as const,
    );
  await place("Beta part", 0.01);
  await expect(line(page, "Beta part")).toHaveAttribute("data-state", "active");
  await expect.poll(() => remainder(line(page, "Beta part"))).toBeCloseTo(1, 1);
  await place("Beta part", 0.5);
  await expect(line(page, "Beta part")).toHaveAttribute("data-state", "active");
  await expect.poll(() => remainder(line(page, "Beta part"))).toBeCloseTo(0.5, 1);
  await page.screenshot({ path: test.info().outputPath("spy-progress-read-middle.png") });
  await scroller.evaluate((el) => (el.scrollTop = el.scrollHeight));
  await expect(line(page, "Delta part")).toHaveAttribute("data-state", "active");
  await expect.poll(() => remainder(line(page, "Delta part"))).toBeCloseTo(0, 2);
});

test("(m) Reduce Motion: no magnify; hover and focus fall back to the half-length line", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await seed(page, "Spy reduced");
  await row(page, "Alpha part").locator(".entry-main").click();
  await page.mouse.move(900, 500);
  const x = ((await line(page, "Gamma part").boundingBox())!).x + 4;
  const yG = await centreY(line(page, "Gamma part"));
  await page.mouse.move(x, yG - 6);
  await page.mouse.move(x, yG, { steps: 2 });
  await expect.poll(() => scaleX(line(page, "Gamma part"))).toBeCloseTo(0.75, 2);
  expect(await scaleY(line(page, "Gamma part"))).toBeCloseTo(1, 2);
  expect(await scaleX(line(page, "Delta part"))).toBeCloseTo(0.375, 2);
  expect(await page.locator(".spy-line").evaluateAll((els) => els.filter((e) => (e as HTMLElement).style.getPropertyValue("--spy-mag")).length)).toBe(0);
  await page.mouse.move(900, 500);
  await row(page, "Beta part").locator(".entry-main").focus();
  await page.keyboard.press("Tab");
  await page.keyboard.press("Shift+Tab");
  expect(await scaleY(line(page, "Alpha part"))).toBeCloseTo(1, 2);
  expect(await page.locator(".spy-line").evaluateAll((els) => els.filter((e) => (e as HTMLElement).style.getPropertyValue("--spy-mag")).length)).toBe(0);
});

test("(n) cards view of Fragments and Research draws no lines and no gutter", async ({ page }) => {
  await createProject(page, "Spy cards groups");
  await addFragment(page, "Frag one");
  await seedResearch(page);
  for (const [group, label] of [["fragments", "Fragments"], ["research", "Research"]] as const) {
    await expect(page.locator(`.sidebar-group[data-group="${group}"] .spy-line`).first()).toBeVisible();
    await page.locator(`.sidebar-group[data-group="${group}"] .group-heading`).hover();
    await page.getByRole("button", { name: `Show ${label} cards` }).click();
    await expect(page.locator(`.sidebar-group[data-group="${group}"] .spy-line`)).toHaveCount(0);
    await expect(page.locator(`.sidebar-group[data-group="${group}"] .entry-list`)).toHaveCSS("padding-right", "0px");
  }
});

test("(o) at the 190 px sidebar idle lines are unchanged and Fragments/Research labels stay readable", async ({ page }) => {
  await page.addInitScript(() =>
    localStorage.setItem("folio.workspace.sidebar", JSON.stringify({ width: 190, pinned: true, hover: true })),
  );
  await createProject(page, "Spy narrow groups");
  await addFragment(page, "Frag one");
  await seedResearch(page);
  await addFragment(page, "Frag two");
  await page.mouse.move(900, 500);
  // The new fragment is open (active); the first section and Frag one are idle.
  const lines = page.locator(".sidebar-groups .spy-line[data-state='idle']");
  expect(await lines.count()).toBeGreaterThanOrEqual(2);
  await expect(railLine(page, "fragments", "Frag one")).toHaveAttribute("data-state", "idle");
  for (const l of await lines.all()) {
    await expect.poll(() => scaleX(l)).toBeCloseTo(0.375, 2);
    expect(await scaleY(l)).toBeCloseTo(1, 2);
  }
  // A3 stop rule: a 20 px gutter clipped "alpha.pdf" by 0.2 px here; the gutter is 14 px.
  for (const t of ["Frag one", "Frag two", "Bibliography", "alpha.pdf", "Note one"]) {
    const r = groupRow(page, t.startsWith("Frag") ? "fragments" : "research", t);
    const ok: { fits: boolean; inside?: boolean } = await r.evaluate((el) => {
      const span = el.querySelector(".entry-main span")!;
      const range = document.createRange();
      range.selectNodeContents(span);
      const sb = span.getBoundingClientRect();
      const fitsWhole = range.getBoundingClientRect().width <= sb.width + 0.01;
      const cs = getComputedStyle(span);
      const node = span.firstChild!;
      const head = document.createRange();
      head.setStart(node, 0);
      head.setEnd(node, Math.min(6, node.textContent!.length));
      const sixVisible = head.getBoundingClientRect().right <= sb.right + 0.5;
      const count = el.querySelector(".entry-main small");
      const rb = el.getBoundingClientRect();
      const cb = count?.getBoundingClientRect();
      const countVisible = !cb || (cb.left >= rb.left - 0.5 && cb.right <= rb.right + 0.5);
      return { fits: (fitsWhole || (cs.textOverflow === "ellipsis" && sixVisible)) && countVisible };
    });
    const l = railLine(page, t.startsWith("Frag") ? "fragments" : "research", t);
    ok.inside = await l.evaluate((el) => el.getBoundingClientRect().right <= document.querySelector(".sidebar")!.getBoundingClientRect().right);
    expect(ok.fits, t + " label fits or ellipsizes with 6 characters visible, count fully visible").toBe(true);
    expect(ok.inside, t + " line inside the sidebar").toBe(true);
  }
});

// ---- Wave 6 T7b (docs/agent-work/2026-11-02-ui-wave-6/PLAN.md): the line rail (owner's Variant B).

const tooltip = (page: Page) => page.locator('[role="tooltip"].spy-card');
const pitches = (page: Page, group = "manuscript") =>
  page.locator(`.sidebar-group[data-group="${group}"] .spy-rail > .spy-line`).evaluateAll((els) => {
    const c = els.map((e) => {
      const b = e.getBoundingClientRect();
      return b.top + b.height / 2;
    });
    return c.slice(1).map((y, i) => y - c[i]);
  });

test("T7b: clicking the second line opens the second section; Enter and Space on a focused line do the same", async ({ page }) => {
  await seed(page, "Rail click");
  await line(page, "Beta part").click();
  await expect(line(page, "Beta part")).toHaveAttribute("data-state", "active");
  await expect(row(page, "Beta part")).toHaveClass(/selected/);
  await line(page, "Gamma part").focus();
  await page.keyboard.press("Enter");
  await expect(line(page, "Gamma part")).toHaveAttribute("data-state", "active");
  await expect(row(page, "Gamma part")).toHaveClass(/selected/);
  await line(page, "Delta part").focus();
  await page.keyboard.press("Space");
  await expect(line(page, "Delta part")).toHaveAttribute("data-state", "active");
});

test("T7b: hover or focus on a line shows no preview card (owner removed it 2026-11-03)", async ({ page }) => {
  await seed(page, "Rail no card", 300);
  await row(page, "Alpha part").locator(".entry-main").click();
  await line(page, "Gamma part").hover();
  await page.waitForTimeout(200);
  await expect(tooltip(page)).toHaveCount(0);
  await line(page, "Beta part").focus();
  await page.waitForTimeout(200);
  await expect(tooltip(page)).toHaveCount(0);
  await expect(line(page, "Beta part")).not.toHaveAttribute("aria-describedby", /.+/);
  // The line still does its job.
  await page.keyboard.press("Enter");
  await expect(line(page, "Beta part")).toHaveAttribute("data-state", "active");
});

test("T7b: lines are evenly spaced (+/-1 px) in each group, single and split", async ({ page }) => {
  await seed(page, "Rail spacing");
  const even = (d: number[]) => d.length > 1 && Math.max(...d) - Math.min(...d) <= 1;
  const d1 = await pitches(page);
  expect(d1.length).toBe(SECTIONS.length);
  expect(even(d1), `single ${d1}`).toBe(true);
  await row(page, "Gamma part").locator(".entry-main").click({ modifiers: ["ControlOrMeta"] });
  await expect(page.locator(".split-pane")).toHaveCount(2);
  await expect(line(page, "Gamma part")).toHaveAttribute("data-state", /open|active/);
  const d2 = await pitches(page);
  expect(even(d2), `split ${d2}`).toBe(true);
  expect(Math.abs(d2[0] - d1[0])).toBeLessThanOrEqual(1);
  // An active, an open and idle lines have the same centre-to-centre distance.
  const states2 = await Promise.all(SECTIONS.map((s) => line(page, s).getAttribute("data-state")));
  expect(new Set(states2).size).toBeGreaterThan(1);
});

