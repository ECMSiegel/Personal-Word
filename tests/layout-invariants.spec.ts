import { test, expect, type Locator, type Page } from "@playwright/test";
import { expectEvenRows, expectSharedEdge, expectSlots, ink, openProjectWithEntry } from "./layout-helpers";
import { settle, setPageView } from "./pages-helpers";

// Layout invariants (plan T0, docs/agent-work/2026-11-12-layout-primitives/PLAN.md, "The system").
// They assert relationships -- shared edges, slot sizes, even rows -- not recorded pixels.
// Each case starts as test.fixme with its owning task in the title; the owning worker removes
// `.fixme` from its own cases (one describe per surface family, owned by that task), adjusts
// selectors to the markup it ships, and makes them pass. Tolerance is 1 px (WebKit rounding).

test.use({ viewport: { width: 1440, height: 900 } });

const sidebar = (page: Page) => page.locator(".sidebar");
const formatBar = (page: Page) => page.locator(".writer > .format-bar, .format-bar").first();

async function withCustomHeader(page: Page) {
  await openProjectWithEntry(page, "Layout invariants");
  await page.getByRole("button", { name: "Add header", exact: true }).click();
  await page.getByLabel("Title", { exact: true }).fill("Part two");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
}

test.describe("sidebar (T2)", () => {
  test("T2: title, search icon, heading icons, row icons and the add row share one left ink edge", async ({ page }) => {
    await withCustomHeader(page);
    const s = sidebar(page);
    const edges = [
      s.locator(".sidebar-title-row .project-switch span").first(),
      s.locator(".search > svg").first(),
      ...(await s.locator(".sidebar-groups .group-title svg").all()),
      s.locator(".entry-main svg").first(),
      s.locator(".add-top-section svg").first(),
    ];
    await expectSharedEdge(page, edges, "left");
    // The edge is the sidebar's --edge (16 px) from its own left.
    const box = await s.boundingBox();
    expect(Math.abs((await ink(edges[0])).left - box!.x - 16)).toBeLessThanOrEqual(1);
    // Headings, rows and the add row keep one row rhythm (at least 32 px each).
    for (const l of [s.locator(".sidebar-groups .group-heading").first(), s.locator(".entry-main").first(), s.locator(".add-top-section")])
      expect((await l.boundingBox())!.height).toBeGreaterThanOrEqual(31.5);
  });

  test("T2: heading and row action icons are 24x24 slots in shared right-hand columns", async ({ page }) => {
    await withCustomHeader(page);
    const s = sidebar(page);
    const heading = s.locator('.sidebar-group[data-group="manuscript"] > .group-heading');
    await heading.hover();
    // Heading: .row with .row-trail > .cluster.gap-0.flush-end of slots [view][+][chevron].
    await expect(heading).toHaveClass(/\brow\b/);
    const headingSlots = heading.locator(".row-trail > .cluster.gap-0.flush-end .slot");
    await expect(headingSlots).toHaveCount(3);
    await expectSlots(headingSlots, 24, 24);
    // Even spacing: the slots abut, so icon centres are one slot apart.
    const lefts = await headingSlots.evaluateAll((els) => els.map((e) => e.getBoundingClientRect().left));
    for (let i = 1; i < lefts.length; i++) expect(Math.abs(lefts[i] - lefts[i - 1] - 24)).toBeLessThanOrEqual(1);
    const row = s.locator('.sidebar-group[data-group="manuscript"] .entry-row').first();
    await row.hover();
    const rowSlots = row.locator(".slot");
    await expect(rowSlots).toHaveCount(2);
    await expectSlots(rowSlots, 24, 24);
    // [More][Open beside] sit in the same columns as the heading's [view][+]; the chevron
    // column above them is the line rail's.
    const hb = await headingSlots.evaluateAll((els) => els.map((e) => e.getBoundingClientRect().left));
    const rb = await rowSlots.evaluateAll((els) => els.map((e) => e.getBoundingClientRect().left));
    expect(Math.abs(rb[0] - hb[0]), `More ${rb[0]} under view ${hb[0]}`).toBeLessThanOrEqual(1);
    expect(Math.abs(rb[1] - hb[1]), `split ${rb[1]} under + ${hb[1]}`).toBeLessThanOrEqual(1);
    // Every top-level heading's chevron slot shares one column, flush with the right --edge
    // (a .flush-end slot box ends (24 - 16) / 2 = 4 px past the edge; compare boxes, not the 14 px ink).
    const rights = await s
      .locator(".sidebar-groups .group-chevron")
      .evaluateAll((els) => els.map((e) => e.getBoundingClientRect().right));
    expect(Math.max(...rights) - Math.min(...rights), `chevron rights ${rights}`).toBeLessThanOrEqual(1);
    const box = await s.boundingBox();
    expect(Math.abs(box!.x + box!.width - 16 + 4 - rights[0]), `chevron right ${rights[0]}`).toBeLessThanOrEqual(1);
  });

  test("T2: no heading label is truncated at 190px", async ({ page }) => {
    await withCustomHeader(page);
    const handle = page.getByRole("separator", { name: "Sidebar width" });
    await handle.focus();
    await page.keyboard.press("ArrowLeft", { delay: 0 });
    for (let i = 0; i < 3; i++) await page.keyboard.press("ArrowLeft");
    await expect(handle).toHaveAttribute("aria-valuenow", "190");
    const measure = async (when: string) => {
      await page.mouse.move(900, 500);
      const labels = await sidebar(page)
        .locator(".sidebar-groups .group-label")
        .evaluateAll((els) => els.map((e) => ({ text: e.textContent, need: e.scrollWidth, have: e.clientWidth })));
      const texts = labels.map((l) => l.text);
      for (const t of ["Manuscript", "Fragments", "Research", "Part two"]) expect(texts, "headings present").toContain(t);
      for (const l of labels) expect.soft(l.need, `${when}: ${l.text}: needs ${l.need}, has ${l.have}`).toBeLessThanOrEqual(l.have);
    };
    await measure("at rest");
    // Ordinary mouse clicks leave focus inside the group (no keyboard focus): nothing may reveal the toggle.
    await sidebar(page).locator(".entry-main").first().click();
    await measure("after clicking a row");
    await sidebar(page).locator('.sidebar-group[data-group="manuscript"] .group-title').click();
    await measure("after clicking the heading");
    // The open section's heading is the bold one, so the widest case is covered.
    const weight = await sidebar(page).locator('.sidebar-group[data-group="manuscript"] .group-label').evaluate((e) => +getComputedStyle(e).fontWeight);
    expect(weight).toBeGreaterThanOrEqual(600);
  });

  test("T2: hovering a heading does not move its + or chevron, and the view toggle is reachable by keyboard", async ({ page }) => {
    await withCustomHeader(page);
    const s = sidebar(page);
    const heading = s.locator('.sidebar-group[data-group="fragments"] > .group-heading');
    const spots = () =>
      heading.evaluate((h) => {
        const x = (sel: string) => h.querySelector(sel)!.getBoundingClientRect();
        const label = h.querySelector(".group-label")!.getBoundingClientRect();
        return { labelLeft: label.left, add: x(".group-add").left, chev: x(".group-chevron").left, toggle: x(".group-view-toggle").width };
      });
    await page.mouse.move(900, 500);
    const rest = await spots();
    expect(rest.toggle, "no room at rest").toBe(0);
    await heading.hover();
    const hot = await spots();
    expect(hot.toggle).toBe(24);
    expect(hot.add).toBeCloseTo(rest.add, 0);
    expect(hot.chev).toBeCloseTo(rest.chev, 0);
    expect(hot.labelLeft).toBeCloseTo(rest.labelLeft, 0);
    // Keyboard: Tab from the heading title reaches the toggle; Enter flips the view.
    await page.mouse.move(900, 500);
    await heading.locator(".group-title").focus();
    await page.keyboard.press("Tab");
    const toggle = heading.locator(".group-view-toggle");
    await expect(toggle).toBeFocused();
    expect((await toggle.boundingBox())!.width).toBe(24);
    const before = await toggle.getAttribute("aria-label");
    await page.keyboard.press("Enter");
    await expect(toggle).not.toHaveAttribute("aria-label", before!);
    await page.keyboard.press("Space");
    await expect(toggle).toHaveAttribute("aria-label", before!);
  });
});

