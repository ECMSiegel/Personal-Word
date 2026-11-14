import { test, expect, type Page } from "@playwright/test";
import { togglePageView } from "./pages-helpers";

// README screenshots (board task T318). Only runs with README_SHOTS=1:
//   README_SHOTS=1 PLAYWRIGHT_PORT=<port> npx playwright test tests/readme-shots.spec.ts --output test-results/T318
// Builds a demo project ("The Erie Canal and the Making of New York") through the app's own UI in the
// browser preview (isolated test storage, never a real project) and writes six PNGs, 1440 x 900 at
// device scale factor 2, into docs/evidence/readme/. No import("/src/...") in the page: it also runs
// against the built app. The colour for "Part two" is picked from the swatch row
// in the header's right-click menu.

const OUT = "docs/evidence/readme";
const TITLE = "The Erie Canal and the Making of New York";
const editor = (page: Page) => page.getByRole("textbox", { name: "Writing editor", exact: true });
const sidebar = (page: Page) => page.locator(".sidebar");
const groupTitle = (page: Page, name: string) =>
  page.locator(".group-title").filter({ hasText: new RegExp(`^${name}$`) });
const customHeader = (page: Page) =>
  page.locator('.sidebar-groups [data-group-kind="manuscript"]:not([data-group="manuscript"])');

const PROSE: Record<string, string[]> = {
  Introduction: [
    "In the autumn of 1825 a cannon was fired at Buffalo, and the sound was passed from gun to gun down the length of the Hudson until it reached New York harbor, some eighty minutes later. The signal announced that the Erie Canal was open. A ditch four feet deep and forty feet wide now joined Lake Erie to the Atlantic, and with it the farms of the interior to the wharves of Manhattan.",
    "This paper argues that the canal did more than lower the price of moving wheat. It changed which city the country looked to for credit, for news and for newcomers. Before 1825 New York was one port among several on the coast. Within a generation it was the first city of the continent, and the canal was the road it had been waiting for.",
    "The argument proceeds in four parts. The first describes how a state with no engineering school and little money built the longest canal in the world. The second follows the towns that grew up along the towpath. The third turns to the labor and the debts behind the project, and the last asks what the canal left New York when the railroads arrived.",
  ],
  "Building the Ditch": [
    "Digging began at Rome on the Fourth of July, 1817. The state had no trained canal engineers, so the first surveyors were judges and lawyers who learned the work by doing it, and the first miles taught them more than any book could. They invented a stump puller that let a few men clear trees from the right of way in a day, and they mixed a cement that hardened under water from local limestone.",
    "Most of the labor was done by hand, by farmers working through the slack months and, increasingly, by Irish immigrants who lived in camps beside the line. The hardest stretches were the swamps near Montezuma, where fever emptied the camps each summer, and the rock ridge at Lockport, where a flight of five double locks lifted boats sixty feet up the escarpment.",
    "Governor DeWitt Clinton, who had staked his career on the project, was mocked by opponents who called it Clinton's Ditch. The state borrowed the money itself after Congress and the banks of Philadelphia declined to help. When the last section opened, the whole canal ran three hundred and sixty-three miles from Albany to Buffalo and had cost about seven million dollars.",
  ],
  "Towns on the Towpath": [
    "Where the canal went, towns appeared. Rochester, a mill village of a few hundred in 1815, had more than nine thousand people by 1830 because its flour could now reach the seaboard. Syracuse grew around the salt works that shipped by water, and Buffalo, a burned village at the end of a lake, became a grain port overnight.",
    "Freight that had cost a hundred dollars a ton by wagon cost under ten by canal boat, and the trip from Buffalo to Albany shrank from weeks to about a week. Farmers sold into a larger market, and manufactured goods flowed back west. The canal also carried people: by one traveler's count the packet boats were crowded every day of the season.",
    "Life on the towpath had a rhythm of its own. Boys walked beside the mules for a few dollars a month, boat captains competed for the right of way at each lock, and a low bridge was a danger that every passenger learned to respect. The canal's own culture of songs, slang and rivalries spread far beyond the water.",
  ],
  Conclusion: [
    "The canal paid for itself within a decade. Tolls retired the state's debt ahead of schedule, and the surplus financed a widening of the channel that had to be started almost as soon as the first one was finished. For New York City the result was decisive: by 1840 more than half the nation's foreign trade passed through its harbor.",
    "The railroads soon took the passengers and then much of the freight, yet the canal route remained the best grade across the Appalachian barrier, and the rail lines followed it. The towns it made are still where it put them. The canal's lasting lesson may be that a public work, built carefully and paid for honestly, can change where a country's center of gravity lies.",
  ],
  "Immigration and Labor": [
    "Between 1817 and 1825 thousands of laborers, many of them newly arrived from Ireland, worked on the canal for about eighty cents a day and a ration of whiskey. When the work was done, many stayed in the new towns along the line and became their first large working class.",
    "Their story is harder to document than the engineers', because few of them wrote anything down. Payrolls, church registers and the occasional newspaper complaint are what remains, and they are used here with care.",
  ],
  "Taxes and Tolls": [
    "The state's decision to borrow rather than wait for federal help tied the canal to the credit of New York. Bonds sold in London and in the new money market on Wall Street funded the work, and the tolls that followed repaid them.",
    "That arrangement made the canal an unusual thing in its day: a public project that was expected to earn its keep, and did.",
  ],
};

