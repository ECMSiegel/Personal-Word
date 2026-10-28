import { test, expect, type Page } from "@playwright/test";

export async function createProject(page: Page, title: string) {
  await page.getByRole("button", { name: "Start new project" }).click();
  await page.getByRole("button", { name: "Blank", exact: true }).click();
  await page.getByLabel("Project title").fill(title);
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await page.getByRole("button", { name: "Projects", exact: true }).click();
  await expect(page.locator(".library")).toBeVisible();
}

async function seed(page: Page) {
  await page.goto("/");
  for (const title of ["Alpha draft", "Beta notes", "Gamma"]) {
    await createProject(page, title);
  }
  await expect(page.locator(".project-row")).toHaveCount(3);
}

test("search expands from the magnifier, filters by title, and Escape collapses", async ({ page }) => {
  await seed(page);
  const button = page.getByRole("button", { name: "Search projects", exact: true });
  const input = page.getByRole("searchbox", { name: "Filter projects by title" });
  const box = page.locator(".library-search");
  const field = page.locator(".library-search-field");
  const clip = () => field.evaluate((el) => getComputedStyle(el).clipPath);
  await expect(button).toHaveAttribute("aria-expanded", "false");
  await expect(box).not.toHaveAttribute("data-open");
  await expect.poll(clip).not.toBe("inset(0px)");
  await button.click();
  await expect(input).toBeFocused();
  await expect(button).toHaveAttribute("aria-expanded", "true");
  await expect(box).toHaveAttribute("data-open", "true");
  await expect.poll(clip).toBe("inset(0px)");
  await input.fill("  BETA ");
  await expect(page.locator(".project-row")).toHaveCount(1);
  await expect(page.locator(".project-row")).toContainText("Beta notes");
  await input.fill("zzz");
  await expect(page.locator(".project-row")).toHaveCount(0);
  await expect(page.getByText("No matching projects.")).toBeVisible();
  await input.press("Escape");
  await expect(input).toHaveValue("");
  await expect(button).toHaveAttribute("aria-expanded", "false");
  await expect(button).toBeFocused();
  await expect(page.locator(".project-row")).toHaveCount(3);
  await expect(box).not.toHaveAttribute("data-open");
  await expect.poll(clip).not.toBe("inset(0px)");
});

test("open search field stays right of the create button at 850x600", async ({ page }) => {
  await page.setViewportSize({ width: 850, height: 600 });
  await seed(page);
  await page.getByRole("button", { name: "Search projects", exact: true }).click();
  const field = page.locator(".library-search-field");
  await expect.poll(() => field.evaluate((el) => getComputedStyle(el).clipPath)).toBe("inset(0px)");
  const create = (await page.getByRole("button", { name: "Start new project" }).boundingBox())!;
  const open = (await field.boundingBox())!;
  expect(open.x).toBeGreaterThan(create.x + create.width);
});

test("search works from the keyboard alone", async ({ page }) => {
  await seed(page);
  const button = page.getByRole("button", { name: "Search projects", exact: true });
  const input = page.getByRole("searchbox", { name: "Filter projects by title" });
  await button.focus();
  await page.keyboard.press("Enter");
  await expect(input).toBeFocused();
  await page.keyboard.type("gam");
  await expect(page.locator(".project-row")).toHaveCount(1);
  await page.keyboard.press("Escape");
  await expect(button).toBeFocused();
  await expect(page.locator(".project-row")).toHaveCount(3);
  // collapsed field is skipped by Tab: next stop after the button is the Sort control
  await page.keyboard.press("Tab");
  await expect(input).not.toBeFocused();
});

test("search box is square and has no motion under reduced motion", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await seed(page);
  const box = page.locator(".library-search-field");
  const style = await box.evaluate((el) => {
    const s = getComputedStyle(el);
    return { duration: s.transitionDuration, radius: s.borderRadius };
  });
  expect(style.duration).toBe("0s");
  expect(style.radius).toBe("0px");
});

