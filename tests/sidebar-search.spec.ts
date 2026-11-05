import { test, expect, type Page } from "@playwright/test";
import { mkdirSync } from "node:fs";

// UI wave 5, E1 (docs/agent-work/2026-11-01-ui-wave-5/PLAN.md, Amendment 1):
// the sidebar search gets an icon-only clear button and Escape-to-clear.

const SHOTS = process.env.E1_SHOTS;

async function openProject(page: Page, floating = false) {
  await page.addInitScript((on) => {
    localStorage.setItem("personal-word.restoreTabs", "true");
    if (on) {
      localStorage.setItem(
        "folio.workspace.sidebar",
        JSON.stringify({ width: 280, pinned: true, hover: false, floating: true }),
      );
    }
  }, floating);
  await page.goto("/");
  await page.getByRole("button", { name: "Start new project" }).click();
  await page.getByRole("button", { name: "Blank", exact: true }).click();
  await page.getByLabel("Project title").fill("Search project");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByRole("textbox", { name: "Writing editor" })).toBeVisible();
}

const field = (page: Page) => page.getByRole("textbox", { name: "Search project" });
const clear = (page: Page) => page.getByRole("button", { name: "Clear search" });
const hint = (page: Page) => page.locator(".search kbd");

test("clear button is absent when empty and clears while the field keeps focus", async ({ page }) => {
  await page.setViewportSize({ width: 1300, height: 850 });
  await openProject(page);
  await expect(clear(page)).toBeHidden();
  await expect(hint(page)).toHaveCount(0);
  await field(page).fill("intro");
  await expect(clear(page)).toBeVisible();
  await expect(hint(page)).toHaveCount(0);
  await clear(page).click();
  await expect(field(page)).toHaveValue("");
  await expect(field(page)).toBeFocused();
  await expect(clear(page)).toBeHidden();
  await expect(hint(page)).toHaveCount(0);
});

// UI wave 7 A: the Cmd-K hint is gone from the field, but the shortcut still focuses it.
test("Cmd-K still focuses Find in project with no hint shown", async ({ page }) => {
  await page.setViewportSize({ width: 1300, height: 850 });
  await openProject(page);
  await expect(hint(page)).toHaveCount(0);
  await page.getByRole("textbox", { name: "Writing editor" }).first().click();
  await page.keyboard.press("ControlOrMeta+k");
  await expect(field(page)).toBeFocused();
});

test("clear button is icon-only, flat, square, colour hover at the search end", async ({ page }) => {
  await page.setViewportSize({ width: 1300, height: 850 });
  await openProject(page);
  await field(page).fill("x");
  const b = clear(page);
  await expect(b).toBeVisible();
  const box = await b.boundingBox();
  const input = await field(page).boundingBox();
  expect(box!.x).toBeGreaterThanOrEqual(input!.x + input!.width - 1);
  expect(box!.width).toBeGreaterThanOrEqual(24);
  const style = (sel: "color" | "backgroundColor" | "borderRadius") =>
    b.evaluate((el, k) => getComputedStyle(el)[k as "color"], sel);
  expect(await style("backgroundColor")).toBe("rgba(0, 0, 0, 0)");
  expect(await style("borderRadius")).toBe("0px");
  expect(await b.textContent()).toBe("");
  const rest = await style("color");
  await b.hover();
  await page.waitForTimeout(300);
  expect(await style("color")).not.toBe(rest);
  expect(await style("backgroundColor")).toBe("rgba(0, 0, 0, 0)");
  expect(await b.evaluate((el) => getComputedStyle(el).fontWeight + getComputedStyle(el).webkitTextStrokeWidth)).toBe(
    await b.evaluate((el) => getComputedStyle(el).fontWeight + "0px"),
  );
});

test("Escape clears a non-empty query without leaving the field; empty Escape is unchanged", async ({ page }) => {
  await page.setViewportSize({ width: 1300, height: 850 });
  await openProject(page);
  await field(page).fill("abc");
  await page.keyboard.press("Escape");
  await expect(field(page)).toHaveValue("");
  await expect(field(page)).toBeFocused();
  // Empty field: Escape does nothing new (pinned sidebar stays, focus stays).
  await page.keyboard.press("Escape");
  await expect(field(page)).toBeFocused();
  await expect(page.locator(".sidebar")).toBeVisible();
});

test("Escape on an empty field in the overlay sidebar still closes it", async ({ page }) => {
  await page.setViewportSize({ width: 1300, height: 850 });
  await openProject(page);
  await page.getByRole("button", { name: "Unpin sidebar" }).click();
  await page.locator(".sidebar-edge").hover();
  await field(page).focus();
  await field(page).fill("zz");
  await page.keyboard.press("Escape");
  await expect(field(page)).toHaveValue("");
  await expect(page.locator(".sidebar")).toHaveJSProperty("inert", false);
  await page.keyboard.press("Escape");
  await expect(page.locator(".sidebar")).toHaveJSProperty("inert", true);
});

test("fade uses opacity with the fast duration; Reduce Motion is instant", async ({ page }) => {
  await page.setViewportSize({ width: 1300, height: 850 });
  await openProject(page);
  // getByRole skips visibility:hidden, and the empty-state button is hidden.
  const t = () =>
    page.locator('[aria-label="Clear search"]').evaluate((el) => {
      const s = getComputedStyle(el);
      return { p: s.transitionProperty, d: s.transitionDuration };
    });
  const normal = await t();
  expect(normal.p).toContain("opacity");
  expect(normal.p).not.toContain("all");
  expect(normal.d).toContain("0.12s");
  await page.emulateMedia({ reducedMotion: "reduce" });
  const reduced = await t();
  expect(reduced.d.split(",").every((d) => parseFloat(d) === 0)).toBe(true);
  await field(page).fill("q");
  await expect(clear(page)).toHaveCSS("opacity", "1");
});

test("floating sidebar: the search has no surface behind it", async ({ page }) => {
  await page.setViewportSize({ width: 1500, height: 900 });
  await openProject(page, true);
  await expect(page.locator(".sidebar-shell")).toHaveClass(/is-floating/);
  await field(page).fill("hello");
  await expect(clear(page)).toBeVisible();
  for (const sel of [".search", ".search input"]) {
    await expect(page.locator(sel).first()).toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
  }
  await expect(clear(page)).toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
});

for (const mode of ["light", "dark"] as const) {
  for (const accent of ["plain", "color"] as const) {
    for (const floating of [false, true]) {
      test(`screenshots ${mode} ${accent}${floating ? " floating" : ""}`, async ({ page }) => {
        test.skip(!SHOTS, "set E1_SHOTS to a folder to write screenshots");
        mkdirSync(SHOTS!, { recursive: true });
        await page.emulateMedia({ colorScheme: mode });
        await page.setViewportSize({ width: floating ? 1500 : 1300, height: 900 });
        await page.addInitScript(
          ([m, a]) => {
            localStorage.setItem(
              "folio.workspace.appearance",
              JSON.stringify({
                theme: m,
                palette: a,
                sections: { manuscript: "blue", fragments: "green", research: "orange" },
              }),
            );
          },
          [mode, accent],
        );
        await openProject(page, floating);
        const area = page.locator(".sidebar");
        const name = `${SHOTS}/${mode}-${accent}${floating ? "-floating" : ""}`;
        await area.screenshot({ path: `${name}-empty.png` });
        await field(page).fill("hello");
        await expect(clear(page)).toBeVisible();
        await page.waitForTimeout(250);
        await area.screenshot({ path: `${name}-text.png` });
      });
    }
  }
}
