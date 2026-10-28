import { test, expect } from "@playwright/test";
import { ALLOWED, installProbe, sampleDuring } from "./motion-helpers";

// U5 (T102): the create menu morphs out of its trigger. Motion may touch only
// the allow-listed properties (docs/design-system.md, Motion).
test.beforeEach(async ({ page }) => {
  await installProbe(page);
});

test("(g) opening the create menu animates only allowed properties", async ({
  page,
}) => {
  await page.goto("/");
  const trigger = page.getByRole("button", { name: "Start new project" });
  await expect(trigger).toBeVisible();
  const samples = await sampleDuring(page, () => trigger.click());
  await expect(page.locator("#create-panel")).toBeVisible();
  const props = samples.flatMap((s) => s.props);
  expect(props.length).toBeGreaterThan(0);
  expect(props.filter((p) => !ALLOWED.includes(p))).toEqual([]);
});

test("(g2) the create menu items are opaque from the first frame", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Start new project" }).click();
  const panel = page.locator("#create-panel");
  await expect(panel).toBeVisible();
  const opacities = await panel
    .locator("[data-popover-item]")
    .evaluateAll((els) => els.map((el) => getComputedStyle(el).opacity));
  expect(opacities.length).toBeGreaterThan(0);
  expect(opacities.filter((o) => o !== "1")).toEqual([]);
});

test("(g3) reopening reverses the create trigger fade in place", async ({
  page,
}) => {
  await page.goto("/");
  const trigger = page.getByRole("button", { name: "Start new project" });
  await trigger.click();
  await expect(page.locator("#create-panel")).toBeVisible();
  await expect
    .poll(() =>
      trigger.evaluate((el) =>
        el.getAnimations().some((animation) =>
          (animation.effect as KeyframeEffect | null)
            ?.getKeyframes()
            .some((frame) => "opacity" in frame),
        ),
      ),
    )
    .toBe(true);
  await trigger.evaluate((el) => {
    const animation = el.getAnimations().find((candidate) =>
      (candidate.effect as KeyframeEffect | null)
        ?.getKeyframes()
        .some((frame) => "opacity" in frame),
    );
    if (!animation) throw new Error("create trigger opacity animation is missing");
    (window as Window & { __createTriggerFade?: Animation }).__createTriggerFade = animation;
  });

  const rate = () =>
    trigger.evaluate(() =>
      (window as Window & { __createTriggerFade?: Animation }).__createTriggerFade?.playbackRate,
    );
  await page.keyboard.press("Escape");
  await expect.poll(rate).toBe(-1);
  await page.keyboard.press("Enter");
  await expect(page.locator("#create-panel")).toBeVisible();
  await expect.poll(rate).toBe(1);
});
