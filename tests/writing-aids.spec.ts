import { test, expect } from "@playwright/test";

async function create(page: any, title: string) {
  await page.getByRole("button", { name: "Start new project" }).click();
  await page.getByRole("button", { name: "Blank", exact: true }).click();
  await page.getByLabel("Project title").fill(title);
  await page.getByRole("button", { name: "Save", exact: true }).click();
}

test.use({ viewport: { width: 1440, height: 900 } });

async function showAids(page: any) {
  const focus = page.getByRole("button", { name: "Focus mode", exact: true });
  if (!(await focus.isVisible().catch(() => false))) {
    const more = page.getByRole("button", { name: "More formatting", exact: true });
    if (await more.isVisible().catch(() => false)) await more.click();
  }
  await expect(focus).toBeVisible({ timeout: 5_000 });
}

test("focus mode dims other paragraphs and the shortcut toggles it", async ({ page }) => {
  await page.goto("/");
  await create(page, "Focused writing");
  const editor = page.getByRole("textbox", { name: "Writing editor" });
  await editor.fill("First paragraph");
  await editor.press("End");
  await editor.press("Enter");
  await editor.pressSequentially("Second paragraph");
  await expect(editor.locator("p")).toHaveCount(2);
  await editor.press("ArrowUp");
  await editor.press("Home");
  // Wait until the editor's own selection is in the first paragraph, so the
  // focus-mode decoration is computed from the settled caret, not a stale one.
  await expect
    .poll(() =>
      editor.evaluate((el) => {
        const node = el.ownerDocument.getSelection()?.anchorNode;
        const p = node && (node.nodeType === 3 ? node.parentElement : (node as Element))?.closest("p");
        return p ? Array.from(el.querySelectorAll("p")).indexOf(p) : -1;
      }),
    )
    .toBe(0);
  await showAids(page);
  await page.getByRole("button", { name: "Focus mode", exact: true }).click();
  await expect(editor.locator("p").nth(1)).toHaveClass(/focus-dim/);
  await editor.press("ControlOrMeta+Shift+F");
  await expect(editor.locator("p").nth(1)).not.toHaveClass(/focus-dim/);
});

test("prose check lists issues and Enter on an issue selects it", async ({ page }) => {
  await page.goto("/");
  await create(page, "Prose review sample");
  const editor = page.getByRole("textbox", { name: "Writing editor" });
  await editor.fill("The the cat.");
  await showAids(page);
  await page.getByRole("button", { name: "Prose check", exact: true }).click();
  await page.getByRole("checkbox", { name: "On", exact: true }).check();
  const issue = page.getByRole("button", { name: /Repeated word: the/ });
  await expect(issue).toBeVisible();
  await issue.focus();
  await issue.press("Enter");
  await expect.poll(() => editor.evaluate((el) => el.ownerDocument.getSelection()?.toString() ?? "")).toBe("the");
});

test("aids stay off for a new session by default", async ({ page }) => {
  await page.goto("/");
  await create(page, "Aids default");
  await showAids(page);
  await expect(page.getByRole("button", { name: "Focus mode", exact: true })).toHaveAttribute("aria-pressed", "false");
  await page.getByRole("button", { name: "Prose check", exact: true }).click();
  await expect(page.getByRole("checkbox", { name: "On", exact: true })).not.toBeChecked();
});

test("the issue index pages every result while decorations stay bounded", async ({ page }) => {
  await page.goto("/");
  await create(page, "Complete prose issue index");
  const editor = page.getByRole("textbox", { name: "Writing editor" });
  await editor.fill(Array(2_101).fill("the.").join(" "));
  await showAids(page);
  await page.getByRole("button", { name: "Prose check", exact: true }).click();
  await page.getByRole("checkbox", { name: "On", exact: true }).check();

  const issues = page.getByRole("region", { name: "Prose issues" });
  await expect(issues.getByText(/2,100 total issues/)).toBeVisible();
  await expect(issues.getByRole("button", { name: "Next issue page" })).toBeVisible();
  await expect(issues.getByRole("button", { name: /Repeated word/ })).toHaveCount(100);
  await issues.getByRole("button", { name: "Next issue page" }).click();
  await expect(issues.getByText(/Page 2 of 21/)).toBeVisible();
  await expect(issues.getByRole("button", { name: /Repeated word/ }).first()).toBeVisible();
  await page.emulateMedia({ colorScheme: "light" });
  await issues.screenshot({ path: "node_modules/.cache/personal-word-beta/e2/prose/issues-light.png" });
  await page.emulateMedia({ colorScheme: "dark" });
  await issues.screenshot({ path: "node_modules/.cache/personal-word-beta/e2/prose/issues-dark.png" });
  await page.emulateMedia({ colorScheme: "light" });
});