test("search box reveals by clip-path by default", async ({ page }) => {
  await seed(page);
  const style = await page
    .locator(".library-search-field")
    .evaluate((el) => {
      const s = getComputedStyle(el);
      return { property: s.transitionProperty, duration: s.transitionDuration };
    });
  expect(style.property).toBe("clip-path");
  expect(style.duration).not.toBe("0s");
});

test("closed search slot shows no field border above the magnifier", async ({ page }) => {
  await seed(page);
  for (const scheme of ["light", "dark"] as const) {
    await page.emulateMedia({ colorScheme: scheme });
    const box = (await page.locator(".library-search").boundingBox())!;
    await page.mouse.move(5, 5);
    const png = (await page.screenshot({ clip: box })).toString("base64");
    // Top rows of the slot sit above the 15px icon, so they must be flat (a leaked border differs by 15+; 3 allows dither).
    const rows = await page.evaluate(async (b64) => {
      const img = new Image();
      img.src = `data:image/png;base64,${b64}`;
      await img.decode();
      const c = document.createElement("canvas");
      c.width = img.width;
      c.height = img.height;
      const g = c.getContext("2d")!;
      g.drawImage(img, 0, 0);
      const out: number[] = [];
      for (let y = 0; y < 3 * (img.height / 28); y++) {
        const d = g.getImageData(0, y, img.width, 1).data;
        let spread = 0;
        for (let c = 0; c < 3; c++) {
          const vals = Array.from({ length: img.width }, (_, x) => d[x * 4 + c]);
          spread = Math.max(spread, Math.max(...vals) - Math.min(...vals));
        }
        out.push(spread);
      }
      return out;
    }, png);
    for (const r of rows) expect(r, `${scheme}: row spreads ${rows}`).toBeLessThanOrEqual(3);
  }
});

test("open search input text clears the left border", async ({ page }) => {
  await seed(page);
  await page.getByRole("button", { name: "Search projects", exact: true }).click();
  const input = page.getByRole("searchbox", { name: "Filter projects by title" });
  await expect
    .poll(() => input.evaluate((el) => parseFloat(getComputedStyle(el).paddingLeft)))
    .toBeGreaterThanOrEqual(4);
});

const TEMPLATE_ITEMS = ["Blank", "Chicago", "Screenplay"];
const PANEL_ITEMS = [...TEMPLATE_ITEMS, "Import a file…", "Recover from a project.json file…"];

async function openPanel(page: Page) {
  await page.goto("/");
  const trigger = page.getByRole("button", { name: "Start new project" });
  await trigger.click();
  return { trigger, panel: page.locator("#create-panel") };
}

test("create button opens a panel listing every template, then the two file actions", async ({ page }) => {
  const { trigger, panel } = await openPanel(page);
  await expect(trigger).toHaveAttribute("aria-expanded", "true");
  await expect(trigger).toHaveAttribute("aria-controls", "create-panel");
  await expect(panel).toBeVisible();
  const labels = await panel.getByRole("button").allTextContents();
  expect(labels.map((l) => l.trim())).toEqual(PANEL_ITEMS);
  await expect(panel.getByRole("button").first()).toBeFocused();
});

test("the create menu covers the button and grows out of it", async ({ page }) => {
  await page.goto("/");
  const toolbar = page.locator(".library-toolbar");
  const before = (await toolbar.boundingBox())!;
  const trigger = page.getByRole("button", { name: "Start new project" });
  await trigger.click();
  const panel = page.locator("#create-panel");
  await expect(panel).toBeVisible();
  const t = (await trigger.boundingBox())!;
  const p = (await panel.boundingBox())!;
  // The menu covers the button: same top-left corner, taller and no narrower.
  expect(Math.abs(p.x - t.x)).toBeLessThanOrEqual(1);
  expect(Math.abs(p.y - t.y)).toBeLessThanOrEqual(1);
  expect(p.height).toBeGreaterThan(t.height * 4);
  expect(p.width).toBeGreaterThanOrEqual(t.width);
  // The button fades out under the menu; the header row does not move.
  await expect
    .poll(() => trigger.evaluate((el) => Number(getComputedStyle(el).opacity)))
    .toBe(0);
  const after = (await toolbar.boundingBox())!;
  expect(Math.abs(after.y - before.y)).toBeLessThanOrEqual(1);
  await page.keyboard.press("Escape");
  await expect(panel).toHaveCount(0);
  await expect
    .poll(() => trigger.evaluate((el) => Number(getComputedStyle(el).opacity)))
    .toBe(1);
});

