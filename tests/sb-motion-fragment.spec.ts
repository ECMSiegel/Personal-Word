import { test, expect, type Page } from "@playwright/test";
import { installProbe } from "./motion-helpers";

// M3: Keep as Fragment -- the snip is visible. A pointer click on the scissors
// turns the icon and slides the new Fragments row in; every other path is still.

type Anim = { target: string; props: string[]; duration: number; first: Keyframe; last: Keyframe };

test.beforeEach(async ({ page }) => installProbe(page));

async function setup(page: Page, title: string) {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/");
  await page.getByRole("button", { name: "Start new project" }).click();
  await page.getByRole("button", { name: "Blank", exact: true }).click();
  await page.getByLabel("Project title").fill(title);
  await page.getByRole("button", { name: "Save", exact: true }).click();
  const editor = page.getByRole("textbox", { name: "Writing editor" });
  await expect(editor).toBeVisible();
  await editor.fill("alpha beta gamma delta");
  await editor.press("ControlOrMeta+a");
  await page.waitForFunction(() => document.getAnimations().length === 0);
  return editor;
}

// Records every animation (once) with a short name for its target, until stopped.
async function watch(page: Page, act: () => Promise<void>): Promise<Anim[]> {
  await page.evaluate(() => {
    const w = window as unknown as Record<string, any>;
    const seen = new Map<Animation, any>();
    const name = (t: Element | null) => {
      if (!t) return "none";
      if (t.matches(".extract svg")) return "icon";
      if (t.matches(".entry-row") && t.closest('[data-group="fragments"]')) return "fragment-row";
      if (t.matches(".group-heading") && t.closest('[data-group="fragments"]')) return "fragments-heading";
      if (t.closest(".writing-surface") || t.matches(".writing-surface, .editor-paper, .writer-scroll")) return "editor";
      return "other:" + t.tagName.toLowerCase() + "." + String((t as HTMLElement).className).slice(0, 40);
    };
    w.__m3 = { seen, stop: performance.now() + 1e9 };
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
          first: frames[0],
          last: frames[frames.length - 1],
          all: frames.map((f) => String(f.transform)),
        });
      }
      if (performance.now() < w.__m3.stop) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
  await act();
  await page.waitForTimeout(600);
  return page.evaluate(() => {
    const w = window as unknown as Record<string, any>;
    w.__m3.stop = 0;
    return [...w.__m3.seen.values()];
  });
}

const scissors = (page: Page) => page.getByRole("button", { name: "Keep as fragment" });

test("a pointer click turns the icon and slides the new row in, transform only", async ({ page }) => {
  await setup(page, "Fragment motion pointer");
  const anims = await watch(page, () => scissors(page).click());
  const icon = anims.filter((a) => a.target === "icon");
  const row = anims.filter((a) => a.target === "fragment-row");
  expect(icon.length).toBe(2);
  expect(icon.every((a) => a.duration === 80)).toBe(true);
  expect(icon.flatMap((a) => a.all).join(" ")).toContain("rotate(-12deg)");
  expect(row).toHaveLength(1);
  expect(row[0].props).toEqual(["transform", "transform"]);
  expect(String(row[0].first.transform)).toMatch(/translateY/);
  for (const a of anims.filter((x) => x.target === "icon" || x.target === "fragment-row")) {
    expect([...new Set(a.props)]).toEqual(["transform"]);
  }
  expect(anims.filter((a) => a.target === "editor")).toHaveLength(0);
  expect(anims.filter((a) => a.target === "fragments-heading")).toHaveLength(0);
});

test("a collapsed Fragments group nudges its heading instead of a row", async ({ page }) => {
  await setup(page, "Fragment motion collapsed");
  await page.getByRole("button", { name: "Hide Fragments" }).click();
  await page.waitForFunction(() => document.getAnimations().length === 0);
  const anims = await watch(page, () => scissors(page).click());
  expect(anims.filter((a) => a.target === "fragments-heading")).toHaveLength(1);
  expect(anims.filter((a) => a.target === "fragment-row")).toHaveLength(0);
  expect(anims.filter((a) => a.target === "icon").length).toBe(2);
  expect(anims.filter((a) => a.target === "editor")).toHaveLength(0);
});

test("the shortcut runs no animation on the icon, row or heading", async ({ page }) => {
  const editor = await setup(page, "Fragment motion shortcut");
  await editor.press("ControlOrMeta+Shift+x");
  await expect(editor).not.toContainText("alpha");
  await expect(page.locator('[data-group="fragments"] .entry-row')).toHaveCount(1);
  await page.waitForFunction(() => document.getAnimations().length === 0);
  // Second take, watched: the shortcut again after a pointer click elsewhere.
  await editor.fill("one two three");
  await editor.press("ControlOrMeta+a");
  await page.mouse.move(0, 0);
  const anims = await watch(page, () => editor.press("ControlOrMeta+Shift+x"));
  expect(anims.filter((a) => ["icon", "fragment-row", "fragments-heading", "editor"].includes(a.target))).toHaveLength(0);
  await expect(page.locator('[data-group="fragments"] .entry-row')).toHaveCount(2);
});

test("Reduce Motion: a pointer click runs no animation", async ({ page }) => {
  await setup(page, "Fragment motion reduced");
  await page.emulateMedia({ reducedMotion: "reduce" });
  const anims = await watch(page, () => scissors(page).click());
  expect(anims.filter((a) => ["icon", "fragment-row", "fragments-heading", "editor"].includes(a.target))).toHaveLength(0);
  await expect(page.locator('[data-group="fragments"] .entry-row')).toHaveCount(1);
});
