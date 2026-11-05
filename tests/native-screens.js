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
  // Measured pass/fail results (T242). A failed check is listed here and in the report; it does not stop the run.
  const measureFailures = [];
  const check = (name, ok, detail) => {
    if (!ok) measureFailures.push(`${name}: ${detail}`);
    return !!ok;
  };
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
    // T242: Cite here in the floating card must land focus on the Page (locator) field, not the editor.
    await state("state-cite-here-page", async () => {
      const dialog = () => document.querySelector('[role="dialog"][aria-label="Add a citation"]');
      if (!dialog()) {
        await click("Research");
        await engaged(dialog, "no 'Add a citation' card for Cite here");
      }
      const within = (text) => [...dialog().querySelectorAll("button")].find((b) => b.textContent.trim() === text);
      (await wait(() => within("Enter manually"), "Enter manually in the card", 100)).click();
      const cite = await wait(() => within("Cite here"), "Cite here in the card", 100);
      if (cite.disabled) throw Error("Cite here is disabled (no open section)");
      cite.click();
      await delay(700);
      const a = document.activeElement;
      const out = {
        tag: a?.tagName ?? null,
        id: a?.id ?? null,
        ariaLabel: a?.getAttribute?.("aria-label") ?? null,
        label: a?.labels?.[0]?.textContent ?? null,
        inCard: !!dialog()?.contains(a),
        inEditor: !!a?.closest?.('[aria-label="Writing editor"]'),
      };
      out.onPage = check("cite-here focus", out.inCard && /-locator$/.test(out.id ?? ""), JSON.stringify(out));
      return out;
    });
    // Restore.
    await click("Manuscript");
    await setZoom("100%");
    await click("Settings");
    await toggleFloating(false);

    // ---- Wave 6 every-state captures (docs/agent-work/2026-11-02-ui-wave-6/PLAN.md, Amendment 1).
    // Pointer hover cannot be driven natively; the
    // palette highlight uses its own arrow keys, the dock a synthetic pointermove.
    // Native WebKit reports rects under CSS zoom in that element's zoomed space (see floating.ts).
    const zoomedSpace = (() => {
      const probe = document.createElement("div");
      probe.style.cssText = "position:absolute;visibility:hidden;width:100px;height:1px;zoom:0.5";
      document.body.appendChild(probe);
      const yes = probe.getBoundingClientRect().width > 75;
      probe.remove();
      return yes;
    })();
    // The element's zoom times every ancestor's; WebKit reports rects of zoomed content as drawn / this.
    const zoomOf = (el) => {
      let z = 1;
      for (let n = el; n; n = n.parentElement) z *= parseFloat(getComputedStyle(n).zoom) || 1;
      return z;
    };
    // A y from ProseMirror (coordsAtPos) or getBoundingClientRect of zoomed content, in drawn px.
    const drawnY = (raw, el) => (zoomedSpace ? raw * zoomOf(el) : raw);
    const drawnRect = (el) => {
      const r = el.getBoundingClientRect();
      if (!zoomedSpace) return r;
      const z = zoomOf(el);
      return { left: r.left * z, right: r.right * z, top: r.top * z, bottom: r.bottom * z };
    };
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
    // Each key must be awaited: React only updates aria-valuenow between ticks, so an unawaited loop always ran
    // all 20 keys and left the sidebar at 520 px (the page-view states then drew at 0.843, never at 1 or above).
    for (let i = 0; i < 20 && Number(resizer.isConnected ? resizer.getAttribute("aria-valuenow") : startWidth) < startWidth; i++) {
      key(resizer, { key: "ArrowRight", code: "ArrowRight" });
      await delay(60);
    }
    await delay(200);
    check("sidebar width restored", Number(resizer.getAttribute("aria-valuenow")) === startWidth, `${resizer.getAttribute("aria-valuenow")} vs ${startWidth}`);
    // ---- T242: wave 7 ruler and top gap, measured natively (Chromium cannot give WebKit's zoom, sticky and clip behaviour).
    // Each state is optional. Numbers go in `measures`; a failed check goes in measureFailures.
    const pagesOn = () => !!document.querySelector(".editor-viewport.is-paged");
    const ensureMode = async (pages) => {
      if (pagesOn() === pages) return;
      if (!document.querySelector('[aria-label="Page view"]')) document.querySelector('[aria-label="More formatting"]')?.click();
      (await wait(() => document.querySelector('[aria-label="Page view"]'), "page view toggle")).click();
      await wait(() => pagesOn() === pages, pages ? "page view" : "continuous view");
      await closeMore();
      await delay(250);
    };
    const rulerToggle = () =>
      [...document.querySelectorAll("button")].find((b) => b.textContent.trim() === "Ruler" && b.hasAttribute("aria-pressed"));
    const ensureRuler = async (on) => {
      if (!!document.querySelector(".document-ruler") === on) return;
      if (!rulerToggle()) {
        const trigger = () => document.querySelector('button[aria-label="Page setup"]') ?? button("Page setup");
        if (!trigger()) document.querySelector('button[aria-label="More formatting"]')?.click();
        (await wait(trigger, "Page setup button")).click();
        await wait(rulerToggle, "Ruler toggle in Page setup");
      }
      if (rulerToggle().getAttribute("aria-pressed") !== String(on)) rulerToggle().click();
      await wait(() => !!document.querySelector(".document-ruler") === on, on ? "ruler shown" : "ruler hidden");
      const panel = document.querySelector('[role="dialog"][aria-label="Page setup"]');
      panel?.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", code: "Escape", bubbles: true, cancelable: true }));
      await delay(150);
      if (document.querySelector('[role="dialog"][aria-label="Page setup"]'))
        (document.querySelector('button[aria-label="Page setup"]') ?? button("Page setup"))?.click();
      await closeMore();
      await delay(250);
    };
    // The open entry needs enough text to scroll in both views.
    const ensureLongText = async () => {
      const ed = (await wait(editor, "writing editor")).editor;
      if (ed.state.doc.childCount < 40)
        ed.commands.insertContentAt(
          ed.state.doc.content.size,
          Array.from({ length: 120 }, (_, i) => ({
            type: "paragraph",
            content: [{ type: "text", text: `Ruler fixture paragraph ${i + 1} gives the scroller something to scroll under the ruler.` }],
          })),
        );
      await delay(400);
      return ed;
    };
    const scrollerEl = () => document.querySelector(".writer-scroll");
    const firstGlyph = () => {
      const walker = document.createTreeWalker(document.querySelector(".ProseMirror"), NodeFilter.SHOW_TEXT);
      let node;
      while ((node = walker.nextNode())) if (node.textContent.trim()) break;
      if (!node) return null;
      const range = document.createRange();
      range.setStart(node, 0);
      range.setEnd(node, 1);
      return range.getBoundingClientRect();
    };
    const near = (a, b) => Math.abs(a - b) <= 1;
    const measureRuler = (tag) => {
      const need = (selector) => {
        const r = rect(selector);
        if (!r) throw Error(`missing ${selector}`);
        return r;
      };
      const ruler = need(".document-ruler");
      const paper = need(".editor-paper");
      const text = need(".ProseMirror");
      const left = need(".ruler-margin-marker--left");
      const right = need(".ruler-margin-marker--right");
      const tick0 = need(".ruler-tick");
      const glyph = firstGlyph();
      const scroller = scrollerEl();
      const m = {
        rulerLeft: ruler.left, rulerRight: ruler.right, paperLeft: paper.left, paperRight: paper.right,
        textLeft: text.left, textRight: text.right, tick0Left: tick0.left,
        leftPoint: (left.left + left.right) / 2, rightPoint: (right.left + right.right) / 2,
        glyphLeft: glyph?.left ?? null,
        drawnZoom: zoomOf(document.querySelector(".ProseMirror")),
        // Recorded, not asserted: T237 removed the 8 px continuous padding, so this should be near 0; near 8 would be a real finding.
        glyphInsetFromMarker: glyph ? glyph.left - (left.left + left.right) / 2 : null,
        scrollerClientWidth: scroller?.clientWidth, scrollerScrollWidth: scroller?.scrollWidth,
        scrollerBarWidth: scroller ? scroller.offsetWidth - scroller.clientWidth : null,
      };
      check(`${tag} ruler box = paper box`, near(m.rulerLeft, m.paperLeft) && near(m.rulerRight, m.paperRight), `ruler ${m.rulerLeft}-${m.rulerRight} paper ${m.paperLeft}-${m.paperRight}`);
      check(`${tag} ruler 0 = paper left`, near(m.tick0Left, m.paperLeft), `${m.tick0Left} vs ${m.paperLeft}`);
      check(`${tag} left marker = text left`, near(m.leftPoint, m.textLeft), `${m.leftPoint} vs ${m.textLeft}`);
      check(`${tag} right marker = text right`, near(m.rightPoint, m.textRight), `${m.rightPoint} vs ${m.textRight}`);
      check(`${tag} no horizontal overflow`, m.scrollerScrollWidth - m.scrollerClientWidth <= 0, `${m.scrollerScrollWidth} vs ${m.scrollerClientWidth}`);
      return m;
    };
    await click("Manuscript");
    await wait(editor, "writing editor (ruler states)");
    const rulerEd = await ensureLongText();
    let rulerSetupError = null;
    try {
      await ensureRuler(true);
    } catch (error) {
      rulerSetupError = String(error?.message ?? error);
      stateErrors.push(`ruler-setup: ${rulerSetupError}`);
    }
    if (!rulerSetupError) {
      // Alignment: ruler 0, both markers, paper and text edges at three zooms in both views.
      for (const [modeName, pages] of [["page", true], ["cont", false]]) {
        for (const zoom of [75, 100, 150]) {
          await state(`state-ruler-${modeName}-${zoom}`, async () => {
            await ensureMode(pages);
            await setZoom(`${zoom}%`);
            scrollerEl().scrollTop = 0;
            await delay(300);
            const m = measureRuler(`${modeName} ${zoom}`);
            return { ...m, mode: modeName, zoom, paperScale: getComputedStyle(document.querySelector(".editor-paper")).getPropertyValue("--page-scale") };
          });
        }
      }
      // Caret stays below the sticky ruler after moving up. A synthetic keydown cannot move a caret, so the move
      // is a selection change plus scrollIntoView (what ProseMirror runs after ArrowUp); a native line move is recorded too.
      const paragraphStarts = (ed) => {
        const out = [];
        ed.state.doc.descendants((node, pos) => {
          if (node.isTextblock && node.textContent) out.push(pos + 1);
        });
        return out;
      };
      // One walk of about 20 "ArrowUp"s in drawn px: the caret starts 4 px under the floor (ruler bottom, or the scroller
      // top with the ruler off), then each step moves one line up and scrolls like ProseMirror does after a key.
      // Asserted per step: clear of the floor (>= -1), not over-scrolled (clearance <= 7; the margin is 5) and the
      // caret's bottom inside the scroller. `zoom` is the drawn zoom of this editor and is recorded in every state.
      const caretWalk = async (ed, tag) => {
        const scroller = ed.view.dom.closest(".writer-scroll");
        const ruler = scroller.querySelector(".document-ruler");
        const floor = () => (ruler ? drawnRect(ruler).bottom : scroller.getBoundingClientRect().top);
        const starts = paragraphStarts(ed);
        const k = Math.min(30, starts.length - 1);
        const top = (pos) => drawnY(ed.view.coordsAtPos(pos, 1).top, ed.view.dom);
        const bottom = (pos) => drawnY(ed.view.coordsAtPos(pos, 1).bottom, ed.view.dom);
        for (let pass = 0; pass < 2; pass++) {
          scroller.scrollTop += top(starts[k]) - (floor() + 4);
          await delay(250);
        }
        ed.view.focus();
        ed.commands.setTextSelection(starts[k]);
        await delay(250);
        const startScroll = scroller.scrollTop;
        // A fixture miss (document too short to scroll the start under the ruler) must read as one, not as an app failure.
        const startClearance = top(starts[k]) - floor();
        const scrollRoom = { scrollHeight: scroller.scrollHeight, clientHeight: scroller.clientHeight };
        check(`${tag} walk starts about 4 px clear`, Math.abs(startClearance - 4) <= 2, `start ${startClearance}, ${JSON.stringify(scrollRoom)}`);
        const trace = [];
        for (let i = 1; i <= Math.min(20, k); i++) {
          ed.chain().setTextSelection(starts[k - i]).scrollIntoView().run();
          await delay(150);
          trace.push({ clearance: top(starts[k - i]) - floor(), bottomGap: scroller.getBoundingClientRect().bottom - bottom(starts[k - i]) });
        }
        const clearances = trace.map((t) => t.clearance);
        const worst = { minClearance: Math.min(...clearances), maxClearance: Math.max(...clearances), minBottomGap: Math.min(...trace.map((t) => t.bottomGap)) };
        const detail = JSON.stringify(worst);
        check(`${tag} steps walked`, trace.length >= 15, `${trace.length} steps`);
        check(`${tag} below floor`, worst.minClearance >= -1, detail);
        check(`${tag} not over-scrolled`, worst.maxClearance <= 7, detail);
        check(`${tag} caret bottom inside scroller`, worst.minBottomGap >= -1, detail);
        check(`${tag} scrolled up`, scroller.scrollTop < startScroll, `${startScroll} -> ${scroller.scrollTop}`);
        return { zoom: zoomOf(ed.view.dom), steps: trace.length, ...worst, startClearance, ...scrollRoom, startScroll, endScroll: scroller.scrollTop, rulerShown: !!ruler, trace };
      };
      for (const [name, pages, zoom, ruler] of [
        ["page-75", true, 75, true], ["page-100", true, 100, true], ["page-150", true, 150, true],
        ["page-75-off", true, 75, false], ["cont-75", false, 75, true],
      ]) {
        await state(`state-ruler-caret-${name}`, async () => {
          try {
            await ensureMode(pages);
            await ensureRuler(ruler);
            await setZoom(`${zoom}%`);
            return { mode: pages ? "page" : "cont", ...(await caretWalk(rulerEd, `caret ${name}`)) };
          } finally {
            await ensureRuler(true);
          }
        });
      }
      // Two panes at 75%: each walks its own scroller and the other pane must not move.
      await state("state-ruler-caret-split-75", async () => {
        await ensureMode(true);
        await setZoom("75%");
        const beside = await wait(() => document.querySelector(`button[aria-label="Open ${LONG_SECTION} beside"]`), "Open beside button (ruler split)", 100);
        beside.click();
        await wait(() => document.querySelector('[aria-label="Right pane"]'), "right pane (ruler split)", 100);
        await delay(500);
        const out = {};
        for (const side of ["left", "right"]) {
          const ed = (await wait(() => document.querySelector(`.split-pane[data-side="${side}"] .ProseMirror`), `${side} editor`)).editor;
          if (ed.state.doc.childCount < 40)
            ed.commands.insertContentAt(
              ed.state.doc.content.size,
              Array.from({ length: 60 }, (_, i) => ({ type: "paragraph", content: [{ type: "text", text: `Pane fixture paragraph ${i + 1} gives this pane something to scroll.` }] })),
            );
          await delay(400);
          const other = document.querySelector(`.split-pane[data-side="${side === "left" ? "right" : "left"}"] .writer-scroll`);
          const otherBefore = other.scrollTop;
          out[side] = await caretWalk(ed, `caret split ${side}`);
          out[side].otherPaneMoved = other.scrollTop - otherBefore;
          check(`caret split ${side} leaves the other pane alone`, out[side].otherPaneMoved === 0, `moved ${out[side].otherPaneMoved}`);
        }
        return out;
      });
      document.querySelector('button[aria-label="Close right pane"]')?.click();
      await delay(300);
      // A selected image (NodeSelection) must be scrolled by its own box, like at zoom 100 (T243 r2).
      // The picture is taken by state() after fn returns, so the image is removed afterwards, not inside fn.
      let removeImage = async () => {};
      await state("state-ruler-node-image-75", async () => {
        await ensureMode(true);
        await setZoom("75%");
        const ed = (await wait(editor, "writing editor (image state)")).editor;
        const scroller = scrollerEl();
        const ruler = document.querySelector(".document-ruler");
        const floor = () => drawnRect(ruler).bottom;
        const at = paragraphStarts(ed)[30] - 1;
        // A valid asset id; with no resolver the figure is a small placeholder, so it is made 300 px tall.
        ed.commands.insertContentAt(at, { type: "image", attrs: { assetId: "ab".repeat(32), alt: "ruler fixture" } });
        removeImage = async () => {
          // Remove only the image this state inserted, never a fixture paragraph at the same position.
          const node = ed.state.doc.nodeAt(at);
          if (node?.type.name === "image" && node.attrs.alt === "ruler fixture") ed.chain().setNodeSelection(at).deleteSelection().run();
          await delay(300);
        };
        {
          await delay(500);
          const el = ed.view.nodeDOM(at);
          if (!(el instanceof Element)) throw Error("no image node drawn");
          el.style.minHeight = "300px";
          await delay(150);
          const before = drawnRect(el);
          // Image top 60% of its height above the ruler, then select the node and scroll to it.
          scroller.scrollTop += before.top - floor() + (before.bottom - before.top) * 0.6;
          await delay(300);
          const placed = drawnRect(el);
          ed.view.focus();
          ed.chain().setNodeSelection(at).scrollIntoView().run();
          await delay(500);
          const after = drawnRect(el);
          const sr = scroller.getBoundingClientRect();
          const m = {
            zoom: zoomOf(ed.view.dom), selection: ed.state.selection.toJSON().type,
            clearanceBefore: placed.top - floor(), clearance: after.top - floor(), bottomGap: sr.bottom - after.bottom,
          };
          check("image node selection is a node selection", m.selection === "node", m.selection);
          check("image started behind the ruler", m.clearanceBefore < -1, JSON.stringify(m));
          check("image top below ruler", m.clearance >= -1, JSON.stringify(m));
          check("image not over-scrolled", m.clearance <= 7, JSON.stringify(m));
          check("image bottom inside scroller", m.bottomGap >= -1, JSON.stringify(m));
          return m;
        }
      });
      await removeImage();
      // Sticky ruler with zoom, and the overflow-x: clip scroller, in both views at 150%.
      await state("state-ruler-sticky-clip", async () => {
        await setZoom("150%");
        const out = {};
        for (const [modeName, pages] of [["cont", false], ["page", true]]) {
          await ensureMode(pages);
          const scroller = scrollerEl();
          const viewport = document.querySelector(".editor-viewport");
          scroller.scrollTop = 0;
          scroller.scrollLeft = 0;
          await delay(250);
          const ruler = document.querySelector(".document-ruler");
          // At 0 the ruler still sits below the viewport's padding; it pins once scrolled.
          scroller.scrollTop = 300;
          await delay(250);
          const topAt300 = drawnRect(ruler).top - scroller.getBoundingClientRect().top;
          scroller.scrollTop = 600;
          await delay(300);
          const scrolled = scroller.scrollTop;
          const topAt600 = drawnRect(ruler).top - scroller.getBoundingClientRect().top;
          const bg = getComputedStyle(ruler).backgroundColor;
          scroller.scrollLeft = 60;
          viewport.scrollLeft = 60;
          const sheets = [...document.querySelectorAll(".page-sheet")].map((s) => drawnRect(s));
          const sr = scroller.getBoundingClientRect();
          out[modeName] = {
            position: getComputedStyle(ruler).position, drawnZoom: zoomOf(document.querySelector(".ProseMirror")),
            scrollTopApplied: scrolled, rulerTopAt300: topAt300, rulerTopAt600: topAt600,
            rulerBackground: bg,
            viewportOverflowX: getComputedStyle(viewport).overflowX, viewportOverflowY: getComputedStyle(viewport).overflowY,
            scrollerOverflowX: getComputedStyle(scroller).overflowX, scrollerOverflowY: getComputedStyle(scroller).overflowY,
            scrollerScrollMinusClient: scroller.scrollWidth - scroller.clientWidth,
            scrollLeftAfterWrite: scroller.scrollLeft, viewportScrollLeftAfterWrite: viewport.scrollLeft,
            sheetCount: sheets.length,
            sheetsWithinScroller: sheets.every((s) => s.left >= sr.left - 1 && s.right <= sr.right + 1),
          };
          check(`sticky ${modeName} scrolled`, scrolled > 100, `scrollTop ${scrolled}`);
          check(`sticky ${modeName} ruler pinned`, Math.abs(topAt600 - topAt300) <= 2, `top ${topAt300} -> ${topAt600}`);
          check(`sticky ${modeName} ruler at scroller top`, Math.abs(topAt600) <= 2, `distance from scroller top ${topAt600}`);
          check(`sticky ${modeName} ruler opaque`, !/rgba\(0, 0, 0, 0\)|transparent/.test(bg), bg);
          check(`clip ${modeName} no sideways scroll`, out[modeName].scrollLeftAfterWrite === 0 && out[modeName].viewportScrollLeftAfterWrite === 0, `scroller ${out[modeName].scrollLeftAfterWrite}, viewport ${out[modeName].viewportScrollLeftAfterWrite}`);
          if (pages) {
            check("clip page viewport overflow-x", out.page.viewportOverflowX === "clip", out.page.viewportOverflowX);
            check("clip page sheets within scroller", out.page.sheetsWithinScroller, JSON.stringify(sheets.map((s) => [s.left, s.right])));
          }
          scroller.scrollTop = 0;
        }
        return out;
      });
      // Top gap and margin through SQLite. Reads go to the Rust store (list_projects, load_project), the same
      // path a relaunch reads. A real quit and relaunch is not driven here.
      const projectId = async () => (await invoke("list_projects")).projects.find((p) => p.title === "Screens fixture")?.id;
      const savedLayout = async (id) => {
        const p = await invoke("load_project", { id });
        return { marginInches: p.documentSettings?.marginInches, layoutMargin: p.pageLayout?.margin, topGap: p.pageLayout?.topGap, mode: p.pageLayout?.mode, zoom: p.pageLayout?.zoom };
      };
      const savedWhen = async (id, test, label) => {
        let last;
        for (let i = 0; i < 40; i++) {
          last = await savedLayout(id);
          if (test(last)) return last;
          await delay(250);
        }
        throw Error(`${label} never reached SQLite; last ${JSON.stringify(last)}`);
      };
      await state("state-gap-persist", async () => {
        await setZoom("100%");
        await ensureMode(false);
        const id = await wait(projectId, "fixture project id", 50);
        const gapHandle = await wait(() => document.querySelector(".continuous-top-gap-handle"), "top gap handle");
        const startGap = Number(gapHandle.getAttribute("aria-valuenow"));
        const baseline = await savedLayout(id);
        gapHandle.focus();
        key(gapHandle, { key: "ArrowDown", code: "ArrowDown", shiftKey: true });
        await delay(100);
        const shownGap = Number(document.querySelector(".continuous-top-gap-handle").getAttribute("aria-valuenow"));
        const after = await savedWhen(id, (s) => s.topGap === startGap + 16, "top gap");
        check("gap changed on screen", shownGap === startGap + 16, `${startGap} -> ${shownGap}`);
        check("gap-only change leaves marginInches", after.marginInches === baseline.marginInches && after.layoutMargin === baseline.layoutMargin, JSON.stringify({ baseline, after }));
        return { startGap, shownGap, baseline, after, topGapAbsentBefore: baseline.topGap === undefined };
      });
      await state("state-margin-persist", async () => {
        const id = await wait(projectId, "fixture project id", 50);
        const before = await savedLayout(id);
        const marker = await wait(() => document.querySelector(".ruler-margin-marker--left"), "left margin marker");
        const startMargin = Number(marker.getAttribute("aria-valuenow"));
        marker.focus();
        key(marker, { key: "ArrowRight", code: "ArrowRight", shiftKey: true });
        await delay(100);
        const shownMargin = Number(document.querySelector(".ruler-margin-marker--left").getAttribute("aria-valuenow"));
        const after = await savedWhen(id, (s) => s.layoutMargin === startMargin + 24, "margin");
        check("margin changed on screen", shownMargin === startMargin + 24, `${startMargin} -> ${shownMargin}`);
        check("marginInches follows the margin", Math.abs(after.marginInches - after.layoutMargin / 96) < 0.01, JSON.stringify(after));
        check("margin change keeps the gap", after.topGap === before.topGap, JSON.stringify({ before, after }));
        await delay(300);
        return { startMargin, shownMargin, before, after, ...measureRuler("margin-persist") };
      });
    }
    // Row hover grows its rail line (synthetic pointermove: the dock listens to pointer events, as the toolbar state does).
    await state("state-row-hover-rail", async () => {
      await click("Manuscript");
      const row = await wait(() => button(LONG_SECTION), "long section row", 100);
      const line = await wait(() => railLine("manuscript", LONG_SECTION), "long section line", 100);
      const grab = () => {
        const r = line.getBoundingClientRect();
        return { width: r.width, height: r.height, mag: line.style.getPropertyValue("--spy-mag") || "0" };
      };
      const rest = grab();
      const rr = row.getBoundingClientRect();
      const init = { bubbles: true, clientX: rr.left + rr.width / 2, clientY: rr.top + rr.height / 2, pointerType: "mouse" };
      row.dispatchEvent(new PointerEvent("pointermove", init));
      await delay(500);
      const hovered = grab();
      check("row hover grows its rail line", hovered.width > rest.width + 1 || hovered.height > rest.height + 0.5, JSON.stringify({ rest, hovered }));
      return { rest, hovered, reducedMotion: matchMedia("(prefers-reduced-motion: reduce)").matches };
    });
    document.querySelector(".sidebar-groups")?.dispatchEvent(new PointerEvent("pointerleave", { bubbles: false }));
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

    await report({ ok: true, screens, pdfProbe, states, stateErrors, measures, measureFailures });
    await invoke("smoke_close_window");
  } catch (error) {
    await report({ ok: false, screens: [], error: String(error?.message ?? error) });
  }
})();
