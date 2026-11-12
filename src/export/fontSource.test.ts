import { beforeEach, describe, expect, it, vi } from "vitest";
import { bundledFontDataUrls, decodeFontDataUrl } from "./fonts";
import { defaultFontSource } from "./fontSource";
import { readFontInfo } from "../fonts/fontInfo";
import { listUserFonts, userFontBytes } from "../fonts/store";
import { systemFontFile } from "../fonts/system";

vi.mock("../fonts/fontInfo", () => ({ readFontInfo: vi.fn() }));
vi.mock("../fonts/store", () => ({
  listUserFonts: vi.fn(),
  userFontBytes: vi.fn(),
}));
vi.mock("../fonts/system", () => ({ systemFontFile: vi.fn() }));

const bytes = decodeFontDataUrl(bundledFontDataUrls["serif:regular:latin"]!);

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(listUserFonts).mockResolvedValue([]);
  vi.mocked(userFontBytes).mockResolvedValue(bytes);
  vi.mocked(systemFontFile).mockResolvedValue({
    bytes,
    postscriptName: "Test-Regular",
    collection: false,
  });
  vi.mocked(readFontInfo).mockResolvedValue({
    family: "Test Face",
    style: "regular",
    embedding: "installable",
  });
});

describe("default PDF font source", () => {
  it("selects the requested added style, or falls back to its regular file", async () => {
    vi.mocked(listUserFonts).mockResolvedValue([
      {
        id: "face-regular",
        family: "Test Face",
        style: "regular",
        fileName: "regular.ttf",
        format: "ttf",
      },
      {
        id: "face-bold",
        family: "Test Face",
        style: "bold",
        fileName: "bold.ttf",
        format: "ttf",
      },
    ]);
    vi.mocked(readFontInfo).mockResolvedValue({
      family: "Test Face",
      style: "bold",
      embedding: "editable",
    });

    const source = defaultFontSource();
    const exact = await source.resolve('"Test Face", sans-serif', true, false);
    expect(userFontBytes).toHaveBeenCalledWith("face-bold");
    expect(exact).toMatchObject({ family: "Test Face", exact: true, embedding: "editable" });

    vi.mocked(userFontBytes).mockClear();
    const fallback = await source.resolve("Test Face", false, true);
    expect(userFontBytes).toHaveBeenCalledWith("face-regular");
    expect(fallback?.exact).toBe(false);
  });

  it("uses a system font when no added family matches and rejects collections", async () => {
    const source = defaultFontSource();
    await expect(source.resolve("System Face", false, false)).resolves.toMatchObject({
      family: "Test Face",
      exact: true,
    });
    expect(systemFontFile).toHaveBeenCalledWith("System Face", false, false);

    vi.mocked(systemFontFile).mockResolvedValue({
      bytes,
      postscriptName: "Collection",
      collection: true,
    });
    await expect(source.resolve("Collection", false, false)).resolves.toBeNull();

    vi.mocked(systemFontFile).mockResolvedValue(null);
    await expect(source.resolve("Missing", false, false)).resolves.toBeNull();
  });

  it("uses any available added file when neither the requested style nor regular exists", async () => {
    vi.mocked(listUserFonts).mockResolvedValue([
      {
        id: "face-italic",
        family: "Test Face",
        style: "italic",
        fileName: "italic.ttf",
        format: "ttf",
      },
    ]);
    vi.mocked(readFontInfo).mockResolvedValue({
      family: "Test Face",
      style: "italic",
      embedding: "preview",
    });

    await expect(defaultFontSource().resolve("Test Face", true, false)).resolves.toMatchObject({
      exact: false,
      embedding: "preview",
    });
    expect(userFontBytes).toHaveBeenCalledWith("face-italic");
  });

  it("treats unreadable metadata as restricted and never throws on source failures", async () => {
    vi.mocked(listUserFonts).mockResolvedValue([
      {
        id: "face-regular",
        family: "Test Face",
        style: "regular",
        fileName: "regular.ttf",
        format: "ttf",
      },
    ]);
    vi.mocked(readFontInfo).mockRejectedValue(new Error("bad metadata"));
    await expect(defaultFontSource().resolve("Test Face", false, false)).resolves.toMatchObject({
      exact: true,
      embedding: "restricted",
    });

    vi.mocked(listUserFonts).mockRejectedValue(new Error("storage unavailable"));
    await expect(defaultFontSource().resolve("Test Face", false, false)).resolves.toBeNull();
  });
});
