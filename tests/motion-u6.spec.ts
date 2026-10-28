import { test, expect } from "@playwright/test";
import {
  ALLOWED,
  animatedProperties,
  installProbe,
  sampleDuring,
} from "./motion-helpers";

test.use({ viewport: { width: 850, height: 600 } });
test.beforeEach(async ({ page }) => installProbe(page));

test("opening the More menu animates only transform, opacity and clip-path", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Start new project" }).click();
  await page.getByRole("button", { name: "Blank", exact: true }).click();
  await page.getByLabel("Project title").fill("U6 motion");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  const more = page.getByRole("button", {
    name: "More formatting",
    exact: true,
  });
  const samples = await sampleDuring(page, () => more.click());
  const properties = samples.flatMap((sample) => sample.props);
  expect(properties.length).toBeGreaterThan(0);
  expect(properties.filter((property) => !ALLOWED.includes(property))).toEqual(
    [],
  );
  await page
    .getByRole("dialog", { name: "More formatting" })
    .getByRole("button")
    .first()
    .hover();
  expect(
    await animatedProperties(page).then((p) =>
      p.filter((q) => !ALLOWED.includes(q)),
    ),
  ).toEqual([]);
});
