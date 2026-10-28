// Injected only by the cfg(native-smoke) diagnostic app (FOLIO_SMOKE_SCRIPT=native-screens).
// Captures native WebKit screenshots of the main screens (plus the U17 PDF preview probe) in the requested appearance,
// then reports the captured paths. The Python supervisor owns the process and the
// isolated data store; this script never touches anything outside FOLIO_SMOKE_DIR.
(async () => {
  const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const scenario = window.__SMOKE_SCENARIO__;
  const run = window.__SMOKE_RUN__;
  const palette = window.__SMOKE_PALETTE__ || "plain";
  const invoke = (command, args = {}) =>
    window.__TAURI_INTERNALS__.invoke(command, args);
  const mark = (message) => {
    void invoke("smoke_progress", { message: `screens ${message}` }).catch(() => {});
  };
  const wait = async (fn, label, attempts = 500) => {
    mark(`wait ${label}`);
    for (let i = 0; i < attempts; i++) {
      const value = fn();
      if (value) return value;
      await delay(40);
    }
    throw Error(`Timed out: ${label}`);
  };
  const button = (text) =>
    [...document.querySelectorAll("button")].find(
      (candidate) =>
        candidate.textContent.trim() === text ||
        (candidate.classList.contains("entry-main") &&
          candidate.querySelector("span")?.textContent === text),
    );
  const click = async (text) => {
    (await wait(() => button(text), `button ${text}`)).click();
    await delay(70);
  };
  const input = async (label, text) => {
    const el = await wait(
      () => {
        const labelEl = [...document.querySelectorAll("label")].find(
          (candidate) => candidate.textContent === label,
        );
        if (!labelEl) return null;
        // The Research Field links its input by htmlFor (sibling); the create
        // dialog nests it inside the label. Support both.
        return (
          labelEl.querySelector("input") ??
          (labelEl.htmlFor ? document.getElementById(labelEl.htmlFor) : null)
        );
      },
      `input ${label}`,
    );
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set.call(el, text);
    el.dispatchEvent(new Event("input", { bubbles: true }));
  };
  const editor = () => document.querySelector('[aria-label="Writing editor"]');
  const type = async (text) => {
    const el = await wait(editor, "writing editor");
    el.focus();
    const range = document.createRange();
    range.selectNodeContents(el);
    const selection = getSelection();
    selection.removeAllRanges();
    selection.addRange(range);
    document.execCommand("insertText", false, text);
  };
  // Closes the More formatting popover the way a user would. It only closes via
  // its own React onKeyDown (Escape on the popover element) or a real pointerdown
  // outside; an Escape dispatched on document never reaches it. Falls back to
  // clicking the More button again.
  const moreMenu = () => document.querySelector('[role="dialog"][aria-label="More formatting"]');
  const closeMore = async () => {
    for (let attempt = 0; attempt < 2 && moreMenu(); attempt++) {
      if (attempt === 0)
        moreMenu().dispatchEvent(
          new KeyboardEvent("keydown", { key: "Escape", code: "Escape", bubbles: true, cancelable: true }),
        );
      else document.querySelector('button[aria-label="More formatting"]')?.click();
      for (let i = 0; i < 40 && moreMenu(); i++) await delay(25);
    }
    if (moreMenu()) throw Error("More formatting popover did not close");
  };
  // Continues typing at the caret instead of replacing the content.
  const typeMore = async (text) => {
    const el = await wait(editor, "writing editor");
    el.focus();
    const selection = getSelection();
    selection.selectAllChildren(el);
    selection.collapseToEnd();
    document.execCommand("insertText", false, text);
  };
  const snapshot = async (name) => {
    const path = await invoke("smoke_snapshot", { name });
    mark(`captured ${name}`);
    return path;
  };
  let diagnosticProfile;
  const report = (data) =>
    invoke("smoke_report", {
      report: {
        ...data,
        scenario,
        runId: run,
        invocationId: window.__SMOKE_INVOCATION__,
        diagnosticProfile,
        prefersDark: window.matchMedia("(prefers-color-scheme: dark)").matches,
        dataTheme: document.documentElement.dataset.theme ?? null,
      },
    });
  try {
    // Apply the requested appearance once, then reload so the whole first paint
    // uses it. (No effect until T4 lands; the report still records what was set.)
    if (!sessionStorage.getItem("folio.nativeScreensReloaded")) {
      sessionStorage.setItem("folio.nativeScreensReloaded", "1");
      localStorage.setItem(
        "folio.workspace.appearance",
        JSON.stringify({ theme: scenario, palette }),
      );
      location.reload();
      return;
    }
    const expectedStoreId = window.__SMOKE_DATA_STORE_ID__;
    diagnosticProfile = await invoke("diagnostic_profile_identity");
    if (
      diagnosticProfile.appIdentifier !== "com.folio.smoke" ||
      diagnosticProfile.protocol !== "d1-profile-isolation-v1" ||
      diagnosticProfile.dataStoreIdentifier !== expectedStoreId ||
      !diagnosticProfile.activeDataStoreIdentifiers.includes(expectedStoreId)
    ) {
      throw Error("Native diagnostic app or isolated WebKit profile identity mismatch");
    }
    const screens = [];
    await wait(() => button("Start new project"), "Projects screen ready");
    screens.push(await snapshot("projects"));

    await click("Start new project");
    await click("Blank");
    await input("Project title", "Screens fixture");
    await click("Save");
    await wait(editor, "writing editor");
    await type("First paragraph of the native screenshot fixture.");
    // ProseMirror splits paragraphs on a real Enter; the synthetic keydown goes
    // through its keymap. If it is swallowed, the second sentence appends and the
    // capture still shows representative prose.
    editor()?.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", code: "Enter", bubbles: true }));
    await delay(120);
    await typeMore("Second paragraph so the writing screen shows real prose.");
    await delay(400);
    screens.push(await snapshot("writing"));

    // Page view (wave 3, P2): pages stacked vertically, framed on the first
    // page gap so the capture shows page 1's foot, the gap and page 2's top.
    const tiptap = editor().editor;
    tiptap.commands.insertContentAt(
      tiptap.state.doc.content.size,
      Array.from({ length: 40 }, (_, i) => ({
        type: "paragraph",
        content: [
          {
            type: "text",
            text: `Paragraph ${i + 3} fills the fixture so page view has a second page to stack below the first.`,
          },
        ],
      })),
    );
    if (!document.querySelector('[aria-label="Page view"]'))
      document.querySelector('[aria-label="More formatting"]')?.click();
    (await wait(() => document.querySelector('[aria-label="Page view"]'), "page view toggle")).click();
    const spacer = await wait(() => document.querySelector(".page-spacer"), "page spacer");
    await closeMore();
    spacer.scrollIntoView({ block: "center" });
    await delay(400);
    screens.push(await snapshot("writing-pages"));
    // Page view's toggle sits in the More popover, closed above for the capture.
    if (!document.querySelector('[aria-label="Page view"]'))
      document.querySelector('[aria-label="More formatting"]')?.click();
    (await wait(() => document.querySelector('[aria-label="Page view"]'), "page view toggle")).click();
    await wait(() => document.querySelector(".editor-viewport.is-continuous"), "continuous view");
    await closeMore();

    await click("Research");
    await click("Enter manually");
    await input("Title", "A synthetic source");
    await delay(300);
    screens.push(await snapshot("research"));

    await click("Settings");
    await wait(() => document.querySelector(".project-settings"), "settings panel");
    await delay(300);
    screens.push(await snapshot("settings"));

    // U17 probe: does this WebKit draw a PDF blob inside the export-preview iframe?
    await click("Preview PDF");
    const frame = await wait(() => document.querySelector("iframe.export-preview"), "export preview iframe", 1500);
    frame.scrollIntoView();
    await delay(2000);
    const pdfProbe = {
      contentType: frame.contentDocument?.contentType ?? null,
      embedType: frame.contentDocument?.querySelector("embed")?.type ?? null,
      width: frame.clientWidth,
      height: frame.clientHeight,
    };
    screens.push(await snapshot("pdf-preview"));

    await report({ ok: true, screens, pdfProbe });
    await invoke("smoke_close_window");
  } catch (error) {
    await report({ ok: false, screens: [], error: String(error?.message ?? error) });
  }
})();
