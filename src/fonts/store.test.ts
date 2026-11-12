import { describe, expect, it } from "vitest";
import { addUserFont } from "./store";

describe("addUserFont validation", () => {
  it("rejects unsupported extensions before touching storage", async () => {
    const file = new File(["font"], "font.txt");
    await expect(addUserFont(file)).rejects.toThrow("Choose a .ttf or .otf font file");
  });

  it("rejects a renamed non-font file with the parser error", async () => {
    const file = new File(["not a font"], "fake.ttf");
    await expect(addUserFont(file)).rejects.toThrow("That file is not a font this app can read");
  });
});
