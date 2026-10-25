import { describe, expect, it } from "vitest";
import JSZip from "jszip";
import { newProject, validateProject, textOf } from "../model";
import { createPendingAsset } from "../assets/assets";
import type { AssetId, PendingAsset } from "../assets/types";
import { exportMarkdownBundle, importMarkdownBundle } from "./markdownBundle";
import { cell, para, table, text, tinyPng, tinyJpeg } from "./media-fixtures";

describe("Markdown Bundle Schema & Adversarial Stress Tests (Challenger 2)", () => {
  async function createTestAssets(): Promise<{
    png: PendingAsset;
    jpeg: PendingAsset;
    assetsMap: Map<AssetId, PendingAsset>;
  }> {
    const png = await createPendingAsset(tinyPng);
    const jpeg = await createPendingAsset(tinyJpeg);
    const assetsMap = new Map<AssetId, PendingAsset>([
      [png.id, png],
      [jpeg.id, jpeg],
    ]);
    return { png, jpeg, assetsMap };
  }

  async function createZipBundle(
    manuscriptText: string,
    assets: Map<string, Uint8Array> = new Map(),
    manifest?: Record<string, unknown>,
  ): Promise<Uint8Array> {
    const zip = new JSZip();
    zip.file("manuscript.md", manuscriptText);
    if (manifest) {
      zip.file("manifest.json", JSON.stringify(manifest, null, 2));
    }
    const assetsFolder = zip.folder("assets");
    for (const [name, bytes] of assets.entries()) {
      assetsFolder?.file(name, bytes);
    }
    return await zip.generateAsync({ type: "uint8array" });
  }

  // ---------------------------------------------------------------------------
  // 1. GFM Pipe Tables
  // ---------------------------------------------------------------------------
  describe("GFM Pipe Tables", () => {
    it("parses tables with empty cells without violating schema constraints", async () => {
      const md = [
        "| Header A | Header B | Header C |",
        "| --- | --- | --- |",
        "| | Cell B1 | |",
        "| Cell A2 | | Cell C2 |",
        "| | | |",
      ].join("\n");

      const zipBytes = await createZipBundle(md);
      const draft = await importMarkdownBundle(zipBytes, "empty-cells.zip");

      expect(draft.counts.tables).toBe(1);
      expect(() => validateProject(draft.project)).not.toThrow();

      const doc = draft.project.entries[0].content;
      const tableNode = doc.content?.find((n) => n.type === "table");
      expect(tableNode).toBeDefined();

      const rows = tableNode?.content ?? [];
      expect(rows).toHaveLength(4); // 1 header + 3 data rows

      // Each row must have 3 cells
      for (const row of rows) {
        expect(row.content).toHaveLength(3);
        // Every cell must have at least one paragraph block (CELL_CONTENT constraint)
        for (const c of row.content ?? []) {
          expect(c.content?.length).toBeGreaterThanOrEqual(1);
          expect(c.content?.[0].type).toBe("paragraph");
        }
      }
    });

    it("parses tables with <br>, <br/>, <br />, and <BR> into multiple cell paragraphs", async () => {
      const md = [
        "| Col 1 | Col 2 |",
        "| --- | --- |",
        "| Line 1<br>Line 2<br/>Line 3 | A<br />B<BR>C |",
        "| Single line | Double<br><br>Break |",
      ].join("\n");

      const zipBytes = await createZipBundle(md);
      const draft = await importMarkdownBundle(zipBytes, "br-table.zip");

      expect(() => validateProject(draft.project)).not.toThrow();

      const doc = draft.project.entries[0].content;
      const tableNode = doc.content?.find((n) => n.type === "table");
      expect(tableNode).toBeDefined();

      const row1 = tableNode?.content?.[1]; // First data row
      const cell1 = row1?.content?.[0]; // Line 1<br>Line 2<br/>Line 3
      expect(cell1?.content).toHaveLength(3);
      expect(cell1?.content?.[0]?.content?.[0]?.text).toBe("Line 1");
      expect(cell1?.content?.[1]?.content?.[0]?.text).toBe("Line 2");
      expect(cell1?.content?.[2]?.content?.[0]?.text).toBe("Line 3");

      const cell2 = row1?.content?.[1]; // A<br />B<BR>C
      expect(cell2?.content).toHaveLength(3);
      expect(cell2?.content?.[0]?.content?.[0]?.text).toBe("A");
      expect(cell2?.content?.[1]?.content?.[0]?.text).toBe("B");
      expect(cell2?.content?.[2]?.content?.[0]?.text).toBe("C");

      const row2 = tableNode?.content?.[2]; // Double break
      const cell2B = row2?.content?.[1];
      expect(cell2B?.content?.length).toBeGreaterThanOrEqual(2);
    });

    it("parses escaped pipes \\| inside cell content without splitting into extra columns", async () => {
      const md = [
        "| Operation | Expression | Notes |",
        "| --- | --- | --- |",
        "| Bitwise OR | `a \\| b` | Uses \\| pipe |",
        "| Math Norm | \\|x\\| | Absolute value |",
      ].join("\n");

      const zipBytes = await createZipBundle(md);
      const draft = await importMarkdownBundle(zipBytes, "escaped-pipes.zip");

      expect(() => validateProject(draft.project)).not.toThrow();

      const doc = draft.project.entries[0].content;
      const tableNode = doc.content?.find((n) => n.type === "table");
      const rows = tableNode?.content ?? [];
      expect(rows).toHaveLength(3);

      // Verify each row has exactly 3 columns
      for (const r of rows) {
        expect(r.content).toHaveLength(3);
      }

      // Verify the pipe was preserved
      const r1c2 = rows[1].content?.[1];
      const r1c3 = rows[1].content?.[2];
      expect(JSON.stringify(r1c2)).toContain("|");
      expect(JSON.stringify(r1c3)).toContain("|");
    });

    it("equalizes mismatched column counts into a rectangular grid without schema violations", async () => {
      // GFM defines table column count by the delimiter row.
      // When data rows have fewer columns than the header, rows are padded to match maxCols.
      const md = [
        "| Col 1 | Col 2 | Col 3 | Col 4 |",
        "| --- | --- | --- | --- |",
        "| Row 1A | Row 1B |",
        "| Row 2A |",
      ].join("\n");

      const zipBytes = await createZipBundle(md);
      const draft = await importMarkdownBundle(zipBytes, "mismatched-columns.zip");

      expect(() => validateProject(draft.project)).not.toThrow();

      const doc = draft.project.entries[0].content;
      const tableNode = doc.content?.find((n) => n.type === "table");
      expect(tableNode).toBeDefined();
      const rows = tableNode?.content ?? [];

      expect(rows).toHaveLength(3); // 1 header + 2 data rows
      // All rows must have the same column count (maxCols = 4)
      const expectedCols = 4;
      for (const r of rows) {
        expect(r.content).toHaveLength(expectedCols);
      }
    });

    it("preserves formatted text (bold, italic, code, links) inside table headers and cells", async () => {
      const md = [
        "| **Bold Header** | *Italic Header* | `Code Header` |",
        "| --- | --- | --- |",
        "| Plain | **Bold** and *Italic* | [Link](https://example.com) |",
      ].join("\n");

      const zipBytes = await createZipBundle(md);
      const draft = await importMarkdownBundle(zipBytes, "formatted-table.zip");

      expect(() => validateProject(draft.project)).not.toThrow();

      const doc = draft.project.entries[0].content;
      const tableNode = doc.content?.find((n) => n.type === "table");
      const headerRow = tableNode?.content?.[0];
      const dataRow = tableNode?.content?.[1];

      // Header cells
      expect(headerRow?.content?.[0]?.type).toBe("tableHeader");
      expect(JSON.stringify(headerRow?.content?.[0])).toContain('"bold"');
      expect(JSON.stringify(headerRow?.content?.[1])).toContain('"italic"');
      expect(JSON.stringify(headerRow?.content?.[2])).toContain('"code"');

      // Data cells
      expect(dataRow?.content?.[0]?.type).toBe("tableCell");
      expect(JSON.stringify(dataRow?.content?.[1])).toContain('"bold"');
      expect(JSON.stringify(dataRow?.content?.[1])).toContain('"italic"');
      expect(JSON.stringify(dataRow?.content?.[2])).toContain('"link"');
    });

    it("round-trips a complex table through export and import with matching grid and content", async () => {
      const project = newProject("Table Roundtrip");
      project.entries[0].content = {
        type: "doc",
        content: [
          table(
            [
              cell("tableHeader", para(text("Param"))),
              cell("tableHeader", para(text("Type"))),
              cell("tableHeader", para(text("Description"))),
            ],
            [
              cell(
                "tableCell",
                para(text("options")),
              ),
              cell(
                "tableCell",
                para(text("object")),
              ),
              cell(
                "tableCell",
                para(text("Primary configuration.")),
                para(text("Optional flags | settings.")),
              ),
            ],
            [
              cell("tableCell", para(text("callback"))),
              cell("tableCell", para(text("function"))),
              cell("tableCell", para()), // empty cell
            ],
          ),
        ],
      };

      const blob = await exportMarkdownBundle(project);
      const draft = await importMarkdownBundle(blob, "table-roundtrip.zip");

      expect(() => validateProject(draft.project)).not.toThrow();
      expect(draft.counts.tables).toBe(1);

      const tableNode = draft.project.entries[0].content?.content?.find((n) => n.type === "table");
      expect(tableNode).toBeDefined();
      const rows = tableNode?.content ?? [];
      expect(rows).toHaveLength(3);

      for (const r of rows) {
        expect(r.content).toHaveLength(3);
      }

      // Check multi-line cell
      const descCell = rows[1].content?.[2];
      expect(descCell?.content).toHaveLength(2);
      expect(descCell?.content?.[0]?.content?.[0]?.text).toBe("Primary configuration.");
      expect(descCell?.content?.[1]?.content?.[0]?.text).toContain("Optional flags");
    });
  });

  // ---------------------------------------------------------------------------
  // 2. Multi-Paragraph Footnotes [^n]
  // ---------------------------------------------------------------------------
  describe("Multi-Paragraph Footnotes [^n]", () => {
    it("imports footnotes with 4 paragraphs indented by 4 spaces cleanly into footnote record", async () => {
      const md = [
        "Main text making an elaborate point[^deep].",
        "",
        "[^deep]: Paragraph 1 of the footnote.",
        "",
        "    Paragraph 2 of the footnote, indented by 4 spaces.",
        "",
        "    Paragraph 3 with additional analysis and citations.",
        "",
        "    Paragraph 4 concluding the note.",
      ].join("\n");

      const zipBytes = await createZipBundle(md);
      const draft = await importMarkdownBundle(zipBytes, "4-para-footnote.zip");

      expect(() => validateProject(draft.project)).not.toThrow();
      expect(draft.counts.notes).toBe(1);

      const note = draft.project.research?.footnotes?.[0];
      expect(note).toBeDefined();

      const paragraphs = note!.text.split("\n\n");
      expect(paragraphs).toHaveLength(4);
      expect(paragraphs[0]).toBe("Paragraph 1 of the footnote.");
      expect(paragraphs[1]).toBe("Paragraph 2 of the footnote, indented by 4 spaces.");
      expect(paragraphs[2]).toBe("Paragraph 3 with additional analysis and citations.");
      expect(paragraphs[3]).toBe("Paragraph 4 concluding the note.");

      // Verify reference node
      const doc = draft.project.entries[0].content;
      const ref = doc.content?.[0]?.content?.find((n) => n.type === "footnoteReference");
      expect(ref).toBeDefined();
      expect(ref?.attrs?.id).toBe(note!.id);
    });

    it("round-trips 3-paragraph footnotes through export and import with 4-space continuations", async () => {
      const project = newProject("Footnote Roundtrip");
      project.entries[0].content = {
        type: "doc",
        content: [
          {
            type: "paragraph",
            content: [
              text("Prose with citation"),
              { type: "footnoteReference", attrs: { id: "fn-complex-1" } },
              text(" and trailing sentence."),
            ],
          },
        ],
      };
      project.research = {
        sources: [],
        notes: [],
        footnotes: [
          {
            id: "fn-complex-1",
            text: "First paragraph.\n\nSecond paragraph.\n\nThird paragraph.",
          },
        ],
      };

      const blob = await exportMarkdownBundle(project);

      // Inspect exported manuscript.md text
      const zip = await JSZip.loadAsync(await blob.arrayBuffer());
      const mdText = await zip.file("manuscript.md")!.async("string");

      expect(mdText).toContain("[^1]: First paragraph.");
      expect(mdText).toContain("    Second paragraph.");
      expect(mdText).toContain("    Third paragraph.");

      // Re-import and verify
      const draft = await importMarkdownBundle(blob, "fn-roundtrip.zip");
      expect(() => validateProject(draft.project)).not.toThrow();

      expect(draft.project.research?.footnotes).toHaveLength(1);
      const importedNote = draft.project.research!.footnotes[0];
      expect(importedNote.text).toBe("First paragraph.\n\nSecond paragraph.\n\nThird paragraph.");
    });

    it("handles multiple footnotes in text out of order and alphanumeric labels", async () => {
      const md = [
        "First cited note[^gamma], followed by second note[^beta], then third[^alpha].",
        "",
        "[^alpha]: Alpha content.",
        "",
        "[^beta]: Beta content.",
        "",
        "[^gamma]: Gamma content.",
      ].join("\n");

      const zipBytes = await createZipBundle(md);
      const draft = await importMarkdownBundle(zipBytes, "alphanumeric-notes.zip");

      expect(() => validateProject(draft.project)).not.toThrow();
      expect(draft.counts.notes).toBe(3);

      const notes = draft.project.research?.footnotes ?? [];
      expect(notes).toHaveLength(3);

      // Verify the references are wired to the correct definitions in order of appearance
      const doc = draft.project.entries[0].content;
      const refs = (doc.content?.[0]?.content ?? []).filter(
        (n) => n.type === "footnoteReference",
      );
      expect(refs).toHaveLength(3);

      const gammaNote = notes.find((n) => n.id === refs[0].attrs?.id);
      expect(gammaNote?.text).toBe("Gamma content.");

      const betaNote = notes.find((n) => n.id === refs[1].attrs?.id);
      expect(betaNote?.text).toBe("Beta content.");

      const alphaNote = notes.find((n) => n.id === refs[2].attrs?.id);
      expect(alphaNote?.text).toBe("Alpha content.");
    });

    it("preserves footnotes containing quotes, brackets, and Chicago-style locators", async () => {
      const md = [
        "Historians argue this point[^hist].",
        "",
        '[^hist]: See *The History*, 45--48; cf. "Original Source" [1984], p. 12.',
      ].join("\n");

      const zipBytes = await createZipBundle(md);
      const draft = await importMarkdownBundle(zipBytes, "chicago-fn.zip");

      expect(() => validateProject(draft.project)).not.toThrow();
      const note = draft.project.research?.footnotes?.[0];
      expect(note?.text).toContain("The History");
      expect(note?.text).toContain('45--48; cf. "Original Source" [1984], p. 12.');
    });

    it("retains undefined footnote references as literal text and reports actionable warnings", async () => {
      const md = "Claim with missing footnote[^nonexistent] in text.";

      const zipBytes = await createZipBundle(md);
      const draft = await importMarkdownBundle(zipBytes, "missing-fn.zip");

      expect(() => validateProject(draft.project)).not.toThrow();
      expect(draft.counts.notes).toBe(0);
      expect(draft.warnings.some((w) => w.includes("[^nonexistent]"))).toBe(true);
      expect(draft.project.entries[0].text).toContain("[^nonexistent]");
    });

    it("retains unreferenced footnote definitions as visible text with warnings", async () => {
      const md = [
        "Paragraph without any references.",
        "",
        "[^orphan]: This note is never referenced.",
      ].join("\n");

      const zipBytes = await createZipBundle(md);
      const draft = await importMarkdownBundle(zipBytes, "orphan-fn.zip");

      expect(() => validateProject(draft.project)).not.toThrow();
      expect(draft.warnings.some((w) => w.includes("[^orphan]"))).toBe(true);
      expect(draft.project.entries[0].text).toContain("This note is never referenced.");
    });
  });

  // ---------------------------------------------------------------------------
  // 3. Inline Images Hoisting & Block Invariants
  // ---------------------------------------------------------------------------
  describe("Inline Images Hoisting & Block Invariants", () => {
    it("hoists an inline image within text, splitting preceding and succeeding text into valid paragraphs", async () => {
      const { png } = await createTestAssets();
      const md = `Before paragraph text. ![Diagram](assets/${png.id}.png "Figure 1") After paragraph text.`;

      const assets = new Map([[ `${png.id}.png`, png.bytes ]]);
      const zipBytes = await createZipBundle(md, assets);
      const draft = await importMarkdownBundle(zipBytes, "hoist-middle.zip");

      expect(() => validateProject(draft.project)).not.toThrow();
      expect(draft.counts.images).toBe(1);
      expect(draft.assets).toHaveLength(1);

      const blocks = draft.project.entries[0].content.content ?? [];
      expect(blocks).toHaveLength(3);

      // Block 0: paragraph "Before paragraph text. "
      expect(blocks[0].type).toBe("paragraph");
      expect(textOf(blocks[0]).trim()).toBe("Before paragraph text.");

      // Block 1: image
      expect(blocks[1].type).toBe("image");
      expect(blocks[1].attrs?.assetId).toBe(png.id);
      expect(blocks[1].attrs?.alt).toBe("Diagram");
      expect(blocks[1].attrs?.title).toBe("Figure 1");

      // Block 2: paragraph " After paragraph text."
      expect(blocks[2].type).toBe("paragraph");
      expect(textOf(blocks[2]).trim()).toBe("After paragraph text.");
    });

    it("hoists consecutive images in one paragraph without creating empty intermediary blocks", async () => {
      const { png, jpeg } = await createTestAssets();
      const md = `![Image 1](assets/${png.id}.png)![Image 2](assets/${jpeg.id}.jpg)`;

      const assets = new Map([
        [`${png.id}.png`, png.bytes],
        [`${jpeg.id}.jpg`, jpeg.bytes],
      ]);
      const zipBytes = await createZipBundle(md, assets);
      const draft = await importMarkdownBundle(zipBytes, "consecutive-images.zip");

      expect(() => validateProject(draft.project)).not.toThrow();
      expect(draft.counts.images).toBe(2);

      const blocks = draft.project.entries[0].content.content ?? [];
      expect(blocks).toHaveLength(2);
      expect(blocks[0].type).toBe("image");
      expect(blocks[0].attrs?.assetId).toBe(png.id);
      expect(blocks[1].type).toBe("image");
      expect(blocks[1].attrs?.assetId).toBe(jpeg.id);
    });

    it("imports an image alone in a paragraph as a single block without empty paragraphs", async () => {
      const { png } = await createTestAssets();
      const md = `![Solo](assets/${png.id}.png)`;

      const assets = new Map([[ `${png.id}.png`, png.bytes ]]);
      const zipBytes = await createZipBundle(md, assets);
      const draft = await importMarkdownBundle(zipBytes, "solo-image.zip");

      expect(() => validateProject(draft.project)).not.toThrow();
      const blocks = draft.project.entries[0].content.content ?? [];
      expect(blocks).toHaveLength(1);
      expect(blocks[0].type).toBe("image");
      expect(blocks[0].attrs?.assetId).toBe(png.id);
      expect(blocks[0].attrs?.alt).toBe("Solo");
    });

    it("handles an image with empty alt text and null title cleanly", async () => {
      const { png } = await createTestAssets();
      const md = `![](assets/${png.id}.png)`;

      const assets = new Map([[ `${png.id}.png`, png.bytes ]]);
      const zipBytes = await createZipBundle(md, assets);
      const draft = await importMarkdownBundle(zipBytes, "empty-alt.zip");

      expect(() => validateProject(draft.project)).not.toThrow();
      const blocks = draft.project.entries[0].content.content ?? [];
      expect(blocks).toHaveLength(1);
      expect(blocks[0].type).toBe("image");
      expect(blocks[0].attrs?.assetId).toBe(png.id);
      expect(blocks[0].attrs?.alt).toBe("");
      expect(blocks[0].attrs?.title).toBeNull();
    });

    it("retains unresolvable or missing assets inline as text with warning and zero network requests", async () => {
      const missingSha = "c".repeat(64);
      const md = `Paragraph before ![Unstaged Image](assets/${missingSha}.png "Ghost") paragraph after.`;

      // No assets in zip
      const zipBytes = await createZipBundle(md);
      const draft = await importMarkdownBundle(zipBytes, "missing-asset.zip");

      expect(() => validateProject(draft.project)).not.toThrow();
      expect(draft.counts.images).toBe(0);
      expect(draft.assets).toHaveLength(0);
      expect(draft.warnings.some((w) => w.includes(missingSha))).toBe(true);

      const blocks = draft.project.entries[0].content.content ?? [];
      expect(blocks).toHaveLength(1);
      expect(blocks[0].type).toBe("paragraph");
      expect(textOf(blocks[0])).toContain(`![Unstaged Image](assets/${missingSha}.png "Ghost")`);
    });
  });

  // ---------------------------------------------------------------------------
  // 4. Unicode Titles, Special Characters, and Non-ASCII Alt Text
  // ---------------------------------------------------------------------------
  describe("Unicode Titles, Special Characters, and Non-ASCII Alt Text", () => {
    it("preserves complex Unicode document titles in manifest and project metadata", async () => {
      const unicodeTitle = "日本語の論文 — Étude sur l'Épopée & 'Mélodie' 🚀 100% [Final]";
      const project = newProject(unicodeTitle);
      project.entries[0].content = {
        type: "doc",
        content: [para(text("Body content."))],
      };

      const blob = await exportMarkdownBundle(project);
      const draft = await importMarkdownBundle(blob, "unicode-title.zip");

      expect(() => validateProject(draft.project)).not.toThrow();
      expect(draft.project.title).toBe(unicodeTitle);
    });

    it("preserves non-ASCII, emoji, and brackets in image alt text across round-trip", async () => {
      const { png, assetsMap } = await createTestAssets();
      const complexAlt = '図 1 [Figure 1.2]: "Cat / Dog & Bird" — グラフ 📊';
      const complexTitle = '図表タイトル: "Special & Escaped"';

      const project = newProject("Alt Test");
      project.entries[0].content = {
        type: "doc",
        content: [
          {
            type: "image",
            attrs: {
              assetId: png.id,
              alt: complexAlt,
              title: complexTitle,
              width: null,
              height: null,
            },
          },
        ],
      };

      const blob = await exportMarkdownBundle(project, assetsMap);
      const draft = await importMarkdownBundle(blob, "alt-test.zip");

      expect(() => validateProject(draft.project)).not.toThrow();
      expect(draft.counts.images).toBe(1);

      const imgNode = draft.project.entries[0].content.content?.find(
        (n) => n.type === "image",
      );
      expect(imgNode).toBeDefined();
      expect(imgNode?.attrs?.assetId).toBe(png.id);
      // Alt text may have backslash unescaping, but core characters must be preserved
      expect(imgNode?.attrs?.alt).toContain("Figure 1.2");
      expect(imgNode?.attrs?.alt).toContain("Cat / Dog & Bird");
      expect(imgNode?.attrs?.alt).toContain("📊");
    });

    it("falls back to sanitized filename when manifest is missing and no H1 exists", async () => {
      const md = "A document without any H1 heading.";
      const zipBytes = await createZipBundle(md);

      const draft = await importMarkdownBundle(zipBytes, "“Étude 2026 — Draft”.zip");
      expect(draft.project.title).toBe("“Étude 2026 — Draft”");
    });

    it("falls back to H1 text when manifest is missing", async () => {
      const md = "# 現代文学の研究\n\nFirst paragraph.";
      const zipBytes = await createZipBundle(md);

      const draft = await importMarkdownBundle(zipBytes, "fallback.zip");
      expect(draft.project.title).toBe("現代文学の研究");
    });
  });

  // ---------------------------------------------------------------------------
  // 5. Markdown Constructs (Lists, Blockquotes, Code Blocks)
  // ---------------------------------------------------------------------------
  describe("Markdown Constructs (Lists, Blockquotes, Code Blocks)", () => {
    it("parses code blocks containing backticks, pipes, and footnote syntax without confusion", async () => {
      const codeContent = [
        "const template = `Value: ${x}`;",
        "| Not | A | Table |",
        "| --- | - | ----- |",
        "[^1]: Not a footnote definition",
        "// ![image](assets/fake.png)",
      ].join("\n");

      const md = [
        "Introduction paragraph.",
        "",
        "```typescript",
        codeContent,
        "```",
        "",
        "Conclusion paragraph.",
      ].join("\n");

      const zipBytes = await createZipBundle(md);
      const draft = await importMarkdownBundle(zipBytes, "code-block.zip");

      expect(() => validateProject(draft.project)).not.toThrow();
      expect(draft.counts.tables).toBe(0);
      expect(draft.counts.notes).toBe(0);
      expect(draft.counts.images).toBe(0);

      const blocks = draft.project.entries[0].content.content ?? [];
      const codeNode = blocks.find((b) => b.type === "codeBlock");
      expect(codeNode).toBeDefined();
      expect(codeNode?.attrs?.language).toBe("typescript");
      expect(codeNode?.content?.[0]?.text?.trim()).toBe(codeContent.trim());
    });

    it("parses bullet lists and ordered lists cleanly conforming to schema", async () => {
      const md = [
        "- Bullet item 1",
        "- Bullet item 2",
        "",
        "1. Ordered item A",
        "2. Ordered item B",
      ].join("\n");

      const zipBytes = await createZipBundle(md);
      const draft = await importMarkdownBundle(zipBytes, "lists.zip");

      expect(() => validateProject(draft.project)).not.toThrow();

      const blocks = draft.project.entries[0].content.content ?? [];
      const bulletList = blocks.find((b) => b.type === "bulletList");
      const orderedList = blocks.find((b) => b.type === "orderedList");

      expect(bulletList).toBeDefined();
      expect(bulletList?.content).toHaveLength(2);

      expect(orderedList).toBeDefined();
      expect(orderedList?.content).toHaveLength(2);
      expect(orderedList?.attrs?.start).toBe(1);
    });

    it("parses blockquotes containing multiple paragraphs", async () => {
      const md = [
        "> First line of quote.",
        ">",
        "> Second paragraph of quote.",
      ].join("\n");

      const zipBytes = await createZipBundle(md);
      const draft = await importMarkdownBundle(zipBytes, "blockquote.zip");

      expect(() => validateProject(draft.project)).not.toThrow();

      const blocks = draft.project.entries[0].content.content ?? [];
      const bq = blocks.find((b) => b.type === "blockquote");
      expect(bq).toBeDefined();
      expect(bq?.content?.length).toBeGreaterThanOrEqual(1);
    });

    it("parses horizontal rules as valid schema nodes", async () => {
      const md = ["Section 1", "", "---", "", "Section 2"].join("\n");

      const zipBytes = await createZipBundle(md);
      const draft = await importMarkdownBundle(zipBytes, "hr.zip");

      expect(() => validateProject(draft.project)).not.toThrow();

      const blocks = draft.project.entries[0].content.content ?? [];
      expect(blocks.some((b) => b.type === "horizontalRule")).toBe(true);
    });
  });

  // ---------------------------------------------------------------------------
  // 6. Comprehensive End-to-End Round-Trip Stress Test
  // ---------------------------------------------------------------------------
  describe("Comprehensive End-to-End Round-Trip Equivalency", () => {
    it("round-trips a complex synthetic document combining all markdown constructs", async () => {
      const { png, jpeg, assetsMap } = await createTestAssets();

      const project = newProject("Mega Synthetic Specimen — 日本語 🚀");
      project.entries[0].content = {
        type: "doc",
        content: [
          {
            type: "heading",
            attrs: { level: 1 },
            content: [text("Top Level Heading")],
          },
          {
            type: "paragraph",
            content: [
              text("Paragraph with "),
              { type: "text", text: "bold text", marks: [{ type: "bold" }] },
              text(", "),
              { type: "text", text: "italic text", marks: [{ type: "italic" }] },
              text(", "),
              { type: "text", text: "strikethrough", marks: [{ type: "strike" }] },
              text(", "),
              { type: "text", text: "code snippet", marks: [{ type: "code" }] },
              text(", and a citation"),
              { type: "footnoteReference", attrs: { id: "mega-fn-1" } },
              text("."),
            ],
          },
          {
            type: "image",
            attrs: {
              assetId: png.id,
              alt: "Figure 1 [Diagram]",
              title: "Primary Chart",
              width: null,
              height: null,
            },
          },
          table(
            [
              cell("tableHeader", para(text("Header 1"))),
              cell("tableHeader", para(text("Header 2"))),
              cell("tableHeader", para(text("Header 3"))),
            ],
            [
              cell("tableCell", para(text("Row 1A"))),
              cell("tableCell", para(text("Multi-line 1")), para(text("Multi-line 2"))),
              cell("tableCell", para(text("Row 1C with | pipe"))),
            ],
            [
              cell("tableCell", para(text("Row 2A"))),
              cell("tableCell", para()), // empty cell
              cell("tableCell", para(text("Row 2C"))),
            ],
          ),
          {
            type: "image",
            attrs: {
              assetId: jpeg.id,
              alt: "Figure 2",
              title: null,
              width: null,
              height: null,
            },
          },
          {
            type: "codeBlock",
            attrs: { language: "json" },
            content: [text('{\n  "status": "ok"\n}')],
          },
          {
            type: "blockquote",
            content: [para(text("Quoted wisdom from ancient scholars."))],
          },
          {
            type: "bulletList",
            content: [
              { type: "listItem", content: [para(text("Item Alpha"))] },
              { type: "listItem", content: [para(text("Item Beta"))] },
            ],
          },
          {
            type: "horizontalRule",
          },
          {
            type: "paragraph",
            content: [
              text("Final closing thoughts with second citation"),
              { type: "footnoteReference", attrs: { id: "mega-fn-2" } },
              text("."),
            ],
          },
        ],
      };

      project.research = {
        sources: [],
        notes: [],
        footnotes: [
          {
            id: "mega-fn-1",
            text: "First footnote with multiple paragraphs.\n\nContinuation paragraph with analysis.\n\nFinal note paragraph.",
          },
          {
            id: "mega-fn-2",
            text: "Second simple footnote.",
          },
        ],
      };

      // Export Round 1
      const blob1 = await exportMarkdownBundle(project, assetsMap);
      expect(blob1).toBeInstanceOf(Blob);

      // Import Round 1
      const draft1 = await importMarkdownBundle(blob1, "mega-specimen.zip");
      expect(() => validateProject(draft1.project)).not.toThrow();

      // Verify draft counts and properties
      expect(draft1.project.title).toBe("Mega Synthetic Specimen — 日本語 🚀");
      expect(draft1.counts.images).toBe(2);
      expect(draft1.counts.tables).toBe(1);
      expect(draft1.counts.notes).toBe(2);
      expect(draft1.assets).toHaveLength(2);

      // Verify footnote 1 has 3 paragraphs
      const fn1 = draft1.project.research?.footnotes?.find((f) =>
        f.text.startsWith("First footnote with multiple paragraphs."),
      );
      expect(fn1).toBeDefined();
      expect(fn1?.text.split("\n\n")).toHaveLength(3);

      // Export Round 2 (Idempotency)
      const assetMap2 = new Map(draft1.assets.map((a) => [a.id, a]));
      const blob2 = await exportMarkdownBundle(draft1.project, assetMap2);
      const draft2 = await importMarkdownBundle(blob2, "mega-specimen-round2.zip");

      expect(() => validateProject(draft2.project)).not.toThrow();
      expect(draft2.counts.images).toBe(2);
      expect(draft2.counts.tables).toBe(1);
      expect(draft2.counts.notes).toBe(2);
      expect(draft2.assets).toHaveLength(2);
      expect(draft2.project.title).toBe(draft1.project.title);
    });
  });

  // ---------------------------------------------------------------------------
  // 7. Extreme Adversarial Boundaries & Malformed Constructs
  // ---------------------------------------------------------------------------
  describe("Extreme Adversarial Boundaries & Malformed Constructs", () => {
    it("handles table cells containing only <br> without text cleanly", async () => {
      const md = [
        "| Col 1 | Col 2 |",
        "| --- | --- |",
        "| <br><br> | Non-empty |",
      ].join("\n");

      const zipBytes = await createZipBundle(md);
      const draft = await importMarkdownBundle(zipBytes, "only-br.zip");

      expect(() => validateProject(draft.project)).not.toThrow();
      expect(draft.counts.tables).toBe(1);
    });

    it("handles table cells with formatted text enclosing <br> without schema errors", async () => {
      const md = [
        "| Heading 1 | Heading 2 |",
        "| --- | --- |",
        "| **Bold top<br>Bold bottom** | *Italic 1<br/>Italic 2* |",
      ].join("\n");

      const zipBytes = await createZipBundle(md);
      const draft = await importMarkdownBundle(zipBytes, "formatted-br.zip");

      expect(() => validateProject(draft.project)).not.toThrow();
      expect(draft.counts.tables).toBe(1);

      const tableNode = draft.project.entries[0].content?.content?.find((n) => n.type === "table");
      expect(tableNode).toBeDefined();
    });

    it("retains images inside table cells as text without crashing cell schema", async () => {
      const { png } = await createTestAssets();
      const md = [
        "| Icon | Description |",
        "| --- | --- |",
        `| ![Cell Icon](assets/${png.id}.png) | A cell with an image |`,
      ].join("\n");

      const assets = new Map([[ `${png.id}.png`, png.bytes ]]);
      const zipBytes = await createZipBundle(md, assets);
      const draft = await importMarkdownBundle(zipBytes, "table-image.zip");

      // CELL_CONTENT allows image or paragraph; either way validateProject must pass
      expect(() => validateProject(draft.project)).not.toThrow();
      expect(draft.counts.tables).toBe(1);
    });

    it("parses footnotes with tab indentation in continuation lines", async () => {
      const md = [
        "Prose with tab-indented footnote[^tab_fn].",
        "",
        "[^tab_fn]: Line 1 of footnote.",
        "",
        "\tLine 2 indented with a tab character.",
      ].join("\n");

      const zipBytes = await createZipBundle(md);
      const draft = await importMarkdownBundle(zipBytes, "tab-fn.zip");

      expect(() => validateProject(draft.project)).not.toThrow();
      expect(draft.counts.notes).toBe(1);
      const note = draft.project.research?.footnotes?.[0];
      expect(note?.text).toContain("Line 1 of footnote.");
      expect(note?.text).toContain("Line 2 indented with a tab character.");
    });

    it("handles multiple footnote references immediately adjacent without spacing", async () => {
      const md = [
        "Multiple consecutive references[^one][^two][^three] in single sentence.",
        "",
        "[^one]: Note 1",
        "",
        "[^two]: Note 2",
        "",
        "[^three]: Note 3",
      ].join("\n");

      const zipBytes = await createZipBundle(md);
      const draft = await importMarkdownBundle(zipBytes, "adjacent-fn.zip");

      expect(() => validateProject(draft.project)).not.toThrow();
      expect(draft.counts.notes).toBe(3);

      const p = draft.project.entries[0].content?.content?.[0];
      const refs = (p?.content ?? []).filter((n) => n.type === "footnoteReference");
      expect(refs).toHaveLength(3);
    });

    it("preserves formatted marks immediately adjacent to hoisted images", async () => {
      const { png } = await createTestAssets();
      const md = `**Bold text before**![Hoisted](assets/${png.id}.png)*Italic text after*`;

      const assets = new Map([[ `${png.id}.png`, png.bytes ]]);
      const zipBytes = await createZipBundle(md, assets);
      const draft = await importMarkdownBundle(zipBytes, "adjacent-marks-image.zip");

      expect(() => validateProject(draft.project)).not.toThrow();
      const blocks = draft.project.entries[0].content?.content ?? [];
      expect(blocks).toHaveLength(3);

      // Paragraph before should have bold mark
      expect(blocks[0].type).toBe("paragraph");
      expect(JSON.stringify(blocks[0])).toContain('"bold"');
      expect(textOf(blocks[0]).trim()).toBe("Bold text before");

      // Image
      expect(blocks[1].type).toBe("image");
      expect(blocks[1].attrs?.assetId).toBe(png.id);

      // Paragraph after should have italic mark
      expect(blocks[2].type).toBe("paragraph");
      expect(JSON.stringify(blocks[2])).toContain('"italic"');
      expect(textOf(blocks[2]).trim()).toBe("Italic text after");
    });

    it("parses headings containing an image without violating heading schema", async () => {
      const { png } = await createTestAssets();
      const md = `# Heading with ![Logo](assets/${png.id}.png "Site Logo") inline`;

      const assets = new Map([[ `${png.id}.png`, png.bytes ]]);
      const zipBytes = await createZipBundle(md, assets);
      const draft = await importMarkdownBundle(zipBytes, "heading-image.zip");

      expect(() => validateProject(draft.project)).not.toThrow();
      const heading = draft.project.entries[0].content?.content?.[0];
      expect(heading).toBeDefined();
      expect(heading?.type).toBe("heading");
      // Headings only accept inline text in ProseMirror; image is safely kept as text
      expect(textOf(heading!)).toContain("Heading with");
    });

    it("handles code blocks containing 4+ consecutive backticks without fence breakage", async () => {
      const code = "````\nconst x = ```nested```;\n````";
      const md = [
        "Before code",
        "",
        "`````markdown",
        code,
        "`````",
        "",
        "After code",
      ].join("\n");

      const zipBytes = await createZipBundle(md);
      const draft = await importMarkdownBundle(zipBytes, "backticks-code.zip");

      expect(() => validateProject(draft.project)).not.toThrow();
      const codeNode = draft.project.entries[0].content?.content?.find((n) => n.type === "codeBlock");
      expect(codeNode).toBeDefined();
      expect(codeNode?.content?.[0]?.text).toContain("const x = ```nested```;");
    });

    it("survives completely empty manuscript without crashing schema check", async () => {
      const zipBytes = await createZipBundle("");
      const draft = await importMarkdownBundle(zipBytes, "empty-manuscript.zip");

      expect(() => validateProject(draft.project)).not.toThrow();
      expect(draft.project.entries[0].content?.content?.length).toBeGreaterThanOrEqual(1);
    });

    it("survives manuscript containing only newlines and whitespace", async () => {
      const zipBytes = await createZipBundle("   \n\n\n   \t\n   \n");
      const draft = await importMarkdownBundle(zipBytes, "whitespace.zip");

      expect(() => validateProject(draft.project)).not.toThrow();
      expect(draft.project.entries[0].content?.content?.length).toBeGreaterThanOrEqual(1);
    });

    it("survives unclosed markdown markup (fences, asterisks, brackets)", async () => {
      const md = [
        "**Unclosed bold text",
        "*Unclosed italic text",
        "`Unclosed inline code",
        "> Unclosed blockquote",
        "```typescript",
        "Unclosed code fence",
      ].join("\n");

      const zipBytes = await createZipBundle(md);
      const draft = await importMarkdownBundle(zipBytes, "unclosed-markup.zip");

      expect(() => validateProject(draft.project)).not.toThrow();
    });
  });
});

