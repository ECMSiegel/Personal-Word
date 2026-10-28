import { test, expect, type Page } from "@playwright/test";
import {
  ALLOWED,
  animatedProperties,
  installProbe,
  sampleDuring,
} from "./motion-helpers";

async function createProject(page: Page) {
  await page.goto("/");
  await page.getByRole("button", { name: "Start new project" }).click();
  await page.getByRole("button", { name: "Blank", exact: true }).click();
  await page.getByLabel("Project title").fill("U7 motion check");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await page.getByRole("button", { name: "New section", exact: true }).click();
  await page.getByLabel("Title", { exact: true }).fill("Second section");
  await page.getByRole("button", { name: "Save", exact: true }).click();
}

test.beforeEach(async ({ page }) => installProbe(page));

// A choice in a Segmented control is weight and colour on the plain surface
// (docs/design-system.md, Motion): S3 removed the sliding box, so a value change
// animates nothing at all. "Nothing animated" is only meaningful if the probe
// can see an animation, so this checks the instrument first, and it checks the
// click landed, so an empty sample is a real result rather than a dead probe or
// a missed click.
async function probeSeesAnAnimation(page: Page): Promise<string[]> {
  return page.evaluate(async () => {
    const probe = document.createElement("div");
    probe.style.opacity = "1";
    probe.style.transition = "opacity 200ms linear";
    document.body.append(probe);
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    probe.style.opacity = "0";
    await new Promise((resolve) => requestAnimationFrame(resolve));
    const seen = window.__animatedProperties();
    probe.remove();
    return seen;
  });
}

test("changing a Segmented value animates nothing but transform and opacity (no sliding box)", async ({ page }) => {
  await createProject(page);
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  const appearance = page.getByRole("group", { name: "Appearance" });
  expect(await probeSeesAnAnimation(page)).toContain("opacity");
  const dark = appearance.getByRole("button", { name: "Dark", exact: true });
  const light = appearance.getByRole("button", { name: "Light", exact: true });
  const samples = await sampleDuring(page, () => dark.click());
  const properties = samples.flatMap((sample) => sample.props);
  // The click took effect, and it took effect on the plain surface: no box.
  await expect(dark).toHaveAttribute("aria-pressed", "true");
  await expect(light).toHaveAttribute("aria-pressed", "false");
  await expect(page.locator(".segmented-highlight")).toHaveCount(0);
  expect(properties.filter((property) => !["transform", "opacity"].includes(property))).toEqual([]);
  expect(properties.filter((property) => !ALLOWED.includes(property))).toEqual([]);
  expect(await animatedProperties(page)).toEqual([]);
});

test("changing the sidebar selection animates nothing but transform and opacity (no sliding box)", async ({ page }) => {
  await createProject(page);
  const samples = await sampleDuring(page, () =>
    page.locator('.sidebar-group[data-group="manuscript"] .entry-main').first().click(),
  );
  const properties = samples.flatMap((sample) => sample.props);
  expect(properties.length).toBeGreaterThan(0);
  expect(properties.filter((property) => !["transform", "opacity"].includes(property))).toEqual([]);
  expect(properties.filter((property) => !ALLOWED.includes(property))).toEqual([]);
  expect(await animatedProperties(page)).toEqual([]);
});
