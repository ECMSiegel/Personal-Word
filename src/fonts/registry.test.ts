import { beforeEach, describe, expect, it, vi } from "vitest";
import { buildDocumentFontOptions, initFonts } from "./registry";
import { listUserFonts } from "./store";
import { listSystemFamilies } from "./system";
import type { UserFont } from "./types";

vi.mock("./store", () => ({ listUserFonts: vi.fn(), userFontBytes: vi.fn() }));
vi.mock("./system", () => ({ listSystemFamilies: vi.fn() }));

const KEY = "folio.workspace.interfaceFont";
const MENLO = '"Menlo", sans-serif';
const store = new Map<string, string>();
const vars = new Map<string, string>();
const uiFont = () => vars.get("--ui-font") ?? "";

describe("initFonts saved interface font", () => {
  beforeEach(() => {
    store.clear();
    vars.clear();
    vi.stubGlobal("localStorage", {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => void store.set(key, value),
    });
    vi.stubGlobal("document", {
      documentElement: { style: { setProperty: (name: string, value: string) => void vars.set(name, value) } },
      fonts: [],
    });
    vi.mocked(listUserFonts).mockReset();
    vi.mocked(listSystemFamilies).mockReset();
  });

  it("applies the saved font before the font lists resolve", async () => {
    localStorage.setItem(KEY, MENLO);
    let release: (value: string[]) => void = () => {};
    vi.mocked(listUserFonts).mockResolvedValue([]);
    vi.mocked(listSystemFamilies).mockReturnValue(new Promise<string[]>((resolve) => { release = resolve; }));
    const pending = initFonts();
    expect(uiFont()).toBe(MENLO);
    release(["Menlo"]);
    await pending;
    expect(uiFont()).toBe(MENLO);
  });

  it("keeps a saved installed font when the installed-font list failed", async () => {
    localStorage.setItem(KEY, MENLO);
    vi.mocked(listUserFonts).mockResolvedValue([]);
    vi.mocked(listSystemFamilies).mockRejectedValue(new Error("ipc failed"));
    await initFonts();
    expect(localStorage.getItem(KEY)).toBe(MENLO);
    expect(uiFont()).toBe(MENLO);
  });

  it("keeps a saved added font when the added-font list failed to load", async () => {
    localStorage.setItem(KEY, MENLO);
    vi.mocked(listUserFonts).mockRejectedValue(new Error("store failed"));
    vi.mocked(listSystemFamilies).mockResolvedValue(["Georgia"]);
    await initFonts();
    expect(localStorage.getItem(KEY)).toBe(MENLO);
    expect(uiFont()).toBe(MENLO);
  });

  it("keeps the saved font when the installed list is empty", async () => {
    localStorage.setItem(KEY, MENLO);
    vi.mocked(listUserFonts).mockResolvedValue([]);
    vi.mocked(listSystemFamilies).mockResolvedValue([]);
    await initFonts();
    expect(localStorage.getItem(KEY)).toBe(MENLO);
  });

  it("resets to Futura when the list loaded and the font is truly absent", async () => {
    localStorage.setItem(KEY, MENLO);
    vi.mocked(listUserFonts).mockResolvedValue([]);
    vi.mocked(listSystemFamilies).mockResolvedValue(["Georgia"]);
    await initFonts();
    expect(localStorage.getItem(KEY)).toMatch(/^Futura/);
    expect(uiFont()).toMatch(/^Futura/);
  });
});

describe("buildDocumentFontOptions", () => {
  it("puts added families first and only once, then unlisted installed families", () => {
    const fonts: UserFont[] = [
      { id: "a", family: "Trebuchet MS", style: "regular", fileName: "a.ttf", format: "ttf" },
      { id: "b", family: "Trebuchet MS", style: "bold", fileName: "b.ttf", format: "ttf" },
    ];
    const options = buildDocumentFontOptions(fonts, ["Georgia", "Trebuchet MS", "Verdana"]);
    expect(options.map(({ label }) => label)).toEqual(["Trebuchet MS", "Georgia", "Verdana"]);
    expect(options[0]).toMatchObject({ value: '"Trebuchet MS", sans-serif', style: { fontFamily: '"Trebuchet MS", sans-serif' } });
  });

  it("quotes digit-leading family names and deduplicates case-insensitively", () => {
    const options = buildDocumentFontOptions([], ["Source Sans 3", "Georgia", "georgia"]);
    expect(options.map(({ value }) => value)).toEqual([
      '"Source Sans 3", sans-serif',
      '"Georgia", sans-serif',
    ]);
  });
});
