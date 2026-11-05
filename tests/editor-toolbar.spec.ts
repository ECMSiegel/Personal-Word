import { test, expect } from "@playwright/test";

async function create(page: any, title: string, template = "Blank") {
  await page.getByRole("button", { name: "Start new project" }).click();
  await page.getByRole("button", { name: template, exact: true }).click();
  await page.getByLabel("Project title").fill(title);
  await page.getByRole("button", { name: "Save", exact: true }).click();
}

test.use({ viewport: { width: 1280, height: 800 } });

test("formatting toolbar stays on one row", async ({ page }) => {
  await page.goto("/");
  await create(page, "Toolbar row");
  const toolbar = page.getByRole("toolbar", { name: "Formatting" });
  await expect(toolbar).toBeVisible();
  const box = await toolbar.boundingBox();
  expect(box?.height ?? 999).toBeLessThan(48);
});

test("Tab indents the paragraph and keeps focus in the editor", async ({
  page,
}) => {
  await page.goto("/");
  await create(page, "Indent test");
  const editor = page.getByRole("textbox", { name: "Writing editor" });
  // Exercise the same actual-text pointer entry as the indentation matrix.
  await editor.locator("p").first().click();
  await editor.pressSequentially("Indented paragraph.");
  await editor.press("Home");
  // Browser Home updates the DOM selection before ProseMirror consumes it.
  // Wait for the command's actual selection, not a transient DOM offset.
  await expect
    .poll(() =>
      editor.evaluate((element: any) => ({
        offset: element.editor.state.selection.$from.parentOffset,
        empty: element.editor.state.selection.empty,
        domOffset: window.getSelection()?.anchorOffset,
      })),
    )
    .toEqual({ offset: 0, empty: true, domOffset: 0 });
  await editor.press("Tab");
  await expect(editor).toBeFocused();
  await expect(editor.locator("p").first()).toHaveAttribute(
    "style",
    /text-indent: 0\.5in/,
  );
  await expect(editor.locator("p").first()).not.toHaveAttribute(
    "style",
    /margin-left/,
  );
  await editor.press("Shift+Tab");
  await expect(editor.locator("p").first()).toHaveAttribute(
    "style",
    /text-indent: 0px;/,
  );
});

test("Tab nests a bullet list item", async ({ page }) => {
  await page.goto("/");
  await create(page, "Nested list");
  const editor = page.getByRole("textbox", { name: "Writing editor" });
  await editor.fill("First item");
  await page.getByRole("button", { name: "Bullet list", exact: true }).click();
  await editor.press("End");
  await editor.press("Enter");
  await editor.pressSequentially("Second item");
  await editor.press("Tab");
  await expect(editor.locator("ul ul li")).toHaveCount(1);
  await expect(editor.locator("ul ul li")).toHaveText("Second item");
});

test("Font family dropdown opens from the keyboard and changes the font", async ({
  page,
}) => {
  await page.goto("/");
  await create(page, "Font test");
  const editor = page.getByRole("textbox", { name: "Writing editor" });
  await editor.fill("Typeface sample");
  await editor.press("ControlOrMeta+a");
  const font = page.getByRole("button", { name: "Font family", exact: true });
  await font.focus();
  await font.press("Enter");
  await expect(
    page.getByRole("listbox", { name: "Font family" }),
  ).toBeVisible();
  for (let i = 0; i < 4; i++) await font.press("ArrowDown");
  await font.press("Enter");
  await expect(font).toContainText("Georgia");
  await expect(editor.locator('span[style*="Georgia"]').first()).toHaveText(
    "Typeface sample",
  );
});

const bar = (page: any) => page.getByRole("toolbar", { name: "Formatting" });
const moreRows = (page: any) =>
  page.getByRole("dialog", { name: "More formatting" });

// Groups that are on the bar and also listed in More would be a layout bug.
async function overflowReport(page: any) {
  return bar(page).evaluate((el: HTMLElement) => ({
    clientWidth: el.clientWidth,
    scrollWidth: el.scrollWidth,
    labels: el.hasAttribute("data-labels"),
    barLabels: [
      ...el.querySelectorAll(":scope > .toolbar-group .toolbar-label"),
    ].length,
  }));
}

test("icons only at every width", async ({ page }) => {
  await page.setViewportSize({ width: 2200, height: 900 });
  await page.goto("/");
  await create(page, "Icons only");
  await expect(bar(page)).not.toHaveAttribute("data-labels", /.*/);
  const visibleBarLabels = await bar(page)
    .locator(":scope > .toolbar-group .toolbar-label")
    .evaluateAll((els: HTMLElement[]) =>
      els.filter((el) => getComputedStyle(el).display !== "none").length,
    );
  expect(visibleBarLabels).toBe(0);
  const report = await overflowReport(page);
  expect(report.scrollWidth).toBeLessThanOrEqual(report.clientWidth);
});

