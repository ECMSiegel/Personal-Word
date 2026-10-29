import { test, expect, type Page } from "@playwright/test";

// T140 (S2): alignment invariants that are easy to break and hard to see.
// (a) sidebar labels at one depth share a text start, (b) every icon button
// reaches a 24 x 24 px target, (c) counters ask for tabular figures,
// (d) toolbar icon ink is centred in its button, (e) a separator draws exactly
// one pixel of --line.

test.use({ viewport: { width: 1280, height: 800 } });

// The same selectors as the icon-button recipe in src/styles.css, so the hit
// area is checked on exactly the buttons that are supposed to have one.
const ICON_BUTTONS = [
  ".icon-button",
  ".delete-entry",
  ".reorder button",
  ".group-actions button",
  ".collection-open-beside",
  ".open-beside",
  ".sidebar-pin",
  ".split-close",
  ".fragment-icon",
  ".project-tab > button:last-child",
  ".library-display > button",
  ".topbar > div:first-child > button",
  ".format-bar .toolbar-icon",
].join(", ");

async function openProject(
  page: Page,
  title: string,
  template = "Chicago",
) {
  await page.goto("/");
  await page.getByRole("button", { name: "Start new project" }).click();
  await page.getByRole("button", { name: template, exact: true }).click();
  await page.getByLabel("Project title").fill(title);
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await page.getByRole("textbox", { name: "Writing editor" }).waitFor();
}

test("sidebar labels at one depth start at one x", async ({ page }) => {
  await openProject(page, "Alignment check");
  const rows = await page.evaluate(() => {
    return Array.from(document.querySelectorAll<HTMLElement>(".entry-row"))
      .filter((row) => {
        const rect = row.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0;
      })
      .map((row) => {
        const label = row.querySelector<HTMLElement>(".entry-main > span");
        if (!label) return null;
        const range = document.createRange();
        range.selectNodeContents(label);
        const rects = Array.from(range.getClientRects());
        return {
          depth: row.getAttribute("data-depth") ?? "none",
          text: (label.textContent ?? "").slice(0, 24),
          x: rects.length ? +rects[0].left.toFixed(2) : null,
        };
      })
      .filter((row): row is { depth: string; text: string; x: number | null } =>
        row !== null,
      );
  });
  expect(rows.length).toBeGreaterThan(3);
  expect(rows.filter((row) => row.x === null)).toEqual([]);
  const byDepth = new Map<string, number[]>();
  for (const row of rows) {
    const xs = byDepth.get(row.depth) ?? [];
    xs.push(row.x as number);
    byDepth.set(row.depth, xs);
  }
  const spread: string[] = [];
  for (const [depth, xs] of byDepth) {
    const width = Math.max(...xs) - Math.min(...xs);
    if (width > 0.5) {
      spread.push(`depth ${depth}: ${width.toFixed(2)} px across ${xs.join(", ")}`);
    }
  }
  expect(spread, `label starts differ: ${spread.join("; ")}`).toEqual([]);
});

test("every icon button reaches a 24 x 24 target", async ({ page }) => {
  await openProject(page, "Hit areas");
  const short = await page.evaluate((selector) => {
    const visible = (el: Element) => {
      const rect = el.getBoundingClientRect();
      const cs = getComputedStyle(el);
      return (
        rect.width > 0 &&
        rect.height > 0 &&
        cs.visibility !== "hidden" &&
        cs.display !== "none"
      );
    };
    const out: { label: string; w: number; h: number }[] = [];
    for (const button of Array.from(
      document.querySelectorAll<HTMLElement>(selector),
    )) {
      if (!visible(button)) continue;
      const rect = button.getBoundingClientRect();
      const after = getComputedStyle(button, "::after");
      const w = Math.max(rect.width, parseFloat(after.width) || 0);
      const h = Math.max(rect.height, parseFloat(after.height) || 0);
      if (w < 24 || h < 24) {
        out.push({
          label:
            button.getAttribute("aria-label") ||
            button.getAttribute("title") ||
            button.className,
          w: +w.toFixed(2),
          h: +h.toFixed(2),
        });
      }
    }
    return out;
  }, ICON_BUTTONS);
  expect(short).toEqual([]);
});

test("counters ask for tabular figures", async ({ page }) => {
  await openProject(page, "Counter check");
  // Futura ships no tnum feature, so the digits stay proportional today; this
  // asserts the request is in place for any typeface that can honour it. The
  // equal-width check is deliberately absent (see the T140 done note).
  const variant = await page.evaluate(() => {
    const host = document.querySelector<HTMLElement>(".pane-footer");
    return host ? getComputedStyle(host).fontVariantNumeric : null;
  });
  expect(variant).toContain("tabular-nums");
  const save = await page.evaluate(() => {
    const host = document.querySelector<HTMLElement>(".save-status");
    return host ? getComputedStyle(host).fontVariantNumeric : null;
  });
  expect(save).toContain("tabular-nums");
});

