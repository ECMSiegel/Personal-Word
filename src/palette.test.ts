import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// Reads src/styles.css as text and checks the Color palette: every colour used
// as text, icon or fill passes WCAG AA (4.5:1) against every surface it sits
// on, in light and dark, and the Plain tokens keep today's values.

const TEXT_TOKENS = [
  "--accent",
  "--danger",
  "--success",
  "--warning",
  "--tint-manuscript",
  "--tint-fragments",
  "--tint-research",
];
const FILL_TOKENS = ["--accent-fill", "--danger-fill"];

const css = readFileSync(join(process.cwd(), "src/styles.css"), "utf8");

function tokens(selector: string): Record<string, string> {
  const clean = css.replace(/\/\*[\s\S]*?\*\//g, "");
  const out: Record<string, string> = {};
  let found = false;
  for (const m of clean.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    if (m[1].replace(/\s+/g, " ").trim() !== selector) continue;
    found = true;
    for (const part of m[2].split(";")) {
      const colon = part.indexOf(":");
      if (colon < 0) continue;
      const prop = part.slice(0, colon).trim();
      if (prop.startsWith("--")) out[prop] = part.slice(colon + 1).trim().toUpperCase();
    }
  }
  expect(found, `${selector} block exists`).toBe(true);
  return out;
}

function channel(value: number): number {
  const c = value / 255;
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}
function luminance(hex: string): number {
  const n = parseInt(hex.slice(1), 16);
  return (
    0.2126 * channel((n >> 16) & 255) +
    0.7152 * channel((n >> 8) & 255) +
    0.0722 * channel(n & 255)
  );
}
function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

function hexOf(n: number): string {
  return "#" + [16, 8, 0].map((s) => ((n >> s) & 255).toString(16).padStart(2, "0")).join("").toUpperCase();
}
// The sliding selection fill paints --text at N% over the sidebar.
function selectedRow(base: Record<string, string>): string {
  const rule = css.match(/\.sidebar-highlight\s*\{[^}]*background:\s*color-mix\(in srgb,\s*var\(--text\)\s*(\d+)%,\s*transparent\)/);
  expect(rule, ".sidebar-highlight color-mix rule").not.toBeNull();
  const pct = Number(rule![1]) / 100;
  const text = parseInt(base["--text"].slice(1), 16);
  const side = parseInt(base["--sidebar"].slice(1), 16);
  let out = 0;
  for (const s of [16, 8, 0]) {
    out |= Math.round(((text >> s) & 255) * pct + ((side >> s) & 255) * (1 - pct)) << s;
  }
  return hexOf(out);
}
function surfacesOf(selector: string): string[] {
  const t = tokens(selector);
  return [t["--paper"], t["--surface"], t["--sidebar"], selectedRow(t)];
}
const LIGHT_SURFACES = surfacesOf(":root");
const DARK_SURFACES = surfacesOf(":root[data-theme=\"dark\"]");

const COLOR_LIGHT = ':root[data-palette="color"]';
const COLOR_DARK_SYSTEM = ':root[data-palette="color"]:not([data-theme="light"])';
const COLOR_DARK = ':root[data-palette="color"][data-theme="dark"]';
const SWATCHES = ["red", "orange", "yellow", "green", "teal", "blue", "indigo", "purple"] as const;
const LIGHT_SWATCHES = {
  red: "#CC0B00", orange: "#955600", yellow: "#7B6300", green: "#1E7434",
  teal: "#1E6F7E", blue: "#0062CD", indigo: "#5654D6", purple: "#9A28D4",
};
const DARK_SWATCHES = {
  red: "#FF665D", orange: "#FF9F0A", yellow: "#FFD60A", green: "#30D158",
  teal: "#40C8E0", blue: "#41A0FF", indigo: "#918FEE", purple: "#CA75F4",
};

describe("Color palette", () => {
  for (const [mode, selector, surfaces] of [
    ["light", COLOR_LIGHT, LIGHT_SURFACES],
    ["dark (System)", COLOR_DARK_SYSTEM, DARK_SURFACES],
    ["dark (Dark override)", COLOR_DARK, DARK_SURFACES],
  ] as const) {
    it(`passes AA against every ${mode} surface`, () => {
      const t = tokens(selector);
      const failures: string[] = [];
      for (const name of TEXT_TOKENS) {
        expect(t[name], `${selector} ${name}`).toMatch(/^#[0-9A-F]{6}$/);
        for (const surface of surfaces) {
          const ratio = contrast(t[name], surface);
          if (ratio < 4.5) failures.push(`${name} ${t[name]} on ${surface} = ${ratio.toFixed(2)}`);
        }
      }
      for (const name of FILL_TOKENS) {
        expect(t[name], `${selector} ${name}`).toMatch(/^#[0-9A-F]{6}$/);
        const ratio = contrast(t["--on-accent"], t[name]);
        if (ratio < 4.5) failures.push(`${t["--on-accent"]} text on ${name} ${t[name]} = ${ratio.toFixed(2)}`);
      }
      expect(failures).toEqual([]);
    });
  }

  it("uses the planned hex values in light and dark", () => {
    expect(tokens(COLOR_LIGHT)).toMatchObject({
      "--accent": "#0062CD",
      "--accent-fill": "#0072EF",
      "--danger": "#CC0A00",
      "--danger-fill": "#ED0D00",
      "--success": "#1E7434",
      "--warning": "#7B6300",
      "--tint-manuscript": "#0062CD",
      "--tint-fragments": "#1E7434",
      "--tint-research": "#955600",
      "--on-accent": "#FFFFFF",
    });
    for (const selector of [COLOR_DARK_SYSTEM, COLOR_DARK]) {
      expect(tokens(selector)).toMatchObject({
        "--accent": "#41A0FF",
        "--accent-fill": "#0074E8",
        "--danger": "#FF6D65",
        "--danger-fill": "#EC0D00",
        "--success": "#30D158",
        "--warning": "#FFD60A",
        "--tint-manuscript": "#41A0FF",
        "--tint-fragments": "#30D158",
        "--tint-research": "#FF9F0A",
        "--on-accent": "#FFFFFF",
      });
    }
  });

  it("keeps the dark Color tokens identical in the System media block and the Dark override", () => {
    expect(tokens(COLOR_DARK_SYSTEM)).toEqual(tokens(COLOR_DARK));
  });

  it("defines every planned section swatch and keeps it AA on every surface", () => {
    for (const [selector, surfaces, expected] of [
      [COLOR_LIGHT, LIGHT_SURFACES, LIGHT_SWATCHES],
      [COLOR_DARK_SYSTEM, DARK_SURFACES, DARK_SWATCHES],
      [COLOR_DARK, DARK_SURFACES, DARK_SWATCHES],
    ] as const) {
      const palette = tokens(selector);
      for (const name of SWATCHES) {
        const value = palette[`--swatch-${name}`];
        expect(value, `${selector} --swatch-${name}`).toBe(expected[name]);
        for (const surface of surfaces) {
          expect(contrast(value, surface), `${name} ${value} on ${surface}`).toBeGreaterThanOrEqual(4.5);
        }
      }
    }
    expect(tokens(COLOR_LIGHT)["--swatch-blue"]).toBe(tokens(COLOR_LIGHT)["--tint-manuscript"]);
    expect(tokens(COLOR_LIGHT)["--swatch-green"]).toBe(tokens(COLOR_LIGHT)["--tint-fragments"]);
    expect(tokens(COLOR_LIGHT)["--swatch-orange"]).toBe(tokens(COLOR_LIGHT)["--tint-research"]);
    expect(tokens(COLOR_DARK)["--swatch-blue"]).toBe(tokens(COLOR_DARK)["--tint-manuscript"]);
    expect(tokens(COLOR_DARK)["--swatch-green"]).toBe(tokens(COLOR_DARK)["--tint-fragments"]);
    expect(tokens(COLOR_DARK)["--swatch-orange"]).toBe(tokens(COLOR_DARK)["--tint-research"]);
  });

  it("maps each selected section swatch only in the Color palette", () => {
    const clean = css.replace(/\/\*[\s\S]*?\*\//g, "");
    const normalized = clean.replace(/\s+/g, " ");
    for (const section of ["manuscript", "fragments", "research"] as const) {
      for (const name of SWATCHES) {
        const rule = `:root[data-palette="color"][data-tint-${section}="${name}"] { --tint-${section}: var(--swatch-${name}); }`;
        expect(normalized).toContain(rule);
      }
    }
  });
});

describe("Document focus ring", () => {
  it("pins --focus-ring to the Plain accent inside the document areas", () => {
    expect(tokens(':root[data-palette="color"] :is(.writer-scroll, .manuscript-read, .preview-content)')["--focus-ring"]).toBe(
      "2PX SOLID VAR(--ACCENT-PLAIN)",
    );
  });
});

describe("Plain palette", () => {
  it("keeps today's accent and danger values", () => {
    const light = tokens(":root");
    expect(light["--accent-plain"]).toBe("#0069D9");
    expect(light["--danger-plain"]).toBe("#B42318");
    expect(light["--accent"]).toBe("VAR(--ACCENT-PLAIN)");
    expect(light["--danger"]).toBe("VAR(--DANGER-PLAIN)");
    for (const selector of [':root:not([data-theme="light"])', ':root[data-theme="dark"]']) {
      const dark = tokens(selector);
      expect(dark["--accent-plain"]).toBe("#64A8FF");
      expect(dark["--danger-plain"]).toBe("#FF958D");
      expect(dark["--accent"]).toBeUndefined();
      expect(dark["--danger"]).toBeUndefined();
    }
  });
});

describe("Popover items", () => {
  const popover = readFileSync(join(process.cwd(), "src/components/popover.css"), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
  const item = popover.match(/\[data-popover-item\]\s*\{([^}]*)\}/);

  it("paint --text at full opacity, with no fade-in that can leave them faint", () => {
    expect(item, "[data-popover-item] rule exists").not.toBeNull();
    expect(item![1]).toMatch(/color:\s*var\(--text\)/);
    expect(item![1]).toMatch(/opacity:\s*1\s*;/);
    expect(item![1]).not.toMatch(/transition/);
    const named = popover.match(/\.popover-item\s*\{([^}]*)\}/);
    if (named) expect(named[1]).not.toMatch(/transition/);
    expect(popover).not.toMatch(/@starting-style[\s\S]*?popover-item/);
  });

  it("have --text reach 4.5:1 on --paper in light and dark", () => {
    for (const selector of [":root", ':root:not([data-theme="light"])', ':root[data-theme="dark"]']) {
      const t = tokens(selector);
      const base = selector === ":root" ? t : { ...tokens(":root"), ...t };
      expect(contrast(base["--text"], base["--paper"]), selector).toBeGreaterThanOrEqual(4.5);
    }
  });
});
