import { test, expect, type Page } from "@playwright/test";

test.use({ viewport: { width: 1280, height: 800 } });

async function createProject(page: Page, title: string) {
  await page.getByRole("button", { name: "Start new project" }).click();
  await page.getByRole("button", { name: "Blank", exact: true }).click();
  await page.getByLabel("Project title").fill(title);
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.locator(".save-status")).toHaveText("Saved");
}

async function waitForSave(page: Page) {
  await expect(page.locator(".save-status")).toHaveText("Saved");
}

async function toolbarButton(page: Page, name: string) {
  const button = page.getByRole("button", { name, exact: true });
  if (!(await button.isVisible())) {
    await page.getByRole("button", { name: "More formatting", exact: true }).click();
  }
  await expect(button).toBeVisible();
  return button;
}

async function insertTable(page: Page) {
  await (await toolbarButton(page, "Insert table")).click();
}

test("table insertion creates a 3x3 table with header row and places focus in the first cell", async ({
  page,
}) => {
  await page.addInitScript(() =>
    localStorage.setItem("personal-word.restoreTabs", "true"),
  );
  await page.goto("/");
  await createProject(page, "Table Insertion Test");

  const editor = page.getByRole("textbox", { name: "Writing editor" });
  await expect(editor).toBeVisible();

  await insertTable(page);

  const table = editor.locator("table");
  await expect(table).toBeVisible();
  await expect(table.locator("tr")).toHaveCount(3);
  await expect(table.locator("tr").first().locator("th")).toHaveCount(3);
  await expect(table.locator("tr").nth(1).locator("td")).toHaveCount(3);
  await expect(table.locator("tr").nth(2).locator("td")).toHaveCount(3);
  await expect(table.locator("th, td")).toHaveCount(9);

  await editor.pressSequentially("Header 1");
  await expect(table.locator("th").first()).toHaveText("Header 1");
});

test("editing text inside cells across multiple rows and columns updates table contents", async ({
  page,
}) => {
  await page.addInitScript(() =>
    localStorage.setItem("personal-word.restoreTabs", "true"),
  );
  await page.goto("/");
  await createProject(page, "Table Editing Test");

  const editor = page.getByRole("textbox", { name: "Writing editor" });
  await expect(editor).toBeVisible();

  await insertTable(page);
  const table = editor.locator("table");
  await expect(table).toBeVisible();

  // Populate header row
  await editor.pressSequentially("Product");
  await page.keyboard.press("Tab");
  await editor.pressSequentially("Qty");
  await page.keyboard.press("Tab");
  await editor.pressSequentially("Price");

  // Populate row 2
  await page.keyboard.press("Tab");
  await editor.pressSequentially("Paper");
  await page.keyboard.press("Tab");
  await editor.pressSequentially("10");
  await page.keyboard.press("Tab");
  await editor.pressSequentially("$5");

  // Populate row 3
  await page.keyboard.press("Tab");
  await editor.pressSequentially("Ink");
  await page.keyboard.press("Tab");
  await editor.pressSequentially("2");
  await page.keyboard.press("Tab");
  await editor.pressSequentially("$25");

  // Direct click to edit row 2 col 2
  await table.locator("tr").nth(1).locator("td").nth(1).click();
  await editor.pressSequentially("0");

  await expect(table.locator("th").nth(0)).toHaveText("Product");
  await expect(table.locator("th").nth(1)).toHaveText("Qty");
  await expect(table.locator("th").nth(2)).toHaveText("Price");
  await expect(table.locator("tr").nth(1).locator("td").nth(0)).toHaveText(
    "Paper",
  );
  await expect(table.locator("tr").nth(1).locator("td").nth(1)).toHaveText(
    "100",
  );
  await expect(table.locator("tr").nth(1).locator("td").nth(2)).toHaveText(
    "$5",
  );
  await expect(table.locator("tr").nth(2).locator("td").nth(0)).toHaveText(
    "Ink",
  );
  await expect(table.locator("tr").nth(2).locator("td").nth(1)).toHaveText("2");
  await expect(table.locator("tr").nth(2).locator("td").nth(2)).toHaveText(
    "$25",
  );
});

