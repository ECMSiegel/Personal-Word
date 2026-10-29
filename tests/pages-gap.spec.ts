import { test, expect, type Locator, type Page } from "@playwright/test";
import {
  create,
  gapCheck,
  installInvariant,
  measurePages,
  ownerShape,
  para,
  seedBlocks,
  select,
  setZoom,
  settle,
  togglePageView,
  type Invariant,
} from "./pages-helpers";

// Owner report (wave 4 item 2, 3.png): the caret, and empty lines, can sit in
// the grey gap between pages. Invariant (plan, Approach item 2): after every
// settle the caret and every empty paragraph lie inside some page's text area.
// A seeded fuzz (seed printed on failure) plus six targeted cases.

const editorOf = (page: Page) =>
  page.getByRole("textbox", { name: "Writing editor", exact: true });
const lines = (n: number, from = 1) => Array.from({ length: n }, (_, i) => para(`line ${from + i}`));

/** mulberry32: a small seeded PRNG, so a failing run can be replayed. */
function prng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Arms a per-frame invariant sampler for the next key. Each keydown or input
 * event starts a chain of 8 frames. In each frame the check runs in a task
 * queued from an animation-frame callback, so it sees the page after every
 * animation-frame callback of that frame (pagination's included), i.e. what
 * was painted. A sample is dropped when the document changed in between (the
 * next key arrived first: that state was not painted). Checking inside the
 * callback itself would run ahead of callbacks requested later in the frame
 * and report frames that are never painted.
 */
const sampleFrames = (page: Page) =>
  page.evaluate(() => {
    const w = window as any;
    w.__frames = [];
    if (w.__samplerInstalled) return;
    w.__samplerInstalled = true;
    const surface = () => document.querySelector('[aria-label="Writing editor"]') as any;
    const start = () => {
      let n = 0;
      const tick = () => {
        const doc = surface()?.editor?.state.doc;
        setTimeout(() => {
          if (surface()?.editor?.state.doc !== doc) w.__frames.push(null);
          else
            try {
              const r = w.__pwInvariant(surface());
              w.__frames.push(!r.caret.ok || r.empties.length > 0);
            } catch {
              w.__frames.push(null);
            }
        }, 0);
        if (++n < 8) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    };
    window.addEventListener("keydown", start);
    window.addEventListener("input", start);
  });
const framesOut = (page: Page) =>
  page.evaluate(() => ((window as any).__frames as (boolean | null)[]).filter(Boolean).length);

const describe = (r: Invariant) =>
  [
    !r.caret.ok
      ? `caret head ${r.caret.head} in ${r.caret.zone} (page ${r.caret.page + 1}, ${r.caret.top}-${r.caret.bottom}, ${r.caret.source})`
      : "",
    ...r.empties.map((e) => `empty block ${e.block} in ${e.zone} (page ${e.page + 1}, ${e.top}-${e.bottom})`),
  ]
    .filter(Boolean)
    .join("; ");

async function open(page: Page, title: string, blocks: unknown[], zoom = 100) {
  await create(page, title);
  await seedBlocks(page, blocks);
  await togglePageView(page);
  await expect(page.locator(".editor-viewport")).toHaveClass(/is-paged/);
  if (zoom !== 100) await setZoom(page, zoom);
  await settle(page);
  await settle(page);
  await installInvariant(page);
  return editorOf(page);
}

/** First block spacer: the positions on each side of it. */
const blockGap = (editor: Locator) =>
  editor.evaluate((el: any) => {
    const spacer = el.querySelector(".page-spacer:not([data-inline])") as HTMLElement;
    const view = el.editor.view;
    const above = spacer.previousElementSibling as HTMLElement;
    return {
      prevEnd: view.posAtDOM(above, above.childNodes.length) as number,
      nextStart: view.posAtDOM(spacer.nextElementSibling, 0) as number,
      index: [...el.querySelectorAll(".page-spacer")].indexOf(spacer),
    };
  });

for (const [zoom, seed] of [
  [100, Number(process.env.G1_SEED_100 ?? 4101)],
  [75, Number(process.env.G1_SEED_75 ?? 4175)],
  [125, Number(process.env.G1_SEED_125 ?? 4125)],
] as const) {
  test(`fuzz at ${zoom} %: caret and empty lines never in a gap (seed ${seed})`, async ({ page }) => {
    test.setTimeout(420_000);
    await page.setViewportSize({ width: 1240, height: 840 });
    const editor = await open(page, `Gap fuzz ${zoom}`, ownerShape(3), zoom);
    const random = prng(seed);
    const pick = <T,>(items: [T, number][]) => {
      let r = random() * items.reduce((s, [, w]) => s + w, 0);
      for (const [item, w] of items) if ((r -= w) < 0) return item;
      return items[0][0];
    };
    const words = ["alpha", "beta", "khoihdowiahj", "nldkjwand", "x"];
    const violations: string[] = [];
    let transient = 0;
    let end = await editor.evaluate((el: any) => el.editor.state.doc.content.size - 1);
    await select(editor, end);
    for (let step = 1; step <= 200; step++) {
      // Sometimes move the caret to a random place first (a random position
      // inside a random paragraph).
      let moved = "";
      if (random() < 0.35) {
        const [a, b] = [random(), random()];
        const pos = await editor.evaluate(
          (el: any, { a, b }) => {
            const blocks: [number, number][] = [];
            el.editor.state.doc.forEach((node: any, offset: number) => {
              if (node.isTextblock) blocks.push([offset + 1, offset + 1 + node.content.size]);
            });
            const [from, to] = blocks[Math.floor(a * blocks.length)];
            return from + Math.floor(b * (to - from + 1));
          },
          { a, b },
        );
        await select(editor, pos);
        moved = `at ${pos} `;
      }
      const op = pick<string>([
        ["Enter", 30],
        ["type", 14],
        ["Backspace", 15],
        ["Delete", 8],
        ["ArrowUp", 7],
        ["ArrowDown", 7],
        ["undo", 7],
        ["redo", 4],
        ["Shift+Enter", 2],
        ["Enter x5", 6],
      ]);
      await sampleFrames(page);
      if (op === "type") await page.keyboard.type(words[Math.floor(random() * words.length)]);
      else if (op === "undo") await page.keyboard.press("ControlOrMeta+z");
      else if (op === "redo") await page.keyboard.press("ControlOrMeta+Shift+z");
      else if (op === "Enter x5") for (let i = 0; i < 5; i++) await page.keyboard.press("Enter");
      else await page.keyboard.press(op);
      await settle(page);
      const out = await framesOut(page);
      const r = await gapCheck(editor);
      const bad = describe(r);
      if (bad) {
        // Diagnosis: what the DOM selection is on, ProseMirror's own caret
        // rectangle, and a picture of the caret's surroundings.
        const detail = await editor.evaluate((el: any) => {
          const sel = getSelection()!;
          const view = el.editor.view;
          const paper = el.closest(".editor-paper");
          const zoom = parseFloat(getComputedStyle(paper).zoom) || 1;
          const top = el.getBoundingClientRect().top;
          const c = view.coordsAtPos(el.editor.state.selection.head);
          const node = sel.focusNode as any;
          const r = sel.rangeCount ? sel.getRangeAt(0).getBoundingClientRect() : null;
          return {
            pm: [Math.round((c.top - top) / zoom), Math.round((c.bottom - top) / zoom)],
            dom: r ? [Math.round((r.top - top) / zoom), Math.round((r.bottom - top) / zoom)] : null,
            focus: node ? `${node.nodeName}${node.className ? "." + node.className : ""}@${sel.focusOffset} of ${node.childNodes?.length ?? node.data?.length}` : "none",
            child: node?.childNodes?.[sel.focusOffset]?.className ?? node?.childNodes?.[sel.focusOffset]?.nodeName ?? null,
            before: node?.childNodes?.[sel.focusOffset - 1]?.className ?? node?.childNodes?.[sel.focusOffset - 1]?.nodeName ?? null,
            empty: el.editor.state.selection.empty,
            selection: el.editor.state.selection.toJSON(),
            node: el.editor.state.selection.node?.type.name ?? null,
            parentText: el.editor.state.selection.$head.parent.textContent.slice(0, 20),
            parentOffset: el.editor.state.selection.$head.parentOffset,
          };
        });
        violations.push(`seed ${seed} zoom ${zoom} step ${step} (${moved}${op}): ${bad} | ${JSON.stringify(detail)}`);
        if (violations.length <= 2)
          await test.info().attach(`step-${step}.png`, { body: await page.screenshot(), contentType: "image/png" });
      }
      else if (out) {
        transient++;
        violations.push(`seed ${seed} zoom ${zoom} step ${step} (${moved}${op}): out of a text area for ${out} painted frame(s) before settling`);
      }
      // Keep focus in the editor (an arrow at the document's edge can leave it).
      if (!(await editor.evaluate((el: any) => el.editor.view.hasFocus()))) {
        end = await editor.evaluate((el: any) => el.editor.state.doc.content.size - 1);
        await select(editor, end);
      }
    }
    test.info().annotations.push({
      type: "fuzz",
      description: `seed ${seed} zoom ${zoom}: ${violations.length - transient} settled violations, ${transient} steps out of a text area in a painted frame before settling`,
    });
    await test.info().attach(`violations-${zoom}.json`, {
      body: JSON.stringify({ seed, zoom, transient, violations }, null, 2),
      contentType: "application/json",
    });
    expect(violations, violations[0] ?? "").toEqual([]);
  });
}

test.describe("targeted gap cases at 100 %", () => {
  test.use({ viewport: { width: 1240, height: 840 } });

  test("Enter at the last line of page 1 puts the caret at the top of page 2", async ({ page }) => {
    const editor = await open(page, "Gap enter", lines(80));
    const { prevEnd } = await blockGap(editor);
    await select(editor, prevEnd);
    await sampleFrames(page);
    await page.keyboard.press("Enter");
    await settle(page);
    const r = await gapCheck(editor);
    expect(await framesOut(page), "painted frames with the caret or an empty line outside a text area").toBe(0);
    expect(describe(r), "after Enter").toBe("");
    expect(r.caret.page, "caret page (0-based)").toBe(1);
  });

  test("Enter after Enter from a half-full page: the caret is always on a page", async ({ page }) => {
    const editor = await open(page, "Gap enters", lines(50));
    const end = await editor.evaluate((el: any) => el.editor.state.doc.content.size - 1);
    await select(editor, end);
    const bad: string[] = [];
    for (let i = 1; i <= 25; i++) {
      await sampleFrames(page);
      await page.keyboard.press("Enter");
      await settle(page);
      const out = await framesOut(page);
      const d = describe(await gapCheck(editor));
      if (d || out) bad.push(`Enter ${i}: ${d || "settled ok"}; frames out ${out}`);
    }
    expect(bad, bad.join("\n")).toEqual([]);
  });

  test("Backspace at the first paragraph of page 2 merges up; the caret is on page 1", async ({ page }) => {
    const editor = await open(page, "Gap backspace", lines(80));
    const { nextStart } = await blockGap(editor);
    await select(editor, nextStart);
    await page.keyboard.press("Backspace");
    await settle(page);
    const r = await gapCheck(editor);
    expect(describe(r), "after Backspace").toBe("");
    expect(r.caret.page, "caret page (0-based)").toBe(0);
  });

  test("a click in the bottom margin goes to page 1's end, in the gap to page 2's start", async ({ page }) => {
    // Existing behaviour kept by tests/pages.spec.ts (split + 16 -> next page).
    // The plan's wording "gap's upper half -> end of page 1" contradicts it;
    // recorded in PAGES-DIAGNOSIS.md.
    const editor = await open(page, "Gap click", lines(80));
    const { prevEnd, nextStart, index } = await blockGap(editor);
    const spacer = page.locator(".page-spacer").nth(index);
    await spacer.scrollIntoViewIfNeeded();
    const box = (await spacer.boundingBox())!;
    const split = Number(await spacer.getAttribute("data-split"));
    const height = parseFloat((await spacer.getAttribute("style"))!.match(/height:\s*([\d.]+)px/)![1]);
    const scale = box.height / height;
    for (const [y, expected, label] of [
      [split - 40, prevEnd, "bottom margin"],
      [split + 8, nextStart, "gap upper half"],
      [split + 24, nextStart, "gap lower half"],
      [height - 20, nextStart, "next page top margin"],
    ] as const) {
      await page.mouse.click(box.x + box.width / 2, box.y + y * scale);
      const r = await gapCheck(editor);
      expect(r.caret.head, label).toBe(expected);
      expect(describe(r), label).toBe("");
    }
  });

  test("Shift+click across a gap selects across both pages", async ({ page }) => {
    const editor = await open(page, "Gap shift click", lines(80));
    const { prevEnd, nextStart } = await blockGap(editor);
    await select(editor, prevEnd - 30);
    const target = page.locator(".page-spacer + p").first();
    await target.scrollIntoViewIfNeeded();
    const box = (await target.boundingBox())!;
    await target.click({ position: { x: 20, y: box.height / 2 }, modifiers: ["Shift"] });
    const sel = await editor.evaluate((el: any) => {
      const { anchor, head } = el.editor.state.selection;
      return { anchor, head };
    });
    expect(sel.anchor).toBe(prevEnd - 30);
    expect(sel.head).toBeGreaterThanOrEqual(nextStart);
  });

  test("Backspace after a page break and Delete before one remove the break with a visible caret; undo restores", async ({ page }) => {
    // Owner (Amendment 1, G3 b): Backspace in an empty paragraph after a page
    // break made ProseMirror delete that paragraph and select the break node,
    // which page view draws as nothing, so the caret vanished. As in Word, the
    // key now removes the break and the caret stays where it was.
    const brk = { type: "pageBreak" };
    const cases = [
      { name: "Backspace, empty paragraph after", key: "Backspace", blocks: [para("First page text."), brk, para("")], at: 2, end: false, text: "" },
      { name: "Backspace, text after", key: "Backspace", blocks: [para("First page text."), brk, para("Second page text.")], at: 2, end: false, text: "Second page text." },
      { name: "Delete, empty paragraph before", key: "Delete", blocks: [para("First page text."), para(""), brk, para("Second page text.")], at: 1, end: true, text: "" },
      { name: "Delete, text before", key: "Delete", blocks: [para("First page text."), brk, para("Second page text.")], at: 0, end: true, text: "First page text." },
    ];
    const editor = await open(page, "Gap page break", [para("x")]);
    const state = () =>
      editor.evaluate((el: any) => {
        const { selection, doc } = el.editor.state;
        let breaks = 0;
        doc.descendants((n: any) => {
          if (n.type.name === "pageBreak") breaks++;
        });
        return { type: selection.toJSON().type, empty: selection.empty, breaks, text: selection.$head.parent.textContent };
      });
    for (const c of cases) {
      // Outside the undo history, so the undo below can only undo the key.
      await editor.evaluate(
        (el: any, content: unknown[]) =>
          el.editor.chain().setMeta("addToHistory", false).setContent({ type: "doc", content }).run(),
        c.blocks,
      );
      await expect.poll(() => page.locator(".page-spacer").count(), c.name).toBe(1);
      const pos = await editor.evaluate(
        (el: any, { at, end }: { at: number; end: boolean }) => {
          let found = 0;
          el.editor.state.doc.forEach((n: any, offset: number, index: number) => {
            if (index === at) found = offset + 1 + (end ? n.content.size : 0);
          });
          return found;
        },
        { at: c.at, end: c.end },
      );
      await select(editor, pos);
      await page.keyboard.press(c.key);
      await settle(page);
      expect(await state(), c.name).toEqual({ type: "text", empty: true, breaks: 0, text: c.text });
      await expect(page.locator(".page-spacer"), c.name).toHaveCount(0);
      expect(describe(await gapCheck(editor)), `${c.name}: caret`).toBe("");
      await page.keyboard.press("ControlOrMeta+z");
      await settle(page);
      expect((await state()).breaks, `${c.name}: undo restores the break`).toBe(1);
    }
  });

  test("undo and redo of a page-filling paste keep every line on a page", async ({ page }) => {
    const editor = await open(page, "Gap paste", [...lines(20), para(""), ...lines(5, 21)]);
    await select(editor, await editor.evaluate((el: any) => el.editor.state.doc.content.size - 1));
    await editor.evaluate((el: HTMLElement) => {
      const data = new DataTransfer();
      data.setData("text/plain", Array.from({ length: 45 }, (_, i) => (i % 7 === 3 ? "" : `pasted ${i}`)).join("\n"));
      el.dispatchEvent(new ClipboardEvent("paste", { clipboardData: data, bubbles: true, cancelable: true }));
    });
    const stages: string[] = [];
    for (const stage of ["paste", "undo", "redo"]) {
      if (stage === "undo") await page.keyboard.press("ControlOrMeta+z");
      if (stage === "redo") await page.keyboard.press("ControlOrMeta+Shift+z");
      await settle(page);
      await settle(page);
      const r = await gapCheck(editor);
      const m = await measurePages(editor);
      const bad = [describe(r), ...m.crossings, ...m.starts.filter((s) => Math.abs(s.layout) > 1).map((s) => `page ${s.page} start ${s.layout}`)]
        .filter(Boolean)
        .join("; ");
      if (bad) stages.push(`${stage}: ${bad}`);
    }
    expect(stages, stages.join("\n")).toEqual([]);
  });
});