test("prose rules can be switched off and a one-time dismissal expires when text changes", async ({ page }) => {
  await page.goto("/");
  await create(page, "Controlled prose rules");
  const editor = page.getByRole("textbox", { name: "Writing editor" });
  await editor.fill("The the letter was written very carefully.");
  await showAids(page);
  await page.getByRole("button", { name: "Prose check", exact: true }).click();
  await page.getByRole("checkbox", { name: "On", exact: true }).check();

  const issues = page.getByRole("region", { name: "Prose issues" });
  const repeated = issues.getByRole("button", { name: /Repeated word: the/ });
  await expect(repeated).toBeVisible();
  await issues.getByRole("checkbox", { name: "Repeated words" }).uncheck();
  await expect(repeated).toHaveCount(0);
  await issues.getByRole("checkbox", { name: "Repeated words" }).check();
  await expect(repeated).toBeVisible();

  await issues.getByRole("button", { name: "Dismiss this issue once" }).first().click();
  await expect(repeated).toHaveCount(0);
  await editor.press("End");
  await editor.pressSequentially(" now");
  await expect(repeated).toBeVisible();
});

test.describe("focus mode hides the toolbar until needed (X1)", () => {
  async function setup(page: any, title: string) {
    await page.goto("/");
    await create(page, title);
    const editor = page.getByRole("textbox", { name: "Writing editor" });
    await editor.click();
    await editor.pressSequentially("Quiet words");
    await editor.press("ControlOrMeta+Shift+F");
    return editor;
  }
  const bar = (page: any) => page.getByRole("toolbar", { name: "Formatting" });
  const geometry = (page: any) =>
    page.evaluate(() => {
      const b = document.querySelector(".format-bar")!.getBoundingClientRect();
      const w = document.querySelector(".writer")!.getBoundingClientRect();
      const e = document.querySelector(".writing-surface")!.getBoundingClientRect();
      return { barBottom: b.bottom, barTop: b.top, writerTop: w.top, editorTop: e.top };
    });

  test("hidden in focus mode, revealed by pointer, hides again, editor does not move", async ({ page }) => {
    const editor = await setup(page, "Focus toolbar pointer");
    await expect.poll(async () => (await geometry(page)).barBottom).toBeLessThanOrEqual(
      (await geometry(page)).writerTop,
    );
    const hidden = await geometry(page);
    await expect(bar(page)).toHaveCSS("opacity", "0");
    await page.mouse.move(500, hidden.writerTop + 20);
    await expect(bar(page)).toHaveCSS("opacity", "1", { timeout: 300 });
    const shown = await geometry(page);
    expect(shown.barTop).toBeGreaterThanOrEqual(shown.writerTop - 1);
    expect(shown.editorTop).toBe(hidden.editorTop);
    await page.mouse.move(500, hidden.writerTop + 400);
    await page.waitForTimeout(300);
    await expect(bar(page)).toHaveCSS("opacity", "1");
    await expect(bar(page)).toHaveCSS("opacity", "0", { timeout: 1500 });
    await editor.press("ControlOrMeta+Shift+F");
    await expect(bar(page)).toHaveCSS("opacity", "1");
    const normal = await geometry(page);
    expect(normal.barTop).toBeGreaterThanOrEqual(normal.writerTop - 1);
    expect(normal.editorTop).toBeGreaterThan(normal.barBottom - 1);
  });

  test("keyboard focus and the shortcut reveal it instantly; Escape hides it", async ({ page }) => {
    const editor = await setup(page, "Focus toolbar keys");
    await expect(bar(page)).toHaveCSS("opacity", "0");
    // The editor keeps Tab/Shift+Tab for indenting, so focus enters the bar from outside it.
    await bar(page).locator("button:not(:disabled)").first().focus();
    await expect(bar(page)).toHaveCSS("opacity", "1", { timeout: 100 });
    expect(await bar(page).evaluate((el) => getComputedStyle(el).transitionDuration)).toBe("0s");
    await page.keyboard.press("Escape");
    await expect(bar(page)).toHaveCSS("opacity", "0");
    await expect(editor).toBeFocused();
    await page.keyboard.press("Meta+Alt+t");
    await expect(bar(page)).toHaveCSS("opacity", "1", { timeout: 100 });
    await expect(bar(page).locator("button:focus")).toHaveCount(1);
  });

  test("an open toolbar panel keeps it revealed; Reduce Motion is instant", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await setup(page, "Focus toolbar panel");
    await page.keyboard.press("Meta+Alt+t");
    await expect(bar(page)).toHaveCSS("opacity", "1");
    expect(await bar(page).evaluate((el) => getComputedStyle(el).transitionDuration)).toBe("0s");
    await page.getByRole("button", { name: "Line and paragraph spacing" }).click();
    await expect(page.getByRole("dialog", { name: "Line and paragraph spacing" })).toBeVisible();
    await page.mouse.move(500, 700);
    await page.waitForTimeout(1000);
    await expect(bar(page)).toHaveCSS("opacity", "1");
  });
});

