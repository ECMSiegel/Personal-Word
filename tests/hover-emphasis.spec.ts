// UI wave 4 H1: hover inventory crawler (scaffold). Asserts nothing about emphasis yet: it visits
// the screens, lists every visible control, samples its computed hover weight/transform/colour on
// the untouched tree and writes the table. H2-H4 add the real assertions on top of crawlControls.
import { expect, test, type Locator, type Page } from "@playwright/test";
import { writeFileSync, mkdirSync } from "node:fs";
import { crawlControls, focusSample, hoverSample, type Control, type HoverSample } from "./hover-helpers";

const OUT = process.env.HOVER_OUT ?? "node_modules/.cache/personal-word-beta/ui4-h1";
const pdfBytes = Buffer.from("%PDF-1.4\n1 0 obj << /Type /Catalog >> endobj\n%%EOF\n", "ascii");

type Row = Control & { hover: HoverSample | null; sampled: boolean; focus?: HoverSample | null };
const rows: Row[] = [];
const skipped: string[] = [];
const seen = new Set<string>();
const byShape = new Map<string, HoverSample | null>();
const focusByShape = new Map<string, HoverSample | null>();

async function record(page: Page, screen: string) {
  await page.mouse.move(2, 2);
  const controls = await crawlControls(page, screen);
  for (const c of controls) {
    const key = screen.replace(/ \(popup \d+\)$/, "") + "|" + c.selector + "|" + c.text;
    if (seen.has(key)) continue;
    seen.add(key);
    // computed hover style is class-driven, so one hover per distinct selector shape is enough
    const gk = c.selector + "|" + c.kind;
    let hover = byShape.get(gk);
    const fresh = hover === undefined;
    if (hover === undefined) {
      hover = await hoverSample(page, c.id, 220);
      byShape.set(gk, hover);
    }
    let focus: HoverSample | null | undefined;
    if (fresh) {
      focus = await focusSample(page, c.id);
      focusByShape.set(gk, focus);
    }
    rows.push({ ...c, hover, sampled: fresh, focus });
  }
  await page.mouse.move(2, 2);
}

// Every crawl step is bounded (60 s) and every action inside it times out after 8 s (set below), so a
// stale selector shows up as a named skipped step instead of a 20-minute hang.
async function step(name: string, fn: () => Promise<void>) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([
      fn(),
      new Promise<never>((_, rej) => {
        timer = setTimeout(() => rej(new Error(`step "${name}" exceeded 60 s`)), 60_000);
      }),
    ]);
  } catch (e) {
    skipped.push(`${name}: ${String((e as Error).message).split("\n")[0]}`);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/** Close the open dialog: Escape, then its Cancel button if Escape was not enough, and wait until it is gone. */
async function closeDialog(page: Page) {
  await page.keyboard.press("Escape");
  const dlg = page.getByRole("dialog");
  if (await dlg.count()) {
    const cancel = dlg.getByRole("button", { name: "Cancel", exact: true });
    if (await cancel.count()) await cancel.click({ timeout: 3000 });
  }
  await expect(dlg).toHaveCount(0, { timeout: 5000 });
}

async function createProject(page: Page, title: string) {
  await page.getByRole("button", { name: "Start new project" }).click();
  await page.getByRole("button", { name: "Blank", exact: true }).click();
  await page.getByLabel("Project title").fill(title);
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByRole("textbox", { name: "Writing editor", exact: true })).toBeVisible();
}
const group = (page: Page, name: string) =>
  page.locator(".group-title").filter({ hasText: new RegExp("^" + name) });

/** Open each menu/dropdown trigger inside `scope` one at a time, crawl it, then close it. */
async function crawlPopups(page: Page, scope: string, screen: string) {
  const n = await page.locator(`${scope} [aria-haspopup], ${scope} [aria-expanded="false"]`).count();
  for (let i = 0; i < Math.min(n, 14); i++) {
    await step(`${screen} popup ${i}`, async () => {
      const t = page.locator(`${scope} [aria-haspopup], ${scope} [aria-expanded="false"]`).nth(i);
      if (!(await t.isVisible())) return;
      await t.click({ timeout: 5000 });
      await page.waitForTimeout(250);
      await record(page, `${screen} (popup ${i})`);
      await page.keyboard.press("Escape");
      await page.mouse.click(700, 5);
      await page.waitForTimeout(150);
    });
  }
}

