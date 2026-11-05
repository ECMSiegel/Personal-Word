import { test, expect, type Page } from "@playwright/test";
import { create, setZoom, settle, togglePageView } from "./pages-helpers";

// UI wave 5, C3 (docs/agent-work/2026-11-01-ui-wave-5/PLAN.md): with
// "Floating sidebar and research" on and room in the left margin, the sidebar
// is bare text on the page's own background, one FLOAT_GAP (16 px) clear of
// the document column, below the format bar and above the footer. Without
// room (narrow window, big zoom, split view, destination pages) it is the
// normal panel. The setting is seeded in storage so these specs do not depend
// on the Settings checkbox (covered by appearance/projects-screen specs).

const GAP = 16;
const TRANSPARENT = "rgba(0, 0, 0, 0)";

type Box = { left: number; right: number; top: number; bottom: number };

function seedFloating(page: Page, floating: boolean) {
  return page.addInitScript((on) => {
    localStorage.setItem("personal-word.restoreTabs", "true");
    let saved: Record<string, unknown> = {};
    try {
      saved = JSON.parse(localStorage.getItem("folio.workspace.sidebar") ?? "{}") ?? {};
    } catch {
      saved = {};
    }
    localStorage.setItem("folio.workspace.sidebar", JSON.stringify({ ...saved, floating: on }));
  }, floating);
}

async function setPaged(page: Page, paged: boolean) {
  if ((await page.locator(".is-paged").count() > 0) !== paged) await togglePageView(page);
  await expect(page.locator(".is-paged")).toHaveCount(paged ? 1 : 0);
  await settle(page);
}

const rect = (page: Page, selector: string) =>
  page.locator(selector).first().evaluate((el): Box => {
    const r = el.getBoundingClientRect();
    return { left: r.left, right: r.right, top: r.top, bottom: r.bottom };
  });

const intersects = (a: Box, b: Box) =>
  a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;

const shell = (page: Page) => page.locator(".sidebar-shell");
const sidebar = (page: Page) => page.locator("aside.sidebar");

/** Bare text: no fill, border or shadow on the sidebar or its search and title rows. */
async function expectBare(page: Page) {
  const look = await sidebar(page).evaluate((el) => {
    const s = getComputedStyle(el);
    const bg = (sel: string) => {
      const n = el.querySelector(sel);
      return n ? getComputedStyle(n).backgroundColor : "rgba(0, 0, 0, 0)";
    };
    return {
      background: s.backgroundColor,
      border: s.borderRightWidth,
      shadow: s.boxShadow,
      search: bg(".search"),
      searchInput: bg(".search input"),
      title: bg(".sidebar-title-row"),
      actions: [...el.querySelectorAll(".group-actions")].map((n) => getComputedStyle(n).backgroundColor),
    };
  });
  expect(look.background).toBe(TRANSPARENT);
  expect(look.border).toBe("0px");
  expect(look.shadow).toBe("none");
  expect(look.search).toBe(TRANSPARENT);
  expect(look.searchInput).toBe(TRANSPARENT);
  expect(look.title).toBe(TRANSPARENT);
  for (const a of look.actions) expect(a).toBe(TRANSPARENT);
}

/** The sidebar sits in the margin: clear of the column by the gap, never on the bars. */
async function expectClear(page: Page, column: string) {
  await settle(page);
  const side = await rect(page, "aside.sidebar");
  const doc = await rect(page, column);
  expect(side.right + GAP, `sidebar right ${side.right} vs ${column} left ${doc.left}`).toBeLessThanOrEqual(doc.left + 0.5);
  expect(intersects(side, await rect(page, ".format-bar"))).toBe(false);
  expect(intersects(side, await rect(page, ".topbar"))).toBe(false);
  // Wave 7 C: the box starts at the window edge, like the docked sidebar; its padding keeps the
  // contents in from the edge (the aligned-contents test checks their position).
  expect(side.left).toBeLessThanOrEqual(0.5);
}

