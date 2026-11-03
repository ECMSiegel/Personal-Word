import { test, expect, type Page } from "@playwright/test";

// Sidebar groups, sections, fragments, research sources and notes reorder by
// pointer drag (useDragReorder); Option+Up/Down on the focused row or group
// heading is the keyboard way (wave 5 A2: the arrow buttons are gone).

const SHOTS = process.env.N4_SHOTS;

async function createProject(page: Page, title: string) {
  await page.addInitScript(() => localStorage.setItem("personal-word.restoreTabs", "true"));
  await page.goto("/");
  await page.getByRole("button", { name: "Start new project" }).click();
  await page.getByRole("button", { name: "Blank", exact: true }).click();
  await page.getByLabel("Project title").fill(title);
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByRole("textbox", { name: "Writing editor" })).toBeVisible();
}

async function addSection(page: Page, title: string) {
  await page.getByRole("button", { name: "New section", exact: true }).click();
  await page.getByLabel("Title", { exact: true }).fill(title);
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.locator(".entry-main").filter({ hasText: title })).toBeVisible();
}

const heading = (page: Page, group: string) => page.locator(`.sidebar-groups [data-group="${group}"] .group-title`);
const groupNames = (page: Page) =>
  page.locator(".sidebar-groups > .sidebar-group").evaluateAll((els) => els.map((el) => el.getAttribute("data-group")));
const entryTitles = (page: Page) =>
  page.locator('[data-group="manuscript"] .entry-row .entry-main > span').allTextContents();

/** Mouse down on `from`'s centre, then travel to `toY`; leaves the button down. */
async function pickUp(page: Page, from: ReturnType<Page["locator"]>, toY: (box: { y: number; height: number }) => number) {
  const box = (await from.boundingBox())!;
  const x = box.x + box.width / 2;
  await page.mouse.move(x, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(x, box.y + box.height / 2 + (toY(box) > box.y ? 8 : -8), { steps: 3 });
  await page.mouse.move(x, toY(box), { steps: 8 });
}

test("dragging Fragments above Manuscript reorders the groups and the order survives a reload", async ({ page }) => {
  await createProject(page, "Group drag fixture");
  expect(await groupNames(page)).toEqual(["manuscript", "fragments", "research"]);
  const manuscript = (await heading(page, "manuscript").boundingBox())!;
  await pickUp(page, heading(page, "fragments"), () => manuscript.y + 2);

  // Mid-drag: the lifted group follows the pointer, the landing slot shows a 2 px accent line, no shadow.
  const lifted = page.locator('.sidebar-groups > [data-drag-state="lifted"]');
  await expect(lifted).toHaveAttribute("data-group", "fragments");
  const line = page.locator("[data-drag-edge]");
  await expect(line).toHaveCount(1);
  const look = await line.evaluate((el) => {
    const after = getComputedStyle(el, "::after");
    return { height: after.height, color: after.backgroundColor, shadow: after.boxShadow };
  });
  const accent = await page.evaluate(() => {
    const probe = document.createElement("span");
    probe.style.color = "var(--accent)";
    document.body.append(probe);
    const c = getComputedStyle(probe).color;
    probe.remove();
    return c;
  });
  expect(look).toEqual({ height: "2px", color: accent, shadow: "none" });
  expect(await lifted.evaluate((el) => getComputedStyle(el).boxShadow)).toBe("none");
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/group-drag-${process.env.N4_SCHEME ?? "light"}.png` });

  await page.mouse.up();
  await expect(page.locator("[data-drag-state]")).toHaveCount(0);
  expect(await groupNames(page)).toEqual(["fragments", "manuscript", "research"]);
  await expect(page.locator(".save-status")).toHaveText("Saved", { timeout: 10_000 });
  await page.reload();
  await expect(page.getByRole("textbox", { name: "Writing editor" })).toBeVisible();
  expect(await groupNames(page)).toEqual(["fragments", "manuscript", "research"]);
});

test("dragging an entry below its sibling reorders the manuscript and persists", async ({ page }) => {
  await createProject(page, "Entry drag fixture");
  await addSection(page, "Second section");
  const first = await entryTitles(page);
  expect(first).toHaveLength(2);
  const rows = page.locator('[data-group="manuscript"] .entry-row');
  const last = (await rows.nth(1).boundingBox())!;
  await pickUp(page, rows.nth(0), () => last.y + last.height - 2);
  await expect(page.locator('.entry-row[data-drag-state="lifted"]')).toHaveCount(1);
  await expect(page.locator(".entry-row[data-drag-edge]")).toHaveCount(1);
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/entry-drag-${process.env.N4_SCHEME ?? "light"}.png` });
  await page.mouse.up();
  expect(await entryTitles(page)).toEqual([first[1], first[0]]);
  await expect(page.locator(".save-status")).toHaveText("Saved", { timeout: 10_000 });
  await page.reload();
  await expect(page.getByRole("textbox", { name: "Writing editor" })).toBeVisible();
  expect(await entryTitles(page)).toEqual([first[1], first[0]]);
});

