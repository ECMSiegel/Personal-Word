import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function cssFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? cssFiles(path) : path.endsWith(".css") ? [path] : [];
  });
}

describe("checkbox rules", () => {
  it("never give a checkbox a radius or the native look", () => {
    const bad: string[] = [];
    for (const file of cssFiles(__dirname)) {
      const css = readFileSync(file, "utf8");
      for (const m of css.matchAll(/([^{}]*checkbox[^{}]*)\{([^}]*)\}/g)) {
        const body = m[2];
        if ([...body.matchAll(/border-radius:\s*([^;]+)/g)].some((r) => !/^0(px)?$/.test(r[1].trim())) || /appearance:\s*auto/.test(body) || /accent-color/.test(body)) {
          bad.push(`${file}: ${m[1].trim()}`);
        }
      }
    }
    expect(bad).toEqual([]);
  });
});