test("a narrower format bar shows icons only", async ({ page }) => {
  await page.setViewportSize({ width: 1100, height: 800 });
  await page.goto("/");
  await create(page, "Icon mode");
  await expect(bar(page)).not.toHaveAttribute("data-labels", /.*/);
  const bold = bar(page).getByRole("button", {
    name: "Bold (⌘B)",
    exact: true,
  });
  await expect(bold.locator(".toolbar-label")).toBeHidden();
  const report = await overflowReport(page);
  expect(report.clientWidth).toBeLessThan(1100);
  expect(report.scrollWidth).toBeLessThanOrEqual(report.clientWidth);
});

test("the default window keeps Insert on the bar", async ({ page }) => {
  await page.setViewportSize({ width: 1240, height: 840 });
  await page.emulateMedia({ colorScheme: "light" });
  await page.addInitScript(() => {
    localStorage.setItem(
      "folio.workspace.sidebar",
      JSON.stringify({ width: 270, pinned: true, hover: true }),
    );
  });
  await page.goto("/");
  await create(page, "Insert at default width");
  const toolbar = bar(page);
  const insertImage = toolbar.locator(
    ':scope > .toolbar-group button[aria-label="Insert image"]',
  );
  const insertTable = toolbar.locator(
    ':scope > .toolbar-group button[aria-label="Insert table"]',
  );
  await expect(insertImage).toBeVisible();
  await expect(insertTable).toBeVisible();
  const more = toolbar.getByRole("button", {
    name: "More formatting",
    exact: true,
  });
  await more.click();
  const menu = moreRows(page);
  for (const label of [
    "Decrease indent",
    "Increase indent",
    "Line and paragraph spacing",
    "Page view",
    "Prose check",
    "Page setup",
  ]) {
    await expect(menu.getByRole("button", { name: label })).toBeVisible();
  }
  const report = await overflowReport(page);
  expect(report.scrollWidth).toBeLessThanOrEqual(report.clientWidth);
  await page.keyboard.press("Escape");
  const box = await toolbar.boundingBox();
  expect(box).not.toBeNull();
  const clip = {
    x: box!.x,
    y: box!.y,
    width: box!.width,
    height: box!.height,
  };
  await page.screenshot({
    path: "node_modules/.cache/personal-word-beta/ui3-e1/toolbar-light.png",
    clip,
  });
  await page.emulateMedia({ colorScheme: "dark" });
  await page.screenshot({
    path: "node_modules/.cache/personal-word-beta/ui3-e1/toolbar-dark.png",
    clip,
  });
});

test("More lists labelled rows with shortcut hints and emphasizes the hovered row", async ({
  page,
}) => {
  await page.setViewportSize({ width: 850, height: 600 });
  await page.goto("/");
  await create(page, "More rows");
  await bar(page)
    .getByRole("button", { name: "More formatting", exact: true })
    .click();
  const menu = moreRows(page);
  const bold = menu.getByRole("button", { name: "Bold (⌘B)", exact: true });
  await expect(bold.locator(".toolbar-label")).toHaveText("Bold");
  const shortcut = bold.locator(".popover-shortcut");
  await expect(shortcut).toHaveText("⌘B");
  const rowBox = await bold.boundingBox();
  const keyBox = await shortcut.boundingBox();
  expect(rowBox!.x + rowBox!.width - (keyBox!.x + keyBox!.width)).toBeLessThan(
    16,
  );
  await expect(bold).toHaveAttribute("data-popover-item", "");
  await bold.hover();
  await expect(bold).toHaveAttribute("data-highlighted", "");
  // wave 4: emphasis is a width-neutral text stroke (no font-weight change)
  await expect(bold).not.toHaveCSS("-webkit-text-stroke-width", "0px");
  await bold.click();
  await expect(
    page.getByRole("textbox", { name: "Writing editor" }).locator("p").first(),
  ).toBeVisible();
});

test("a Bold row in More toggles bold", async ({ page }) => {
  await page.setViewportSize({ width: 850, height: 600 });
  await page.goto("/");
  await create(page, "More bold");
  const editor = page.getByRole("textbox", { name: "Writing editor" });
  await editor.fill("Bold me");
  await editor.press("ControlOrMeta+a");
  await bar(page)
    .getByRole("button", { name: "More formatting", exact: true })
    .click();
  await moreRows(page)
    .getByRole("button", { name: "Bold (⌘B)", exact: true })
    .click();
  await expect(editor.locator("strong")).toHaveText("Bold me");
});

