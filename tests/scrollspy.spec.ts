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
const line = (page: Page, title: string) => row(page, title).locator("> .spy-line");
const scaleX = (l: Locator) =>
  l.evaluate((el) => Number(/matrix\(([^,]+)/.exec(getComputedStyle(el).transform)?.[1] ?? 1));
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
  await row(page, "Gamma part").locator(".entry-main").hover();
  await expect.poll(() => scaleX(line(page, "Gamma part"))).toBeCloseTo(0.75, 2);
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
  expect(await scaleX(line(page, "Gamma part"))).toBeCloseTo(0.75, 2);
  // The line itself is never a Tab stop and is hidden from assistive tech.
  await expect(line(page, "Gamma part")).toHaveAttribute("tabindex", "-1");
  await expect(line(page, "Gamma part")).toHaveAttribute("aria-hidden", "true");
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

test("(e, f) a dragged row keeps its line; collapsing Manuscript removes the lines", async ({ page }) => {
  await seed(page, "Spy drag");
  const rows = page.locator('.sidebar-group[data-group="manuscript"] .entry-row');
  await rows.nth(1).dragTo(rows.nth(3), { sourcePosition: { x: 6, y: 6 } });
  for (const name of SECTIONS) {
    const inside = await row(page, name).evaluate((r) => {
      const l = r.querySelector(":scope > .spy-line")!.getBoundingClientRect();
      const b = r.getBoundingClientRect();
      return l.top >= b.top && l.bottom <= b.bottom;
    });
    expect(inside, name + " line inside its row").toBe(true);
  }
  await page.getByRole("button", { name: "Hide Manuscript", exact: true }).click();
  await expect(page.locator(".spy-line")).toHaveCount(0);
});

test("(g) at the 190 px sidebar the heading and titles stay readable and lines miss the counts", async ({ page }) => {
  await page.addInitScript(() =>
    localStorage.setItem("folio.workspace.sidebar", JSON.stringify({ width: 190, pinned: true, hover: true })),
  );
  await seed(page, "Spy narrow");
  await page.mouse.move(900, 500);
  const heading = page.locator('.sidebar-group[data-group="manuscript"] .group-label');
  expect(await heading.evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(true);
  for (const name of SECTIONS) {
    const r = row(page, name);
    const fits = await r.locator(".entry-main span").evaluate((span) => {
      const node = span.firstChild!;
      const range = document.createRange();
      range.setStart(node, 0);
      range.setEnd(node, Math.min(12, node.textContent!.length));
      return range.getBoundingClientRect().right <= span.getBoundingClientRect().right + 0.5;
    });
    expect(fits, name + " first 12 characters visible").toBe(true);
    const gap = await r.evaluate((el) => {
      const l = el.querySelector(":scope > .spy-line")!.getBoundingClientRect();
      const small = el.querySelector(".entry-main small")!.getBoundingClientRect();
      const sidebar = document.querySelector(".sidebar")!.getBoundingClientRect();
      return { clear: l.left - small.right, inside: l.right <= sidebar.right };
    });
    expect(gap.clear, name + " line clears the word count").toBeGreaterThanOrEqual(0);
    expect(gap.inside, name + " line inside the sidebar").toBe(true);
  }
});

test("(h) cards view draws no lines and no gutter", async ({ page }) => {
  await seed(page, "Spy cards");
  await page.locator('.sidebar-group[data-group="manuscript"] .group-heading').hover();
  await page.getByRole("button", { name: "Show Manuscript cards" }).click();
  await expect(page.locator(".spy-line")).toHaveCount(0);
  await expect(page.locator('.sidebar-group[data-group="manuscript"] .entry-list')).toHaveCSS("padding-right", "0px");
  await page.getByRole("button", { name: "Show Manuscript list" }).click();
  await expect(page.locator(".spy-line")).toHaveCount(SECTIONS.length + 1);
  await expect(page.locator('.sidebar-group[data-group="manuscript"] .entry-list')).toHaveCSS("padding-right", "20px");
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