test("hover inventory: crawl controls across screens", async ({ page }) => {
  test.setTimeout(1_200_000);
  page.setDefaultTimeout(8000);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.addInitScript(() => localStorage.setItem("personal-word.restoreTabs", "true"));
  await page.goto("/");

  // 1. Projects screen (empty library), create menu, sort
  await record(page, "Projects (empty)");
  await step("projects popups", () => crawlPopups(page, "body", "Projects"));

  await createProject(page, "Hover inventory");
  // 2. Writing screen
  await record(page, "Writing");
  await step("writing popups", () => crawlPopups(page, ".format-bar, .topbar, .sidebar", "Writing"));
  await step("sections", async () => {
    for (const t of ["One", "Two"]) {
      await page.getByRole("button", { name: "New section", exact: true }).click();
      await page.getByLabel("Title", { exact: true }).fill(t);
      await page.getByRole("button", { name: "Save", exact: true }).click();
    }
    await record(page, "Writing (sections in sidebar)");
  });
  await step("page view", async () => {
    await page.getByRole("button", { name: "Page view" }).first().click({ timeout: 5000 });
    await record(page, "Writing (page view)");
    await page.getByRole("button", { name: "Page view" }).first().click({ timeout: 5000 }); // back to continuous
  });
  await step("page setup", async () => {
    await page.getByRole("button", { name: /Page setup/ }).first().click({ timeout: 5000 });
    await expect(page.getByRole("dialog")).toBeVisible({ timeout: 5000 });
    await record(page, "Dialog: Page setup");
    await page.keyboard.press("Escape");
  });
  await step("snapshot dialog", async () => {
    await page.locator(".snapshot-button").click({ timeout: 5000 });
    await expect(page.getByRole("dialog")).toBeVisible({ timeout: 5000 });
    await record(page, "Dialog: Snapshot name");
    await closeDialog(page);
  });

  // 3. Fragments
  await step("fragments", async () => {
    const editor = page.getByRole("textbox", { name: "Writing editor", exact: true });
    await editor.fill("Some words to keep");
    await editor.press("ControlOrMeta+a");
    await page.getByRole("button", { name: "Keep as fragment" }).click({ timeout: 5000 });
    await group(page, "Fragments").click();
    await expect(page.locator(".fragment-library")).toBeVisible();
    await record(page, "Fragments panel");
  });

  // 4. Research with a source, note, quote and PDF
  await step("research", async () => {
    await group(page, "Research").click();
    await expect(page.locator(".research-panel")).toBeVisible();
    await record(page, "Research (empty)");
    await page.getByRole("button", { name: "Enter manually" }).click();
    await page.getByLabel("Title", { exact: true }).fill("Hover source");
    await page.getByLabel("Authors", { exact: true }).fill("Ada Example");
    await page.getByLabel("Year", { exact: true }).fill("2026");
    const source = page.locator(".source-item").filter({ hasText: "Hover source" });
    await source.locator('.source-pdf-field input[type="file"]').setInputFiles({ name: "s.pdf", mimeType: "application/pdf", buffer: pdfBytes });
    await page.waitForTimeout(300);
    await record(page, "Research (source with PDF)");
    await step("research popups", () => crawlPopups(page, ".research-panel", "Research"));
  });
  await step("research note", async () => {
    for (const tab of ["Notes", "Quotes"]) {
      const b = page.locator(".research-tabs button", { hasText: new RegExp("^" + tab) });
      if (await b.count()) {
        await b.first().click();
        const add = page.getByRole("button", { name: /^(Add|New) (note|quote)/i }).first();
        if (await add.count()) await add.click({ timeout: 5000 });
        await record(page, `Research (${tab})`);
      }
    }
  });

  // 5. Comments, History, Read
  for (const [g, label] of [["Comments", "Comments"], ["Snapshots", "History"], ["Read", "Read manuscript"]] as const) {
    await step(label, async () => {
      await group(page, g).click({ timeout: 6000 });
      await page.waitForTimeout(300);
      await record(page, label);
    });
  }

  // 6. Settings (General, Shortcuts, Templates are sections of the same page)
  await step("settings", async () => {
    await group(page, "Settings").click();
    await page.waitForTimeout(300);
    await record(page, "Settings");
    
  });
  await step("shortcuts settings", async () => {
    await page.getByRole("button", { name: "Settings", exact: true }).click({ timeout: 5000 });
    await record(page, "Settings: Shortcuts region");
  });

  // 7. Split view
  await step("split", async () => {
    await group(page, "Manuscript").click();
    const entries = page.locator(".sidebar .entry-main");
    await entries.first().click();
    await entries.nth(1).click({ modifiers: ["ControlOrMeta"] });
    await expect(page.locator(".split-pane")).toHaveCount(2);
    await record(page, "Split view");
  });

  // 8. Projects screen with a project in the library
  await step("projects library", async () => {
    await page.getByRole("button", { name: /Projects/ }).first().click({ timeout: 5000 });
    await record(page, "Projects (with a project)");
    await step("library popups", () => crawlPopups(page, "body", "Projects(lib)"));
  });

  // Output
  const screens = [...new Set(rows.map((r) => r.screen.replace(/ \(popup \d+\)$/, "")))];
  const f = (r: Row) =>
    `| ${r.screen} | \`${r.selector.replace(/\|/g, "/")}\` | ${r.text.replace(/\|/g, "/") || "(none)"} | ${r.kind} | ${r.rest.weight} | ${r.rest.transform} | ${r.hover ? `${r.hover.weight} / ${r.hover.transform} / ${r.hover.duration}` : "n/a"} |`;
  const table = [
    "| screen | selector | label | kind | rest weight | rest transform | hover weight / transform / duration |",
    "|---|---|---|---|---|---|---|",
    ...rows.map(f),
  ].join("\n");
  mkdirSync(OUT, { recursive: true });
  writeFileSync(`${OUT}/crawl-table.md`, table + "\n");
  writeFileSync(`${OUT}/crawl-skipped.txt`, skipped.join("\n") + "\n");
  console.log(`H1 inventory: ${rows.length} controls (${rows.filter((r) => r.kind === "text").length} text) over ${screens.length} screens`);
  console.log(screens.join("\n"));
  console.log("not crawled / skipped:\n" + skipped.join("\n"));
  // UI wave 4 H3: every crawled text control carries the shared emphasis; icon-only controls do not scale.
  // Icon-list controls that print a glyph (the sort-direction arrow) are text by the crawler's rule only.
  const ICON_LIST = /library-display > button|group-chevron/;
  const scaleOf = (t: string) => Number(/matrix\(([^,]+)/.exec(t)?.[1] ?? 1);
  const failures: string[] = [];
  // Controls whose hover could not be sampled (off-screen, covered, moved) are listed, not skipped
  // silently; a handful is tolerated, more means the crawl no longer covers the app.
  const MAX_UNHOVERABLE = 12;
  const unhoverable = rows.filter((r) => !r.hover && !r.disabled).map((r) => `${r.screen} | ${r.selector} | ${r.text}`);
  console.log(`H3 un-hoverable controls: ${unhoverable.length}\n${unhoverable.join("\n")}`);
  for (const r of rows) {
    if (!r.hover || r.disabled) continue;
    const id = `${r.screen} | ${r.selector} | ${r.text}`;
    if (r.kind === "text" && !ICON_LIST.test(r.selector)) {
      if (r.sampled && r.hover.weight !== r.rest.weight) failures.push(`hover changes weight ${r.rest.weight}->${r.hover.weight}: ${id}`);
      if (!(r.hover.stroke > 0.2)) failures.push(`no stroke: ${id}`);
      else if (r.hover.strokeColor !== r.hover.color) failures.push(`stroke colour != text colour: ${id}`);
      if (Math.abs(scaleOf(r.hover.transform) - 1.04) > 0.002) failures.push(`no 1.04 scale (${r.hover.transform}): ${id}`);
    } else if (r.kind === "icon") {
      if (r.hover.stroke > 0) failures.push(`icon-only control has a stroke: ${id}`);
      if (Math.abs(scaleOf(r.hover.transform) - 1.04) < 0.002) failures.push(`icon-only control scales: ${id}`);
    }
  }
  // UI wave 4 H4: keyboard focus gets exactly the hover treatment, with the same transition duration.
  for (const r of rows) {
    if (!r.sampled || !r.hover || r.disabled || !r.focus) continue;
    const id = `${r.screen} | ${r.selector} | ${r.text}`;
    if (r.kind === "text" && !ICON_LIST.test(r.selector)) {
      if (!(r.focus.stroke > 0.2)) failures.push(`focus: no stroke: ${id}`);
      if (Math.abs(r.focus.stroke - r.hover.stroke) > 0.01) failures.push(`focus stroke differs from hover: ${id}`);
      if (Math.abs(scaleOf(r.focus.transform) - 1.04) > 0.002) failures.push(`focus: no 1.04 scale: ${id}`);
      if (r.focus.duration !== r.hover.duration) failures.push(`focus duration ${r.focus.duration} != hover ${r.hover.duration}: ${id}`);
    } else if (r.kind === "icon") {
      if (r.focus.stroke > 0 || Math.abs(scaleOf(r.focus.transform) - 1.04) < 0.002) failures.push(`focus: icon-only control got emphasis: ${id}`);
    }
  }
  console.log(`H3 exceptions: ${failures.length}\n${failures.slice(0, 40).join("\n")}`);
  expect(failures, "emphasis exceptions").toEqual([]);
  expect(skipped, "crawl steps skipped").toEqual([]);
  expect(unhoverable.length, `un-hoverable controls (cap ${MAX_UNHOVERABLE}):\n${unhoverable.join("\n")}`).toBeLessThanOrEqual(MAX_UNHOVERABLE);
  expect(rows.length, "inventory printed").toBeGreaterThanOrEqual(60);
  expect(screens.length).toBeGreaterThanOrEqual(8);
});

// UI wave 4 H2: the one emphasis rule (owner: no-shift faux bold). Each named control must get a text
// stroke and a 1.04 scale on hover (after 250 ms), keep its layout width, and move no neighbour.
const CROPS = process.env.HOVER_CROPS ?? "node_modules/.cache/personal-word-beta/ui4-h2/crops";
async function assertEmphasis(page: Page, loc: Locator, label: string, crop = false) {
  const el = loc.first();
  await el.scrollIntoViewIfNeeded();
  await page.mouse.move(720, 892);
  await page.waitForTimeout(200);
  const siblings = async () =>
    el.evaluate((n) =>
      [...(n.parentElement?.children ?? [])].filter((c) => c !== n).map((c) => c.getBoundingClientRect().left),
    );
  const own = () =>
    el.evaluate((n) => {
      const r = (n as HTMLElement).getBoundingClientRect();
      return { left: (n as HTMLElement).offsetLeft, w: (n as HTMLElement).offsetWidth, top: (n as HTMLElement).offsetTop };
    });
  const before = await siblings();
  const o0 = await own();
  await el.hover({ timeout: 8000 });
  await page.waitForTimeout(250);
  const got = await el.evaluate((n) => {
    const cs = getComputedStyle(n);
    const m = /matrix\(([^)]+)\)/.exec(cs.transform);
    const v = m ? m[1].split(",").map(Number) : [1, 0, 0, 1, 0, 0];
    return { weight: cs.fontWeight, stroke: parseFloat(cs.webkitTextStrokeWidth), strokeColor: cs.webkitTextStrokeColor, color: cs.color, a: v[0], d: v[3] };
  });
  const after = await siblings();
  const o1 = await own();
  console.log(`H2 ${label}: stroke ${got.stroke}px scale ${got.a} width ${o0.w}->${o1.w} neighbour shifts ${before.map((x, i) => after[i] - x).join(",")}`);
  expect(got.stroke, `${label} stroke`).toBeGreaterThan(0.2);
  expect(got.strokeColor, `${label} stroke colour is currentColor`).toBe(got.color);
  expect(Math.abs(got.a - 1.04), `${label} scale x ${got.a}`).toBeLessThan(0.002);
  expect(Math.abs(got.d - 1.04), `${label} scale y ${got.d}`).toBeLessThan(0.002);
  expect(o1.w, `${label} layout width`).toBe(o0.w);
  expect(o1.left, `${label} layout left`).toBe(o0.left);
  before.forEach((x, i) => expect(Math.abs(after[i] - x), `${label} neighbour ${i} moved`).toBeLessThan(0.01));
  if (crop) {
    mkdirSync(CROPS, { recursive: true });
    const slug = label.replace(/\W+/g, "-");
    const box = (await el.boundingBox())!;
    const clip = { x: box.x - 8, y: box.y - 6, width: box.width + 20, height: box.height + 12 };
    await page.screenshot({ path: `${CROPS}/${slug}-stroke.png`, clip });
    // reference: the same control at a true weight 600, no stroke, no scale
    const h = await el.elementHandle();
    await h!.evaluate((n) => {
      (n as HTMLElement).style.setProperty("-webkit-text-stroke", "0", "important");
      (n as HTMLElement).style.setProperty("font-weight", "600", "important");
      (n as HTMLElement).style.setProperty("transition", "none", "important");
    });
    await page.screenshot({ path: `${CROPS}/${slug}-true600.png`, clip });
    await h!.evaluate((n) => {
      (n as HTMLElement).style.removeProperty("-webkit-text-stroke");
      (n as HTMLElement).style.removeProperty("font-weight");
      (n as HTMLElement).style.removeProperty("transition");
    });
  }
  await page.mouse.move(720, 892);
}