test.describe("floating sidebar", () => {
  test.use({ viewport: { width: 1600, height: 900 } });

  test("off by default: the normal panel", async ({ page }) => {
    await seedFloating(page, false);
    await create(page, "Floating off");
    await expect(shell(page)).not.toHaveClass(/is-floating/);
    await expect(sidebar(page)).not.toHaveCSS("background-color", TRANSPARENT);
  });

  test("page view at 100 %: bare text in the left margin, clear of the sheet", async ({ page }) => {
    await seedFloating(page, true);
    await create(page, "Floating pages");
    await setPaged(page, true);
    await expect(shell(page)).toHaveClass(/is-floating/);
    await expectBare(page);
    await expectClear(page, ".editor-paper");
    // The sidebar text sits on the desk.
    const desk = await page.locator(".is-paged").evaluate((el) => getComputedStyle(el).backgroundColor);
    const surface = await page.evaluate(() => {
      const probe = document.createElement("div");
      probe.style.background = "var(--surface)";
      document.body.append(probe);
      const c = getComputedStyle(probe).backgroundColor;
      probe.remove();
      return c;
    });
    expect(desk).toBe(surface);
    // The workspace spans the window: the shell takes no flex space.
    expect((await rect(page, ".workspace")).left).toBeLessThanOrEqual(0.5);
    // Settings row rule and the sidebar both stop at the footer.
    const footer = await rect(page, ".pane-footer");
    expect((await rect(page, "aside.sidebar")).bottom).toBeLessThanOrEqual(footer.top + 0.5);
  });

  test("UI wave 7 C: at one window size the floating contents line up with the docked ones", async ({ page }) => {
    // The left edges (window px) of the search icon, first group icon, first entry icon
    // and first bottom-row element. Same window, same page view; only floating differs.
    const lefts = () =>
      page.evaluate(() => {
        const left = (sel: string) => {
          const el = document.querySelector(sel);
          if (!el) throw new Error("missing " + sel);
          return el.getBoundingClientRect().left;
        };
        return {
          search: left(".search svg"),
          groupIcon: left(".sidebar-groups .group-title svg"),
          entryIcon: left(".sidebar-groups .entry-main svg"),
          bottomRow: left(".sidebar-bottom-groups .group-title"),
        };
      });
    // Init scripts run on every load, so the floating switch is applied only once a session
    // flag is set (before the reload below); the first load is the normal docked panel.
    await page.addInitScript(() => {
      localStorage.setItem("personal-word.restoreTabs", "true");
      if (sessionStorage.getItem("ui7c-float") !== "1") return;
      let saved: Record<string, unknown> = {};
      try {
        saved = JSON.parse(localStorage.getItem("folio.workspace.sidebar") ?? "{}") ?? {};
      } catch {
        saved = {};
      }
      localStorage.setItem("folio.workspace.sidebar", JSON.stringify({ ...saved, floating: true }));
    });
    await page.setViewportSize({ width: 1600, height: 900 });
    await create(page, "Floating align");
    await setPaged(page, true);
    await expect(shell(page)).not.toHaveClass(/is-floating/);
    const docked = await lefts();
    await page.evaluate(() => sessionStorage.setItem("ui7c-float", "1"));
    await page.reload();
    // The fit re-measures on a page-view change, not on reload: flip the view off and back on.
    await setPaged(page, false);
    await setPaged(page, true);
    await expect(shell(page)).toHaveClass(/is-floating/);
    const floating = await lefts();
    for (const key of Object.keys(docked) as (keyof typeof docked)[]) {
      expect(Math.abs(floating[key] - docked[key]), `${key}: docked ${docked[key]} floating ${floating[key]}`).toBeLessThanOrEqual(1);
    }
  });

  test("a tight margin narrows the sidebar and still keeps the gap", async ({ page }) => {
    await seedFloating(page, true);
    await create(page, "Floating tight");
    await setPaged(page, true);
    await expect(shell(page)).toHaveClass(/is-floating/);
    const sheet = await rect(page, ".editor-paper");
    // A margin of 236 px leaves 204 px of room: narrower than the 270 px
    // sidebar, wider than the 190 px minimum.
    await page.setViewportSize({ width: Math.round(sheet.right - sheet.left) + 2 * 236, height: 900 });
    await settle(page);
    await expect(shell(page)).toHaveClass(/is-floating/);
    const side = await rect(page, "aside.sidebar");
    expect(side.right - side.left).toBeLessThan(270);
    expect(side.right - side.left).toBeGreaterThanOrEqual(190);
    await expectClear(page, ".editor-paper");
  });

  test("continuous view: clear of the text column", async ({ page }) => {
    await seedFloating(page, true);
    await create(page, "Floating continuous");
    await setPaged(page, false);
    await expect(shell(page)).toHaveClass(/is-floating/);
    await expectBare(page);
    await expectClear(page, ".writing-surface");
  });

  test("a narrow window falls back to the normal panel", async ({ page }) => {
    await seedFloating(page, true);
    // Wave 6 (T5): the fit counts the room floating would free, so the old 1100 px
    // window now floats in continuous view; 1040 px is below both views' fit.
    await page.setViewportSize({ width: 1040, height: 800 });
    await create(page, "Floating narrow");
    for (const paged of [true, false]) {
      await setPaged(page, paged);
      await expect(shell(page)).not.toHaveClass(/is-floating/);
      await expect(sidebar(page)).not.toHaveCSS("background-color", TRANSPARENT);
    }
  });

  test("a 1100 px window: continuous view floats and stays clear, page view keeps the panel", async ({ page }) => {
    await seedFloating(page, true);
    await page.setViewportSize({ width: 1100, height: 800 });
    await create(page, "Floating 1100");
    await setPaged(page, false);
    await expect(shell(page)).toHaveClass(/is-floating/);
    await expectBare(page);
    await expectClear(page, ".writing-surface");
    // The page sheet leaves a margin too small for the sidebar: the normal panel stays.
    await setPaged(page, true);
    await expect(shell(page)).not.toHaveClass(/is-floating/);
    await expect(sidebar(page)).not.toHaveCSS("background-color", TRANSPARENT);
  });

  test("page view at 150 % falls back, and floats again at 100 %", async ({ page }) => {
    await seedFloating(page, true);
    await create(page, "Floating zoom");
    await setPaged(page, true);
    await expect(shell(page)).toHaveClass(/is-floating/);
    await setZoom(page, 150);
    await settle(page);
    await expect(shell(page)).not.toHaveClass(/is-floating/);
    await setZoom(page, 100);
    await settle(page);
    await expect(shell(page)).toHaveClass(/is-floating/);
    await expectClear(page, ".editor-paper");
  });

  test("Toggle sidebar, pin, hover reveal and Escape keep working", async ({ page }) => {
    await seedFloating(page, true);
    await create(page, "Floating toggles");
    await setPaged(page, true);
    await expect(shell(page)).toHaveClass(/is-floating/);
    // Toggle sidebar unpins: still floating, hidden and inert until revealed.
    await page.getByRole("button", { name: "Toggle sidebar" }).click();
    await expect(shell(page)).toHaveClass(/is-floating/);
    await expect(shell(page)).not.toHaveClass(/is-revealed/);
    await expect(sidebar(page)).toHaveCSS("opacity", "0");
    expect(await sidebar(page).evaluate((el) => (el as HTMLElement).inert)).toBe(true);
    // The hover strip is at the window edge.
    const strip = page.getByRole("button", { name: "Show sidebar" });
    expect((await strip.boundingBox())!.x).toBeLessThanOrEqual(0.5);
    await page.mouse.move(800, 450);
    await page.mouse.move(3, 450);
    await expect(shell(page)).toHaveClass(/is-revealed/);
    await expect(sidebar(page)).toHaveCSS("opacity", "1");
    await expectBare(page);
    await expectClear(page, ".editor-paper");
    await page.mouse.move(800, 450);
    await expect(shell(page)).not.toHaveClass(/is-revealed/);
    // Keyboard: the strip reveals and focuses; Escape hides and returns to it.
    await strip.focus();
    await page.keyboard.press("Enter");
    await expect(shell(page)).toHaveClass(/is-revealed/);
    await expect(page.locator(".sidebar-pin")).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(shell(page)).not.toHaveClass(/is-revealed/);
    await expect(strip).toBeFocused();
    // Toggle sidebar on an unpinned sidebar reveals it (as without floating);
    // the pin pins it again: floating and shown.
    await page.getByRole("button", { name: "Toggle sidebar" }).click();
    await expect(shell(page)).toHaveClass(/is-revealed/);
    await page.getByRole("button", { name: "Pin sidebar" }).click();
    await expect(shell(page)).toHaveClass(/is-pinned/);
    await expect(shell(page)).toHaveClass(/is-floating/);
    await expect(sidebar(page)).toHaveCSS("opacity", "1");
    // The width handle still works by keyboard and the setting survives the write.
    await page.getByRole("separator", { name: "Sidebar width" }).focus();
    await page.keyboard.press("ArrowLeft");
    const saved = await page.evaluate(() => JSON.parse(localStorage.getItem("folio.workspace.sidebar") ?? "{}"));
    expect(saved.width).toBe(250);
    expect(saved.floating).toBe(true);
    await expectClear(page, ".editor-paper");
  });

  // Fable review finding 1: a real pointer crosses the 8-16 px gap between the
  // edge strip and the inset sidebar one pixel at a time; the sidebar must stay.
  test("unpinned: a slow 1 px pointer walk across the gap keeps the sidebar revealed", async ({ page }) => {
    await seedFloating(page, true);
    await create(page, "Floating slow walk");
    await setPaged(page, true);
    await page.getByRole("button", { name: "Toggle sidebar" }).click();
    await page.mouse.move(800, 450);
    await expect(shell(page)).not.toHaveClass(/is-revealed/);
    await page.mouse.move(0, 450);
    await page.mouse.move(3, 450);
    await expect(shell(page)).toHaveClass(/is-revealed/);
    for (let x = 4; x <= 24; x += 1) {
      await page.mouse.move(x, 450);
      await page.waitForTimeout(30);
      await expect(shell(page), `revealed at x=${x}`).toHaveClass(/is-revealed/);
    }
  });

  // Fable review finding 2: the unpinned shell is z-index 4 (under the 40 of
  // menus), so a format-bar menu paints over the revealed sidebar text.
  test("unpinned: z-index 4 and a format-bar menu paints above the sidebar", async ({ page }) => {
    await seedFloating(page, true);
    await create(page, "Floating z-index");
    await setPaged(page, true);
    await page.getByRole("button", { name: "Toggle sidebar" }).click();
    await page.locator(".ProseMirror").first().click();
    await expect(shell(page)).not.toHaveClass(/is-revealed/);
    await expect(shell(page)).toHaveCSS("z-index", "4");
    await page.getByRole("button", { name: "Show sidebar" }).focus();
    await page.keyboard.press("Enter");
    await expect(shell(page)).toHaveClass(/is-revealed/);
    await expect(shell(page)).toHaveCSS("z-index", "4");
    const triggers = await page.locator(".format-bar button[aria-haspopup], .format-bar button[aria-expanded]").all();
    let checked = 0;
    for (const t of triggers) {
      if (!(await t.isVisible())) continue;
      await t.click();
      await page.waitForTimeout(300);
      const pop = page.locator(".popover:visible, .dropdown-menu:visible").last();
      if (!(await pop.count())) continue;
      const hit = await pop.evaluate((menu) => {
        const m = menu.getBoundingClientRect();
        const s = document.querySelector("aside.sidebar")!.getBoundingClientRect();
        const l = Math.max(m.left, s.left), r = Math.min(m.right, s.right);
        const tp = Math.max(m.top, s.top), b = Math.min(m.bottom, s.bottom);
        if (l >= r || tp >= b) return null;
        const top = document.elementFromPoint((l + r) / 2, (tp + b) / 2);
        return { inMenu: !!top && menu.contains(top) };
      });
      if (hit) {
        checked += 1;
        expect(hit.inMenu, "menu paints above the floating sidebar").toBe(true);
      }
      await page.keyboard.press("Escape");
      await page.waitForTimeout(250);
    }
    expect(checked, "at least one format-bar menu overlaps the sidebar").toBeGreaterThan(0);
  });

  test("Reduce Motion: revealing has no transition", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await seedFloating(page, true);
    await create(page, "Floating reduced");
    await setPaged(page, true);
    await page.getByRole("button", { name: "Toggle sidebar" }).click();
    await expect(shell(page)).toHaveClass(/is-floating/);
    const durations = await sidebar(page).evaluate((el) => getComputedStyle(el).transitionDuration);
    expect(durations.split(",").every((d) => parseFloat(d) === 0)).toBe(true);
    await page.getByRole("button", { name: "Show sidebar" }).click();
    expect(await sidebar(page).evaluate((el) => getComputedStyle(el).opacity)).toBe("1");
  });

  test("split view falls back to the panel", async ({ page }) => {
    await seedFloating(page, true);
    await create(page, "Floating split");
    await setPaged(page, false);
    await expect(shell(page)).toHaveClass(/is-floating/);
    for (const title of ["First", "Second"]) {
      await page.getByRole("button", { name: "New section", exact: true }).click();
      await page.getByLabel("Title", { exact: true }).fill(title);
      await page.getByRole("button", { name: "Save", exact: true }).click();
      await expect(page.getByRole("dialog")).toHaveCount(0);
    }
    const row = (title: string) =>
      page.locator(".sidebar .entry-main").filter({ hasText: new RegExp("^" + title) });
    await row("First").click();
    await row("Second").click({ modifiers: ["ControlOrMeta"] });
    await expect(page.locator(".split-pane")).toHaveCount(2);
    await expect(shell(page)).not.toHaveClass(/is-floating/);
    await expect(sidebar(page)).not.toHaveCSS("background-color", TRANSPARENT);
  });

  test("a destination page falls back to the panel", async ({ page }) => {
    await seedFloating(page, true);
    await create(page, "Floating settings");
    await setPaged(page, true);
    await expect(shell(page)).toHaveClass(/is-floating/);
    await page.getByRole("button", { name: "Settings", exact: true }).click();
    await expect(shell(page)).not.toHaveClass(/is-floating/);
  });

  test("focus mode: the sidebar starts below the toolbar reveal band", async ({ page }) => {
    await seedFloating(page, true);
    await create(page, "Floating focus");
    await setPaged(page, false);
    const editor = page.getByRole("textbox", { name: "Writing editor", exact: true });
    await editor.click();
    await editor.press("ControlOrMeta+Shift+F");
    await expect(page.locator(".writer[data-focus-toolbar]")).toHaveCount(1);
    await settle(page);
    await expect(shell(page)).toHaveClass(/is-floating/);
    const band = await page.locator(".writer").evaluate((el) => {
      const s = getComputedStyle(el);
      const px = (v: string) => parseFloat(s.getPropertyValue(v));
      return el.getBoundingClientRect().top + px("--control-height") + 2 * px("--space-1");
    });
    await expect.poll(async () => (await rect(page, "aside.sidebar")).top).toBeGreaterThanOrEqual(band - 0.5);
    await expectClear(page, ".writing-surface");
  });
});

