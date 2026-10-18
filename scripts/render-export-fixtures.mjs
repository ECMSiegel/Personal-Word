import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createServer } from "vite";

const output = resolve("test-results/export-fixtures");
await mkdir(output, { recursive: true });
const server = await createServer({
  configFile: false,
  server: { middlewareMode: true, hmr: false },
  appType: "custom",
});
try {
  const [{ createExportFixture }, { exportDocx }, { exportPdf }] =
    await Promise.all([
      server.ssrLoadModule("/src/export/export-fixtures.ts"),
      server.ssrLoadModule("/src/export/docx.ts"),
      server.ssrLoadModule("/src/export/pdf.ts"),
    ]);
  const project = createExportFixture();
  const [docx, pdf] = await Promise.all([
    exportDocx(project),
    exportPdf(project),
  ]);
  await Promise.all([
    writeFile(
      resolve(output, "export-fixture.docx"),
      new Uint8Array(await docx.arrayBuffer()),
    ),
    writeFile(
      resolve(output, "export-fixture.pdf"),
      new Uint8Array(await pdf.arrayBuffer()),
    ),
  ]);
  process.stdout.write(`Wrote synthetic DOCX and PDF fixtures to ${output}\n`);
} finally {
  await server.close();
}