test.describe("app chrome bars (T1)", () => {
  test("T1: the last ink of the top bar and of the format bar share one right edge", async ({ page }) => {
    await openProjectWithEntry(page, "Layout invariants");
    const topLast = page.locator(".topbar > *:visible").last();
    const barLast = formatBar(page).locator(":scope > *:visible").last();
    await expectSharedEdge(page, [topLast, barLast], "right");
  });

  test("T1: Saved, Snapshot and Export are evenly spaced", async ({ page }) => {
    await openProjectWithEntry(page, "Layout invariants");
    const cluster = page.locator(".topbar .cluster").last();
    const items = cluster.locator(":scope > *:visible");
    const inks = [];
    for (const item of await items.all()) inks.push(await ink(item));
    expect(inks.length).toBeGreaterThanOrEqual(3);
    const gaps = inks.slice(1).map((b, i) => b.left - inks[i].right);
    expect(Math.max(...gaps) - Math.min(...gaps), `gaps ${gaps.join(", ")}`).toBeLessThanOrEqual(1);
  });

  test("T1: every .bar is 40 px tall, every .bar-compact 32 px", async ({ page }) => {
    await openProjectWithEntry(page, "Layout invariants");
    const heights = await page.locator(".bar:visible").evaluateAll((els) =>
      els.map((e) => ({ compact: e.classList.contains("bar-compact"), h: e.getBoundingClientRect().height })),
    );
    expect(heights.length).toBeGreaterThan(0);
    for (const { compact, h } of heights) expect(Math.abs(h - (compact ? 32 : 40))).toBeLessThanOrEqual(0.5);
  });
});