// Screenshots for the review (light/dark x Plain/Color x page/continuous, and
// the narrow fallback). PW_SHOTS_DIR points them at the task's cache folder.
test.describe("floating sidebar screenshots", () => {
  test.use({ viewport: { width: 1600, height: 900 } });

  test("light/dark, Plain/Color, page/continuous", async ({ page }, testInfo) => {
    test.setTimeout(180_000);
    const dir = process.env.PW_SHOTS_DIR;
    const out = (name: string) => (dir ? `${dir}/${name}` : testInfo.outputPath(name));
    await seedFloating(page, true);
    await create(page, "Floating screens");
    const editor = page.getByRole("textbox", { name: "Writing editor", exact: true });
    await editor.click();
    await editor.pressSequentially("The margin holds the sidebar; the text stays clear.");
    for (const palette of ["plain", "color"]) {
      for (const theme of ["light", "dark"]) {
        await page.evaluate(
          ([t, p]) => localStorage.setItem("folio.workspace.appearance", JSON.stringify({ theme: t, palette: p })),
          [theme, palette],
        );
        await page.reload();
        await expect(editor).toBeVisible();
        for (const paged of [true, false]) {
          await setPaged(page, paged);
          await expect(shell(page)).toHaveClass(/is-floating/);
          await page.screenshot({ path: out(`floating-${palette}-${theme}-${paged ? "page" : "continuous"}.png`) });
        }
      }
    }
    await page.evaluate(() =>
      localStorage.setItem("folio.workspace.appearance", JSON.stringify({ theme: "light", palette: "plain" })),
    );
    await page.setViewportSize({ width: 1100, height: 800 });
    await page.reload();
    await expect(editor).toBeVisible();
    await setPaged(page, true);
    await expect(shell(page)).not.toHaveClass(/is-floating/);
    await page.screenshot({ path: out("floating-narrow-fallback.png") });
  });
});

