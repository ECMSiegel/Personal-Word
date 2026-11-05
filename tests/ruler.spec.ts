import { expect, test, type Page } from "@playwright/test";
import { dense, seedBlocks, setZoom, togglePageView } from "./pages-helpers";

async function createProject(page: Page, title: string) {
  await page.goto("/");
  await page.getByRole("button", { name: "Start new project" }).click();
  await page.getByRole("button", { name: "Blank", exact: true }).click();
  await page.getByLabel("Project title").fill(title);
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByRole("textbox", { name: "Writing editor" })).toBeVisible();
}

/** The Ruler toggle lives in the Page setup panel (T237 D7). */
async function setRuler(page: Page, on: boolean) {
  const toggle = page.getByRole("button", { name: "Ruler", exact: true });
  let opened = false;
  if (!(await toggle.isVisible())) {
    await page.getByRole("button", { name: "Page setup", exact: true }).click();
    opened = true;
  }
  if ((await toggle.getAttribute("aria-pressed")) !== String(on)) await toggle.click();
  await expect(toggle).toHaveAttribute("aria-pressed", String(on));
  if (opened) await page.keyboard.press("Escape");
}

async function setMode(page: Page, mode: "continuous" | "pages") {
  const want = mode === "pages";
  const button = page.getByRole("button", { name: "Page view", exact: true });
  if ((await button.isVisible()) && (await button.getAttribute("aria-pressed")) === String(want)) return;
  if (!(await button.isVisible())) {
    // Nothing to change when the bar already shows the wanted mode.
    const cls = await page.locator(".editor-viewport").first().getAttribute("class");
    if (/is-paged/.test(cls ?? "") === want) return;
  }
  await togglePageView(page);
  await expect(page.locator(".editor-viewport").first()).toHaveClass(want ? /is-paged/ : /is-continuous/);
}

// Text edge = the .ProseMirror box. Continuous view has no inner padding (editor.css), so the first glyph
// sits on it too (checked below). The marker marks the margin, i.e. this box.
/** Geometry of one pane's ruler, paper and text, in screen px. `prefix` scopes a split pane. */
async function measure(page: Page, prefix = "") {
  return page.evaluate((scope) => {
    const rect = (selector: string) => {
      const el = document.querySelector(`${scope} ${selector}`.trim());
      if (!el) throw new Error(`missing ${selector}`);
      return el.getBoundingClientRect();
    };
    const ruler = rect(".document-ruler");
    const paper = rect(".editor-paper");
    const text = rect(".ProseMirror");
    const left = rect(".ruler-margin-marker--left");
    const right = rect(".ruler-margin-marker--right");
    const tick = rect(".ruler-tick");
    return {
      rulerLeft: ruler.left,
      rulerRight: ruler.right,
      paperLeft: paper.left,
      paperRight: paper.right,
      textLeft: text.left,
      textRight: text.right,
      leftPoint: left.left + left.width / 2,
      rightPoint: right.left + right.width / 2,
      tickLeft: tick.left,
    };
  }, prefix);
}

async function expectAligned(page: Page, label: string, prefix = "") {
  const m = await measure(page, prefix);
  const near = (name: string, a: number, b: number) =>
    expect(Math.abs(a - b), `${label}: ${name} (${a.toFixed(1)} vs ${b.toFixed(1)})`).toBeLessThanOrEqual(1);
  near("ruler left = paper left", m.rulerLeft, m.paperLeft);
  near("ruler right = paper right", m.rulerRight, m.paperRight);
  near("ruler 0 = paper left", m.tickLeft, m.paperLeft);
  near("left marker point = text left", m.leftPoint, m.textLeft);
  near("right marker point = text right", m.rightPoint, m.textRight);
}

