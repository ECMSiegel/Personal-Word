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

test("changing a Segmented value animates only transform and opacity", async ({ page }) => {
  await createProject(page);
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  const appearance = page.getByRole("group", { name: "Appearance" });
  const samples = await sampleDuring(page, () =>
    appearance.getByRole("button", { name: "Dark", exact: true }).click(),
  );
  const properties = samples.flatMap((sample) => sample.props);
  expect(properties.length).toBeGreaterThan(0);
  expect(properties).toContain("transform");
  expect(properties.filter((property) => !["transform", "opacity"].includes(property))).toEqual([]);
  expect(properties.filter((property) => !ALLOWED.includes(property))).toEqual([]);
  expect(await animatedProperties(page)).toEqual([]);
});

test("changing the sidebar selection animates only transform and opacity", async ({ page }) => {
  await createProject(page);
  const samples = await sampleDuring(page, () =>
    page.locator('.sidebar-group[data-group="manuscript"] .entry-main').first().click(),
  );
  const properties = samples.flatMap((sample) => sample.props);
  expect(properties.length).toBeGreaterThan(0);
  expect(properties).toContain("transform");
  expect(properties.filter((property) => !["transform", "opacity"].includes(property))).toEqual([]);
  expect(properties.filter((property) => !ALLOWED.includes(property))).toEqual([]);
  expect(await animatedProperties(page)).toEqual([]);
});
