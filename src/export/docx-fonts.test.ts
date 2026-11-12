import { describe, expect, it, vi } from "vitest";
import JSZip from "jszip";
import { newProject } from "../model";
import type { ExportFontSource, ResolvedFont } from "./fontSource";
import { exportDocx } from "./docx";

// T270 review finding 1: a stubbed Packer that throws only for one poisoned
// font family, so the pack-fallback can be tested deterministically without
// breaking the other embedding tests.
vi.mock("docx", async (importOriginal) => {
  const actual = await importOriginal<typeof import("docx")>();
  return {
    ...actual,
    Document: class extends (actual as typeof import("docx")).Document {
      __fontNames: string[];
      constructor(options: Record<string, unknown>) {
        super(options as never);
        this.__fontNames = ((options.fonts as { name: string }[] | undefined) ?? []).map(
          (f) => f.name,
        );
      }
    },
    Packer: {
      ...actual.Packer,
      toBlob: async (doc: { __fontNames?: string[] }) => {
        if (doc.__fontNames?.includes("Poison Face"))
          throw new Error("font pack failed");
        return (actual.Packer as typeof import("docx").Packer).toBlob(
          doc as never,
        );
      },
    },
  };
});

function project(runs: { text: string; fontFamily?: string; bold?: boolean }[]) {
  const result = newProject("Word font test");
  result.entries[0].content = {
    type: "doc",
    content: [
      {
        type: "paragraph",
        content: runs.map((r) => ({
          type: "text",
          text: r.text,
          marks: [
            ...(r.fontFamily
              ? [{ type: "textFormat", attrs: { fontFamily: r.fontFamily } }]
              : []),
            ...(r.bold ? [{ type: "bold" }] : []),
          ],
        })),
      },
    ],
  };
  return result;
}

// TrueType fixture bytes: the docx packer stores font data as given, so the
// four-byte TTF magic is all the tests need. The previously used bundled Noto
// WOFF is not TrueType and is skipped under the T270 TrueType-only rule.
const ttfBytes = new Uint8Array([0x00, 0x01, 0x00, 0x00, 0x01, 0x02, 0x03, 0x04]);

const face = (embedding: ResolvedFont["embedding"] = "installable"): ResolvedFont => ({
  bytes: ttfBytes,
  family: "Test Face",
  exact: true,
  embedding,
});
const source = (resolve: ExportFontSource["resolve"]): ExportFontSource => ({ resolve });

async function parts(p: ReturnType<typeof project>, fontSource?: ExportFontSource) {
  const zip = await JSZip.loadAsync(await (await exportDocx(p, undefined, fontSource)).arrayBuffer());
  return {
    files: Object.keys(zip.files).filter((n) => n.startsWith("word/fonts/") && !n.endsWith("/")),
    table: (await zip.file("word/fontTable.xml")?.async("string")) ?? "",
    body: await zip.file("word/document.xml")!.async("string"),
  };
}

describe("Word export embeds applied fonts", () => {
  const withFont = project([{ text: "Hello", fontFamily: '"Test Face", sans-serif' }]);

  it("embeds a resolved installable font and names it in the font table", async () => {
    const out = await parts(withFont, source(async () => face()));
    expect(out.files.length).toBe(1);
    expect(out.table).toContain("Test Face");
    expect(out.body).toContain('w:ascii="Test Face"');
  });

  it("embeds an editable font too", async () => {
    const out = await parts(withFont, source(async () => face("editable")));
    expect(out.files.length).toBe(1);
  });

  it("does not embed preview-only or restricted fonts, and still names the font", async () => {
    for (const level of ["preview", "restricted"] as const) {
      const out = await parts(withFont, source(async () => face(level)));
      expect(out.files).toHaveLength(0);
      expect(out.body).toContain('w:ascii="Test Face"');
    }
  });

  it("embeds nothing when the source returns null, as before", async () => {
    const out = await parts(withFont, source(async () => null));
    expect(out.files).toHaveLength(0);
    expect(out.body).toContain('w:ascii="Test Face"');
  });

  it("exports as before when the source rejects", async () => {
    const out = await parts(
      withFont,
      source(async () => {
        throw new Error("no fonts");
      }),
    );
    expect(out.files).toHaveLength(0);
    expect(out.body).toContain('w:ascii="Test Face"');
  });

  it("resolves each family once and embeds one entry per family", async () => {
    const asked: string[] = [];
    const p = project([
      { text: "a", fontFamily: "Test Face" },
      { text: "b", fontFamily: "Test Face", bold: true },
      { text: "c", fontFamily: "Test Face" },
      { text: "d" },
    ]);
    const out = await parts(
      p,
      source(async (family, bold, italic) => {
        asked.push(`${family}:${bold}:${italic}`);
        return face();
      }),
    );
    expect(asked.sort()).toEqual(["Test Face:false:false", "Test Face:true:false"]);
    expect(out.files).toHaveLength(1);
  });

  // T270 review finding 1: only TrueType is embedded. An OTTO (CFF) face is
  // skipped, the font is still named in the runs, and the export succeeds.
  it("does not embed an OTTO (CFF) font and the export still succeeds", async () => {
    const otto = (): ResolvedFont => ({
      bytes: new Uint8Array([0x4f, 0x54, 0x54, 0x4f, 0x00, 0x01, 0x02, 0x03]),
      family: "Test Face",
      exact: true,
      embedding: "installable",
    });
    const out = await parts(withFont, source(async () => otto()));
    expect(out.files).toHaveLength(0);
    expect(out.body).toContain('w:ascii="Test Face"');
  });

  // T270 review finding 1: a Packer failure caused by a bad font falls back to
  // one rebuild without fonts, so the export still succeeds exactly as today.
  it("falls back to a no-fonts export when packing a bad font throws", async () => {
    const poisoned = project([{ text: "Hello", fontFamily: '"Poison Face", sans-serif' }]);
    const out = await parts(poisoned, source(async () => face()));
    expect(out.files).toHaveLength(0);
    expect(out.body).toContain('w:ascii="Poison Face"');
  });
});
