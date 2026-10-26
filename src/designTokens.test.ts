import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
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
        .filter((prop) => prop.startsWith("--") && !/^--(type|space|ease|duration|focus|pressed|disabled)/.test(prop))
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
});
