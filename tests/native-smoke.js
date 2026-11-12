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
  // Wave 9 (T278), run with FOLIO_SMOKE_PHASE=w9-blank-click: a dispatched (synthetic, not
  // physical) mousedown in the paper's blank margins and below the text, page view, A4,
  // 2-inch margins, at toolbar zoom 100/125/150. Exercises src/editor/blankClick.ts with
  // WebKit's own rects and posAtCoords. Click points are computed in drawn px: native WebKit
  // reports rects inside the zoomed paper in drawn / zoom, so they are multiplied by the zoom,
  // and each point is calibrated with elementFromPoint before it is used.
  const w9BlankClickProbe = async () => {
    const el = await wait(editor, "editor");
    const tiptap = el.editor;
    const view = tiptap.view;
    // Line 4 is an empty paragraph (a shape that behaves differently from a text node).
    const texts = ["First line of the probe.", "Second line of the probe.", "Third line here.", "", "Fifth and last line."];
    tiptap.commands.setContent(
      { type: "doc", content: texts.map((text) => (text ? { type: "paragraph", content: [{ type: "text", text }] } : { type: "paragraph" })) },
      { emitUpdate: true },
    );
    await saved();
    step("seeded five short paragraphs");
    if (!document.querySelector('[aria-label="Page view"]'))
      document.querySelector('[aria-label="More formatting"]')?.click();
    (await wait(() => document.querySelector('[aria-label="Page view"]'), "page toggle")).click();
    await wait(() => document.querySelector(".editor-viewport.is-paged"), "page view");
    await closeMore();
    await delay(800);
    const paper = () => document.querySelector(".editor-paper");
    const choose = async (label, optionText) => {
      (await wait(() => document.querySelector(`button[aria-label="${label}"]`), label)).click();
      const option = await wait(
        () => [...document.querySelectorAll('[role="option"]')].find((o) => o.textContent.trim() === optionText),
        label + " " + optionText,
      );
      option.click();
      await delay(150);
    };
    // Page setup: A4 and 2-inch margins (the Codex case).
    if (!document.querySelector('button[aria-label="Page setup"]'))
      document.querySelector('[aria-label="More formatting"]')?.click();
    (await wait(() => document.querySelector('button[aria-label="Page setup"]'), "page setup")).click();
    await choose("Paper size", "A4");
    await choose("Page margins", "2 inches");
    document.activeElement?.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Escape", code: "Escape", bubbles: true, cancelable: true }),
    );
    await delay(150);
    if (document.querySelector('[role="dialog"][aria-label="Page setup"]'))
      document.querySelector('button[aria-label="Page setup"]')?.click();
    await closeMore();
    await wait(() => getComputedStyle(paper()).getPropertyValue("--page-margin").trim() === "192px", "2-inch margin");
    await saved();
    step("A4, 2-inch margins");
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
      await wait(() => {
        const style = getComputedStyle(paper());
        const fit = parseFloat(style.getPropertyValue("--page-scale")) || 1;
        return Math.abs((parseFloat(style.zoom) || 1) - (percent / 100) * fit) < 0.001 && (percent === 100 || style.zoom !== "1");
      }, "zoom " + percent);
      await delay(800);
      await frames();
    };
    // Same probe as src/components/floating.ts reportsUnzoomedRects, done independently here.
    const probeDiv = document.createElement("div");
    probeDiv.style.cssText = "position:absolute;visibility:hidden;width:100px;height:1px;zoom:0.5";
    document.body.appendChild(probeDiv);
    const unzoomed = probeDiv.getBoundingClientRect().width > 75;
    probeDiv.remove();
    const zoomOf = (node) => {
      let z = 1;
      for (let n = node; n; n = n.parentElement) z *= parseFloat(getComputedStyle(n).zoom) || 1;
      return z;
    };
    const r1 = (v) => Math.round(v * 10) / 10;
    const describe = (node) =>
      !node ? "null" : node.nodeType === 1 ? node.tagName.toLowerCase() + (node.className && typeof node.className === "string" ? "." + node.className.trim().split(/\s+/).join(".") : "") : "#text";
    const where = (pos) => {
      const $p = tiptap.state.doc.resolve(pos);
      return { pos, paragraph: $p.index(0) + 1, offset: $p.parentOffset, paragraphLength: $p.parent.content.size };
    };
    const doc = () => tiptap.state.doc;
    const line2Start = () => doc().child(0).nodeSize + 1;
    const line2End = () => line2Start() + doc().child(1).content.size;
    const docEnd = () => doc().content.size - 1;
    const line4Start = () => doc().child(0).nodeSize + doc().child(1).nodeSize + doc().child(2).nodeSize + 1;
    const parkPos = () => doc().child(0).nodeSize + doc().child(1).nodeSize + 4; // inside line 3, never an expected answer
    const results = {};
    let failures = 0;
    // Sidebar shown: the 1240 px smoke window fits a 125 or 150 % A4 page to the pane, so both
    // draw at the same zoom. Sidebar hidden: a wider pane, so 150 % draws closer to 1.5.
    for (const [layoutName, percent] of [["sidebar", 100], ["sidebar", 125], ["sidebar", 150], ["no-sidebar", 100], ["no-sidebar", 125], ["no-sidebar", 150]]) {
      if (layoutName === "no-sidebar" && !results.sidebarHidden) {
        (await wait(() => document.querySelector('button[aria-label="Toggle sidebar"]'), "toggle sidebar")).click();
        await delay(800);
        results.sidebarHidden = { viewportWidth: Math.round(document.querySelector(".editor-viewport").getBoundingClientRect().width) };
      }
      await setZoom(percent);
      const scroller = el.closest(".writer-scroll") || document.querySelector(".editor-viewport");
      if (scroller) scroller.scrollTop = 0;
      await frames();
      const z = zoomOf(view.dom);
      const s = unzoomed ? z : 1;
      const geometry = () => {
        const d = view.dom.getBoundingClientRect();
        const p2 = view.dom.children[1].getBoundingClientRect();
        const p4 = view.dom.children[3].getBoundingClientRect();
        const last = view.dom.lastElementChild.getBoundingClientRect();
        return {
          domLeft: d.left * s,
          domRight: d.right * s,
          line2Mid: ((p2.top + p2.bottom) / 2) * s,
          line2Left: p2.left * s,
          line4Mid: ((p4.top + p4.bottom) / 2) * s,
          domTop: d.top * s,
          domBottom: d.bottom * s,
          lastBottom: last.bottom * s,
          lastBottomRaw: last.bottom,
          marginCss: getComputedStyle(paper()).getPropertyValue("--page-margin").trim(),
          pageWidth: getComputedStyle(paper()).getPropertyValue("--page-width").trim(),
        };
      };
      const g0 = geometry();
      // Calibration: the computed centre of line 2 must hit paragraph 2 (independent of the handler).
      const calHit = document.elementFromPoint(g0.line2Left + 4, g0.line2Mid);
      const calibrated = !!calHit && view.dom.children[1].contains(calHit);
      const cases = [
        ["left margin beside line 2", (g) => [g.domLeft - 30, g.line2Mid], line2Start],
        ["right margin beside line 2", (g) => [g.domRight + 30, g.line2Mid], line2End],
        ["below the last line", (g) => [(g.domLeft + g.domRight) / 2, g.lastBottom + 30], docEnd],
        ["left margin beside the empty line 4", (g) => [g.domLeft - 30, g.line4Mid], line4Start],
      ];
      const out = {
        layout: layoutName,
        viewportWidth: Math.round(document.querySelector(".editor-viewport").getBoundingClientRect().width),
        toolbarZoom: percent,
        computedZoom: r1(z * 1000) / 1000,
        unzoomedRects: unzoomed,
        window: [window.innerWidth, window.innerHeight],
        geometry: Object.fromEntries(Object.entries(g0).map(([k, v]) => [k, typeof v === "number" ? r1(v) : v])),
        calibration: { hit: describe(calHit), ok: calibrated },
        cases: [],
      };
      if (!calibrated) failures++;
      for (const [name, point, expected] of cases) {
        tiptap.commands.setTextSelection(parkPos());
        if (scroller) scroller.scrollTop = 0;
        await frames();
        const g = geometry();
        const [x, y] = point(g);
        const hit = document.elementFromPoint(x, y);
        // Diagnostics at the point the handler uses (clamped into the text column): what
        // ProseMirror's posAtCoords and WebKit's caretRangeFromPoint answer there.
        const cx = Math.max(g.domLeft + 1, Math.min(x, g.domRight - 1));
        const cy = Math.max(g.domTop + 1, Math.min(y, g.domBottom - 1));
        const rawPm = view.posAtCoords({ left: cx, top: cy });
        const range = document.caretRangeFromPoint ? document.caretRangeFromPoint(cx, cy) : null;
        let rangePos = null;
        try {
          rangePos = range && view.dom.contains(range.startContainer) ? view.posAtDOM(range.startContainer, range.startOffset) : null;
        } catch (error) {
          rangePos = "error " + String(error);
        }
        const diagnostics = {
          clamped: [r1(cx), r1(cy)],
          posAtCoords: rawPm ? rawPm.pos : null,
          caretRange: range ? { node: describe(range.startContainer), offset: range.startOffset, pos: rangePos } : null,
        };
        const inViewport = !!hit && !!hit.closest(".editor-viewport");
        const options = { bubbles: true, cancelable: true, composed: true, clientX: x, clientY: y, screenX: x, screenY: y, button: 0, buttons: 1, view: window, detail: 1 };
        const down = new MouseEvent("mousedown", options);
        if (hit) hit.dispatchEvent(down);
        hit?.dispatchEvent(new MouseEvent("mouseup", { ...options, buttons: 0 }));
        await frames();
        const sel = tiptap.state.selection;
        const want = expected();
        const ok = inViewport && down.defaultPrevented && sel.empty && sel.from === want;
        if (!ok) failures++;
        out.cases.push({
          name,
          ok,
          point: [r1(x), r1(y)],
          hit: describe(hit),
          inViewport,
          handled: down.defaultPrevented,
          expected: where(want),
          caret: { ...where(sel.from), empty: sel.empty },
          diagnostics,
        });
        step(`blank click ${layoutName} ${percent}% ${name}: ${ok ? "ok" : "FAIL"} caret p${where(sel.from).paragraph}:${where(sel.from).offset}`);
      }
      results[layoutName + "-" + percent] = out;
    }
    probe = { blankClick: results, failures, userAgent: navigator.userAgent };
    if (failures) throw Error(`w9 blank click: ${failures} failed check(s)`);
  };
  // Owner fixes 2026-11-11 (blur diagnosis), FOLIO_SMOKE_PHASE=blur-probe. MEASURE ONLY. Forces the text-control
  // emphasis on real controls (the rule's own .is-highlighted hook, never a fake :hover) and paints variants of it
  // from an injected <style>; for each variant it takes a WebKit snapshot and holds the state 1.6 s after a
  // "BP-HOLD" progress line so the harness (node_modules/.cache/personal-word-beta/blur/blur-run.py) can also take a
  // real screen capture. Records computed styles of keyboard-focused controls and their ancestors.
  const blurProbe = async () => {
    const out = { dpr: devicePixelRatio, hasFocus: document.hasFocus(), screens: {} };
    const sheet = document.createElement("style");
    sheet.id = "blur-probe";
    document.head.appendChild(sheet);
    const STYLE_KEYS = ["transform", "will-change", "-webkit-font-smoothing", "text-rendering", "opacity", "filter",
      "backface-visibility", "contain", "transition-property", "transition-duration", "-webkit-text-stroke-width",
      "color", "font-family", "font-weight", "font-size", "zoom", "isolation", "position", "mix-blend-mode",
      "text-shadow", "paint-order", "backdrop-filter", "perspective", "transform-style"];
    const styleOf = (el) => {
      const cs = getComputedStyle(el);
      const r = el.getBoundingClientRect();
      const o = { tag: el.tagName.toLowerCase() + (el.className && typeof el.className === "string" ? "." + el.className.trim().split(/\s+/).join(".") : ""), x: r.x, y: r.y, w: r.width, h: r.height };
      for (const k of STYLE_KEYS) o[k] = cs.getPropertyValue(k);
      return o;
    };
    // Base for every variant: hover colour forced (rows rest in --muted) so colour never confounds the numbers.
    const BASE = '[data-bp="t"]{color:var(--text) !important}';
    const ANC = '[data-bp="t"],[data-bp-anc]';
    const V = [
      ["v0-rest", false, ""],
      ["v0-rest-notransform", false, `${ANC}{transform:none !important;transition:none !important;will-change:auto !important}`],
      ["v1-current", true, ""],
      ["v2-stroke-notransform", true, `${ANC}{transform:none !important;transition:none !important;will-change:auto !important}`],
      ["v3-stroke-002em", true, '[data-bp="t"]{-webkit-text-stroke-width:0.02em !important}'],
      ["v3-stroke-025px", true, '[data-bp="t"]{-webkit-text-stroke-width:0.25px !important}'],
      ["v3-stroke-05px", true, '[data-bp="t"]{-webkit-text-stroke-width:0.5px !important}'],
      ["v3-stroke-1px", true, '[data-bp="t"]{-webkit-text-stroke-width:1px !important}'],
      ["v4-weight-700", false, '[data-bp="t"]{font-weight:700 !important}'],
      ["v4-weight-600", false, '[data-bp="t"]{font-weight:600 !important}'],
      ["v5-shadow-0", false, '[data-bp="t"]{text-shadow:0 0 0 currentColor !important}'],
      ["v5-shadow-03px", false, '[data-bp="t"]{text-shadow:0.3px 0 0 currentColor !important}'],
      ["v5-shadow-05px", false, '[data-bp="t"]{text-shadow:0.5px 0 0 currentColor !important}'],
      ["v5-shadow-1px", false, '[data-bp="t"]{text-shadow:1px 0 0 currentColor !important}'],
      ["v6-paintorder", true, '[data-bp="t"]{paint-order:stroke fill !important}'],
      ["v6-paintorder-1px", true, '[data-bp="t"]{paint-order:stroke fill !important;-webkit-text-stroke-width:1px !important}'],
      ["v7-aa-antialiased", true, '[data-bp="t"]{-webkit-font-smoothing:antialiased !important}'],
      ["v7-aa-subpixel", true, '[data-bp="t"]{-webkit-font-smoothing:subpixel-antialiased !important}'],
      ["v7-aa-none", true, '[data-bp="t"]{-webkit-font-smoothing:none !important}'],
      ["v7-rest-antialiased", false, '[data-bp="t"]{-webkit-font-smoothing:antialiased !important}'],
      ["v8-parent-willchange", true, "[data-bp-par]{will-change:transform !important}"],
      ["v8-parent-translatez", true, "[data-bp-par]{transform:translateZ(0) !important}"],
      ["v8-self-halfpx", true, '[data-bp="t"]{transform:translateX(0.5px) !important;transition:none !important}'],
      ["v8-rest-halfpx", false, '[data-bp="t"]{transform:translateX(0.5px) !important;transition:none !important}'],
    ];
    const run = async (screen, controls) => {
      // controls: [{name, control, text}] ; text = element that carries the stroke.
      const facts = [];
      for (const c of controls) {
        c.text.setAttribute("data-bp", "t");
        c.control.parentElement.setAttribute("data-bp-par", "");
        for (let a = c.text.parentElement; a && a !== document.body; a = a.parentElement) {
          a.setAttribute("data-bp-anc", "");
          if (a === c.control.parentElement) break;
        }
        // Keyboard focus: computed styles of the genuinely focused control and its ancestors.
        c.control.focus();
        await frames();
        await delay(200);
        const chain = [];
        for (let a = c.text; a && a !== document.documentElement; a = a.parentElement) chain.push(styleOf(a));
        facts.push({ name: c.name, focusVisible: c.control.matches(":focus-visible"), focused: document.activeElement === c.control,
          textContent: c.text.textContent.trim().slice(0, 40), chain });
        c.control.blur();
      }
      out.screens[screen] = { facts, variants: {} };
      for (const [name, hl, css] of V) {
        sheet.textContent = BASE + css;
        for (const c of controls) c.control.classList.toggle("is-highlighted", hl);
        await frames();
        await delay(350);
        await frames();
        const rects = {};
        for (const c of controls) {
          const r = c.text.getBoundingClientRect();
          const cs = getComputedStyle(c.text);
          rects[c.name] = { x: r.x, y: r.y, w: r.width, h: r.height, stroke: cs.webkitTextStrokeWidth,
            transform: cs.transform, weight: cs.fontWeight, shadow: cs.textShadow, smoothing: cs.webkitFontSmoothing };
        }
        const file = await window.__TAURI_INTERNALS__.invoke("smoke_snapshot", { name: ("bp-" + screen + "-" + name).slice(0, 40) });
        const top = outerHeight - innerHeight;
        mark(`BP-HOLD ${screen} ${name} ${screenX} ${screenY + top} ${innerWidth} ${innerHeight}`);
        await delay(1600);
        out.screens[screen].variants[name] = { file, rects };
      }
      sheet.textContent = "";
      for (const c of controls) c.control.classList.remove("is-highlighted");
      for (const el of document.querySelectorAll("[data-bp],[data-bp-anc],[data-bp-par]")) {
        el.removeAttribute("data-bp");
        el.removeAttribute("data-bp-anc");
        el.removeAttribute("data-bp-par");
      }
    };
    out.window = { screenX, screenY, outerWidth, outerHeight, innerWidth, innerHeight };
    step("blur probe dpr " + devicePixelRatio);
    const entry = await wait(() => document.querySelector(".entry-main"), "sidebar entry row");
    const writing = [
      { name: "sidebar-row", control: entry, text: entry.querySelector(":scope > span") || entry },
      { name: "project-title", control: document.querySelector(".project-switch"), text: document.querySelector(".project-switch") },
      { name: "tab", control: document.querySelector(".project-tab > button:first-child"), text: document.querySelector(".project-tab > button:first-child") },
      { name: "plain-button", control: document.querySelector(".tabs-library"), text: document.querySelector(".tabs-library") },
      { name: "toolbar-menu", control: document.querySelector(".format-bar .dropdown-button"), text: document.querySelector(".format-bar .dropdown-button") },
      { name: "toolbar-icon", control: document.querySelector('.format-bar .toolbar-icon:not([data-popover-item])'), text: document.querySelector('.format-bar .toolbar-icon:not([data-popover-item])') },
    ].filter((c) => c.control && c.text);
    out.writingControls = writing.map((c) => c.name);
    await run("writing", writing.filter((c) => c.name !== "toolbar-icon"));
    // The crisp toolbar icon the owner pointed at: rest and fully magnified (--dock-scale 1.5, the focus rule).
    const icon = writing.find((c) => c.name === "toolbar-icon");
    if (icon) {
      out.icon = {};
      for (const [name, scale] of [["rest", ""], ["magnified", "1.5"]]) {
        icon.control.style.setProperty("--dock-scale", scale);
        await frames();
        await delay(400);
        const svg = icon.control.querySelector("svg");
        const r = svg.getBoundingClientRect();
        const file = await window.__TAURI_INTERNALS__.invoke("smoke_snapshot", { name: "bp-icon-" + name });
        mark(`BP-HOLD icon ${name} ${screenX} ${screenY + outerHeight - innerHeight} ${innerWidth} ${innerHeight}`);
        await delay(1600);
        out.icon[name] = { file, rect: { x: r.x, y: r.y, w: r.width, h: r.height }, transform: getComputedStyle(svg).transform };
      }
      icon.control.style.removeProperty("--dock-scale");
    }
    await click("Projects");
    const row = await wait(() => document.querySelector(".project-row .emph-row"), "projects row");
    const start = button("Start new project") || [...document.querySelectorAll("button")].find((b) => b.textContent.includes("Start new project"));
    await run("projects", [
      { name: "projects-row", control: row, text: row.querySelector(".emph-label") },
      ...(start ? [{ name: "plain-button-2", control: start, text: start }] : []),
    ]);
    probe = { blur: out };
  };
  // Wave 9 (T278 r2), FOLIO_SMOKE_PHASE=w9-zoom-probes. MEASURE ONLY (review S4-S6): three other features that
  // mix pointer or caret coordinates with WebKit's zoomed rects, at true drawn zoom 1, 1.25 and 1.5 (A4 page view,
  // sidebar hidden). Synthetic events: contextmenu in a table cell (S4), keydown ArrowDown/ArrowUp across the first
  // page gap (S5), mousedown in the gap just under page 1's last line (S6). Never throws on a wrong answer.
  const w9ZoomProbes = async () => {
    const el = await wait(editor, "editor");
    const tiptap = el.editor;
    const view = tiptap.view;
    const blocks = [];
    for (let i = 1; i <= 6; i++) blocks.push({ type: "paragraph", content: [{ type: "text", text: "Intro line " + i + "." }] });
    for (let i = 1; i <= 70; i++) blocks.push({ type: "paragraph", content: [{ type: "text", text: "Body line " + i + " of the zoom probe." }] });
    tiptap.commands.setContent({ type: "doc", content: blocks }, { emitUpdate: true });
    // A 3x3 table after the intro lines.
    let introEnd = 0;
    for (let i = 0; i < 6; i++) introEnd += tiptap.state.doc.child(i).nodeSize;
    tiptap.chain().setTextSelection(introEnd - 1).insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run();
    await saved();
    step("seeded intro, 3x3 table, 70 body lines");
    if (!document.querySelector('[aria-label="Page view"]'))
      document.querySelector('[aria-label="More formatting"]')?.click();
    (await wait(() => document.querySelector('[aria-label="Page view"]'), "page toggle")).click();
    await wait(() => document.querySelector(".editor-viewport.is-paged"), "page view");
    await closeMore();
    await delay(800);
    const paper = () => document.querySelector(".editor-paper");
    const choose = async (label, optionText) => {
      (await wait(() => document.querySelector(`button[aria-label="${label}"]`), label)).click();
      (await wait(
        () => [...document.querySelectorAll('[role="option"]')].find((o) => o.textContent.trim() === optionText),
        label + " " + optionText,
      )).click();
      await delay(150);
    };
    if (!document.querySelector('button[aria-label="Page setup"]'))
      document.querySelector('[aria-label="More formatting"]')?.click();
    (await wait(() => document.querySelector('button[aria-label="Page setup"]'), "page setup")).click();
    await choose("Paper size", "A4");
    document.body.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true }));
    await closeMore();
    (await wait(() => document.querySelector('button[aria-label="Toggle sidebar"]'), "toggle sidebar")).click();
    await delay(800);
    await wait(() => view.dom.querySelector(".page-spacer"), "a page gap");
    step("A4, sidebar hidden, two pages");
    const setZoom = async (percent) => {
      let trigger = document.querySelector('button[aria-label="Editor zoom"]');
      if (!trigger) {
        document.querySelector('[aria-label="More formatting"]')?.click();
        trigger = await wait(() => document.querySelector('button[aria-label="Editor zoom"]'), "zoom trigger");
      }
      trigger.click();
      (await wait(
        () => [...document.querySelectorAll('[role="option"]')].find((o) => o.textContent.trim() === percent + "%"),
        "zoom option " + percent,
      )).click();
      await delay(100);
      await closeMore();
      await wait(() => {
        const style = getComputedStyle(paper());
        const fit = parseFloat(style.getPropertyValue("--page-scale")) || 1;
        return Math.abs((parseFloat(style.zoom) || 1) - (percent / 100) * fit) < 0.001 && (percent === 100 || style.zoom !== "1");
      }, "zoom " + percent);
      await delay(800);
      await frames();
    };
    const probeDiv = document.createElement("div");
    probeDiv.style.cssText = "position:absolute;visibility:hidden;width:100px;height:1px;zoom:0.5";
    document.body.appendChild(probeDiv);
    const unzoomed = probeDiv.getBoundingClientRect().width > 75;
    probeDiv.remove();
    const zoomOf = (node) => {
      let z = 1;
      for (let n = node; n; n = n.parentElement) z *= parseFloat(getComputedStyle(n).zoom) || 1;
      return z;
    };
    const r1 = (v) => Math.round(v * 10) / 10;
    const describe = (node) =>
      !node ? "null" : node.nodeType === 1 ? node.tagName.toLowerCase() + (node.className && typeof node.className === "string" ? "." + node.className.trim().split(/\s+/).join(".") : "") : "#text";
    const blockOf = (pos) => {
      const $p = tiptap.state.doc.resolve(pos);
      const top = tiptap.state.doc.child($p.index(0));
      let cell = null;
      for (let d = $p.depth; d > 0; d--) if (/^table(Cell|Header)$/.test($p.node(d).type.name)) cell = $p.node(d).type.name;
      return { pos, block: $p.index(0) + 1, type: top.type.name, text: top.textContent.slice(0, 30), depth: $p.depth, parent: $p.parent.type.name, cell };
    };
    const closeMenus = async () => {
      document.body.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true }));
      await delay(150);
    };
    const results = {};
    for (const percent of [100, 125, 150]) {
      await setZoom(percent);
      const z = zoomOf(view.dom);
      const s = unzoomed ? z : 1;
      const out = { toolbarZoom: percent, computedZoom: Math.round(z * 1000) / 1000, unzoomedRects: unzoomed };
      // S4: contextmenu in the middle cell (row 2, column 2).
      await closeMenus();
      const table = view.dom.querySelector("table");
      table.scrollIntoView({ block: "center" });
      await frames();
      const cell = table.querySelectorAll("tr")[1].querySelectorAll("td, th")[1];
      const c = cell.getBoundingClientRect();
      const cx = ((c.left + c.right) / 2) * s;
      const cy = ((c.top + c.bottom) / 2) * s;
      const cellHit = document.elementFromPoint(cx, cy);
      const rawCell = view.posAtCoords({ left: cx, top: cy });
      const menu = new MouseEvent("contextmenu", { bubbles: true, cancelable: true, clientX: cx, clientY: cy, button: 2, view: window });
      cellHit?.dispatchEvent(menu);
      await delay(300);
      const menuOpen = !!document.querySelector('.table-context-menu[role="menu"]');
      out.s4 = {
        point: [r1(cx), r1(cy)],
        hit: describe(cellHit),
        hitInsideCell: !!cellHit && cell.contains(cellHit),
        posAtCoords: rawCell ? blockOf(rawCell.pos) : null,
        handled: menu.defaultPrevented,
        tableMenuOpened: menuOpen,
      };
      await closeMenus();
      step(`zoom ${percent}: S4 table menu ${menuOpen ? "opened" : "NOT opened"}`);
      // S5/S6 with the gap mid-window and near the window's bottom (the handlers' errors grow with screen position).
      const spacer = [...view.dom.querySelectorAll(".page-spacer")].find((sp) => !sp.dataset.inline && sp.getBoundingClientRect().height);
      for (const place of ["center", "end"]) {
        // S5: Up/Down across the first page gap.
        spacer.scrollIntoView({ block: place });
        await frames();
        const prev = spacer.previousElementSibling;
        const next = spacer.nextElementSibling;
        const prevPos = view.posAtDOM(prev, 0);
        const nextPos = view.posAtDOM(next, 0);
        const press = async (key, from) => {
          tiptap.commands.setTextSelection(from);
          tiptap.commands.focus();
          await delay(80);
          const caret = view.coordsAtPos(from);
          const event = new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true });
          const handled = !view.dom.dispatchEvent(event);
          await delay(120);
          return { from: blockOf(from), handled, caret: blockOf(tiptap.state.selection.head), caretTopRaw: r1(caret.top) };
        };
        // The handler's own lookup point, as arrowAcrossGap computes it (unzoomed WebKit values).
        const sp = spacer.getBoundingClientRect();
        const above = prev.getBoundingClientRect().bottom;
        const below = next.getBoundingClientRect().top;
        const downCaret = view.coordsAtPos(prevPos);
        const upCaret = view.coordsAtPos(nextPos);
        const lookupDown = view.posAtCoords({ left: downCaret.left, top: below + 2 });
        const lookupUp = view.posAtCoords({ left: upCaret.left, top: above - 2 });
        const down = await press("ArrowDown", prevPos);
        const up = await press("ArrowUp", nextPos);
        out["s5-" + place] = {
          lastLineOfPage1: blockOf(prevPos),
          firstLineOfPage2: blockOf(nextPos),
          spacerRaw: [r1(sp.top), r1(sp.bottom)],
          down: { ...down, asExpected: down.caret.block === blockOf(nextPos).block },
          up: { ...up, asExpected: up.caret.block === blockOf(prevPos).block },
          handlerLookupDown: lookupDown ? blockOf(lookupDown.pos) : null,
          handlerLookupUp: lookupUp ? blockOf(lookupUp.pos) : null,
        };
        step(`zoom ${percent} gap ${place}: S5 down -> block ${down.caret.block} (want ${blockOf(nextPos).block}), up -> block ${up.caret.block} (want ${blockOf(prevPos).block})`);
        // S6: mousedown in the gap just under page 1's last line, inside the text column.
        tiptap.commands.setTextSelection(5);
        await frames();
        spacer.scrollIntoView({ block: place });
        await frames();
        const pr = prev.getBoundingClientRect();
        const sr = spacer.getBoundingClientRect();
        const gx = ((pr.left + pr.right) / 2) * s;
        const gy = pr.bottom * s + 8;
        const gapHit = document.elementFromPoint(gx, gy);
        const height = parseFloat(spacer.style.height) || sr.height || 1;
        const down6 = new MouseEvent("mousedown", { bubbles: true, cancelable: true, clientX: gx, clientY: gy, button: 0, buttons: 1, view: window, detail: 1 });
        gapHit?.dispatchEvent(down6);
        gapHit?.dispatchEvent(new MouseEvent("mouseup", { bubbles: true, cancelable: true, clientX: gx, clientY: gy, button: 0, view: window }));
        await frames();
        const landed = blockOf(tiptap.state.selection.head);
        out["s6-" + place] = {
          point: [r1(gx), r1(gy)],
          hit: describe(gapHit),
          hitIsSpacer: !!gapHit && !!gapHit.closest?.(".page-spacer"),
          handled: down6.defaultPrevented,
          split: Number(spacer.dataset.split),
          localAsHandlerComputes: r1((gy - sr.top) * (height / (sr.height || height))),
          localDrawnConsistent: r1((gy - sr.top * s) * (height / (sr.height * s || height))),
          caret: landed,
          expected: { block: blockOf(prevPos).block, atEnd: true },
          asExpected: landed.block === blockOf(prevPos).block,
        };
        step(`zoom ${percent} gap ${place}: S6 gap click -> block ${landed.block} (want ${blockOf(prevPos).block})`);
      }
      results[percent] = out;
    }
    probe = { zoomProbes: results, userAgent: navigator.userAgent };
  };
  // Wave 9 (T278) font checks across a real relaunch, FOLIO_SMOKE_PHASE=w9-fonts-1 then
  // w9-fonts-2 against the same isolated data dir and WebKit data store. FOLIO_SMOKE_SCENARIO=
  // control skips the settings in phase 1, so phase 2's persistence checks must fail.
  const W9_FONT_KEY = "folio.workspace.interfaceFont";
  const W9_CANDIDATES = ["Baskerville", "Palatino", "Didot", "Hoefler Text", "American Typewriter", "Cochin", "Big Caslon"];
  const firstFamily = (stack) => (stack || "").split(",")[0].trim().replace(/^["']|["']$/g, "");
  const openLibrarySettings = async () => {
    if (!button("Start new project")) await click("Projects");
    if (!document.querySelector('button[aria-label="Interface font"]'))
      (await wait(() => document.querySelector('button[aria-label="Settings"]'), "settings button")).click();
    return wait(() => document.querySelector('button[aria-label="Interface font"]'), "interface font menu");
  };
  const fontOptions = async () => {
    const trigger = await openLibrarySettings();
    if (trigger.getAttribute("aria-expanded") !== "true") trigger.click();
    await wait(() => document.querySelector('[role="option"]'), "font options");
    return [...document.querySelectorAll('[role="option"]')].map((o) => o.textContent.trim());
  };
  const closeOptions = async () => {
    const trigger = document.querySelector('button[aria-label="Interface font"]');
    if (trigger?.getAttribute("aria-expanded") === "true") trigger.click();
    await delay(150);
  };
  const pickInterfaceFont = async (label) => {
    await fontOptions();
    const option = await wait(
      () => [...document.querySelectorAll('[role="option"]')].find((o) => o.textContent.trim() === label),
      "interface option " + label,
    );
    option.click();
    await delay(200);
  };
  const w9Fonts1 = async () => {
    const control = window.__SMOKE_SCENARIO__ === "control";
    const families = await window.__TAURI_INTERNALS__.invoke("system_font_families");
    const installed = families.filter((f) => W9_CANDIDATES.includes(f));
    const checks = {
      installedCount: families.length,
      installedHasGeorgia: families.includes("Georgia"),
      installedHasMadeUp: families.includes("W9 No Such Family"),
      chosenInstalled: installed[0] || null,
    };
    if (!checks.installedCount || !checks.installedHasGeorgia || checks.installedHasMadeUp || !checks.chosenInstalled)
      throw Error("installed font list check failed: " + JSON.stringify(checks));
    await pickInterfaceFont("Georgia");
    await wait(() => firstFamily(getComputedStyle(document.documentElement).getPropertyValue("--ui-font")) === "Georgia", "ui font Georgia");
    const note = document.querySelector(".storage-note");
    checks.georgia = {
      uiText: getComputedStyle(note).fontFamily,
      brand: getComputedStyle(document.querySelector(".brand")).fontFamily,
    };
    // Discrimination: the same reading on ordinary interface text says Georgia, so a logo that
    // followed the interface font would be caught.
    if (firstFamily(checks.georgia.uiText) !== "Georgia" || firstFamily(checks.georgia.brand) !== "Futura")
      throw Error("logo/interface font check failed: " + JSON.stringify(checks.georgia));
    step("Georgia interface, logo Futura");
    if (!control) {
      await pickInterfaceFont(checks.chosenInstalled);
      await wait(() => firstFamily(localStorage.getItem(W9_FONT_KEY)) === checks.chosenInstalled, "installed interface font saved");
      const file = await window.__TAURI_INTERNALS__.invoke("system_font_file", { family: "Georgia", bold: false, italic: false });
      if (!file || file.collection) throw Error("no single-file Georgia to use as the fixture font");
      const input = await wait(() => document.querySelector('input[type="file"][accept=".ttf,.otf"]'), "font file input");
      const transfer = new DataTransfer();
      transfer.items.add(new File([Uint8Array.from(file.data)], "W9 fixture Georgia.ttf", { type: "font/ttf" }));
      input.files = transfer.files;
      input.dispatchEvent(new Event("change", { bubbles: true }));
      await wait(() => document.querySelector(".appearance-fonts__list")?.textContent.includes("Georgia"), "added font listed");
      checks.added = (await window.__TAURI_INTERNALS__.invoke("font_list")).map((f) => `${f.family}/${f.style}`);
      step("installed interface font chosen and fixture font added");
    } else step("control: nothing chosen or added");
    checks.savedKey = localStorage.getItem(W9_FONT_KEY);
    probe = { fonts1: checks, control };
  };
  const w9Fonts2 = async () => {
    const control = window.__SMOKE_SCENARIO__ === "control";
    const atScriptStart = getComputedStyle(document.documentElement).getPropertyValue("--ui-font").trim();
    const families = await window.__TAURI_INTERNALS__.invoke("system_font_families");
    const expected = families.find((f) => W9_CANDIDATES.includes(f));
    // initFonts has finished once the installed families are in the menu.
    const options = await fontOptions();
    await wait(() => [...document.querySelectorAll('[role="option"]')].some((o) => o.textContent.trim() === expected), "installed families loaded");
    await closeOptions();
    await delay(300);
    const checks = {
      expected,
      atScriptStart,
      savedKey: localStorage.getItem(W9_FONT_KEY),
      uiFontVar: getComputedStyle(document.documentElement).getPropertyValue("--ui-font").trim(),
      uiText: getComputedStyle(document.querySelector(".storage-note")).fontFamily,
      brand: getComputedStyle(document.querySelector(".brand")).fontFamily,
      added: (await window.__TAURI_INTERNALS__.invoke("font_list")).map((f) => `${f.family}/${f.style}`),
      addedListedInSettings: !!document.querySelector(".appearance-fonts__list")?.textContent.includes("Georgia"),
      optionCount: options.length,
    };
    const results = {
      interfaceFontPersisted:
        firstFamily(checks.savedKey) === expected && firstFamily(checks.uiFontVar) === expected && firstFamily(checks.uiText) === expected,
      logoFutura: firstFamily(checks.brand) === "Futura",
      addedFontPersisted: checks.added.includes("Georgia/regular") && checks.addedListedInSettings,
    };
    probe = { fonts2: checks, results, control };
    const failed = Object.entries(results).filter(([, v]) => !v).map(([k]) => k);
    step("fonts after relaunch: " + (failed.length ? "FAILED " + failed.join(",") : "all ok"));
    if (failed.length) throw Error("w9 fonts after relaunch failed: " + failed.join(", "));
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
    } else if (window.__SMOKE_PHASE__ === "w9-blank-click") {
      if (!button("Start new project")) await click("Projects");
      await click("Start new project");
      await click("Blank");
      await input("Project title", "Native blank click probe");
      await click("Save");
      await saved();
      await w9BlankClickProbe();
    } else if (window.__SMOKE_PHASE__ === "w9-zoom-probes") {
      if (!button("Start new project")) await click("Projects");
      await click("Start new project");
      await click("Blank");
      await input("Project title", "Native zoom probes");
      await click("Save");
      await saved();
      await w9ZoomProbes();
    } else if (window.__SMOKE_PHASE__ === "blur-probe") {
      if (!button("Start new project")) await click("Projects");
      await click("Start new project");
      await click("Blank");
      await input("Project title", "Hello Angela");
      await click("Save");
      await saved();
      await blurProbe();
    } else if (window.__SMOKE_PHASE__ === "w9-fonts-1") {
      await w9Fonts1();
    } else if (window.__SMOKE_PHASE__ === "w9-fonts-2") {
      await w9Fonts2();
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
      // Wave 6 removed the fragment footer ("Append to section"): words go
      // back by copy and paste, so the prose is put back in Opening by hand.
      await click("Opening");
      await wait(
        () => !editor()?.textContent.includes("Original prose"),
        "opening after cut",
      );
      await type("Original prose kept for a fragment.");
      await wait(
        () => editor()?.textContent.includes("Original prose"),
        "restored",
      );
      await saved();
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