test("a drag that ends on its own slot, or is cancelled with Escape, changes nothing", async ({ page }) => {
  await createProject(page, "Cancel fixture");
  await addSection(page, "Second section");
  const before = await entryTitles(page);
  const rows = page.locator('[data-group="manuscript"] .entry-row');
  const last = (await rows.nth(1).boundingBox())!;
  await pickUp(page, rows.nth(0), () => last.y + last.height - 2);
  await page.keyboard.press("Escape");
  await page.mouse.up();
  await expect(page.locator("[data-drag-state]")).toHaveCount(0);
  expect(await entryTitles(page)).toEqual(before);
});

test("a press that barely moves is still a click", async ({ page }) => {
  await createProject(page, "Click fixture");
  await addSection(page, "Second section");
  const row = page.locator('[data-group="manuscript"] .entry-row').nth(0);
  const box = (await row.boundingBox())!;
  await page.mouse.move(box.x + 40, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + 42, box.y + box.height / 2 + 2);
  await page.mouse.up();
  await expect(row).toHaveClass(/selected/);
});

test("Option+Up/Down reorders groups and sections from the keyboard", async ({ page }) => {
  await createProject(page, "Chord fixture");
  await addSection(page, "Second section");
  const before = await entryTitles(page);
  await page.locator('[data-group="manuscript"] .entry-main').filter({ hasText: before[0] }).focus();
  await page.keyboard.press("Alt+ArrowDown");
  expect(await entryTitles(page)).toEqual([before[1], before[0]]);
  await heading(page, "manuscript").focus();
  await page.keyboard.press("Alt+ArrowDown");
  expect(await groupNames(page)).toEqual(["fragments", "manuscript", "research"]);
});

test("under reduced motion, rows that step aside do not animate", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await createProject(page, "Reduced motion fixture");
  await addSection(page, "Second section");
  const rows = page.locator('[data-group="manuscript"] .entry-row');
  const last = (await rows.nth(1).boundingBox())!;
  await pickUp(page, rows.nth(0), () => last.y + last.height - 2);
  const shifted = page.locator('.entry-row[data-drag-state="shifted"]');
  await expect(shifted).toHaveCount(1);
  expect(await shifted.evaluate((el) => getComputedStyle(el).transitionDuration)).toBe("0s");
  await page.mouse.up();
});

test("without reduced motion, the shifted row animates transform only", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await createProject(page, "Motion fixture");
  await addSection(page, "Second section");
  const rows = page.locator('[data-group="manuscript"] .entry-row');
  const last = (await rows.nth(1).boundingBox())!;
  await pickUp(page, rows.nth(0), () => last.y + last.height - 2);
  const shifted = page.locator('.entry-row[data-drag-state="shifted"]');
  await expect(shifted).toHaveCount(1);
  expect(await shifted.evaluate((el) => getComputedStyle(el).transitionProperty)).toBe("transform");
  await page.mouse.up();
});

test("a press released outside the row does not leave the row armed", async ({ page }) => {
  await createProject(page, "Stray release fixture");
  await addSection(page, "Second section");
  const before = await entryTitles(page);
  const row = page.locator('[data-group="manuscript"] .entry-row').nth(0);
  const box = (await row.boundingBox())!;
  const editor = (await page.getByRole("textbox", { name: "Writing editor" }).boundingBox())!;
  const y = box.y + 6;
  await page.mouse.move(box.x + 40, y);
  await page.mouse.down();
  await page.mouse.move(editor.x + editor.width / 2, y, { steps: 6 });
  await page.mouse.up();
  // Button is up: crossing the row lower down must not lift it.
  await page.mouse.move(box.x + 40, box.y + box.height - 4, { steps: 6 });
  await page.mouse.move(box.x + 44, box.y + box.height - 2, { steps: 3 });
  await expect(page.locator("[data-drag-state]")).toHaveCount(0);
  await page.mouse.click(box.x + 40, box.y + box.height - 2);
  expect(await entryTitles(page)).toEqual(before);
});