test("toolbar icon ink sits at its button centre", async ({ page }) => {
  await openProject(page, "Optical check");
  const off = await page.evaluate(() => {
    const inkBox = (svg: SVGSVGElement) => {
      const ctm = svg.getScreenCTM();
      if (!ctm) return null;
      let minX = Infinity;
      let minY = Infinity;
      let maxX = -Infinity;
      let maxY = -Infinity;
      for (const el of Array.from(
        svg.querySelectorAll("path,line,circle,rect,polyline,polygon,ellipse"),
      )) {
        const box = (el as SVGGraphicsElement).getBBox();
        const cs = getComputedStyle(el);
        const stroke =
          cs.stroke && cs.stroke !== "none"
            ? parseFloat(cs.strokeWidth || "0")
            : 0;
        for (const [x, y] of [
          [box.x - stroke / 2, box.y - stroke / 2],
          [box.x + box.width + stroke / 2, box.y + box.height + stroke / 2],
        ]) {
          const point = svg.createSVGPoint();
          point.x = x;
          point.y = y;
          const screen = point.matrixTransform(ctm);
          minX = Math.min(minX, screen.x);
          maxX = Math.max(maxX, screen.x);
          minY = Math.min(minY, screen.y);
          maxY = Math.max(maxY, screen.y);
        }
      }
      if (!Number.isFinite(minX)) return null;
      return { x: (minX + maxX) / 2, y: (minY + maxY) / 2 };
    };
    const out: { label: string; dx: number; dy: number }[] = [];
    for (const button of Array.from(
      document.querySelectorAll<HTMLElement>(".format-bar .toolbar-icon"),
    )) {
      const rect = button.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) continue;
      const svg = button.querySelector("svg");
      if (!svg) continue;
      const ink = inkBox(svg as SVGSVGElement);
      if (!ink) continue;
      out.push({
        label:
          button.getAttribute("aria-label") ||
          button.getAttribute("title") ||
          "",
        dx: +(ink.x - (rect.left + rect.width / 2)).toFixed(2),
        dy: +(ink.y - (rect.top + rect.height / 2)).toFixed(2),
      });
    }
    return out;
  });
  expect(off.length).toBeGreaterThan(4);
  const bad = off.filter((i) => Math.abs(i.dx) > 0.5 || Math.abs(i.dy) > 0.5);
  expect(bad, `off-centre icons: ${JSON.stringify(bad)}`).toEqual([]);
});

test("a separator draws one pixel of the line colour", async ({ page }) => {
  await openProject(page, "Separator check");
  const drawn = await page.evaluate(() => {
    const host = document.createElement("div");
    host.style.display = "flex";
    host.style.height = "60px";
    host.style.position = "absolute";
    host.style.left = "-9999px";
    const vertical = document.createElement("span");
    vertical.className = "separator";
    vertical.setAttribute("role", "separator");
    vertical.setAttribute("aria-orientation", "vertical");
    const plain = document.createElement("span");
    plain.className = "separator";
    plain.setAttribute("role", "separator");
    // No aria-orientation: the plain short rule.
    host.append(vertical, plain);
    document.body.appendChild(host);
    const line = getComputedStyle(document.documentElement)
      .getPropertyValue("--line")
      .trim();
    const probe = document.createElement("span");
    probe.style.background = line;
    document.body.appendChild(probe);
    const lineColor = getComputedStyle(probe).backgroundColor;
    probe.remove();
    const v = vertical.getBoundingClientRect();
    const h = plain.getBoundingClientRect();
    const result = {
      lineColor,
      vertical: {
        width: v.width,
        height: v.height,
        color: getComputedStyle(vertical).backgroundColor,
      },
      plain: {
        width: h.width,
        height: h.height,
        color: getComputedStyle(plain).backgroundColor,
      },
    };
    host.remove();
    return result;
  });
  expect(drawn.vertical.width).toBe(1);
  expect(drawn.vertical.height).toBe(60);
  expect(drawn.vertical.color).toBe(drawn.lineColor);
  expect(drawn.plain.width).toBe(1);
  expect(drawn.plain.height).toBe(17);
  expect(drawn.plain.color).toBe(drawn.lineColor);
});