test("the create menu collapses with a morph on close, and instantly under reduced motion", async ({ page }) => {
  const { panel } = await openPanel(page);
  await page.keyboard.press("Escape");
  // Still mounted and marked closing while the morph runs, then gone.
  await expect(panel).toHaveAttribute("data-state", "closing");
  await expect(panel).toHaveCount(0);
  await page.emulateMedia({ reducedMotion: "reduce" });
  const again = await openPanel(page);
  await page.keyboard.press("Escape");
  await expect(again.panel).toHaveCount(0);
});

test("Escape closes the panel and returns focus to the create button", async ({ page }) => {
  const { trigger, panel } = await openPanel(page);
  await page.keyboard.press("Escape");
  await expect(panel).toHaveCount(0);
  await expect(trigger).toHaveAttribute("aria-expanded", "false");
  await expect(trigger).toBeFocused();
});

test("tabbing out of the create panel dismisses it", async ({ page }) => {
  const { panel } = await openPanel(page);
  await panel.getByRole("button").last().focus();
  await page.keyboard.press("Tab");
  await expect(panel).toHaveCount(0);
});

test("Escape on the focused create trigger closes the open panel", async ({
  page,
}) => {
  const { panel } = await openPanel(page);
  const trigger = page.getByRole("button", { name: "Start new project" });
  await page.keyboard.press("Shift+Tab");
  await expect(trigger).toBeFocused();
  await expect(panel).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(panel).toHaveCount(0);
  await expect(trigger).toBeFocused();
});

test("clicking outside closes the panel", async ({ page }) => {
  const { panel } = await openPanel(page);
  await expect(panel).toBeVisible();
  const toolbar = (await page.locator(".library-toolbar").boundingBox())!;
  await page.mouse.click(toolbar.x + toolbar.width / 2, toolbar.y + toolbar.height / 2);
  await expect(panel).toHaveCount(0);
});

test("the Projects screen has no heading: the button sits left, the controls right", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");
  await expect(page.locator(".library h1")).toHaveCount(0);
  await expect(page.locator(".library").getByRole("heading")).toHaveCount(0);
  await expect(page.locator(".library")).toHaveAttribute("aria-label", "Projects");
  const brand = (await page.locator(".library .brand").boundingBox())!;
  const create = (await page.getByRole("button", { name: "Start new project" }).boundingBox())!;
  const display = (await page.locator(".library-display").boundingBox())!;
  const bar = (await page.locator(".library-toolbar").boundingBox())!;
  expect(brand.y + brand.height).toBeLessThanOrEqual(create.y);
  expect(create.x - bar.x).toBeLessThanOrEqual(1);
  expect(bar.x + bar.width - (display.x + display.width)).toBeLessThanOrEqual(1);
  expect(display.x).toBeGreaterThan(create.x + create.width);
});

test("create panel works from the keyboard alone", async ({ page }) => {
  await page.goto("/");
  const trigger = page.getByRole("button", { name: "Start new project" });
  await trigger.focus();
  await page.keyboard.press("Enter");
  const items = page.locator("#create-panel").getByRole("button");
  await expect(items.nth(0)).toBeFocused();
  await page.keyboard.press("ArrowDown");
  await expect(items.nth(1)).toBeFocused();
  await page.keyboard.press("ArrowUp");
  await expect(items.nth(0)).toBeFocused();
  await page.keyboard.press("End");
  await expect(items.last()).toBeFocused();
  await page.keyboard.press("Home");
  await expect(items.nth(0)).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(trigger).toBeFocused();
  await page.keyboard.press("Space");
  await expect(page.locator("#create-panel")).toBeVisible();
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("Enter");
  await expect(page.getByLabel("Project title")).toBeVisible();
});

