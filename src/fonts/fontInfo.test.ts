import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { readFontInfo } from "./fontInfo";

const root = "/System/Library/Fonts/Supplemental";

describe("readFontInfo", () => {
  it("reads family and style metadata for the available Trebuchet fixtures", async () => {
    const paths = ["Trebuchet MS.ttf", "Trebuchet MS Bold.ttf", "Trebuchet MS Italic.ttf"];
    const files = await Promise.all(paths.map((path) => readFile(`${root}/${path}`).catch(() => null)));
    if (files.some((file) => file === null)) return;
    const infos = await Promise.all(files.map((file) => readFontInfo(new Uint8Array(file!))));
    expect(infos.map(({ family, style }) => [family, style])).toEqual([
      ["Trebuchet MS", "regular"],
      ["Trebuchet MS", "bold"],
      ["Trebuchet MS", "italic"],
    ]);
    expect(infos.every(({ embedding }) => ["installable", "editable", "preview", "restricted"].includes(embedding))).toBe(true);
  });

  it("rejects invalid font data with the supported error", async () => {
    await expect(readFontInfo(new Uint8Array([1, 2, 3]))).rejects.toThrow("That file is not a font this app can read");
  });
});