// ---------------------------------------------------------------------------
// UI wave 5, C5: the citation card. With floating on and room in the RIGHT
// margin, the Research heading and a footnote number open a one-citation card
// at the top right of the workspace instead of the research panel. Sidebar
// rows for a source or note, the card's own link and every case without room
// (narrow window, split view) use the full panel exactly as before.

const crossrefWork = {
  status: "ok",
  message: {
    type: "journal-article",
    DOI: "10.1234/example",
    title: ["Narrative Structure in Practice"],
    "container-title": ["Journal of Examples"],
    author: [
      { given: "Jane", family: "Smith" },
      { given: "Omar", family: "Reyes" },
    ],
    volume: "12",
    issue: "3",
    page: "45-67",
    issued: { "date-parts": [[2024, 5, 2]] },
  },
};

const mockCrossref = (page: Page) =>
  page.route("https://api.crossref.org/works/**", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      headers: { "access-control-allow-origin": "*" },
      body: JSON.stringify(crossrefWork),
    }),
  );

const card = (page: Page) => page.locator(".citation-card");
const aside = (page: Page) => page.locator(".research-aside");
const writingEditor = (page: Page) => page.getByRole("textbox", { name: "Writing editor", exact: true });
const researchHeader = (page: Page) => page.locator(".group-title").filter({ hasText: /^Research$/ });

/** The saved project (src/storage.ts keeps it under folio.preview.project.<id>). */
async function storedProject(page: Page) {
  return page.evaluate(() => {
    const key = Object.keys(localStorage).find((name) => name.startsWith("folio.preview.project."));
    return key ? JSON.parse(localStorage.getItem(key)!) : null;
  });
}

/** A writing project with text, in page view, floating seeded as asked. */
async function writingProject(page: Page, title: string, floating: boolean) {
  await seedFloating(page, floating);
  await mockCrossref(page);
  await create(page, title);
  await setPaged(page, true);
  await writingEditor(page).click();
  await writingEditor(page).pressSequentially("Evidence here.");
}

/** Card: DOI lookup -> preview -> Cite here. */
async function citeDoiInCard(page: Page) {
  await researchHeader(page).click();
  await expect(card(page)).toBeVisible();
  await page.getByLabel("DOI, ISBN or web address", { exact: true }).fill("10.1234/example");
  await card(page).getByRole("button", { name: "Look up", exact: true }).click();
  await expect(card(page)).toHaveAttribute("data-stage", "preview");
  await card(page).getByRole("button", { name: "Cite here", exact: true }).click();
  await expect(card(page)).toHaveAttribute("data-stage", "cited");
  await expect(writingEditor(page).locator("[data-footnote-id]")).toHaveCount(1);
}

/** Research data with ids replaced by their position, for a flow-to-flow compare. */
function normalise(project: any) {
  const research = project.research;
  const sourceIds = research.sources.map((s: any) => s.id);
  const footnoteIds = research.footnotes.map((f: any) => f.id);
  const section = project.entries.find((e: any) => e.kind === "section");
  return {
    sources: research.sources.map(({ id: _id, ...rest }: any) => rest),
    footnotes: research.footnotes.map(({ id: _id, sourceId, ...rest }: any) => ({
      ...rest,
      source: sourceId === undefined ? "none" : sourceIds.indexOf(sourceId),
    })),
    text: JSON.stringify(section.content).replace(
      /"id":"([^"]+)"/g,
      (_m: string, id: string) => `"id":"fn${footnoteIds.indexOf(id)}"`,
    ),
  };
}

const cardRect = (page: Page) => rect(page, ".citation-card");

