import { test, expect, type Page } from "@playwright/test";

test.use({ viewport: { width: 1400, height: 900 } });

async function start(page: Page, stored?: string) {
  if (stored !== undefined)
    await page.addInitScript((value) => {
      if (!sessionStorage.getItem("of6-seeded")) {
        localStorage.setItem("folio.recentFonts", value);
        sessionStorage.setItem("of6-seeded", "1");
      }
    }, stored);
  await page.goto("/");
  await page.getByRole("button", { name: "Start new project" }).click();
  await page.getByRole("button", { name: "Blank", exact: true }).click();
  await page.getByLabel("Project title").fill("Recent fonts");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  const editor = page.getByRole("textbox", { name: "Writing editor" });
  await editor.fill("Sample");
  await editor.press("ControlOrMeta+a");
  return editor;
}

const fontButton = (page: Page) => page.getByRole("button", { name: "Font family", exact: true });

/** Menu rows in DOM order: option, heading or separator. */
async function rows(page: Page) {
  return page.getByRole("listbox", { name: "Font family" }).evaluate((menu) =>
    [...menu.children].map((el) =>
      el.getAttribute("role") === "separator"
        ? "--"
        : el.getAttribute("role") === "presentation"
          ? "#" + (el.textContent ?? "").trim()
          : (el.textContent ?? "").trim(),
    ),
  );
}

async function apply(page: Page, name: string) {
  await fontButton(page).click();
  // The full list is below the divider; Recent rows come first, so take the last match.
  await page.getByRole("option", { name, exact: true }).last().click();
}

test("no Recent section or divider before any font is applied", async ({ page }) => {
  await start(page);
  await fontButton(page).click();
  const list = await rows(page);
  expect(list).not.toContain("--");
  expect(list.some((r) => r.startsWith("#"))).toBe(false);
  await expect(page.getByRole("listbox", { name: "Font family" }).getByRole("separator")).toHaveCount(0);
});

test("applying fonts fills Recent: newest first, once each, at most five", async ({ page }) => {
  await start(page);
  for (const name of ["Georgia", "Arial", "Verdana", "Georgia", "Courier New", "Helvetica", "Times New Roman"])
    await apply(page, name);
  await fontButton(page).click();
  const list = await rows(page);
  const divider = list.indexOf("--");
  expect(list[0]).toBe("#Recent");
  expect(list.slice(1, divider)).toEqual([
    "Times New Roman",
    "Helvetica",
    "Courier New",
    "Georgia",
    "Verdana",
  ]);
  // Below the divider is the whole list, each font exactly once.
  const full = list.slice(divider + 1);
  expect(full.length).toBe(new Set(full).size);
  expect(full).toEqual(expect.arrayContaining(["Arial", "Georgia", "Times New Roman"]));
  await expect(page.getByRole("listbox", { name: "Font family" }).getByRole("separator")).toHaveCount(1);
  // The divider is a grey line (--line) and the label is muted.
  const colours = await page.evaluate(() => {
    const root = getComputedStyle(document.documentElement);
    const sep = getComputedStyle(document.querySelector(".dropdown-separator")!);
    return { sep: sep.backgroundColor, line: root.getPropertyValue("--line").trim() };
  });
  expect(colours.sep).not.toBe("rgba(0, 0, 0, 0)");
});

test("Recent rows preview in their own face like the main list", async ({ page }) => {
  await start(page);
  await apply(page, "Georgia");
  await fontButton(page).click();
  const options = page.getByRole("option", { name: "Georgia", exact: true });
  await expect(options).toHaveCount(2);
  const faces = await options.evaluateAll((els) => els.map((el) => getComputedStyle(el).fontFamily));
  expect(faces[0]).toContain("Georgia");
  expect(faces[1]).toBe(faces[0]);
});

