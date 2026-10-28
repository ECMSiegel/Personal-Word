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
        offsetHeight: paper.offsetHeight,
        spacers: document.querySelectorAll(".page-spacer").length,
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
  // Page-view gate (wave 3, P2): typing latency and caret movement across a
  // page gap measured inside WKWebView. Run with FOLIO_SMOKE_PHASE=pages-probe.
  let probe = null;
  const frames = () =>
    new Promise((resolve) =>
      requestAnimationFrame(() => requestAnimationFrame(resolve)),
    );
  const stats = (values) => {
    const sorted = [...values].sort((a, b) => a - b);
    const at = (q) => sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * q) - 1)];
    const round = (value) => Math.round(value * 100) / 100;
    return {
      n: sorted.length,
      p50: round(sorted[Math.floor(sorted.length / 2)]),
      p95: round(at(0.95)),
      max: round(sorted[sorted.length - 1]),
    };
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
  const pagesProbe = async () => {
    const el = await wait(editor, "editor");
    const tiptap = el.editor;
    const words = ["alpha", "beta", "gamma", "delta", "evidence", "measure", "page"];
    const blocks = [];
    for (let i = 0; i < 640; i++) {
      if (i % 12 === 0)
        blocks.push({
          type: "heading",
          attrs: { level: 2 },
          content: [{ type: "text", text: "Heading " + (i / 12 + 1) }],
        });
      const text = Array.from(
        { length: 28 + (i % 9) * 4 },
        (_, j) => words[(i + j) % 7],
      ).join(" ");
      blocks.push({
        type: "paragraph",
        content: [{ type: "text", text: "P" + i + " " + text + "." }],
      });
    }
    tiptap.commands.setContent({ type: "doc", content: blocks }, { emitUpdate: true });
    await saved();
    step("seeded a 640-paragraph section");
    if (!document.querySelector('[aria-label="Page view"]'))
      document.querySelector('[aria-label="More formatting"]')?.click();
    (await wait(() => document.querySelector('[aria-label="Page view"]'), "page toggle")).click();
    await wait(() => document.querySelector(".editor-viewport.is-paged"), "page view");
    await closeMore();
    await wait(
      () => /of \d\d/.test(document.querySelector('[aria-label="Page count"]')?.textContent ?? ""),
      "page count of ten or more",
    );
    await delay(1000);
    const paged = {
      pageCount: document.querySelector('[aria-label="Page count"]')?.textContent?.trim(),
      spacers: document.querySelectorAll(".page-spacer").length,
      paperZoom: getComputedStyle(document.querySelector(".editor-paper")).zoom,
    };
    step("page view with " + paged.pageCount);
    // One synthetic keystroke = keydown + insertText, the same input path
    // ProseMirror takes for a typed character. sync = keydown -> editor
    // update; paint = keydown -> second animation frame (after the pagination
    // re-measure). Each keystroke waits for its paint before the next.
    const sample = async (where) => {
      if (where === "start") tiptap.commands.setTextSelection(3);
      else {
        let target = 3;
        let index = 0;
        tiptap.state.doc.forEach((node, offset) => {
          if (index++ === Math.floor(tiptap.state.doc.childCount / 2)) target = offset + 3;
        });
        tiptap.commands.setTextSelection(target);
      }
      tiptap.commands.focus();
      await frames();
      const sync = [];
      const paint = [];
      for (let i = 0; i < 200; i++) {
        let resolveUpdate;
        const updated = new Promise((resolve) => (resolveUpdate = resolve));
        const onUpdate = () => resolveUpdate(performance.now());
        tiptap.once("update", onUpdate);
        const t0 = performance.now();
        el.dispatchEvent(
          new KeyboardEvent("keydown", { key: "x", code: "KeyX", bubbles: true, cancelable: true }),
        );
        const painted = frames().then(() => performance.now());
        document.execCommand("insertText", false, "x");
        const t1 = await Promise.race([updated, delay(1000).then(() => null)]);
        if (t1 === null) {
          tiptap.off("update", onUpdate);
          throw Error("Probe keystroke " + i + " produced no editor update");
        }
        sync.push(t1 - t0);
        paint.push((await painted) - t0);
        await delay(8);
      }
      return { sync: stats(sync), paint: stats(paint) };
    };
    const latency = { start: await sample("start"), middle: await sample("middle") };
    step("latency sampled");
    // Caret across the first page gap inside a paragraph and the first gap
    // between blocks. Keys go through ProseMirror as a real key press would;
    // when the editor leaves a key to the browser, WebKit's own line movement
    // (Selection.modify) moves the caret, as it does for a real key.
    let caret = null;
    const view = tiptap.view;
    // The line a position's caret sits on: the top of the character after it
    // (a position where a line wraps belongs to the line it starts), or the
    // caret rectangle at the end of a block.
    const top = (pos) => {
      const { node, offset } = view.domAtPos(pos);
      if (node.nodeType === 3 && offset < node.data.length) {
        const range = document.createRange();
        range.setStart(node, offset);
        range.setEnd(node, offset + 1);
        const rects = range.getClientRects();
        if (rects.length) return Math.round(rects[rects.length - 1].top);
      }
      return Math.round(view.coordsAtPos(pos).top);
    };
    const at = async (pos) => {
      tiptap.commands.setTextSelection(pos);
      tiptap.commands.focus();
      await delay(60);
    };
    const press = async (key, shift) => {
      const event = new KeyboardEvent("keydown", { key, shiftKey: shift, bubbles: true, cancelable: true });
      const handled = !view.dom.dispatchEvent(event);
      if (!handled)
        getSelection().modify(shift ? "extend" : "move", key === "ArrowDown" ? "forward" : "backward", "line");
      await delay(80);
      const { from, to, anchor, head } = tiptap.state.selection;
      // A position where a line wraps reads as either line (`tops`, kept as
      // diagnostics); a move passes on `drawn`, WebKit's own rectangle for the
      // DOM selection, which is where it draws the caret.
      const tops = [top(head), Math.round(view.coordsAtPos(head).top)];
      const sel = getSelection();
      const r = sel.rangeCount ? sel.getRangeAt(0).getBoundingClientRect() : null;
      return { from, to, anchor, head, top: tops[0], tops, drawn: r ? Math.round(r.top) : null, handled };
    };
    const across = async (spacer) => {
      let before, after, prev, next;
      if (spacer.dataset.inline) {
        const parent = spacer.parentNode;
        const pos = view.posAtDOM(parent, [...parent.childNodes].indexOf(spacer));
        before = pos - 2;
        after = pos + 2;
        // A margin click keeps the caret on the page above: one character back.
        prev = pos - 1;
        next = pos;
      } else {
        const above = spacer.previousElementSibling;
        prev = before = view.posAtDOM(above, above.childNodes.length);
        next = after = view.posAtDOM(spacer.nextElementSibling, 0);
      }
      spacer.scrollIntoView({ block: "center" });
      await frames();
      const page1Last = top(before);
      const page2First = top(after);
      await at(before);
      const down = await press("ArrowDown", false);
      const back = await press("ArrowUp", false);
      await at(after);
      const geometry = (() => {
        const c = view.coordsAtPos(tiptap.state.selection.head);
        const r = spacer.getBoundingClientRect();
        const p = spacer.dataset.inline ? null : spacer.previousElementSibling;
        return {
          caretTop: c.top,
          caretBottom: c.bottom,
          spacerTop: r.top,
          spacerBottom: r.bottom,
          above: p ? p.getBoundingClientRect().bottom : r.top,
          scrollTop: spacer.closest(".is-paged")?.scrollTop,
        };
      })();
      const up = await press("ArrowUp", false);
      // From the far right of the first line below the gap.
      await at(after);
      getSelection().modify("move", "forward", "lineboundary");
      await delay(60);
      const upFromEnd = await press("ArrowUp", false);
      await at(before - 5);
      const extend = await press("ArrowDown", true);
      const rect = spacer.getBoundingClientRect();
      const height = parseFloat(spacer.style.height);
      const scale = rect.height / height;
      const split = Number(spacer.dataset.split);
      const clickAt = async (y) => {
        const x = rect.left + rect.width / 2;
        const target = document.elementFromPoint(x, y);
        target?.dispatchEvent(
          new MouseEvent("mousedown", { clientX: x, clientY: y, bubbles: true, cancelable: true, button: 0 }),
        );
        target?.dispatchEvent(
          new MouseEvent("mouseup", { clientX: x, clientY: y, bubbles: true, cancelable: true, button: 0 }),
        );
        await delay(80);
        return {
          hit: target?.className ?? String(target),
          from: tiptap.state.selection.from,
        };
      };
      const gap = await clickAt(rect.top + (split + 16) * scale);
      const margin = await clickAt(rect.top + (split - 40) * scale);
      return {
        before,
        after,
        page1Last,
        page2First,
        down,
        back,
        up,
        upFromEnd,
        extend,
        gap,
        margin,
        geometry,
        pass: {
          downToPage2First: down.from >= next && down.drawn === page2First,
          upReturns: back.drawn === page1Last,
          upFromPage2ToPage1Last:
            up.from <= prev && up.drawn === page1Last &&
            upFromEnd.from <= prev && upFromEnd.drawn === page1Last,
          shiftDownExtends: extend.anchor === before - 5 && extend.head >= next,
          gapClickToPage2Start: gap.from === next,
          marginClickToPage1End: margin.from === prev,
        },
      };
    };
    const spacers = [...el.querySelectorAll(".page-spacer")];
    const inlineSpacer = spacers.find((s) => s.dataset.inline);
    const blockSpacer = spacers.find((s) => !s.dataset.inline);
    if (inlineSpacer || blockSpacer) {
      const inline = inlineSpacer ? await across(inlineSpacer) : null;
      const block = blockSpacer ? await across(blockSpacer) : null;
      const runs = [inline, block].filter(Boolean);
      caret = {
        inline,
        block,
        pass: Object.fromEntries(
          Object.keys(runs[0].pass).map((k) => [k, runs.every((r) => r.pass[k])]),
        ),
      };
      step("caret checks recorded");
    }
    // Narrow-pane numbers (585 px, the width of a half-screen split pane). The
    // viewport is squeezed to 585 px so the app's own fit logic sets the paper
    // zoom, then page starts and footnote references are read two ways:
    // offsetTop (what footnote placement uses, no zoom guard) and rect / zoom.
    // If WebKit reports offsetTop zoomed, the two disagree and refPage differs.
    let narrow = null;
    try {
      const viewport = document.querySelector(".editor-viewport.is-paged");
      const paper = document.querySelector(".editor-paper");
      // Seed footnote references (ids without notes, so no footnote UI): the
      // 3rd paragraph of every 8th block, spread over the whole document.
      const refNodes = [];
      let seen = 0;
      tiptap.state.doc.forEach((node, offset) => {
        if (node.type.name === "paragraph" && seen++ % 40 === 7)
          refNodes.push(offset + node.nodeSize - 1);
      });
      refNodes.reverse().forEach((pos, i) =>
        tiptap.chain().insertContentAt(pos, { type: "footnoteReference", attrs: { id: "probe-fn-" + i } }).run(),
      );
      viewport.style.width = "585px";
      viewport.style.maxWidth = "585px";
      await delay(1200);
      await frames();
      const style = getComputedStyle(paper);
      const zoom = parseFloat(style.zoom) || 1;
      const surface = el;
      const surfaceRect = surface.getBoundingClientRect();
      const ratio = surfaceRect.width / (surface.offsetWidth || 1);
      const scale = Math.abs(ratio - zoom) <= Math.abs(ratio - 1) ? zoom : 1;
      const offsetWithin = (node) => {
        let y = 0;
        let cur = node;
        while (cur && cur !== surface) {
          y += cur.offsetTop;
          const parent = cur.offsetParent;
          if (parent === surface) return y;
          cur = parent;
        }
        return cur === surface ? y : NaN;
      };
      const rectTop = (node) => (node.getBoundingClientRect().top - surfaceRect.top) / scale;
      const spacers = [...el.querySelectorAll(".page-spacer")];
      const pitch = (parseFloat(style.getPropertyValue("--page-height")) || 1056) + (parseFloat(style.getPropertyValue("--page-gap")) || 32);
      // A page's first line starts at its spacer's bottom (a spacer sits before
      // a block, or inside a paragraph that runs on to the next page).
      const pageStarts = spacers.slice(0, 12).map((sp, i) => {
        const ot = offsetWithin(sp) + sp.offsetHeight;
        const rt = (sp.getBoundingClientRect().bottom - surfaceRect.top) / scale;
        return { page: i + 2, expectedTop: Math.round((i + 1) * pitch), offsetTop: Math.round(ot), rectOverZoom: Math.round(rt * 10) / 10, drift: Math.round(ot - (i + 1) * pitch) };
      });
      const refs = [...el.querySelectorAll("[data-footnote-id]")].map((node) => {
        const ot = offsetWithin(node);
        const rt = rectTop(node);
        return {
          id: node.dataset.footnoteId,
          offsetTop: Math.round(ot),
          rectOverZoom: Math.round(rt),
          pageByOffsetTop: Math.floor(ot / pitch) + 1,
          pageByRect: Math.floor(rt / pitch) + 1,
        };
      });
      narrow = {
        width: viewport.clientWidth,
        zoom: style.zoom,
        pageScale: style.getPropertyValue("--page-scale"),
        rectRatio: Math.round(ratio * 1000) / 1000,
        pitch,
        spacers: spacers.length,
        pageStarts,
        refs,
        refPageMismatches: refs.filter((r) => r.pageByOffsetTop !== r.pageByRect).length,
        maxPageStartDrift: Math.max(0, ...pageStarts.map((p) => Math.abs(p.drift))),
      };
      viewport.style.width = "";
      viewport.style.maxWidth = "";
      step("narrow pane numbers recorded");
    } catch (error) {
      narrow = { error: String(error) };
    }
    probe = { paged, latency, caret, narrow, userAgent: navigator.userAgent };
  };
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
    if (window.__SMOKE_PHASE__ === "pages-probe") {
      if (!button("Start new project")) await click("Projects");
      await click("Start new project");
      await click("Blank");
      await input("Project title", "Native pages probe");
      await click("Save");
      await saved();
      await pagesProbe();
    } else if (window.__SMOKE_PHASE__ === "1") {
      // Only clear the last-project navigation key in this isolated test application.
      if (!button("Start new project")) {
        // The sidebar title renames in place; the Projects tab goes back.
        await click("Projects");
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
        await closeMore();
      };
      await clickPageToggle();
      await wait(
        () => document.querySelector(".editor-viewport.is-paged"),
        "page view mode",
      );
      // Pages stack vertically: the long paragraph runs down past page 1, so
      // the paper grows taller than one page (it is not split into columns).
      await wait(() => {
        const paper = document.querySelector(".editor-paper");
        const height = parseFloat(
          paper ? getComputedStyle(paper).getPropertyValue("--page-height") : "",
        );
        return height > 0 && paper.offsetHeight > 2 * height;
      }, "native vertical pagination");
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
      step("native WebKit vertical pages and continuous toggle");
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
        probe,
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
        probe,
        diagnosticProfile,
        diagnostics: diagnostics(),
        body: document.body.innerText.slice(0, 2000),
      },
    });
  }
})();