const SOURCES = [
  {
    id: "ellison-1927",
    type: "book",
    title: "The Long Ditch: Building the Erie Canal",
    author: [{ given: "Margaret", family: "Ellison" }],
    publisher: "Hudson River Press",
    "publisher-place": "Albany",
    issued: { "date-parts": [[1927]] },
  },
  {
    id: "lindqvist-1961",
    type: "article-journal",
    title: "Tolls and Debt: Financing the Erie Canal",
    author: [{ given: "Anders", family: "Lindqvist" }],
    "container-title": "Journal of Early Republic Economics",
    volume: "14",
    issue: "2",
    page: "112-139",
    issued: { "date-parts": [[1961]] },
  },
  {
    id: "state-1826",
    type: "book",
    title: "Report of the Canal Commissioners of the State of New York",
    author: [{ literal: "New York State Canal Commission" }],
    publisher: "E. and E. Hosford",
    "publisher-place": "Albany",
    issued: { "date-parts": [[1826]] },
  },
];

async function settle(page: Page) {
  await page.waitForFunction(() =>
    document.getAnimations().every((a) => a.playState !== "running" && a.playState !== "pending"),
  );
  await page.waitForTimeout(200);
}

/** Moves the pointer onto plain page background and takes the PNG: no hover, tooltip or open menu. */
async function shot(page: Page, name: string, clip?: { x: number; y: number; width: number; height: number }) {
  await page.keyboard.press("Escape");
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur()); // no focus ring on a sidebar row
  await page.mouse.move(720, 899);
  await settle(page);
  await page.screenshot({ path: `${OUT}/${name}.png`, clip });
}

async function addNamed(page: Page, button: string, title: string) {
  await page.getByRole("button", { name: button, exact: true }).first().click();
  await page.getByLabel("Title", { exact: true }).fill(title);
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
}

async function write(page: Page, paragraphs: string[]) {
  await editor(page).click();
  for (const [i, text] of paragraphs.entries()) {
    if (i) await page.keyboard.press("Enter");
    await page.keyboard.insertText(text);
  }
}

/** Caret at the very end of the last paragraph (a click at its last line's right edge, then End). */
async function endOfText(page: Page) {
  const last = editor(page).locator("p").last();
  const box = (await last.boundingBox())!;
  await page.mouse.click(box.x + box.width - 2, box.y + box.height - 4);
  await page.keyboard.press("End");
}

const row = (page: Page, title: string) =>
  sidebar(page).locator(".entry-row .entry-main").filter({ hasText: new RegExp(`^${title}`) });

async function openRow(page: Page, title: string) {
  await row(page, title).first().click();
  await expect(editor(page)).toBeVisible();
}

/** Opens `title` in a second pane through the row's own "Open beside" button. */
async function openBeside(page: Page, title: string) {
  await row(page, title).first().hover();
  await page.getByRole("button", { name: `Open ${title} beside` }).click();
  await expect(page.locator(".split-pane")).toHaveCount(2);
}

async function setHeaderColour(page: Page, colour: string) {
  await customHeader(page).locator(".group-title").click({ button: "right" });
  const menu = page.getByRole("menu");
  await expect(menu).toBeVisible();
  // The header's right-click menu ends with a row of colour swatches (group "Colour").
  const swatch = menu.getByRole("group", { name: "Colour", exact: true })
    .getByRole("menuitemradio", { name: colour, exact: true });
  await swatch.click();
  await expect(menu).toHaveCount(0);
  await expect(customHeader(page)).toHaveAttribute("data-tint", colour.toLowerCase());
}

async function makeSection(page: Page, name: string) {
  await addNamed(page, "New section", name);
  await write(page, PROSE[name]);
}