/** Tab forward until focus is inside the card (a few stops: the footnote row, then the card). */
async function tabIntoCard(page: Page) {
  for (let i = 0; i < 10; i++) {
    if (await page.evaluate(() => !!document.activeElement?.closest(".citation-card"))) return;
    await page.keyboard.press("Tab");
  }
  expect(await page.evaluate(() => !!document.activeElement?.closest(".citation-card"))).toBe(true);
}

test.describe("citation card", () => {
  test.use({ viewport: { width: 1600, height: 900 } });

  test("the Research heading opens the card at the top right, clear of the page and the bars", async ({ page }) => {
    await writingProject(page, "Card placement", true);
    await researchHeader(page).click();
    await expect(card(page)).toBeVisible();
    await expect(card(page)).toHaveAttribute("data-stage", "new");
    await expect(aside(page)).toHaveCount(0);
    await expect(page.locator(".aside-resizer")).toHaveCount(0);
    // A pointer open animates; the lookup field has focus.
    await expect(card(page)).toHaveAttribute("data-animate", "");
    await expect(page.getByLabel("DOI, ISBN or web address", { exact: true })).toBeFocused();
    await settle(page);
    const box = await cardRect(page);
    const ws = await rect(page, ".workspace");
    const sheet = await rect(page, ".editor-paper");
    const bar = await rect(page, ".format-bar");
    const footer = await rect(page, ".pane-footer");
    expect(Math.abs(box.right - (ws.right - GAP))).toBeLessThanOrEqual(1);
    expect(box.top).toBeGreaterThanOrEqual(bar.bottom - 0.5);
    expect(box.left - GAP).toBeGreaterThanOrEqual(sheet.right - 0.5);
    expect(box.bottom).toBeLessThanOrEqual(footer.top + 0.5);
    // The topbar (Toggle sidebar, Snapshot, export) is never covered.
    for (const button of await page.locator(".topbar button").all()) {
      const b = await button.evaluate((el) => {
        const r = el.getBoundingClientRect();
        return { left: r.left, right: r.right, top: r.top, bottom: r.bottom };
      });
      expect(intersects(box, b)).toBe(false);
    }
    expect(intersects(box, bar)).toBe(false);
    // The sidebar still floats (no aside took the right side).
    await expect(shell(page)).toHaveClass(/is-floating/);
  });

  test("no drift: DOI -> preview -> Cite here stores what the panel stores", async ({ browser }) => {
    const run = async (floating: boolean) => {
      const context = await browser.newContext({ viewport: { width: 1600, height: 900 } });
      const page = await context.newPage();
      await writingProject(page, "Drift " + (floating ? "card" : "panel"), floating);
      if (floating) await citeDoiInCard(page);
      else {
        await researchHeader(page).click();
        await expect(aside(page)).toBeVisible();
        await expect(card(page)).toHaveCount(0);
        await page.getByRole("textbox", { name: "DOI, ISBN, or web address" }).fill("10.1234/example");
        await page.getByRole("button", { name: "Look up", exact: true }).click();
        await expect(page.locator(".research-status")).toHaveText("Found on Crossref -- review the details");
        await page.getByRole("button", { name: "Cite here", exact: true }).click();
        await expect(writingEditor(page).locator("[data-footnote-id]")).toHaveCount(1);
      }
      await expect.poll(async () => (await storedProject(page))?.research?.footnotes?.length ?? 0, { timeout: 15000 }).toBe(1);
      await settle(page);
      const project = await storedProject(page);
      await context.close();
      return project;
    };
    const panel = await run(false);
    const viaCard = await run(true);
    // Anchored: the footnote cites the looked-up source and the source holds Crossref's data.
    for (const p of [panel, viaCard]) {
      const [source] = p.research.sources;
      const [footnote] = p.research.footnotes;
      expect(footnote.sourceId).toBeDefined();
      expect(footnote.sourceId).toBe(source.id);
      expect(source).toMatchObject({
        title: "Narrative Structure in Practice",
        authors: ["Jane Smith", "Omar Reyes"],
        journal: "Journal of Examples",
        volume: "12",
        issue: "3",
        pages: "45–67",
        year: "2024",
        doi: "10.1234/example",
      });
    }
    expect(normalise(viaCard)).toEqual(normalise(panel));
  });

  test("Add another gives an empty lookup with focus", async ({ page }) => {
    await writingProject(page, "Card add another", true);
    await citeDoiInCard(page);
    // After Cite here focus moves to the card's Page field. A cited note no longer
    // opens its empty text field, which hid the citation (v0.2.1; replaces decision C5).
    await settle(page);
    await expect(page.locator(".footnote-input")).toHaveCount(0);
    await expect(page.getByLabel("Page", { exact: true })).toBeFocused();
    await expect(card(page)).toHaveAttribute("data-stage", "cited");
    expect(await writingEditor(page).evaluate((el) => el.textContent)).toMatch(/^Evidence here\.1/);
    await card(page).getByRole("button", { name: "Add another", exact: true }).click();
    await expect(card(page)).toHaveAttribute("data-stage", "new");
    const lookup = page.getByLabel("DOI, ISBN or web address", { exact: true });
    await expect(lookup).toHaveValue("");
    await expect(lookup).toBeFocused();
  });

  test("a footnote number opens its card; Page edits the locator; Escape returns to the editor", async ({ page }) => {
    await writingProject(page, "Card footnote", true);
    await citeDoiInCard(page);
    await page.getByLabel("Page", { exact: true }).fill("45");
    await card(page).getByRole("button", { name: "Done", exact: true }).click();
    await expect(card(page)).toHaveCount(0);
    await writingEditor(page).locator("[data-footnote-id]").first().click();
    await expect(card(page)).toBeVisible();
    await expect(card(page)).toHaveAttribute("data-stage", "cited");
    await expect(card(page)).toHaveAccessibleName("Edit citation");
    await expect(card(page).getByRole("heading")).toHaveText("Edit citation");
    await expect(aside(page)).toHaveCount(0);
    const pageField = page.getByLabel("Page", { exact: true });
    await expect(pageField).toHaveValue("45");
    await expect(pageField).toBeFocused();
    await pageField.fill("52");
    await expect
      .poll(async () => (await storedProject(page))?.research?.footnotes?.[0]?.locator, { timeout: 15000 })
      .toBe("52");
    await page.keyboard.press("Escape");
    await expect(card(page)).toHaveCount(0);
    await expect(writingEditor(page)).toBeFocused();
  });

  test("the card's link opens the full panel with the source expanded; its X closes it", async ({ page }) => {
    await writingProject(page, "Card link", true);
    await citeDoiInCard(page);
    await card(page).getByRole("button", { name: "Open full research panel", exact: true }).click();
    await expect(card(page)).toHaveCount(0);
    await expect(aside(page)).toBeVisible();
    await expect(aside(page).getByLabel("Title", { exact: true })).toHaveValue("Narrative Structure in Practice");
    await page.getByRole("button", { name: "Close research", exact: true }).click();
    await expect(aside(page)).toHaveCount(0);
    // The heading opens the card again after the panel closed.
    await researchHeader(page).click();
    await expect(card(page)).toBeVisible();
  });

  test("source and note rows in the sidebar open the full panel", async ({ page }) => {
    await writingProject(page, "Card rows", true);
    await citeDoiInCard(page);
    await card(page).getByRole("button", { name: "Done", exact: true }).click();
    await page.locator(".sidebar .entry-main").filter({ hasText: /Narrative Structure/ }).first().click();
    await expect(aside(page)).toBeVisible();
    await expect(card(page)).toHaveCount(0);
  });

  test("a narrow window falls back to the research panel", async ({ page }) => {
    await page.setViewportSize({ width: 1100, height: 800 });
    await writingProject(page, "Card narrow", true);
    await researchHeader(page).click();
    await expect(aside(page)).toBeVisible();
    await expect(card(page)).toHaveCount(0);
  });

  test("narrowing the window while the card is open swaps it for the panel", async ({ page }) => {
    await writingProject(page, "Card narrowing", true);
    await researchHeader(page).click();
    await expect(card(page)).toBeVisible();
    await page.setViewportSize({ width: 1100, height: 800 });
    await settle(page);
    await expect(aside(page)).toBeVisible();
    await expect(card(page)).toHaveCount(0);
    await expect(page.locator(".aside-resizer")).toHaveCount(1);
  });

  test("T5: a 1240 window at 75 %: the docked sidebar's room counts, so the sidebar floats and Research opens the card", async ({ page }) => {
    await page.setViewportSize({ width: 1240, height: 840 });
    await writingProject(page, "Fit freed room", true);
    await setZoom(page, 75);
    await settle(page);
    await expect(shell(page)).toHaveClass(/is-floating/);
    await expectClear(page, ".editor-paper");
    await researchHeader(page).click();
    await expect(card(page)).toBeVisible();
    await expect(aside(page)).toHaveCount(0);
  });

  test("T5: widening the window while the research panel is open hands it back to the card", async ({ page }) => {
    await page.setViewportSize({ width: 1100, height: 800 });
    await writingProject(page, "Card widened", true);
    await researchHeader(page).click();
    await expect(aside(page)).toBeVisible();
    await page.setViewportSize({ width: 1600, height: 900 });
    await settle(page);
    await expect(card(page)).toBeVisible();
    await expect(aside(page)).toHaveCount(0);
  });

  test("T5: a toast raised while the card is open never covers the card or the sheet", async ({ page }) => {
    await writingProject(page, "Toast card", true);
    await researchHeader(page).click();
    await expect(card(page)).toBeVisible();
    await page.getByRole("button", { name: "Snapshot", exact: true }).click();
    await page.getByLabel("Snapshot name").fill("A snapshot while the card is open");
    await page.getByRole("button", { name: "Save", exact: true }).click();
    await expect(page.locator(".notice")).toBeVisible();
    await settle(page);
    const toast = await rect(page, ".notice");
    const box = await cardRect(page);
    expect(intersects(toast, box)).toBe(false);
    // Wave 6 R: it moves left of the card only when the card reaches its corner, so it never lands on the sheet.
    expect(intersects(toast, await rect(page, ".editor-paper"))).toBe(false);
  });

  test("T5: on a short window the card reaches the toast's corner, so the toast sits left of it", async ({ page }) => {
    await page.setViewportSize({ width: 1600, height: 420 });
    await writingProject(page, "Toast short", true);
    await researchHeader(page).click();
    await expect(card(page)).toBeVisible();
    await page.getByRole("button", { name: "Snapshot", exact: true }).click();
    await page.getByLabel("Snapshot name").fill("Short window snapshot");
    await page.getByRole("button", { name: "Save", exact: true }).click();
    await expect(page.locator(".notice")).toBeVisible();
    await settle(page);
    const toast = await rect(page, ".notice");
    const box = await cardRect(page);
    expect(box.bottom + GAP).toBeGreaterThan(420 - GAP - 80);
    expect(intersects(toast, box)).toBe(false);
    expect(toast.right).toBeLessThanOrEqual(box.left - GAP + 0.5);
  });

  test("T5: a toast raised while the research panel is open sits left of the panel", async ({ page }) => {
    await page.setViewportSize({ width: 1100, height: 800 });
    await writingProject(page, "Toast panel", true);
    await researchHeader(page).click();
    await expect(aside(page)).toBeVisible();
    await page.getByRole("button", { name: "Snapshot", exact: true }).click();
    await page.getByLabel("Snapshot name").fill("A snapshot while the panel is open");
    await page.getByRole("button", { name: "Save", exact: true }).click();
    await expect(page.locator(".notice")).toBeVisible();
    await settle(page);
    const toast = await rect(page, ".notice");
    const panel = await rect(page, ".research-aside");
    expect(intersects(toast, panel)).toBe(false);
  });

  // T229 r2 reject: page view 100 %, Research opened at 940 then widened, flipped forever between
  // "sidebar floating + panel" and "sidebar docked + card over the sheet". Both sides are now judged
  // together, so each width has one steady state that never covers the sheet.
  for (const [label, widths] of [
    ["widening", [940, 1000, 1100, 1240, 1400, 1600]],
    ["narrowing", [1600, 1400, 1240, 1100, 1000, 940]],
  ] as const) {
    test(`T5: page view, Research open, ${label}: one steady state per width, never over the sheet`, async ({ page }) => {
      await page.setViewportSize({ width: widths[0], height: 800 });
      await writingProject(page, `Coupled fit ${label}`, true);
      await settle(page);
      await researchHeader(page).click();
      await settle(page);
      for (const w of widths) {
        await page.setViewportSize({ width: w, height: 800 });
        await settle(page);
        await settle(page);
        const states = new Set<string>();
        const samples = w >= 1400 ? 15 : 3;
        for (let i = 0; i < samples; i++) {
          const s = await page.evaluate(() => {
            const r = (q: string) => {
              const e = document.querySelector(q);
              if (!e) return null;
              const b = e.getBoundingClientRect();
              return { left: b.left, right: b.right, top: b.top, bottom: b.bottom };
            };
            return {
              floating: !!document.querySelector(".sidebar-shell.is-floating"),
              side: r("aside.sidebar"),
              card: r(".citation-card"),
              panel: !!document.querySelector(".research-aside"),
              sheet: r(".editor-paper"),
            };
          });
          states.add(`${w}: floating=${s.floating} card=${!!s.card} panel=${s.panel}`);
          expect(s.sheet).not.toBeNull();
          if (s.floating && s.side) expect(s.side.right + GAP, `${w}: sidebar right ${s.side.right} vs sheet left ${s.sheet!.left}`).toBeLessThanOrEqual(s.sheet!.left + 0.5);
          if (s.card) expect(s.card.left - GAP, `${w}: card left ${s.card.left} vs sheet right ${s.sheet!.right}`).toBeGreaterThanOrEqual(s.sheet!.right - 0.5);
          expect(!!s.card || s.panel, `${w}: research shows as card or panel`).toBe(true);
          await page.waitForTimeout(200);
        }
        expect([...states], `${w}: the state must not change while the window stands still`).toHaveLength(1);
        // At 1600 both fit together (margins 392): the sidebar floats and Research is the card.
        if (w === 1600) expect([...states][0]).toBe("1600: floating=true card=true panel=false");
      }
    });
  }

  test("floating off: the research panel as before", async ({ page }) => {
    await writingProject(page, "Card off", false);
    await researchHeader(page).click();
    await expect(aside(page)).toBeVisible();
    await expect(page.locator(".aside-resizer")).toHaveCount(1);
    await expect(card(page)).toHaveCount(0);
  });

  test("Reduce Motion: the card opens without a transition", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await writingProject(page, "Card reduced", true);
    await researchHeader(page).click();
    await expect(card(page)).toBeVisible();
    const durations = await card(page).evaluate((el) => getComputedStyle(el).transitionDuration);
    expect(durations.split(",").every((d) => parseFloat(d) === 0)).toBe(true);
    expect(await card(page).evaluate((el) => getComputedStyle(el).opacity)).toBe("1");
  });

  test("keyboard only: manual entry, Cite here, Add another, Escape returns focus", async ({ page }) => {
    await writingProject(page, "Card keyboard", true);
    await researchHeader(page).focus();
    await page.keyboard.press("Enter");
    await expect(card(page)).toBeVisible();
    // A key open never animates.
    await expect(card(page)).not.toHaveAttribute("data-animate", "");
    await expect(page.getByLabel("DOI, ISBN or web address", { exact: true })).toBeFocused();
    const tabTo = async (name: string) => {
      for (let i = 0; i < 40; i++) {
        const label = await page.evaluate(() => {
          const el = document.activeElement as HTMLElement | null;
          return el?.getAttribute("aria-label") ?? el?.textContent?.trim() ?? "";
        });
        if (label === name) return;
        await page.keyboard.press("Tab");
      }
      throw new Error("never reached " + name);
    };
    await tabTo("Enter manually");
    await page.keyboard.press("Enter");
    await expect(card(page)).toHaveAttribute("data-stage", "preview");
    const focusedId = await page.evaluate(() => document.activeElement?.id ?? "");
    expect(focusedId).toMatch(/-(authors|title)$/);
    await page.keyboard.type("Charles Yu");
    await tabTo("Cite here");
    await page.keyboard.press("Enter");
    await expect(card(page)).toHaveAttribute("data-stage", "cited");
    // The footnote lands at the caret, after the text typed before opening.
    const marker = writingEditor(page).locator("[data-footnote-id]");
    await expect(marker).toHaveCount(1);
    expect(await writingEditor(page).evaluate((el) => el.textContent)).toMatch(/^Evidence here\.1/);
    // Focus moves to the card's Page field (v0.2.1; replaces decision C5).
    await expect(page.locator(".footnote-input")).toHaveCount(0);
    await expect(card(page)).toHaveAttribute("data-stage", "cited");
    await expect(page.getByLabel("Page", { exact: true })).toBeFocused();
    await page.keyboard.type("9");
    await tabTo("Add another");
    await page.keyboard.press("Enter");
    await expect(page.getByLabel("DOI, ISBN or web address", { exact: true })).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(card(page)).toHaveCount(0);
    await expect(researchHeader(page)).toBeFocused();
    await expect
      .poll(async () => (await storedProject(page))?.research?.footnotes?.[0]?.locator, { timeout: 15000 })
      .toBe("9");
    expect((await storedProject(page)).research.sources[0].authors).toEqual(["Charles Yu"]);
  });

  test("focus mode: the card sits below the reveal band and the revealed toolbar does not cover it", async ({ page }) => {
    await writingProject(page, "Card focus", true);
    await writingEditor(page).press("ControlOrMeta+Shift+F");
    await expect(page.locator(".writer[data-focus-toolbar]")).toHaveCount(1);
    await settle(page);
    await researchHeader(page).click();
    await expect(card(page)).toBeVisible();
    const band = await page.locator(".writer").evaluate((el) => {
      const s = getComputedStyle(el);
      const px = (v: string) => parseFloat(s.getPropertyValue(v));
      return el.getBoundingClientRect().top + px("--control-height") + 2 * px("--space-1");
    });
    await expect.poll(async () => (await cardRect(page)).top).toBeGreaterThanOrEqual(band - 0.5);
    // Reveal the toolbar with the pointer at the top of the writer.
    const writer = await rect(page, ".writer");
    await page.mouse.move(800, writer.top + 4);
    await settle(page);
    expect(intersects(await cardRect(page), await rect(page, ".format-bar"))).toBe(false);
  });

  test("split view: the heading and a footnote number open the panel", async ({ page }) => {
    await writingProject(page, "Card split", true);
    await citeDoiInCard(page);
    await card(page).getByRole("button", { name: "Done", exact: true }).click();
    await page.getByRole("button", { name: "New section", exact: true }).click();
    await page.getByLabel("Title", { exact: true }).fill("Second");
    await page.getByRole("button", { name: "Save", exact: true }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    const rows = page.locator(".sidebar [data-group=\"manuscript\"] .entry-main");
    await rows.first().click();
    await page.locator(".sidebar .entry-main").filter({ hasText: /^Second/ }).click({ modifiers: ["ControlOrMeta"] });
    await expect(page.locator(".split-pane")).toHaveCount(2);
    await researchHeader(page).click();
    await expect(aside(page)).toBeVisible();
    await expect(card(page)).toHaveCount(0);
    await page.getByRole("button", { name: "Close research", exact: true }).click();
    const footnote = page.locator(".split-pane [data-footnote-id]").first();
    const id = await footnote.getAttribute("data-footnote-id");
    await footnote.click();
    await expect(aside(page)).toBeVisible();
    await expect(card(page)).toHaveCount(0);
    // The panel focuses the clicked footnote, not another one.
    await expect(aside(page).locator(`[data-research-id="${id}"]`)).toBeFocused();
  });
});