// ---- Wave 5 A2 (docs/agent-work/2026-11-01-ui-wave-5/PLAN.md): no arrows,
// drag for fragments, sources and notes, Option+Up/Down with an announcement.

const pdfBytes = Buffer.from("%PDF-1.4\n1 0 obj << /Type /Catalog >> endobj\n%%EOF\n", "ascii");

const rowTitles = (page: Page, group: string) =>
  page.locator(`[data-group="${group}"] .entry-row .entry-main > span`).allTextContents();
const mainRow = (page: Page, group: string, text: string) =>
  page.locator(`[data-group="${group}"] .entry-main`).filter({ hasText: text }).first();
const status = (page: Page) => page.locator('.sidebar [role="status"]');

async function addFragment(page: Page, title: string) {
  await page.locator('[data-group="fragments"] .group-heading').hover();
  await page.getByRole("button", { name: "New fragment", exact: true }).click();
  await page.getByLabel("Title", { exact: true }).fill(title);
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(mainRow(page, "fragments", title)).toBeVisible();
}

/** Two sources (the first with a PDF) and two notes, all made through the Research panel. */
async function seedResearch(page: Page) {
  await page.locator(".group-title").filter({ hasText: /^Research$/ }).click();
  await expect(page.locator(".research-panel")).toBeVisible();
  await page.getByLabel("Zotero CSL JSON file").setInputFiles({
    name: "sources.json",
    mimeType: "application/json",
    buffer: Buffer.from(
      JSON.stringify([
        { type: "book", title: "Alpha source", author: [{ given: "Ann", family: "Ames" }], issued: { "date-parts": [[2020]] } },
        { type: "book", title: "Beta source", author: [{ given: "Bo", family: "Barr" }], issued: { "date-parts": [[2021]] } },
      ]),
    ),
  });
  await page.getByRole("button", { name: "Add sources", exact: true }).click();
  const alpha = page.locator(".source-item").filter({ hasText: "Alpha source" });
  const toggle = alpha.locator(".source-toggle");
  if ((await toggle.getAttribute("aria-expanded")) !== "true") await toggle.click();
  await alpha.locator('.source-pdf-field input[type="file"]').setInputFiles({
    name: "alpha.pdf",
    mimeType: "application/pdf",
    buffer: pdfBytes,
  });
  await page.locator(".research-tabs").getByRole("button", { name: "Notes", exact: true }).click();
  for (const text of ["Note one", "Note two"]) {
    await page.getByRole("button", { name: "Add note", exact: true }).click();
    await page.locator(".note-item textarea").last().fill(text);
  }
  // Bibliography, Alpha, its PDF, Beta, Note one, Note two.
  await expect(page.locator('.sidebar [data-group="research"] .entry-row')).toHaveCount(6);
  await expect(page.locator(".save-status")).toHaveText("Saved", { timeout: 10_000 });
}

async function reloadAndWait(page: Page) {
  await expect(page.locator(".save-status")).toHaveText("Saved", { timeout: 10_000 });
  await page.reload();
  await expect(page.locator(".sidebar")).toBeVisible();
}

/** Drag `from` so its centre lands just inside the bottom of `onto`. */
async function dragBelow(page: Page, from: ReturnType<Page["locator"]>, onto: ReturnType<Page["locator"]>) {
  const target = (await onto.boundingBox())!;
  await pickUp(page, from, () => target.y + target.height - 2);
  await expect(page.locator("[data-drag-state=lifted]")).toHaveCount(1);
  await page.mouse.up();
  await expect(page.locator("[data-drag-state]")).toHaveCount(0);
}

test("the sidebar has no move arrow buttons anywhere", async ({ page }) => {
  await createProject(page, "No arrows");
  await addSection(page, "Second section");
  await addFragment(page, "Frag one");
  for (const group of ["manuscript", "fragments", "research"]) {
    await page.locator(`[data-group="${group}"] .group-heading`).hover();
    await expect(page.locator('.sidebar button[aria-label^="Move "]')).toHaveCount(0);
  }
  await page.locator('[data-group="manuscript"] .entry-row').first().hover();
  await expect(page.locator('.sidebar button[aria-label^="Move "]')).toHaveCount(0);
  // The view toggle and the add button stay.
  await page.locator('[data-group="manuscript"] .group-title').focus();
  await expect(page.getByRole("button", { name: "Show Manuscript cards" })).toBeVisible();
  await expect(page.getByRole("button", { name: "New section", exact: true })).toBeVisible();
});