test("Import a file opens the writing picker and a chosen file reaches the import preview", async ({ page }) => {
  const { panel } = await openPanel(page);
  const chooser = page.waitForEvent("filechooser");
  await panel.getByRole("button", { name: "Import a file…", exact: true }).click();
  const picker = await chooser;
  expect(await picker.element().evaluate((el) => el.id)).toBe("import-writing-text");
  await expect(page.locator("#create-panel")).toHaveCount(0);
  await picker.setFiles({ name: "Panel.md", mimeType: "text/markdown", buffer: Buffer.from("# From the panel\n\nBody.") });
  await expect(page.getByRole("dialog", { name: "Import writing" })).toBeVisible();
});

test("Recover from a project.json file opens the project.json picker", async ({ page }) => {
  const { panel } = await openPanel(page);
  const chooser = page.waitForEvent("filechooser");
  await panel.getByRole("button", { name: "Recover from a project.json file…", exact: true }).click();
  const picker = await chooser;
  expect(await picker.element().evaluate((el) => el.id)).toBe("import-project-json");
  await expect(page.locator("#create-panel")).toHaveCount(0);
});

test("the two old import links are gone but both pickers stay mounted", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator(".import")).toHaveCount(0);
  await expect(page.getByText("Choose writing…")).toHaveCount(0);
  await expect(page.getByText("Choose project.json…")).toHaveCount(0);
  await expect(page.locator("#import-writing-text")).toBeAttached();
  await expect(page.locator("#import-project-json")).toBeAttached();
  await expect(page.locator("#import-writing-label")).toBeAttached();
  await expect(page.locator("#import-project-label")).toHaveText("Recover from a project.json file");
});

test("create menu is square and opens with a morph by default", async ({ page }) => {
  const { panel } = await openPanel(page);
  const style = await panel.evaluate((el) => ({
    animations: el.getAnimations().length,
    radius: getComputedStyle(el).borderRadius,
  }));
  expect(style.animations).toBeGreaterThan(0);
  expect(style.radius).toBe("0px");
});

test("create menu has no motion under reduced motion", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  const { panel } = await openPanel(page);
  const style = await panel.evaluate((el) => ({
    animations: el.getAnimations().length,
    radius: getComputedStyle(el).borderRadius,
  }));
  expect(style.animations).toBe(0);
  expect(style.radius).toBe("0px");
});

// Every panel item must be fully legible the moment the panel exists (a screenshot or a fast
// reader catches the morph mid-way), in both appearances and both palettes.
for (const [theme, palette] of [["light", "plain"], ["light", "color"], ["dark", "plain"], ["dark", "color"]]) {
  for (const reduced of [false, true]) {
    test(`create panel items are full-contrast text at once (${theme}/${palette}${reduced ? ", reduced motion" : ""})`, async ({ page }) => {
      await page.addInitScript(
        ([t, p]) => localStorage.setItem("folio.workspace.appearance", JSON.stringify({ theme: t, palette: p })),
        [theme, palette],
      );
      if (reduced) await page.emulateMedia({ reducedMotion: "reduce" });
      await page.goto("/");
      await page.getByRole("button", { name: "Start new project" }).click();
      const read = () =>
        page.locator("#create-panel .popover-item").evaluateAll((buttons) => {
          const probe = document.createElement("span");
          probe.style.color = "var(--text)";
          document.body.append(probe);
          const text = getComputedStyle(probe).color;
          probe.remove();
          return { text, items: buttons.map((b) => ({ color: getComputedStyle(b).color, opacity: getComputedStyle(b).opacity })) };
        });
      // At most ~100 ms after the click: no waiting for the morph.
      const early = await read();
      expect(early.items).toHaveLength(PANEL_ITEMS.length);
      for (const item of early.items) expect(item).toEqual({ color: early.text, opacity: "1" });
      // And once the morph has finished.
      await page.waitForTimeout(400);
      const settled = await read();
      for (const item of settled.items) expect(item).toEqual({ color: settled.text, opacity: "1" });
    });
  }
}

