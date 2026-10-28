import { beforeEach, describe, expect, it, vi } from "vitest";
import { DROP_EXTENSIONS, dropProblem, readDroppedPath, readDroppedPdf } from "./dropImport";

const invoke = vi.hoisted(() => vi.fn());
vi.mock("@tauri-apps/api/core", () => ({ invoke }));

const ONE_AT_A_TIME = "Drop one file at a time.";
const WRONG_TYPE = "Personal Word can import .txt, .md, .docx, .html or .zip files.";

describe("dropped file check", () => {
  it("accepts one file with an allowed extension, ignoring case", () => {
    expect(dropProblem(["Draft.MD"])).toBeNull();
  });
  it("refuses a file type the importer cannot read", () => {
    expect(dropProblem(["Paper.pdf"])).toBe(WRONG_TYPE);
  });
  it("refuses two files", () => {
    expect(dropProblem(["a.md", "b.md"])).toBe(ONE_AT_A_TIME);
  });
  it("refuses an empty drop", () => {
    expect(dropProblem([])).toBe(ONE_AT_A_TIME);
  });
  it("accepts .markdown", () => {
    expect(dropProblem(["Notes.markdown"])).toBeNull();
  });
  it("accepts .htm", () => {
    expect(dropProblem(["page.htm"])).toBeNull();
  });
  it("lists exactly the importer's seven extensions", () => {
    expect(DROP_EXTENSIONS).toEqual([".txt", ".md", ".markdown", ".docx", ".html", ".htm", ".zip"]);
  });
});

describe("native drop routing", () => {
  beforeEach(() => invoke.mockReset());

  it("reads a dropped PDF through the PDF-only command, never the importer one", async () => {
    invoke.mockResolvedValue(new Uint8Array([37, 80, 68, 70]));
    const file = await readDroppedPdf("/Users/me/Papers/Paper.pdf");
    expect(invoke).toHaveBeenCalledTimes(1);
    expect(invoke).toHaveBeenCalledWith("read_dropped_pdf", { path: "/Users/me/Papers/Paper.pdf" });
    expect(file.name).toBe("Paper.pdf");
    expect(file.type).toBe("application/pdf");
    expect(file.size).toBe(4);
  });

  it("keeps the writing importer on its own command", async () => {
    invoke.mockResolvedValue(new Uint8Array([35]));
    await readDroppedPath("/Users/me/Draft.md");
    expect(invoke).toHaveBeenCalledWith("read_dropped_file", { path: "/Users/me/Draft.md" });
  });
});