test("dragging a fragment reorders the fragments and persists", async ({ page }) => {
  await createProject(page, "Fragment drag");
  await addFragment(page, "Frag one");
  await addFragment(page, "Frag two");
  expect(await rowTitles(page, "fragments")).toEqual(["Frag one", "Frag two"]);
  const rows = page.locator('[data-group="fragments"] .entry-row');
  await dragBelow(page, rows.nth(0), rows.nth(1));
  expect(await rowTitles(page, "fragments")).toEqual(["Frag two", "Frag one"]);
  await reloadAndWait(page);
  expect(await rowTitles(page, "fragments")).toEqual(["Frag two", "Frag one"]);
});

test("dragging a source carries its PDF row, dragging a note reorders notes, and both persist", async ({ page }) => {
  await createProject(page, "Research drag");
  await seedResearch(page);
  const before = await rowTitles(page, "research");
  expect(before[0]).toBe("Bibliography");
  expect(before[1]).toContain("Alpha source");
  expect(before[2]).toBe("alpha.pdf");
  expect(before[3]).toContain("Beta source");
  expect(before.slice(4)).toEqual(["Note one", "Note two"]);

  const units = page.locator('[data-group="research"] .entry-sublist[data-list="sources"] > .entry-unit');
  await expect(units).toHaveCount(2);
  if (SHOTS) {
    const target = (await units.nth(1).boundingBox())!;
    await pickUp(page, units.nth(0), () => target.y + target.height - 2);
    await page.screenshot({ path: `${SHOTS}/source-drag-${process.env.N4_SCHEME ?? "light"}.png` });
    await page.mouse.up();
  } else {
    await dragBelow(page, units.nth(0), units.nth(1));
  }
  const afterSources = await rowTitles(page, "research");
  expect(afterSources[1]).toContain("Beta source");
  expect(afterSources[2]).toContain("Alpha source");
  expect(afterSources[3]).toBe("alpha.pdf");

  const notes = page.locator('[data-group="research"] .entry-sublist[data-list="notes"] > .entry-row');
  await expect(notes).toHaveCount(2);
  await dragBelow(page, notes.nth(0), notes.nth(1));
  expect((await rowTitles(page, "research")).slice(4)).toEqual(["Note two", "Note one"]);

  // A drag never crosses sublists: Bibliography stays first, notes stay after sources.
  await reloadAndWait(page);
  const reloaded = await rowTitles(page, "research");
  expect(reloaded[0]).toBe("Bibliography");
  expect(reloaded[1]).toContain("Beta source");
  expect(reloaded[2]).toContain("Alpha source");
  expect(reloaded[3]).toBe("alpha.pdf");
  expect(reloaded.slice(4)).toEqual(["Note two", "Note one"]);
});