type DropFile = { name: string; body?: string; size?: number; type?: string };

// A DataTransfer holding synthetic files, as a browser builds one for a Finder drag.
function filesTransfer(page: Page, files: DropFile[]) {
  return page.evaluateHandle((list) => {
    const transfer = new DataTransfer();
    for (const f of list) {
      const content = f.size !== undefined ? new Uint8Array(f.size).fill(97) : (f.body ?? "");
      transfer.items.add(new File([content], f.name, { type: f.type ?? "" }));
    }
    return transfer;
  }, files);
}

async function dropOnLibrary(page: Page, files: DropFile[]) {
  const dataTransfer = await filesTransfer(page, files);
  const region = page.locator(".library .drop-target");
  await region.dispatchEvent("dragenter", { dataTransfer });
  await region.dispatchEvent("dragover", { dataTransfer });
  await region.dispatchEvent("drop", { dataTransfer });
}

const DROPPED_MD: DropFile = { name: "dropped.md", body: "# Dropped\n\nBody", type: "text/markdown" };

test("dropping a Markdown file outlines the project list only and opens the import preview; Cancel creates nothing", async ({ page }) => {
  await page.goto("/");
  const library = page.locator(".library");
  const region = page.locator(".library .drop-target");
  const dataTransfer = await filesTransfer(page, [DROPPED_MD]);
  await library.dispatchEvent("dragenter", { dataTransfer });
  await expect(region).toHaveAttribute("data-state", "accept");
  await expect(region.locator(".drop-target-label")).toHaveText("Drop to import");
  const outline = await region.evaluate((el) => {
    const s = getComputedStyle(el);
    return { style: s.outlineStyle, width: s.outlineWidth, radius: s.borderRadius };
  });
  expect(outline).toEqual({ style: "solid", width: "1px", radius: "0px" });
  // Nothing on the page body: no outline, no tint.
  await expect(library).not.toHaveAttribute("data-dropping");
  expect(await library.evaluate((el) => getComputedStyle(el).outlineStyle)).toBe("none");
  await region.dispatchEvent("dragover", { dataTransfer });
  await region.dispatchEvent("drop", { dataTransfer });
  await expect(region).not.toHaveAttribute("data-state");
  const preview = page.getByRole("dialog", { name: "Import writing" });
  await expect(preview).toBeVisible();
  await expect(preview).toContainText("dropped.md -- Markdown");
  await preview.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(preview).toHaveCount(0);
  await expect(page.locator(".project-row")).toHaveCount(0);
});

test("the drop outline does not flicker over children and clears on dragleave", async ({ page }) => {
  await page.goto("/");
  const library = page.locator(".library");
  const region = page.locator(".library .drop-target");
  const toolbar = page.locator(".library-toolbar");
  const dataTransfer = await filesTransfer(page, [DROPPED_MD]);
  await library.dispatchEvent("dragenter", { dataTransfer });
  await toolbar.dispatchEvent("dragenter", { dataTransfer });
  await library.dispatchEvent("dragleave", { dataTransfer });
  await expect(region).toHaveAttribute("data-state", "accept");
  await toolbar.dispatchEvent("dragleave", { dataTransfer });
  await expect(region).not.toHaveAttribute("data-state");
});

test("a file dropped outside the Projects list does not make the browser open it", async ({ page }) => {
  await page.goto("/");
  const prevented = await page.evaluate(() =>
    ["dragover", "drop"].map((type) => {
      const event = new DragEvent(type, { bubbles: true, cancelable: true });
      document.body.dispatchEvent(event);
      return event.defaultPrevented;
    }),
  );
  expect(prevented).toEqual([true, true]);
});

test("a dropped PDF shows a clear error and opens nothing", async ({ page }) => {
  await page.goto("/");
  await dropOnLibrary(page, [{ name: "Paper.pdf", body: "%PDF-1.7", type: "application/pdf" }]);
  await expect(page.getByRole("alert")).toContainText(
    "Personal Word can import .txt, .md, .docx, .html or .zip files.",
  );
  await expect(page.getByRole("dialog", { name: "Import writing" })).toHaveCount(0);
});