test("keyboard navigation traverses table cells forward with Tab and backward with Shift-Tab across row boundaries", async ({
  page,
}) => {
  await page.addInitScript(() =>
    localStorage.setItem("personal-word.restoreTabs", "true"),
  );
  await page.goto("/");
  await createProject(page, "Table Navigation Test");

  const editor = page.getByRole("textbox", { name: "Writing editor" });
  await expect(editor).toBeVisible();

  await insertTable(page);
  const table = editor.locator("table");
  await expect(table).toBeVisible();

  // Click th 2
  await table.locator("th").nth(1).click();
  await page.keyboard.press("Tab");
  await editor.pressSequentially("H3");

  // Tab across row boundary
  await page.keyboard.press("Tab");
  await editor.pressSequentially("R1C1");

  // Shift-Tab back across row boundary
  await page.keyboard.press("Shift+Tab");
  await editor.pressSequentially("!");

  // Shift-Tab twice back to th 1
  await page.keyboard.press("Shift+Tab");
  await page.keyboard.press("Shift+Tab");
  await editor.pressSequentially("H1");

  await expect(table.locator("th").nth(0)).toHaveText("H1");
  await expect(table.locator("th").nth(2)).toHaveText("H3!");
  await expect(table.locator("tr").nth(1).locator("td").nth(0)).toHaveText(
    "R1C1",
  );
});

test("table manipulation controls insert and delete rows, columns, toggle header row, and delete table", async ({
  page,
}) => {
  await page.addInitScript(() =>
    localStorage.setItem("personal-word.restoreTabs", "true"),
  );
  await page.goto("/");
  await createProject(page, "Table Controls Test");

  const editor = page.getByRole("textbox", { name: "Writing editor" });
  await expect(editor).toBeVisible();

  await insertTable(page);
  const table = editor.locator("table");
  await expect(table).toBeVisible();

  // Focus inside a cell to activate table controls
  await table.locator("td").first().click();

  // The project title contains "Table controls" as a substring, so the
  // trigger must be matched exactly. The panel stays open after each
  // command (only Delete table closes it), so it is opened once here.
  await (await toolbarButton(page, "Table controls")).click();

  // Add row (panel already open)
  await page.getByRole("button", { name: /Add row below|Insert row/i }).click();
  await expect(table.locator("tr")).toHaveCount(4);

  // Delete row
  await page.getByRole("button", { name: /Delete row/i }).click();
  await expect(table.locator("tr")).toHaveCount(3);

  // Add column
  await page
    .getByRole("button", { name: /Add column after|Insert column/i })
    .click();
  await expect(table.locator("tr").first().locator("th, td")).toHaveCount(4);
  await expect(table.locator("tr").nth(1).locator("td")).toHaveCount(4);

  // Delete column
  await page.getByRole("button", { name: /Delete column/i }).click();
  await expect(table.locator("tr").first().locator("th, td")).toHaveCount(3);

  // Toggle header row
  await page.getByRole("button", { name: /Toggle header row/i }).click();
  await expect(table.locator("th")).toHaveCount(0);
  await expect(table.locator("td")).toHaveCount(9);

  // Toggle header row back
  await page.getByRole("button", { name: /Toggle header row/i }).click();
  await expect(table.locator("th")).toHaveCount(3);
  await expect(table.locator("td")).toHaveCount(6);

  // Delete table (this control also closes its own popover)
  await page.getByRole("button", { name: /Delete table/i }).click();
  await expect(table).toHaveCount(0);
});