test("Option+Down moves a fragment, a source, a note, a section and a group; focus stays and the move is announced", async ({ page }) => {
  await createProject(page, "Chord everywhere");
  await addSection(page, "Second section");
  await addFragment(page, "Frag one");
  await addFragment(page, "Frag two");
  await seedResearch(page);

  // Fragment
  await mainRow(page, "fragments", "Frag one").focus();
  await page.keyboard.press("Alt+ArrowDown");
  expect(await rowTitles(page, "fragments")).toEqual(["Frag two", "Frag one"]);
  await expect(status(page)).toHaveText("Moved Frag one to position 2 of 2");
  await expect(mainRow(page, "fragments", "Frag one")).toBeFocused();
  await expect(page.locator("[data-drag-state]")).toHaveCount(0);
  await page.keyboard.press("Alt+ArrowDown");
  await expect(status(page)).toHaveText("Frag one is already last");
  expect(await rowTitles(page, "fragments")).toEqual(["Frag two", "Frag one"]);

  // Source (its PDF row follows)
  await mainRow(page, "research", "Alpha source").focus();
  await page.keyboard.press("Alt+ArrowDown");
  const research = await rowTitles(page, "research");
  expect(research[1]).toContain("Beta source");
  expect(research[2]).toContain("Alpha source");
  expect(research[3]).toBe("alpha.pdf");
  await expect(status(page)).toContainText("to position 2 of 2");
  await expect(mainRow(page, "research", "Alpha source")).toBeFocused();

  // Note
  await mainRow(page, "research", "Note one").focus();
  await page.keyboard.press("Alt+ArrowDown");
  expect((await rowTitles(page, "research")).slice(4)).toEqual(["Note two", "Note one"]);
  await expect(status(page)).toHaveText("Moved Note one to position 2 of 2");
  await expect(mainRow(page, "research", "Note one")).toBeFocused();

  // Bibliography ignores the chord
  await mainRow(page, "research", "Bibliography").focus();
  await page.keyboard.press("Alt+ArrowDown");
  expect((await rowTitles(page, "research"))[0]).toBe("Bibliography");

  // Section
  const sections = await entryTitles(page);
  await mainRow(page, "manuscript", sections[0]).focus();
  await page.keyboard.press("Alt+ArrowDown");
  expect(await entryTitles(page)).toEqual([sections[1], sections[0]]);
  await expect(status(page)).toHaveText(`Moved ${sections[0]} to position 2 of 2`);
  await expect(mainRow(page, "manuscript", sections[0])).toBeFocused();

  // Group heading
  await heading(page, "manuscript").focus();
  await page.keyboard.press("Alt+ArrowDown");
  expect(await groupNames(page)).toEqual(["fragments", "manuscript", "research"]);
  await expect(status(page)).toHaveText("Moved Manuscript to position 2 of 3");
  await expect(heading(page, "manuscript")).toBeFocused();
  await page.keyboard.press("Alt+ArrowUp");
  await expect(status(page)).toHaveText("Moved Manuscript to position 1 of 3");
  expect(await groupNames(page)).toEqual(["manuscript", "fragments", "research"]);
  await page.keyboard.press("Alt+ArrowUp");
  await expect(status(page)).toHaveText("Manuscript is already first");
  expect(await groupNames(page)).toEqual(["manuscript", "fragments", "research"]);

  // Everything survives a reload.
  await reloadAndWait(page);
  expect(await rowTitles(page, "fragments")).toEqual(["Frag two", "Frag one"]);
  expect(await entryTitles(page)).toEqual([sections[1], sections[0]]);
  const reloaded = await rowTitles(page, "research");
  expect(reloaded[1]).toContain("Beta source");
  expect(reloaded.slice(4)).toEqual(["Note two", "Note one"]);
});

test("with a search query the chord moves the focused fragment past its visible neighbour", async ({ page }) => {
  await createProject(page, "Chord search");
  await addFragment(page, "Frag one");
  await addFragment(page, "Other two");
  await addFragment(page, "Frag three");
  await page.getByLabel("Search project").fill("Frag");
  expect(await rowTitles(page, "fragments")).toEqual(["Frag one", "Frag three"]);
  await mainRow(page, "fragments", "Frag three").focus();
  await page.keyboard.press("Alt+ArrowUp");
  expect(await rowTitles(page, "fragments")).toEqual(["Frag three", "Frag one"]);
  await expect(mainRow(page, "fragments", "Frag three")).toBeFocused();
  await page.getByLabel("Search project").fill("");
  expect(await rowTitles(page, "fragments")).toEqual(["Frag three", "Frag one", "Other two"]);
});

test("a repeated announcement is re-read: the live region text is rewritten on the second press", async ({ page }) => {
  // A2 review follow-up (wave 5 A3): setAnnouncement(sameString) was a React no-op, so a
  // screen reader heard "already last" only once.
  await createProject(page, "Chord repeat");
  await addFragment(page, "Frag one");
  await addFragment(page, "Frag two");
  await mainRow(page, "fragments", "Frag two").focus();
  await status(page).evaluate((el) => {
    const w = window as unknown as { liveWrites: number };
    w.liveWrites = 0;
    new MutationObserver((records) => {
      w.liveWrites += records.length;
    }).observe(el, { childList: true, characterData: true, subtree: true });
  });
  const writes = () => page.evaluate(() => (window as unknown as { liveWrites: number }).liveWrites);
  await page.keyboard.press("Alt+ArrowDown");
  await expect(status(page)).toHaveText("Frag two is already last");
  await page.waitForTimeout(200);
  const first = await writes();
  expect(first).toBeGreaterThan(0);
  await page.keyboard.press("Alt+ArrowDown");
  await expect.poll(writes, { timeout: 2000 }).toBeGreaterThan(first);
  await expect(status(page)).toHaveText("Frag two is already last");
  await expect(mainRow(page, "fragments", "Frag two")).toBeFocused();
  expect(await rowTitles(page, "fragments")).toEqual(["Frag one", "Frag two"]);
});
