import { test, expect, type Page } from "@playwright/test";
import { create } from "./pages-helpers";

// UI wave 5, E2 (docs/agent-work/2026-11-01-ui-wave-5/PLAN.md): internal scroll regions
// (the research panel's aside and the citation card body) fade at an edge only while more
// content lies beyond it -- a mask-image on the content, no transition.

const mask = (page: Page, selector: string) =>
  page.locator(selector).first().evaluate((el) => {
    const s = getComputedStyle(el);
    return { image: s.maskImage || s.webkitMaskImage || "none", transition: s.transitionProperty };
  });
const fades = async (page: Page, selector: string) => (await mask(page, selector)).image !== "none";
const scrollTo = (page: Page, selector: string, where: "top" | "mid" | "bottom") =>
  page.locator(selector).first().evaluate(async (el, w) => {
    el.scrollTop = w === "top" ? 0 : w === "bottom" ? el.scrollHeight : (el.scrollHeight - el.clientHeight) / 2;
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  }, where);
const attrs = (page: Page, selector: string) =>
  page.locator(selector).first().evaluate((el) => ({
    top: el.hasAttribute("data-scroll-top"),
    bottom: el.hasAttribute("data-scroll-bottom"),
    overflow: el.scrollHeight > el.clientHeight + 1,
  }));

async function seedFloating(page: Page) {
  await page.addInitScript(() => {
    localStorage.setItem("personal-word.restoreTabs", "true");
    localStorage.setItem("folio.workspace.sidebar", JSON.stringify({ floating: true }));
  });
}

test("research panel fades only at the edge that has more content", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 520 });
  await create(page, "Fade panel");
  await page.locator(".group-title").filter({ hasText: /^Research$/ }).click();
  await page.getByRole("button", { name: "Enter manually" }).click();
  const sel = ".research-aside";
  await expect(page.locator(sel)).toBeVisible();
  expect((await attrs(page, sel)).overflow).toBe(true);

  await scrollTo(page, sel, "top");
  await expect.poll(() => attrs(page, sel)).toMatchObject({ top: false, bottom: true });
  let m = await mask(page, sel);
  expect(m.image).toContain("linear-gradient");
  expect(m.image).not.toContain("to top");

  await scrollTo(page, sel, "mid");
  await expect.poll(() => attrs(page, sel)).toMatchObject({ top: true, bottom: true });
  m = await mask(page, sel);
  expect(m.image).toContain("linear-gradient");
  const mid = m.image;

  await scrollTo(page, sel, "bottom");
  await expect.poll(() => attrs(page, sel)).toMatchObject({ top: true, bottom: false });
  m = await mask(page, sel);
  expect(m.image).toContain("linear-gradient");
  expect(m.image).not.toBe(mid);

  // No transition on the mask: nothing animates it in.
  expect(m.transition).not.toMatch(/mask/);

  // A menu open inside the region is not masked, even mid-scroll.
  await scrollTo(page, sel, "mid");
  await page.getByRole("button", { name: "Source type", exact: true }).click();
  await expect(page.locator(".popover:visible").last()).toBeVisible();
  expect(await fades(page, sel)).toBe(false);
  await page.keyboard.press("Escape");
  await expect(page.locator(".popover:visible")).toHaveCount(0);
  await expect.poll(() => fades(page, sel)).toBe(true);
});

test("short research panel has no fade", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await create(page, "Fade short");
  await page.locator(".group-title").filter({ hasText: /^Research$/ }).click();
  await expect(page.locator(".research-aside")).toBeVisible();
  expect((await attrs(page, ".research-aside")).overflow).toBe(false);
  expect(await fades(page, ".research-aside")).toBe(false);
});

test("citation card: Cite here is visible in preview at 900 px, only the fields scroll and fade", async ({ page }) => {
  await seedFloating(page);
  await page.setViewportSize({ width: 1440, height: 900 });
  await create(page, "Fade card");
  await page.locator(".group-title").filter({ hasText: /^Research$/ }).click();
  const card = page.locator(".citation-card");
  await expect(card).toBeVisible();
  await card.getByRole("button", { name: "Enter manually", exact: true }).click();
  await expect(card).toHaveAttribute("data-stage", "preview");

  const cite = card.getByRole("button", { name: "Cite here", exact: true });
  await expect(cite).toBeVisible();
  const inside = await page.evaluate(() => {
    const c = document.querySelector(".citation-card")!.getBoundingClientRect();
    const b = [...document.querySelectorAll(".citation-card button")].find((n) => n.textContent === "Cite here")!.getBoundingClientRect();
    const body = document.querySelector(".citation-card-body")!;
    return {
      inCard: b.top >= c.top && b.bottom <= c.bottom && b.left >= c.left && b.right <= c.right,
      inViewport: b.bottom <= window.innerHeight && b.top >= 0,
      outsideBody: !body.contains([...document.querySelectorAll(".citation-card button")].find((n) => n.textContent === "Cite here")!),
    };
  });
  expect(inside).toEqual({ inCard: true, inViewport: true, outsideBody: true });

  // Keyboard order: fields -> actions -> link.
  const order = await card.evaluate((el) => {
    const focusable = [...el.querySelectorAll<HTMLElement>("input, textarea, button, [tabindex]")].filter((n) => !n.hasAttribute("disabled"));
    const idx = (pred: (n: HTMLElement) => boolean) => focusable.findIndex(pred);
    return {
      lastField: Math.max(...focusable.map((n, i) => (n.closest(".citation-card-body") ? i : -1))),
      cite: idx((n) => n.textContent === "Cite here"),
      link: idx((n) => n.textContent === "Open full research panel"),
    };
  });
  expect(order.lastField).toBeLessThan(order.cite);
  expect(order.cite).toBeLessThan(order.link);

  // The body fades only while it has hidden content; the footer stays put.
  const body = ".citation-card-body";
  await page.setViewportSize({ width: 1440, height: 560 });
  await expect.poll(async () => (await attrs(page, body)).overflow).toBe(true);
  await scrollTo(page, body, "top");
  await expect.poll(() => attrs(page, body)).toMatchObject({ top: false, bottom: true });
  expect(await fades(page, body)).toBe(true);
  await scrollTo(page, body, "mid");
  await expect.poll(() => attrs(page, body)).toMatchObject({ top: true, bottom: true });
  await scrollTo(page, body, "bottom");
  await expect.poll(() => attrs(page, body)).toMatchObject({ top: true, bottom: false });
  expect(await fades(page, body)).toBe(true);
  await expect(cite).toBeVisible();
  expect(await fades(page, ".citation-card-foot")).toBe(false);
});