// Card screenshots (light/dark x Plain/Color): new, preview, cited, opened from
// a footnote, focus mode, and the narrow fallback. PW_SHOTS_DIR as above.
test.describe("citation card screenshots", () => {
  test.use({ viewport: { width: 1600, height: 900 } });

  test("card states in light/dark, Plain/Color", async ({ page }, testInfo) => {
    test.setTimeout(300_000);
    const dir = process.env.PW_SHOTS_DIR;
    const out = (name: string) => (dir ? `${dir}/${name}` : testInfo.outputPath(name));
    await writingProject(page, "Card screens", true);
    await citeDoiInCard(page);
    await card(page).getByRole("button", { name: "Done", exact: true }).click();
    for (const palette of ["plain", "color"]) {
      for (const theme of ["light", "dark"]) {
        await page.evaluate(
          ([t, p]) => localStorage.setItem("folio.workspace.appearance", JSON.stringify({ theme: t, palette: p })),
          [theme, palette],
        );
        await page.reload();
        await expect(writingEditor(page)).toBeVisible();
        await setPaged(page, true);
        const tag = `${palette}-${theme}`;
        await researchHeader(page).click();
        await expect(card(page)).toHaveAttribute("data-stage", "new");
        await settle(page);
        await page.screenshot({ path: out(`card-new-${tag}.png`) });
        await page.getByLabel("DOI, ISBN or web address", { exact: true }).fill("10.1234/example");
        await card(page).getByRole("button", { name: "Look up", exact: true }).click();
        await expect(card(page)).toHaveAttribute("data-stage", "preview");
        await settle(page);
        await page.screenshot({ path: out(`card-preview-${tag}.png`) });
        await card(page).getByRole("button", { name: "Cite here", exact: true }).click();
        await expect(card(page)).toHaveAttribute("data-stage", "cited");
        await settle(page);
        await page.screenshot({ path: out(`card-cited-${tag}.png`) });
        await card(page).getByRole("button", { name: "Close citation card", exact: true }).click();
        await expect(card(page)).toHaveCount(0);
        await writingEditor(page).locator("[data-footnote-id]").first().click();
        await expect(card(page)).toHaveAttribute("data-stage", "cited");
        await settle(page);
        await page.screenshot({ path: out(`card-footnote-${tag}.png`) });
        await page.keyboard.press("Escape");
        await writingEditor(page).press("ControlOrMeta+Shift+F");
        await expect(page.locator(".writer[data-focus-toolbar]")).toHaveCount(1);
        await researchHeader(page).click();
        await expect(card(page)).toBeVisible();
        await settle(page);
        await page.screenshot({ path: out(`card-focus-${tag}.png`) });
        await page.keyboard.press("Escape");
        await writingEditor(page).press("ControlOrMeta+Shift+F");
        await expect(page.locator(".writer[data-focus-toolbar]")).toHaveCount(0);
      }
    }
    await page.evaluate(() =>
      localStorage.setItem("folio.workspace.appearance", JSON.stringify({ theme: "light", palette: "plain" })),
    );
    await page.setViewportSize({ width: 1100, height: 800 });
    await page.reload();
    await expect(writingEditor(page)).toBeVisible();
    await setPaged(page, true);
    await researchHeader(page).click();
    await expect(aside(page)).toBeVisible();
    await settle(page);
    await page.screenshot({ path: out("card-narrow-fallback.png") });
  });
});