test("H2 emphasis: no-shift faux bold and scale 1.04 on hover", async ({ page }) => {
  test.setTimeout(300_000);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");
  await page.getByRole("button", { name: "Start new project" }).click();
  await assertEmphasis(page, page.locator(".popover-item").first(), "create menu row");
  await page.getByRole("button", { name: "Blank", exact: true }).click();
  await page.getByLabel("Project title").fill("Emphasis");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByRole("textbox", { name: "Writing editor", exact: true })).toBeVisible();
  await assertEmphasis(page, page.locator(".snapshot-button"), "Snapshot", true);
  await expect(page.locator(".snapshot-button")).toHaveCSS("border-top-width", "0px");
  await assertEmphasis(page, page.locator(".tabs-library"), "Projects tab");
  await assertEmphasis(page, page.locator(".sidebar .entry-main").first(), "sidebar entry");
  const editor = page.getByRole("textbox", { name: "Writing editor", exact: true });
  await editor.fill("Some words to keep");
  await editor.press("ControlOrMeta+a");
  await page.getByRole("button", { name: "Keep as fragment" }).click();
  await group(page, "Fragments").click();
  await expect(page.locator(".fragment-library")).toBeVisible();
  await assertEmphasis(page, page.locator(".fragment-link").last(), "Append to section", true);
  await group(page, "Research").click();
  await page.locator(".research-tabs button", { hasText: /^Notes/ }).first().click();
  await page.getByRole("button", { name: /^Add note/i }).first().click();
  await assertEmphasis(page, page.getByRole("button", { name: "Delete note" }), "Delete note");
  await group(page, "Settings").click();
  await assertEmphasis(page, page.locator(".settings-button").first(), "settings button");
  await assertEmphasis(page, page.locator("label.settings-check").first(), "settings checkbox label");

  // A label around a text/number input is not emphasised: scaling it would grow the input box.
  const numberLabel = page.locator("label.settings-field:has(input[type=number])").first();
  await numberLabel.scrollIntoViewIfNeeded();
  await numberLabel.hover();
  await page.waitForTimeout(250);
  const nl = await numberLabel.evaluate((n) => new DOMMatrix(getComputedStyle(n).transform).a);
  expect(nl, "number-input label does not scale").toBeCloseTo(1, 3);

  // A checkbox label gets the same treatment from the keyboard (focus-visible on its input).
  await page.mouse.move(720, 892);
  const box = page.locator("label.settings-check input[type=checkbox]").first();
  await page.keyboard.press("Tab"); // a key press first, so the programmatic focus below is :focus-visible
  await box.focus();
  await expect(box).toBeFocused();
  await page.waitForTimeout(250);
  const kb = await box.locator("xpath=..").evaluate((n) => {
    const cs = getComputedStyle(n);
    return { stroke: parseFloat(cs.webkitTextStrokeWidth), a: new DOMMatrix(cs.transform).a };
  });
  expect(kb.stroke, "checkbox label stroke on keyboard focus").toBeGreaterThan(0.2);
  expect(kb.a, "checkbox label scale on keyboard focus").toBeCloseTo(1.04, 2);
});

