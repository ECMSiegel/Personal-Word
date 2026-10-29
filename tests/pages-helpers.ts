import { expect, type Locator, type Page } from "@playwright/test";

// Shared helpers for the wave-4 page-view specs (pages-zoom, pages-gap).
// `create`, `seedBlocks`, `togglePageView`, `settle`, `select` and
// `measurePages` are copies of the helpers in tests/pages.spec.ts (that file
// keeps its own copies; importing a spec from a spec registers its tests twice).

export async function create(page: Page, title: string) {
  await page.goto("/");
  await page.getByRole("button", { name: "Start new project" }).click();
  await page.getByRole("button", { name: "Blank", exact: true }).click();
  await page.getByLabel("Project title").fill(title);
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByText("Saved", { exact: true })).toBeVisible();
}

/** A paragraph block with `text` ("" = an empty paragraph, as Enter makes). */
export const para = (text: string) =>
  text ? { type: "paragraph", content: [{ type: "text", text }] } : { type: "paragraph" };

/**
 * The shape of the owner's documents in 1.png and 3.png: one short word, a
 * long run of empty paragraphs, then short single-line paragraphs at a page's
 * foot, an empty one, and two more short lines; repeated `times`.
 */
export function ownerShape(times = 1) {
  const blocks: unknown[] = [];
  for (let t = 0; t < times; t++) {
    blocks.push(para(t ? `hjoij ${t}` : "hjoij"));
    for (let i = 0; i < 26; i++) blocks.push(para(""));
    for (const text of ["khoihdowiahj", "kihjdowaihdowiadoanw", "nldkjwand", "", "dkwajbdwa", "djkwajbdwajk"])
      blocks.push(para(text));
    for (let i = 0; i < 6; i++) blocks.push(para(""));
  }
  return blocks;
}

/** `count` long paragraphs as in tests/pages.spec.ts `seed` (no headings, no footnotes). */
export function dense(count: number) {
  const words = ["alpha", "beta", "gamma", "delta", "evidence", "measure", "page"];
  return Array.from({ length: count }, (_, i) =>
    para(
      `P${i} ` +
        Array.from({ length: 28 + (i % 9) * 4 }, (_, j) => words[(i + j) % 7]).join(" ") +
        ".",
    ),
  );
}

/** Replaces every section's content with `blocks` and reloads. */
export async function seedBlocks(page: Page, blocks: unknown[]) {
  await page.evaluate((content) => {
    const key = Object.keys(localStorage).find((k) => k.startsWith("folio.preview.project."))!;
    const p = JSON.parse(localStorage.getItem(key)!);
    p.entries.forEach((entry: any) => {
      if (entry.kind !== "section") return;
      entry.content = { type: "doc", content };
      entry.text = content
        .map((b: any) => (b.content ?? []).map((c: any) => c.text ?? "").join(""))
        .join("\n");
    });
    localStorage.setItem(key, JSON.stringify(p));
    localStorage.setItem("personal-word.restoreTabs", "true");
    localStorage.setItem("folio.lastProject", p.id);
    localStorage.setItem("personal-word.prose-check", "false");
  }, blocks);
  await page.reload();
  await expect(page.getByRole("textbox", { name: "Writing editor", exact: true })).toBeVisible();
}

export async function togglePageView(page: Page) {
  const button = page.getByRole("button", { name: "Page view", exact: true });
  if (!(await button.count())) await page.getByRole("button", { name: "More formatting" }).click();
  await button.click();
  await page.keyboard.press("Escape");
}

/** Picks a toolbar zoom (50, 75, 100, 125, 150) through the "Editor zoom" dropdown. */
export async function setZoom(page: Page, percent: number) {
  let trigger = page.getByRole("button", { name: "Editor zoom", exact: true });
  const inMore = !(await trigger.count());
  if (inMore) await page.getByRole("button", { name: "More formatting" }).click();
  trigger = page.getByRole("button", { name: "Editor zoom", exact: true });
  await trigger.click();
  await page.getByRole("option", { name: `${percent}%`, exact: true }).click();
  if (inMore && (await page.getByRole("dialog", { name: "More formatting" }).count()))
    await page.keyboard.press("Escape");
  // The paper's zoom is the toolbar zoom times the fit scale (a pane narrower
  // than the zoomed page scales it down: 125 % and 150 % at 1240 px).
  await expect
    .poll(() =>
      page.locator(".editor-paper").first().evaluate((el, z) => {
        const style = getComputedStyle(el);
        const fit = parseFloat(style.getPropertyValue("--page-scale")) || 1;
        return Math.abs((parseFloat(style.zoom) || 1) - z * fit);
      }, percent / 100),
    )
    .toBeLessThan(0.0005);
}

