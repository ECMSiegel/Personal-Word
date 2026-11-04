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
  // Wave 6 every-state captures (Amendment 1). Each one is independent: a
  // failure is recorded in stateErrors and the next state still runs.
  const states = [];
  const stateErrors = [];
  const measures = {};
  const rect = (selector) => {
    const el = typeof selector === "string" ? document.querySelector(selector) : selector;
    const r = el?.getBoundingClientRect();
    return r ? { left: r.left, right: r.right, top: r.top, bottom: r.bottom } : null;
  };
  const state = async (name, fn) => {
    try {
      measures[name] = (await fn()) ?? {};
      states.push(await snapshot(name));
    } catch (error) {
      stateErrors.push(`${name}: ${String(error?.message ?? error)} [windowFocused=${document.hasFocus()}]`);
    }
  };
  const setValue = (el, text) => {
    const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(proto, "value").set.call(el, text);
    el.dispatchEvent(new Event("input", { bubbles: true }));
  };
  const key = (target, init) => {
    target.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, cancelable: true, ...init }));
  };
  const railLine = (group, label) =>
    [...document.querySelectorAll(`.sidebar-group[data-group="${group}"] .spy-rail > button.spy-line`)].find(
      (b) => b.getAttribute("aria-label") === `Go to ${label}` || b.getAttribute("aria-label").includes(label),
    );
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

    // Wave 5 floating scenarios, always run last so the six scenarios above
    // are unchanged. Floating is switched on through the real Settings row
    // (the app reads the preference at startup, so a localStorage write alone
    // would not take effect live) and also merged into folio.workspace.sidebar
    // (read, spread, write) so the stored value matches. Both are undone after.
    const FLOAT_KEY = "folio.workspace.sidebar";
    const setFloatingPref = (value) => {
      let saved = {};
      try {
        saved = JSON.parse(localStorage.getItem(FLOAT_KEY) || "{}") || {};
      } catch {
        saved = {};
      }
      localStorage.setItem(FLOAT_KEY, JSON.stringify({ ...saved, floating: value }));
    };
    const floatingRow = () =>
      [...document.querySelectorAll("label")].find((l) =>
        l.textContent.includes("Floating sidebar and research"),
      )?.querySelector('input[type="checkbox"]');
    // Waits for `fn`; a miss is reported as "floating did not engage", not a hang.
    const engaged = async (fn, label) => {
      try {
        return await wait(fn, label, 100);
      } catch {
        throw Error(`floating did not engage: ${label}`);
      }
    };
    const setZoom = async (label) => {
      if (!document.querySelector('button[aria-label="Editor zoom"]'))
        document.querySelector('button[aria-label="More formatting"]')?.click();
      (await wait(() => document.querySelector('button[aria-label="Editor zoom"]'), "zoom dropdown")).click();
      (await wait(
        () => [...document.querySelectorAll('[role="option"]')].find((o) => o.textContent.trim() === label),
        `zoom option ${label}`,
      )).click();
      await delay(300);
      await closeMore();
    };
    const toggleFloating = async (on) => {
      const box = await engaged(floatingRow, "Settings row 'Floating sidebar and research' missing");
      if (box.checked !== on) box.click();
      await delay(200);
      setFloatingPref(on);
    };
    // Settings is still on screen after the PDF probe.
    await toggleFloating(true);
    await click("Manuscript");
    await wait(editor, "writing editor");
    if (!document.querySelector(".editor-viewport.is-continuous")) {
      /* already in page view */
    } else {
      if (!document.querySelector('[aria-label="Page view"]'))
        document.querySelector('[aria-label="More formatting"]')?.click();
      (await wait(() => document.querySelector('[aria-label="Page view"]'), "page view toggle")).click();
      await closeMore();
    }
    // floating-sidebar: page view, sidebar pinned (the default). The capture
    // window is 1240x840, too narrow for the margin the floating fit rule needs
    // beside a 100% page, so the page zoom is 50 (a narrower sheet) instead of
    // widening the window. 75 left ~314 px per side, on the card's 312 px
    // threshold, and the card fell back to the panel (V3, 2026-11-02).
    await setZoom("50%");
    await engaged(
      () => document.querySelector(".sidebar-shell.is-floating"),
      "no .sidebar-shell.is-floating (feature missing or margin too small)",
    );
    document.querySelector(".page-spacer")?.scrollIntoView({ block: "center" });
    await delay(400);
    screens.push(await snapshot("floating-sidebar"));
    // floating-card: the Research group header opens the citation card at the
    // top right. (The card opened on a footnote needs a typed footnote: V hand-check.)
    const researchButton = button("Research");
    await click("Research");
    const box = (s) => {
      const r = document.querySelector(s)?.getBoundingClientRect();
      return r ? `${Math.round(r.left)}-${Math.round(r.right)}` : "none";
    };
    await engaged(
      () => document.querySelector('[role="dialog"][aria-label="Add a citation"]'),
      `no 'Add a citation' card (clicked .${researchButton?.className}; ` +
        `aside ${box(".research-aside")}, paper ${box(".editor-paper")}, workspace ${box(".workspace")}, ` +
        `floating ${!!document.querySelector(".sidebar-shell.is-floating")}, dialogs ${document.querySelectorAll('[role="dialog"]').length})`,
    );
    await delay(300);
    screens.push(await snapshot("floating-card"));
    // Wave 6 every-state: a toast raised while the card is open.
    await state("state-toast-card", async () => {
      await click("Snapshot");
      await input("Snapshot name", "A snapshot while the card is open");
      await click("Save");
      await wait(() => document.querySelector(".notice"), "toast");
      await delay(300);
      return { toast: rect(".notice"), card: rect(".citation-card"), sheet: rect(".editor-paper") };
    });
    // Restore.
    await click("Manuscript");
    await setZoom("100%");
    await click("Settings");
    await toggleFloating(false);

    // ---- Wave 6 every-state captures (docs/agent-work/2026-11-02-ui-wave-6/PLAN.md, Amendment 1).
    // Pointer hover cannot be driven natively; the
    // palette highlight uses its own arrow keys, the dock a synthetic pointermove.
    const LONG_SECTION = "A very long section title about the early correspondence of the river commissioners";
    const LONG_NOTE = "A long research note that keeps going well past the width of any narrow sidebar row to see wrapping";
    const LONG_SOURCE = "An extremely long source title on the administrative history of inland waterways and their keepers";
    const LONG_PROJECT = "A very long project name that should never run under the dates or the trash icon on hover";
    await click("Manuscript");
    await wait(editor, "writing editor");
    await state("state-toolbar-rest", async () => {
      await delay(200);
      const bar = document.querySelector(".format-bar");
      return { bar: rect(bar), extract: rect(".format-bar .extract") };
    });
    await state("state-toolbar-magnified", async () => {
      const target = await wait(() => document.querySelector(".format-bar .extract"), "scissor", 100);
      const r = target.getBoundingClientRect();
      const bar = target.closest(".format-bar") ?? target.parentElement;
      const init = { bubbles: true, clientX: r.left + r.width / 2, clientY: r.top + r.height / 2, pointerType: "mouse" };
      bar.dispatchEvent(new PointerEvent("pointermove", init));
      target.dispatchEvent(new PointerEvent("pointermove", init));
      await delay(400);
      return { scale: getComputedStyle(target).getPropertyValue("--dock-scale"), extract: rect(target) };
    });
    document.querySelector(".format-bar")?.dispatchEvent(new PointerEvent("pointerleave", { bubbles: false }));
    await delay(200);
    // Long section title, then the palette with it highlighted.
    (await wait(() => document.querySelector('button[aria-label="New section"]'), "New section button")).click();
    await input("Title", LONG_SECTION);
    await click("Save");
    await wait(() => railLine("manuscript", LONG_SECTION), "long section line");
    await state("state-palette-long", async () => {
      // The Save dialog must be gone and React's shortcut handler re-registered before the key.
      await wait(() => !document.querySelector(".modal-backdrop"), "name dialog closed", 100);
      await delay(250);
      editor()?.focus();
      key(document.activeElement ?? document.body, { key: "P", code: "KeyP", metaKey: true, shiftKey: true });
      const box = await wait(() => document.querySelector('[aria-label="Search commands"]'), "palette input", 100);
      setValue(box, "early correspondence");
      await delay(200);
      key(box, { key: "ArrowDown", code: "ArrowDown" });
      key(box, { key: "ArrowUp", code: "ArrowUp" });
      await delay(250);
      const option = document.querySelector(".command-palette-option");
      const label = option?.querySelector(".emph-label");
      return {
        palette: rect(".command-palette"),
        option: rect(option),
        label: rect(label),
        highlighted: !!document.querySelector(".command-palette-option[data-highlighted], .command-palette-option.is-highlighted, .command-palette-option[aria-selected='true']"),
        labelSpill: label ? label.scrollWidth > label.clientWidth + 1 : null,
      };
    });
    const paletteBox = document.querySelector('[aria-label="Search commands"]');
    if (paletteBox) key(paletteBox, { key: "Escape", code: "Escape" });
    await delay(200);
    // Narrow the sidebar to 190 px with its own keyboard resizer (ArrowLeft = -20 px, clamped).
    const resizer = await wait(() => document.querySelector('[role="separator"][aria-label="Sidebar width"]'), "sidebar resizer");
    const startWidth = Number(resizer.getAttribute("aria-valuenow"));
    for (let i = 0; i < 20; i++) key(resizer, { key: "ArrowLeft", code: "ArrowLeft" });
    await delay(400);
    await state("state-rail-0-and-1", async () => ({
      width: resizer.getAttribute("aria-valuenow"),
      manuscriptLines: document.querySelectorAll('.sidebar-group[data-group="manuscript"] .spy-rail > .spy-line').length,
      fragmentLines: document.querySelectorAll('.sidebar-group[data-group="fragments"] .spy-rail > .spy-line').length,
    }));
    await state("state-no-research", async () => {
      await click("Research");
      await wait(() => document.querySelector(".research-panel"), "research panel");
      await delay(300);
      return { text: document.querySelector(".research-panel")?.innerText.slice(0, 300) };
    });
    await state("state-notes-empty", async () => {
      const notes = await wait(
        () => [...document.querySelectorAll(".research-tabs button")].find((b) => b.textContent.trim() === "Notes"),
        "Notes tab",
      );
      notes.click();
      await delay(300);
      return { text: document.querySelector(".research-panel")?.innerText.slice(0, 300) };
    });
    // Two notes (one long) and two sources (one long, one with no title or year).
    for (const text of [LONG_NOTE, "Second note"]) {
      await click("Add note");
      await delay(150);
      const areas = document.querySelectorAll(".note-item textarea");
      setValue(areas[areas.length - 1], text);
      await delay(150);
    }
    await state("state-notes-two", async () => ({ items: [...document.querySelectorAll(".note-item")].map(rect) }));
    await state("state-sources-import", async () => {
      const sourcesTab = [...document.querySelectorAll(".research-tabs button")].find((b) => b.textContent.trim() === "Sources");
      sourcesTab?.click();
      await delay(200);
      const file = await wait(() => document.querySelector('input[aria-label^="Zotero CSL JSON file"]'), "CSL file input", 100);
      const data = new DataTransfer();
      data.items.add(
        new File(
          [
            JSON.stringify([
              { type: "book", title: LONG_SOURCE, author: [{ given: "Ann", family: "Ames" }], issued: { "date-parts": [[2020]] }, publisher: "River Press" },
            ]),
          ],
          "sources.json",
          { type: "application/json" },
        ),
      );
      file.files = data.files;
      file.dispatchEvent(new Event("change", { bubbles: true }));
      await click("Add sources");
      await wait(() => railLine("research", LONG_SOURCE), "long source line", 200);
      // A source with no title or year: the manual form keeps it with only an author.
      await click("Enter manually");
      const authors = await wait(() => {
        const l = [...document.querySelectorAll("label")].find((c) => c.textContent === "Authors");
        return l && (l.querySelector("textarea, input") ?? (l.htmlFor ? document.getElementById(l.htmlFor) : null));
      }, "Authors field");
      setValue(authors, "Bo Berg");
      await wait(() => railLine("research", "Untitled source"), "untitled source line", 200);
      await delay(400);
      return {
        researchLines: [...document.querySelectorAll('.sidebar-group[data-group="research"] .spy-rail > .spy-line')].map((b) =>
          b.getAttribute("aria-label"),
        ),
      };
    });
    await click("Manuscript");
    await wait(editor, "writing editor");
    await delay(300);
    await state("state-sidebar190-long", async () => ({
      rows: [...document.querySelectorAll(".sidebar-group .entry-row .entry-main span")].map((s) => ({
        text: s.textContent.slice(0, 30),
        clipped: s.scrollWidth > s.clientWidth + 1 && getComputedStyle(s).textOverflow !== "ellipsis",
      })),
    }));
    await state("state-rail-fragments-1", async () => {
      (await wait(() => document.querySelector('button[aria-label="New fragment"]'), "New fragment button")).click();
      await input("Title", "Only fragment");
      await click("Save");
      await wait(() => railLine("fragments", "Only fragment"), "fragment line");
      await delay(300);
      return { fragmentLines: document.querySelectorAll('.sidebar-group[data-group="fragments"] .spy-rail > .spy-line').length };
    });
    await state("state-split-rail", async () => {
      const beside = await wait(() => document.querySelector(`button[aria-label="Open ${LONG_SECTION} beside"]`), "Open beside button", 100);
      beside.click();
      await wait(() => document.querySelector('[aria-label="Right pane"]'), "right pane", 100);
      await delay(400);
      return { lines: [...document.querySelectorAll(".spy-line")].map((b) => b.getAttribute("data-state")) };
    });
    document.querySelector('button[aria-label="Close right pane"]')?.click();
    await delay(200);
    // Back to the normal width, then the Projects screen with a long project name.
    for (let i = 0; i < 20 && Number(resizer.isConnected ? resizer.getAttribute("aria-valuenow") : startWidth) < startWidth; i++)
      key(resizer, { key: "ArrowRight", code: "ArrowRight" });
    await delay(200);
    await state("state-projects-long", async () => {
      await click("Projects");
      await click("Start new project");
      await click("Blank");
      await input("Project title", LONG_PROJECT);
      await click("Save");
      await wait(editor, "writing editor (long project)");
      await click("Projects");
      const row = await wait(
        () => [...document.querySelectorAll(".project-row")].find((r) => r.textContent.includes("A very long project name")),
        "long project row",
      );
      const open = row.querySelector("button");
      key(open, { key: "Tab", code: "Tab" });
      open.focus();
      await delay(350);
      return {
        row: rect(row),
        name: rect(row.querySelector(".project-name")),
        trash: rect(row.querySelector(".delete-entry")),
        dates: [...row.querySelectorAll(".project-dates")].map(rect),
        trashVisible: getComputedStyle(row.querySelector(".delete-entry") ?? row).opacity,
      };
    });

    await report({ ok: true, screens, pdfProbe, states, stateErrors, measures });
    await invoke("smoke_close_window");
  } catch (error) {
    await report({ ok: false, screens: [], error: String(error?.message ?? error) });
  }
})();
