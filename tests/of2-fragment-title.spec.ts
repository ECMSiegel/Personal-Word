import { test, expect, type Page } from "@playwright/test";
import { create, para, seedBlocks, settle, togglePageView } from "./pages-helpers";

// OF2 (T285, owner report 2026-11-11, docs/agent-work/2026-11-11-owner-fixes/):
// with "Floating sidebar and research" on, the project title and the sidebar's
// top edge must not move when a fragment is open (the "Kept from" strip shows).
// Setup copied from tests/floating.spec.ts.

type Pos = { titleX: number; titleY: number; sidebarTop: number; sidebarLeft: number; originShown: boolean; bgBehindTitle: string; bgBelowSearch: string };

function seedFloating(page: Page) {
  return page.addInitScript(() => {
    localStorage.setItem("personal-word.restoreTabs", "true");
    let saved: Record<string, unknown> = {};
    try {
      saved = JSON.parse(localStorage.getItem("folio.workspace.sidebar") ?? "{}") ?? {};
    } catch {
      saved = {};
    }
    localStorage.setItem("folio.workspace.sidebar", JSON.stringify({ ...saved, floating: true }));
  });
}

async function setPaged(page: Page, paged: boolean) {
  if ((await page.locator(".is-paged").count() > 0) !== paged) await togglePageView(page);
  await expect(page.locator(".is-paged")).toHaveCount(paged ? 1 : 0);
  await settle(page);
}

const measure = (page: Page) =>
  page.evaluate((): Pos => {
    const title = document.querySelector(".sidebar-title-row")?.getBoundingClientRect();
    const side = document.querySelector("aside.sidebar")?.getBoundingClientRect();
    if (!title || !side) throw new Error("missing sidebar title or aside");
    // The first painted background under a point, so a white strip over the grey area shows up.
    const paintedAt = (x: number, y: number) => {
      for (let el = document.elementFromPoint(x, y); el; el = el.parentElement) {
        const c = getComputedStyle(el).backgroundColor;
        if (c !== "rgba(0, 0, 0, 0)" && c !== "transparent") return c;
      }
      return "none";
    };
    const mid = Math.round(window.innerWidth / 2);
    return {
      bgBehindTitle: paintedAt(mid - 400, title.top + title.height / 2),
      bgBelowSearch: paintedAt(mid - 400, title.bottom + 60),
      titleX: title.left,
      titleY: title.top,
      sidebarTop: side.top,
      sidebarLeft: side.left,
      originShown: !!document.querySelector(".origin"),
    };
  });

test.describe("OF2 floating title", () => {
  test.use({ viewport: { width: 1600, height: 900 } });

  test("the title sits in the same place in a section and in a fragment", async ({ page }) => {
    await seedFloating(page);
    await create(page, "OF2 title");
    await setPaged(page, true);
    await expect(page.locator(".sidebar-shell")).toHaveClass(/is-floating/);
    await seedBlocks(page, [para("Angela is my best friend"), para("I love her a lot")]);
    await settle(page);

    const section = await measure(page);
    expect(section.originShown).toBe(false);

    // Keep the selected text as a fragment: the new fragment opens with the "Kept from" strip.
    await page.locator(".ProseMirror").first().click();
    await page.keyboard.press("ControlOrMeta+a");
    await page.getByRole("button", { name: "Keep as fragment", exact: true }).click();
    await page.locator("aside.sidebar").getByText("Angela is my best friend").first().click();
    await expect(page.locator(".origin")).toBeVisible();
    await settle(page);
    const fragment = await measure(page);

    console.log("OF2 section", JSON.stringify(section));
    console.log("OF2 fragment", JSON.stringify(fragment));
    expect(fragment.originShown).toBe(true);
    expect(fragment.bgBehindTitle, "painted background behind the title row").toBe(section.bgBehindTitle);
    expect(Math.abs(fragment.titleX - section.titleX), `title x: section ${section.titleX} fragment ${fragment.titleX}`).toBeLessThanOrEqual(0.5);
    expect(Math.abs(fragment.titleY - section.titleY), `title y: section ${section.titleY} fragment ${fragment.titleY}`).toBeLessThanOrEqual(0.5);
    expect(Math.abs(fragment.sidebarTop - section.sidebarTop), `sidebar top: section ${section.sidebarTop} fragment ${fragment.sidebarTop}`).toBeLessThanOrEqual(0.5);
  });
});
