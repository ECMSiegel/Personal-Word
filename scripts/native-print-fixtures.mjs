// Layout L1 probe helper, bundled by esbuild and run with Node by scripts/native-print-smoke.py.
//   fixtures <port> <canaryFileUrl> <out.json>   schema-generated print requests + expectations
//   tall <in.pdf> <out.pdf>                       negative control: every page stacked on one tall page
//   raster <out.pdf> <page.png>...                negative control: page images with no text
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { PDFDocument } from "pdf-lib";
import { buildProbeFixtures } from "../src/print/printProbe.ts";

const [mode, ...args] = process.argv.slice(2);

if (mode === "fixtures") {
  const [port, canaryFileUrl, out] = args;
  // The same OFL Noto Serif Latin subset the legacy exporter already bundles (THIRD_PARTY.md).
  const fontWoff = new Uint8Array(
    readFileSync(resolve("node_modules/@fontsource/noto-serif/files/noto-serif-latin-400-normal.woff")),
  );
  const fixtures = await buildProbeFixtures({ hostilePort: Number(port), canaryFileUrl, fontWoff });
  writeFileSync(out, JSON.stringify(fixtures));
  console.log(`wrote ${fixtures.length} fixtures to ${out}`);
} else if (mode === "tall") {
  const [input, out] = args;
  const source = await PDFDocument.load(readFileSync(input));
  const doc = await PDFDocument.create();
  const pages = await doc.embedPdf(source, source.getPageIndices());
  const width = Math.max(...pages.map((p) => p.width));
  const height = pages.reduce((sum, p) => sum + p.height, 0);
  const page = doc.addPage([width, height]);
  let top = height;
  for (const p of pages) {
    top -= p.height;
    page.drawPage(p, { x: 0, y: top });
  }
  writeFileSync(out, await doc.save());
  console.log(`wrote one ${width}x${height} page to ${out}`);
} else if (mode === "raster") {
  const [out, ...pngs] = args;
  const doc = await PDFDocument.create();
  for (const file of pngs) {
    const image = await doc.embedPng(readFileSync(file));
    const page = doc.addPage([612, 792]);
    page.drawImage(image, { x: 0, y: 0, width: 612, height: 792 });
  }
  writeFileSync(out, await doc.save());
  console.log(`wrote ${pngs.length} image-only pages to ${out}`);
} else {
  console.error("usage: fixtures <port> <canaryUrl> <out.json> | tall <in.pdf> <out.pdf> | raster <out.pdf> <png>...");
  process.exit(2);
}