export async function settle(page: Page) {
  await page.evaluate(
    () =>
      new Promise((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(resolve, 300))),
      ),
  );
}

// Tiptap's focus() calls view.focus() inside requestAnimationFrame: wait for
// focus and a matching DOM selection before any key is sent.
export const select = (editor: Locator, pos: number) =>
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

/**
 * Geometry of one editor in page view, in unzoomed layout px (the `measure`
 * of tests/pages.spec.ts, reused): for every page after the first, how far
 * its first line sits from where its text area begins (`layout` from
 * offsetTop, `drawn` from rendered boxes over the paper's zoom), and every
 * text line or unsplit block whose bottom crosses its page's text-area end.
 */
export function measurePages(editor: Locator) {
  return editor.evaluate((surface: HTMLElement) => {
    const paper = surface.closest<HTMLElement>(".editor-paper")!;
    const vars = getComputedStyle(paper);
    const num = (name: string) => parseFloat(vars.getPropertyValue(name)) || 0;
    const zoom = parseFloat(vars.zoom) || 1;
    const margin = num("--page-margin");
    const pitch = num("--page-height") + num("--page-gap");
    const contentHeight = num("--page-height") - 2 * margin;
    const reserve = num("--footnote-reserve");
    // Chromium reports rects in screen px (zoomed); old WebKit divides them by
    // the element's zoom. Pick whichever the paper's width says.
    const paperRect = paper.getBoundingClientRect();
    const ratio = paper.offsetWidth ? paperRect.width / paper.offsetWidth : 1;
    const scale = Math.abs(ratio - zoom) <= Math.abs(ratio - 1) ? zoom : 1;
    const within = (el: HTMLElement) => {
      let y = 0;
      let node: HTMLElement | null = el;
      while (node && node !== surface) {
        y += node.offsetTop;
        node = node.offsetParent as HTMLElement | null;
      }
      return y;
    };
    const spacers = [...surface.querySelectorAll<HTMLElement>(".page-spacer")];
    const starts = spacers.map((spacer) => {
      const expected = (Number(spacer.dataset.page) - 1) * pitch;
      return {
        page: Number(spacer.dataset.page),
        layout: within(spacer) + spacer.offsetHeight - expected,
        drawn: (spacer.getBoundingClientRect().bottom - paperRect.top) / scale - (expected + margin),
      };
    });
    const crossings: string[] = [];
    const surfaceTop = surface.getBoundingClientRect().top;
    const range = document.createRange();
    const walker = document.createTreeWalker(surface, NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      range.selectNodeContents(node);
      for (const r of range.getClientRects()) {
        if (!r.height) continue;
        const top = (r.top - surfaceTop) / scale;
        const bottom = (r.bottom - surfaceTop) / scale;
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
        crossings.push(`${(el.textContent ?? "").slice(0, 12) || "(empty)"} ${top}-${bottom}`);
    }
    return { zoom, ratio, scale, pitch, margin, contentHeight, reserve, spacers: spacers.length, starts, crossings };
  });
}

/**
 * The text-area invariant (plan, Approach item 2): the caret and every empty
 * paragraph lie inside some page's text area
 * [p * pitch, p * pitch + contentHeight - reserve] (surface px, unzoomed),
 * with 1 px tolerance. `caret` is the drawn caret: the DOM selection's
 * rectangle when it has height, else ProseMirror's coordsAtPos.
 */
export function gapCheck(editor: Locator): Promise<Invariant> {
  return editor.evaluate(
    (surface: HTMLElement, src: string) => (0, eval)(`(${src})`)(surface),
    invariantSource,
  );
}

export type Place = { page: number; ok: boolean; zone: string; top: number; bottom: number };
export type Invariant = {
  zoom: number;
  scale: number;
  caret: Place & { head: number; from: number; to: number; source: string };
  empties: (Place & { block: number })[];
  spacers: number;
};

/**
 * Installs `window.__pwInvariant(surface)` (the same check as `gapCheck`, run
 * in the page) so a frame sampler can call it without a round trip.
 */
export async function installInvariant(page: Page) {
  await page.evaluate(`window.__pwInvariant = ${invariantSource}`);
}

// Kept as source text so both `gapCheck` (via evaluate) and the frame sampler
// run the identical function.
const invariantSource = `function invariantIn(surface) {
  const paper = surface.closest(".editor-paper");
  const vars = getComputedStyle(paper);
  const num = (name) => parseFloat(vars.getPropertyValue(name)) || 0;
  const zoom = parseFloat(vars.zoom) || 1;
  const pitch = num("--page-height") + num("--page-gap");
  const margin = num("--page-margin");
  const limit = num("--page-height") - 2 * margin - num("--footnote-reserve");
  const surfaceRect = surface.getBoundingClientRect();
  const ratio = surface.offsetWidth ? surfaceRect.width / surface.offsetWidth : 1;
  const scale = Math.abs(ratio - zoom) <= Math.abs(ratio - 1) ? zoom : 1;
  const where = (top, bottom) => {
    const page = Math.max(0, Math.floor((top + 1) / pitch));
    const start = page * pitch;
    const ok = top >= start - 1 && bottom <= start + limit + 1;
    // Where it is if not: 'margin' = the page's bottom margin, 'gap' = the grey
    // gap, 'top' = the next page's top margin (all inside the spacer's span).
    const off = top - start - limit;
    const zone = ok ? "text" : off < margin ? "margin" : off < margin + (pitch - num("--page-height")) ? "gap" : "top-margin";
    return { page, ok, zone, top: Math.round(top * 10) / 10, bottom: Math.round(bottom * 10) / 10 };
  };
  const view = surface.editor.view;
  const { head, from, to } = surface.editor.state.selection;
  let rect = null;
  let source = "dom";
  const sel = getSelection();
  // A selected node (Backspace after a page break selects the break) shows no
  // caret: its own box is what is drawn (a page break has no height).
  const picked = surface.editor.state.selection.node;
  const nodeDom = picked ? view.nodeDOM(from) : null;
  if (nodeDom && nodeDom.getBoundingClientRect) {
    rect = nodeDom.getBoundingClientRect();
    source = "node:" + picked.type.name;
  } else if (sel && sel.rangeCount && surface.contains(sel.focusNode)) {
    const range = sel.getRangeAt(0);
    const rects = range.getClientRects();
    rect = rects.length ? rects[rects.length - 1] : range.getBoundingClientRect();
    if (!rect || !rect.height) rect = null;
  }
  if (!rect) {
    source = "pm";
    const c = view.coordsAtPos(head);
    rect = { top: c.top, bottom: c.bottom };
  }
  const caret = {
    head, from, to, source,
    ...where((rect.top - surfaceRect.top) / scale, (rect.bottom - surfaceRect.top) / scale),
  };
  const within = (el) => {
    let y = 0;
    let node = el;
    while (node && node !== surface) {
      y += node.offsetTop;
      node = node.offsetParent;
    }
    return y;
  };
  const empties = [];
  let index = 0;
  for (const child of surface.children) {
    if (child.classList.contains("page-spacer")) continue;
    index++;
    if (child.tagName !== "P" || child.textContent !== "" || child.querySelector(".page-spacer")) continue;
    const top = within(child);
    const w = where(top, top + child.offsetHeight);
    if (!w.ok) empties.push({ block: index - 1, ...w });
  }
  return { zoom, scale, caret, empties, spacers: surface.querySelectorAll(".page-spacer").length };
}`;

/** Decodes a PNG buffer in the page and returns the RGB of column `x` for every row. */
export async function pngColumn(page: Page, png: Buffer, x: number) {
  return page.evaluate(
    async ({ b64, x }) => {
      const img = new Image();
      img.src = "data:image/png;base64," + b64;
      await img.decode();
      const canvas = document.createElement("canvas");
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(img, 0, 0);
      const data = ctx.getImageData(Math.min(x, img.width - 1), 0, 1, img.height).data;
      const rows: [number, number, number][] = [];
      for (let y = 0; y < img.height; y++) rows.push([data[y * 4], data[y * 4 + 1], data[y * 4 + 2]]);
      return rows;
    },
    { b64: png.toString("base64"), x },
  );
}