async function noHorizontalScroll(page: Page, label: string) {
  const overflow = await page.evaluate(() =>
    Array.from(document.querySelectorAll<HTMLElement>(".writer-scroll")).map((el) => el.scrollWidth - el.clientWidth),
  );
  expect(overflow.length, label).toBeGreaterThan(0);
  for (const extra of overflow) expect(extra, `${label}: horizontal overflow`).toBeLessThanOrEqual(0);
}

const savedProject = (page: Page, title: string) =>
  page.evaluate((t) => {
    const project = Object.keys(localStorage)
      .filter((key) => key.startsWith("folio.preview.project."))
      .map((key) => JSON.parse(localStorage.getItem(key)!))
      .find((item) => item.title === t);
    return {
      margin: project?.documentSettings?.marginInches,
      layoutMargin: project?.pageLayout?.margin,
      topGap: project?.pageLayout?.topGap,
    };
  }, title);

test.use({ viewport: { width: 1440, height: 900 } });

test("ruler toggles on and exposes keyboard-accessible linked margin markers", async ({ page }) => {
  await createProject(page, "Ruler margins");
  await setZoom(page, 75);
  await setRuler(page, false);
  await expect(page.locator(".document-ruler")).toHaveCount(0);
  await setRuler(page, true);
  await expect.poll(() => page.evaluate(() => localStorage.getItem("folio.workspace.ruler"))).toBe("true");
  const ruler = page.locator(".document-ruler");
  await expect(ruler).toBeVisible();
  await expect(ruler.locator(".ruler-tick").first()).toBeAttached();
  const left = page.getByRole("slider", { name: "Adjust left and right margins from the left" });
  const right = page.getByRole("slider", { name: "Adjust left and right margins from the right" });
  await expect(left).toBeVisible();
  await expect(right).toBeVisible();

  const paper = page.locator(".editor-paper");
  const margin = () => paper.evaluate((el) => getComputedStyle(el).getPropertyValue("--page-margin").trim());
  const before = await margin();
  const leftBox = (await left.boundingBox())!;
  await page.mouse.move(leftBox.x + leftBox.width / 2, leftBox.y + leftBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(leftBox.x + leftBox.width / 2 + 18, leftBox.y + leftBox.height / 2);
  await page.mouse.up();
  // 18 screen px at 75% zoom is 24 page px.
  await expect(left).toHaveAttribute("aria-valuenow", "120");
  await expect(right).toHaveAttribute("aria-valuenow", "120");
  await expect.poll(margin).not.toBe(before);
  expect(await margin()).toBe("120px");
  await expectAligned(page, "after drag");
  await left.focus();
  await page.keyboard.press("ArrowRight");
  await expect.poll(margin).toBe("126px");
  await expectAligned(page, "after key");
  await page.keyboard.press("ControlOrMeta+z");
  await expect(paper).toHaveCSS("--page-margin", "126px");

  await setRuler(page, false);
  await expect(page.locator(".document-ruler")).toHaveCount(0);
  await expect.poll(() => page.evaluate(() => localStorage.getItem("folio.workspace.ruler"))).toBe("false");
});

for (const mode of ["continuous", "pages"] as const) {
  for (const zoom of [75, 100, 150]) {
    test(`ruler box and markers match the page: ${mode} view at ${zoom}%`, async ({ page }) => {
      await createProject(page, `Ruler align ${mode} ${zoom}`);
      await setMode(page, mode);
      await setZoom(page, zoom);
      await setRuler(page, true);
      await expect(page.locator(".document-ruler")).toBeVisible();
      await noHorizontalScroll(page, `${mode} ${zoom}%`);
      await expectAligned(page, `${mode} ${zoom}% default margin`);
      // A non-default margin moves the markers with the text, not by a fixed offset.
      const left = page.getByRole("slider", { name: "Adjust left and right margins from the left" });
      await left.focus();
      await page.keyboard.press("End");
      await expect(left).toHaveAttribute("aria-valuenow", "192");
      await expectAligned(page, `${mode} ${zoom}% 2 inch margin`);
      await noHorizontalScroll(page, `${mode} ${zoom}% 2 inch margin`);
    });
  }
}

test("ruler matches the page in a narrow window without horizontal scroll", async ({ page }) => {
  await createProject(page, "Ruler narrow");
  await setRuler(page, true);
  await page.setViewportSize({ width: 700, height: 900 });
  await expect(page.locator(".document-ruler")).toBeVisible();
  await expectAligned(page, "700px window");
  await noHorizontalScroll(page, "700px window");
});

test("each split pane's ruler matches its own paper, text and markers", async ({ page }) => {
  await createProject(page, "Ruler split");
  await page.getByRole("button", { name: "New section", exact: true }).click();
  await page.getByLabel("Title", { exact: true }).fill("Second section");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  const secondRow = page.locator(".sidebar .entry-main").filter({ hasText: /^Second section/ });
  const firstRow = page.locator(".sidebar .entry-main").filter({ hasText: /^Opening/ });
  await firstRow.click();
  await secondRow.click({ modifiers: ["ControlOrMeta"] });
  await expect(page.locator(".split-pane")).toHaveCount(2);

  await setRuler(page, true);
  await expect(page.locator(".split-pane .document-ruler")).toHaveCount(2);
  for (const side of ["left", "right"]) {
    await expectAligned(page, `split ${side} pane`, `.split-pane[data-side="${side}"]`);
  }
  await noHorizontalScroll(page, "split view");
  const a = await measure(page, '.split-pane[data-side="left"]');
  const b = await measure(page, '.split-pane[data-side="right"]');
  expect(a.rulerLeft).not.toBe(b.rulerLeft);
});

for (const mode of ["continuous", "pages"] as const) {
  test(`ruler stays pinned, opaque and on top of scrolled text: ${mode} view`, async ({ page }) => {
    await createProject(page, `Ruler scroll ${mode}`);
    await setMode(page, mode);
    await seedBlocks(page, dense(60));
    await setMode(page, mode);
    await setRuler(page, true);
    const scroller = page.locator(".writer-scroll").first();
    await scroller.evaluate((el) => (el.scrollTop = 700));
    await expect.poll(() => scroller.evaluate((el) => el.scrollTop)).toBeGreaterThan(300);
    const result = await page.evaluate(() => {
      const scroll = document.querySelector(".writer-scroll")!.getBoundingClientRect();
      const ruler = document.querySelector(".document-ruler")!;
      const box = ruler.getBoundingClientRect();
      const probe = document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2);
      return {
        offset: box.top - scroll.top,
        alpha: getComputedStyle(ruler).backgroundColor,
        covered: !!probe && ruler.contains(probe),
      };
    });
    expect(Math.abs(result.offset), "ruler pinned to the top of the scroller").toBeLessThanOrEqual(2);
    expect(result.alpha, "ruler background is opaque").toMatch(/^rgb\(/);
    expect(result.covered, "nothing but the ruler is drawn at its centre").toBe(true);
  });
}

test("a top gap below the ruler height keeps the first line and the gap handle off the ticks", async ({ page }) => {
  await createProject(page, "Ruler gap zero");
  await setMode(page, "continuous");
  await setRuler(page, true);
  const handle = page.getByRole("slider", { name: "Adjust continuous view top gap" });
  await handle.focus();
  await page.keyboard.press("Home");
  await expect(handle).toHaveAttribute("aria-valuenow", "0");
  const boxes = await page.evaluate(() => {
    const ruler = document.querySelector(".document-ruler")!.getBoundingClientRect();
    const grip = document.querySelector(".continuous-top-gap-handle")!.getBoundingClientRect();
    const line = document.querySelector(".ProseMirror p")!.getBoundingClientRect();
    return { rulerBottom: ruler.bottom, gripBottom: grip.bottom, lineTop: line.top };
  });
  expect(boxes.lineTop, "first line starts below the ruler").toBeGreaterThanOrEqual(boxes.rulerBottom - 1);
  expect(boxes.gripBottom, "handle sits above the first line").toBeLessThanOrEqual(boxes.lineTop + 1);
});

test("only the primary button drags a marker", async ({ page }) => {
  await createProject(page, "Ruler buttons");
  await setZoom(page, 150);
  await setRuler(page, true);
  const left = page.getByRole("slider", { name: "Adjust left and right margins from the left" });
  const start = await left.getAttribute("aria-valuenow");
  const box = (await left.boundingBox())!;
  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;
  for (const button of ["right", "middle"] as const) {
    await page.mouse.move(x, y);
    await page.mouse.down({ button });
    await page.mouse.move(x + 30, y);
    await page.mouse.up({ button });
  }
  await expect(left).toHaveAttribute("aria-valuenow", start!);
  await page.waitForTimeout(300);
  expect([undefined, Number(start)]).toContain((await savedProject(page, "Ruler buttons")).layoutMargin);
});

test("continuous top gap is ruler-only, screen-only and does not change page-view padding", async ({ page }) => {
  await createProject(page, "Ruler top gap");
  await setMode(page, "continuous");
  const paper = page.locator(".editor-paper");
  const gapHandle = page.getByRole("slider", { name: "Adjust continuous view top gap" });

  await expect(gapHandle).toHaveCount(0);
  await setRuler(page, true);
  await expect(gapHandle).toBeVisible();
  await expect(gapHandle).toHaveAttribute("aria-valuenow", "32");
  const marginHandle = page.getByRole("slider", { name: "Adjust left and right margins from the left" });
  await marginHandle.focus();
  await page.keyboard.press("ArrowRight");
  await expect(marginHandle).toHaveAttribute("aria-valuenow", "102");
  await expect.poll(() => paper.evaluate((el) => getComputedStyle(el).getPropertyValue("--page-margin").trim())).toBe("102px");
  await gapHandle.focus();
  await page.keyboard.press("ArrowDown");
  await expect(gapHandle).toHaveAttribute("aria-valuenow", "36");
  await expect.poll(() => paper.evaluate((el) => getComputedStyle(el).paddingTop)).toBe("36px");
  await expect.poll(() => savedProject(page, "Ruler top gap")).toEqual({ margin: 102 / 96, layoutMargin: 102, topGap: 36 });

  await togglePageView(page);
  await expect(page.locator(".editor-viewport")).toHaveClass(/is-paged/);
  await expect(gapHandle).toHaveCount(0);
  await expect.poll(() => paper.evaluate((el) => getComputedStyle(el).paddingTop)).toBe("102px");

  await setRuler(page, false);
  await expect(page.locator(".document-ruler")).toHaveCount(0);
});

test("a gap-only change leaves a different stored export margin alone", async ({ page }) => {
  await createProject(page, "Ruler guard");
  // Seed a project whose export margin (2 in) differs from its screen layout margin (96 px).
  await page.evaluate(() => {
    const key = Object.keys(localStorage).find((k) => k.startsWith("folio.preview.project."))!;
    const project = JSON.parse(localStorage.getItem(key)!);
    project.documentSettings = { ...project.documentSettings, marginInches: 2 };
    project.pageLayout = { ...project.pageLayout, mode: "continuous", margin: 96 };
    localStorage.setItem(key, JSON.stringify(project));
    localStorage.setItem("personal-word.restoreTabs", "true");
    localStorage.setItem("folio.lastProject", project.id);
  });
  await page.reload();
  await expect(page.getByRole("textbox", { name: "Writing editor" })).toBeVisible();
  await setRuler(page, true);
  const handle = page.getByRole("slider", { name: "Adjust continuous view top gap" });
  await handle.focus();
  await page.keyboard.press("ArrowDown");
  await expect(handle).toHaveAttribute("aria-valuenow", "36");
  await expect.poll(async () => (await savedProject(page, "Ruler guard")).topGap).toBe(36);
  const saved = await savedProject(page, "Ruler guard");
  expect(saved.margin, "gap change must not rewrite the export margin").toBe(2);
  expect(saved.layoutMargin).toBe(96);
  // A real margin change still reaches the export margin.
  const left = page.getByRole("slider", { name: "Adjust left and right margins from the left" });
  await left.focus();
  await page.keyboard.press("ArrowRight");
  await expect.poll(async () => (await savedProject(page, "Ruler guard")).margin).toBe(102 / 96);
});

/** Left edge of the first glyph of the first paragraph, and the left marker's point. */
async function glyphAndMarker(page: Page) {
  return page.evaluate(() => {
    const p = document.querySelector(".ProseMirror p")!;
    const walker = document.createTreeWalker(p, NodeFilter.SHOW_TEXT);
    const node = walker.nextNode()!;
    const range = document.createRange();
    range.setStart(node, 0);
    range.setEnd(node, 1);
    const marker = document.querySelector(".ruler-margin-marker--left")?.getBoundingClientRect();
    return {
      glyph: range.getBoundingClientRect().left,
      box: document.querySelector(".ProseMirror")!.getBoundingClientRect().left,
      marker: marker ? marker.left + marker.width / 2 : null,
    };
  });
}

for (const zoom of [75, 100, 150]) {
  test(`first glyph sits on the left marker in continuous view at ${zoom}%`, async ({ page }) => {
    await createProject(page, `Ruler glyph ${zoom}`);
    await seedBlocks(page, dense(3));
    await setMode(page, "continuous");
    await setZoom(page, zoom);
    await setRuler(page, false);
    const off = await glyphAndMarker(page);
    expect(Math.abs(off.glyph - off.box), `ruler off ${zoom}%: glyph vs text box`).toBeLessThanOrEqual(1);
    await setRuler(page, true);
    await expect(page.locator(".document-ruler")).toBeVisible();
    const on = await glyphAndMarker(page);
    expect(Math.abs(on.glyph - on.marker!), `ruler on ${zoom}%: glyph ${on.glyph} vs marker ${on.marker}`).toBeLessThanOrEqual(1);
  });
}

/** Focuses the editor with the caret at the end of the document, scrolled into view. */
async function caretToEnd(page: Page) {
  await page.locator(".ProseMirror").first().evaluate((el: any) => el.editor.commands.focus("end"));
  await expect.poll(() => page.evaluate(() => document.activeElement?.classList.contains("ProseMirror"))).toBe(true);
  await page.waitForTimeout(200);
}

// The caret's top edge, in screen px, from ProseMirror's own coordinates. The DOM range's
// first client rect can be the previous line's end at a soft wrap, so it is not used.
const caretTop = (page: Page) =>
  page.evaluate(() => {
    const view = (document.querySelector(".ProseMirror") as any)?.editor?.view;
    if (!view) return null;
    return view.coordsAtPos(view.state.selection.head, 1).top as number;
  });

for (const mode of ["continuous", "pages"] as const) {
  test(`caret never goes behind the ruler: ArrowUp and typing, ${mode} view`, async ({ page }) => {
    await createProject(page, `Ruler caret ${mode}`);
    await seedBlocks(page, dense(60));
    await setMode(page, mode);
    await setRuler(page, true);
    await caretToEnd(page);
    const bottom = () => page.evaluate(() => document.querySelector(".document-ruler")!.getBoundingClientRect().bottom);
    let hidden = 0;
    let sampled = 0;
    for (let i = 0; i < 110; i++) {
      await page.keyboard.press("ArrowUp");
      // ProseMirror scrolls on the selectionchange that follows the key.
      await page.waitForTimeout(60);
      const top = await caretTop(page);
      if (top === null) continue;
      sampled++;
      if (top < (await bottom()) - 1) hidden++;
    }
    expect(sampled, "caret was measured").toBeGreaterThan(90);
    expect(hidden, `${hidden} of ${sampled} ArrowUps left the caret behind the ruler`).toBe(0);
    await page.keyboard.type("TYPED");
    const top = await caretTop(page);
    expect(top, "caret measured after typing").not.toBeNull();
    expect(top!, "typed text is below the ruler").toBeGreaterThanOrEqual((await bottom()) - 1);
  });
}

// Below zoom 1 native WebKit reports the caret in zoomed space (see src/caretScroll.ts). Chromium
// reports drawn rects, so there the handler must stand aside: the caret stays clear at every zoom.
for (const mode of ["continuous", "pages"] as const) {
  for (const ruler of [true, false]) {
    test(`caret stays clear at 75% zoom: ${mode} view, ruler ${ruler ? "on" : "off"}`, async ({ page }) => {
      await createProject(page, `Ruler caret 75 ${mode} ${ruler}`);
      await seedBlocks(page, dense(60));
      await setMode(page, mode);
      await setZoom(page, 75);
      await setRuler(page, ruler);
      await caretToEnd(page);
      const floor = () =>
        page.evaluate(() => {
          const r = document.querySelector(".document-ruler");
          return (r ?? document.querySelector(".writer-scroll"))!.getBoundingClientRect()[r ? "bottom" : "top"];
        });
      let hidden = 0;
      for (let i = 0; i < 60; i++) {
        await page.keyboard.press("ArrowUp");
        await page.waitForTimeout(60);
        const top = await caretTop(page);
        if (top !== null && top < (await floor()) - 1) hidden++;
      }
      expect(hidden, `${hidden} of 60 ArrowUps left the caret above the floor`).toBe(0);
    });
  }
}

// Scroll offsets of every scrollable ancestor of the text, outermost last.
const scrolled = (page: Page) =>
  page.evaluate(() => {
    const out: number[] = [];
    for (let el: HTMLElement | null = document.querySelector<HTMLElement>(".ProseMirror"); el; el = el.parentElement)
      if (el.scrollHeight > el.clientHeight + 1 && /auto|scroll/.test(getComputedStyle(el).overflowY)) out.push(Math.round(el.scrollTop));
    return out.join("/");
  });

test("caret scrolling with the ruler off keeps the default margin", async ({ page }) => {
  await createProject(page, "Ruler caret off");
  await seedBlocks(page, dense(60));
  await setMode(page, "continuous");
  const scrollSettings = () =>
    page.evaluate(() => {
      const props = (document.querySelector(".ProseMirror") as any).editor.view.props;
      return { margin: props.scrollMargin, threshold: props.scrollThreshold };
    });
  // Ruler on raises the top margin, so the off check below proves the restore.
  await setRuler(page, true);
  await expect.poll(async () => (await scrollSettings()).margin?.top ?? 0).toBeGreaterThan(5);
  await setRuler(page, false);
  await expect(page.locator(".document-ruler")).toHaveCount(0);
  await expect.poll(scrollSettings).toEqual({ margin: 5, threshold: 0 });
  await caretToEnd(page);
  const trace: number[] = [];
  for (let i = 0; i < 110; i++) {
    await page.keyboard.press("ArrowUp");
    trace.push(await scrolled(page));
  }
  const scrollTop = await page.locator(".writer-scroll").first().evaluate((el) => el.getBoundingClientRect().top);
  const top = await caretTop(page);
  expect(top!, "caret stays inside the scroller").toBeGreaterThanOrEqual(scrollTop - 1);
  expect(new Set(trace).size, "the document scrolled while moving up").toBeGreaterThan(5);
});

// ---- WebKit rect model, emulated in Chromium (T243 r2) -------------------------------------
// This is EMULATION, not native proof. Chromium reports drawn rects; native WebKit reports rects of
// zoomed content in zoomed space (drawn / zoom). Here the rect getters are patched to that model while
// layout, scrolling and zoom stay real, so the app's real `handleCaretScroll` runs (it stands aside in
// plain Chromium) and real ArrowUp/ArrowDown presses drive it. Native WebKit still decides.
const emulateWebKitRects = () => {
  const E = Element.prototype;
  const R = Range.prototype;
  const o = { eb: E.getBoundingClientRect, ec: E.getClientRects, rb: R.getBoundingClientRect, rc: R.getClientRects };
  (window as any).__drawn = o;
  const eff = (el: Element | null) => {
    let z = 1;
    for (let n = el; n; n = n.parentElement) z *= parseFloat(getComputedStyle(n).zoom) || 1;
    return z;
  };
  const sc = (r: DOMRect, z: number) => new DOMRect(r.x / z, r.y / z, r.width / z, r.height / z);
  const host = (x: Range) => (x.startContainer.nodeType === 1 ? (x.startContainer as Element) : x.startContainer.parentElement);
  E.getBoundingClientRect = function () { return sc(o.eb.call(this), eff(this)); };
  E.getClientRects = function () { const z = eff(this); return Array.from(o.ec.call(this), (r) => sc(r, z)) as any; };
  R.getBoundingClientRect = function () { return sc(o.rb.call(this), eff(host(this))); };
  R.getClientRects = function () { const z = eff(host(this)); return Array.from(o.rc.call(this), (r) => sc(r, z)) as any; };
};

// True drawn px (saved original getters). Caret = ProseMirror's own coordinates times the zoom.
const drawnGeo = (page: Page) =>
  page.evaluate(() => {
    const o = (window as any).__drawn;
    const dom = document.querySelector(".ProseMirror") as any;
    const scroller = dom.closest(".writer-scroll");
    const ruler = scroller.querySelector(".document-ruler");
    let zoom = 1;
    for (let n: any = dom; n; n = n.parentElement) zoom *= parseFloat(getComputedStyle(n).zoom) || 1;
    const c = dom.editor.view.coordsAtPos(dom.editor.state.selection.head, 1);
    const sr = o.eb.call(scroller);
    return { zoom, top: c.top * zoom, bottom: c.bottom * zoom, floor: ruler ? o.eb.call(ruler).bottom : sr.top, scrollerBottom: sr.bottom };
  });

for (const mode of ["pages", "continuous"] as const) {
  for (const zoom of [75, 150]) {
    for (const ruler of [true, false]) {
      test(`emulated WebKit rects: ArrowUp/Down keep the caret in view at ${zoom}%: ${mode} view, ruler ${ruler ? "on" : "off"}`, async ({ page }) => {
        await page.setViewportSize({ width: 1500, height: 900 });
        await page.addInitScript(emulateWebKitRects);
        await createProject(page, `Emulated ${mode} ${zoom} ${ruler}`);
        await seedBlocks(page, dense(60));
        await setMode(page, mode);
        await setZoom(page, zoom);
        await setRuler(page, ruler);
        await caretToEnd(page);
        let hidden = 0;
        let below = 0;
        const log: string[] = [];
        const run = async (key: string, n: number) => {
          for (let i = 0; i < n; i++) {
            await page.keyboard.press(key);
            await page.waitForTimeout(40);
            const g = await drawnGeo(page);
            if (g.top < g.floor - 1) { hidden++; log.push(`${key}#${i} top-floor=${(g.top - g.floor).toFixed(1)}`); }
            if (g.bottom > g.scrollerBottom + 1) below++;
          }
        };
        await run("ArrowUp", 70);
        await run("ArrowDown", 15);
        expect(hidden, `${hidden} presses left the caret behind the ruler or above the window: ${log.join(", ")}`).toBe(0);
        expect(below, `${below} presses left the caret below the window`).toBe(0);
      });
    }
  }
}

// ProseMirror only scrolls after an arrow key if the selection change lands within 50 ms of the key.
// A busy moment misses that window: this holds the page up for 80 ms after each key to force it.
for (const zoom of [75, 150]) {
  test(`a slow moment after ArrowUp still keeps the caret clear of the ruler at ${zoom}%`, async ({ page }) => {
    await page.setViewportSize({ width: 1500, height: 900 });
    await page.addInitScript(emulateWebKitRects);
    await createProject(page, `Slow key ${zoom}`);
    await seedBlocks(page, dense(60));
    await setMode(page, "continuous");
    await setZoom(page, zoom);
    await setRuler(page, true);
    await caretToEnd(page);
    await page.evaluate(() => {
      window.addEventListener("keydown", () => {
        const until = performance.now() + 80;
        while (performance.now() < until);
      });
    });
    const log: string[] = [];
    for (let i = 0; i < 40; i++) {
      await page.keyboard.press("ArrowUp");
      await page.waitForTimeout(120);
      const g = await drawnGeo(page);
      if (g.top < g.floor - 1) log.push(`#${i} top-floor=${(g.top - g.floor).toFixed(1)}`);
    }
    expect(log, "presses that left the caret behind the ruler").toEqual([]);
  });
}

test("a movement key that moves nothing does not make select-all jump to the end", async ({ page }) => {
  await page.setViewportSize({ width: 1500, height: 900 });
  await createProject(page, "Stale key");
  await seedBlocks(page, dense(60));
  await page.evaluate(() => (document.querySelector(".ProseMirror") as any).editor.commands.focus("start"));
  await page.waitForTimeout(100);
  const before = await scrolled(page);
  await page.keyboard.press("ArrowUp");
  await page.keyboard.press("ControlOrMeta+a");
  await page.waitForTimeout(150);
  expect(await scrolled(page)).toBe(before);
});

for (const zoom of [100, 75]) {
  test(`emulated WebKit rects: a selected tall image clears the ruler at ${zoom}%`, async ({ page }) => {
    await page.setViewportSize({ width: 1500, height: 900 });
    await page.addInitScript(emulateWebKitRects);
    await createProject(page, `Emulated image ${zoom}`);
    // An image needs a valid asset id; with no resolver it draws as a small placeholder, so the test makes it tall.
    const assetId = "ab".repeat(32);
    await seedBlocks(page, [...dense(12), { type: "image", attrs: { assetId, alt: "x" } }, ...dense(12)]);
    await setMode(page, "pages");
    await setZoom(page, zoom);
    await setRuler(page, true);
    await page.waitForTimeout(400);
    const r = await page.evaluate(async () => {
      const o = (window as any).__drawn;
      const dom = document.querySelector(".ProseMirror") as any;
      const ed = dom.editor;
      const view = ed.view;
      let pos = -1;
      ed.state.doc.forEach((n: any, off: number) => { if (n.type.name === "image") pos = off; });
      const el = view.nodeDOM(pos);
      el.style.minHeight = "500px";
      await new Promise((f) => setTimeout(f, 100));
      const scroller = dom.closest(".writer-scroll");
      const floor = () => o.eb.call(scroller.querySelector(".document-ruler")).bottom;
      // Put the image top well above the ruler, then select the node and scroll to it.
      const b = o.eb.call(el);
      scroller.scrollTop += b.top - floor() + b.height * 0.6;
      await new Promise((f) => setTimeout(f, 200));
      view.focus();
      ed.commands.setNodeSelection(pos);
      ed.commands.scrollIntoView();
      await new Promise((f) => setTimeout(f, 300));
      const a = o.eb.call(el);
      return { kind: view.state.selection.toJSON().type, clear: a.top - floor() };
    });
    expect(r.kind).toBe("node");
    expect(r.clear, `image top is ${r.clear.toFixed(1)}px from the ruler bottom`).toBeGreaterThanOrEqual(-1);
  });
}
