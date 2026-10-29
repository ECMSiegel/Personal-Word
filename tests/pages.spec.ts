import { test, expect, type Locator, type Page } from "@playwright/test";

// Page view stacks pages vertically (wave 3, P2). Letter paper at 100%:
// 1056 px pages, 96 px margins, 32 px gaps, so page p's text starts at
// p * 1088 px below the first page's text.
const PITCH = 1088;

async function create(page: Page, title: string) {
  await page.goto("/");
  await page.getByRole("button", { name: "Start new project" }).click();
  await page.getByRole("button", { name: "Blank", exact: true }).click();
  await page.getByLabel("Project title").fill(title);
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByText("Saved", { exact: true })).toBeVisible();
}

/**
 * Fills every section with about 29,000 words (about 90 pages): a heading
 * every 12 paragraphs and a footnote every 40.
 */
async function seed(page: Page) {
  await page.evaluate(() => {
    const key = Object.keys(localStorage).find((k) =>
      k.startsWith("folio.preview.project."),
    )!;
    const p = JSON.parse(localStorage.getItem(key)!);
    const words = ["alpha", "beta", "gamma", "delta", "evidence", "measure", "page"];
    const footnotes: { id: string; text: string }[] = [];
    p.entries.forEach((entry: any, n: number) => {
      if (entry.kind !== "section") return;
      const blocks: any[] = [];
      for (let i = 0; i < 640; i++) {
        if (i % 12 === 0)
          blocks.push({
            type: "heading",
            attrs: { level: 2 },
            content: [{ type: "text", text: `Heading ${i / 12 + 1}` }],
          });
        const text =
          Array.from({ length: 28 + (i % 9) * 4 }, (_, j) => words[(i + j) % 7]).join(" ") + ".";
        const content: any[] = [{ type: "text", text: `P${i} ${text}` }];
        if (i % 40 === 5) {
          const id = `pages-note-${n}-${i}`;
          footnotes.push({ id, text: `Note for paragraph ${i}.` });
          content.push({ type: "footnoteReference", attrs: { id } });
        }
        blocks.push({ type: "paragraph", content });
      }
      entry.content = { type: "doc", content: blocks };
      entry.text = blocks
        .map((b) => b.content.map((c: any) => c.text ?? "").join(""))
        .join("\n");
    });
    p.research = { ...(p.research ?? {}), sources: [], notes: [], footnotes };
    localStorage.setItem(key, JSON.stringify(p));
    localStorage.setItem("personal-word.restoreTabs", "true");
    localStorage.setItem("folio.lastProject", p.id);
    localStorage.setItem("personal-word.prose-check", "false");
  });
  await page.reload();
  await expect(page.getByRole("textbox", { name: "Writing editor", exact: true })).toBeVisible();
}

async function togglePageView(page: Page) {
  const button = page.getByRole("button", { name: "Page view", exact: true });
  if (!(await button.count()))
    await page.getByRole("button", { name: "More formatting" }).click();
  await button.click();
  await page.keyboard.press("Escape");
}

async function settle(page: Page) {
  await page.evaluate(
    () =>
      new Promise((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(resolve, 300))),
      ),
  );
}

/**
 * Geometry of one editor in page view, in unzoomed layout px. `starts` holds,
 * for every page after the first, how far its first line sits from where the
 * page's text area begins: the spacer's bottom (offsetTop from the writing
 * surface, and the drawn position from the rendered boxes divided by the
 * paper's real zoom). Spacers inside paragraphs (`inline`) are where a
 * paragraph runs on to the next page; `orphans` lists any that leave fewer
 * than two lines on either page.
 */
