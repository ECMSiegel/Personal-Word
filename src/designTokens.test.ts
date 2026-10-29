import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

// Reads the stylesheets as text (plain Node, no DOM) and checks the type and
// spacing scales: every UI font size is a --type-* token, every 4-32 px
// padding/margin/gap in the two swept files is a --space-* token, and no UI
// text anywhere is smaller than 12 px.

const SWEPT = ["src/styles.css", "src/components/dropdown.css"];
const ALL = [
  ...SWEPT,
  "src/editor/editor.css",
  "src/research/research.css",
  "src/organization/organization.css",
  "src/organization/fragments.css",
];

// Document and reading-view typography: never swept onto UI tokens.
const DOCUMENT_SELECTORS = [
  ".writing-surface",
  ".read-prose",
  ".manuscript-read",
  ".read-title",
  ".preview-content",
];
// Page and footnote rules in editor.css are document typography too.
const DOCUMENT_EDITOR_SELECTORS = ["footnote", "page-", "ProseMirror"];

function read(file: string): string {
  return readFileSync(join(process.cwd(), file), "utf8");
}

// Innermost `{...}` blocks with their selector; comments are blanked first.
function cssRules(text: string): { selector: string; body: string }[] {
  const clean = text.replace(/\/\*[\s\S]*?\*\//g, (m) => " ".repeat(m.length));
  const rules: { selector: string; body: string }[] = [];
  const re = /([^{}]+)\{([^{}]*)\}/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(clean))) {
    rules.push({ selector: match[1].trim(), body: match[2] });
  }
  return rules;
}

function declarations(body: string): { prop: string; value: string }[] {
  return body
    .split(";")
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      const colon = part.indexOf(":");
      return {
        prop: part.slice(0, colon).trim().toLowerCase(),
        value: part.slice(colon + 1).trim(),
      };
    })
    .filter((d) => d.prop && !d.prop.startsWith("--"));
}

function isDocument(selector: string, file: string): boolean {
  if (DOCUMENT_SELECTORS.some((s) => selector.includes(s))) return true;
  return (
    file === "src/editor/editor.css" &&
    DOCUMENT_EDITOR_SELECTORS.some((s) => selector.includes(s))
  );
}

// Values with calc()/max()/min()/clamp() are layout expressions, not literals.
function stripExpressions(value: string): string {
  let out = value;
  let previous = "";
  while (out !== previous) {
    previous = out;
    out = out.replace(/(calc|max|min|clamp)\([^()]*\)/g, "");
  }
  return out;
}

function pxNumbers(value: string): number[] {
  const out: number[] = [];
  for (const m of value.matchAll(/(?<![\w.-])(\d+(?:\.\d+)?)px/g)) {
    out.push(Number(m[1]));
  }
  return out;
}

const SPACING_PROP = /^(padding|margin|gap|row-gap|column-gap)(-[a-z]+)*$/;

