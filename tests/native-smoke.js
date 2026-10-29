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
  // Wave 4 G1 (T171): toolbar zoom and caret-in-gap probe, run with
  // FOLIO_SMOKE_PHASE=pages-zoom. Raw WebKit numbers: which coordinate space
  // getBoundingClientRect, offsetTop and Range rects use under CSS zoom, page
  // starts at every toolbar zoom, snapshots across page gaps (the harness scans
  // their pixels), and a seeded Enter/typing/Backspace fuzz that checks the
  // caret and every empty paragraph stay inside a page's text area.
  const pagesZoomProbe = async () => {
    const el = await wait(editor, "editor");
    const tiptap = el.editor;
    const view = tiptap.view;
    const para = (text) => (text ? { type: "paragraph", content: [{ type: "text", text }] } : { type: "paragraph" });
    const blocks = [];
    // The owner's shape (1.png, 3.png): a word, a run of empty lines, short lines, twice.
    for (let t = 0; t < 2; t++) {
      blocks.push(para(t ? "hjoij " + t : "hjoij"));
      for (let i = 0; i < 26; i++) blocks.push(para(""));
      for (const text of ["khoihdowiahj", "kihjdowaihdowiadoanw", "nldkjwand", "", "dkwajbdwa", "djkwajbdwajk"])
        blocks.push(para(text));
      for (let i = 0; i < 6; i++) blocks.push(para(""));
    }
    const words = ["alpha", "beta", "gamma", "delta", "evidence", "measure", "page"];
    for (let i = 0; i < 90; i++)
      blocks.push(para("P" + i + " " + Array.from({ length: 28 + (i % 9) * 4 }, (_, j) => words[(i + j) % 7]).join(" ") + "."));
    tiptap.commands.setContent({ type: "doc", content: blocks }, { emitUpdate: true });
    await saved();
    step("seeded owner shape + 90 paragraphs");
    if (!document.querySelector('[aria-label="Page view"]'))
      document.querySelector('[aria-label="More formatting"]')?.click();
    (await wait(() => document.querySelector('[aria-label="Page view"]'), "page toggle")).click();
    await wait(() => document.querySelector(".editor-viewport.is-paged"), "page view");
    await closeMore();
    await delay(1200);
    const paper = () => document.querySelector(".editor-paper");
    const scroller = () => el.closest(".writer-scroll") || el.closest(".is-paged");
    const setZoom = async (percent) => {
      let trigger = document.querySelector('button[aria-label="Editor zoom"]');
      if (!trigger) {
        document.querySelector('[aria-label="More formatting"]')?.click();
        trigger = await wait(() => document.querySelector('button[aria-label="Editor zoom"]'), "zoom trigger");
      }
      trigger.click();
      const option = await wait(
        () => [...document.querySelectorAll('[role="option"]')].find((o) => o.textContent.trim() === percent + "%"),
        "zoom option " + percent,
      );
      option.click();
      await delay(100);
      await closeMore();
      // Paper zoom = toolbar zoom x fit scale (125 and 150 % are scaled to fit a 1240 px window).
      await wait(() => {
        const style = getComputedStyle(paper());
        const fit = parseFloat(style.getPropertyValue("--page-scale")) || 1;
        return Math.abs((parseFloat(style.zoom) || 1) - (percent / 100) * fit) < 0.001 && (percent === 100 || style.zoom !== "1");
      }, "zoom " + percent);
      await delay(1200);
      await frames();
    };
    const round = (v) => Math.round(v * 100) / 100;
    const within = (node) => {
      let y = 0;
      let cur = node;
      while (cur && cur !== el) {
        y += cur.offsetTop;
        cur = cur.offsetParent;
      }
      return cur === el ? y : NaN;
    };
    const space = () => {
      const p = paper();
      const vars = getComputedStyle(p);
      const num = (name) => parseFloat(vars.getPropertyValue(name)) || 0;
      const zoom = parseFloat(vars.zoom) || 1;
      const surfaceRect = el.getBoundingClientRect();
      const paperRect = p.getBoundingClientRect();
      const ratio = el.offsetWidth ? surfaceRect.width / el.offsetWidth : 1;
      return {
        zoom,
        ratio,
        paperRatio: p.offsetWidth ? paperRect.width / p.offsetWidth : 1,
        scale: Math.abs(ratio - zoom) <= Math.abs(ratio - 1) ? zoom : 1,
        pageHeight: num("--page-height"),
        gap: num("--page-gap"),
        margin: num("--page-margin"),
        reserve: num("--footnote-reserve"),
        pitch: num("--page-height") + num("--page-gap"),
        surfaceRect,
        paperRect,
      };
    };
    // The drawn caret and every empty paragraph must lie in a page's text area
    // (the same check as tests/pages-helpers.ts invariantSource).
    const invariant = () => {
      const s = space();
      const limit = s.pageHeight - 2 * s.margin - s.reserve;
      const where = (top, bottom) => {
        const page = Math.max(0, Math.floor((top + 1) / s.pitch));
        const start = page * s.pitch;
        const ok = top >= start - 1 && bottom <= start + limit + 1;
        const off = top - start - limit;
        const zone = ok ? "text" : off < s.margin ? "margin" : off < s.margin + s.gap ? "gap" : "top-margin";
        return { page, ok, zone, top: round(top), bottom: round(bottom) };
      };
      const { head } = tiptap.state.selection;
      let rect = null;
      let source = "dom";
      const sel = getSelection();
      // A selected node (Backspace after a page break) shows no caret: use its box.
      const picked = tiptap.state.selection.node;
      const nodeDom = picked ? view.nodeDOM(tiptap.state.selection.from) : null;
      if (nodeDom && nodeDom.getBoundingClientRect) {
        rect = nodeDom.getBoundingClientRect();
        source = "node:" + picked.type.name;
      } else if (sel && sel.rangeCount && el.contains(sel.focusNode)) {
        const range = sel.getRangeAt(0);
        const rects = range.getClientRects();
        rect = rects.length ? rects[rects.length - 1] : range.getBoundingClientRect();
        if (!rect || !rect.height) rect = null;
      }
      if (!rect) {
        source = "pm";
        const c = view.coordsAtPos(head);
        rect = { top: c.top, bottom: c.bottom };
      }
      const caret = { head, source, ...where((rect.top - s.surfaceRect.top) / s.scale, (rect.bottom - s.surfaceRect.top) / s.scale) };
      const empties = [];
      let index = 0;
      for (const child of el.children) {
        if (child.classList.contains("page-spacer")) continue;
        index++;
        if (child.tagName !== "P" || child.textContent !== "" || child.querySelector(".page-spacer")) continue;
        const top = within(child);
        const w = where(top, top + child.offsetHeight);
        if (!w.ok) empties.push({ block: index - 1, ...w });
      }
      return { caret, empties };
    };
    const geometry = () => {
      const s = space();
      const spacers = [...el.querySelectorAll(".page-spacer")];
      const starts = spacers.map((sp) => {
        const expected = (Number(sp.dataset.page) - 1) * s.pitch;
        return {
          page: Number(sp.dataset.page),
          inline: !!sp.dataset.inline,
          layout: within(sp) + sp.offsetHeight - expected,
          drawn: round((sp.getBoundingClientRect().bottom - s.paperRect.top) / s.scale - (expected + s.margin)),
          offsetHeight: sp.offsetHeight,
          styleHeight: parseFloat(sp.style.height),
          rectHeight: round(sp.getBoundingClientRect().height),
        };
      });
      const limit = s.pageHeight - 2 * s.margin - s.reserve;
      const crossings = [];
      const range = document.createRange();
      const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
      for (let node = walker.nextNode(); node; node = walker.nextNode()) {
        range.selectNodeContents(node);
        for (const r of range.getClientRects()) {
          if (!r.height) continue;
          const top = (r.top - s.surfaceRect.top) / s.scale;
          const bottom = (r.bottom - s.surfaceRect.top) / s.scale;
          const index = Math.floor((top + 1) / s.pitch);
          if (bottom > index * s.pitch + limit + 1) crossings.push(node.textContent.slice(0, 12) + " " + round(top) + "-" + round(bottom));
        }
      }
      for (const child of el.children) {
        if (child.classList.contains("page-spacer") || !child.offsetHeight || child.querySelector(".page-spacer")) continue;
        const top = within(child);
        const bottom = top + child.offsetHeight;
        const index = Math.floor((top + 1) / s.pitch);
        if (bottom > index * s.pitch + limit + 1) crossings.push((child.textContent.slice(0, 12) || "(empty)") + " " + top + "-" + bottom);
      }
      // Raw readings for the first 50 blocks: is each API zoomed or not?
      const raw = [...el.children]
        .filter((c) => !c.classList.contains("page-spacer"))
        .slice(0, 50)
        .map((c) => {
          const r = c.getBoundingClientRect();
          let text = null;
          const t = document.createTreeWalker(c, NodeFilter.SHOW_TEXT).nextNode();
          if (t) {
            range.selectNodeContents(t);
            const rr = range.getClientRects()[0];
            if (rr) text = { top: round(rr.top - s.surfaceRect.top), height: round(rr.height) };
          }
          return {
            offsetTop: within(c),
            offsetHeight: c.offsetHeight,
            rectTop: round(r.top - s.surfaceRect.top),
            rectHeight: round(r.height),
            text,
          };
        });
      return {
        zoom: s.zoom,
        ratio: round(s.ratio * 1000) / 1000,
        paperRatio: round(s.paperRatio * 1000) / 1000,
        scale: s.scale,
        pitch: s.pitch,
        margin: s.margin,
        surfaceOffsetWidth: el.offsetWidth,
        surfaceRectWidth: round(s.surfaceRect.width),
        paperOffsetHeight: paper().offsetHeight,
        paperRectHeight: round(s.paperRect.height),
        surfaceOffsetHeight: el.offsetHeight,
        surfaceRectHeight: round(s.surfaceRect.height),
        pageCount: document.querySelector('[aria-label="Page count"]')?.textContent?.trim(),
        spacers: spacers.length,
        maxStartLayout: Math.max(0, ...starts.map((x) => Math.abs(x.layout))),
        maxStartDrawn: Math.max(0, ...starts.map((x) => Math.abs(x.drawn))),
        starts: starts.slice(0, 14),
        crossings: crossings.slice(0, 20),
        crossingCount: crossings.length,
        raw,
      };
    };
    // Snapshots across gap k: the screen y (CSS px of the web view) where the
    // paper says the gap is; the harness reads the pixels.
    const snapGap = async (percent, k) => {
      const s = space();
      // Screen px: Chromium rects are already screen px; WebKit's may be
      // divided by the element's zoom (paperRatio says which).
      const toScreen = Math.abs(s.paperRatio - s.zoom) <= Math.abs(s.paperRatio - 1) ? 1 : s.zoom;
      const sc = scroller();
      const view0 = sc.getBoundingClientRect();
      const gapTop0 = s.paperRect.top * toScreen + (k * s.pitch + s.pageHeight) * s.zoom;
      sc.scrollTop += gapTop0 - (view0.top + view0.height / 2);
      await frames();
      await delay(150);
      const t = space();
      const top = t.paperRect.top * toScreen;
      const left = t.paperRect.left * toScreen;
      const viewport = document.querySelector(".editor-viewport.is-paged").getBoundingClientRect();
      const name = "zoom-" + percent + "-gap-" + k;
      let file = null;
      try {
        file = await window.__TAURI_INTERNALS__.invoke("smoke_snapshot", { name });
      } catch (error) {
        file = "error: " + String(error);
      }
      return {
        name,
        file,
        dpr: window.devicePixelRatio,
        innerWidth: window.innerWidth,
        innerHeight: window.innerHeight,
        toScreen,
        paperTop: round(top),
        paperLeft: round(left),
        paperWidthScreen: round(t.paperRect.width * toScreen),
        viewportLeft: round(viewport.left),
        viewportTop: round(viewport.top),
        // The scroller's top: rows above it are the toolbar, not the paper.
        scrollerTop: round(sc.getBoundingClientRect().top),
        viewportWidth: round(viewport.width),
        gapTop: round(top + (k * t.pitch + t.pageHeight) * t.zoom),
        gapBottom: round(top + (k + 1) * t.pitch * t.zoom),
        // Where the spacers put page k + 2's first line (screen px), for the
        // first block spacer after gap k.
        spacerBottoms: [...el.querySelectorAll(".page-spacer")]
          .filter((sp) => Number(sp.dataset.page) === k + 2)
          .map((sp) => round(sp.getBoundingClientRect().bottom * toScreen)),
        scrollTop: sc.scrollTop,
      };
    };
    const zooms = {};
    const fuzz = {};
    // Set now so a later failure still reports what was measured.
    probe = { zooms, fuzz, userAgent: navigator.userAgent };
    for (const percent of [100, 75, 50, 125, 150]) {
      await setZoom(percent);
      const g = geometry();
      g.snapshots = [];
      for (const k of [0, 1]) g.snapshots.push(await snapGap(percent, k));
      if (percent === 50 || percent === 75) {
        scroller().scrollTop = 0;
        await frames();
        await delay(150);
        try {
          g.topSnapshot = await window.__TAURI_INTERNALS__.invoke("smoke_snapshot", { name: "zoom-" + percent + "-top" });
        } catch (error) {
          g.topSnapshot = "error: " + String(error);
        }
      }
      zooms[percent] = g;
      step("zoom " + percent + " measured");
    }
    // 3.png's shape: a pane about 680 px wide (fit zoom ~0.83) at toolbar
    // 100 %. Put the caret on a real line of page 2 whose screen position
    // falls where WebKit draws the first grey band (1056-1088 screen px below
    // the paper's top), and snapshot it twice (the caret blinks).
    try {
      await setZoom(100);
      const vp = document.querySelector(".editor-viewport.is-paged");
      vp.style.width = "710px";
      vp.style.maxWidth = "710px";
      await delay(1500);
      await frames();
      const s = space();
      const lo = 1056 / s.zoom - s.margin;
      const hi = 1088 / s.zoom - s.margin;
      let target = null;
      tiptap.state.doc.forEach((node, offset) => {
        const dom = view.nodeDOM(offset);
        if (target || !(dom instanceof HTMLElement) || !node.isTextblock) return;
        const top = within(dom);
        if (top + dom.offsetHeight / 2 >= lo && top + dom.offsetHeight / 2 <= hi) target = { pos: offset + 1 + node.content.size, top, height: dom.offsetHeight };
      });
      const repro = { zoom: s.zoom, band: [round(lo), round(hi)], target };
      if (target) {
        tiptap.commands.setTextSelection(target.pos);
        tiptap.commands.focus();
        await frames();
        const c = view.coordsAtPos(target.pos);
        c && c.top && (scroller().scrollTop += c.top * s.zoom - 400);
        await frames();
        await delay(200);
        repro.invariant = invariant().caret;
        const t = space();
        repro.paperTopScreen = round(t.paperRect.top * t.zoom);
        const cc = view.coordsAtPos(target.pos);
        repro.caretScreen = [round(cc.top * t.zoom), round(cc.bottom * t.zoom)];
        repro.bandScreen = [round(t.paperRect.top * t.zoom + 1056), round(t.paperRect.top * t.zoom + 1088)];
        repro.innerWidth = window.innerWidth;
        repro.snaps = [];
        for (const name of ["gap-caret-a", "gap-caret-b"]) {
          try {
            repro.snaps.push(await window.__TAURI_INTERNALS__.invoke("smoke_snapshot", { name }));
          } catch (error) {
            repro.snaps.push("error: " + String(error));
          }
          await delay(350);
        }
      }
      vp.style.width = "";
      vp.style.maxWidth = "";
      await delay(800);
      probe.repro = repro;
      step("3.png repro attempted");
    } catch (error) {
      probe.repro = { error: String(error) };
    }
    // Caret sweep at 100 % and 75 %: 100 seeded positions, invariant at each.
    let seed = 4171;
    const random = () => {
      seed = (seed + 0x6d2b79f5) >>> 0;
      let t = seed;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    const randomPos = () => {
      const tb = [];
      tiptap.state.doc.forEach((node, offset) => {
        if (node.isTextblock) tb.push([offset + 1, offset + 1 + node.content.size]);
      });
      const [from, to] = tb[Math.floor(random() * tb.length)];
      return from + Math.floor(random() * (to - from + 1));
    };
    const settleNative = async () => {
      await frames();
      await delay(300);
    };
    const keydown = (key, extra = {}) =>
      !view.dom.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true, ...extra }));
    for (const percent of [100, 75]) {
      await setZoom(percent);
      const sweep = [];
      for (let i = 0; i < 100; i++) {
        const pos = randomPos();
        tiptap.commands.setTextSelection(pos);
        tiptap.commands.focus();
        await frames();
        const r = invariant();
        if (!r.caret.ok) sweep.push({ pos, ...r.caret });
      }
      // Fuzz: Enter (PM keymap), Enter x5, typing (insertText), Backspace
      // (PM keymap, else the browser's delete), random repositioning.
      const violations = [];
      const log = [];
      tiptap.commands.setTextSelection(tiptap.state.doc.content.size - 1);
      tiptap.commands.focus();
      await frames();
      for (let stepNo = 1; stepNo <= 150; stepNo++) {
        let moved = "";
        if (random() < 0.35) {
          const pos = randomPos();
          tiptap.commands.setTextSelection(pos);
          tiptap.commands.focus();
          await frames();
          moved = "at " + pos + " ";
        }
        const r0 = random();
        let op;
        const outFrames = [];
        let n = 0;
        const sampler = () => {
          try {
            const r = invariant();
            outFrames.push(!r.caret.ok || r.empties.length > 0);
          } catch {
            outFrames.push(null);
          }
          if (++n < 10) requestAnimationFrame(sampler);
        };
        if (r0 < 0.45) {
          op = "Enter";
          keydown("Enter");
        } else if (r0 < 0.55) {
          op = "Enter x5";
          for (let i = 0; i < 5; i++) keydown("Enter");
        } else if (r0 < 0.75) {
          op = "type";
          document.execCommand("insertText", false, ["alpha", "khoihdowiahj", "x"][Math.floor(random() * 3)]);
        } else {
          op = "Backspace";
          if (!keydown("Backspace")) document.execCommand("delete");
        }
        // Requested after the edit, so after pagination's own frame: each
        // sample is what WebKit is about to paint.
        requestAnimationFrame(sampler);
        await settleNative();
        const r = invariant();
        const bad = [];
        if (!r.caret.ok) bad.push("caret head " + r.caret.head + " in " + r.caret.zone + " (page " + (r.caret.page + 1) + ", " + r.caret.top + "-" + r.caret.bottom + ", " + r.caret.source + ")");
        for (const e of r.empties) bad.push("empty block " + e.block + " in " + e.zone + " (page " + (e.page + 1) + ", " + e.top + "-" + e.bottom + ")");
        const out = outFrames.filter(Boolean).length;
        if (bad.length) {
          const sel = getSelection();
          const c = view.coordsAtPos(r.caret.head);
          const s0 = space();
          bad.push("pm caret " + round((c.top - s0.surfaceRect.top) / s0.scale) + "-" + round((c.bottom - s0.surfaceRect.top) / s0.scale) +
            "; dom focus " + (sel.focusNode ? (sel.focusNode.nodeName + "/" + (sel.focusNode.className || "") + "@" + sel.focusOffset) : "none"));
          violations.push("zoom " + percent + " step " + stepNo + " (" + moved + op + "): " + bad.join("; "));
        }
        if (!bad.length && out) violations.push("zoom " + percent + " step " + stepNo + " (" + moved + op + "): out of a text area for " + out + " painted frame(s) before settling");
        if (bad.length || out) log.push({ step: stepNo, op: moved + op, framesOut: out, settled: bad.length ? "bad" : "ok" });
        if (bad.length && !fuzz["firstSnapshot" + percent]) {
          try {
            fuzz["firstSnapshot" + percent] = await window.__TAURI_INTERNALS__.invoke("smoke_snapshot", { name: "fuzz-" + percent + "-first" });
          } catch (error) {
            fuzz["firstSnapshot" + percent] = "error: " + String(error);
          }
        }
      }
      fuzz[percent] = { sweepOut: sweep.length, sweep: sweep.slice(0, 10), violations: violations.slice(0, 30), violationCount: violations.length, log: log.slice(0, 60) };
      step("fuzz at " + percent + ": " + violations.length + " violations");
    }
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
    if (window.__SMOKE_PHASE__ === "pages-zoom") {
      if (!button("Start new project")) await click("Projects");
      await click("Start new project");
      await click("Blank");
      await input("Project title", "Native zoom probe");
      await click("Save");
      await saved();
      await pagesZoomProbe();
    } else if (window.__SMOKE_PHASE__ === "pages-probe") {
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
