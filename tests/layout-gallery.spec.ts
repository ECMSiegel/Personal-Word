import { test, expect, type Page } from "@playwright/test";
import { ink, openProjectWithEntry } from "./layout-helpers";
import { togglePageView } from "./pages-helpers";

// Layout-primitives screenshot gallery (plan T0 step 6). Only runs with GALLERY=1:
//   GALLERY=1 PLAYWRIGHT_PORT=<port> npx playwright test tests/layout-gallery.spec.ts --output test-results/<T>
// Writes test-results/layout-gallery/<name>-<theme>.png (1440 x 900, light and dark). The "before"
// set is in docs/agent-work/2026-11-12-layout-primitives/gallery/before/; copy a later run to
// gallery/after/. Isolated browser storage only: every project is created through the app's UI.

const OUT = "test-results/layout-gallery";
const editor = (page: Page) => page.getByRole("textbox", { name: "Writing editor" });
const sidebar = (page: Page) => page.locator(".sidebar");
const groupTitle = (page: Page, name: string) =>
  page.locator(".group-title").filter({ hasText: new RegExp(`^${name}$`) });

async function settle(page: Page) {
  await page.waitForFunction(() =>
    document.getAnimations().every((a) => a.playState !== "running" && a.playState !== "pending"),
  );
  await page.waitForTimeout(150);
}

async function shot(page: Page, name: string, theme: string) {
  await settle(page);
  await page.screenshot({ path: `${OUT}/${name}-${theme}.png` });
}

/** Clicks an add button; fills the name dialog when one opens. */
async function addNamed(page: Page, button: string, title: string) {
  await page.getByRole("button", { name: button, exact: true }).first().click();
  const dialog = page.getByRole("dialog");
  if (await dialog.waitFor({ timeout: 2000 }).then(() => true, () => false)) {
    await page.getByLabel("Title", { exact: true }).fill(title);
    await page.getByRole("button", { name: "Save", exact: true }).click();
    await expect(dialog).toHaveCount(0);
  }
}

/** A project with three Manuscript sections and one custom top-level section ("Part two"). */
async function richProject(page: Page) {
  await openProjectWithEntry(page, "Gallery project");
  await addNamed(page, "New section", "Chapter two");
  await editor(page).fill("The second chapter begins here.");
  await addNamed(page, "New section", "Chapter three");
  await addNamed(page, "Add header", "Part two");
  await addNamed(page, "New section in Part two", "Interlude");
  await editor(page).fill("An interlude between the parts.");
  await expect(page.getByText("Saved", { exact: true })).toBeVisible({ timeout: 10_000 });
}

type Surface = { name: string; run: (page: Page) => Promise<void> };