test("opening the menu or moving the caret does not change Recent", async ({ page }) => {
  const editor = await start(page);
  await apply(page, "Georgia");
  await editor.press("ControlOrMeta+a");
  await apply(page, "Verdana");
  // Caret into text in another font: Recent must not pick it up.
  await editor.evaluate((el: any) =>
    el.editor.chain().focus().selectAll().setMark("textFormat", { fontFamily: "Times New Roman, serif" }).run(),
  );
  await editor.locator("p").first().click();
  await fontButton(page).click();
  await page.keyboard.press("Escape");
  await fontButton(page).click();
  const list = await rows(page);
  expect(list.slice(0, list.indexOf("--"))).toEqual(["#Recent", "Verdana", "Georgia"]);
});

test("Recent is remembered under folio.recentFonts", async ({ page }) => {
  await start(page);
  await apply(page, "Georgia");
  await apply(page, "Arial");
  const stored = await page.evaluate(() => localStorage.getItem("folio.recentFonts"));
  expect(JSON.parse(stored!)).toEqual(["Arial, sans-serif", "Georgia, serif"]);
});

test("stored junk and fonts that are gone are not shown", async ({ page }) => {
  await start(page, JSON.stringify(["No Such Font", 7, null, "Verdana, sans-serif"]));
  await fontButton(page).click();
  const list = await rows(page);
  expect(list.slice(0, list.indexOf("--"))).toEqual(["#Recent", "Verdana"]);
});

test("unparseable stored data shows no Recent section", async ({ page }) => {
  await start(page, "{not json");
  await fontButton(page).click();
  await expect(page.getByRole("listbox", { name: "Font family" }).getByRole("separator")).toHaveCount(0);
  expect((await rows(page)).some((r) => r.startsWith("#"))).toBe(false);
});

test("keyboard and type-ahead skip the heading and divider", async ({ page }) => {
  await start(page, JSON.stringify(["Verdana, sans-serif"]));
  await fontButton(page).click();
  const menu = page.getByRole("listbox", { name: "Font family" });
  const active = async () =>
    menu.evaluate((el) => {
      const row = document.getElementById(el.getAttribute("aria-activedescendant") ?? "");
      return { text: (row?.textContent ?? "").trim(), role: row?.getAttribute("role") };
    });
  // Home lands on the first real option (the Recent row), never the label.
  await page.keyboard.press("End");
  await page.keyboard.press("Home");
  expect(await active()).toEqual({ text: "Verdana", role: "option" });
  // One step down passes the divider straight into the full list.
  await page.keyboard.press("ArrowDown");
  const second = await active();
  expect(second.role).toBe("option");
  const idx = await menu.evaluate((el) => {
    const row = document.getElementById(el.getAttribute("aria-activedescendant") ?? "")!;
    return [...el.children].indexOf(row);
  });
  expect(idx).toBe(3);
  await page.keyboard.press("ArrowUp");
  expect((await active()).text).toBe("Verdana");
  // Type-ahead never lands on the "Recent" label: "r" finds a real option (not the label).
  await page.keyboard.type("r");
  const typed = await active();
  expect(typed.role).toBe("option");
  expect(typed.text).not.toBe("Recent");
  // The highlighted row is the one the popover marks.
  await expect(menu.locator("[data-highlighted]")).toHaveCount(1);
  expect(await menu.locator("[data-highlighted]").evaluate((el) => el.getAttribute("role"))).toBe("option");
});

test("an ordinary dropdown is unchanged: no heading, no separator, same keys", async ({ page }) => {
  await start(page);
  const zoom = page.getByRole("button", { name: "Editor zoom", exact: true });
  await zoom.click();
  const menu = page.getByRole("listbox", { name: "Editor zoom" });
  expect(await menu.evaluate((el) => [...el.children].map((c) => c.getAttribute("role")))).toEqual([
    "option", "option", "option", "option", "option",
  ]);
  await expect(menu.getByRole("separator")).toHaveCount(0);
  await page.keyboard.press("Home");
  await expect(menu.locator("[data-highlighted]")).toHaveText("50%");
  await page.keyboard.press("End");
  await expect(menu.locator("[data-highlighted]")).toHaveText("150%");
  await page.keyboard.press("ArrowUp");
  await expect(menu.locator("[data-highlighted]")).toHaveText("125%");
  await page.keyboard.press("Enter");
  await expect(zoom).toContainText("125%");
});