test("dropping two files asks for one at a time", async ({ page }) => {
  await page.goto("/");
  await dropOnLibrary(page, [DROPPED_MD, { name: "second.md", body: "Second" }]);
  await expect(page.getByRole("alert")).toContainText("Drop one file at a time.");
  await expect(page.getByRole("dialog", { name: "Import writing" })).toHaveCount(0);
});

test("a dropped Markdown file over 5 MB is refused by the existing import limit", async ({ page }) => {
  await page.goto("/");
  await dropOnLibrary(page, [{ name: "big.md", size: 5 * 1024 * 1024 + 1, type: "text/markdown" }]);
  await expect(page.getByRole("alert")).toContainText("Manuscripts must be 5 MB or smaller.");
  await expect(page.getByRole("dialog", { name: "Import writing" })).toHaveCount(0);
});

test("a drop while the new-project name dialog is open opens nothing", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Start new project" }).click();
  await page.getByRole("button", { name: "Blank", exact: true }).click();
  await expect(page.getByLabel("Project title")).toBeVisible();
  await dropOnLibrary(page, [DROPPED_MD]);
  await expect(page.locator(".library .drop-target")).not.toHaveAttribute("data-state");
  await page.waitForTimeout(500);
  await expect(page.getByRole("dialog", { name: "Import writing" })).toHaveCount(0);
  await expect(page.getByRole("alert")).toHaveCount(0);
});

test("the Projects toolbar stays put as projects are added (no vertical re-centring)", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");
  await createProject(page, "Alpha draft");
  await expect(page.locator(".project-row")).toHaveCount(1);
  const toolbar = page.locator(".library-toolbar");
  const yOne = (await toolbar.boundingBox())!.y;
  await createProject(page, "Beta notes");
  await createProject(page, "Gamma");
  await expect(page.locator(".project-row")).toHaveCount(3);
  const yThree = (await toolbar.boundingBox())!.y;
  expect(Math.abs(yThree - yOne)).toBeLessThanOrEqual(1);
});

test("a project saved from the hidden Story template still opens", async ({ page }) => {
  await page.goto("/");
  await createProject(page, "Old story");
  // Pretend this project came from the Story template, which both menus hide.
  await page.evaluate(() => {
    const key = Object.keys(localStorage).find((k) =>
      k.startsWith("folio.preview.project."),
    )!;
    const stored = JSON.parse(localStorage.getItem(key)!);
    localStorage.setItem(key, JSON.stringify({ ...stored, templateId: "story" }));
  });
  await page.reload();
  await page
    .locator(".project-row")
    .filter({ hasText: "Old story" })
    .getByRole("button")
    .first()
    .click();
  await expect(page.getByRole("textbox", { name: "Writing editor" })).toBeVisible();
  await expect(page.locator(".project-switch")).toHaveText("Old story");
});

test("the gear opens Settings from the Projects screen; Dark applies at once and survives a reload", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "light" });
  await page.goto("/");
  const gear = page.locator(".library-display > .library-settings");
  await expect(gear).toHaveAccessibleName("Settings");
  await gear.click();
  const dialog = page.getByRole("dialog", { name: "Settings" });
  await expect(dialog).toBeVisible();
  await expect(
    dialog.getByRole("group", { name: "Appearance" }),
  ).toBeVisible();
  // Sidebar and Goals are project settings, not global ones: they stay out.
  await expect(dialog.getByRole("heading", { name: "Sidebar" })).toHaveCount(0);
  await expect(dialog.getByRole("heading", { name: "Goals" })).toHaveCount(0);
  await expect(dialog.getByText("Show Read manuscript")).toHaveCount(0);
  await expect(dialog.getByText("Total word goal")).toHaveCount(0);
  await dialog.getByRole("button", { name: "Dark", exact: true }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await dialog.getByRole("button", { name: "Close", exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await expect(gear).toBeFocused();
  // Escape closes it too.
  await gear.click();
  await expect(dialog).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
});