test.describe("revealed focus-mode toolbar never covers text (X1b)", () => {
  for (const mode of ["continuous", "page view"] as const) {
    test(`first line stays below the revealed bar and does not jump: ${mode}`, async ({ page }) => {
      await page.goto("/");
      await create(page, `Focus cover ${mode}`);
      const editor = page.getByRole("textbox", { name: "Writing editor" });
      await editor.click();
      await editor.pressSequentially("Quiet words at the very top");
      if (mode === "page view") {
        await page.getByRole("button", { name: "Page view", exact: true }).click();
        await page.keyboard.press("Escape");
        await editor.click();
      }
      const firstLineTop = () =>
        page.evaluate(() => {
          const p = document.querySelector(".writing-surface p")!;
          const r = document.createRange();
          r.selectNodeContents(p);
          return r.getClientRects()[0].top;
        });
      const normalTop = await firstLineTop();
      await editor.press("ControlOrMeta+Shift+F");
      const bar = page.getByRole("toolbar", { name: "Formatting" });
      await expect(bar).toHaveCSS("opacity", "0");
      const hiddenTop = await firstLineTop();
      expect(Math.abs(hiddenTop - normalTop)).toBeLessThanOrEqual(1);
      await page.keyboard.press("Meta+Alt+t");
      await expect(bar).toHaveCSS("opacity", "1");
      const barBottom = await bar.evaluate((el) => el.getBoundingClientRect().bottom);
      const revealedTop = await firstLineTop();
      expect(revealedTop).toBeGreaterThanOrEqual(barBottom);
      expect(revealedTop).toBe(hiddenTop);
      for (const scheme of ["light", "dark"] as const) {
        await page.emulateMedia({ colorScheme: scheme });
        await page.screenshot({ path: `node_modules/.cache/personal-word-beta/ui4-x1b/${mode.replace(" ", "-")}-revealed-${scheme}.png` });
      }
    });
  }
});