// K1/T3: effective scale is relative to the original 16 px icon artwork.
const bold = (page: any) =>
  page.getByRole("toolbar", { name: "Formatting" }).getByRole("button", { name: /^Bold/ });
const svgScale = (loc: any) =>
  loc.locator("svg").first().evaluate((el: Element) => {
    const m = new DOMMatrix(getComputedStyle(el).transform);
    return m.a * 1.5; // 24 px SVG artwork scaled to 16 px at rest.
  });

test("dock magnifies the hovered icon with neighbour falloff and no layout shift", async ({
  page,
}) => {
  await page.goto("/");
  await create(page, "Dock hover");
  const toolbar = page.getByRole("toolbar", { name: "Formatting" });
  const icons = toolbar.locator(".toolbar-icon:not([data-popover-item])");
  const before = await icons.evaluateAll((els) =>
    els.map((e) => Math.round(e.getBoundingClientRect().x * 100)),
  );
  const barH = (await toolbar.boundingBox())!.height;
  const b = (await bold(page).boundingBox())!;
  const cx = b.x + b.width / 2;
  const cy = b.y + b.height / 2;
  await page.mouse.move(cx - 60, cy);
  await page.mouse.move(cx, cy, { steps: 4 });
  await expect.poll(() => svgScale(bold(page))).toBeGreaterThan(1.45);
  expect(await svgScale(bold(page))).toBeLessThan(1.55);
  const scales = await icons.evaluateAll((els) =>
    els.map((e) => new DOMMatrix(getComputedStyle(e.querySelector("svg")!).transform).a * 1.5),
  );
  expect(Math.min(...scales)).toBeCloseTo(1, 3); // far icons stay at their 16 px resting size
  expect(scales.filter((s) => s > 1.2 && s < 1.45).length).toBeGreaterThan(0);
  expect(await icons.evaluateAll((els) => els.map((e) => Math.round(e.getBoundingClientRect().x * 100)))).toEqual(before);
  expect((await toolbar.boundingBox())!.height).toBe(barH);
  await page.mouse.move(cx, cy + 300);
  // The scale eases back; allow for the last frame of the transition.
  await expect.poll(() => svgScale(bold(page)), { timeout: 1000 }).toBeLessThan(1.001);
});

test("dock: Reduce Motion means no magnification", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await create(page, "Dock reduced");
  const b = (await bold(page).boundingBox())!;
  await page.mouse.move(b.x + 2, b.y + 2);
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2, { steps: 4 });
  await page.waitForTimeout(250);
  expect(await svgScale(bold(page))).toBeCloseTo(1, 5);
});

test("dock: keyboard focus peaks instantly", async ({ page }) => {
  await page.goto("/");
  await create(page, "Dock keys");
  await bold(page).focus();
  await page.keyboard.press("Shift+Tab");
  await page.keyboard.press("Tab");
  await expect(bold(page)).toBeFocused();
  expect(await svgScale(bold(page))).toBeCloseTo(1.5, 1);
  const dur = await bold(page).locator("svg").first().evaluate((el: Element) => getComputedStyle(el).transitionDuration);
  expect(dur).toBe("0s");
});

test("scissor uses the cursor paragraph and keeps dock geometry fixed", async ({ page }) => {
  await page.goto("/");
  await create(page, "Scissor paragraph");
  const editor = page.getByRole("textbox", { name: "Writing editor" });
  const toolbar = bar(page);
  const scissor = toolbar.getByRole("button", { name: "Keep as fragment", exact: true });
  const comment = toolbar.getByRole("button", { name: "Comment on selection", exact: true });
  await expect(scissor).toBeDisabled();
  await expect(comment).toBeDisabled();
  const paragraph = "Keep this whole paragraph as a fragment.";
  await editor.fill(paragraph);
  await editor.press("End");
  await expect.poll(() => editor.evaluate((el: any) => el.editor.state.selection.empty)).toBe(true);

  await expect(scissor).toBeEnabled();
  await expect(comment).toBeEnabled();

  const geometry = () => toolbar.evaluate((el) => ({
    width: el.getBoundingClientRect().width,
    height: el.getBoundingClientRect().height,
    centers: [...el.querySelectorAll<HTMLElement>(".toolbar-icon, .extract")].map((button) => [
      button.getAttribute("aria-label"),
      button.getBoundingClientRect().left + button.getBoundingClientRect().width / 2,
    ]),
  }));
  const atRest = await geometry();
  const scissorSvgAtRest = (await scissor.locator("svg").boundingBox())!.width;
  await scissor.hover();
  await expect.poll(async () => (await scissor.locator("svg").boundingBox())!.width).toBeGreaterThan(scissorSvgAtRest);
  const hovered = await geometry();
  expect(hovered.width).toBeCloseTo(atRest.width, 1);
  expect(hovered.height).toBeCloseTo(atRest.height, 1);
  expect(hovered.centers.map(([label]) => label)).toEqual(atRest.centers.map(([label]) => label));
  hovered.centers.forEach(([, center], index) => {
    expect(Math.abs(center - atRest.centers[index][1])).toBeLessThanOrEqual(0.5);
  });
  await scissor.click();
  await expect(editor).not.toContainText(paragraph);
  await page.locator(".group-title").filter({ hasText: /^Fragments$/ }).click();
  await expect(page.locator(".fragment-library")).toContainText(paragraph);
});