const SURFACES: Surface[] = [
  {
    name: "projects",
    run: async (page) => {
      await openProjectWithEntry(page, "Gallery project");
      await page.getByRole("button", { name: "Projects", exact: true }).click();
      await expect(page.getByRole("button", { name: "Start new project" })).toBeVisible();
    },
  },
  {
    name: "new-project-menu",
    run: async (page) => {
      await page.goto("/");
      await page.getByRole("button", { name: "Start new project" }).click();
      await expect(page.getByRole("button", { name: "Blank", exact: true })).toBeVisible();
    },
  },
  { name: "editor-sidebar", run: richProject },
  {
    name: "sidebar-cards",
    run: async (page) => {
      await richProject(page);
      await sidebar(page).locator('.sidebar-group[data-group="manuscript"] > .group-heading').hover();
      await sidebar(page).getByRole("button", { name: "Show Manuscript cards" }).click();
    },
  },
  {
    name: "heading-context-menu",
    run: async (page) => {
      await richProject(page);
      await page.locator('.sidebar-groups [data-group="manuscript"] .group-title').click({ button: "right" });
      await expect(page.getByRole("menu")).toBeVisible();
    },
  },
  {
    name: "entry-context-menu",
    run: async (page) => {
      await richProject(page);
      await sidebar(page).locator(".entry-main").first().click({ button: "right" });
      await expect(page.getByRole("menu")).toBeVisible();
    },
  },
  {
    name: "export-menu",
    run: async (page) => {
      await openProjectWithEntry(page, "Gallery project");
      await page.locator(".topbar").getByRole("button", { name: "Export", exact: true }).click();
      await expect(page.getByRole("menu", { name: "Export" })).toBeVisible();
    },
  },
  ...[
    ["popover-zoom", "Editor zoom"],
    ["popover-paragraph-style", "Paragraph style"],
    ["popover-font", "Font family"],
    ["popover-line-spacing", "Line and paragraph spacing"],
    ["popover-page-setup", "Page setup"],
    ["popover-prose-check", "Prose check"],
  ].map(
    ([name, button]): Surface => ({
      name,
      run: async (page) => {
        await openProjectWithEntry(page, "Gallery project");
        await page.getByRole("button", { name: button, exact: true }).click();
      },
    }),
  ),
  {
    name: "popover-table-controls",
    run: async (page) => {
      await openProjectWithEntry(page, "Gallery project");
      await page.getByRole("button", { name: "Insert table", exact: true }).click();
      await page.getByRole("button", { name: "Table controls", exact: true }).click();
    },
  },
  {
    name: "more-formatting-narrow",
    run: async (page) => {
      await page.setViewportSize({ width: 1000, height: 900 });
      await openProjectWithEntry(page, "Gallery project");
      await page.getByRole("button", { name: "More formatting", exact: true }).click();
    },
  },
  {
    name: "command-palette",
    run: async (page) => {
      await openProjectWithEntry(page, "Gallery project");
      await editor(page).click();
      await page.keyboard.press("ControlOrMeta+Shift+P");
      await expect(page.getByRole("dialog", { name: "Command palette" })).toBeVisible();
    },
  },
  {
    name: "settings-general",
    run: async (page) => {
      await openProjectWithEntry(page, "Gallery project");
      await page.getByRole("button", { name: "Settings", exact: true }).click();
      await expect(page.locator(".project-settings .settings-nav")).toBeVisible();
    },
  },
  {
    name: "settings-appearance",
    run: async (page) => {
      await openProjectWithEntry(page, "Gallery project");
      await page.getByRole("button", { name: "Settings", exact: true }).click();
      // Appearance lives in General; Color shows its Section colours row (test storage only).
      await page.locator(".project-settings").getByRole("radio", { name: "Color", exact: true }).or(
        page.locator(".project-settings").getByRole("button", { name: "Color", exact: true }),
      ).first().click();
      await expect(page.locator("html")).toHaveAttribute("data-palette", "color");
    },
  },
  {
    name: "name-dialog",
    run: async (page) => {
      await openProjectWithEntry(page, "Gallery project");
      await page.getByRole("button", { name: "Add header", exact: true }).click();
      await expect(page.getByRole("dialog")).toBeVisible();
    },
  },
  {
    name: "comments-panel",
    run: async (page) => {
      await openProjectWithEntry(page, "Gallery project");
      await groupTitle(page, "Comments").click();
    },
  },
  {
    name: "research-source",
    run: async (page) => {
      await openProjectWithEntry(page, "Gallery project");
      await groupTitle(page, "Research").click();
      await expect(page.locator(".research-panel")).toBeVisible();
      await page.getByRole("button", { name: "Enter manually" }).click();
      await page.getByLabel("Title", { exact: true }).fill("Interior Chinatown");
      await page.getByLabel("Authors", { exact: true }).fill("Charles Yu");
      await page.getByLabel("Publisher", { exact: true }).fill("Pantheon Books");
      await page.getByLabel("Year", { exact: true }).fill("2020");
    },
  },
  {
    name: "fragments-panel",
    run: async (page) => {
      await openProjectWithEntry(page, "Gallery project");
      await editor(page).press("ControlOrMeta+a");
      await page.getByRole("button", { name: "Keep as fragment" }).click();
      await groupTitle(page, "Fragments").click();
      await expect(page.locator(".fragment-library")).toBeVisible();
    },
  },
  {
    name: "read-manuscript",
    run: async (page) => {
      await richProject(page);
      await page.getByRole("button", { name: "Read manuscript", exact: true }).click();
    },
  },
  {
    name: "split-view",
    run: async (page) => {
      await richProject(page);
      await sidebar(page).locator(".entry-main", { hasText: "Chapter two" }).hover();
      await page.getByRole("button", { name: "Open Chapter two beside" }).click();
      await expect(page.locator(".split-pane")).toHaveCount(2);
    },
  },
  {
    name: "floating-sidebar",
    run: async (page) => {
      await page.addInitScript(() => {
        let saved: Record<string, unknown> = {};
        try {
          saved = JSON.parse(localStorage.getItem("folio.workspace.sidebar") ?? "{}") ?? {};
        } catch {
          saved = {};
        }
        localStorage.setItem("folio.workspace.sidebar", JSON.stringify({ ...saved, floating: true }));
      });
      await richProject(page);
      await togglePageView(page);
      await expect(page.locator(".sidebar-shell")).toHaveClass(/is-floating/);
    },
  },
];

test.describe("layout gallery", () => {
  test.skip(!process.env.GALLERY, "screenshot gallery: run with GALLERY=1");
  test.use({ viewport: { width: 1440, height: 900 }, reducedMotion: "reduce" });

  test("ink() measures drawn text and icons inside their boxes", async ({ page }) => {
    await richProject(page);
    for (const target of [
      sidebar(page).locator(".entry-main").first(),
      sidebar(page).locator(".entry-main svg").first(),
      page.locator(".topbar").getByRole("button", { name: "Export", exact: true }),
    ]) {
      const box = (await target.boundingBox())!;
      const i = await ink(target);
      expect(i.right - i.left).toBeGreaterThan(0);
      expect(i.bottom - i.top).toBeGreaterThan(0);
      expect(i.left).toBeGreaterThanOrEqual(box.x - 0.5);
      expect(i.right).toBeLessThanOrEqual(box.x + box.width + 0.5);
      expect(i.top).toBeGreaterThanOrEqual(box.y - 0.5);
      expect(i.bottom).toBeLessThanOrEqual(box.y + box.height + 0.5);
    }
  });

  for (const theme of ["light", "dark"] as const) {
    test.describe(theme, () => {
      test.use({ colorScheme: theme });
      for (const surface of SURFACES) {
        test(`${surface.name} (${theme})`, async ({ page }) => {
          await surface.run(page);
          await shot(page, surface.name, theme);
        });
      }
    });
  }
});