test("table persists across reload in preview storage and remains editable", async ({
  page,
}) => {
  await page.addInitScript(() =>
    localStorage.setItem("personal-word.restoreTabs", "true"),
  );
  await page.goto("/");
  await createProject(page, "Table Persistence Test");

  const editor = page.getByRole("textbox", { name: "Writing editor" });
  await expect(editor).toBeVisible();

  await insertTable(page);
  const table = editor.locator("table");
  await expect(table).toBeVisible();

  await editor.pressSequentially("Col1");
  await page.keyboard.press("Tab");
  await editor.pressSequentially("Col2");
  await page.keyboard.press("Tab");
  await editor.pressSequentially("Col3");
  await page.keyboard.press("Tab");
  await editor.pressSequentially("Alpha");
  await page.keyboard.press("Tab");
  await editor.pressSequentially("Beta");
  await page.keyboard.press("Tab");
  await editor.pressSequentially("Gamma");

  await waitForSave(page);

  const storedTable = await page.evaluate(() => {
    const key = Object.keys(localStorage).find((k) =>
      k.startsWith("folio.preview.project."),
    );
    if (!key) return null;
    const p = JSON.parse(localStorage.getItem(key)!);
    const content = p.entries?.[0]?.content?.content ?? [];
    return content.find((n: any) => n.type === "table");
  });
  expect(storedTable).not.toBeNull();

  await page.reload();
  const reloadedEditor = page.getByRole("textbox", { name: "Writing editor" });
  await expect(reloadedEditor).toBeVisible();

  const reloadedTable = reloadedEditor.locator("table");
  await expect(reloadedTable).toBeVisible();
  await expect(reloadedTable.locator("tr")).toHaveCount(3);
  await expect(reloadedTable.locator("th").nth(0)).toHaveText("Col1");
  await expect(
    reloadedTable.locator("tr").nth(1).locator("td").nth(0),
  ).toHaveText("Alpha");

  // Edit after reload
  await reloadedTable.locator("tr").nth(1).locator("td").nth(0).click();
  await reloadedEditor.pressSequentially(" Plus");
  await expect(
    reloadedTable.locator("tr").nth(1).locator("td").nth(0),
  ).toHaveText("Alpha Plus");
  await waitForSave(page);
});

test("ReadDocument renders table faithfully in Reading View", async ({
  page,
}) => {
  await page.addInitScript(() =>
    localStorage.setItem("personal-word.restoreTabs", "true"),
  );
  await page.goto("/");
  await createProject(page, "Reading View Table Test");

  const editor = page.getByRole("textbox", { name: "Writing editor" });
  await expect(editor).toBeVisible();

  await insertTable(page);
  const table = editor.locator("table");
  await expect(table).toBeVisible();

  await editor.pressSequentially("HeaderA");
  await page.keyboard.press("Tab");
  await editor.pressSequentially("HeaderB");
  await page.keyboard.press("Tab");
  await editor.pressSequentially("HeaderC");
  await page.keyboard.press("Tab");
  await editor.pressSequentially("DataA");
  await page.keyboard.press("Tab");
  await editor.pressSequentially("DataB");
  await page.keyboard.press("Tab");
  await editor.pressSequentially("DataC");

  await waitForSave(page);

  await page
    .getByRole("button", { name: "Read manuscript", exact: true })
    .click();
  const readTable = page.locator(".read-prose table");
  await expect(readTable).toBeVisible();
  await expect(readTable.locator("tr")).toHaveCount(3);
  await expect(readTable.locator("th")).toHaveCount(3);
  await expect(readTable.locator("td")).toHaveCount(6);
  await expect(readTable.locator("th").first()).toHaveText("HeaderA");
  await expect(readTable.locator("td").first()).toHaveText("DataA");
});

test("ReadDocument renders image with alt text fallback in Reading View", async ({
  page,
}) => {
  await page.addInitScript(() => {
    localStorage.setItem("personal-word.restoreTabs", "true");
  });
  await page.goto("/");
  await createProject(page, "Image Reader Test");
  await waitForSave(page);

  await page.evaluate(() => {
    const key = Object.keys(localStorage).find((k) =>
      k.startsWith("folio.preview.project."),
    )!;
    const p = JSON.parse(localStorage.getItem(key)!);
    const validId1 =
      "1111111111111111111111111111111111111111111111111111111111111111";
    const validId2 =
      "2222222222222222222222222222222222222222222222222222222222222222";
    p.entries[0].content = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [{ type: "text", text: "Before images." }],
        },
        {
          type: "image",
          attrs: { assetId: validId1, alt: "Architecture diagram" },
        },
        { type: "image", attrs: { assetId: validId2, alt: "" } },
      ],
    };
    p.entries[0].text = "Before images.\nArchitecture diagram\nImage";
    localStorage.setItem(key, JSON.stringify(p));
  });

  await page.reload();
  await page
    .getByRole("button", { name: "Read manuscript", exact: true })
    .click();

  const images = page.locator(".read-prose figure.doc-image");
  await expect(images).toHaveCount(2);

  await expect(images.first()).toHaveAttribute(
    "data-asset-id",
    "1111111111111111111111111111111111111111111111111111111111111111",
  );
  await expect(images.first().locator(".doc-image-alt")).toHaveText(
    "Architecture diagram",
  );

  await expect(images.nth(1)).toHaveAttribute(
    "data-asset-id",
    "2222222222222222222222222222222222222222222222222222222222222222",
  );
  await expect(images.nth(1).locator(".doc-image-alt")).toHaveText("Image");
});