describe("design tokens", () => {
  it("uses --type-* tokens for every UI font size in the swept files", () => {
    const violations: string[] = [];
    for (const file of SWEPT) {
      for (const rule of cssRules(read(file))) {
        if (isDocument(rule.selector, file)) continue;
        for (const d of declarations(rule.body)) {
          if (d.prop !== "font-size" && d.prop !== "font") continue;
          if (/\d+(\.\d+)?px/.test(stripExpressions(d.value))) {
            violations.push(`${file} ${rule.selector} { ${d.prop}: ${d.value.replace(/\s+/g, " ")} }`);
          }
        }
      }
    }
    expect(violations).toEqual([]);
  });

  it("uses --space-* tokens for every 4-32 px padding, margin and gap in the swept files", () => {
    const violations: string[] = [];
    for (const file of SWEPT) {
      for (const rule of cssRules(read(file))) {
        if (isDocument(rule.selector, file)) continue;
        for (const d of declarations(rule.body)) {
          if (!SPACING_PROP.test(d.prop)) continue;
          const literals = pxNumbers(stripExpressions(d.value)).filter(
            (n) => n >= 4 && n <= 32,
          );
          if (literals.length > 0) {
            violations.push(`${file} ${rule.selector} { ${d.prop}: ${d.value.replace(/\s+/g, " ")} }`);
          }
        }
      }
    }
    expect(violations).toEqual([]);
  });

  it("keeps all UI text at 12 px or larger in every stylesheet", () => {
    const violations: string[] = [];
    for (const file of ALL) {
      for (const rule of cssRules(read(file))) {
        if (isDocument(rule.selector, file)) continue;
        for (const d of declarations(rule.body)) {
          if (d.prop !== "font-size" && d.prop !== "font") continue;
          const small = pxNumbers(stripExpressions(d.value)).filter((n) => n < 12);
          if (small.length > 0) {
            violations.push(`${file} ${rule.selector} { ${d.prop}: ${d.value.replace(/\s+/g, " ")} }`);
          }
        }
      }
    }
    expect(violations).toEqual([]);
  });

  it("defines pressed states and one focus ring recipe", () => {
    const styles = read("src/styles.css");
    expect(styles).toMatch(/button:active:not\(:disabled\)/);
    const press = cssRules(styles).find((r) => r.selector === "button:active:not(:disabled)");
    expect(press?.body).toMatch(/--press-s:\s*0\.99/);
    expect(press?.body).toMatch(/transform:\s*scale\(calc\(var\(--emph-s, 1\) \* var\(--press-s\)\)\)/);
    expect(press?.body).not.toMatch(/background/);
    expect(styles).toMatch(/\.primary:active:not\(:disabled\)/);
    const dropdown = read("src/components/dropdown.css");
    expect(dropdown).toMatch(/\.dropdown-button:active:not\(:disabled\)/);
    const editorLines = read("src/editor/editor.css").split("\n").slice(149, 200).join("\n");
    expect(editorLines).toMatch(/:active:not\(:disabled\)/);
    const stale = /outline:\s*[12]px solid var\(--accent\)/;
    expect(styles).not.toMatch(stale);
    expect(dropdown).not.toMatch(stale);
    expect(editorLines).not.toMatch(stale);
    expect(styles).toMatch(/--focus-ring:\s*2px solid var\(--accent\)/);
    expect(styles).toMatch(/--pressed:\s*var\(--line\)/);
    expect(styles).toMatch(/--disabled-opacity:\s*0\.35/);
  });
  it("paints no grey box on hover or press in any stylesheet", () => {
    // Hover, focus and selection show by colour or weight, never by a fill.
    // Accent-coloured thin handles and the primary button are not boxes.
    const GREY = /--(surface|pressed|sidebar|line|paper|elevation|selection)|color-mix|rgba?\(|#[0-9a-f]{3,8}/i;
    const files: string[] = [];
    const walk = (dir: string) => {
      for (const entry of readdirSync(join(process.cwd(), dir), { withFileTypes: true })) {
        const path = `${dir}/${entry.name}`;
        if (entry.isDirectory()) walk(path);
        else if (entry.name.endsWith(".css")) files.push(path);
      }
    };
    walk("src");
    const violations: string[] = [];
    for (const file of files) {
      for (const rule of cssRules(read(file))) {
        const selectors = rule.selector.replace(/\s+/g, " ").split(/,(?![^(]*\))/).map((s) => s.trim());
        const live = selectors.filter((s) => /:(hover|active|focus-visible)|\[data-highlighted/.test(s));
        if (live.length === 0) continue;
        for (const d of declarations(rule.body)) {
          if (/^background(-color)?$/.test(d.prop) && GREY.test(d.value)) {
            violations.push(`${file} ${live[0]} { ${d.prop}: ${d.value.replace(/\s+/g, " ")} }`);
          }
        }
      }
    }
    expect(violations).toEqual([]);
  });
  it("keeps the dark tokens identical in the System media block and the Dark override", () => {
    const rules = cssRules(read("src/styles.css"));
    const tokens = (selector: string) => {
      const rule = rules.find((r) => r.selector.replace(/\s+/g, " ") === selector);
      expect(rule, selector).toBeDefined();
      return rule!.body
        .split(";")
        .map((part) => part.trim().replace(/\s+/g, " "))
        .filter((part) => part && !part.startsWith("color-scheme"))
        .sort();
    };
    const system = tokens(':root:not([data-theme="light"])');
    const dark = tokens(':root[data-theme="dark"]');
    expect(system.length).toBeGreaterThan(5);
    expect(dark).toEqual(system);
    expect(read("src/styles.css")).toMatch(
      /@media \(prefers-color-scheme: dark\) \{\s*:root:not\(\[data-theme="light"\]\)/,
    );
  });
  it("has a Light override and the same colour token names in light and dark", () => {
    const rules = cssRules(read("src/styles.css"));
    const find = (selector: string) =>
      rules.find((r) => r.selector.replace(/\s+/g, " ") === selector);
    const light = find(':root[data-theme="light"]');
    expect(light, ':root[data-theme="light"]').toBeDefined();
    expect(light!.body.replace(/\s+/g, " ")).toMatch(/color-scheme:\s*light/);
    const names = (body: string) =>
      body
        .split(";")
        .map((part) => part.split(":")[0].trim())
        .filter((prop) => prop.startsWith("--") && !/^--(type|space|ease|duration|focus|pressed|disabled|elevation|shadow-raised|control|header|icon|emph)/.test(prop))
        .sort();
    const lightNames = names(find(":root")!.body);
    const darkNames = names(find(':root[data-theme="dark"]')!.body);
    // The light block defines --accent and --danger as aliases of the --*-plain
    // values; the dark blocks override the --*-plain values only. Everything
    // else (the colour token names) must match exactly.
    const alias = (list: string[]) =>
      list.filter((n) => n !== "--accent" && n !== "--danger");
    expect(alias(darkNames)).toEqual(alias(lightNames));
    expect(darkNames.length).toBeGreaterThan(5);
  });
  it("defines the elevation, control-height and icon aliases on :root", () => {
    const root = cssRules(read("src/styles.css")).find(
      (r) => r.selector.replace(/\s+/g, " ") === ":root",
    );
    expect(root, ":root").toBeDefined();
    const token = (body: string, prop: string) => {
      const part = body
        .split(";")
        .map((item) => item.trim().replace(/\s+/g, " "))
        .find((item) => item.startsWith(`${prop}:`));
      expect(part, prop).toBeDefined();
      return part!.slice(part!.indexOf(":") + 1).trim();
    };
    const expected: Record<string, string> = {
      "--elevation-page": "var(--paper)",
      "--elevation-surface": "var(--surface)",
      "--elevation-raised": "var(--paper)",
      "--shadow-raised": "0 6px 18px var(--shadow)",
      "--control-height": "32px",
      "--header-gap": "var(--space-2)",
      "--icon-size": "16px",
      "--icon-chevron": "14px",
    };
    for (const [prop, value] of Object.entries(expected)) {
      expect(token(root!.body, prop), prop).toBe(value);
    }
  });
  it("draws the dropdown menu on the raised surface", () => {
    const menu = cssRules(read("src/components/dropdown.css")).find(
      (r) => r.selector.replace(/\s+/g, " ") === ".dropdown-menu",
    );
    expect(menu, ".dropdown-menu").toBeDefined();
    const value = (prop: string) =>
      declarations(menu!.body).find((d) => d.prop === prop)?.value;
    expect(value("background")).toBe("var(--elevation-raised)");
    expect(value("box-shadow")).toBe("var(--shadow-raised)");
    const check = cssRules(read("src/components/dropdown.css")).find(
      (r) => r.selector.replace(/\s+/g, " ") === ".dropdown-check",
    );
    expect(check, ".dropdown-check").toBeDefined();
    expect(declarations(check!.body).find((d) => d.prop === "width")?.value).toBe(
      "16px",
    );
  });
  it("draws popovers on the raised surface with items opaque from the first frame", () => {
    const rules = cssRules(read("src/components/popover.css"));
    const rule = (selector: string) => {
      const found = rules.find((r) => r.selector.replace(/\s+/g, " ") === selector);
      expect(found, selector).toBeDefined();
      return (prop: string) =>
        declarations(found!.body).find((d) => d.prop === prop)?.value;
    };
    const surface = rule(".popover");
    expect(surface("background")).toBe("var(--elevation-raised)");
    expect(surface("box-shadow")).toBe("var(--shadow-raised)");
    expect(surface("border")).toBe("1px solid var(--line)");
    expect(surface("border-radius")).toBe("0");
    const item = rule("[data-popover-item]");
    expect(item("opacity")).toBe("1");
    expect(item("color")).toBe("var(--text)");
    // No rule in popover.css may transition or animate opacity.
    for (const r of rules) {
      for (const d of declarations(r.body)) {
        if (/^(transition|animation)/.test(d.prop))
          expect(d.value, `${r.selector} ${d.prop}`).not.toMatch(/opacity|all/);
      }
    }
  });
  it("draws separators, tabular counters, 24 px hit areas and the optical hook", () => {
    const styles = read("src/styles.css");
    const rules = cssRules(styles);
    const bodies = (predicate: (selector: string) => boolean) =>
      rules.filter((r) => predicate(r.selector));
    const withBody = (predicate: (selector: string) => boolean, body: RegExp) =>
      bodies(predicate).filter((r) => body.test(r.body));

    const separator = bodies((s) => s === ".separator");
    expect(separator.length).toBe(1);
    expect(separator[0].body).toMatch(/width:\s*1px/);
    expect(separator[0].body).toMatch(/background:\s*var\(--line\)/);

    const vertical = bodies(
      (s) =>
        s.includes(".separator") && s.includes('[aria-orientation="vertical"]'),
    );
    expect(vertical.length).toBe(1);
    expect(vertical[0].body).toMatch(/height:\s*auto/);
    expect(vertical[0].body).toMatch(/align-self:\s*stretch/);

    const tabular = withBody(
      () => true,
      /font-variant-numeric:\s*tabular-nums/,
    );
    expect(tabular.length).toBeGreaterThan(0);
    const counters = tabular.map((r) => r.selector).join(" ");
    expect(counters).toContain(".pane-footer");
    expect(counters).toContain(".save-status");

    const hit = withBody(
      (s) => s.endsWith("::after") && s.includes(".icon-button"),
      /position:\s*absolute/,
    );
    expect(hit.length).toBe(1);
    expect(hit[0].selector).toContain(".toolbar-icon");
    expect(hit[0].body).toMatch(/width:\s*max\(24px,\s*100%\)/);
    expect(hit[0].body).toMatch(/height:\s*max\(24px,\s*100%\)/);

    const optical = withBody(
      (s) => s.includes("> svg") && s.includes(".toolbar-icon"),
      /translate\(var\(--optical-x,\s*0\),\s*var\(--optical-y,\s*0\)\)/,
    );
    expect(optical.length).toBe(1);
  });

  it("sizes every icon at 16 px (chevrons 14 px) with one stroke", () => {
    const files: string[] = [];
    const walk = (dir: string) => {
      for (const entry of readdirSync(join(process.cwd(), dir), {
        withFileTypes: true,
      })) {
        const path = `${dir}/${entry.name}`;
        if (entry.isDirectory()) walk(path);
        else if (entry.name.endsWith(".tsx")) files.push(path);
      }
    };
    walk("src");
    const wrong: string[] = [];
    const stroked: string[] = [];
    for (const file of files) {
      const text = read(file);
      for (const match of text.matchAll(
        /<([A-Z][A-Za-z0-9]*)([^<>]*?)size=\{(\d+)\}/g,
      )) {
        const expected = match[1].startsWith("Chevron") ? 14 : 16;
        if (Number(match[3]) !== expected)
          wrong.push(`${file}: <${match[1]} size={${match[3]}}>`);
      }
      if (/strokeWidth=|absoluteStrokeWidth/.test(text)) stroked.push(file);
    }
    expect(wrong).toEqual([]);
    expect(stroked).toEqual([]);
  });
});
