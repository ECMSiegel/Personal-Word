import { test, expect, type Page } from "@playwright/test";
import { existsSync } from "node:fs";

const fontFiles = [
  "/System/Library/Fonts/Supplemental/Trebuchet MS.ttf",
  "/System/Library/Fonts/Supplemental/Trebuchet MS Bold.ttf",
  "/System/Library/Fonts/Supplemental/Trebuchet MS Italic.ttf",
];

// The interface font the test chooses. expectUiFont checks every visible text element against it.
const UI_FONT = "Georgia";
// Deliberate exceptions to the interface font: the brand keeps Futura, document text and code keep
// their own faces. Nothing else is exempt.
// The toolbar Font family button also names the document's current typeface in that face (it shows the
// document font, not interface text), so its value label is exempt.
// The footnotes printed at the foot of the page are document text, in the document font.
const UI_FONT_EXCEPTIONS = '.brand, .writing-surface, .ProseMirror, .read-prose, code, pre, kbd, [aria-label="Font family"] .dropdown-value, .footnote-number, .footnote-body';

const crossrefWork = {
  status: "ok",
  message: {
    type: "journal-article",
    DOI: "10.1234/example",
    title: ["Narrative Structure in Practice"],
    "container-title": ["Journal of Examples"],
    author: [
      { given: "Jane", family: "Smith" },
      { given: "Omar", family: "Reyes" },
    ],
    volume: "12",
    issue: "3",
    page: "45-67",
    issued: { "date-parts": [[2024, 5, 2]] },
  },
};

async function settings(page: Page) {
  await page.goto("/");
  await page.getByRole("button", { name: "Start new project" }).click();
  await page.getByRole("button", { name: "Blank", exact: true }).click();
  await page.getByLabel("Project title").fill("Font settings");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await page.locator(".group-title").filter({ hasText: /^Settings$/ }).click();
}

/**
 * Every visible element that has its own text must compute to the interface font. Lists the
 * offenders on failure so a missed surface is named, not just counted.
 */
