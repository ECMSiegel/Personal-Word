import { test, expect, type Page } from "@playwright/test";

const words = (prefix: string, count: number) =>
  Array.from({ length: count }, (_, i) => `${prefix}${i + 1}`).join(" ");

async function create(page: Page, title: string) {
  await page.getByRole("button", { name: "Start new project" }).click();
  await page.getByRole("button", { name: "Blank", exact: true }).click();
  await page.getByLabel("Project title").fill(title);
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(
    page.getByRole("textbox", { name: "Writing editor" }),
  ).toBeVisible();
}

async function keepAsFragment(page: Page, text: string) {
  const editor = page.getByRole("textbox", { name: "Writing editor" });
  await editor.fill(text);
  await editor.press("ControlOrMeta+a");
  await page.getByRole("button", { name: "Keep as fragment" }).click();
  await expect(editor).not.toContainText(text.split(" ")[0]);
}

async function openFragments(page: Page) {
  await page
    .locator(".group-title")
    .filter({ hasText: /^Fragments$/ })
    .click();
  await expect(page.locator(".fragment-library")).toBeVisible();
}

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/");
});

test("fragments panel shows the whole fragment, a count, and search", async ({
  page,
}) => {
  await create(page, "Fragments panel");
  await keepAsFragment(page, words("alpha", 200));
  await openFragments(page);

  await expect(page.locator(".fragment-count")).toHaveText("1 fragment");
  const text = page.locator(".fragment-library .fragment-text").first();
  await expect(text).toContainText("alpha1 ");
  await expect(text).toContainText("alpha200");
  expect(
    await text.evaluate((node) => getComputedStyle(node).webkitLineClamp),
  ).toBe("none");
  await expect(page.locator(".fragment-library .fragment-body")).not.toHaveClass(
    /is-collapsed/,
  );
  await expect(page.getByRole("button", { name: "Show all" })).toHaveCount(0);

  const search = page.getByRole("textbox", { name: "Search fragments" });
  await search.fill("alpha200");
  await expect(page.locator(".fragment-count")).toHaveText("1 fragment");
  await search.fill("nothing like this");
  await expect(page.locator(".fragment-count")).toHaveText("0 fragments");
  await expect(page.locator(".fragment-empty")).toContainText(
    "No fragments match “nothing like this”.",
  );
  await search.fill("");
  await expect(page.locator(".fragment-count")).toHaveText("1 fragment");
});

test("empty library explains how to make a fragment", async ({ page }) => {
  await create(page, "Empty fragments");
  await openFragments(page);
  await expect(page.locator(".fragment-count")).toHaveText("0 fragments");
  await expect(page.locator(".fragment-empty")).toContainText(
    "No fragments yet. Select text in a section and choose Keep as fragment",
  );
});

test("more than three fragments start collapsed and Show all expands one", async ({
  page,
}) => {
  await create(page, "Many fragments");
  for (let i = 1; i <= 4; i++)
    await keepAsFragment(page, `Fragment ${i} ` + words(`item${i}w`, 120));
  await openFragments(page);

  await expect(page.locator(".fragment-count")).toHaveText("4 fragments");
  const items = page.locator(".fragment-item");
  await expect(items).toHaveCount(4);
  const first = items.first();
  await expect(first.locator(".fragment-body")).toHaveClass(/is-collapsed/);
  await expect(first.getByRole("button", { name: "Show all" })).toBeVisible();
  await expect(first.locator(".fragment-icon").first()).toHaveAttribute(
    "aria-expanded",
    "false",
  );
  await first.getByRole("button", { name: "Show all" }).click();
  await expect(first.locator(".fragment-body")).not.toHaveClass(/is-collapsed/);
  await expect(first.locator(".fragment-icon").first()).toHaveAttribute(
    "aria-expanded",
    "true",
  );
  await expect(first.locator(".fragment-text")).toContainText("item1w120");
});

// The next two tests depend on the App wiring the new FragmentLibrary props
// (onEdit, onInsert, activeId). They fail until the integrator passes them.
test("insert at cursor puts the whole fragment into the main editor (needs App wiring)", async ({
  page,
}) => {
  await create(page, "Insert fragment");
  await keepAsFragment(page, words("gamma", 200));
  await openFragments(page);
  const insert = page.getByRole("button", {
    name: /Insert .* at cursor/,
  });
  await expect(insert).toBeVisible();
  const editor = page.getByRole("textbox", { name: "Writing editor" });
  await editor.click();
  await insert.click();
  await expect(editor).toContainText("gamma200");
});

test("inline edits in the panel are saved to the fragment (needs App wiring)", async ({
  page,
}) => {
  await create(page, "Inline fragment");
  await keepAsFragment(page, "Original fragment words.");
  await openFragments(page);
  const text = page.getByRole("textbox", {
    name: "Fragment text: Original fragment words.",
  });
  await text.click();
  await page.keyboard.press("End");
  await page.keyboard.type(" Edited inline.");
  await expect(text).toContainText("Edited inline.");
  await page.getByRole("button", { name: "Close fragment library" }).click();
  await openFragments(page);
  await expect(
    page.locator(".fragment-library .fragment-text").first(),
  ).toContainText("Edited inline.");
});

// "Give these words a home" belongs to the unsplit fragment view only; a
// fragment shown in either split pane carries no restore strip.
test("restore strip shows for an unsplit fragment, never in a split pane", async ({
  page,
}) => {
  await create(page, "Restore strip");
  await keepAsFragment(page, words("delta", 40));
  const strip = page.getByText("Give these words a home");
  const append = page.getByRole("button", { name: "Append to section" });

  // Unsplit: opened from the Fragments panel into the main pane.
  await openFragments(page);
  await page.getByRole("button", { name: "Open in editor" }).click();
  await expect(strip).toHaveCount(1);
  await expect(append).toHaveCount(1);

  // Right pane: the same fragment opened beside the first section.
  await page.locator(".sidebar .entry-main").filter({ hasText: /^Opening/ }).click();
  await expect(strip).toHaveCount(0);
  await page.getByRole("button", { name: /^Open delta1 .* beside$/ }).click({ force: true });
  await expect(page.locator(".split-pane")).toHaveCount(2);
  await expect(strip).toHaveCount(0);
  await expect(append).toHaveCount(0);

  // Left pane: focus it and open the fragment there; still no strip.
  await page.getByRole("textbox", { name: "Writing editor", exact: true }).click();
  await page.locator(".sidebar .entry-main").filter({ hasText: /^delta1/ }).click();
  await expect(page.locator(".split-pane")).toHaveCount(2);
  await expect(strip).toHaveCount(0);
  await expect(append).toHaveCount(0);
});
