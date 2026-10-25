import { describe, it, expect } from "vitest";
import type { JSONContent } from "@tiptap/react";
import { newProject, type Project } from "./model";
import { projectMarkdown, projectPlainText } from "./export/textExport";
import { parseManuscript, previewManuscript } from "./import/manuscript";

function createDocWithRefs(...refIds: string[]): JSONContent {
  const paragraphs: JSONContent[] = refIds.map((id, index) => ({
    type: "paragraph",
    content: [
      { type: "text", text: `Claim paragraph ${index + 1} with reference ` },
      { type: "footnoteReference", attrs: { id } },
      { type: "text", text: "." },
    ],
  }));
  return {
    type: "doc",
    content: paragraphs,
  };
}

function buildProject(
  title: string,
  footnotes: { id: string; text: string }[],
  refOrder?: string[]
): Project {
  const p = newProject(title);
  const ids = refOrder ?? footnotes.map((f) => f.id);
  p.entries[0].title = "Chapter 1";
  p.entries[0].content = createDocWithRefs(...ids);
  p.entries[0].text = "";
  p.research = {
    sources: [],
    notes: [],
    footnotes: footnotes.map((f) => ({ id: f.id, text: f.text })),
  };
  return p;
}

function extractFootnoteReferences(content: JSONContent): string[] {
  const ids: string[] = [];
  const walk = (node: JSONContent) => {
    if (node.type === "footnoteReference") {
      ids.push(String(node.attrs?.id));
    }
    (node.content ?? []).forEach(walk);
  };
  walk(content);
  return ids;
}