test.describe("README screenshots", () => {
  test.skip(!process.env.README_SHOTS, "README screenshots: run with README_SHOTS=1");
  test.use({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 2,
    reducedMotion: "reduce",
    colorScheme: "light",
  });

  test("demo project and the six images", async ({ page }) => {
    test.setTimeout(300_000);
    await page.addInitScript(() => {
      localStorage.setItem("personal-word.restoreTabs", "true");
      localStorage.setItem(
        "folio.workspace.appearance",
        JSON.stringify({ theme: "system", palette: "color", sections: { manuscript: "blue", fragments: "green", research: "orange" } }),
      );
    });
    await page.goto("/");

    // Two other projects first, so the library has a few rows and the demo sorts on top.
    for (const other of ["Harbor Stories", "Lecture Notes: American History"]) {
      await page.getByRole("button", { name: "Start new project" }).click();
      await page.getByRole("button", { name: "Blank", exact: true }).click();
      await page.getByLabel("Project title").fill(other);
      await page.getByRole("button", { name: "Save", exact: true }).click();
      await expect(editor(page)).toBeVisible();
      await write(page, ["Notes for the first meeting."]);
      await expect(page.getByText("Saved", { exact: true })).toBeVisible({ timeout: 10_000 });
      await page.getByRole("button", { name: "Projects", exact: true }).click();
    }

    // The demo project.
    await page.getByRole("button", { name: "Start new project" }).click();
    await page.getByRole("button", { name: "Blank", exact: true }).click();
    await page.getByLabel("Project title").fill(TITLE);
    await page.getByRole("button", { name: "Save", exact: true }).click();
    await expect(editor(page)).toBeVisible();

    // The first section becomes the Introduction.
    await page.getByRole("button", { name: "Rename section" }).click();
    await page.keyboard.press("ControlOrMeta+a");
    await page.keyboard.type("Introduction");
    await page.keyboard.press("Enter");
    await expect(page.getByRole("button", { name: "Rename section" })).toHaveText("Introduction");
    await write(page, PROSE.Introduction);

    await makeSection(page, "Building the Ditch");
    await makeSection(page, "Towns on the Towpath");
    await makeSection(page, "Conclusion");

    // Two fragments, kept from a scratch paragraph at the end of the Conclusion.
    for (const text of [
      "An early draft opened with the cannons along the Hudson, but the paragraph read like a postcard.",
      "A possible aside on the packet-boat songs; it needs a real citation before it can stay.",
    ]) {
      await endOfText(page);
      await page.keyboard.press("Enter");
      await page.keyboard.insertText(text);
      await editor(page).locator("p").last().click({ clickCount: 3 });
      await page.getByRole("button", { name: "Keep as fragment" }).click();
    }
    await expect(groupTitle(page, "Fragments")).toBeVisible();

    // A custom header with a colour, and two sections inside it.
    await addNamed(page, "Add header", "Part two");
    await addNamed(page, "New section in Part two", "Immigration and Labor");
    await write(page, PROSE["Immigration and Labor"]);
    await addNamed(page, "New section in Part two", "Taxes and Tolls");
    await write(page, PROSE["Taxes and Tolls"]);
    await setHeaderColour(page, "Purple");

    // Sources imported from a Zotero export, one cited in Building the Ditch.
    await openRow(page, "Building the Ditch");
    await groupTitle(page, "Research").click();
    await expect(page.locator(".research-panel")).toBeVisible();
    await page.getByLabel("Zotero CSL JSON file").setInputFiles({
      name: "sources.json",
      mimeType: "application/json",
      buffer: Buffer.from(JSON.stringify(SOURCES)),
    });
    await expect(page.getByRole("dialog", { name: "Import Zotero sources" })).toBeVisible();
    await page.getByRole("button", { name: "Add sources", exact: true }).click();
    await expect(page.locator(".source-item")).toHaveCount(3);
    const toast = page.getByText("Selected sources added.", { exact: true });
    await toast.locator("xpath=..").getByRole("button").click();
    await expect(toast).toHaveCount(0);

    await endOfText(page);
    await page.locator(".source-item", { hasText: "The Long Ditch" }).locator(".source-toggle").click();
    await page.getByRole("button", { name: "Cite here", exact: true }).click();
    await expect(editor(page).locator("[data-footnote-id]")).toHaveCount(1);
    await expect(page.getByText("Saved", { exact: true })).toBeVisible({ timeout: 10_000 });

    // One pane with the sidebar and the coloured headers.
    await openRow(page, "Towns on the Towpath");
    await shot(page, "writing-light");

    // Research beside the draft.
    await openRow(page, "Building the Ditch");
    await groupTitle(page, "Research").click();
    await expect(page.locator(".research-panel")).toBeVisible();
    await page.locator(".source-item", { hasText: "The Long Ditch" }).locator(".source-toggle").click();
    await shot(page, "research-light");

    // Page view in dark mode.
    await groupTitle(page, "Research").click();
    await openRow(page, "Introduction");
    await togglePageView(page);
    await page.emulateMedia({ colorScheme: "dark" });
    await shot(page, "writing-dark");
    await page.emulateMedia({ colorScheme: "light" });
    await togglePageView(page);

    // Settings, General: appearance, palette, interface font and sidebar options.
    await page.getByRole("button", { name: "Settings", exact: true }).click();
    await expect(page.locator(".project-settings .settings-nav")).toBeVisible();
    await shot(page, "customise-light");

    // The Projects library.
    await page.getByRole("button", { name: "Projects", exact: true }).click();
    await expect(page.getByRole("button", { name: "Start new project" })).toBeVisible();
    // Cropped above the browser-preview footnote line, which is a test-build artefact.
    await shot(page, "projects-light", { x: 0, y: 0, width: 1440, height: 400 });

    // Hero, last because a split stays open: two sections side by side, sidebar docked, Color palette.
    await page.getByText(/^The Erie Canal and the Ma/).first().click();
    await openRow(page, "Building the Ditch");
    await openBeside(page, "Towns on the Towpath");
    await expect(page.getByText("Saved", { exact: true })).toBeVisible({ timeout: 10_000 });
    await shot(page, "split-light");
  });
});
