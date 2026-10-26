import { describe, expect, it } from "vitest";
import { DROP_EXTENSIONS, dropProblem } from "./dropImport";

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
