import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

// UI wave 4 H4: the hover/focus emphasis lives in ONE rule (src/styles.css, "Text-control emphasis").
// This scan fails when another rule starts to set hover weight, a hover scale or a text stroke.

function cssFiles(dir: string): string[] {
  return readdirSync(join(process.cwd(), dir)).flatMap((name) => {
    const rel = join(dir, name);
    if (statSync(join(process.cwd(), rel)).isDirectory()) return cssFiles(rel);
    return rel.endsWith(".css") ? [rel] : [];
  });
}
function rules(file: string): { file: string; selector: string; body: string }[] {
  const text = readFileSync(join(process.cwd(), file), "utf8").replace(/\/\*[\s\S]*?\*\//g, (m) => " ".repeat(m.length));
  const out: { file: string; selector: string; body: string }[] = [];
  const re = /([^{}]+)\{([^{}]*)\}/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) out.push({ file, selector: m[1].replace(/^[\s;]*(@media[^{]*\{)?/, "").trim(), body: m[2] });
  return out;
}
const ALL = cssFiles("src").flatMap(rules);
const has = (body: string, prop: string) => new RegExp(`(^|[;\\s])${prop.replace(/[-]/g, "\\-")}\\s*:`).test(body);
const INTERACTIVE = /:hover|:focus-visible|\[data-highlighted\]|\.is-highlighted/;

// Hover/focus selectors allowed to set font-weight: none. State rules (aria-pressed, .selected,
// .is-current, .active) have no :hover/:focus-visible in their selector so they never show here.
const WEIGHT_ALLOWLIST: string[] = [];

describe("hover emphasis consistency", () => {
  it("(a) exactly one rule sets the stroke and --emph-s together, and it is in styles.css", () => {
    const hits = ALL.filter((r) => /--emph-s\s*:/.test(r.body) && /-webkit-text-stroke\s*:\s*var\(--emph-stroke\)/.test(r.body));
    expect(hits.map((r) => r.file)).toEqual(["src/styles.css"]);
    expect(hits[0].selector).toMatch(/:hover/);
  });

  it("(b) no other hover/focus rule sets font-weight", () => {
    const bad = ALL.filter((r) => INTERACTIVE.test(r.selector) && has(r.body, "font-weight") && !WEIGHT_ALLOWLIST.some((a) => r.selector.includes(a)));
    expect(bad.map((r) => `${r.file}: ${r.selector}`)).toEqual([]);
  });

  it("(c) no other rule sets a hover/focus scale or a text stroke", () => {
    // .spy-line is the one allowed hover transform: its own scaleX line (scrollspy.css), not text emphasis
    const SCALE_ALLOWLIST = [".spy-line"];
    const scale = ALL.filter(
      (r) => INTERACTIVE.test(r.selector) && /transform\s*:[^;]*scale[XYZ3d]*\(/.test(r.body) && !SCALE_ALLOWLIST.some((a) => r.selector.includes(a)),
    );
    expect(scale.map((r) => `${r.file}: ${r.selector}`)).toEqual([]);
    // --emph-s drives the scale: only the shared rule may set it (a drift rule `--emph-s: 1.3` would slip past the check above)
    const emphS = ALL.filter((r) => /(^|[;\s])--emph-s\s*:/.test(r.body));
    expect(emphS.map((r) => `${r.file}: ${r.selector}`).length).toBe(1);
    expect(emphS[0].file).toBe("src/styles.css");
    const stroke = ALL.filter((r) => has(r.body, "-webkit-text-stroke") && !/^\s*-webkit-text-stroke\s*:\s*0\s*;?\s*$/m.test(r.body) && !/var\(--emph-stroke\)/.test(r.body));
    expect(stroke.map((r) => `${r.file}: ${r.selector}`)).toEqual([]);
  });

  it("(c2) the document is excluded: links inside the editor, Read view and preview are never emphasised", () => {
    const css = readFileSync(join(process.cwd(), "src/styles.css"), "utf8");
    const heads = css.match(/:is\(button, a\[href\][^{]*\{/g) ?? [];
    const withExclusions = heads.filter((h) => h.includes(":not(:is("));
    expect(withExclusions.length).toBeGreaterThanOrEqual(2);
    for (const h of withExclusions) for (const sel of [".ProseMirror a", ".writing-surface a", ".manuscript-read a", ".preview-content a"]) expect(h).toContain(sel);
  });

  it("(c3) labels are emphasised only around checkboxes and radios, with a keyboard path", () => {
    const css = readFileSync(join(process.cwd(), "src/styles.css"), "utf8");
    for (const h of css.match(/:is\(button, a\[href\][^{]*\{/g) ?? []) expect(h).not.toContain("label:has(input)");
    expect(css).toContain("label:has(> input:focus-visible)");
  });

  it("(d) the tokens are 0.04em and 1.04, and no weight token is left", () => {
    const root = ALL.find((r) => r.file === "src/styles.css" && r.selector === ":root")!;
    expect(root.body).toMatch(/--emph-stroke:\s*0\.04em/);
    expect(root.body).toMatch(/--emph-scale:\s*1\.04/);
    expect(ALL.some((r) => /--emph-weight/.test(r.body))).toBe(false);
  });

  it("(e) Reduce Motion drops the scale only: it never unsets the stroke", () => {
    const css = readFileSync(join(process.cwd(), "src/styles.css"), "utf8");
    const block = /@media \(prefers-reduced-motion: reduce\) \{\s*:root \{([^}]*)\}/.exec(css);
    expect(block?.[1]).toMatch(/--emph-scale:\s*1\s*;/);
    expect(block?.[1]).not.toMatch(/stroke/);
    const reduced = css.match(/@media \(prefers-reduced-motion: reduce\) \{[\s\S]*?\n\}\n/g) ?? [];
    for (const b of reduced) expect(b).not.toMatch(/-webkit-text-stroke|--emph-stroke/);
  });
});
