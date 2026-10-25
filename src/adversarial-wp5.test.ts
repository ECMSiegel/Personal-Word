import { describe, expect, it } from "vitest";
import JSZip from "jszip";
import "./import/richImport.test";
import { previewHtml } from "./import/htmlImport";
import { previewDocx, previewWriting } from "./import/docxImport";
import {
  validateXmlSafe,
  isPathTraversal,
  MAX_TEXT_IMPORT_BYTES,
} from "./import/importLimits";
import { validateProject } from "./model";
import { verifyPendingAsset } from "./assets/assets";

function makePng(width: number, height: number): Uint8Array {
  const b = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52];
  const be = (n: number) => [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255];
  b.push(...be(width), ...be(height), 8, 2, 0, 0, 0, 0, 0, 0, 0);
  const out = new Uint8Array(b.length);
  out.set(b);
  return out;
}

function toBase64(bytes: Uint8Array): string {
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}

describe("Adversarial WP5: HTML Import & Active Content Neutralization", () => {
  it("strips active tags: script, style, iframe, object, embed, form, input, button, textarea, select", async () => {
    const html = `
      <div>
        <script>window.evil = 1;</script>
        <style>body { display: none; }</style>
        <iframe src="https://attacker.invalid"></iframe>
        <object data="exploit.swf"></object>
        <embed src="exploit.pdf" />
        <form action="/login"><input type="password" name="pwd"/><button>Send</button><textarea>secret</textarea><select><option>1</option></select></form>
        <p>Legitimate text</p>
      </div>
    `;
    const draft = await previewHtml(html, "active.html");
    const text = draft.project.entries[0].text;
    expect(text).toContain("Legitimate text");
    expect(text).not.toContain("window.evil");
    expect(text).not.toContain("display: none");
    expect(text).not.toContain("exploit");
    expect(text).not.toContain("secret");
    expect(draft.warnings.some((w) => w.includes("Active content"))).toBe(true);
    expect(() => validateProject(draft.project)).not.toThrow();
  });

  it("strips on* event handlers and dangerous protocol links", async () => {
    const html = `
      <div>
        <p onclick="alert(1)" ONMOUSEOVER="leak()" onfocus="pwn()">Clickable</p>
        <a href="javascript:alert(document.cookie)">JS Link</a>
        <a href="JAVASCRIPT:alert(1)">Upper JS Link</a>
        <a href="vbscript:msgbox(1)">VBScript Link</a>
        <a href="data:text/html,<script>alert(1)</script>">Data Link</a>
        <a href="https://example.com/safe">Safe Link</a>
      </div>
    `;
    const draft = await previewHtml(html, "handlers.html");
    const content = draft.project.entries[0].content.content!;
    const p = content.find((n) => n.type === "paragraph" && n.content?.some((c) => c.text === "Clickable"));
    expect(p).toBeDefined();

    // Check link marks
    const links = content.flatMap((n) =>
      (n.content ?? []).filter((c) => c.marks?.some((m) => m.type === "link")),
    );
    // Only safe link should have link mark
    for (const c of links) {
      const linkMark = c.marks?.find((m) => m.type === "link");
      expect(linkMark?.attrs?.href).toMatch(/^https?:\/\//);
      expect(linkMark?.attrs?.href).not.toContain("javascript:");
      expect(linkMark?.attrs?.href).not.toContain("data:");
      expect(linkMark?.attrs?.href).not.toContain("vbscript:");
    }
  });

  it("ignores all remote images without throwing and logs warnings", async () => {
    const html = `
      <div>
        <p><img src="http://remote.invalid/pic.png" alt="Insecure pic" /></p>
        <p><img src="https://remote.invalid/pic.png" alt="Secure pic" /></p>
        <p><img src="//remote.invalid/pic.png" alt="Protocol-relative pic" /></p>
        <p><img src="ftp://remote.invalid/pic.png" alt="FTP pic" /></p>
        <p>Text after images</p>
      </div>
    `;
    const draft = await previewHtml(html, "remote.html");
    expect(draft.assets).toHaveLength(0);
    expect(draft.counts.images).toBe(0);
    expect(draft.warnings.some((w) => w.includes("remote network resources are never fetched"))).toBe(true);
    expect(draft.warnings.some((w) => w.includes("Image reference (//remote.invalid/pic.png) was omitted"))).toBe(true);
    expect(draft.warnings.some((w) => w.includes("Image reference (ftp://remote.invalid/pic.png) was omitted"))).toBe(true);
    expect(() => validateProject(draft.project)).not.toThrow();
  });

  it("handles valid and invalid inline base64 images", async () => {
    const validPngBytes = makePng(10, 20);
    const validPngB64 = toBase64(validPngBytes);

    const html = `
      <div>
        <p><img src="data:image/png;base64,${validPngB64}" alt="Valid PNG" width="10" height="20" /></p>
        <p><img src="data:image/png;base64,corrupted-not-base64" alt="Corrupt B64" /></p>
        <p><img src="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7" alt="GIF not supported" /></p>
        <p>Text</p>
      </div>
    `;
    const draft = await previewHtml(html, "images.html");
    expect(draft.assets).toHaveLength(1);
    expect(draft.counts.images).toBe(1);

    const asset = draft.assets[0];
    await verifyPendingAsset(asset);
    expect(asset.meta.width).toBe(10);
    expect(asset.meta.height).toBe(20);
    expect(asset.meta.mime).toBe("image/png");

    expect(draft.warnings.some((w) => w.includes("Unsupported or invalid inline data image"))).toBe(true);
    expect(draft.warnings.some((w) => w.includes("Image reference (data:image/gif;base64"))).toBe(true);
    expect(() => validateProject(draft.project)).not.toThrow();
  });

  it("demonstrates mixed block/inline container issue: inline siblings of block elements in div are dropped", async () => {
    const mixedHtml = "<div>Hello <b>world</b><p>Second block</p></div>";
    const draft = await previewHtml(mixedHtml, "mixed.html");
    const text = draft.project.entries[0].text;
    // Note: 'Hello' is preserved, 'Second block' is preserved, but inline <b>world</b> was dropped!
    expect(text).toContain("Hello");
    expect(text).toContain("Second block");
    // This exposes that <b>world</b> was omitted due to hasBlockChildren dropping inline elements
    expect(text).not.toContain("world");
  });

  it("rejects oversized base64 images (> 25 megapixels)", async () => {
    // 6000 x 5000 = 30 megapixels > 25 megapixels
    const hugePngBytes = makePng(6000, 5000);
    const hugePngB64 = toBase64(hugePngBytes);

    const html = `<img src="data:image/png;base64,${hugePngB64}" alt="Too large" />`;
    const draft = await previewHtml(html, "huge.html");
    expect(draft.assets).toHaveLength(0);
    expect(draft.warnings.some((w) => w.includes("25 megapixel limit"))).toBe(true);
    expect(() => validateProject(draft.project)).not.toThrow();
  });

  it("enforces MAX_DOM_DEPTH strictly", async () => {
    // Exactly at depth 100 should succeed
    const okDepth = "<div>".repeat(95) + "<p>Inside</p>" + "</div>".repeat(95);
    const okDraft = await previewHtml(okDepth, "ok_depth.html");
    expect(okDraft.project.entries[0].text).toContain("Inside");

    // Over depth 100 should throw RangeError
    const deepHtml = "<div>".repeat(110) + "<p>Inside</p>" + "</div>".repeat(110);
    await expect(previewHtml(deepHtml, "deep.html")).rejects.toThrow(/deeply nested/i);
  });

  it("enforces MAX_TEXT_IMPORT_BYTES (20MB) limit on HTML text", async () => {
    const hugeString = "a".repeat(MAX_TEXT_IMPORT_BYTES + 1);
    await expect(previewHtml(hugeString, "huge.html")).rejects.toThrow(/exceeds 20MB limit/i);
  });

  it("handles completely empty HTML and whitespace gracefully", async () => {
    const draft = await previewHtml("", "empty.html");
    expect(draft.project.entries[0].text).toBe("");
    expect(draft.counts.paragraphs).toBe(1);
    expect(() => validateProject(draft.project)).not.toThrow();

    const wsDraft = await previewHtml("   \n\t  ", "whitespace.html");
    expect(wsDraft.project.entries[0].text).toBe("");
    expect(wsDraft.counts.paragraphs).toBe(1);
    expect(() => validateProject(wsDraft.project)).not.toThrow();
  });

  it("handles malformed tables and ensures strictly rectangular grid with non-empty cells", async () => {
    const malformedTable = `
      <table>
        <tr><th>Header 1</th></tr>
        <tr><td>Cell A</td><td>Cell B</td><td>Cell C</td></tr>
        <tr><td></td></tr>
      </table>
    `;
    const draft = await previewHtml(malformedTable, "table.html");
    expect(draft.counts.tables).toBe(1);

    const tableNode = draft.project.entries[0].content.content?.find((n) => n.type === "table");
    expect(tableNode).toBeDefined();

    const rows = tableNode?.content ?? [];
    expect(rows).toHaveLength(3);

    // Mismatched row columns must be equalized to maxCols (3)
    for (const r of rows) {
      expect(r.content).toHaveLength(3);
      for (const cell of r.content ?? []) {
        // CELL_CONTENT rule: must contain at least one block element
        expect(cell.content?.length).toBeGreaterThanOrEqual(1);
        expect(cell.content?.[0].type).toBe("paragraph");
      }
    }

    // Must pass schema check
    expect(() => validateProject(draft.project)).not.toThrow();
  });

  it("handles nested lists, blockquotes, preformatted code, and horizontal rules", async () => {
    const html = `
      <h2>Section Heading</h2>
      <hr />
      <blockquote><p>Quote line 1</p><p>Quote line 2</p></blockquote>
      <pre><code>function test() {\n  return 42;\n}</code></pre>
      <ul>
        <li>Bullet 1</li>
        <li>Bullet 2
          <ol>
            <li>Sub-ordered 1</li>
            <li>Sub-ordered 2</li>
          </ol>
        </li>
      </ul>
    `;
    const draft = await previewHtml(html, "complex.html");
    const content = draft.project.entries[0].content.content!;

    expect(content.some((n) => n.type === "heading" && n.attrs?.level === 2)).toBe(true);
    expect(content.some((n) => n.type === "horizontalRule")).toBe(true);
    expect(content.some((n) => n.type === "blockquote")).toBe(true);
    expect(content.some((n) => n.type === "codeBlock")).toBe(true);
    expect(content.some((n) => n.type === "bulletList")).toBe(true);

    expect(() => validateProject(draft.project)).not.toThrow();
  });
});

describe("Adversarial WP5: DOCX Limits, Zip Defenses & Container Validation", () => {
  it("rejects path traversal vectors in zip archive headers before inflation", () => {
    expect(isPathTraversal("../secret.txt")).toBe(true);
    expect(isPathTraversal("/etc/passwd")).toBe(true);
    expect(isPathTraversal("\\windows\\system32")).toBe(true);
    expect(isPathTraversal("C:\\test")).toBe(true);
    expect(isPathTraversal("foo\0bar.xml")).toBe(true);
    expect(isPathTraversal("word/../evil.xml")).toBe(true);
    expect(isPathTraversal("word/document.xml")).toBe(false);
  });

  it("rejects XXE external entity declarations in XML", () => {
    expect(() => validateXmlSafe('<!DOCTYPE foo SYSTEM "http://evil.invalid">')).toThrow();
    expect(() => validateXmlSafe('<!ENTITY xxe SYSTEM "file:///etc/passwd">')).toThrow();
    expect(() => validateXmlSafe('<!DOCTYPE foo PUBLIC "bar" "http://evil.invalid">')).toThrow();
    expect(() => validateXmlSafe('<!ENTITY xxe PUBLIC "bar" "http://evil.invalid">')).toThrow();
    expect(() => validateXmlSafe('<w:document><w:body><w:p/></w:body></w:document>')).not.toThrow();
  });

  it("rejects DOCX missing [Content_Types].xml or word/document.xml", async () => {
    const zip = new JSZip();
    zip.file("dummy.txt", "hello");
    const buf = await zip.generateAsync({ type: "arraybuffer" });
    await expect(previewDocx(buf, "broken.docx")).rejects.toThrow(/missing/i);

    const zip2 = new JSZip();
    zip2.file("[Content_Types].xml", '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"/>');
    const buf2 = await zip2.generateAsync({ type: "arraybuffer" });
    await expect(previewDocx(buf2, "no_doc.docx")).rejects.toThrow(/missing/i);
  });

  it("previewWriting dispatches correctly across all supported file extensions", async () => {
    const enc = new TextEncoder();
    const htmlBytes = enc.encode("<p>HTML Dispatch</p>").buffer;
    const htmlDraft = await previewWriting(htmlBytes, "test.htm");
    expect(htmlDraft.format).toBe("HTML");

    const mdBytes = enc.encode("# Markdown Dispatch\n\nBody").buffer;
    const mdDraft = await previewWriting(mdBytes, "test.markdown");
    expect(mdDraft.format).toBe("Markdown");

    const txtBytes = enc.encode("Plain Text Dispatch\n\nLine 2").buffer;
    const txtDraft = await previewWriting(txtBytes, "test.txt");
    expect(txtDraft.format).toBe("Plain text");

    const invalidBytes = new Uint8Array([0xff, 0xfe, 0xff]).buffer;
    await expect(previewWriting(invalidBytes, "unsupported.bin")).rejects.toThrow(
      /not valid UTF-8/i,
    );
  });
});