// UI wave 4 review finding 1: the interface emphasis must never reach the user's document.
test("H5 emphasis never touches links inside the document (editor and Read view)", async ({ page }) => {
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");
  await page.getByRole("button", { name: "Start new project" }).click();
  await page.getByRole("button", { name: "Blank", exact: true }).click();
  await page.getByLabel("Project title").fill("Emphasis links");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  const editor = page.getByRole("textbox", { name: "Writing editor", exact: true });
  await expect(editor).toBeVisible();
  await editor.click();
  await editor.evaluate((el) => {
    const dt = new DataTransfer();
    dt.setData("text/html", '<p>See <a href="https://example.com/">linked words</a> here</p>');
    dt.setData("text/plain", "See linked words here");
    el.dispatchEvent(new ClipboardEvent("paste", { clipboardData: dt, bubbles: true, cancelable: true }));
  });
  const probe = async (loc: Locator) => {
    await page.mouse.move(720, 892);
    await page.waitForTimeout(200);
    await loc.hover();
    await page.waitForTimeout(250);
    return loc.evaluate((n) => {
      const cs = getComputedStyle(n);
      return { stroke: parseFloat(cs.webkitTextStrokeWidth), a: new DOMMatrix(cs.transform).a, tp: cs.transitionProperty };
    });
  };
  const inEditor = page.locator(".ProseMirror a").first();
  await expect(inEditor).toBeVisible();
  const e = await probe(inEditor);
  expect(e.stroke, "editor link stroke").toBe(0);
  expect(e.a, "editor link scale").toBe(1);
  await group(page, "Read").click();
  const inRead = page.locator(".manuscript-read a").first();
  await expect(inRead).toBeVisible();
  const r = await probe(inRead);
  expect(r.stroke, "Read link stroke").toBe(0);
  expect(r.a, "Read link scale").toBe(1);
});