// T152: the hit-area rule must not out-weigh components that pin an icon
// button absolutely (the cards-view trash, the sidebar open-beside button).
test("hit-area rule leaves absolutely placed buttons absolute", async ({ page }) => {
  await openProject(page, "Placement check");
  await page.getByRole("button", { name: "Projects", exact: true }).click();
  await page.getByRole("button", { name: "Show project cards" }).click();
  const trash = await page.evaluate(() => {
    const row = document.querySelector<HTMLElement>(".project-list--cards .project-row");
    const del = row?.querySelector<HTMLElement>(".delete-entry");
    if (!row || !del) return null;
    const r = row.getBoundingClientRect();
    const d = del.getBoundingClientRect();
    return {
      position: getComputedStyle(del).position,
      top: +(d.top - r.top).toFixed(1),
      right: +(r.right - d.right).toFixed(1),
    };
  });
  expect(trash).not.toBeNull();
  expect(trash!.position).toBe("absolute");
  expect(trash!.top).toBeLessThanOrEqual(6);
  expect(trash!.right).toBeLessThanOrEqual(6);

  // The sidebar open-beside button only exists on rows with a source PDF, so
  // probe the stylesheet with a throwaway element in a real entry row.
  await page.getByRole("button", { name: /Placement check/ }).first().click();
  await page.getByRole("textbox", { name: "Writing editor" }).waitFor();
  const beside = await page.evaluate(() => {
    const row = document.querySelector<HTMLElement>(".entry-row");
    if (!row) return null;
    const probe = document.createElement("button");
    probe.className = "collection-open-beside";
    row.appendChild(probe);
    const position = getComputedStyle(probe).position;
    probe.remove();
    return position;
  });
  expect(beside).toBe("absolute");
});

test("reorder arrows keep their hit areas from overlapping", async ({ page }) => {
  await openProject(page, "Reorder overlap");
  const overlap = await page.evaluate(() => {
    const group = document.querySelector<HTMLElement>(".reorder");
    if (!group) return null;
    const rects = Array.from(group.querySelectorAll("button")).map((b) => {
      const r = b.getBoundingClientRect();
      const after = getComputedStyle(b, "::after");
      const w = Math.max(r.width, parseFloat(after.width) || 0);
      return { left: r.left + r.width / 2 - w / 2, right: r.left + r.width / 2 + w / 2 };
    });
    if (rects.length < 2) return null;
    return +Math.max(...rects.slice(1).map((r, i) => rects[i].right - r.left)).toFixed(2);
  });
  expect(overlap).not.toBeNull();
  expect(overlap!).toBeLessThanOrEqual(0);
});

// (f) The sidebar's last row (Settings) and the pane footer read as one band:
// the separator above Settings is level with the footer's top rule, the two
// texts share a centre line, and the two bands are the same height.
async function bandMetrics(page: Page) {
  return page.evaluate(() => {
    const textBox = (el: Element) => {
      const range = document.createRange();
      range.selectNodeContents(el);
      const r = range.getBoundingClientRect();
      return { mid: r.top + r.height / 2 };
    };
    const settings = document.querySelector<HTMLElement>(
      '.sidebar-group[data-group="settings"]',
    )!;
    const sr = settings.getBoundingClientRect();
    const label = settings.querySelector(".group-title")!;
    const footers = Array.from(
      document.querySelectorAll<HTMLElement>(".pane-footer"),
    ).map((f) => {
      const r = f.getBoundingClientRect();
      const words = f.querySelector(".pane-footer-words") ?? f;
      return {
        top: r.top,
        height: r.height,
        bottom: r.bottom,
        mid: textBox(words).mid,
      };
    });
    return {
      settings: {
        top: sr.top,
        height: sr.height,
        bottom: sr.bottom,
        mid: textBox(label).mid,
      },
      footers,
      viewport: window.innerHeight,
    };
  });
}

for (const split of [false, true]) {
  test(`sidebar bottom row and pane footer form one band (${split ? "split" : "single"})`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await openProject(page, "Band check", "Blank");
    if (split) {
      await page.getByRole("button", { name: "New section", exact: true }).click();
      await page.getByLabel("Title", { exact: true }).fill("Two");
      await page.getByRole("button", { name: "Save", exact: true }).click();
      await expect(page.getByRole("dialog")).toHaveCount(0);
      await page
        .locator(".sidebar .entry-main")
        .filter({ hasText: /^Opening/ })
        .click();
      await page
        .locator(".sidebar .entry-main")
        .filter({ hasText: /^Two/ })
        .click({ modifiers: ["ControlOrMeta"] });
      await expect(page.locator(".split-pane")).toHaveCount(2);
      await expect(page.locator(".pane-footer")).toHaveCount(2);
    }
    const m = await bandMetrics(page);
    expect(m.footers.length).toBe(split ? 2 : 1);
    for (const f of m.footers) {
      expect(Math.abs(m.settings.top - f.top)).toBeLessThanOrEqual(1);
      expect(Math.abs(m.settings.mid - f.mid)).toBeLessThanOrEqual(1);
      expect(Math.abs(m.settings.height - f.height)).toBeLessThanOrEqual(1);
      expect(Math.abs(f.bottom - m.viewport)).toBeLessThanOrEqual(1);
    }
    expect(Math.abs(m.settings.bottom - m.viewport)).toBeLessThanOrEqual(1);
  });
}
