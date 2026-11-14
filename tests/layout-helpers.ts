import { expect, type Locator, type Page } from "@playwright/test";

// Layout-primitives helpers (plan T0, docs/agent-work/2026-11-12-layout-primitives/PLAN.md).
// They measure relationships (shared edges, even rows, slot sizes), not recorded pixel numbers.
// Every measuring helper first waits until no animation is running (popover reveals, staggers),
// so a reveal never skews a box. No import("/src/...") in the page: they work on the built app.

export type Ink = { left: number; right: number; top: number; bottom: number };
type Many = Locator | Locator[];

/** Waits until the page has no running animations (popover reveal, item stagger, morphs). */
async function settled(page: Page) {
  await page.waitForFunction(() =>
    document.getAnimations().every((a) => a.playState !== "running" && a.playState !== "pending"),
  );
}

/** Every element a Locator (or list of Locators) matches, in order. */
async function each(many: Many): Promise<Locator[]> {
  const list = Array.isArray(many) ? many : [many];
  const out: Locator[] = [];
  for (const l of list) out.push(...(await l.all()));
  return out;
}

/**
 * The bounding box of the visible ink inside one element: the union of its rendered text runs
 * and its visible <svg> boxes, not the element's padded box. Hidden, aria-hidden-by-display and
 * zero-size parts are ignored. Throws if the element draws no text and no icon.
 */
export async function ink(locator: Locator): Promise<Ink> {
  await settled(locator.page());
  const box = await locator.evaluate((root) => {
    let left = Infinity;
    let right = -Infinity;
    let top = Infinity;
    let bottom = -Infinity;
    const add = (r: DOMRect) => {
      if (r.width <= 0 || r.height <= 0) return;
      left = Math.min(left, r.left);
      right = Math.max(right, r.right);
      top = Math.min(top, r.top);
      bottom = Math.max(bottom, r.bottom);
    };
    const shown = (el: Element) => {
      for (let n: Element | null = el; n && n !== root.parentElement; n = n.parentElement) {
        const cs = getComputedStyle(n);
        if (cs.display === "none" || cs.visibility === "hidden" || Number(cs.opacity) === 0) return false;
      }
      return true;
    };
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT);
    for (let node: Node | null = root; node; node = walker.nextNode()) {
      if (node.nodeType === Node.TEXT_NODE) {
        if (!(node.textContent ?? "").trim() || !node.parentElement || !shown(node.parentElement)) continue;
        const range = document.createRange();
        range.selectNodeContents(node);
        for (const r of range.getClientRects()) add(r);
      } else if (node instanceof SVGSVGElement && shown(node)) {
        add(node.getBoundingClientRect());
      }
    }
    return Number.isFinite(left) ? { left, right, top, bottom } : null;
  });
  if (!box) throw new Error(`ink(): ${locator} draws no visible text or icon`);
  return box;
}

/** The ink of every given element shares one left or right edge, within `tol` px. */
export async function expectSharedEdge(page: Page, locators: Many, side: "left" | "right", tol = 1) {
  await settled(page);
  const items = await each(locators);
  expect(items.length, "expectSharedEdge needs at least two elements").toBeGreaterThanOrEqual(2);
  const edges: number[] = [];
  for (const item of items) edges.push((await ink(item))[side]);
  const spread = Math.max(...edges) - Math.min(...edges);
  expect(spread, `${side} ink edges ${edges.map((e) => e.toFixed(1)).join(", ")}`).toBeLessThanOrEqual(tol);
}

/** Rows in order: equal heights, equal gaps between neighbours, and no overlap, within `tol` px. */
export async function expectEvenRows(rows: Many, tol = 1) {
  const items = await each(rows);
  expect(items.length, "expectEvenRows needs at least two rows").toBeGreaterThanOrEqual(2);
  await settled(items[0].page());
  const boxes: { y: number; height: number }[] = [];
  for (const item of items) {
    const b = await item.boundingBox();
    if (!b) throw new Error(`expectEvenRows: ${item} is not visible`);
    boxes.push({ y: b.y, height: b.height });
  }
  const heights = boxes.map((b) => b.height);
  const gaps = boxes.slice(1).map((b, i) => b.y - (boxes[i].y + boxes[i].height));
  const fmt = (list: number[]) => list.map((n) => n.toFixed(1)).join(", ");
  expect(Math.max(...heights) - Math.min(...heights), `row heights ${fmt(heights)}`).toBeLessThanOrEqual(tol);
  expect(Math.min(...gaps), `rows overlap: gaps ${fmt(gaps)}`).toBeGreaterThanOrEqual(-0.5);
  expect(Math.max(...gaps) - Math.min(...gaps), `row gaps ${fmt(gaps)}`).toBeLessThanOrEqual(tol);
}

/** Every given element is a `w` x `h` box (border box, within 0.5 px). */
export async function expectSlots(locators: Many, w: number, h: number) {
  const items = await each(locators);
  expect(items.length, "expectSlots matched nothing").toBeGreaterThan(0);
  await settled(items[0].page());
  for (const item of items) {
    const b = await item.boundingBox();
    if (!b) throw new Error(`expectSlots: ${item} is not visible`);
    expect(Math.abs(b.width - w), `${item} width ${b.width}`).toBeLessThanOrEqual(0.5);
    expect(Math.abs(b.height - h), `${item} height ${b.height}`).toBeLessThanOrEqual(0.5);
  }
}

/**
 * Isolated browser storage only: creates a new Blank project called `title` through the app's
 * own Projects screen, types one paragraph into its first section and waits until it is saved.
 * Returns the writing editor.
 */
export async function openProjectWithEntry(page: Page, title: string): Promise<Locator> {
  await page.addInitScript(() => localStorage.setItem("personal-word.restoreTabs", "true"));
  await page.goto("/");
  await page.getByRole("button", { name: "Start new project" }).click();
  await page.getByRole("button", { name: "Blank", exact: true }).click();
  await page.getByLabel("Project title").fill(title);
  await page.getByRole("button", { name: "Save", exact: true }).click();
  const editor = page.getByRole("textbox", { name: "Writing editor" });
  await expect(editor).toBeVisible();
  await editor.fill("The opening paragraph of the first section.");
  await expect(page.getByText("Saved", { exact: true })).toBeVisible({ timeout: 10_000 });
  return editor;
}
