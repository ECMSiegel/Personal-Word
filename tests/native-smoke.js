(async () => {
  const steps = [];
  const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  // Breadcrumbs to the harness-owned progress file: a stalled native run then names
  // the step and wait it reached instead of only timing out.
  const mark = (message) => {
    try {
      void window.__TAURI_INTERNALS__.invoke("smoke_progress", {
        message: `${window.__SMOKE_PHASE__} ${Math.round(
          performance.now(),
        )}ms ${message}`,
      });
    } catch {
      /* diagnostics only */
    }
  };
  mark("script start");
  const wait = async (fn, label) => {
    mark("wait " + label);
    for (let i = 0; i < 500; i++) {
      const result = fn();
      if (result) {
        mark("ok " + label);
        return result;
      }
      await delay(40);
    }
    throw Error("Timed out: " + label);
  };
  const step = (name) => {
    steps.push(name);
    mark("step " + name);
  };
  const button = (text) =>
    [...document.querySelectorAll("button")].find(
      (b) =>
        b.textContent.trim() === text ||
        (b.classList.contains("entry-main") &&
          b.querySelector("span")?.textContent === text),
    );
  const click = async (text) => {
    (await wait(() => button(text), text)).click();
    await delay(60);
  };
  const input = async (label, text) => {
    const el = await wait(
      () =>
        [...document.querySelectorAll("label")]
          .find((l) => l.textContent === label)
          ?.querySelector("input"),
      label,
    );
    Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      "value",
    ).set.call(el, text);
    el.dispatchEvent(new Event("input", { bubbles: true }));
    await delay(50);
  };
  const editor = () => document.querySelector('[aria-label="Writing editor"]');
  const type = async (text) => {
    const el = await wait(editor, "editor");
    el.focus();
    const range = document.createRange();
    range.selectNodeContents(el);
    const selection = getSelection();
    selection.removeAllRanges();
    selection.addRange(range);
    document.execCommand("insertText", false, text);
  };
  const saved = () =>
    wait(
      () => document.querySelector(".save-status")?.textContent === "Saved",
      "saved",
    );
  // Reports measured geometry so a page-layout failure names its cause instead of
  // only the missing label. DOM readings only; nothing is written to the document.
  const diagnostics = () => {
    const surface = editor();
    const paper = document.querySelector(".editor-paper");
    const paragraph = surface?.querySelector("p");
    const round = (value) => Math.round(value);
    const box = (node) => {
      if (!node) return null;
      const rect = node.getBoundingClientRect();
      return {
        width: round(rect.width),
        height: round(rect.height),
        left: round(rect.left),
      };
    };
    const surfaceStyle = surface ? getComputedStyle(surface) : null;
    const paperStyle = paper ? getComputedStyle(paper) : null;
    return {
      viewport: [window.innerWidth, window.innerHeight],
      visibility: `${document.visibilityState} focus=${document.hasFocus()}`,
      mode: document.querySelector(".is-paged")
        ? "pages"
        : document.querySelector(".is-continuous")
          ? "continuous"
          : "unknown",
      pageViewToggle: document.querySelector('[aria-label="Page view"]')
        ? "visible"
        : "overflowed",
      pageCountLabel: document
        .querySelector('[aria-label="Page count"]')
        ?.textContent?.trim(),
      surface: surface && {
        scrollWidth: surface.scrollWidth,
        clientWidth: surface.clientWidth,
        scrollHeight: surface.scrollHeight,
        clientHeight: surface.clientHeight,
        box: box(surface),
        columnWidth: surfaceStyle.columnWidth,
        columnCount: surfaceStyle.columnCount,
        columnGap: surfaceStyle.columnGap,
        height: surfaceStyle.height,
        width: surfaceStyle.width,
      },
      paper: paper && {
        scrollWidth: paper.scrollWidth,
        clientWidth: paper.clientWidth,
        box: box(paper),
        width: paperStyle.width,
        minHeight: paperStyle.minHeight,
        pageCount: paperStyle.getPropertyValue("--page-count").trim(),
        pageWidth: paperStyle.getPropertyValue("--page-width").trim(),
        contentWidth: paperStyle.getPropertyValue("--content-width").trim(),
        contentHeight: paperStyle.getPropertyValue("--content-height").trim(),
        footnoteReserve: paperStyle
          .getPropertyValue("--footnote-reserve")
          .trim(),
      },
      paragraph: paragraph && {
        rects: [...paragraph.getClientRects()].map((rect) => [
          round(rect.left),
          round(rect.top),
          round(rect.width),
        ]),
      },
    };
  };
  let diagnosticProfile;
  try {
    await wait(() => document.querySelector(".app"), "application mounted");
    diagnosticProfile = await window.__TAURI_INTERNALS__.invoke(
      "diagnostic_profile_identity",
    );
    if (
      diagnosticProfile.appIdentifier !== "com.folio.smoke" ||
      diagnosticProfile.protocol !== "d1-profile-isolation-v1" ||
      diagnosticProfile.dataStoreIdentifier !== window.__SMOKE_DATA_STORE_ID__ ||
      !diagnosticProfile.activeDataStoreIdentifiers.includes(
        window.__SMOKE_DATA_STORE_ID__,
      )
    ) {
      throw Error("Native smoke app or isolated WebKit profile identity mismatch");
    }
    localStorage.setItem("personal-word.restoreTabs", "true");
    if (window.__SMOKE_PHASE__ === "1") {
      // Only clear the last-project navigation key in this isolated test application.
      if (!button("Start new project")) {
        await click(
          document.querySelector(".project-switch")?.textContent.trim(),
        );
      }
      await click("Start new project");
      await click("Blank");
      await input("Project title", "Native durability check");
      await click("Save");
      await saved();
      step("native project creation");
      await type("Acknowledged SQLite checkpoint.");
      await saved();
      step("acknowledged native checkpoint");
      await type(
        "Native page flow keeps the same editor and document. ".repeat(300),
      );
      // The compact toolbar can overflow the page toggle into More formatting;
      // click through that popover once instead of retoggling it on every poll.
      const clickPageToggle = async () => {
        if (!document.querySelector('[aria-label="Page view"]')) {
          mark("opening More formatting for page toggle");
          document.querySelector('[aria-label="More formatting"]')?.click();
          await wait(
            () => document.querySelector('[aria-label="Page view"]'),
            "page view toggle",
          );
        }
        document.querySelector('[aria-label="Page view"]').click();
        mark("page toggle clicked");
      };
      await clickPageToggle();
      await wait(
        () => document.querySelector(".editor-viewport.is-paged"),
        "page view mode",
      );
      await wait(() => {
        const el = editor();
        return el?.querySelector("p")?.getClientRects().length > 1;
      }, "native paragraph pagination");
      const pageCount = () =>
        document.querySelector('[aria-label="Page count"]')?.textContent;
      for (let i = 0; i < 75 && !/of [2-9]/.test(pageCount() ?? ""); i++)
        await delay(40);
      const count = pageCount();
      mark("page count " + count);
      if (!count || !/of [2-9]/.test(count))
        throw Error(
          "Native page count did not reflect overflowing text: " +
            count +
            " " +
            JSON.stringify(diagnostics()),
        );
      await clickPageToggle();
      await wait(
        () =>
          document
            .querySelector('[aria-label="Page view"]')
            ?.getAttribute("aria-pressed") === "false",
        "continuous view",
      );
      step("native WebKit page fragmentation and continuous toggle");
      await type("Original prose kept for a fragment.");
      await wait(
        () => document.querySelector('[aria-label="New section"]'),
        "new section",
      );
      document.querySelector('[aria-label="New section"]').click();
      await input("Title", "Second section");
      await click("Save");
      await type("Second section survives switching.");
      await click("Opening");
      await wait(
        () => editor()?.textContent === "Original prose kept for a fragment.",
        "rapid section switch",
      );
      step("rapid edit and section switch");
      const el = editor();
      el.focus();
      const range = document.createRange();
      range.selectNodeContents(el);
      getSelection().removeAllRanges();
      getSelection().addRange(range);
      document.dispatchEvent(new Event("selectionchange"));
      await delay(100);
      await click("Keep as fragment");
      await wait(
        () => !editor()?.textContent.includes("Original prose"),
        "cut",
      );
      await click("Original prose kept for a fragment.");
      await wait(
        () => editor()?.textContent.includes("Original prose"),
        "fragment",
      );
      await click("Append to section →");
      await wait(
        () => editor()?.textContent.includes("Original prose"),
        "restored",
      );
      step("fragment extraction and restoration");
      await click("Snapshot");
      await input("Snapshot name", "Native milestone");
      await click("Save");
      await wait(
        () => !document.querySelector('[role="dialog"]'),
        "snapshot saved",
      );
      step("named snapshot");
      await type("Rapid final text must survive native quit.");
      await saved();
      step("typed immediately before quit");
    } else if (window.__SMOKE_PHASE__ === "2") {
      await wait(
        () =>
          editor()?.textContent.includes(
            "Rapid final text must survive native quit.",
          ),
        "reopened latest writing after normal quit",
      );
      step("normal quit and reopen preserved the latest saved edit");
      await type("Acknowledged SQLite checkpoint.");
      await saved();
      // The status can still read "Saved" from the previous save, so give the
      // 250 ms trailing debounce time to commit this checkpoint before the
      // journaled edit below deliberately stays unsaved.
      await delay(600);
      step("acknowledged SQLite checkpoint before deliberate kill");
      await type("Journaled recovery after deliberate kill.");
      step("queued recovery journal edit before deliberate kill");
    } else {
      await wait(
        () =>
          editor()?.textContent.includes(
            "Journaled recovery after deliberate kill.",
          ),
        "journal recovery after deliberate process termination",
      );
      step("forced restart recovered the journaled edit");
      await saved();
      await click("Snapshots & history");
      await wait(
        () => document.querySelector(".version-item"),
        "snapshot list after forced restart",
      );
      document.querySelector(".version-item").click();
      await wait(() => button("Restore this version"), "snapshot preview");
      await click("Restore this version");
      await wait(
        () =>
          editor()?.textContent.includes("Original prose kept for a fragment."),
        "snapshot restoration",
      );
      await saved();
      step("snapshot restoration after forced restart");
    }
    await window.__TAURI_INTERNALS__.invoke("smoke_report", {
      report: {
        ok: true,
        phase: window.__SMOKE_PHASE__,
        steps,
        diagnosticProfile,
        diagnostics: diagnostics(),
      },
    });
  } catch (error) {
    await window.__TAURI_INTERNALS__.invoke("smoke_report", {
      report: {
        ok: false,
        error: String(error),
        steps,
        diagnosticProfile,
        diagnostics: diagnostics(),
        body: document.body.innerText.slice(0, 2000),
      },
    });
  }
})();