function measure(editor: Locator) {
  return editor.evaluate((surface: HTMLElement, pitch: number) => {
    const paper = surface.closest<HTMLElement>(".editor-paper")!;
    const viewport = surface.closest<HTMLElement>(".editor-viewport")!;
    const scroller = surface.closest<HTMLElement>(".writer-scroll")!;
    const vars = getComputedStyle(paper);
    const num = (name: string) => parseFloat(vars.getPropertyValue(name));
    const zoom = parseFloat(vars.zoom) || 1;
    const margin = num("--page-margin");
    const contentHeight = num("--page-height") - 2 * margin;
    const reserve = num("--footnote-reserve") || 0;
    const within = (el: HTMLElement) => {
      let y = 0;
      let node: HTMLElement | null = el;
      while (node && node !== surface) {
        y += node.offsetTop;
        node = node.offsetParent as HTMLElement | null;
      }
      return y;
    };
    const paperTop = paper.getBoundingClientRect().top;
    const spacers = [...surface.querySelectorAll<HTMLElement>(".page-spacer")];
    const starts = spacers.map((spacer) => {
      const expected = (Number(spacer.dataset.page) - 1) * pitch;
      return {
        page: Number(spacer.dataset.page),
        layout: within(spacer) + spacer.offsetHeight - expected,
        drawn:
          (spacer.getBoundingClientRect().bottom - paperTop) / zoom - (expected + margin),
      };
    });
    // Text lines and unsplit blocks whose bottom crosses the end of their
    // page's text area.
    const crossings: string[] = [];
    const surfaceTop = surface.getBoundingClientRect().top;
    const range = document.createRange();
    const walker = document.createTreeWalker(surface, NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      range.selectNodeContents(node);
      for (const r of range.getClientRects()) {
        if (!r.height) continue;
        const top = (r.top - surfaceTop) / zoom;
        const bottom = (r.bottom - surfaceTop) / zoom;
        const index = Math.floor((top + 1) / pitch);
        if (bottom > index * pitch + contentHeight - reserve + 1)
          crossings.push(`${(node.textContent ?? "").slice(0, 12)} ${top}-${bottom}`);
      }
    }
    for (const child of surface.children) {
      const el = child as HTMLElement;
      if (el.classList.contains("page-spacer") || !el.offsetHeight) continue;
      if (el.querySelector(".page-spacer")) continue;
      const top = within(el);
      const bottom = top + el.offsetHeight;
      const index = Math.floor((top + 1) / pitch);
      if (bottom > index * pitch + contentHeight - reserve + 1)
        crossings.push(`${(el.textContent ?? "").slice(0, 12)} ${top}-${bottom}`);
    }
    // Lines of a split paragraph above and below each spacer inside it.
    const inline = spacers.filter((s) => s.dataset.inline);
    const orphans: string[] = [];
    for (const spacer of inline) {
      const block = spacer.parentElement!;
      const centres: number[] = [];
      let tallest = 0;
      const lines = block.ownerDocument.createTreeWalker(block, NodeFilter.SHOW_TEXT);
      for (let node = lines.nextNode(); node; node = lines.nextNode()) {
        range.selectNodeContents(node);
        for (const r of range.getClientRects())
          if (r.height) {
            centres.push((r.top + r.bottom) / 2);
            tallest = Math.max(tallest, r.height);
          }
      }
      centres.sort((a, b) => a - b);
      const rows: number[] = [];
      for (const c of centres)
        if (!rows.length || c - rows[rows.length - 1] > (tallest * 3) / 4) rows.push(c);
      const box = spacer.getBoundingClientRect();
      const own = spacers.filter((s) => s.parentElement === block);
      const at = own.indexOf(spacer);
      const above = rows.filter(
        (c) => c < box.top && (at === 0 || c > own[at - 1].getBoundingClientRect().bottom),
      ).length;
      const below = rows.filter(
        (c) => c > box.bottom && (at === own.length - 1 || c < own[at + 1].getBoundingClientRect().top),
      ).length;
      if (above < 2 || below < 2) orphans.push(`page ${spacer.dataset.page}: ${above}/${below}`);
    }
    return {
      zoom,
      spacers: spacers.length,
      inline: inline.length,
      orphans,
      pageCountVar: Number(vars.getPropertyValue("--page-count")),
      starts,
      crossings,
      headingsAtFoot: spacers.filter(
        (s) => !s.dataset.inline && s.previousElementSibling?.tagName === "H2",
      ).length,
      viewport: { scroll: viewport.scrollWidth, client: viewport.clientWidth },
      scroller: { scroll: scroller.scrollWidth, client: scroller.clientWidth },
      paperWidth: paper.getBoundingClientRect().width,
      paperLayoutWidth: paper.offsetWidth,
    };
  }, PITCH);
}

const selection = (editor: Locator) =>
  editor.evaluate((el: any) => {
    const { from, to, anchor, head } = el.editor.state.selection;
    // Relative to the editor's own box, so scrolling does not change it.
    const top = Math.round(el.editor.view.coordsAtPos(head).top - el.getBoundingClientRect().top);
    return { from, to, anchor, head, top };
  });