describe("Adversarial WP4 Stress Testing", () => {
  describe("1. Footnotes with 3+ paragraphs", () => {
    it("handles 3 paragraphs per footnote with exact content preservation", () => {
      const p = buildProject("Three Paras", [
        {
          id: "fn1",
          text: "First paragraph of note.\n\nSecond paragraph of note with extra details.\n\nThird paragraph of note concluding thoughts.",
        },
      ]);
      const md1 = projectMarkdown(p);
      expect(md1).toContain("[^1]: First paragraph of note.");
      expect(md1).toContain("    Second paragraph of note with extra details.");
      expect(md1).toContain("    Third paragraph of note concluding thoughts.");

      const imp1 = parseManuscript(md1, "test.md");
      expect(imp1.research?.footnotes).toHaveLength(1);
      expect(imp1.research?.footnotes[0].text).toBe(
        "First paragraph of note.\n\nSecond paragraph of note with extra details.\n\nThird paragraph of note concluding thoughts."
      );
    });

    it("handles 5 paragraphs per footnote", () => {
      const fiveParas = [
        "Para 1: Introduction to the source.",
        "Para 2: Historical context and background.",
        "Para 3: Critical disagreement among scholars.",
        "Para 4: Alternative archival evidence.",
        "Para 5: Summary of the argument.",
      ].join("\n\n");

      const p = buildProject("Five Paras", [{ id: "fn-five", text: fiveParas }]);
      const md = projectMarkdown(p);
      const imp = parseManuscript(md, "five.md");

      expect(imp.research?.footnotes).toHaveLength(1);
      expect(imp.research?.footnotes[0].text).toBe(fiveParas);
    });

    it("handles 10 paragraphs per footnote across multiple blank lines", () => {
      const tenParas = Array.from({ length: 10 }, (_, i) => `Paragraph ${i + 1} content.`).join("\n\n");
      const p = buildProject("Ten Paras", [{ id: "fn-ten", text: tenParas }]);
      const md = projectMarkdown(p);
      const imp = parseManuscript(md, "ten.md");

      expect(imp.research?.footnotes).toHaveLength(1);
      expect(imp.research?.footnotes[0].text).toBe(tenParas);
    });
  });

  describe("2. Footnotes with internal line breaks and Markdown formatting", () => {
    it("handles multi-line paragraphs (soft line breaks) within a footnote", () => {
      const noteWithBreaks = "Line 1 of para 1\nLine 2 of para 1\n\nLine 1 of para 2\nLine 2 of para 2";
      const p = buildProject("Soft Breaks", [{ id: "fn-breaks", text: noteWithBreaks }]);
      const md1 = projectMarkdown(p);
      const imp1 = parseManuscript(md1, "breaks.md");

      // In CommonMark / prepareMarkdownNotes, lines within a paragraph are joined with space
      expect(imp1.research?.footnotes).toHaveLength(1);
      expect(imp1.research?.footnotes[0].text).toBe(
        "Line 1 of para 1 Line 2 of para 1\n\nLine 1 of para 2 Line 2 of para 2"
      );

      // Round-trip stability from this canonical form
      const md2 = projectMarkdown(imp1);
      const imp2 = parseManuscript(md2, "breaks2.md");
      expect(imp2.research?.footnotes[0].text).toBe(imp1.research?.footnotes[0].text);
    });

    it("preserves Markdown formatting: *italic*, **bold**, `code`, and > blockquotes", () => {
      const formattedText =
        "Para 1 has *italic* and **bold** formatting.\n\n" +
        "Para 2 has `inline code span` and `code with spaces`.\n\n" +
        "Para 3 has > quote style text and [brackets] and #hash symbols.";

      const p = buildProject("Formatted", [{ id: "fn-fmt", text: formattedText }]);
      const md1 = projectMarkdown(p);
      const imp1 = parseManuscript(md1, "fmt.md");

      expect(imp1.research?.footnotes).toHaveLength(1);
      expect(imp1.research?.footnotes[0].text).toBe(formattedText);

      // Verify idempotency on second round-trip
      const md2 = projectMarkdown(imp1);
      const imp2 = parseManuscript(md2, "fmt2.md");
      expect(imp2.research?.footnotes[0].text).toBe(formattedText);
    });

    it("preserves footnotes containing markdown footnote syntax as literal text", () => {
      const literalSyntax =
        "Note mentioning [^2] literally and [^other] without breaking parser.\n\n" +
        "Continuation paragraph discussing [^99] references.";

      const p = buildProject("Literal Syntax", [{ id: "fn-lit", text: literalSyntax }]);
      const md1 = projectMarkdown(p);
      const imp1 = parseManuscript(md1, "lit.md");

      expect(imp1.research?.footnotes).toHaveLength(1);
      expect(imp1.research?.footnotes[0].text).toBe(literalSyntax);

      const md2 = projectMarkdown(imp1);
      const imp2 = parseManuscript(md2, "lit2.md");
      expect(imp2.research?.footnotes[0].text).toBe(literalSyntax);
    });

    it("handles complex punctuation, URLs, math symbols, and unicode", () => {
      const complexText =
        "Title: *A Treatise on (X + Y > Z)* & Other Oddities — § 4.2.\n\n" +
        "URL: https://example.com/path?a=1&b=2#section.\n\n" +
        "Math & quotes: 5 * 10 = 50, \"Double\", 'Single', `a_b_c`, \\backslash\\.\n\n" +
        "Unicode: 漢字, русский, العربية, 🚀 emoji.";

      const p = buildProject("Complex Text", [{ id: "fn-complex", text: complexText }]);
      const md1 = projectMarkdown(p);
      const imp1 = parseManuscript(md1, "complex.md");

      expect(imp1.research?.footnotes).toHaveLength(1);
      expect(imp1.research?.footnotes[0].text).toBe(complexText);

      const md2 = projectMarkdown(imp1);
      const imp2 = parseManuscript(md2, "complex2.md");
      expect(imp2.research?.footnotes[0].text).toBe(complexText);
    });
  });

  describe("3. Mixed single-paragraph and multi-paragraph footnotes in various orders", () => {
    it("handles alternating single and multi-paragraph footnotes", () => {
      const footnotes = [
        { id: "fn1", text: "Single 1" },
        { id: "fn2", text: "Multi 2 para 1\n\nMulti 2 para 2\n\nMulti 2 para 3" },
        { id: "fn3", text: "Single 3" },
        { id: "fn4", text: "Multi 4 para 1\n\nMulti 4 para 2" },
        { id: "fn5", text: "Single 5" },
      ];

      const p = buildProject("Alternating", footnotes);
      const md1 = projectMarkdown(p);
      const imp1 = parseManuscript(md1, "alt.md");

      expect(imp1.research?.footnotes).toHaveLength(5);
      for (let i = 0; i < 5; i++) {
        expect(imp1.research?.footnotes[i].text).toBe(footnotes[i].text);
      }
    });

    it("handles multi-paragraph footnotes followed by single-paragraph footnotes", () => {
      const footnotes = [
        { id: "fn1", text: "Multi 1 para 1\n\nMulti 1 para 2\n\nMulti 1 para 3\n\nMulti 1 para 4" },
        { id: "fn2", text: "Single 2" },
        { id: "fn3", text: "Single 3" },
      ];

      const p = buildProject("Multi First", footnotes);
      const md1 = projectMarkdown(p);
      const imp1 = parseManuscript(md1, "multifirst.md");

      expect(imp1.research?.footnotes).toHaveLength(3);
      expect(imp1.research?.footnotes[0].text).toBe(footnotes[0].text);
      expect(imp1.research?.footnotes[1].text).toBe("Single 2");
      expect(imp1.research?.footnotes[2].text).toBe("Single 3");
    });

    it("handles out-of-order references and multiple citations to the same footnote", () => {
      const footnotes = [
        { id: "fn-alpha", text: "Alpha footnote multi-para 1.\n\nAlpha footnote multi-para 2." },
        { id: "fn-beta", text: "Beta footnote single." },
        { id: "fn-gamma", text: "Gamma footnote multi-para 1.\n\nGamma footnote multi-para 2." },
      ];

      // Document references Beta first, then Alpha, then Beta again, then Gamma
      const p = buildProject("Out of order", footnotes, [
        "fn-beta",
        "fn-alpha",
        "fn-beta",
        "fn-gamma",
      ]);

      const md1 = projectMarkdown(p);
      const imp1 = parseManuscript(md1, "order.md");

      // In exportMarkdown, footnotes are numbered in order of appearance in the text:
      // 1: Beta, 2: Alpha, 3: Gamma
      expect(imp1.research?.footnotes).toHaveLength(3);
      expect(imp1.research?.footnotes[0].text).toBe("Beta footnote single.");
      expect(imp1.research?.footnotes[1].text).toBe(
        "Alpha footnote multi-para 1.\n\nAlpha footnote multi-para 2."
      );
      expect(imp1.research?.footnotes[2].text).toBe(
        "Gamma footnote multi-para 1.\n\nGamma footnote multi-para 2."
      );

      // Verify the body references exist and are ordered
      const refNodes = extractFootnoteReferences(imp1.entries[0].content);

      expect(refNodes).toHaveLength(4);
      expect(refNodes[0]).toBe(imp1.research?.footnotes[0].id); // Beta
      expect(refNodes[1]).toBe(imp1.research?.footnotes[1].id); // Alpha
      expect(refNodes[2]).toBe(imp1.research?.footnotes[0].id); // Beta repeat
      expect(refNodes[3]).toBe(imp1.research?.footnotes[2].id); // Gamma
    });
  });

  describe("4. Multi-round-trip idempotency and stability", () => {
    it("proves round-trip stability: project -> md -> import -> md -> import (idempotent text and footnote contents)", () => {
      const initialProject = buildProject("Idempotency Test", [
        { id: "fn1", text: "Footnote 1: Simple note." },
        {
          id: "fn2",
          text: "Footnote 2: Paragraph A.\n\nParagraph B with *emphasis* and `code`.\n\nParagraph C.",
        },
        {
          id: "fn3",
          text: "Footnote 3: Single paragraph with [bracketed] content.",
        },
      ]);

      // Step 1: Export initial project -> Import into project1
      const md1 = projectMarkdown(initialProject);
      const project1 = parseManuscript(md1, "manuscript.md");

      // Step 2: Export project1 -> Import into project2
      const md2 = projectMarkdown(project1);
      const project2 = parseManuscript(md2, "manuscript.md");

      // Step 3: Export project2 -> Import into project3
      const md3 = projectMarkdown(project2);
      const project3 = parseManuscript(md3, "manuscript.md");

      // Verify footnote contents are 100% idempotent across all cycles
      const texts1 = project1.research?.footnotes.map((f) => f.text);
      const texts2 = project2.research?.footnotes.map((f) => f.text);
      const texts3 = project3.research?.footnotes.map((f) => f.text);

      expect(texts1).toEqual([
        "Footnote 1: Simple note.",
        "Footnote 2: Paragraph A.\n\nParagraph B with *emphasis* and `code`.\n\nParagraph C.",
        "Footnote 3: Single paragraph with [bracketed] content.",
      ]);
      expect(texts2).toEqual(texts1);
      expect(texts3).toEqual(texts2);

      // Verify footnote reference counts and bindings remain valid
      const refs1 = extractFootnoteReferences(project1.entries[0].content);
      const refs2 = extractFootnoteReferences(project2.entries[0].content);
      const refs3 = extractFootnoteReferences(project3.entries[0].content);

      expect(refs1).toHaveLength(3);
      expect(refs2).toHaveLength(3);
      expect(refs3).toHaveLength(3);

      // Verify footnote definitions are NOT leaked into body text
      expect(project1.entries[0].text).not.toContain("Paragraph B with *emphasis*");
      expect(project2.entries[0].text).not.toContain("Paragraph B with *emphasis*");
      expect(project3.entries[0].text).not.toContain("Paragraph B with *emphasis*");

      // Verify all claim text is preserved in the imported document
      expect(project1.entries[0].text).toContain("Claim paragraph 1 with reference");
      expect(project1.entries[0].text).toContain("Claim paragraph 2 with reference");
      expect(project1.entries[0].text).toContain("Claim paragraph 3 with reference");

      expect(project2.entries[0].text).toContain("Claim paragraph 1 with reference");
      expect(project2.entries[0].text).toContain("Claim paragraph 2 with reference");
      expect(project2.entries[0].text).toContain("Claim paragraph 3 with reference");

      expect(project3.entries[0].text).toContain("Claim paragraph 1 with reference");
      expect(project3.entries[0].text).toContain("Claim paragraph 2 with reference");
      expect(project3.entries[0].text).toContain("Claim paragraph 3 with reference");
    });

    it("verifies multi-section projects round-trip into single entry cleanly", () => {
      const p = buildProject("Multi Section", [
        { id: "n1", text: "Note in Sec 1.\n\nSec 1 Continuation." },
        { id: "n2", text: "Note in Sec 2." },
      ]);
      // Add a second section
      const sec2 = {
        ...p.entries[0],
        id: "sec-2",
        title: "Chapter 2",
        content: {
          type: "doc",
          content: [
            {
              type: "paragraph",
              content: [
                { type: "text", text: "Section 2 claim " },
                { type: "footnoteReference", attrs: { id: "n2" } },
              ],
            },
          ],
        },
      };
      p.entries.push(sec2);
      p.order.push(sec2.id);

      const md1 = projectMarkdown(p);
      const imp1 = parseManuscript(md1, "two_sec.md");

      expect(imp1.research?.footnotes).toHaveLength(2);
      expect(imp1.research?.footnotes[0].text).toBe("Note in Sec 1.\n\nSec 1 Continuation.");
      expect(imp1.research?.footnotes[1].text).toBe("Note in Sec 2.");

      // Re-export imp1 and re-import to check stability
      const md2 = projectMarkdown(imp1);
      const imp2 = parseManuscript(md2, "two_sec.md");

      expect(imp2.research?.footnotes.map((f) => f.text)).toEqual(
        imp1.research?.footnotes.map((f) => f.text)
      );
      expect(imp1.entries[0].text).toContain("Section 2 claim");
      expect(imp2.entries[0].text).toContain("Section 2 claim");
      expect(imp2.entries[0].text).not.toContain("Sec 1 Continuation.");
    });
  });

  describe("5. Edge Cases & Boundary Conditions", () => {
    it("handles unreferenced footnote definitions in imported markdown", () => {
      const rawMd =
        "Main body claim[^1].\n\n" +
        "[^1]: Referenced note.\n\n" +
        "[^unreferenced]: Unreferenced note line 1.\n\n    Unreferenced continuation line.";

      const preview = previewManuscript(new TextEncoder().encode(rawMd).buffer, "unref.md");
      // Warning recorded
      expect(preview.warnings.some((w) => w.includes("[^unreferenced]"))).toBe(true);
      // Unreferenced definition is not dropped; it is appended back to body text
      expect(preview.project.entries[0].text).toContain("[^unreferenced]");
      expect(preview.project.entries[0].text).toContain("Unreferenced continuation line");
      // Only referenced note is in research.footnotes
      expect(preview.project.research?.footnotes).toHaveLength(1);
      expect(preview.project.research?.footnotes[0].text).toBe("Referenced note.");
    });

    it("handles undefined footnote references in body text", () => {
      const rawMd = "Main body claim[^missing].\n";
      const preview = previewManuscript(new TextEncoder().encode(rawMd).buffer, "missing.md");

      expect(preview.warnings.some((w) => w.includes("[^missing]"))).toBe(true);
      expect(preview.project.entries[0].text).toContain("Main body claim[^missing].");
      expect(preview.project.research?.footnotes ?? []).toHaveLength(0);
    });

    it("handles duplicate footnote definitions gracefully", () => {
      const rawMd =
        "Body claim[^1].\n\n" +
        "[^1]: First version.\n\n" +
        "[^1]: Duplicate version.";

      const preview = previewManuscript(new TextEncoder().encode(rawMd).buffer, "dup.md");
      expect(preview.warnings.some((w) => w.includes("defined more than once"))).toBe(true);
      expect(preview.project.research?.footnotes).toHaveLength(1);
      expect(preview.project.research?.footnotes[0].text).toBe("First version.");
      // Duplicate version kept as text
      expect(preview.project.entries[0].text).toContain("Duplicate version");
    });

    it("ensures plain text export does not emit markdown footnote markers or continuation indents", () => {
      const p = buildProject("Plain Export", [
        { id: "f1", text: "Para 1.\n\nPara 2 continuation." },
      ]);
      const txt = projectPlainText(p);

      expect(txt).toContain("1. Para 1.\n\nPara 2 continuation.");
      expect(txt).not.toContain("[^1]:");
      expect(txt).not.toContain("    Para 2");
    });

    it("handles empty and whitespace-only footnote text gracefully", () => {
      const p = buildProject("Empty Notes", [
        { id: "fn-empty", text: "" },
        { id: "fn-space", text: "   " },
      ]);
      const md = projectMarkdown(p);
      const imp = parseManuscript(md, "empty.md");

      expect(imp.research?.footnotes).toHaveLength(2);
      expect(imp.research?.footnotes[0].text).toBe("");
      expect(imp.research?.footnotes[1].text).toBe("");
    });
  });

  describe("6. Large Scale Stress: 50 Footnotes with Mixed Paragraph Counts", () => {
    it("exports, imports, and maintains references across 50 footnotes", () => {
      const footnotes = Array.from({ length: 50 }, (_, i) => {
        const numParas = (i % 4) + 1; // 1 to 4 paragraphs
        const paras = Array.from(
          { length: numParas },
          (_, p) => `Note ${i + 1} paragraph ${p + 1} with detail.`
        );
        return {
          id: `fn-${i + 1}`,
          text: paras.join("\n\n"),
        };
      });

      const p = buildProject("Scale 50", footnotes);
      const start = performance.now();
      const md1 = projectMarkdown(p);
      const imp1 = parseManuscript(md1, "scale50.md");
      const duration = performance.now() - start;

      expect(duration).toBeLessThan(1000); // Efficient execution under 1 second
      expect(imp1.research?.footnotes).toHaveLength(50);

      for (let i = 0; i < 50; i++) {
        expect(imp1.research?.footnotes[i].text).toBe(footnotes[i].text);
      }

      // Second round-trip
      const md2 = projectMarkdown(imp1);
      const imp2 = parseManuscript(md2, "scale50_2.md");

      expect(imp2.research?.footnotes).toHaveLength(50);
      for (let i = 0; i < 50; i++) {
        expect(imp2.research?.footnotes[i].text).toBe(footnotes[i].text);
      }
    });
  });

  describe("7. Citations and Note Context Round-Trip", () => {
    it("exports source citations in footnotes and re-imports them cleanly", () => {
      const p = buildProject("Citations", [
        { id: "fn-cit", text: "Placeholder" },
      ]);
      p.research!.sources = [
        {
          id: "src1",
          kind: "book",
          title: "The Roman Republic",
          authors: ["Marcus Cicero"],
          publisher: "Rome Press",
          year: "44 BC",
        },
      ];
      p.research!.footnotes = [
        {
          id: "fn-cit",
          sourceId: "src1",
          text: "Additional comment on Cicero.",
          locator: "42",
        },
      ];

      const md1 = projectMarkdown(p);
      expect(md1).toContain("Marcus Cicero, The Roman Republic (Rome Press, 44 BC), 42.");
      expect(md1).toContain("Additional comment on Cicero.");

      const imp1 = parseManuscript(md1, "cit.md");
      expect(imp1.research?.footnotes).toHaveLength(1);
      expect(imp1.research?.footnotes[0].text).toContain("Marcus Cicero, The Roman Republic (Rome Press, 44 BC), 42.");
      expect(imp1.research?.footnotes[0].text).toContain("Additional comment on Cicero.");
    });
  });

  describe("8. CommonMark Syntax Variations in Footnote Continutations", () => {
    it("handles tab indentation in continuation lines", () => {
      const rawMd =
        "Body claim[^1].\n\n" +
        "[^1]: First line.\n\n" +
        "\tTab-indented continuation line.\n\n" +
        "\tAnother tab line.";

      const imp = parseManuscript(rawMd, "tab.md");
      expect(imp.research?.footnotes).toHaveLength(1);
      expect(imp.research?.footnotes[0].text).toBe(
        "First line.\n\nTab-indented continuation line.\n\nAnother tab line."
      );
    });

    it("verifies continuation lines within a block collapse soft breaks to spaces", () => {
      const noteWithCode =
        "Paragraph 1 with explanation.\n\n" +
        "`inline code` with explanation.\n\n" +
        "Paragraph 3 after code.";

      const p = buildProject("Code in note", [{ id: "fn-code", text: noteWithCode }]);
      const md1 = projectMarkdown(p);
      const imp1 = parseManuscript(md1, "code.md");

      expect(imp1.research?.footnotes).toHaveLength(1);
      expect(imp1.research?.footnotes[0].text).toBe(noteWithCode);

      const md2 = projectMarkdown(imp1);
      const imp2 = parseManuscript(md2, "code2.md");
      expect(imp2.research?.footnotes[0].text).toBe(noteWithCode);
    });
  });
});
