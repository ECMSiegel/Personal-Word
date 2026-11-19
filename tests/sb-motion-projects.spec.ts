import { test, expect, type Page } from "@playwright/test";
import { installProbe } from "./motion-helpers";

// M2: Projects <-> document -- the page comes forward. A pointer open fades and
// raises only the sheet; a pointer return to Projects fades the library and
// staggers its rows. Keyboard, the palette and Reduce Motion: nothing.

type Anim = { target: string; props: string[]; duration: number; delay: number; first: Keyframe; last: Keyframe };

test.beforeEach(async ({ page }) => installProbe(page));

async function seed(page: Page, titles: string[]) {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/");
  for (const title of titles) {
    await page.getByRole("button", { name: "Start new project" }).click();
    await page.getByRole("button", { name: "Blank", exact: true }).click();
    await page.getByLabel("Project title").fill(title);
    await page.getByRole("button", { name: "Save", exact: true }).click();
    await expect(page.getByRole("textbox", { name: "Writing editor" })).toBeVisible();
    await page.getByRole("button", { name: "Projects", exact: true }).click();
    await expect(page.locator(".library")).toBeVisible();
  }
  await expect(page.locator(".project-row")).toHaveCount(titles.length);
  await page.waitForFunction(() => document.getAnimations().length === 0);
}

async function watch(page: Page, act: () => Promise<void>): Promise<Anim[]> {
  await page.evaluate(() => {
    const w = window as unknown as Record<string, any>;
    const seen = new Map<Animation, any>();
    const name = (t: Element | null) => {
      if (!t) return "none";
      if (t.matches(".library")) return "library";
      if (t.matches(".project-row")) return "row";
      if (t.matches(".editor-paper")) return "sheet";
      if (t.closest(".writing-surface")) return "editor-content";
      if (t.closest("[data-group], aside, .project-sidebar, nav, .tabs, header")) return "chrome";
      return "other:" + t.tagName.toLowerCase() + "." + String((t as HTMLElement).className).slice(0, 40);
    };
    w.__m2 = { seen, stop: performance.now() + 1e9 };
    const tick = () => {
      for (const a of document.getAnimations()) {
        const effect = a.effect as KeyframeEffect | null;
        // CSS transitions (hover, press) are the app's own; only script animations count.
        if (!effect || seen.has(a) || a instanceof CSSTransition || a instanceof CSSAnimation) continue;
        const frames = effect.getKeyframes();
        seen.set(a, {
          target: name(effect.target as Element | null),
          props: frames.flatMap((f) => Object.keys(f).filter((k) => !["offset", "easing", "composite", "computedOffset"].includes(k))),
          duration: Number(effect.getTiming().duration),
          delay: Number(effect.getTiming().delay),
          first: frames[0],
          last: frames[frames.length - 1],
        });
      }
      if (performance.now() < w.__m2.stop) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
  await act();
  await page.waitForTimeout(600);
  return page.evaluate(() => {
    const w = window as unknown as Record<string, any>;
    w.__m2.stop = 0;
    return [...w.__m2.seen.values()];
  });
}

const known = (anims: Anim[]) => anims.filter((a) => ["library", "row", "sheet", "chrome", "editor-content"].includes(a.target));
const rowButton = (page: Page, title: string) => page.locator(".project-row").filter({ hasText: title }).locator(".row-label");
const toProjects = (page: Page) => page.getByRole("button", { name: "Projects", exact: true });
const TITLES = ["Alpha draft", "Beta notes", "Gamma"];

test("a pointer open fades and raises only the sheet", async ({ page }) => {
  await seed(page, TITLES);
  const anims = await watch(page, () => rowButton(page, "Beta notes").click());
  await expect(page.getByRole("textbox", { name: "Writing editor" })).toBeVisible();
  const sheet = anims.filter((a) => a.target === "sheet");
  expect(sheet).toHaveLength(1);
  expect(sheet[0].duration).toBe(180);
  expect([...new Set(sheet[0].props)].sort()).toEqual(["opacity", "transform"]);
  expect(Number(sheet[0].first.opacity)).toBe(0);
  expect(String(sheet[0].first.transform)).toContain("translateY(4px)");
  expect(anims.filter((a) => a.target === "chrome")).toHaveLength(0);
  expect(anims.filter((a) => a.target === "editor-content")).toHaveLength(0);
  expect(anims.filter((a) => a.target === "library" || a.target === "row")).toHaveLength(0);
});

test("opening with Enter runs no animation", async ({ page }) => {
  await seed(page, TITLES);
  await rowButton(page, "Beta notes").focus();
  const anims = await watch(page, () => page.keyboard.press("Enter"));
  await expect(page.getByRole("textbox", { name: "Writing editor" })).toBeVisible();
  expect(known(anims)).toHaveLength(0);
});

test("Reduce Motion: a pointer open runs no animation", async ({ page }) => {
  await seed(page, TITLES);
  await page.emulateMedia({ reducedMotion: "reduce" });
  const anims = await watch(page, () => rowButton(page, "Beta notes").click());
  await expect(page.getByRole("textbox", { name: "Writing editor" })).toBeVisible();
  expect(known(anims)).toHaveLength(0);
});

test("a pointer return fades the library in and staggers its rows", async ({ page }) => {
  await seed(page, TITLES);
  await rowButton(page, "Beta notes").click();
  await expect(page.getByRole("textbox", { name: "Writing editor" })).toBeVisible();
  await page.waitForFunction(() => document.getAnimations().length === 0);
  const anims = await watch(page, () => toProjects(page).click());
  await expect(page.locator(".project-row")).toHaveCount(3);
  const lib = anims.filter((a) => a.target === "library");
  expect(lib).toHaveLength(1);
  expect(lib[0].duration).toBe(120);
  expect([...new Set(lib[0].props)]).toEqual(["opacity"]);
  expect(Number(lib[0].first.opacity)).toBe(0);
  const rows = anims.filter((a) => a.target === "row");
  expect(rows).toHaveLength(3);
  expect(rows.every((r) => [...new Set(r.props)].join() === "transform")).toBe(true);
  expect(rows.map((r) => r.delay).sort((a, b) => a - b)).toEqual([0, 15, 30]);
  expect(anims.filter((a) => a.target === "chrome" || a.target === "sheet")).toHaveLength(0);
});

test("returning with the keyboard runs no animation", async ({ page }) => {
  await seed(page, TITLES);
  await rowButton(page, "Beta notes").click();
  await expect(page.getByRole("textbox", { name: "Writing editor" })).toBeVisible();
  await toProjects(page).focus();
  const anims = await watch(page, () => page.keyboard.press("Enter"));
  await expect(page.locator(".project-row")).toHaveCount(3);
  expect(known(anims)).toHaveLength(0);
});

test("Reduce Motion: a pointer return runs no animation", async ({ page }) => {
  await seed(page, TITLES);
  await rowButton(page, "Beta notes").click();
  await expect(page.getByRole("textbox", { name: "Writing editor" })).toBeVisible();
  await page.waitForFunction(() => document.getAnimations().length === 0);
  await page.emulateMedia({ reducedMotion: "reduce" });
  const anims = await watch(page, () => toProjects(page).click());
  await expect(page.locator(".project-row")).toHaveCount(3);
  expect(known(anims)).toHaveLength(0);
});
