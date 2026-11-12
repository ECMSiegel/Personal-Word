import { test, expect, type Locator, type Page } from "@playwright/test";
import { create, para, seedBlocks, select, togglePageView } from "./pages-helpers";

const editorOf = (page: Page) => page.getByRole("textbox", { name: "Writing editor", exact: true });

async function hit(page: Page, editor: Locator, x: number, y: number, label: string, shift = false) {
  const target = await page.evaluate(
    ({ x, y }) => {
      const el = document.elementFromPoint(x, y);
      return el ? `${el.tagName.toLowerCase()}${typeof el.className === "string" && el.className ? `.${el.className.trim().replace(/\s+/g, ".")}` : ""}` : "null";
    },
    { x, y },
  );
  console.log(`blank-click ${label}: elementFromPoint(${x}, ${y}) = ${target}`);
  if (shift) await page.keyboard.down("Shift");
  try {
    await page.mouse.click(x, y);
  } finally {
    if (shift) await page.keyboard.up("Shift");
  }
  return editor.evaluate((el: any) => ({
    focused: el.editor.view.hasFocus(),
    head: el.editor.state.selection.head,
    anchor: el.editor.state.selection.anchor,
    end: el.editor.state.doc.content.size - 1,
    empty: el.editor.state.selection.empty,
    paragraphs: [...el.querySelectorAll("p")].map((p: any) => ({
      start: el.editor.view.posAtDOM(p, 0),
      end: el.editor.view.posAtDOM(p, p.childNodes.length),
      rect: (() => {
        const r = p.getBoundingClientRect();
        return { left: r.left, right: r.right, top: r.top, bottom: r.bottom };
      })(),
    })),
    paper: (() => {
      const r = el.closest(".editor-paper").getBoundingClientRect();
      return { left: r.left, right: r.right, top: r.top, bottom: r.bottom };
    })(),
  }));
}

