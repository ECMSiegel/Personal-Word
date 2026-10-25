import { describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";
import JSZip from "jszip";
// @ts-expect-error sax has no type declarations
import sax from "sax";
import {
  MAX_DOCX_COMPRESSED_BYTES,
  MAX_ZIP_ENTRIES,
  validateZipContainer,
  validateXmlSafe,
} from "./importLimits";
import { previewDocx, previewWriting } from "./docxImport";
import { previewHtml } from "./htmlImport";
import { validateProject } from "../model";

// --- Node.js DOMParser Polyfill for Vitest (browser WebKit has native DOMParser) ---
class FakeNode {
  nodeType: number;
  tagName: string;
  localName: string;
  prefix: string;
  childNodes: FakeNode[] = [];
  attributes: { name: string; value: string }[] = [];
  parentNode: FakeNode | null = null;
  _text = "";
  private _attrMap: Map<string, string> = new Map();

  constructor(nodeType: number, tagName = "", localName = "", prefix = "") {
    this.nodeType = nodeType;
    this.tagName = tagName.toUpperCase();
    this.localName = localName;
    this.prefix = prefix;
  }

  get children(): FakeNode[] {
    return this.childNodes.filter((c) => c.nodeType === 1);
  }

  get id(): string {
    return this.getAttribute("id") ?? "";
  }

  get textContent(): string {
    if (this.nodeType === 3) return this._text;
    return this.childNodes.map((c) => c.textContent).join("");
  }

  set textContent(v: string) {
    if (this.nodeType === 3) {
      this._text = v;
    } else {
      const tn = new FakeTextNode(v);
      tn.parentNode = this;
      this.childNodes = [tn];
    }
  }

  getAttribute(n: string): string | null {
    return this._attrMap.get(n.toLowerCase()) ?? null;
  }

  getAttributeNS(_ns: string, n: string): string | null {
    return this.getAttribute(n);
  }

  setAttribute(n: string, v: string) {
    this._attrMap.set(n.toLowerCase(), v);
    const ex = this.attributes.find((a) => a.name.toLowerCase() === n.toLowerCase());
    if (ex) ex.value = v;
    else this.attributes.push({ name: n, value: v });
  }

  removeAttribute(n: string) {
    this._attrMap.delete(n.toLowerCase());
    this.attributes = this.attributes.filter(
      (a) => a.name.toLowerCase() !== n.toLowerCase(),
    );
  }

  remove() {
    if (this.parentNode) {
      this.parentNode.childNodes = this.parentNode.childNodes.filter((c) => c !== this);
    }
  }

  cloneNode(deep = false): FakeNode {
    const clone = new FakeNode(this.nodeType, this.tagName, this.localName, this.prefix);
    clone._text = this._text;
    for (const a of this.attributes) clone.setAttribute(a.name, a.value);
    if (deep) {
      for (const c of this.childNodes) {
        const childClone = c.cloneNode(true);
        childClone.parentNode = clone;
        clone.childNodes.push(childClone);
      }
    }
    return clone;
  }

  get classList() {
    const classAttr = this.getAttribute("class") ?? "";
    const classes = new Set(classAttr.split(/\s+/).filter(Boolean));
    return {
      contains: (cls: string) => classes.has(cls),
    };
  }

  getElementsByTagName(tagName: string): FakeNode[] {
    const res: FakeNode[] = [];
    const target = tagName.toUpperCase();
    const walk = (n: FakeNode) => {
      for (const c of n.childNodes) {
        if (c.nodeType === 1) {
          if (
            target === "*" ||
            c.tagName === target ||
            c.localName.toUpperCase() === target ||
            (c.prefix && `${c.prefix}:${c.localName}`.toUpperCase() === target)
          ) {
            res.push(c);
          }
          walk(c);
        }
      }
    };
    walk(this);
    return res;
  }

  querySelector(sel: string): FakeNode | null {
    const all = this.querySelectorAll(sel);
    return all[0] ?? null;
  }

  querySelectorAll(selector: string): FakeNode[] {
    const res: FakeNode[] = [];
    const selectors = selector.split(",").map((s) => s.trim()).filter(Boolean);

    function matches(el: FakeNode, sel: string): boolean {
      if (sel === "*") return true;
      if (sel.startsWith(".")) return el.classList.contains(sel.slice(1));
      if (sel.startsWith("#")) return el.getAttribute("id") === sel.slice(1);
      if (sel.startsWith("[") && sel.endsWith("]")) {
        const inner = sel.slice(1, -1);
        if (inner.includes("^=")) {
          const [k, v] = inner.split("^=");
          return (el.getAttribute(k) ?? "").startsWith(v.replace(/['"]/g, ""));
        }
        if (inner.includes("=")) {
          const [k, v] = inner.split("=");
          return el.getAttribute(k) === v.replace(/['"]/g, "");
        }
        return el.getAttribute(inner) !== null;
      }
      const tagMatch = /^([A-Za-z0-9_-]+)(.*)/.exec(sel);
      if (tagMatch) {
        const t = tagMatch[1].toUpperCase();
        if (el.tagName !== t && el.localName.toUpperCase() !== t) return false;
        const rest = tagMatch[2];
        if (!rest) return true;
        return matches(el, rest);
      }
      return false;
    }

    const walk = (n: FakeNode) => {
      for (const c of n.childNodes) {
        if (c.nodeType === 1) {
          if (selectors.some((s) => matches(c, s))) res.push(c);
          walk(c);
        }
      }
    };
    walk(this);
    return res;
  }
}

class FakeTextNode extends FakeNode {
  constructor(text: string) {
    super(3, "#text", "", "");
    this._text = text;
  }
}

class FakeDocument extends FakeNode {
  constructor() {
    super(9, "#document", "", "");
  }

  get documentElement(): FakeNode | null {
    return this.children[0] ?? null;
  }

  get body(): FakeNode {
    return this.querySelector("body") ?? this.children[0] ?? this;
  }
}

function parseXml(str: string): FakeDocument {
  const doc = new FakeDocument();
  let curr: FakeNode = doc;
  const parser = sax.parser(true, { lowercase: true, xmlns: true });

  parser.onopentag = (tag: any) => {
    const el = new FakeNode(1, tag.name, tag.local, tag.prefix);
    for (const [name, attr] of Object.entries(tag.attributes)) {
      const val = (attr as any).value ?? String(attr);
      el.setAttribute(name, val);
      if ((attr as any).local) {
        el.setAttribute((attr as any).local, val);
      }
      if ((attr as any).prefix && (attr as any).local) {
        el.setAttribute(`${(attr as any).prefix}:${(attr as any).local}`, val);
      }
    }
    el.parentNode = curr;
    curr.childNodes.push(el);
    curr = el;
  };

  parser.onclosetag = () => {
    curr = curr.parentNode ?? doc;
  };

  parser.ontext = (t: string) => {
    const tn = new FakeTextNode(t);
    tn.parentNode = curr;
    curr.childNodes.push(tn);
  };

  parser.write(str).close();
  return doc;
}

const VOID_TAGS = new Set([
  "AREA", "BASE", "BR", "COL", "EMBED", "HR", "IMG", "INPUT", "LINK", "META", "PARAM", "SOURCE", "TRACK", "WBR",
]);

function parseHtml(str: string): FakeDocument {
  const doc = new FakeDocument();
  const htmlNode = new FakeNode(1, "HTML", "html", "");
  htmlNode.parentNode = doc;
  doc.childNodes.push(htmlNode);
  const headNode = new FakeNode(1, "HEAD", "head", "");
  headNode.parentNode = htmlNode;
  const bodyNode = new FakeNode(1, "BODY", "body", "");
  bodyNode.parentNode = htmlNode;
  htmlNode.childNodes.push(headNode, bodyNode);

  str = str.replace(/<!DOCTYPE[^>]*>/i, "");
  const tagRegex =
    /<!--[\s\S]*?-->|<(\/)?([a-zA-Z0-9_-]+)((?:\s+[a-zA-Z0-9_:-]+(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+))?)*)\s*(\/)?>/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  const stack: FakeNode[] = [bodyNode];

  while ((match = tagRegex.exec(str)) !== null) {
    if (match.index > lastIndex) {
      const text = str.slice(lastIndex, match.index);
      if (text.trim() || stack[stack.length - 1] === bodyNode) {
        const tn = new FakeTextNode(text);
        tn.parentNode = stack[stack.length - 1];
        stack[stack.length - 1].childNodes.push(tn);
      }
    }
    lastIndex = tagRegex.lastIndex;

    if (match[0].startsWith("<!--")) continue;
    const isClosing = Boolean(match[1]);
    const rawTag = match[2];
    const tagName = rawTag.toUpperCase();
    const rawAttrs = match[3];
    const isSelfClosing = Boolean(match[4]) || VOID_TAGS.has(tagName);

    if (tagName === "HTML") continue;
    if (tagName === "HEAD") {
      if (isClosing) {
        if (stack[stack.length - 1] === headNode) stack.pop();
      } else {
        stack.push(headNode);
      }
      continue;
    }
    if (tagName === "BODY") {
      if (isClosing) {
        if (stack.length > 1 && stack[stack.length - 1] === bodyNode) stack.pop();
      } else {
        stack[0] = bodyNode;
      }
      continue;
    }

    if (isClosing) {
      for (let i = stack.length - 1; i >= 1; i--) {
        if (stack[i].tagName === tagName) {
          stack.length = i;
          break;
        }
      }
    } else {
      const el = new FakeNode(1, tagName, rawTag.toLowerCase(), "");
      const attrRegex =
        /([a-zA-Z0-9_:-]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g;
      let amatch: RegExpExecArray | null;
      while ((amatch = attrRegex.exec(rawAttrs)) !== null) {
        const name = amatch[1];
        const val = amatch[2] ?? amatch[3] ?? amatch[4] ?? "";
        el.setAttribute(name, val);
      }
      el.parentNode = stack[stack.length - 1];
      stack[stack.length - 1].childNodes.push(el);
      if (!isSelfClosing) stack.push(el);
    }
  }

  if (lastIndex < str.length) {
    const text = str.slice(lastIndex);
    if (text) {
      const tn = new FakeTextNode(text);
      tn.parentNode = stack[stack.length - 1];
      stack[stack.length - 1].childNodes.push(tn);
    }
  }

  return doc;
}

if (typeof globalThis.DOMParser === "undefined") {
  globalThis.DOMParser = class {
    parseFromString(str: string, mime: string): FakeDocument {
      if (mime === "application/xml" || mime.endsWith("+xml")) {
        return parseXml(str);
      }
      return parseHtml(str);
    }
  } as any;
}
if (typeof (globalThis as any).Node === "undefined") {
  class NodeClass {}
  (NodeClass as any).ELEMENT_NODE = 1;
  (NodeClass as any).TEXT_NODE = 3;
  (NodeClass as any).DOCUMENT_NODE = 9;
  (globalThis as any).Node = NodeClass;
}

const FIXTURES_DIR = path.resolve("tests/fixtures/rich-import");

function loadFixture(filename: string): ArrayBuffer {
  const filePath = path.join(FIXTURES_DIR, filename);
  const buffer = fs.readFileSync(filePath);
  return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
}

describe("DOCX Rich Import", () => {
  it("imports minimal valid docx", async () => {
    const bytes = loadFixture("minimal.docx");
    const draft = await previewDocx(bytes, "minimal.docx");

    expect(draft.format).toBe("DOCX");
    expect(draft.filename).toBe("minimal.docx");
    expect(draft.project.title).toBe("minimal");
    expect(draft.project.entries[0].text).toContain("A minimal document.");
    expect(draft.counts.paragraphs).toBe(1);
    expect(draft.counts.images).toBe(0);
    expect(draft.counts.tables).toBe(0);
    expect(draft.counts.notes).toBe(0);
    expect(() => validateProject(draft.project)).not.toThrow();
  });

  it("imports rich-sample.docx with headings, run marks, tables, footnotes, and embedded PNG", async () => {
    const bytes = loadFixture("rich-sample.docx");
    const draft = await previewDocx(bytes, "rich-sample.docx");

    expect(draft.project.title).toBe("rich-sample");
    expect(draft.counts.tables).toBe(1);
    expect(draft.counts.images).toBe(1);
    expect(draft.counts.notes).toBe(1);
    expect(draft.assets).toHaveLength(1);

    const asset = draft.assets[0];
    expect(asset.meta.mime).toBe("image/png");
    expect(asset.id).toMatch(/^[0-9a-f]{64}$/);

    const content = draft.project.entries[0].content.content!;

    // Heading 1
    const heading = content.find((n) => n.type === "heading");
    expect(heading).toBeDefined();
    expect(heading?.attrs?.level).toBe(1);

    // Formatted text paragraph
    const p = content.find(
      (n) =>
        n.type === "paragraph" &&
        n.content?.some((c) => c.text?.includes("Bold")),
    );
    expect(p).toBeDefined();
    const boldRun = p?.content?.find((c) => c.text === "Bold ");
    expect(boldRun?.marks?.some((m) => m.type === "bold")).toBe(true);

    const italicRun = p?.content?.find((c) => c.text === "Italic ");
    expect(italicRun?.marks?.some((m) => m.type === "italic")).toBe(true);

    const underlineRun = p?.content?.find((c) => c.text === "Underline ");
    expect(underlineRun?.marks?.some((m) => m.type === "underline")).toBe(true);

    const strikeRun = p?.content?.find((c) => c.text === "Strike");
    expect(strikeRun?.marks?.some((m) => m.type === "strike")).toBe(true);

    // Footnote reference
    const fnRef = p?.content?.find((c) => c.type === "footnoteReference");
    expect(fnRef).toBeDefined();
    const footnotes = draft.project.research?.footnotes ?? [];
    expect(footnotes).toHaveLength(1);
    expect(footnotes[0].id).toBe(fnRef?.attrs?.id);
    expect(footnotes[0].text).toBe("A sample footnote citation.");

    // Table
    const table = content.find((n) => n.type === "table");
    expect(table).toBeDefined();
    const rows = table?.content ?? [];
    expect(rows).toHaveLength(2);
    // Header row has tableHeader cells
    expect(rows[0].content?.[0].type).toBe("tableHeader");
    expect(rows[1].content?.[0].type).toBe("tableCell");

    // Every cell must have at least one block element
    for (const r of rows) {
      for (const cell of r.content ?? []) {
        expect(cell.content?.length).toBeGreaterThanOrEqual(1);
        expect(cell.content?.[0].type).toBe("paragraph");
      }
    }

    // Image block
    const imgBlock = content.find((n) => n.type === "image");
    expect(imgBlock).toBeDefined();
    expect(imgBlock?.attrs?.assetId).toBe(asset.id);
    expect(imgBlock?.attrs?.alt).toBe("A sample image");

    expect(() => validateProject(draft.project)).not.toThrow();
  });

  it("produces visible warning and skips unsupported image formats (unsupported-image.docx)", async () => {
    const bytes = loadFixture("unsupported-image.docx");
    const draft = await previewDocx(bytes, "unsupported-image.docx");

    expect(draft.assets).toHaveLength(0);
    expect(draft.counts.images).toBe(0);
    expect(
      draft.warnings.some((w) =>
        w.toLowerCase().includes("unsupported image format"),
      ),
    ).toBe(true);
    expect(() => validateProject(draft.project)).not.toThrow();
  });

  it("imports bullet and numbered lists with nested levels", async () => {
    const zip = new JSZip();
    zip.file(
      "[Content_Types].xml",
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
  <Override PartName="/word/numbering.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.numbering+xml"/>
</Types>`
    );
    zip.file(
      "_rels/.rels",
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`
    );
    zip.file(
      "word/numbering.xml",
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:numbering xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:abstractNum w:abstractNumId="0">
    <w:lvl w:ilvl="0"><w:numFmt w:val="bullet"/></w:lvl>
    <w:lvl w:ilvl="1"><w:numFmt w:val="bullet"/></w:lvl>
  </w:abstractNum>
  <w:num w:numId="1"><w:abstractNumId w:val="0"/></w:num>
</w:numbering>`
    );
    zip.file(
      "word/document.xml",
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    <w:p>
      <w:pPr><w:numPr><w:ilvl w:val="0"/><w:numId w:val="1"/></w:numPr></w:pPr>
      <w:r><w:t>Parent bullet</w:t></w:r>
    </w:p>
    <w:p>
      <w:pPr><w:numPr><w:ilvl w:val="1"/><w:numId w:val="1"/></w:numPr></w:pPr>
      <w:r><w:t>Child bullet</w:t></w:r>
    </w:p>
  </w:body>
</w:document>`
);

    const buf = await zip.generateAsync({ type: "arraybuffer" });
    const draft = await previewDocx(buf, "lists.docx");

    const content = draft.project.entries[0].content.content!;
    const bulletList = content.find((n) => n.type === "bulletList");
    expect(bulletList).toBeDefined();
    expect(draft.project.entries[0].text).toContain("Parent bullet");
    expect(draft.project.entries[0].text).toContain("Child bullet");
    expect(() => validateProject(draft.project)).not.toThrow();
  });

  it("handles merged table cells by flattening to 1x1 cells with user warning", async () => {
    const zip = new JSZip();
    zip.file(
      "[Content_Types].xml",
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`
    );
    zip.file(
      "_rels/.rels",
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`
    );
    zip.file(
      "word/document.xml",
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    <w:tbl>
      <w:tr>
        <w:tc>
          <w:tcPr><w:gridSpan w:val="2"/></w:tcPr>
          <w:p><w:r><w:t>Merged Span</w:t></w:r></w:p>
        </w:tc>
      </w:tr>
      <w:tr>
        <w:tc><w:p><w:r><w:t>Cell A</w:t></w:r></w:p></w:tc>
        <w:tc><w:p><w:r><w:t>Cell B</w:t></w:r></w:p></w:tc>
      </w:tr>
    </w:tbl>
  </w:body>
</w:document>`
    );

    const buf = await zip.generateAsync({ type: "arraybuffer" });
    const draft = await previewDocx(buf, "merged.docx");

    expect(
      draft.warnings.some((w) => w.includes("Merged table cells were flattened")),
    ).toBe(true);

    const table = draft.project.entries[0].content.content?.find(
      (n) => n.type === "table",
    );
    expect(table).toBeDefined();
    expect(table?.content?.[0].content).toHaveLength(2);
    expect(table?.content?.[1].content).toHaveLength(2);
    expect(() => validateProject(draft.project)).not.toThrow();
  });

  it("imports tracked changes in accepted state with explanatory warning", async () => {
    const zip = new JSZip();
    zip.file(
      "[Content_Types].xml",
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`
    );
    zip.file(
      "_rels/.rels",
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`
    );
    zip.file(
      "word/document.xml",
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    <w:p>
      <w:r><w:t>Keep this. </w:t></w:r>
      <w:ins><w:r><w:t>Accepted addition. </w:t></w:r></w:ins>
      <w:del><w:r><w:t>Rejected deletion.</w:t></w:r></w:del>
    </w:p>
  </w:body>
</w:document>`
    );

    const buf = await zip.generateAsync({ type: "arraybuffer" });
    const draft = await previewDocx(buf, "tracked.docx");

    expect(draft.project.entries[0].text).toContain("Accepted addition.");
    expect(draft.project.entries[0].text).not.toContain("Rejected deletion.");
    expect(
      draft.warnings.some((w) =>
        w.includes("revisions were imported in their accepted state"),
      ),
    ).toBe(true);
    expect(() => validateProject(draft.project)).not.toThrow();
  });
});

describe("Inert HTML Import", () => {
  it("imports rich-sample.html with structural tags, table, and data URI PNG", async () => {
    const html = fs.readFileSync(path.join(FIXTURES_DIR, "rich-sample.html"), "utf-8");
    const draft = await previewHtml(html, "rich-sample.html");

    expect(draft.format).toBe("HTML");
    expect(draft.filename).toBe("rich-sample.html");
    expect(draft.project.title).toBe("rich-sample");
    expect(draft.counts.tables).toBe(1);
    expect(draft.counts.images).toBe(1);
    expect(draft.counts.notes).toBe(1);

    const asset = draft.assets[0];
    expect(asset.meta.mime).toBe("image/png");
    expect(asset.id).toMatch(/^[0-9a-f]{64}$/);

    const content = draft.project.entries[0].content.content!;
    const heading = content.find((n) => n.type === "heading");
    expect(heading?.attrs?.level).toBe(1);

    const table = content.find((n) => n.type === "table");
    expect(table).toBeDefined();

    const lists = content.filter(
      (n) => n.type === "bulletList" || n.type === "orderedList",
    );
    expect(lists.length).toBeGreaterThanOrEqual(2);

    expect(() => validateProject(draft.project)).not.toThrow();
  });

  it("neutralizes malicious.html: strips scripts, event handlers, iframes, forms, and never fetches remote images", async () => {
    const html = fs.readFileSync(path.join(FIXTURES_DIR, "malicious.html"), "utf-8");
    const draft = await previewHtml(html, "malicious.html");

    expect(draft.assets).toHaveLength(0);
    expect(draft.counts.images).toBe(0);
    expect(
      draft.warnings.some((w) =>
        w.toLowerCase().includes("active content and embedded scripts were removed"),
      ),
    ).toBe(true);
    expect(
      draft.warnings.some((w) => w.toLowerCase().includes("remote image")),
    ).toBe(true);

    const text = draft.project.entries[0].text;
    expect(text).toContain("Safe paragraph text");
    expect(text).not.toContain("window.__pwned");
    expect(text).not.toContain("steal");

    expect(() => validateProject(draft.project)).not.toThrow();
  });

  it("rejects HTML documents exceeding MAX_DOM_DEPTH (100)", async () => {
    const deeplyNested = "<div>".repeat(105) + "Too deep" + "</div>".repeat(105);
    await expect(previewHtml(deeplyNested, "deep.html")).rejects.toThrow(
      /deeply nested/i,
    );
  });
});

describe("Security Defenses and Import Limits", () => {
  it("rejects encrypted / password-protected DOCX before inflation", async () => {
    const bytes = loadFixture("encrypted.docx");
    await expect(previewDocx(bytes, "encrypted.docx")).rejects.toThrow(
      /Password-protected or encrypted/i,
    );
  });

  it("rejects ZIP archives with directory traversal paths (path-traversal.docx)", async () => {
    const bytes = loadFixture("path-traversal.docx");
    await expect(previewDocx(bytes, "path-traversal.docx")).rejects.toThrow(
      /unsafe path traversal/i,
    );
  });

  it("rejects ZIP bombs claiming uncompressed size exceeding limits", async () => {
    const bytes = loadFixture("zip-bomb.docx");
    await expect(previewDocx(bytes, "zip-bomb.docx")).rejects.toThrow(
      /exceeds maximum uncompressed size|total uncompressed size exceeds 100MB limit|potential zip bomb/i,
    );
  });

  it("rejects files larger than MAX_DOCX_COMPRESSED_BYTES (20MB)", async () => {
    const bigBuf = new ArrayBuffer(MAX_DOCX_COMPRESSED_BYTES + 1);
    await expect(previewDocx(bigBuf, "huge.docx")).rejects.toThrow(/exceeds 20MB/i);
  });

  it("rejects ZIP archives exceeding MAX_ZIP_ENTRIES (2000)", () => {
    const minBuf = Buffer.from(loadFixture("minimal.docx"));
    const view = new DataView(minBuf.buffer, minBuf.byteOffset, minBuf.byteLength);
    for (let i = minBuf.byteLength - 22; i >= 0; i--) {
      if (
        minBuf[i] === 0x50 &&
        minBuf[i + 1] === 0x4b &&
        minBuf[i + 2] === 0x05 &&
        minBuf[i + 3] === 0x06
      ) {
        view.setUint16(i + 10, MAX_ZIP_ENTRIES + 1, true);
        break;
      }
    }
    expect(() => validateZipContainer(minBuf)).toThrow(
      /exceeds maximum entry count of 2000/i,
    );
  });

  it("rejects XML with XXE DOCTYPE external entity declaration", () => {
    const maliciousXml = `<?xml version="1.0"?>
    <!DOCTYPE foo [ <!ENTITY xxe SYSTEM "http://malicious.invalid/leak"> ]>
    <w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
      <w:body><w:p><w:r><w:t>&xxe;</w:t></w:r></w:p></w:body>
    </w:document>`;
    expect(() => validateXmlSafe(maliciousXml)).toThrow(/forbidden external entity/i);
  });

  it("aborts parsing when AbortSignal is triggered", async () => {
    const controller = new AbortController();
    controller.abort();
    const bytes = loadFixture("minimal.docx");
    await expect(
      previewDocx(bytes, "minimal.docx", { signal: controller.signal }),
    ).rejects.toThrow(/aborted/i);
  });
});

describe("Unified Dispatcher (previewWriting)", () => {
  it("routes .docx to previewDocx", async () => {
    const bytes = loadFixture("minimal.docx");
    const draft = await previewWriting(bytes, "minimal.docx");
    expect(draft.format).toBe("DOCX");
  });

  it("routes .html to previewHtml", async () => {
    const htmlBytes = fs.readFileSync(path.join(FIXTURES_DIR, "rich-sample.html"));
    const draft = await previewWriting(htmlBytes.buffer, "rich-sample.html");
    expect(draft.format).toBe("HTML");
  });

  it("routes .md to manuscript preview wrapped in ImportDraft", async () => {
    const md = "# Title\n\nA markdown paragraph.";
    const mdBytes = new TextEncoder().encode(md).buffer;
    const draft = await previewWriting(mdBytes, "sample.md");
    expect(draft.format).toBe("Markdown");
    expect(draft.counts.paragraphs).toBeGreaterThanOrEqual(1);
    expect(draft.assets).toHaveLength(0);
  });
});

describe("DOCX image accounting (Gate B F3)", () => {
  const PNG_1x1 = Uint8Array.from(
    atob(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
    ),
    (c) => c.charCodeAt(0),
  );
  // Same picture plus one trailing byte: a different file hash, still a valid 1x1 PNG header.
  const OTHER_PNG = Uint8Array.from([...PNG_1x1, 0]);

  const drawing = (rId: string, n: number) => `<w:p><w:r><w:drawing><wp:inline>
    <wp:extent cx="95250" cy="95250"/><wp:docPr id="${n}" name="Picture ${n}" descr="Picture ${n}"/>
    <a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic><pic:blipFill>
      <a:blip r:embed="${rId}"/>
    </pic:blipFill></pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r></w:p>`;

  async function buildDocx(
    body: string,
    media: { rId: string; file: string; bytes: Uint8Array }[],
  ): Promise<ArrayBuffer> {
    const zip = new JSZip();
    zip.file(
      "[Content_Types].xml",
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Default Extension="png" ContentType="image/png"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`,
    );
    zip.file(
      "_rels/.rels",
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`,
    );
    zip.file(
      "word/_rels/document.xml.rels",
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
${media
  .map(
    (m) =>
      `  <Relationship Id="${m.rId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/${m.file}"/>`,
  )
  .join("\n")}
</Relationships>`,
    );
    for (const m of media) zip.file(`word/media/${m.file}`, m.bytes);
    zip.file(
      "word/document.xml",
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"
            xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"
            xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing"
            xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"
            xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture">
  <w:body>${body}</w:body>
</w:document>`,
    );
    return zip.generateAsync({ type: "arraybuffer" });
  }

  const imageNodes = (draft: Awaited<ReturnType<typeof previewDocx>>) =>
    (draft.project.entries[0].content.content ?? []).filter((n) => n.type === "image");

  it("counts a picture shown twice as two images while staging its file once", async () => {
    const buf = await buildDocx(drawing("rId2", 1) + drawing("rId2", 2), [
      { rId: "rId2", file: "image1.png", bytes: PNG_1x1 },
    ]);
    const draft = await previewDocx(buf, "twice.docx");

    const nodes = imageNodes(draft);
    expect(nodes).toHaveLength(2);
    expect(nodes[0].attrs?.assetId).toBe(nodes[1].attrs?.assetId);
    expect(draft.assets).toHaveLength(1);
    expect(draft.counts.images).toBe(2);
  });

  it("does not stage embedded media that no drawing references, and says so", async () => {
    const buf = await buildDocx(drawing("rId2", 1), [
      { rId: "rId2", file: "image1.png", bytes: PNG_1x1 },
      { rId: "rId3", file: "image2.png", bytes: OTHER_PNG },
    ]);
    const draft = await previewDocx(buf, "orphan.docx");

    expect(imageNodes(draft)).toHaveLength(1);
    expect(draft.counts.images).toBe(1);
    expect(draft.assets).toHaveLength(1);
    expect(draft.assets[0].id).toBe(imageNodes(draft)[0].attrs?.assetId);
    expect(
      draft.warnings.some((w) => w.includes("image2.png") && /not used/i.test(w)),
    ).toBe(true);
  });
});