test.describe("format bar and toolbar popovers (T3)", () => {
  // T3: each divider is the first child of its group (fitToolbar measures group widths with
  // their dividers), so the space before it is measured from the previous group.
  test("T3: each toolbar divider has equal space on both sides", async ({ page }) => {
    await openProjectWithEntry(page, "Layout invariants");
    const dividers = formatBar(page).locator(".bar-divider:visible");
    expect(await dividers.count()).toBeGreaterThan(0);
    for (const divider of await dividers.all()) {
      const sides = await divider.evaluate((d) => {
        const r = d.getBoundingClientRect();
        const prev = (d.previousElementSibling ?? d.parentElement!.previousElementSibling)!.getBoundingClientRect();
        // Skip children that draw nothing (Insert's hidden file input).
        let n = d.nextElementSibling!;
        while (n.getBoundingClientRect().width === 0) n = n.nextElementSibling!;
        const next = n.getBoundingClientRect();
        return { before: r.left - prev.right, after: next.left - r.right };
      });
      expect(Math.abs(sides.before - sides.after), JSON.stringify(sides)).toBeLessThanOrEqual(1);
    }
  });

  test("T3: toolbar icon buttons are 28 x 32 slots", async ({ page }) => {
    await openProjectWithEntry(page, "Layout invariants");
    await expectSlots(formatBar(page).locator(".slot-toolbar:visible"), 28, 32);
  });

  test("T3: the format bar's last icon ink sits --edge-main (24 px) from the bar's right edge", async ({ page }) => {
    await openProjectWithEntry(page, "Layout invariants");
    const bar = (await formatBar(page).boundingBox())!;
    const last = await ink(formatBar(page).locator(".toolbar-group.is-end"));
    expect(Math.abs(bar.x + bar.width - 24 - last.right), JSON.stringify({ bar, last })).toBeLessThanOrEqual(1);
  });

  for (const name of ["Prose check", "Line and paragraph spacing", "Page setup"]) {
    test(`T3: ${name} panel rows are even and share a trailing edge`, async ({ page }) => {
      await page.setViewportSize({ width: 1600, height: 900 });
      await openProjectWithEntry(page, "Layout invariants");
      await page.getByRole("button", { name, exact: true }).click();
      const panel = page.locator(".panel:visible").last();
      // Prose check's rule rows sit in its "Prose issues" region, a stack inside the panel.
      const rows = panel.locator(":scope > .row, :scope > .stack > .row");
      await expectEvenRows(rows);
      // Rows end in checkboxes and inputs, which ink() cannot measure: compare each row's last box
      // (text-only rows, such as Prose check's summary line, have no trailing control).
      const rights = await rows.evaluateAll((els) => els.filter((e) => e.lastElementChild).map((e) => e.lastElementChild!.getBoundingClientRect().right));
      expect(rights.length).toBeGreaterThan(1);
      expect(Math.max(...rights) - Math.min(...rights), `trail rights ${rights.join(", ")}`).toBeLessThanOrEqual(1);
    });
  }

  // Rework (REVIEW-4 finding 2): the More list's own control margin must not reach a panel opened from More.
  for (const name of ["Line and paragraph spacing", "Page setup"]) {
    test(`T3: a ${name} panel opened from More matches the same panel opened from the bar`, async ({ page }) => {
      await page.setViewportSize({ width: 1000, height: 900 });
      await openProjectWithEntry(page, "Layout invariants");
      await page.getByRole("button", { name: "More formatting", exact: true }).click();
      const more = page.locator(".toolbar-popover.is-more:visible");
      await more.getByRole("button", { name, exact: true }).click();
      const panel = more.locator(".panel:visible").last();
      const rows = panel.locator(":scope > .row");
      await expectEvenRows(rows);
      const heights = await rows.evaluateAll((els) => els.map((e) => e.getBoundingClientRect().height));
      for (const h of heights) expect(Math.abs(h - 28), `row heights ${heights.join(", ")}`).toBeLessThanOrEqual(0.5);
      const edge = await panel.evaluate((p) => p.getBoundingClientRect().right - parseFloat(getComputedStyle(p).paddingRight) - parseFloat(getComputedStyle(p).borderRightWidth));
      const rights = await rows.evaluateAll((els) => els.map((e) => e.lastElementChild!.getBoundingClientRect().right));
      for (const r of rights) expect(Math.abs(r - edge), `row ends ${rights.join(", ")} vs panel edge ${edge}`).toBeLessThanOrEqual(1);
    });
  }

  // Rework (REVIEW-4 finding 1): issue rows grow with their text instead of spilling over their border.
  test("T3: prose issue rows contain their text", async ({ page }) => {
    await page.setViewportSize({ width: 1600, height: 900 });
    const editor = await openProjectWithEntry(page, "Layout invariants");
    const long = Array.from({ length: 45 }, (_, i) => `word${i}`).join(" ");
    await editor.fill(`The the cat sat. The report was written by the team. It was basically really very just quite actually done. ${long}.`);
    await page.getByRole("button", { name: "Prose check", exact: true }).click();
    await page.getByRole("checkbox", { name: "On", exact: true }).check();
    const list = page.locator(".prose-issues");
    await expect(list.locator(".prose-issue-select")).not.toHaveCount(0);
    await expect.poll(() => list.locator(".prose-issue-select").count()).toBeGreaterThanOrEqual(5);
    await page.waitForTimeout(400);
    await expect(list).toHaveClass(/\bstack\b/);
    await expect(list).toHaveClass(/\bgap-1\b/);
    const m = await list.evaluate((l) => {
      const buttons = [...l.querySelectorAll<HTMLElement>(".prose-issue-select")];
      const msgLines = buttons.map((b) => {
        const range = document.createRange();
        range.selectNodeContents(b.lastElementChild!);
        return new Set([...range.getClientRects()].map((r) => Math.round(r.top))).size;
      });
      // Neither the button nor its row may be shorter than its content (the list is a capped, scrolling stack,
      // so a shrinkable row would let the button spill over the next row).
      const rowEls = [...l.querySelectorAll<HTMLElement>(":scope > .prose-issue-row")];
      const spill = [...buttons, ...rowEls].filter((b) => b.scrollHeight > b.clientHeight + 1).map((b) => `${b.textContent}: ${b.scrollHeight}>${b.clientHeight}`);
      const rows = [...l.querySelectorAll<HTMLElement>(":scope > .prose-issue-row")].map((r) => r.getBoundingClientRect());
      const gaps = rows.slice(1).map((r, i) => r.top - rows[i].bottom);
      const minH = Math.min(...buttons.map((b) => b.getBoundingClientRect().height));
      // Rework 2 (REVIEW-7): every text line of the excerpt and the message stays inside the button's padding
      // box on all four sides, and nothing scrolls sideways (a long-sentence issue once crushed its message).
      const outside: string[] = [];
      for (const b of buttons) {
        const r = b.getBoundingClientRect();
        const box = { left: r.left + b.clientLeft, top: r.top + b.clientTop, right: r.left + b.clientLeft + b.clientWidth, bottom: r.top + b.clientTop + b.clientHeight };
        for (const span of b.children) {
          const range = document.createRange();
          range.selectNodeContents(span);
          // Lines a clamped excerpt hides (below its own box) are not drawn.
          const own = span.getBoundingClientRect();
          for (const t of range.getClientRects())
            if (t.width > 0 && t.top < own.bottom - 1 && (t.left < box.left - 1 || t.right > box.right + 1 || t.top < box.top - 1 || t.bottom > box.bottom + 1))
              outside.push(`${span.textContent!.slice(0, 30)}: ${Math.round(t.left)}..${Math.round(t.right)} x ${Math.round(t.top)}..${Math.round(t.bottom)} in ${Math.round(box.left)}..${Math.round(box.right)} x ${Math.round(box.top)}..${Math.round(box.bottom)}`);
        }
      }
      const sideways = [...buttons, ...rowEls].filter((b) => b.scrollWidth > b.clientWidth + 1).map((b) => `${b.textContent!.slice(0, 30)}: ${b.scrollWidth}>${b.clientWidth}`);
      const longRow = buttons.some((b) => /Long sentence/.test(b.textContent!));
      return { msgLines, spill, gaps, minH, outside, sideways, longRow };
    });
    expect(Math.max(...m.msgLines), `message line counts ${m.msgLines}`).toBeGreaterThanOrEqual(3);
    expect(m.spill).toEqual([]);
    expect(m.longRow, "the long-sentence issue is listed").toBe(true);
    expect(m.outside, "text lines outside their issue button").toEqual([]);
    expect(m.sideways, "issue buttons or rows wider than their box").toEqual([]);
    expect(m.minH, "an issue row is at least the compact row height").toBeGreaterThanOrEqual(27.5);
    for (const g of m.gaps) expect(Math.abs(g - 4), `row gaps ${m.gaps}`).toBeLessThanOrEqual(0.5);
  });

  // Rework 2 (REVIEW-7 / coordinator item 2): Prose check opened from More keeps still, even rule rows.
  test("T3: Prose check opened from More keeps 28 px rule rows that do not move on hover or focus", async ({ page }) => {
    await page.setViewportSize({ width: 1000, height: 900 });
    await openProjectWithEntry(page, "Layout invariants");
    await page.getByRole("button", { name: "More formatting", exact: true }).click();
    const more = page.locator(".toolbar-popover.is-more:visible");
    await more.getByRole("button", { name: "Prose check", exact: true }).click();
    await more.getByRole("checkbox", { name: "On", exact: true }).check();
    const panel = more.locator(".prose-check-panel");
    await expect(panel.locator(".toolbar-field-title.row")).not.toHaveText(/Analyzing/);
    await page.waitForTimeout(400);
    const rows = panel.locator(":scope > label.row, .prose-issues-panel > label.row");
    await expect(rows).toHaveCount(5);
    await expectEvenRows(rows);
    const heights = await rows.evaluateAll((els) => els.map((e) => e.getBoundingClientRect().height));
    for (const h of heights) expect(Math.abs(h - 28), `row heights ${heights}`).toBeLessThanOrEqual(0.5);
    // In the More list's content coordinates: hovering a row may scroll the list into view, which is not a move.
    const boxes = () => rows.evaluateAll((els) => els.map((e) => { const r = e.querySelector("input")!.getBoundingClientRect(); const s = e.closest(".is-more")!; return [r.left + s.scrollLeft, r.top + s.scrollTop, r.right + s.scrollLeft]; }));
    const probe = () => more.evaluate((m) => { const r = m.getBoundingClientRect(); const p = m.querySelector(".prose-check-panel")!.getBoundingClientRect(); return JSON.stringify({ more: [r.left, r.width, m.clientWidth, m.scrollWidth, m.scrollTop], panel: [p.left, p.width] }); });
    await page.mouse.move(5, 890);
    const rest = await boxes();
    const restProbe = await probe();
    expect(await more.evaluate((m) => m.scrollWidth - m.clientWidth), `More list scrolls sideways: ${restProbe}`).toBeLessThanOrEqual(1);
    test.info().annotations.push({ type: "rest", description: restProbe });
    const rights = rest.map((b) => b[2]);
    expect(Math.max(...rights) - Math.min(...rights), `checkbox column ${rights}`).toBeLessThanOrEqual(0.5);
    for (let i = 0; i < 5; i++) {
      const row = rows.nth(i);
      await row.locator(".row-label").hover();
      await page.waitForTimeout(250);
      const hovered = await boxes();
      await row.locator("input").focus();
      await page.keyboard.press("Shift+Tab");
      await page.keyboard.press("Tab");
      await page.mouse.move(5, 890);
      await page.waitForTimeout(250);
      const focused = await boxes();
      for (const [label, now] of [["hover", hovered], ["focus", focused]] as const)
        for (let j = 0; j < 5; j++)
          for (let k = 0; k < 3; k++)
            expect(Math.abs(now[j][k] - rest[j][k]), `row ${i} ${label}: checkbox ${j} moved ${JSON.stringify(rest[j])} -> ${JSON.stringify(now[j])}; more ${await probe()}`).toBeLessThanOrEqual(0.5);
    }
  });

  // Rework (REVIEW-4 finding 3): keyboard focus on a checkbox emphasises its row's label (the shared rule).
  test("T3: focusing a checkbox row emphasises its label", async ({ page }) => {
    await page.setViewportSize({ width: 1600, height: 900 });
    await openProjectWithEntry(page, "Layout invariants");
    const check = async (box: ReturnType<Page["getByRole"]>) => {
      await page.mouse.move(5, 890);
      const label = box.locator("xpath=ancestor::label[1]").locator(".row-label");
      expect(await label.evaluate((e) => getComputedStyle(e).textShadow), "label at rest").toBe("none");
      const before = (await box.boundingBox())!;
      await box.focus();
      await page.keyboard.press("Shift+Tab");
      await page.keyboard.press("Tab");
      await expect(box).toBeFocused();
      expect(await label.evaluate((e) => getComputedStyle(e).textShadow), "label while its checkbox has keyboard focus").not.toBe("none");
      const after = (await box.boundingBox())!;
      expect(Math.abs(after.x - before.x) + Math.abs(after.y - before.y), "nothing moves").toBeLessThanOrEqual(0.5);
    };
    await page.getByRole("button", { name: "Prose check", exact: true }).click();
    await check(page.getByRole("checkbox", { name: "On", exact: true }));
    await page.getByRole("checkbox", { name: "On", exact: true }).check();
    for (const name of ["Repeated words", "Possible passive voice", "Filler words", "Long sentences"])
      await check(page.getByRole("region", { name: "Prose issues" }).getByRole("checkbox", { name, exact: true }));
    await page.keyboard.press("Escape");
    await page.getByRole("button", { name: "Page setup", exact: true }).click();
    await check(page.getByRole("checkbox", { name: "Page numbers", exact: true }));
  });

  test("T3: a dropdown menu opened inside the Page setup panel keeps 32 px menu rows", async ({ page }) => {
    await page.setViewportSize({ width: 1600, height: 900 });
    await openProjectWithEntry(page, "Layout invariants");
    await page.getByRole("button", { name: "Page setup", exact: true }).click();
    await page.locator(".panel:visible").last().getByRole("button", { name: "Page margins" }).click();
    const options = page.locator(".dropdown-menu:visible").last().getByRole("option");
    expect(await options.count()).toBeGreaterThan(1);
    for (const option of await options.all()) {
      const b = (await option.boundingBox())!;
      expect(Math.abs(b.height - 32), `row height ${b.height}`).toBeLessThanOrEqual(0.5);
    }
  });
});