test("image toolbar action inserts image with alt text and displays image figure in editor", async ({
  page,
}) => {
  await page.addInitScript(() =>
    localStorage.setItem("personal-word.restoreTabs", "true"),
  );
  await page.goto("/");
  await createProject(page, "Image Insertion Test");

  const editor = page.getByRole("textbox", { name: "Writing editor" });
  await expect(editor).toBeVisible();

  const pngBase64 =
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR4nGP4z8AAAAMBAQDJ/pLvAAAAAElFTkSuQmCC";
  const buffer = Buffer.from(pngBase64, "base64");

  const fileChooserPromise = page.waitForEvent("filechooser");
  await (await toolbarButton(page, "Insert image")).click();
  const fileChooser = await fileChooserPromise;
  await fileChooser.setFiles({
    name: "test.png",
    mimeType: "image/png",
    buffer,
  });

  const altInput = page.locator('input[aria-label="Image alternative text"]');
  await expect(altInput).toBeVisible();
  await altInput.fill("Alt test image");
  await altInput.press("Enter");

  const imageFigure = editor.locator("figure.doc-image");
  await expect(imageFigure).toBeVisible();
  await expect(imageFigure.locator(".doc-image-alt")).toHaveText("Alt test image");
  await waitForSave(page);
});

test("stored image displays after leaving, reopening, and reloading its project", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("personal-word.restoreTabs", "true"));
  await page.goto("/");
  await createProject(page, "Reopened Image Test");
  const editor = page.getByRole("textbox", { name: "Writing editor" });
  const chooser = page.waitForEvent("filechooser");
  await (await toolbarButton(page, "Insert image")).click();
  const imageBytes = await page.evaluate(() => {
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 1;
    canvas.getContext("2d")!.fillRect(0, 0, 1, 1);
    return canvas.toDataURL("image/png").split(",")[1];
  });
  await (await chooser).setFiles({
    name: "reopen.png",
    mimeType: "image/png",
    buffer: Buffer.from(imageBytes, "base64"),
  });
  const alt = page.getByRole("textbox", { name: "Image alternative text" });
  await alt.fill("Persisted image");
  await alt.press("Enter");
  await expect(editor.locator("figure.doc-image img")).toHaveAttribute("src", /^blob:/);
  await expect(editor.locator("figure.doc-image img")).toHaveJSProperty("naturalWidth", 1);
  const assetId = await editor.locator("figure.doc-image").getAttribute("data-asset-id");
  await waitForSave(page);

  const tabs = page.getByRole("navigation", { name: "Open projects" });
  await tabs.getByRole("button", { name: "Projects", exact: true }).click();
  await expect(page.getByRole("button", { name: "Start new project" })).toBeVisible();
  await tabs.getByRole("button", { name: "Reopened Image Test", exact: true }).click();
  const figure = editor.locator("figure.doc-image");
  await expect(figure).toHaveAttribute("data-asset-id", assetId!);
  await expect(figure.locator("img")).toHaveAttribute("src", /^blob:/);
  await expect(figure.locator("img")).toHaveJSProperty("naturalWidth", 1);

  await page.reload();
  await expect(figure).toHaveAttribute("data-asset-id", assetId!);
  await expect(figure.locator("img")).toHaveAttribute("src", /^blob:/);
  await expect(figure.locator("img")).toHaveJSProperty("naturalWidth", 1);
});