test("comment on a collapsed cursor captures the whole paragraph", async ({ page }) => {
  await page.goto("/");
  await create(page, "Comment paragraph");
  const editor = page.getByRole("textbox", { name: "Writing editor" });
  const paragraph = "Comment on this complete paragraph.";
  await editor.fill(paragraph);
  await editor.press("End");
  await expect.poll(() => editor.evaluate((el: any) => el.editor.state.selection.empty)).toBe(true);
  const comment = bar(page).getByRole("button", { name: "Comment on selection", exact: true });
  await expect(comment).toBeEnabled();
  await comment.click();
  await page.getByLabel("Note", { exact: true }).fill("Paragraph comment");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await page.locator(".group-title").filter({ hasText: /^Comments$/ }).click();
  await expect(page.locator("article.feature-item").filter({ hasText: "Paragraph comment" })).toContainText(paragraph);
});

test("format bar zoom, paragraph style and font dropdowns draw no border or fill", async ({ page }) => {
  await page.goto("/");
  await create(page, "Plain dropdowns");
  for (const name of ["Editor zoom", "Paragraph style", "Font family"]) {
    const trigger = bar(page).getByRole("button", { name, exact: true });
    await expect(trigger).toBeVisible();
    const style = await trigger.evaluate((el) => {
      const s = getComputedStyle(el);
      return {
        borders: [s.borderTopWidth, s.borderRightWidth, s.borderBottomWidth, s.borderLeftWidth],
        background: s.backgroundColor,
      };
    });
    expect(style, name).toEqual({ borders: ["0px", "0px", "0px", "0px"], background: "rgba(0, 0, 0, 0)" });
    // Keyboard focus still shows a ring (outline), not a box.
    // A key press makes the focus keyboard-driven, so :focus-visible applies.
    await trigger.focus();
    await page.keyboard.press("Shift+Tab");
    await page.keyboard.press("Tab");
    await expect(trigger).toBeFocused();
    const ring = await trigger.evaluate((el) => ({
      visible: el.matches(":focus-visible"),
      outline: getComputedStyle(el).outlineStyle,
    }));
    expect(ring, name).toEqual({ visible: true, outline: "solid" });
  }
});

test("Page setup Paper size and Page margins keep their 1 px box", async ({ page }) => {
  await page.goto("/");
  await create(page, "Page setup boxes");
  await bar(page).getByRole("button", { name: "More formatting", exact: true }).click();
  await moreRows(page).getByRole("button", { name: "Page setup", exact: true }).click();
  const panel = page.getByRole("dialog", { name: "Page setup" });
  await expect(panel).toBeVisible();
  for (const name of ["Paper size", "Page margins"]) {
    const control = panel.getByRole("button", { name, exact: true });
    await expect(control).toBeVisible();
    const borders = await control.evaluate((el) => {
      const s = getComputedStyle(el);
      return [s.borderTopWidth, s.borderRightWidth, s.borderBottomWidth, s.borderLeftWidth];
    });
    expect(borders, name).toEqual(["1px", "1px", "1px", "1px"]);
  }
});

test("format bar dropdowns held in More draw no border at a narrow width", async ({ page }) => {
  // At 460 px all three triggers have overflowed into More (measured: zoom from 520 px down).
  await page.setViewportSize({ width: 460, height: 800 });
  await page.goto("/");
  await create(page, "Narrow More boxes");
  await bar(page).getByRole("button", { name: "More formatting", exact: true }).click();
  const menu = moreRows(page);
  for (const name of ["Editor zoom", "Paragraph style", "Font family"]) {
    const trigger = menu.getByRole("button", { name, exact: true });
    await expect(trigger, name).toBeVisible();
    const borders = await trigger.evaluate((el) => {
      const s = getComputedStyle(el);
      return [s.borderTopWidth, s.borderRightWidth, s.borderBottomWidth, s.borderLeftWidth];
    });
    expect(borders, name).toEqual(["0px", "0px", "0px", "0px"]);
  }
});