test.describe("floating sidebar: zoomed continuous view", () => {
  test.use({ viewport: { width: 1600, height: 800 } });
  const widths = [940, 980, 1020, 1040, 1060, 1080, 1100, 1140, 1180, 1240, 1300, 1400, 1500, 1600];

  for (const zoom of [125, 150]) {
    test(`continuous view at ${zoom} %: never over the text, same state resizing up and down`, async ({ page }) => {
      await seedFloating(page, true);
      await create(page, `Floating cont ${zoom}`);
      await setPaged(page, false);
      const ed = page.getByRole("textbox", { name: "Writing editor", exact: true });
      await ed.click();
      await ed.pressSequentially("A line of text for the column.");
      await setZoom(page, zoom);
      await settle(page);
      const state = async (w: number) => {
        await page.setViewportSize({ width: w, height: 800 });
        await settle(page);
        await settle(page);
        const floating = await shell(page).evaluate((el) => el.classList.contains("is-floating"));
        if (floating) await expectClear(page, ".writing-surface");
        return floating;
      };
      const up: Record<number, boolean> = {};
      const down: Record<number, boolean> = {};
      for (const w of widths) up[w] = await state(w);
      for (const w of [...widths].reverse()) down[w] = await state(w);
      expect(down).toEqual(up);
    });
  }
});