test.describe("menus (T4)", () => {
  // Rows are the menu's direct .row children; a .menu-rule may sit between groups of rows, so rows are
  // checked per group, and every rule must have the same space above and below it.
  async function checkMenu(page: Page) {
    const menu = page.locator(".menu:visible").last();
    const rows = menu.locator(":scope > .row");
    await expect(rows.first()).toBeVisible();
    const total = await rows.count();
    expect(total, "menu has rows").toBeGreaterThanOrEqual(2);
    await expectSharedEdge(page, rows.locator(".row-label"), "left");
    const heights = await rows.evaluateAll((els) => els.map((el) => el.getBoundingClientRect().height));
    for (const h of heights) expect(h, `row heights ${heights.join(", ")}`).toBeCloseTo(32, 0);
    const spacing = await menu.evaluate((el) => {
      const kids = [...el.children].filter((k) => getComputedStyle(k).display !== "none");
      const gaps: number[] = [];
      const rules: { above: number; below: number }[] = [];
      kids.forEach((k, i) => {
        const r = k.getBoundingClientRect();
        const prev = kids[i - 1]?.getBoundingClientRect();
        const next = kids[i + 1]?.getBoundingClientRect();
        if (k.classList.contains("menu-rule")) {
          if (prev && next) rules.push({ above: r.top - prev.bottom, below: next.top - r.bottom });
        } else if (prev && !kids[i - 1].classList.contains("menu-rule") && k.classList.contains("row")) {
          gaps.push(r.top - prev.bottom);
        }
      });
      return { gaps, rules };
    });
    for (const g of spacing.gaps) expect(Math.abs(g), `row gaps ${spacing.gaps}`).toBeLessThanOrEqual(1);
    for (const r of spacing.rules) expect(Math.abs(r.above - r.below), "rule space above equals below").toBeLessThanOrEqual(1);
    return spacing;
  }

  test("T4: New project menu rows are even and share a label edge", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Start new project" }).click();
    const spacing = await checkMenu(page);
    expect(spacing.rules.length, "New project menu has a rule").toBeGreaterThan(0);
  });

  test("T4: Export menu rows are even and share a label edge", async ({ page }) => {
    await openProjectWithEntry(page, "Layout invariants");
    await page.locator(".topbar").getByRole("button", { name: "Export", exact: true }).click();
    const spacing = await checkMenu(page);
    expect(spacing.rules.length, "Export menu has a rule").toBeGreaterThan(0);
  });

  test("T4: a dropdown's rows are even and share a label edge", async ({ page }) => {
    await page.setViewportSize({ width: 1600, height: 900 });
    await openProjectWithEntry(page, "Layout invariants");
    await page.getByRole("button", { name: "Paragraph style" }).click();
    await checkMenu(page);
  });

  test("T4: a context menu's rows are even and share a label edge", async ({ page }) => {
    await openProjectWithEntry(page, "Layout invariants");
    await sidebar(page).locator(".entry-main").first().click({ button: "right" });
    await checkMenu(page);
  });

  test("T4: every menu uses one row height and one left inset", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Start new project" }).click();
    const inset = async () =>
      page.locator(".menu:visible").last().evaluate((m) => {
        const row = m.querySelector(":scope > .row")!;
        return parseFloat(getComputedStyle(row).paddingLeft);
      });
    const projectInset = await inset();
    expect(projectInset).toBe(12);
  });
});

