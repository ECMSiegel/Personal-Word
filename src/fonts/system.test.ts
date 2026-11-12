import { afterEach, describe, expect, it, vi } from "vitest";

const invokeMock = vi.hoisted(() => vi.fn());
vi.mock("@tauri-apps/api/core", () => ({ invoke: invokeMock }));

// Pretend to be the desktop app (the native check looks for __TAURI_INTERNALS__).
const asDesktop = () => vi.stubGlobal("window", { __TAURI_INTERNALS__: {} });
afterEach(() => {
  vi.unstubAllGlobals();
  invokeMock.mockReset();
});

import { listSystemFamilies, systemFontFile } from "./system";

describe("listSystemFamilies", () => {
  it("maps the command result through unchanged", async () => {
    asDesktop();
    invokeMock.mockResolvedValue(["Avenir Next", "Georgia", "Futura"]);
    await expect(listSystemFamilies()).resolves.toEqual(["Avenir Next", "Georgia", "Futura"]);
    expect(invokeMock).toHaveBeenCalledWith("system_font_families");
  });

  it("is empty in the browser preview", async () => {
    await expect(listSystemFamilies()).resolves.toEqual([]);
    expect(invokeMock).not.toHaveBeenCalled();
  });

  it("is empty when the command errors", async () => {
    asDesktop();
    invokeMock.mockRejectedValue(new Error("no such command"));
    await expect(listSystemFamilies()).resolves.toEqual([]);
  });
});

describe("systemFontFile", () => {
  it("maps a face to a FontFile with bytes and its PostScript name", async () => {
    asDesktop();
    invokeMock.mockResolvedValue({
      data: [0, 1, 0, 0, 9],
      postscriptName: "Georgia-Regular",
      collection: false,
    });
    const file = await systemFontFile("Georgia", false, false);
    expect(file).toEqual({
      bytes: Uint8Array.from([0, 1, 0, 0, 9]),
      postscriptName: "Georgia-Regular",
      collection: false,
    });
    expect(invokeMock).toHaveBeenCalledWith("system_font_file", {
      family: "Georgia",
      bold: false,
      italic: false,
    });
  });

  it("is null in the browser preview", async () => {
    await expect(systemFontFile("Georgia", false, false)).resolves.toBeNull();
    expect(invokeMock).not.toHaveBeenCalled();
  });

  it("is null when the command errors", async () => {
    asDesktop();
    invokeMock.mockRejectedValue(new Error("no such command"));
    await expect(systemFontFile("Georgia", false, false)).resolves.toBeNull();
  });

  it("skips collections without touching their bytes", async () => {
    asDesktop();
    invokeMock.mockResolvedValue({
      data: [1, 2, 3],
      postscriptName: "Futura-Medium",
      collection: true,
    });
    await expect(systemFontFile("Futura", false, false)).resolves.toBeNull();
  });
});