// Tiptap's focus() calls view.focus() inside requestAnimationFrame, so a key pressed
// straight after it can reach the page before the editor owns focus (and do nothing).
// Wait for focus and for the DOM selection to match before any key is sent.
const select = (editor: Locator, pos: number) =>
  editor.evaluate(
    (el: any, at: number) =>
      new Promise<void>((resolve, reject) => {
        el.editor.commands.setTextSelection(at);
        el.editor.commands.focus();
        const started = performance.now();
        const check = () => {
          const sel = window.getSelection();
          if (
            document.activeElement === el &&
            sel?.anchorNode &&
            el.contains(sel.anchorNode) &&
            el.editor.view.hasFocus()
          )
            requestAnimationFrame(() => resolve());
          else if (performance.now() - started > 2000) reject(new Error("editor did not take focus"));
          else requestAnimationFrame(check);
        };
        requestAnimationFrame(check);
      }),
    pos,
  );
const lineTop = (editor: Locator, pos: number) =>
  editor.evaluate(
    (el: any, at: number) =>
      Math.round(el.editor.view.coordsAtPos(at).top - el.getBoundingClientRect().top),
    pos,
  );

test.describe("vertical page view", () => {
  test.use({ viewport: { width: 1240, height: 840 } });

  test("stacks pages vertically with no sideways scroll; caret, clicks, footnotes and undo", async ({
    page,
  }) => {
    test.setTimeout(180_000);
    await create(page, "Vertical pages");
    await seed(page);
    const editor = page.getByRole("textbox", { name: "Writing editor", exact: true });
    await togglePageView(page);
    await expect(page.locator(".editor-viewport")).toHaveClass(/is-paged/);
    await settle(page);
    // The owner's report: page view scrolled sideways. Nothing may.
    await expect
      .poll(() =>
        page.locator(".editor-viewport").evaluate((el) => el.scrollWidth - el.clientWidth),
      )
      .toBe(0);
    await expect.poll(async () => (await measure(editor)).spacers).toBeGreaterThan(40);
    await settle(page);
    const g = await measure(editor);

    // One page wide, scrolling down only.
    expect(g.viewport.scroll).toBe(g.viewport.client);
    expect(g.scroller.scroll).toBe(g.scroller.client);
    expect(g.paperLayoutWidth).toBe(816);
    // Every page after the first starts exactly where its text area begins.
    for (const start of g.starts) {
      expect(Math.abs(start.layout), `page ${start.page} layout`).toBeLessThanOrEqual(1);
      expect(Math.abs(start.drawn), `page ${start.page} drawn`).toBeLessThanOrEqual(1);
    }
    // No line crosses a page end, and no heading is left at the foot of a page.
    // Paragraphs split between pages as in Word: at least two lines stay on
    // each page, so some pages start mid-paragraph and some with a new block.
    expect(g.crossings).toEqual([]);
    expect(g.headingsAtFoot).toBe(0);
    expect(g.inline).toBeGreaterThan(10);
    expect(g.spacers - g.inline).toBeGreaterThan(5);
    expect(g.orphans).toEqual([]);
    // The page count is spacers + 1, in the footer and on the paper.
    expect(g.pageCountVar).toBe(g.spacers + 1);
    await expect(page.getByLabel("Page count")).toContainText(`of ${g.spacers + 1}`);

    // Page 2's paper is drawn below page 1's (the spacer covers page 1's foot and the gap).
    const spacer = page.locator(".page-spacer").first();
    const spacerBox = (await spacer.boundingBox())!;
    const paperBox = (await page.locator(".editor-paper").boundingBox())!;
    expect(spacerBox.y + spacerBox.height).toBeGreaterThan(paperBox.y + 1056 + 32);

    // Footnotes sit in the bottom half of the page that holds their reference.
    const notes = await page.evaluate((pitch) => {
      const paper = document.querySelector<HTMLElement>(".editor-paper")!;
      return [...document.querySelectorAll<HTMLElement>(".page-footnotes")].map((block) => {
        const pageNo = Number(block.getAttribute("aria-label")!.match(/page (\d+)/)![1]);
        const top = block.offsetTop;
        const bottom = top + block.offsetHeight;
        const pageTop = (pageNo - 1) * pitch;
        return top > pageTop + 528 && bottom <= pageTop + 1056;
      });
    }, PITCH);
    expect(notes.length).toBeGreaterThan(10);
    expect(notes.every(Boolean)).toBe(true);

    // Caret and clicks across the first gap inside a paragraph and the first
    // gap between blocks. `before` is on the last line above the gap, `after`
    // on the first line below it; a click in the gap goes to `next`, one in the
    // page's bottom margin to `prev` (one position inside a paragraph).
    for (const kind of ["inline", "block"] as const) {
      const { before, after, prev, next, index } = await editor.evaluate(
        (el: any, inline: boolean) => {
          const all = [...el.querySelectorAll(".page-spacer")] as HTMLElement[];
          const spacer = all.find((s) => !!s.dataset.inline === inline)!;
          const view = el.editor.view;
          if (inline) {
            const parent = spacer.parentNode!;
            const pos = view.posAtDOM(parent, [...parent.childNodes].indexOf(spacer));
            // The page's last line ends where the next page's first line starts;
            // a margin click lands one character back so the caret stays on its page.
            return { before: pos - 2, after: pos + 2, prev: pos - 1, next: pos, index: all.indexOf(spacer) };
          }
          const above = spacer.previousElementSibling as HTMLElement;
          const prevEnd = view.posAtDOM(above, above.childNodes.length);
          const nextPos = view.posAtDOM(spacer.nextElementSibling, 0);
          return { before: prevEnd, after: nextPos, prev: prevEnd, next: nextPos, index: all.indexOf(spacer) };
        },
        kind === "inline",
      );
      const pageAboveLast = await lineTop(editor, before);
      const pageBelowFirst = await lineTop(editor, after);
      expect(pageBelowFirst - pageAboveLast, kind).toBeGreaterThan(100);
      await select(editor, before);
      await page.keyboard.press("ArrowDown");
      const down = await selection(editor);
      expect(down.from, kind).toBeGreaterThanOrEqual(next);
      expect(down.top, kind).toBe(pageBelowFirst);
      await page.keyboard.press("ArrowUp");
      expect((await selection(editor)).top, kind).toBe(pageAboveLast);
      await select(editor, after);
      await page.keyboard.press("ArrowUp");
      const up = await selection(editor);
      expect(up.from, kind).toBeLessThanOrEqual(prev);
      expect(up.top, kind).toBe(pageAboveLast);
      // From far right on the first line below the gap, Up reaches the end of
      // the line above it and the caret is drawn there, not back below the gap.
      await select(editor, after);
      await page.keyboard.press("End");
      await page.keyboard.press("ArrowUp");
      const fromEnd = await selection(editor);
      expect(fromEnd.from, kind).toBeLessThanOrEqual(prev);
      expect(fromEnd.top, kind).toBe(pageAboveLast);
      await select(editor, before - 5);
      await page.keyboard.press("Shift+ArrowDown");
      const extended = await selection(editor);
      expect(extended.anchor, kind).toBe(before - 5);
      expect(extended.head, kind).toBeGreaterThanOrEqual(next);

      const spacer = page.locator(".page-spacer").nth(index);
      await spacer.scrollIntoViewIfNeeded();
      const box = (await spacer.boundingBox())!;
      const split = Number(await spacer.getAttribute("data-split"));
      const scale = box.height / parseFloat((await spacer.getAttribute("style"))!.match(/height:\s*([\d.]+)px/)![1]);
      await page.mouse.click(box.x + box.width / 2, box.y + (split + 16) * scale);
      expect((await selection(editor)).from, kind).toBe(next);
      await page.mouse.click(box.x + box.width / 2, box.y + (split - 40) * scale);
      expect((await selection(editor)).from, kind).toBe(prev);
    }
    const nextPos = await editor.evaluate((el: any) => {
      const spacer = [...el.querySelectorAll(".page-spacer")].find((s: any) => !s.dataset.inline);
      return el.editor.view.posAtDOM(spacer.nextElementSibling, 0);
    });

    // Typing at the top of page 2 then one undo restores the text; spacers follow.
    const before = await editor.evaluate((el: any) => el.editor.getText());
    await select(editor, nextPos);
    await page.keyboard.type("abc");
    await settle(page);
    await page.keyboard.press("ControlOrMeta+z");
    await settle(page);
    expect(await editor.evaluate((el: any) => el.editor.getText())).toBe(before);
    expect((await measure(editor)).spacers).toBe(g.spacers);

    // Back to continuous view: no spacers remain.
    await togglePageView(page);
    await expect(page.locator(".editor-viewport")).toHaveClass(/is-continuous/);
    await expect(page.locator(".page-spacer")).toHaveCount(0);
  });

  test("typing just above a split rewraps the paragraph across the page gap", async ({ page }) => {
    test.setTimeout(120_000);
    await create(page, "Rewrap pages");
    await seed(page);
    const editor = page.getByRole("textbox", { name: "Writing editor", exact: true });
    await togglePageView(page);
    await expect.poll(async () => (await measure(editor)).inline).toBeGreaterThan(10);
    await settle(page);
    // Right edge of the last text line above the first spacer inside a paragraph,
    // and the right edge of the text area. A line ended by a stale spacer would
    // stop short, though the next word fits.
    const lastLine = () =>
      editor.evaluate((el: any) => {
        const spacer = el.querySelector(".page-spacer[data-inline]") as HTMLElement;
        const range = document.createRange();
        range.setStart(spacer.parentNode!, 0);
        range.setEndBefore(spacer);
        const rects = [...range.getClientRects()].filter((r) => r.height && r.width);
        const top = Math.max(...rects.map((r) => r.top));
        const right = Math.max(...rects.filter((r) => r.top >= top - 4).map((r) => r.right));
        return { right, edge: el.getBoundingClientRect().right };
      });
    const pos = await editor.evaluate((el: any) => {
      const spacer = el.querySelector(".page-spacer[data-inline]") as HTMLElement;
      const parent = spacer.parentNode!;
      return el.editor.view.posAtDOM(parent, [...parent.childNodes].indexOf(spacer)) - 10;
    });
    await select(editor, pos);
    await page.keyboard.type(" extra words typed here to push the line", { delay: 10 });
    await settle(page);
    await settle(page);
    const line = await lastLine();
    expect(line.edge - line.right).toBeLessThan(100);
    const g = await measure(editor);
    expect(g.crossings).toEqual([]);
    expect(g.orphans).toEqual([]);

    // A mark change moves no positions but changes the line's width: making the
    // last line bold and then plain again must rewrap it too.
    const range = await editor.evaluate((el: any) => {
      const spacer = el.querySelector(".page-spacer[data-inline]") as HTMLElement;
      const parent = spacer.parentNode!;
      const at = el.editor.view.posAtDOM(parent, [...parent.childNodes].indexOf(spacer));
      return { from: at - 150, to: at };
    });
    for (const step of ["bold", "plain"]) {
      await editor.evaluate(
        (el: any, { from, to, step }: { from: number; to: number; step: string }) => {
          const chain = el.editor.chain().setTextSelection({ from, to });
          (step === "bold" ? chain.setBold() : chain.unsetBold()).run();
        },
        { ...range, step },
      );
      await settle(page);
      await settle(page);
    }
    const after = await lastLine();
    expect(after.edge - after.right).toBeLessThan(100);
  });

  test("Shift+Enter starts a new page", async ({ page }) => {
    await create(page, "Page break pages");
    const editor = page.getByRole("textbox", { name: "Writing editor", exact: true });
    await editor.fill("First page text.");
    await togglePageView(page);
    await expect(page.getByLabel("Page count")).toContainText("of 1");
    await editor.press("End");
    await editor.press("Shift+Enter");
    await page.keyboard.type("Second page text.");
    await expect(page.locator(".page-spacer")).toHaveCount(1);
    await expect(page.getByLabel("Page count")).toContainText("of 2");
    const g = await measure(editor);
    expect(g.starts).toHaveLength(1);
    expect(Math.abs(g.starts[0].layout)).toBeLessThanOrEqual(1);
    await expect(page.locator(".page-spacer + p")).toHaveText("Second page text.");
  });

  test("Reduce Motion leaves page view unchanged", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await create(page, "Reduced motion pages");
    await seed(page);
    const editor = page.getByRole("textbox", { name: "Writing editor", exact: true });
    await togglePageView(page);
    await expect.poll(async () => (await measure(editor)).spacers).toBeGreaterThan(40);
    const g = await measure(editor);
    expect(g.viewport.scroll).toBe(g.viewport.client);
    expect(g.starts.every((s) => Math.abs(s.layout) <= 1)).toBe(true);
    expect(await page.evaluate(() => document.getAnimations().length)).toBe(0);
  });

  test("spacers wait for an input-method composition to end", async ({ page }) => {
    await create(page, "Composition pages");
    const editor = page.getByRole("textbox", { name: "Writing editor", exact: true });
    await editor.fill("Short.");
    await togglePageView(page);
    await settle(page);
    await expect(page.locator(".page-spacer")).toHaveCount(0);
    // Start a composition, then grow the document past a page while it lasts.
    await editor.evaluate((el: any) => {
      el.dispatchEvent(new CompositionEvent("compositionstart", { data: "" }));
      const paragraphs = Array.from({ length: 80 }, (_, i) => ({
        type: "paragraph",
        content: [{ type: "text", text: `Composed line ${i} with words enough to wrap.` }],
      }));
      el.editor.commands.insertContentAt(el.editor.state.doc.content.size, paragraphs);
    });
    await settle(page);
    expect(await editor.evaluate((el: any) => el.editor.view.composing)).toBe(true);
    await expect(page.locator(".page-spacer")).toHaveCount(0);
    await editor.evaluate((el: any) =>
      el.dispatchEvent(new CompositionEvent("compositionend", { data: "" })),
    );
    await expect.poll(() => page.locator(".page-spacer").count()).toBeGreaterThan(0);
  });
});