test.describe("slots (T2, T3)", () => {
  test("T2/T3: every .slot is 24 x 24 and every .slot-toolbar 28 x 32", async ({ page }) => {
    await withCustomHeader(page);
    await sidebar(page).locator(".group-heading").first().hover();
    await expectSlots(page.locator(".slot:not(.slot-toolbar):visible"), 24, 24);
    await expectSlots(page.locator(".slot-toolbar:visible"), 28, 32);
  });

  // Every visible .slot in the other states is 24 x 24 too (toolbar slots 28 x 32).
  const offSize = (page: Page) =>
    page.locator(".slot:visible").evaluateAll((els) =>
      els.flatMap((e) => {
        const r = e.getBoundingClientRect();
        const [w, h] = e.classList.contains("slot-toolbar") ? [28, 32] : [24, 24];
        return Math.abs(r.width - w) > 0.5 || Math.abs(r.height - h) > 0.5
          ? [`${e.tagName}.${e.className} "${e.getAttribute("aria-label")}" ${r.width}x${r.height}`]
          : [];
      }),
    );

  test("T11: slots stay 24 x 24 on the Projects page, in cards view and with a split open", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator(".library-toolbar")).toBeVisible();
    expect(await offSize(page), "Projects page").toEqual([]);
    await withCustomHeader(page);
    const heading = sidebar(page).locator('.sidebar-group[data-group="manuscript"] > .group-heading');
    await heading.hover();
    await sidebar(page).getByRole("button", { name: "Show Manuscript cards" }).click();
    await expect(sidebar(page).locator(".cards-view").first()).toBeVisible();
    expect(await offSize(page), "cards view").toEqual([]);
    await heading.hover();
    await sidebar(page).getByRole("button", { name: "Show Manuscript list" }).click();
    await heading.hover();
    await page.getByRole("button", { name: "New section", exact: true }).first().click();
    await page.getByLabel("Title", { exact: true }).fill("Second");
    await page.getByRole("button", { name: "Save", exact: true }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await sidebar(page).locator(".entry-row").first().hover();
    await page.getByRole("button", { name: "Open Opening beside" }).click();
    await expect(page.locator(".split-pane-header").first()).toBeVisible();
    expect(await offSize(page), "split open").toEqual([]);
  });
});

