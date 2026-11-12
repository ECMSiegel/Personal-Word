import { test, expect, type Page } from "@playwright/test";
import { installProbe } from "./motion-helpers";

type Run = {
  anims: { props: string[]; duration: number; first: Keyframe; last: Keyframe }[];
  asideSeen: boolean;
  firstWidth: number;
  finalWidth: number;
  endTransform: string;
  endOpacity: string;
};

test.beforeEach(async ({ page }) => installProbe(page));

async function createProject(page: Page, title: string) {
  await page.goto("/");
  await page.getByRole("button", { name: "Start new project" }).click();
  await page.getByRole("button", { name: "Blank", exact: true }).click();
  await page.getByLabel("Project title").fill(title);
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByRole("textbox", { name: "Writing editor" })).toBeVisible();
  await page.waitForFunction(() => document.getAnimations().length === 0);
}

// Samples every frame while `act` runs and for 500 ms after.
async function watch(page: Page, act: () => Promise<void>): Promise<Run> {
  await page.evaluate(() => {
    const w = window as unknown as Record<string, unknown>;
    const seen = new Map<Animation, { props: string[]; duration: number; first: Keyframe; last: Keyframe }>();
    let firstWidth = -1;
    let asideSeen = false;
    w.__m1 = { seen, get firstWidth() { return firstWidth; }, get asideSeen() { return asideSeen; } };
    w.__m1stop = performance.now() + 1e9;
    const tick = () => {
      const aside = document.querySelector(".research-aside");
      if (aside && !asideSeen) {
        asideSeen = true;
        firstWidth = document.querySelector(".writer-scroll")?.clientWidth ?? -1;
      }
      for (const a of document.getAnimations()) {
        const effect = a.effect as KeyframeEffect | null;
        if (!effect || effect.target !== aside || seen.has(a)) continue;
        const frames = effect.getKeyframes();
        seen.set(a, {
          props: frames.flatMap((f) => Object.keys(f).filter((k) => !["offset", "easing", "composite", "computedOffset"].includes(k))),
          duration: Number(effect.getTiming().duration),
          first: frames[0],
          last: frames[frames.length - 1],
        });
      }
      if (performance.now() < (w.__m1stop as number)) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
  await act();
  await page.waitForTimeout(500);
  return page.evaluate(() => {
    const w = window as unknown as Record<string, any>;
    w.__m1stop = 0;
    const aside = document.querySelector(".research-aside");
    const cs = aside ? getComputedStyle(aside) : null;
    return {
      anims: [...w.__m1.seen.values()],
      asideSeen: w.__m1.asideSeen,
      firstWidth: w.__m1.firstWidth,
      finalWidth: document.querySelector(".writer-scroll")?.clientWidth ?? -1,
      endTransform: cs?.transform ?? "none",
      endOpacity: cs?.opacity ?? "1",
    };
  });
}

const researchRow = (page: Page) => page.locator(".group-title").filter({ hasText: /^Research$/ });

test("a pointer open slides the panel in once, with transform and opacity only", async ({ page }) => {
  await createProject(page, "Research motion pointer");
  const run = await watch(page, () => researchRow(page).click());
  expect(run.asideSeen).toBe(true);
  expect(run.anims).toHaveLength(1);
  const anim = run.anims[0];
  expect(anim.duration).toBe(180);
  expect([...new Set(anim.props)].sort()).toEqual(["opacity", "transform"]);
  expect(Number(anim.first.opacity)).toBe(0);
  expect(String(anim.first.transform)).toMatch(/translateX/);
  expect(run.endTransform === "none" || run.endTransform === "matrix(1, 0, 0, 1, 0, 0)").toBe(true);
  expect(run.endOpacity).toBe("1");
  // The page beside the panel is already its final width on the first frame.
  expect(run.firstWidth).toBe(run.finalWidth);
});

test("a keyboard open (command palette) runs no animation", async ({ page }) => {
  await createProject(page, "Research motion keyboard");
  await page.getByRole("textbox", { name: "Writing editor" }).click();
  await page.keyboard.press("Meta+Shift+p");
  await expect(page.getByRole("combobox", { name: "Search commands" })).toBeFocused();
  await page.keyboard.type("go to research");
  const run = await watch(page, () => page.keyboard.press("Enter"));
  expect(run.asideSeen).toBe(true);
  expect(run.anims).toHaveLength(0);
});

test("Reduce Motion: a pointer open runs no animation", async ({ page }) => {
  await createProject(page, "Research motion reduced");
  await page.emulateMedia({ reducedMotion: "reduce" });
  const run = await watch(page, () => researchRow(page).click());
  expect(run.asideSeen).toBe(true);
  expect(run.anims).toHaveLength(0);
});

test("closing the panel runs no animation on it", async ({ page }) => {
  await createProject(page, "Research motion close");
  await researchRow(page).click();
  await expect(page.locator(".research-aside")).toBeVisible();
  await page.waitForFunction(() => document.getAnimations().length === 0);
  const run = await watch(page, () =>
    page.getByRole("button", { name: "Manuscript", exact: true }).first().click(),
  );
  expect(run.anims).toHaveLength(0);
});