async function expectUiFont(page: Page, where: string, openFontMenu = false) {
  const offenders = await page.evaluate(({ exceptions, family, fontMenu }) => {
    const found: string[] = [];
    for (const el of Array.from(document.querySelectorAll<HTMLElement>("body *"))) {
      if (el.getClientRects().length === 0) continue;
      // A menu that is fading out (Popover data-state="closing") is leaving the screen, not part of it.
      if (getComputedStyle(el).visibility === "hidden" || el.closest('[data-state="closing"]')) continue;
      const ownText = Array.from(el.childNodes).some((node) => node.nodeType === Node.TEXT_NODE && (node.textContent ?? "").trim() !== "");
      if (!ownText) continue;
      if (el.closest(exceptions)) continue;
      // An open font menu shows each choice in its own face as a preview, on purpose.
      if (fontMenu && el.closest(".dropdown-option")) continue;
      const computed = getComputedStyle(el).fontFamily;
      if (!computed.replace(/"/g, "").startsWith(family)) {
        found.push(`${el.tagName.toLowerCase()}.${String(el.className)} "${(el.textContent ?? "").trim().slice(0, 40)}" -> ${computed}`);
      }
    }
    return found;
  }, { exceptions: UI_FONT_EXCEPTIONS, family: UI_FONT, fontMenu: openFontMenu });
  expect(offenders, `${where}: elements not in ${UI_FONT}`).toEqual([]);
}

test("interface and document font choices persist and added styles are shared", async ({ page }) => {
  if (fontFiles.some((path) => !existsSync(path))) {
    test.skip(true, "Trebuchet MS system font fixtures are not installed on this Mac");
  }
  await page.addInitScript(() => {
    if (sessionStorage.getItem("w9-seeded")) return;
    sessionStorage.setItem("w9-seeded", "1");
    localStorage.setItem("personal-word.restoreTabs", "true");
  });
  await settings(page);

  const interfaceFont = page.getByRole("button", { name: "Interface font" });
  await interfaceFont.click();
  await page.getByRole("option", { name: UI_FONT }).click();
  await expect.poll(() => page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue("--ui-font"))).toContain(UI_FONT);
  await expect(page.locator(".settings-section").first()).toHaveCSS("font-family", /Georgia/);
  // Wait until the chosen menu has closed before scanning the page.
  await expect(page.getByRole("option")).toHaveCount(0);
  await expectUiFont(page, "Settings after choosing the interface font");

  await page.reload();
  await expect.poll(() => page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue("--ui-font"))).toContain(UI_FONT);
  await expect.poll(() => page.evaluate(() => Array.from(document.fonts).filter((face) => face.family === "Trebuchet MS").length)).toBe(0);
  await page.locator(".group-title").filter({ hasText: /^Settings$/ }).click();
  await expectUiFont(page, "Settings after reload");

  const fileInput = page.locator('input[type="file"][accept=".ttf,.otf"]');
  for (const path of fontFiles) {
    await fileInput.setInputFiles(path);
    await expect(page.getByText("Trebuchet MS", { exact: false }).first()).toBeVisible();
  }
  await expect(page.getByText("Trebuchet MS (Regular, Bold, Italic)")).toBeVisible();
  await interfaceFont.click();
  await expect(page.getByRole("option", { name: "Trebuchet MS" })).toHaveCount(1);
  await page.keyboard.press("Escape");

  await page.locator(".group-title").filter({ hasText: /^Manuscript$/ }).click();
  await expectUiFont(page, "Manuscript workspace (sidebar and toolbar)");
  const editor = page.getByRole("textbox", { name: "Writing editor" });
  await editor.click();
  const fontMenu = page.getByRole("button", { name: "Font family" });
  await fontMenu.click();
  await expectUiFont(page, "open toolbar font dropdown", true);
  await expect(page.getByRole("option", { name: "Trebuchet MS" })).toHaveCount(1);
  await page.getByRole("option", { name: "Trebuchet MS" }).click();
  await page.keyboard.type("Trebuchet specimen");
  await expect(editor.locator("span[style*='Trebuchet MS']")).toContainText("Trebuchet specimen");

  await page.keyboard.press("Meta+Shift+p");
  await expect(page.getByRole("dialog", { name: "Command palette" })).toBeVisible();
  await expectUiFont(page, "command palette");
  await page.keyboard.press("Escape");

  await page.locator(".group-title").filter({ hasText: /^Research$/ }).click();
  await expect(page.locator(".research-aside")).toBeVisible();
  await expectUiFont(page, "Research panel");
  await page.getByRole("textbox", { name: "DOI, ISBN, or web address" }).fill("10.1234/example");
  await page.route("https://api.crossref.org/works/**", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      headers: { "access-control-allow-origin": "*" },
      body: JSON.stringify(crossrefWork),
    }),
  );
  await page.getByRole("button", { name: "Look up", exact: true }).click();
  await expect(page.locator(".research-status")).toHaveText("Found on Crossref -- review the details");
  await page.getByRole("button", { name: "Cite here", exact: true }).click();
  await expect(editor.locator("[data-footnote-id]")).toHaveCount(1);
  const faces = await page.evaluate(() => Array.from(document.fonts).filter((face) => face.family === "Trebuchet MS").map((face) => ({ weight: face.weight, style: face.style, status: face.status })));
  expect(faces).toHaveLength(3);
  expect(faces).toEqual(expect.arrayContaining([
    expect.objectContaining({ weight: "400", style: "normal", status: "loaded" }),
    expect.objectContaining({ weight: "700", style: "normal", status: "loaded" }),
    expect.objectContaining({ weight: "400", style: "italic", status: "loaded" }),
  ]));

  // The citation card exists only in floating mode (wide window, Settings floating on), where it
  // takes the place of the docked Research panel. Open it the way tests/floating.spec.ts does.
  const setFloating = (on: boolean) => page.evaluate((floating) => {
    const saved = JSON.parse(localStorage.getItem("folio.workspace.sidebar") ?? "{}") ?? {};
    localStorage.setItem("folio.workspace.sidebar", JSON.stringify({ ...saved, floating }));
  }, on);
  await page.setViewportSize({ width: 1600, height: 900 });
  await setFloating(true);
  await page.reload();
  await page.locator(".group-title").filter({ hasText: /^Research$/ }).click();
  await expect(page.locator(".citation-card")).toBeVisible();
  await expectUiFont(page, "citation card (floating)");
  await setFloating(false);
  await page.reload();

  await page.locator(".group-title").filter({ hasText: /^Settings$/ }).click();
  await expectUiFont(page, "Settings with three Trebuchet faces added");
  await page.getByRole("button", { name: "Add font..." }).click();
  await fileInput.setInputFiles(fontFiles[0]!);
  await expect(page.getByRole("alert")).toHaveText("That font is already added");
  await fileInput.setInputFiles({ name: "fake.ttf", mimeType: "font/ttf", buffer: Buffer.from("not a font") });
  await expect(page.getByRole("alert")).toHaveText("That file is not a font this app can read");
  await page.getByRole("button", { name: "Remove" }).click();
  await expect(page.getByText("Trebuchet MS (Regular, Bold, Italic)")).toHaveCount(0);

  // Removed family must be gone from both font menus, not just the settings list.
  await interfaceFont.click();
  await expect(page.getByRole("option", { name: "Trebuchet MS" })).toHaveCount(0);
  await page.keyboard.press("Escape");
  await page.locator(".group-title").filter({ hasText: /^Manuscript$/ }).click();
  await editor.click();
  await fontMenu.click();
  await expect(page.getByRole("option", { name: "Trebuchet MS" })).toHaveCount(0);
  await page.keyboard.press("Escape");

  // Projects page: the interface font still applies, the brand keeps Futura.
  await page.evaluate(() => localStorage.setItem("personal-word.restoreTabs", "false"));
  await page.goto("/");
  await expect(page.getByRole("button", { name: "Start new project" })).toBeVisible();
  await expectUiFont(page, "Projects page");
  // The Sort menu, open: every row must be in the interface font (no exemptions).
  await page.getByRole("button", { name: "Sort projects" }).click();
  await expect(page.getByRole("menuitemradio", { name: "Name" })).toBeVisible();
  await expectUiFont(page, "open Sort dropdown");
  await page.keyboard.press("Escape");
  await expect(page.getByRole("menuitemradio")).toHaveCount(0);
  // the brand keeps its own face (PLAN C3 step 7): Futura while its surroundings are Georgia.
  const brandFonts = await page.evaluate(() => {
    const brand = document.querySelector(".brand")!;
    return {
      brand: getComputedStyle(brand).fontFamily.replace(/"/g, ""),
      parent: getComputedStyle(brand.parentElement!).fontFamily.replace(/"/g, ""),
    };
  });
  expect(brandFonts.brand.startsWith("Futura")).toBe(true);
  expect(brandFonts.parent.startsWith(UI_FONT)).toBe(true);
});
