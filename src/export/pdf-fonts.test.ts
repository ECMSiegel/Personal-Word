import { describe, expect, it, vi } from "vitest";
import { newProject } from "../model";
import {
  bundledFontDataUrls,
  decodeFontDataUrl,
} from "./fonts";
import type { ExportFontSource } from "./fontSource";
import { exportPdf } from "./pdf";
import {
  PDFArray,
  PDFDict,
  PDFDocument,
  PDFName,
  type PDFRawStream,
} from "pdf-lib";
import { decodePDFRawStream } from "pdf-lib/cjs/core/index.js";

const notoSerifLatin = decodeFontDataUrl(
  bundledFontDataUrls["serif:regular:latin"]!,
);
const notoSansLatin = decodeFontDataUrl(
  bundledFontDataUrls["sans:regular:latin"]!,
);

function project(text: string, fontFamily?: string, bold = false) {
  const result = newProject("PDF font test");
  result.entries[0].content = {
    type: "doc",
    content: [
      {
        type: "paragraph",
        content: [
          {
            type: "text",
            text,
            ...(fontFamily
              ? {
                  marks: [
                    {
                      type: "textFormat",
                      attrs: { fontFamily },
                    },
                    ...(bold ? [{ type: "bold" }] : []),
                  ],
                }
              : {}),
          },
        ],
      },
    ],
  };
  return result;
}

const source = (resolve: ExportFontSource["resolve"]): ExportFontSource => ({
  resolve,
});

async function fontCount(bytes: Uint8Array) {
  const pdf = await PDFDocument.load(bytes);
  return pdf.getPages().reduce((total, page) => {
    const resources = page.node.Resources();
    if (!resources) throw new Error("PDF page has no font resources");
    const fonts = resources.lookup(PDFName.of("Font"), PDFDict);
    return total + fonts.keys().length;
  }, 0);
}

async function normalizedPageStreams(bytes: Uint8Array) {
  const pdf = await PDFDocument.load(bytes);
  return pdf
    .getPages()
    .flatMap((page) => {
      const contents = page.node.Contents();
      const refs = contents instanceof PDFArray ? contents.asArray() : [contents];
      return refs.map((ref) =>
        new TextDecoder("latin1")
          .decode(
            decodePDFRawStream(
              pdf.context.lookup(ref) as PDFRawStream,
            ).decode(),
          )
          .replace(/\/([A-Za-z]+)-[0-9]+ /g, "/$1 "),
      );
    })
    .join("\n");
}

describe("PDF document fonts", () => {
  it("embeds one custom font for an applied font-family run", async () => {
    const withFont = project("BA");
    withFont.entries[0].content.content![0].content = [
      { type: "text", text: "B" },
      {
        type: "text",
        text: "A",
        marks: [
          {
            type: "textFormat",
            attrs: { fontFamily: '"Test Face", sans-serif' },
          },
        ],
      },
    ];
    const withoutFont = project("BA");
    const resolve = vi.fn<ExportFontSource["resolve"]>(async () => ({
      bytes: notoSansLatin,
      family: "Test Face",
      exact: true,
      embedding: "installable",
    }));
    const fontSource = source(resolve);
    const pdfWithFont = new Uint8Array(
      await (await exportPdf(withFont, undefined, undefined, fontSource)).arrayBuffer(),
    );
    const pdfWithoutFont = new Uint8Array(
      await (await exportPdf(withoutFont)).arrayBuffer(),
    );

    expect(resolve).toHaveBeenCalledWith("Test Face", false, false);
    expect(await fontCount(pdfWithFont)).toBe(
      (await fontCount(pdfWithoutFont)) + 1,
    );
  });

  it("requests the run's bold style and falls back for a missing glyph", async () => {
    const resolve = vi.fn<ExportFontSource["resolve"]>(async () => ({
      bytes: notoSerifLatin,
      family: "Test Face",
      exact: true,
      embedding: "installable",
    }));
    const result = await exportPdf(
      project("A Ελληνικά", '"Test Face", sans-serif', true),
      undefined,
      undefined,
      source(resolve),
    );

    expect(resolve).toHaveBeenCalledWith("Test Face", true, false);
    await expect(result.arrayBuffer()).resolves.toBeInstanceOf(ArrayBuffer);
  });

  it.each(["null", "rejects"] as const)(
    "keeps the existing PDF output when the font source %s",
    async (outcome) => {
      const input = project("Same bundled output", '"Test Face", sans-serif');
      const baseline = new Uint8Array(
        await (await exportPdf(input)).arrayBuffer(),
      );
      const fontSource = source(async () => {
        if (outcome === "rejects") throw new Error("unavailable");
        return null;
      });
      const actual = new Uint8Array(
        await (await exportPdf(input, undefined, undefined, fontSource)).arrayBuffer(),
      );

      expect(await normalizedPageStreams(actual)).toBe(
        await normalizedPageStreams(baseline),
      );
      expect(await fontCount(actual)).toBe(await fontCount(baseline));
    },
  );
});
