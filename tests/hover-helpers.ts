import type { Page } from "@playwright/test";

export type Control = {
  screen: string;
  id: string;
  selector: string;
  text: string;
  kind: "text" | "icon";
  box: { x: number; y: number; width: number; height: number };
  // computed on the untouched (not hovered) tree
  rest: { weight: string; transform: string; color: string };
  disabled: boolean;
};

export type HoverSample = {
  weight: string;
  transform: string;
  color: string;
  duration: string;
  stroke: number;
  strokeColor: string;
};

const CONTROL_SELECTOR =
  'button, a[href], [role="tab"], [role="menuitem"], [role="option"], summary, label:has(input[type="checkbox"]), label:has(input[type="radio"])';

/**
 * Every visible control on the current screen. `kind` is "text" when the element has non-empty
 * visible text outside aria-hidden descendants, otherwise "icon". Each element is tagged with a
 * data-h1-id so it can be hovered and re-read later.
 */
export async function crawlControls(page: Page, screen: string): Promise<Control[]> {
  return page.evaluate(
    ({ screen, sel }) => {
      const out: any[] = [];
      const cssPath = (el: Element) => {
        const parts: string[] = [];
        let n: Element | null = el;
        while (n && n !== document.body && parts.length < 4) {
          let p = n.tagName.toLowerCase();
          const cls = [...n.classList].filter((c) => !/^\d/.test(c)).slice(0, 2);
          if (cls.length) p += "." + cls.join(".");
          const role = n.getAttribute("role");
          if (role) p += `[role=${role}]`;
          parts.unshift(p);
          n = n.parentElement;
        }
        return parts.join(" > ");
      };
      const visibleText = (el: Element): string => {
        let t = "";
        const walk = (n: Node) => {
          if (n.nodeType === 3) t += n.textContent ?? "";
          else if (n instanceof Element && n.getAttribute("aria-hidden") !== "true" && n.tagName !== "SVG" && n.tagName !== "svg" && getComputedStyle(n).display !== "none")
            n.childNodes.forEach(walk);
        };
        el.childNodes.forEach(walk);
        return t.replace(/\s+/g, " ").trim();
      };
      let counter = (window as any).__h1n ?? 0;
      document.querySelectorAll(sel).forEach((el) => {
        const r = el.getBoundingClientRect();
        if (r.width < 2 || r.height < 2) return;
        const cs = getComputedStyle(el);
        if (cs.visibility === "hidden" || cs.display === "none") return;
        if (el.closest("[aria-hidden='true'], [inert]")) return;
        // the user's document is never emphasised (review finding 1): its links are not controls
        if (el.matches("a[href]") && el.closest(".ProseMirror, .writing-surface, .manuscript-read, .preview-content")) return;
        if ((el as HTMLElement).dataset.h1Id === undefined) (el as HTMLElement).dataset.h1Id = "c" + counter++;
        const text = visibleText(el);
        out.push({
          screen,
          id: (el as HTMLElement).dataset.h1Id,
          selector: cssPath(el),
          text: text.slice(0, 40) || (el.getAttribute("aria-label") ?? el.getAttribute("title") ?? "").slice(0, 40),
          kind: text ? "text" : "icon",
          box: { x: Math.round(r.x), y: Math.round(r.y), width: Math.round(r.width), height: Math.round(r.height) },
          rest: { weight: cs.fontWeight, transform: cs.transform, color: cs.color },
          disabled: (el as HTMLButtonElement).disabled === true || el.getAttribute("aria-disabled") === "true" || !!el.closest("label")?.querySelector("input:disabled") && el.tagName === "LABEL",
        });
      });
      (window as any).__h1n = counter;
      return out;
    },
    { screen, sel: CONTROL_SELECTOR },
  );
}

/** Hover a crawled control and read its computed emphasis after the transition has had time to settle. */
export async function hoverSample(page: Page, id: string, settleMs = 200): Promise<HoverSample | null> {
  const loc = page.locator(`[data-h1-id="${id}"]`);
  if ((await loc.count()) !== 1) return null;
  try {
    let b = await loc.boundingBox({ timeout: 800 });
    if (!b) return null;
    if (b.y < 0 || b.y + b.height > 900 || b.x < 0 || b.x + b.width > 1440) {
      await loc.scrollIntoViewIfNeeded({ timeout: 800 });
      b = await loc.boundingBox({ timeout: 800 });
      if (!b) return null;
    }
    await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
    await page.waitForTimeout(settleMs);
    // a dialog that is still animating in can move under the pointer: land again if the hover did not take
    if (!(await loc.evaluate((el) => el.matches(":hover")))) {
      const b2 = await loc.boundingBox({ timeout: 800 });
      if (b2) await page.mouse.move(b2.x + b2.width / 2, b2.y + b2.height / 2, { steps: 2 });
      await page.waitForTimeout(settleMs);
    }
    return await loc.evaluate((el) => {
      const cs = getComputedStyle(el);
      return { weight: cs.fontWeight, transform: cs.transform, color: cs.color, duration: cs.transitionDuration, stroke: parseFloat(cs.webkitTextStrokeWidth) || 0, strokeColor: cs.webkitTextStrokeColor };
    });
  } catch {
    return null;
  }
}

/** Move the pointer away, focus a crawled control from the keyboard and read its computed emphasis. */
export async function focusSample(page: Page, id: string, settleMs = 220): Promise<HoverSample | null> {
  const loc = page.locator(`[data-h1-id="${id}"]`);
  if ((await loc.count()) !== 1) return null;
  try {
    await page.mouse.move(720, 892);
    await loc.scrollIntoViewIfNeeded({ timeout: 800 });
    await page.keyboard.press("Shift"); // keyboard modality, so :focus-visible applies on focus()
    await loc.evaluate((el) => (el as HTMLElement).focus());
    await page.waitForTimeout(settleMs);
    const out = await loc.evaluate((el) => {
      const cs = getComputedStyle(el);
      const ok = el.matches(":focus-visible");
      const res = { weight: cs.fontWeight, transform: cs.transform, color: cs.color, duration: cs.transitionDuration, stroke: parseFloat(cs.webkitTextStrokeWidth) || 0, strokeColor: cs.webkitTextStrokeColor, ok };
      (el as HTMLElement).blur();
      return res;
    });
    return out.ok ? out : null;
  } catch {
    return null;
  }
}