// T010 (WP7): the manifest is part of the bundle contract. Export writes
// format/version/per-asset id+path+byteLength; import must not silently accept a
// manifest that contradicts the archive.
describe("Markdown bundle manifest verification (T010)", () => {
  async function exportedZip(): Promise<{ zip: JSZip; manifest: any; id: string }> {
    const png = await createPendingAsset(tinyPng);
    const project = newProject("Manifest Check");
    project.entries[0].content = {
      type: "doc",
      content: [
        para(text("Before the figure.")),
        { type: "image", attrs: { assetId: png.id, alt: "Fig" } },
      ],
    };
    const blob = await exportMarkdownBundle(project, new Map([[png.id, png]]));
    const zip = await JSZip.loadAsync(new Uint8Array(await blob.arrayBuffer()));
    const manifest = JSON.parse(await zip.file("manifest.json")!.async("string"));
    return { zip, manifest, id: png.id };
  }
  async function bytesOf(zip: JSZip): Promise<Uint8Array> {
    return zip.generateAsync({ type: "uint8array" });
  }

  it("accepts an untouched export and reports its image", async () => {
    const { zip, manifest, id } = await exportedZip();
    expect(manifest.version).toBe(1);
    expect(manifest.assets[0].id).toBe(id);
    const draft = await importMarkdownBundle(await bytesOf(zip), "ok.zip");
    expect(draft.counts.images).toBe(1);
    expect(draft.assets[0].id).toBe(id);
  });

  it("rejects a manifest from a newer bundle version", async () => {
    const { zip, manifest } = await exportedZip();
    zip.file("manifest.json", JSON.stringify({ ...manifest, version: 2 }));
    await expect(importMarkdownBundle(await bytesOf(zip), "v2.zip")).rejects.toThrow(
      /manifest version 2/i,
    );
  });

  it("rejects a manifest that names a different bundle format", async () => {
    const { zip, manifest } = await exportedZip();
    zip.file("manifest.json", JSON.stringify({ ...manifest, format: "something-else" }));
    await expect(importMarkdownBundle(await bytesOf(zip), "fmt.zip")).rejects.toThrow(
      /manifest format/i,
    );
  });

  it("rejects a bundle whose manifest lists an asset that is missing from the archive", async () => {
    const { zip, manifest } = await exportedZip();
    zip.remove(manifest.assets[0].path);
    await expect(importMarkdownBundle(await bytesOf(zip), "gone.zip")).rejects.toThrow(
      /manifest lists asset .* missing from the archive/i,
    );
  });

  it("warns when the manifest's recorded byte length disagrees with the hash-verified asset", async () => {
    const { zip, manifest, id } = await exportedZip();
    manifest.assets[0].byteLength += 1;
    zip.file("manifest.json", JSON.stringify(manifest));
    const draft = await importMarkdownBundle(await bytesOf(zip), "len.zip");
    expect(draft.assets[0].id).toBe(id);
    expect(draft.warnings.some((w) => /byte length .* does not match/i.test(w))).toBe(true);
  });

  it("warns when a manifest asset's recorded id does not match its path hash, keeping the file hash", async () => {
    const { zip, manifest, id } = await exportedZip();
    manifest.assets[0].id = "f".repeat(64);
    zip.file("manifest.json", JSON.stringify(manifest));
    const draft = await importMarkdownBundle(await bytesOf(zip), "id.zip");
    expect(draft.assets[0].id).toBe(id);
    expect(draft.warnings.some((w) => /does not match its recorded id/i.test(w))).toBe(true);
  });

  it("rejects a bundle whose manifest id is tampered AND whose listed asset file is absent (T011)", async () => {
    const { zip, manifest } = await exportedZip();
    manifest.assets[0].id = "f".repeat(64);
    zip.file("manifest.json", JSON.stringify(manifest));
    zip.remove(manifest.assets[0].path);
    await expect(importMarkdownBundle(await bytesOf(zip), "tamper-gone.zip")).rejects.toThrow(
      /manifest lists asset .* missing from the archive/i,
    );
  });
});