for (const mode of ["continuous", "page"] as const) {
  test(`blank-page clicks place and extend the caret in ${mode} view`, async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await create(page, `Blank click ${mode}`);
    await seedBlocks(page, [para("First line"), para("Second line"), para("Third line")]);
    if (mode === "page") await togglePageView(page);
    const editor = editorOf(page);
    await expect(editor).toBeVisible();

    const initial = await editor.evaluate((el: any) => {
      const paragraphs = [...el.querySelectorAll("p")];
      const paper = el.closest(".editor-paper").getBoundingClientRect();
      return {
        paragraphs: paragraphs.map((p: any) => {
          const r = p.getBoundingClientRect();
          return {
            start: el.editor.view.posAtDOM(p, 0),
            end: el.editor.view.posAtDOM(p, p.childNodes.length),
            left: r.left,
            right: r.right,
            top: r.top,
            bottom: r.bottom,
          };
        }),
        paper: { left: paper.left, right: paper.right, top: paper.top, bottom: paper.bottom },
        viewport: (() => {
          const r = el.closest(".editor-viewport").getBoundingClientRect();
          return { left: r.left, right: r.right, top: r.top, bottom: r.bottom };
        })(),
        surface: (() => {
          const r = el.getBoundingClientRect();
          return { left: r.left, right: r.right, top: r.top, bottom: r.bottom };
        })(),
      };
    });
    const [first, second, last] = initial.paragraphs;
    expect(first).toBeTruthy();
    expect(second).toBeTruthy();
    expect(last).toBeTruthy();
    const failures: string[] = [];

    // (a) A point below the last text line but still inside the paper viewport.
    const appendY = Math.min(last.bottom + 40, initial.paper.bottom - 12, initial.viewport.bottom - 12);
    expect(appendY).toBeGreaterThan(last.bottom);
    const append = await hit(page, editor, last.left, appendY, "below last paragraph");
    if (!append.focused) failures.push("(a) editor did not focus after click below last line");
    if (append.head !== append.end) failures.push(`(a) caret ${append.head} != document end ${append.end}`);
    if (append.focused && append.head === append.end) {
      await page.keyboard.type(" appended");
      await expect(editor).toContainText("Third line appended");
    }

    // Re-read geometry after input; left/right margin clicks should resolve to paragraph two.
    const p2 = await editor.evaluate((el: any) => {
      const p = el.querySelectorAll("p")[1];
      const r = p.getBoundingClientRect();
      const paper = el.closest(".editor-paper").getBoundingClientRect();
      return {
        start: el.editor.view.posAtDOM(p, 0),
        end: el.editor.view.posAtDOM(p, p.childNodes.length),
        top: r.top,
        bottom: r.bottom,
        paperLeft: paper.left,
        paperRight: paper.right,
      };
    });
    const middleY = (p2.top + p2.bottom) / 2;

    // (b) and (c) The margins align the caret with paragraph two's start/end.
    const left = await hit(page, editor, p2.paperLeft + 12, middleY, "left margin at paragraph two");
    if (!left.focused) failures.push("(b) editor did not focus after left-margin click");
    if (left.head !== p2.start) failures.push(`(b) caret ${left.head} != paragraph start ${p2.start}`);
    const right = await hit(page, editor, p2.paperRight - 12, middleY, "right margin at paragraph two");
    if (!right.focused) failures.push("(c) editor did not focus after right-margin click");
    if (right.head !== p2.end) failures.push(`(c) caret ${right.head} != paragraph end ${p2.end}`);

    // (d) Shift-click in the margin extends from the existing anchor.
    await select(editor, first.start + 3);
    const beforeShift = await editor.evaluate((el: any) => ({
      anchor: el.editor.state.selection.anchor,
      head: el.editor.state.selection.head,
    }));
    console.log(`blank-click shift setup: ${JSON.stringify(beforeShift)}`);
    if (beforeShift.anchor !== first.start + 3 || beforeShift.head !== first.start + 3)
      failures.push(`(d) test setup selection is ${beforeShift.anchor}..${beforeShift.head}, expected ${first.start + 3}`);
    const extended = await hit(page, editor, p2.paperLeft + 12, middleY, "shift-click left margin", true);
    if (!extended.focused) failures.push("(d) editor did not focus after shift-click");
    if (extended.anchor !== first.start + 3) failures.push(`(d) anchor ${extended.anchor} != ${first.start + 3}`);
    if (extended.empty) failures.push("(d) shift-click did not extend the selection");

    // (e) A click inside text remains handled by ProseMirror's normal hit testing. Collapse the
    // (d) selection first: a press inside an existing selection is the browser's drag-start path,
    // which settles on mouse-up and is not what this case checks.
    await select(editor, first.start + 1);
    const textPoint = await editor.evaluate((el: any) => {
      const text = el.querySelector("p")?.firstChild;
      if (!text) throw new Error("first paragraph has no text node");
      const range = document.createRange();
      range.selectNodeContents(text);
      const r = range.getBoundingClientRect();
      return { x: r.left + r.width / 2, y: (r.top + r.bottom) / 2 };
    });
    await hit(page, editor, textPoint.x, textPoint.y, "inside text");
    // The collapse to the click point lands on mouse-up; wait for the editor state to show it.
    await expect
      .poll(() => editor.evaluate((el: any) => el.editor.state.selection.head), { message: "caret moves into paragraph one text" })
      .toBeGreaterThan(first.start + 1);
    const textClick = await editor.evaluate((el: any) => ({
      focused: el.editor.view.hasFocus(),
      head: el.editor.state.selection.head,
      empty: el.editor.state.selection.empty,
    }));
    if (!textClick.focused) failures.push("(e) editor lost focus after inside-text click");
    if (!textClick.empty || textClick.head <= first.start || textClick.head >= first.end)
      failures.push(`(e) ProseMirror did not place an empty text selection inside paragraph one: ${textClick.head}`);
    expect(failures, `${mode} blank-click failures`).toEqual([]);
  });
}
