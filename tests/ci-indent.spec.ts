import { test, expect } from "@playwright/test";

async function createProject(page: any, title: string, template: string) {
  await page.addInitScript(() =>
    localStorage.setItem("personal-word.restoreTabs", "true"),
  );
  await page.goto("/");
  await page.getByRole("button", { name: "Start new project" }).click();
  await page.getByRole("button", { name: template, exact: true }).click();
  await page.getByLabel("Project title").fill(title);
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByText("Saved", { exact: true })).toBeVisible();
}

// Arm the observer before input and inspect completion only after the entire
// action. A save during typing must not acknowledge the later Tab transaction.
async function savedEdit(page: any, edit: () => Promise<void>) {
  await expect(page.locator(".save-status")).toHaveClass(/\bsaved\b/);
  await page.evaluate(() => {
    const status = document.querySelector(".save-status")!;
    const state = { pending: false, error: "" };
    (window as any).__indentSave = state;
    const observer = new MutationObserver(() => {
      if (status.classList.contains("pending")) state.pending = true;
      if (status.classList.contains("error"))
        state.error = status.textContent?.trim() || "Save failed.";
    });
    observer.observe(status, { attributes: true, attributeFilter: ["class"] });
    (window as any).__indentSaveObserver = observer;
  });
  try {
    await edit();
    await expect
      .poll(() =>
        page.evaluate(() => {
          const state = (window as any).__indentSave;
          if (state.error) throw new Error(state.error);
          return (
            state.pending &&
            document
              .querySelector(".save-status")
              ?.classList.contains("saved") &&
            !Object.keys(localStorage).some((key) =>
              key.startsWith("folio.recovery."),
            )
          );
        }),
      )
      .toBe(true);
  } finally {
    await page.evaluate(() =>
      (window as any).__indentSaveObserver.disconnect(),
    );
  }
}

test.use({ viewport: { width: 1280, height: 800 } });

test("Blank start indent survives undo, redo, save, and reload", async ({
  page,
}) => {
  await createProject(page, "Blank indentation", "Blank");
  const editor = page.getByRole("textbox", { name: "Writing editor" });
  const paragraph = editor.locator("p").first();
  // Focus the actual text paragraph for this pointer-entry journey. Keep
  // synthetic/keyboard-only recent-focus behavior as a separate check.
  await paragraph.click();
  await savedEdit(page, async () => {
    await editor.pressSequentially("A blank-template paragraph.");
    await editor.press("Home");
    // Browser Home updates the DOM selection before ProseMirror consumes it.
    // Wait for the command's actual selection, not a transient DOM offset.
    await expect
      .poll(() =>
        editor.evaluate((element: any) => ({
          offset: element.editor.state.selection.$from.parentOffset,
          empty: element.editor.state.selection.empty,
          domOffset: window.getSelection()?.anchorOffset,
        })),
      )
      .toEqual({ offset: 0, empty: true, domOffset: 0 });
    await editor.press("Tab");
  });

  await expect(editor).toBeFocused();
  await expect(paragraph).toHaveAttribute("style", /text-indent: 0\.5in/);
  await expect(paragraph).not.toHaveAttribute("style", /margin-left/);

  await savedEdit(page, () => editor.press("ControlOrMeta+z"));
  await expect(paragraph).not.toHaveAttribute("style", /text-indent: 0\.5in/);
  await savedEdit(page, () => editor.press("ControlOrMeta+Shift+z"));
  await expect(paragraph).toHaveAttribute("style", /text-indent: 0\.5in/);

  await page.reload();
  await expect(editor).toContainText("A blank-template paragraph.");
  await expect(editor.locator("p").first()).toHaveAttribute(
    "style",
    /text-indent: 0\.5in/,
  );
});

test("Chicago inherited indent uses left indent and survives undo, redo, and reload", async ({
  page,
}) => {
  await createProject(page, "Chicago indentation", "Chicago student paper");
  const introduction = page.getByRole("button", {
    name: /^Introduction \d+ words$/,
  });
  await introduction.click();
  const editor = page.getByRole("textbox", { name: "Writing editor" });
  const paragraph = editor.locator("p").first();
  // Focus the actual text paragraph for this pointer-entry journey. Keep
  // synthetic/keyboard-only recent-focus behavior as a separate check.
  await paragraph.click();
  await savedEdit(page, async () => {
    await editor.pressSequentially("An inherited Chicago paragraph.");
    await editor.press("Home");
    // Browser Home updates the DOM selection before ProseMirror consumes it.
    // Wait for the command's actual selection, not a transient DOM offset.
    await expect
      .poll(() =>
        editor.evaluate((element: any) => ({
          offset: element.editor.state.selection.$from.parentOffset,
          empty: element.editor.state.selection.empty,
          domOffset: window.getSelection()?.anchorOffset,
        })),
      )
      .toEqual({ offset: 0, empty: true, domOffset: 0 });
    await editor.press("Tab");
  });

  await expect(paragraph).toHaveAttribute("style", /margin-left: 0\.5in/);
  await expect(paragraph).not.toHaveAttribute("style", /text-indent: 0\.5in/);

  await savedEdit(page, () => editor.press("ControlOrMeta+z"));
  await expect(paragraph).not.toHaveAttribute("style", /margin-left: 0\.5in/);
  await savedEdit(page, () => editor.press("ControlOrMeta+Shift+z"));
  await expect(paragraph).toHaveAttribute("style", /margin-left: 0\.5in/);

  await page.reload();
  await page
    .getByRole("navigation", { name: "Open projects" })
    .getByRole("button", { name: "Chicago indentation", exact: true })
    .click();
  await expect(introduction).toBeVisible();
  await introduction.click();
  const reloadedEditor = page.getByRole("textbox", { name: "Writing editor" });
  await expect(reloadedEditor).toContainText("An inherited Chicago paragraph.");
  await expect(reloadedEditor.locator("p").first()).toHaveAttribute(
    "style",
    /margin-left: 0\.5in/,
  );
});

test("Screenplay Tab keeps cycling paragraph styles", async ({ page }) => {
  await createProject(page, "Screenplay indentation", "Screenplay");
  const editor = page.getByRole("textbox", { name: "Writing editor" });
  const paragraph = editor.locator("p").first();
  await editor.press("End");
  await editor.press("Tab");
  await expect(paragraph).toHaveAttribute("data-paragraph-style", "scene");
  await expect(paragraph).not.toHaveAttribute("style", /text-indent: 0\.5in/);

  await editor.press("Shift+Tab");
  await expect(paragraph).toHaveAttribute(
    "data-paragraph-style",
    "parenthetical",
  );
});