// UI wave 4 H4: Reduce Motion keeps the stroke but drops the scale and every transition; danger stays red;
// a brand-new text button gets the treatment with no new CSS (drift probe).
test("H4 emphasis: Reduce Motion, danger colour and the drift probe", async ({ page }) => {
  test.setTimeout(300_000);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");
  await page.getByRole("button", { name: "Start new project" }).click();
  await page.getByRole("button", { name: "Blank", exact: true }).click();
  await page.getByLabel("Project title").fill("Emphasis H4");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByRole("textbox", { name: "Writing editor", exact: true })).toBeVisible();

  // dialog footer buttons (Snapshot name dialog): Cancel and Save get the full treatment
  await page.locator(".snapshot-button").click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.waitForTimeout(600);
  await assertEmphasis(page, page.locator(".dialog-actions button").first(), "dialog Cancel");
  await page.getByLabel("Snapshot name").fill("H4 snapshot"); // Save is disabled while the name is empty
  await assertEmphasis(page, page.locator(".dialog-actions button.primary"), "dialog Save");
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);

  // drift probe: a button nobody styled
  const probe = await page.evaluate(async () => {
    const b = document.createElement("button");
    b.id = "drift-probe";
    b.textContent = "Drift probe";
    b.style.cssText = "position:fixed;left:300px;top:300px;z-index:9999";
    document.body.appendChild(b);
    return true;
  });
  expect(probe).toBe(true);
  await page.locator("#drift-probe").hover();
  await page.waitForTimeout(250);
  const drift = await page.locator("#drift-probe").evaluate((n) => {
    const cs = getComputedStyle(n);
    return { stroke: parseFloat(cs.webkitTextStrokeWidth), a: new DOMMatrix(cs.transform).a, weight: cs.fontWeight };
  });
  expect(drift.stroke).toBeGreaterThan(0.2);
  expect(drift.a).toBeCloseTo(1.04, 2);
  // pressed text buttons use --duration-press, not the hover duration
  await page.mouse.down();
  await page.waitForTimeout(150);
  const pressed = await page.locator("#drift-probe").evaluate((n) => getComputedStyle(n).transitionDuration);
  await page.mouse.up();
  expect(pressed, "pressed text button uses --duration-press (80ms)").toBe("0.08s");
  await page.evaluate(() => document.getElementById("drift-probe")?.remove());

  // danger stays red: a danger control's hover colour is its rest colour
  await group(page, "Research").click();
  await page.locator(".research-tabs button", { hasText: /^Notes/ }).first().click();
  await page.getByRole("button", { name: /^Add note/i }).first().click();
  const del = page.getByRole("button", { name: "Delete note" });
  await page.mouse.move(720, 892);
  await page.waitForTimeout(200);
  const rest = await del.evaluate((n) => getComputedStyle(n).color);
  await del.hover();
  await page.waitForTimeout(250);
  const hov = await del.evaluate((n) => getComputedStyle(n).color);
  expect(hov).toBe(rest);
  const [r, g, b] = hov.match(/\d+/g)!.map(Number);
  expect(r, `danger colour ${hov}`).toBeGreaterThan(g + 40);

  // Reduce Motion
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.mouse.move(720, 892);
  await page.waitForTimeout(200);
  await del.hover();
  await page.waitForTimeout(250);
  const rm = await del.evaluate((n) => {
    const cs = getComputedStyle(n);
    return { stroke: parseFloat(cs.webkitTextStrokeWidth), a: new DOMMatrix(cs.transform).a, duration: cs.transitionDuration };
  });
  expect(rm.stroke, "stroke kept under Reduce Motion").toBeGreaterThan(0.2);
  expect(rm.a, "scale dropped under Reduce Motion").toBeCloseTo(1, 3);
  expect(rm.duration).toBe("0s");
});