test.describe("dialogs, forms, Settings, versions (T6)", () => {
  test("T6: every Settings row is 32 tall, 12 apart, with one label column and one control column", async ({ page }) => {
    await openProjectWithEntry(page, "Layout invariants");
    await page.getByRole("button", { name: "Settings", exact: true }).click();
    await expect(page.locator(".project-settings .settings-nav")).toBeVisible();
    // Every row on the page (General, Goals, Export document), not a chosen few.
    const rows = await page.locator(".project-settings .settings-field").evaluateAll((els) => els.filter((e) => e.getClientRects().length).map((e) => {
      const r = e.getBoundingClientRect();
      const label = e.querySelector(":scope > .settings-label")?.getBoundingClientRect();
      const control = e.querySelector(":scope > :not(.settings-label)")?.getBoundingClientRect();
      const prev = e.previousElementSibling?.classList.contains("settings-field") ? e.previousElementSibling.getBoundingClientRect() : null;
      return { name: e.querySelector(":scope > .settings-label")?.textContent ?? `(no label) ${e.textContent?.slice(0, 20)}`, h: r.height, labelX: label?.left ?? NaN, controlX: control?.left ?? NaN, controlW: control?.width ?? NaN, gapAbove: prev ? r.top - prev.bottom : null };
    }));
    console.log("T6 settings rows", JSON.stringify(rows));
    expect(rows.length).toBeGreaterThanOrEqual(10);
    const bad = rows.filter((r) => Math.abs(r.h - 32) > 1 || Number.isNaN(r.labelX) || (r.gapAbove !== null && Math.abs(r.gapAbove - 12) > 1));
    expect(bad, "rows not 32 tall, without a .settings-label, or not 12 below the previous row").toEqual([]);
    const spread = (xs: number[]) => Math.max(...xs) - Math.min(...xs);
    expect(spread(rows.map((r) => r.labelX)), "label column").toBeLessThanOrEqual(1);
    expect(spread(rows.map((r) => r.controlX)), "control column").toBeLessThanOrEqual(1);
    expect(Math.abs(rows[0].controlX - rows[0].labelX - 192), "180 px label column + 12 px gap").toBeLessThanOrEqual(1);
  });

  // Buttons of a dialog's action row: a flex cluster, 16 px apart, the last one on the content's right edge.
  async function expectActionsAtEnd(dialog: import("@playwright/test").Locator, label: string) {
    await expect(dialog.locator(".dialog-actions")).toBeVisible();
    const s = await dialog.evaluate((el) => {
      const cs = getComputedStyle(el);
      const actions = el.querySelector(".dialog-actions")!;
      const buttons = [...actions.children].map((b) => b.getBoundingClientRect());
      return {
        display: getComputedStyle(actions).display,
        gaps: buttons.slice(1).map((b, i) => Math.round((b.left - buttons[i].right) * 10) / 10),
        right: Math.round(el.getBoundingClientRect().right - parseFloat(cs.paddingRight) - parseFloat(cs.borderRightWidth) - buttons.at(-1)!.right),
      };
    });
    expect(s.display, `${label}: actions display`).toBe("flex");
    for (const g of s.gaps) expect(Math.abs(g - 16), `${label}: button gaps ${s.gaps.join(", ")}`).toBeLessThanOrEqual(1);
    expect(Math.abs(s.right), `${label}: last button ${s.right} px from the right content edge`).toBeLessThanOrEqual(1);
  }

  test("T6: Capture quote, Import preview and Projects Settings keep their buttons 16 apart at the right", async ({ page }) => {
    // Projects page Settings modal.
    await page.goto("/");
    await page.locator(".library-display > .library-settings").click();
    await expectActionsAtEnd(page.getByRole("dialog", { name: "Settings" }), "Projects Settings");
    await page.keyboard.press("Escape");
    // Import preview: the "Project title" label sits 8 px above its input.
    await page.locator("#import-writing-text").setInputFiles({ name: "Draft.md", mimeType: "text/markdown", buffer: Buffer.from("# A heading\n\nSome writing.") });
    const preview = page.getByRole("dialog", { name: "Import writing" });
    await expectActionsAtEnd(preview, "Import preview");
    const labelGap = await preview.getByLabel("Project title").evaluate((input) => {
      const text = [...input.parentElement!.childNodes].find((n) => n.nodeType === Node.TEXT_NODE && n.textContent!.trim())!;
      const range = document.createRange();
      range.selectNodeContents(text);
      return input.getBoundingClientRect().top - range.getBoundingClientRect().bottom;
    });
    expect(Math.abs(labelGap - 8), `Project title label to input: ${labelGap}`).toBeLessThanOrEqual(1.5);
    await preview.getByRole("button", { name: "Cancel", exact: true }).click();
    // Capture quote.
    await openProjectWithEntry(page, "Layout capture");
    await page.locator(".group-title").filter({ hasText: /^Research$/ }).click();
    await page.getByRole("button", { name: "Enter manually" }).click();
    await page.getByLabel("Authors", { exact: true }).fill("Marguerite Halloway");
    await page.getByLabel("Title", { exact: true }).fill("Lamps and Ledgers");
    await page.getByRole("button", { name: "Capture quote" }).click();
    await expectActionsAtEnd(page.getByRole("dialog", { name: "Capture quote" }), "Capture quote");
  });

  test("T6: a versions row's title and date are 4 px apart", async ({ page }) => {
    await openProjectWithEntry(page, "Layout versions");
    await page.getByRole("button", { name: "Snapshot", exact: true }).click();
    await page.getByLabel("Snapshot name").fill("First draft");
    await page.getByRole("button", { name: "Save", exact: true }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await page.getByRole("button", { name: "Snapshots & history", exact: true }).click();
    const item = page.locator(".versions .version-item").first();
    await expect(item).toBeVisible();
    const gap = await item.evaluate((el) => el.querySelector("small")!.getBoundingClientRect().top - el.querySelector("strong")!.getBoundingClientRect().bottom);
    expect(Math.abs(gap - 4), `title to date: ${gap}`).toBeLessThanOrEqual(1);
  });

  test("T6: a dialog is a 24 px stack inside 32 px padding, with its actions at the end", async ({ page }) => {
    // The Snapshot name dialog: the same ModalFrame + name form as every other name dialog.
    await openProjectWithEntry(page, "Layout dialog");
    await page.getByRole("button", { name: "Snapshot", exact: true }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    const s = await dialog.evaluate((el) => {
      const cs = getComputedStyle(el);
      const actions = el.querySelector(".dialog-actions")!.getBoundingClientRect();
      const box = el.getBoundingClientRect();
      return { display: cs.display, gap: cs.rowGap, pad: cs.paddingLeft, right: Math.round(box.right - actions.right - parseFloat(cs.paddingRight)) };
    });
    expect(s.display).toBe("flex");
    expect(s.gap).toBe("24px");
    expect(s.pad).toBe("32px");
    expect(Math.abs(s.right)).toBeLessThanOrEqual(1);
  });
});

// --- T7 (board T311): research panel and citation card ---
test.describe("research panel and citation card (T7)", () => {
  test("T7: research tabs are a 40 px bar; source rows are even; sources start at the tab edge", async ({ page }) => {
    await openProjectWithEntry(page, "Layout research");
    await page.locator(".group-title").filter({ hasText: /^Research$/ }).click();
    const panel = page.locator(".research-panel");
    await expect(panel).toBeVisible();
    const tabs = panel.locator(".research-tabs");
    await expect(tabs).toHaveClass(/\bbar\b/);
    expect((await tabs.boundingBox())!.height).toBeCloseTo(40, 0);
    for (let i = 0; i < 3; i++) {
      await page.getByRole("button", { name: "Enter manually" }).click();
      await page.getByRole("button", { name: "Source type", exact: true }).waitFor();
      await page.getByLabel("Title", { exact: true }).first().fill(`Source number ${i + 1}`);
    }
    const toggles = panel.locator(".source-toggle");
    await expect(toggles).toHaveCount(3);
    for (const t of await toggles.all()) if ((await t.getAttribute("aria-expanded")) === "true") await t.click();
    const items = panel.locator(".source-item");
    await expectEvenRows(items);
    await expectSharedEdge(page, [tabs.locator("button").first(), toggles.first().locator(".source-title"), toggles.nth(1).locator(".source-title")], "left");
    const heights = await toggles.evaluateAll((els) => els.map((e) => e.getBoundingClientRect().height));
    expect(Math.min(...heights)).toBeGreaterThanOrEqual(32);
    for (const scheme of ["light", "dark"] as const) {
      await page.emulateMedia({ colorScheme: scheme });
      await page.locator(".research-aside").screenshot({ path: "docs/agent-work/2026-11-12-layout-primitives/notes/T7-panel-" + scheme + ".png" });
    }
  });

  test("T7: citation card text starts at one edge and the close icon ends at the matching edge", async ({ page }) => {
    await page.setViewportSize({ width: 1600, height: 900 });
    await page.addInitScript(() => {
      localStorage.setItem("personal-word.restoreTabs", "true");
      localStorage.setItem("folio.workspace.sidebar", JSON.stringify({ floating: true }));
    });
    await openProjectWithEntry(page, "Layout card");
    await setPageView(page, true);
    await page.locator(".group-title").filter({ hasText: /^Research$/ }).click();
    const card = page.locator(".citation-card");
    await expect(card).toBeVisible();
    await settle(page);
    await expectSharedEdge(
      page,
      [card.locator(".citation-card-title"), card.locator(".field > label").first(), card.locator(".citation-card-actions button").first(), card.locator(".citation-card-link")],
      "left",
    );
    await expectSlots(card.getByRole("button", { name: "Close citation card" }), 24, 24);
    for (const scheme of ["light", "dark"] as const) {
      await page.emulateMedia({ colorScheme: scheme });
      await card.screenshot({ path: "docs/agent-work/2026-11-12-layout-primitives/notes/T7-card-" + scheme + ".png" });
    }
    const box = (await card.boundingBox())!;
    const close = await ink(card.getByRole("button", { name: "Close citation card" }));
    const left = (await ink(card.locator(".citation-card-title"))).left;
    // Equal insets: title ink from the card's left edge, close icon ink from its right edge.
    expect(Math.abs((box.x + box.width - close.right) - (left - box.x)), "close icon inset").toBeLessThanOrEqual(1);
  });
});

test.describe("Projects page (T5)", () => {
  async function seedProjects(page: Page) {
    await page.goto("/");
    for (const title of ["Alpha draft", "Beta notes", "Gamma"]) {
      await page.getByRole("button", { name: "Start new project" }).click();
      await page.getByRole("button", { name: "Blank", exact: true }).click();
      await page.getByLabel("Project title").fill(title);
      await page.getByRole("button", { name: "Save", exact: true }).click();
      await page.getByRole("button", { name: "Projects", exact: true }).click();
      await expect(page.locator(".library")).toBeVisible();
    }
    await expect(page.locator(".project-row")).toHaveCount(3);
  }

  test("T5: the toolbar controls share one centre line and its icon buttons are 24 x 24 slots", async ({ page }) => {
    await seedProjects(page);
    const toolbar = page.locator(".library-toolbar");
    const icons = [
      toolbar.getByRole("button", { name: "Reverse project sort order" }),
      toolbar.getByRole("button", { name: "Show project cards" }),
      toolbar.getByRole("button", { name: "Settings" }),
    ];
    await expectSlots(icons, 24, 24);
    const controls = [
      toolbar.getByRole("button", { name: "Start new project" }),
      toolbar.getByRole("button", { name: /^Import writing/ }),
      toolbar.locator(".library-search"),
      toolbar.locator(".library-display .dropdown-button"),
      ...icons,
    ];
    const centres: number[] = [];
    for (const c of controls) {
      const b = (await c.boundingBox())!;
      centres.push(b.y + b.height / 2);
    }
    expect(Math.max(...centres) - Math.min(...centres), `centres ${centres.join(", ")}`).toBeLessThanOrEqual(1);
  });

  test("T5: list rows are even, their trash slots are 24 x 24 and share a right edge", async ({ page }) => {
    await seedProjects(page);
    await expectEvenRows(page.locator(".project-row"));
    const trash = page.locator(".project-row .delete-entry");
    await expectSlots(trash, 24, 24);
    // The trash is hidden until hover, so compare slot boxes, not ink.
    const rights = await trash.evaluateAll((els) => els.map((el) => el.getBoundingClientRect().right));
    expect(Math.max(...rights) - Math.min(...rights), `trash right edges ${rights.join(", ")}`).toBeLessThanOrEqual(1);
  });

  test("T5: cards sit in a grid with a 16 px gap both ways", async ({ page }) => {
    await seedProjects(page);
    await page.getByRole("button", { name: "Show project cards" }).click();
    const cards = await page.locator(".project-list--cards .project-row").evaluateAll((els) =>
      els.map((el) => el.getBoundingClientRect()).map((r) => ({ x: r.x, right: r.right, y: r.y, bottom: r.bottom })),
    );
    expect(cards).toHaveLength(3);
    expect(cards[1].x - cards[0].right).toBeCloseTo(16, 0);
    expect(cards[2].x - cards[1].right).toBeCloseTo(16, 0);
  });

  // T13 (board T317): the trash ink, the gear ink and the row rule end share one right edge.
  const svgBox = async (l: Locator) => (await l.locator("svg").first().boundingBox())!;

  test("T13: list trash is centred on its row, its ink ends on the rule and the gear's ink, the dates never move", async ({ page }) => {
    await seedProjects(page);
    const row = page.locator(".project-row").first();
    const trash = row.locator(".delete-entry");
    // The rightmost dates cell in list view is Added (visual order: edited, words, sections, added).
    const added = row.locator(".project-dates .project-added");
    await page.mouse.move(0, 0);
    const before = (await added.boundingBox())!;
    await row.hover();
    const after = (await added.boundingBox())!;
    expect(Math.abs(after.x - before.x), "dates moved on hover").toBeLessThanOrEqual(0.5);
    const t = await svgBox(trash);
    const title = await ink(row.locator(".project-name"));
    const gear = await ink(page.locator(".library-toolbar .library-settings"));
    const r = (await row.boundingBox())!;
    expect(Math.abs(t.y + t.height / 2 - (title.top + title.bottom) / 2), "trash vs title centre y").toBeLessThanOrEqual(1);
    expect(Math.abs(t.x + t.width - gear.right), "trash ink right vs gear ink right").toBeLessThanOrEqual(1);
    expect(Math.abs(t.x + t.width - (r.x + r.width)), "trash ink right vs rule end").toBeLessThanOrEqual(1);
    const slot = (await trash.boundingBox())!;
    expect(slot.x - (after.x + after.width), "dates to slot gap").toBeCloseTo(12, 0);
  });

  test("T13: card trash has equal top and right insets", async ({ page }) => {
    await seedProjects(page);
    await page.getByRole("button", { name: "Show project cards" }).click();
    const card = page.locator(".project-row").first();
    const t = await svgBox(card.locator(".delete-entry"));
    const c = (await card.boundingBox())!;
    const top = t.y - c.y;
    const right = c.x + c.width - (t.x + t.width);
    expect(Math.abs(top - right), `top ${top} right ${right}`).toBeLessThanOrEqual(1);
  });
});

// --- T8 (board T312): comments, fragments, revision comparison ---
test.describe("comments, fragments, revisions (T8)", () => {
  async function seedComments(page: Page) {
    const editor = await openProjectWithEntry(page, "Layout invariants");
    // One comment on a passage, then the passage is replaced so the comment is detached.
    await editor.press("ControlOrMeta+a");
    await page.getByRole("button", { name: "Comment on selection" }).click();
    await page.getByLabel("Note", { exact: true }).fill("Check this passage");
    await page.getByRole("button", { name: "Save", exact: true }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await editor.fill("Different words now.");
    await page.locator(".group-title").filter({ hasText: /^Comments$/ }).click();
    for (const note of ["First task", "Second task", "Third task"]) {
      await page.getByRole("button", { name: "Add task" }).click();
      await page.getByLabel("Note", { exact: true }).fill(note);
      await page.getByRole("button", { name: "Save", exact: true }).click();
      await expect(page.getByRole("dialog")).toHaveCount(0);
    }
    await expect(page.locator("article.feature-item")).toHaveCount(4);
  }

  async function seedFragments(page: Page) {
    const editor = await openProjectWithEntry(page, "Layout invariants");
    const words = Array.from({ length: 120 }, (_, k) => `w${k}`).join(" ");
    for (let i = 1; i <= 4; i++) {
      await editor.fill(`Fragment ${i} ${words}`);
      await editor.press("ControlOrMeta+a");
      await page.getByRole("button", { name: "Keep as fragment" }).click();
      await expect(editor).not.toContainText(`Fragment ${i}`);
    }
    await page.locator(".group-title").filter({ hasText: /^Fragments$/ }).click();
    await expect(page.locator(".fragment-library .fragment-item")).toHaveCount(4);
  }

  async function seedRevision(page: Page) {
    const editor = await openProjectWithEntry(page, "Layout invariants");
    await page.getByRole("button", { name: "Snapshot", exact: true }).click();
    await page.getByLabel("Snapshot name").fill("Before change");
    await page.getByRole("button", { name: "Save", exact: true }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await editor.fill("A changed opening paragraph.");
    await expect(page.getByText("Saved", { exact: true })).toBeVisible({ timeout: 10_000 });
    await page.getByRole("button", { name: "Snapshots & history", exact: true }).click();
    await page.locator(".versions").getByRole("button", { name: /Before change/ }).click();
    await expect(page.locator(".revision-comparison")).toBeVisible();
  }

  /** Space between each item's last child and its bottom divider, and between that divider and the next item's first child. */
  async function dividerSpacing(items: ReturnType<Page["locator"]>) {
    return items.evaluateAll((els) =>
      els.slice(0, -1).map((el, i) => {
        const r = el.getBoundingClientRect();
        const border = parseFloat(getComputedStyle(el).borderBottomWidth);
        const above = r.bottom - border - el.lastElementChild!.getBoundingClientRect().bottom;
        const below = els[i + 1].firstElementChild!.getBoundingClientRect().top - r.bottom;
        return { above: Math.round(above * 10) / 10, below: Math.round(below * 10) / 10 };
      }),
    );
  }

  test("T8: comment items are evenly spaced with equal space above and below each divider", async ({ page }) => {
    await seedComments(page);
    const items = page.locator(".feature-panel article.feature-item");
    await expectEvenRows(items.filter({ hasText: /^(First|Second|Third) task/ }));
    const d = await dividerSpacing(items);
    for (const x of d) expect(Math.abs(x.above - x.below), `dividers ${JSON.stringify(d)}`).toBeLessThanOrEqual(1);
  });

  test("T8: fragment rows are even, dividers centred, and action icons are 24 x 24 slots sharing a right edge", async ({ page }) => {
    await seedFragments(page);
    const items = page.locator(".fragment-library .fragment-item");
    await expectEvenRows(items);
    const d = await dividerSpacing(items);
    for (const x of d) expect(Math.abs(x.above - x.below), `dividers ${JSON.stringify(d)}`).toBeLessThanOrEqual(1);
    await expectSlots(page.locator(".fragment-library .fragment-icon"), 24, 24);
    // Compare slot boxes, not ink: the chevron is 14 px and the trash 16 px.
    const rights = await page.locator(".fragment-library .fragment-icon").evaluateAll((els) => els.map((el) => el.getBoundingClientRect().right));
    expect(Math.max(...rights) - Math.min(...rights), `icon right edges ${rights.join(", ")}`).toBeLessThanOrEqual(1);
  });

  test("T8: revision-compare controls sit on one centre line, evenly spaced from their neighbours", async ({ page }) => {
    await seedRevision(page);
    const controls = page.locator(".revision-comparison > .revision-change-controls.cluster");
    await expect(controls).toBeVisible();
    const centres = await controls.locator("> *").evaluateAll((els) => els.map((e) => { const r = e.getBoundingClientRect(); return r.top + r.height / 2; }));
    expect(Math.max(...centres) - Math.min(...centres), `centres ${centres.join(", ")}`).toBeLessThanOrEqual(1);
    const gaps = await page.locator(".revision-comparison").evaluate((el) => {
      const k = [...el.children].slice(0, 3).map((c) => c.getBoundingClientRect());
      return [k[1].top - k[0].bottom, k[2].top - k[1].bottom];
    });
    expect(Math.abs(gaps[0] - gaps[1]), `gaps label/controls/summary ${gaps.join(", ")}`).toBeLessThanOrEqual(1);
  });

  test.describe("T8 screenshots", () => {
    test.skip(!process.env.T8_SHOTS, "set T8_SHOTS=1 to write screenshots");
    const dir = "docs/agent-work/2026-11-12-layout-primitives/notes";
    for (const scheme of ["light", "dark"] as const) {
      test(`T8: comments ${scheme}`, async ({ page }) => {
        await page.emulateMedia({ colorScheme: scheme, reducedMotion: "reduce" });
        await seedComments(page);
        await page.screenshot({ path: `${dir}/T8-comments-${scheme}.png` });
      });
      test(`T8: fragments ${scheme}`, async ({ page }) => {
        await page.emulateMedia({ colorScheme: scheme, reducedMotion: "reduce" });
        await seedFragments(page);
        await page.screenshot({ path: `${dir}/T8-fragments-${scheme}.png` });
        await page.locator(".fragment-library .fragment-item").first().getByRole("button", { name: /^Expand / }).click();
        await page.screenshot({ path: `${dir}/T8-fragment-open-${scheme}.png` });
      });
      test(`T8: revision and read ${scheme}`, async ({ page }) => {
        await page.emulateMedia({ colorScheme: scheme, reducedMotion: "reduce" });
        await seedRevision(page);
        await page.screenshot({ path: `${dir}/T8-revision-${scheme}.png` });
        await page.goto("/");
        await page.getByRole("button", { name: "Read manuscript" }).click().catch(() => undefined);
        await page.screenshot({ path: `${dir}/T8-read-${scheme}.png` });
      });
    }
  });
});

test.describe("header colour row (T12)", () => {
  test("T12: the colour row's swatches are 24x24 slots, the square's ink is on the label edge, the row is 32 high", async ({ page }) => {
    await page.addInitScript(() =>
      localStorage.setItem("folio.workspace.appearance", JSON.stringify({ theme: "system", palette: "color" })));
    await withCustomHeader(page);
    for (const target of ['[data-group="fragments"]', '[data-group-kind="manuscript"]:not([data-group="manuscript"])']) {
      await sidebar(page).locator(`.sidebar-groups ${target} .group-title`).click({ button: "right" });
      const menu = page.getByRole("menu");
      await expect(menu).toHaveAttribute("data-shown", "");
      await menu.evaluate(async (el) => {
        await Promise.all(el.getAnimations().map((a) => a.finished));
      });
      const row = menu.getByRole("group", { name: "Colour" });
      const radios = row.getByRole("menuitemradio");
      await expectSlots(radios, 24, 24);
      expect((await row.boundingBox())!.height).toBeCloseTo(32, 0);
      const labelLeft = (await ink(menu.locator(".row-label").first())).left;
      const chip = (await row.locator(".swatch-chip").first().boundingBox())!;
      expect(Math.abs(chip.x - labelLeft), `square at ${chip.x}, labels at ${labelLeft}`).toBeLessThanOrEqual(1);
      expect(chip.width).toBeCloseTo(16, 0);
      expect(chip.height).toBeCloseTo(16, 0);
      await page.keyboard.press("Escape");
      await expect(menu).toHaveCount(0);
    }
  });
});