test.describe("page view in a split pane", () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test("a 585 px pane scales the page, keeps every page start, and scrolls only its own page number", async ({
    page,
  }) => {
    test.setTimeout(180_000);
    await page.addInitScript(() => localStorage.setItem("personal-word.restoreTabs", "true"));
    await create(page, "Split pages");
    await page.getByRole("button", { name: "New section", exact: true }).click();
    await page.getByLabel("Title", { exact: true }).fill("Second");
    await page.getByRole("button", { name: "Save", exact: true }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(page.getByText("Saved", { exact: true })).toBeVisible();
    await seed(page);
    const rows = page.locator(".sidebar .entry-main");
    await rows.filter({ hasText: /^Opening/ }).click();
    await rows.filter({ hasText: /^Second/ }).click({ modifiers: ["ControlOrMeta"] });
    await expect(page.locator(".split-pane")).toHaveCount(2);
    await togglePageView(page);
    const left = page.getByRole("textbox", { name: "Writing editor", exact: true });
    const right = page.getByRole("textbox", { name: "Writing editor, right pane" });
    await settle(page);
    await expect
      .poll(() =>
        page
          .locator('.split-pane[data-side="right"] .editor-viewport')
          .evaluate((el) => el.scrollWidth - el.clientWidth),
      )
      .toBe(0);
    await expect.poll(async () => (await measure(right)).spacers).toBeGreaterThan(40);
    await expect.poll(async () => (await measure(left)).spacers).toBeGreaterThan(40);
    await settle(page);

    const g = await measure(right);
    expect(g.viewport.client).toBeLessThan(600);
    expect(g.viewport.scroll).toBe(g.viewport.client);
    expect(g.scroller.scroll).toBe(g.scroller.client);
    expect(g.zoom).toBeLessThan(1);
    expect(g.paperWidth).toBeLessThanOrEqual(g.viewport.client);
    expect(g.starts.length).toBeGreaterThan(40);
    for (const start of g.starts) {
      expect(Math.abs(start.layout), `page ${start.page} layout`).toBeLessThanOrEqual(1);
      expect(Math.abs(start.drawn), `page ${start.page} drawn`).toBeLessThanOrEqual(1);
    }
    expect(g.crossings).toEqual([]);

    // Each pane has its own footer: scrolling one moves only its own page number.
    await right.click();
    const status = page.locator('.split-pane[data-side="right"] [aria-label="Page count"]');
    const leftStatus = page.locator('.split-pane[data-side="left"] [aria-label="Page count"]');
    await expect(status).toContainText("page 1 of");
    await expect(leftStatus).toContainText("page 1 of");
    await page.locator('.split-pane[data-side="left"] .writer-scroll').evaluate((el) => {
      el.scrollTop = el.scrollHeight / 2;
    });
    await settle(page);
    await expect(status).toContainText("page 1 of");
    await expect(leftStatus).not.toContainText("page 1 of");
    await page.locator('.split-pane[data-side="right"] .writer-scroll').evaluate((el) => {
      el.scrollTop = el.scrollHeight / 2;
    });
    await expect(status).not.toContainText("page 1 of");
  });
});