test.describe("focus mode in page view: the reserved toolbar band is desk (X1c)", () => {
  for (const scheme of ["light", "dark"] as const) {
    for (const palette of ["plain", "color"] as const) {
      test(`band pixel equals desk colour: ${scheme} ${palette}`, async ({ page }) => {
        await page.emulateMedia({ colorScheme: scheme });
        await page.goto("/");
        await create(page, `Desk band ${scheme} ${palette}`);
        if (palette === "color") await page.evaluate(() => document.documentElement.setAttribute("data-palette", "color"));
        const editor = page.getByRole("textbox", { name: "Writing editor" });
        await editor.click();
        await editor.pressSequentially("Desk words");
        await page.getByRole("button", { name: "Page view", exact: true }).click();
        await page.keyboard.press("Escape");
        await editor.click();
        const paperTop = () => page.evaluate(() => document.querySelector(".editor-paper")!.getBoundingClientRect().top);
        const normalPaper = await paperTop();
        await editor.press("ControlOrMeta+Shift+F");
        await expect(page.getByRole("toolbar", { name: "Formatting" })).toHaveCSS("opacity", "0");
        expect(Math.abs((await paperTop()) - normalPaper)).toBeLessThanOrEqual(1);
        const geo = await page.evaluate(() => {
          const w = document.querySelector(".writer")!.getBoundingClientRect();
          const v = document.querySelector(".is-paged") as HTMLElement;
          v.scrollTop = 0;
          const r = v.getBoundingClientRect();
          return { x: r.left + 6, y: w.top + 10, desk: getComputedStyle(v).backgroundColor };
        });
        await page.mouse.move(5, 5);
        const shot = (await page.screenshot({ clip: { x: geo.x, y: geo.y, width: 1, height: 1 } })).toString("base64");
        const px = await page.evaluate(async (b64) => {
          const img = new Image();
          img.src = "data:image/png;base64," + b64;
          await img.decode();
          const c = document.createElement("canvas");
          c.width = c.height = 1;
          const g = c.getContext("2d")!;
          g.drawImage(img, 0, 0);
          const d = g.getImageData(0, 0, 1, 1).data;
          return `rgb(${d[0]}, ${d[1]}, ${d[2]})`;
        }, shot);
        expect(px).toBe(geo.desk);
        await page.screenshot({ path: `node_modules/.cache/personal-word-beta/ui4-x1c/band-${scheme}-${palette}.png` });
      });
    }
  }
});

// UI wave 4 review finding 2: in split view the shared bar stays visible in focus mode, so neither
// pane jumps and the bar never covers the pane headers.
test("focus mode in split view: panes do not jump and headers are never covered", async ({ page }) => {
  await page.goto("/");
  await create(page, "Split focus");
  for (const t of ["One", "Two"]) {
    await page.getByRole("button", { name: "New section", exact: true }).click();
    await page.getByLabel("Title", { exact: true }).fill(t);
    await page.getByRole("button", { name: "Save", exact: true }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
  }
  const rowOf = (t: string) => page.locator(".sidebar .entry-main").filter({ hasText: new RegExp("^" + t) });
  await rowOf("One").click();
  await rowOf("Two").click({ modifiers: ["ControlOrMeta"] });
  await expect(page.locator(".split-pane")).toHaveCount(2);
  const left = page.getByRole("textbox", { name: "Writing editor", exact: true });
  await left.click();
  const tops = () =>
    page.evaluate(() => [...document.querySelectorAll(".split-pane .ProseMirror")].map((n) => Math.round(n.getBoundingClientRect().top * 10) / 10));
  const before = await tops();
  expect(before.length).toBe(2);
  await left.press("ControlOrMeta+Shift+F");
  await page.waitForTimeout(400);
  expect(await tops(), "pane tops after focus mode").toEqual(before);
  // pointer at the top of the writing area, where a hidden bar would be revealed
  const wTop = await page.evaluate(() => document.querySelector(".editor-area")!.getBoundingClientRect().top);
  await page.mouse.move(700, wTop + 20);
  await page.waitForTimeout(500);
  expect(await tops(), "pane tops with pointer at the top").toEqual(before);
  const covered = await page.evaluate(() =>
    [...document.querySelectorAll(".split-pane-header")].map((h) => {
      const r = h.getBoundingClientRect();
      const hit = document.elementFromPoint(r.left + 12, r.top + r.height / 2);
      return !!hit && h.contains(hit);
    }),
  );
  expect(covered, "each pane header is the topmost thing at its own point").toEqual([true, true]);
});
