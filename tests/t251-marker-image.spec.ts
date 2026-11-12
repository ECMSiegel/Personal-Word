import { test, expect, type Page } from "@playwright/test";

// T251: with a footnote marker node-selected (a click on the marker), End does
// not move the selection, and an image inserted afterwards lands where the
// marker was -- the footnoteReference node is replaced and the note's
// reference disappears from the document (and so from every export). The fix
// is scoped key handling: End and Home leave a NodeSelection for a text caret
// at the end / start of the containing text block, as they do after a plain
// text caret. Everything else about Insert image is untouched.

async function create(page: Page, title: string) {
  await page.getByRole("button", { name: "Start new project" }).click();
  await page.getByRole("button", { name: "Blank", exact: true }).click();
  await page.getByLabel("Project title").fill(title);
  await page.getByRole("button", { name: "Save", exact: true }).click();
}

async function toolbarButton(page: Page, name: string) {
  const button = page.getByRole("button", { name, exact: true });
  if (!(await button.count()))
    await page.getByRole("button", { name: "More formatting" }).click();
  return button;
}

const pngBase64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR4nGP4z8AAAAMBAQDJ/pLvAAAAAElFTkSuQmCC";

const selectionKind = (page: Page) =>
  page.evaluate(() => {
    const el = document.querySelector(".ProseMirror") as any;
    const sel = el.editor.state.selection;
    return { type: sel.jsonID, from: sel.from, to: sel.to };
  });

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.addInitScript(() =>
    localStorage.setItem("personal-word.restoreTabs", "true"),
  );
});

test("End leaves a node-selected footnote marker for a text caret and an image insert keeps the note", async ({
  page,
}) => {
  await page.goto("/");
  await create(page, "Marker image fixture");
  const editor = page.getByRole("textbox", { name: "Writing editor", exact: true });
  await editor.click();
  await page.keyboard.type("Closing paragraph with a note here.");

  // Insert a footnote at the end (marker after the sentence).
  await page
    .locator(".group-title")
    .filter({ hasText: /^Research$/ })
    .click();
  await page.locator(".research-tabs").getByRole("button", { name: "Notes", exact: true }).click();
  await page.getByRole("button", { name: "Insert footnote at cursor" }).click();
  await expect(editor.locator("[data-footnote-id]")).toHaveCount(1);
  // Type the note text so the note is not empty, then close research.
  await page.getByLabel("Footnote text", { exact: true }).fill("A supporting note.");
  await page.getByRole("button", { name: "Close research", exact: true }).click();

  // Click the marker: ProseMirror turns this into a NodeSelection (and the
  // note editor opens). Close research and return focus to the document
  // editor: ProseMirror restores its state selection on focus, so the node
  // selection is back, which is exactly the state the failing round-trip
  // path had when End was pressed.
  await editor.locator("[data-footnote-id]").click();
  const node = await selectionKind(page);
  expect(node.type).toBe("node");
  await page.getByRole("button", { name: "Close research", exact: true }).click();
  await page.evaluate(() => {
    const el = document.querySelector(".ProseMirror") as any;
    el.editor.view.focus();
  });
  await expect(editor).toBeFocused();

  // Fail-first: before the fix End does not move the selection.
  await page.keyboard.press("End");
  const after = await selectionKind(page);
  expect(after.type).toBe("text");

  // Insert the image with the caret at the paragraph end: the marker must
  // survive, and the image must not sit between the sentence and the marker.
  const chooser = page.waitForEvent("filechooser");
  await (await toolbarButton(page, "Insert image")).click();
  await (await chooser).setFiles({
    name: "figure.png",
    mimeType: "image/png",
    buffer: Buffer.from(pngBase64, "base64"),
  });
  const alt = page.locator('input[aria-label="Image alternative text"]');
  await expect(alt).toBeVisible();
  await alt.fill("Figure one");
  await alt.press("Enter");
  await expect(editor.locator("figure.doc-image")).toBeVisible();
  await expect(page.locator(".save-status")).toHaveText("Saved");

  // The document still carries the footnote reference after the image, and
  // the note text is still in storage.
  const shape = await page.evaluate(() => {
    const el = document.querySelector(".ProseMirror") as any;
    let ref: unknown;
    el.editor.state.doc.descendants((n: any) => {
      if (n.type.name === "footnoteReference") ref = { id: n.attrs.id };
      return true;
    });
    const key = Object.keys(localStorage).find((k) =>
      k.startsWith("folio.preview.project."),
    );
    const notes = key
      ? JSON.parse(localStorage.getItem(key)!).research?.footnotes ?? []
      : [];
    return { ref, notes: notes.map((n: any) => n.text) };
  });
  expect(shape.ref).toBeTruthy();
  expect(shape.notes.length).toBe(1);
});
