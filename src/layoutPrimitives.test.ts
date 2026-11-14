import { describe, it, expect } from "vitest";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

// Layout primitives guard (plan T0, docs/agent-work/2026-11-12-layout-primitives/PLAN.md).
// (a) Per-file budget of hand-written spacing: declarations of margin*, padding*, gap, row-gap,
//     column-gap, height or min-height whose value is not zero. Any value counts (tokens, var(),
//     calc(), auto, %): the primitives in src/components/layout.css are meant to own spacing.
//     Rules whose selector names document typography, and everything inside @media print, are
//     skipped. The count must EQUAL the budget: above fails, below fails with "lower the budget".
// (b) Any z-index of 10 or more must be a var(--layer-*) token.
// (c) layout.css takes every size from tokens: no raw px except 0px, 1px hairlines, and the
//     16px divider length in .bar-divider.

const ROOT = process.cwd();
const BUDGET_FILE = "src/layoutBudget.json";
const LAYOUT = "src/components/layout.css";
const NOT_BUDGETED = [LAYOUT, "src/editor/side-ruler.css"];

// DOCUMENT_SELECTORS is read from designTokens.test.ts as text (importing a test file would
// register its suites a second time here), plus the plan's page and ruler selectors.
function documentSelectors(): string[] {
  const source = readFileSync(join(ROOT, "src/designTokens.test.ts"), "utf8");
  const block = /const DOCUMENT_SELECTORS = \[([\s\S]*?)\];/.exec(source);
  if (!block) throw new Error("DOCUMENT_SELECTORS not found in src/designTokens.test.ts");
  const shared = [...block[1].matchAll(/"([^"]+)"/g)].map((m) => m[1]);
  return [
    ...shared,
    ".editor-paper",
    ".page-sheet",
    ".page-spacer",
    ".document-ruler",
    ".ruler-strip",
    ".footnote-area",
  ];
}

function cssFiles(dir = join(ROOT, "src")): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) out.push(...cssFiles(full));
    else if (name.endsWith(".css")) out.push(relative(ROOT, full).split("\\").join("/"));
  }
  return out.sort();
}

type Rule = { selector: string; atRules: string[]; body: string };

// Every block that holds declarations, with the at-rules (@media, @supports, ...) around it.
function parseRules(text: string): Rule[] {
  const clean = text.replace(/\/\*[\s\S]*?\*\//g, (m) => " ".repeat(m.length));
  const rules: Rule[] = [];
  const stack: string[] = [];
  let start = 0;
  for (let i = 0; i < clean.length; i++) {
    const ch = clean[i];
    if (ch === "{") {
      stack.push(clean.slice(start, i).trim().split(";").pop()!.trim());
      start = i + 1;
    } else if (ch === "}") {
      const prelude = stack.pop() ?? "";
      const body = clean.slice(start, i);
      if (!prelude.startsWith("@") && body.includes(":")) {
        rules.push({ selector: prelude, atRules: stack.filter((s) => s.startsWith("@")), body });
      }
      start = i + 1;
    }
  }
  return rules;
}

function declarations(body: string): { prop: string; value: string }[] {
  return body
    .split(";")
    .map((part) => part.trim())
    .filter((part) => part.includes(":") && !part.includes("{"))
    .map((part) => {
      const colon = part.indexOf(":");
      return { prop: part.slice(0, colon).trim().toLowerCase(), value: part.slice(colon + 1).trim() };
    });
}

const SPACING_PROP = /^(margin(-.+)?|padding(-.+)?|gap|row-gap|column-gap|height|min-height)$/;
const isZero = (value: string) =>
  /^(?:[+-]?0(?:\.0+)?(?:px|em|rem|%)?\s*)+$/.test(value.replace(/!important/, "").trim());

function countSpacing(text: string, docSelectors: string[]): number {
  let count = 0;
  for (const rule of parseRules(text)) {
    if (rule.atRules.some((a) => /^@media\s+print\b/.test(a))) continue;
    if (rule.selector.startsWith("@")) continue;
    if (docSelectors.some((s) => rule.selector.includes(s))) continue;
    for (const d of declarations(rule.body)) {
      if (SPACING_PROP.test(d.prop) && !isZero(d.value)) count++;
    }
  }
  return count;
}

function currentCounts(): Record<string, number> {
  const docSelectors = documentSelectors();
  const counts: Record<string, number> = {};
  for (const file of cssFiles()) {
    if (NOT_BUDGETED.includes(file)) continue;
    counts[file] = countSpacing(readFileSync(join(ROOT, file), "utf8"), docSelectors);
  }
  return counts;
}

describe("layout primitives guard", () => {
  it("(a) hand-written spacing per CSS file equals src/layoutBudget.json", () => {
    const counts = currentCounts();
    const budgetPath = join(ROOT, BUDGET_FILE);
    if (!existsSync(budgetPath)) {
      const generated =
        "{\n" +
        Object.keys(counts)
          .sort()
          .map((f) => `  ${JSON.stringify(f)}: ${counts[f]}`)
          .join(",\n") +
        "\n}\n";
      throw new Error(`${BUDGET_FILE} is missing. Current counts (one file per line):\n${generated}`);
    }
    const budget = JSON.parse(readFileSync(budgetPath, "utf8")) as Record<string, number>;
    const problems: string[] = [];
    for (const [file, n] of Object.entries(counts)) {
      if (!(file in budget)) problems.push(`${file}: ${n} spacing declarations, not in the budget (add it with ${n})`);
      else if (n > budget[file]) problems.push(`${file}: ${n} spacing declarations, budget ${budget[file]} -- use the layout primitives instead`);
      else if (n < budget[file]) problems.push(`${file}: ${n} spacing declarations, budget ${budget[file]} -- lower the budget to ${n}`);
    }
    for (const file of Object.keys(budget)) {
      if (!(file in counts)) problems.push(`${file}: in the budget but no longer a counted CSS file -- remove its line`);
    }
    expect(problems).toEqual([]);
  });

  it("(b) every z-index of 10 or more is a --layer-* token", () => {
    const bad: string[] = [];
    for (const file of cssFiles()) {
      for (const rule of parseRules(readFileSync(join(ROOT, file), "utf8"))) {
        for (const d of declarations(rule.body)) {
          if (d.prop !== "z-index") continue;
          if (/^var\(--layer-[a-z-]+\)$/.test(d.value)) continue;
          const n = Number(d.value);
          if (!Number.isFinite(n) || n >= 10) bad.push(`${file}: ${rule.selector} { z-index: ${d.value} }`);
        }
      }
    }
    expect(bad).toEqual([]);
  });

  it("(c) layout.css takes sizes from tokens only", () => {
    const bad: string[] = [];
    for (const rule of parseRules(readFileSync(join(ROOT, LAYOUT), "utf8"))) {
      for (const d of declarations(rule.body)) {
        for (const m of d.value.matchAll(/(-?\d*\.?\d+)px/g)) {
          const px = Number(m[1]);
          if (px === 0 || px === 1) continue;
          if (px === 16 && rule.selector === ".bar-divider") continue;
          bad.push(`${rule.selector} { ${d.prop}: ${d.value} }`);
        }
      }
    }
    expect(bad).toEqual([]);
  });
});
