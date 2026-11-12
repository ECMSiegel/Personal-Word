import { saveExport, safeFilename, type ExportProject } from "./document";
import { projectMarkdown, projectPlainText } from "./textExport";
import { storage } from "../storage";
import { collectAssetIds } from "../assets/assets";
import type { AssetId, PendingAsset } from "../assets/types";

export type ExportFormat =
  | "docx"
  | "pdf"
  | "markdown"
  | "markdown-bundle"
  | "plain";

/** Short name used in "<name> exported." messages. */
export const exportFormatLabel: Record<ExportFormat, string> = {
  docx: "DOCX",
  pdf: "PDF",
  markdown: "Markdown",
  "markdown-bundle": "Markdown bundle",
  plain: "Plain text",
};

export async function collectAndResolveAssets(
  project: ExportProject,
): Promise<Map<AssetId, PendingAsset>> {
  const ids = collectAssetIds(project);
  const assets = new Map<AssetId, PendingAsset>();
  for (const id of ids) {
    try {
      const asset = await storage.readAsset(project.id, id);
      assets.set(id, asset);
    } catch {
      throw new Error(
        `An image is missing from this export (asset ${id.slice(0, 12) || "unknown"}). Restore the image or remove it from the document before exporting.`,
      );
    }
  }
  return assets;
}

/** Builds the chosen export and hands it to the save dialog (or download).
 * Resolves "canceled" when the user dismisses the dialog; throws an Error with
 * a readable message on failure. */
export async function exportProject(
  project: ExportProject,
  format: ExportFormat,
): Promise<"saved" | "canceled"> {
  const assets = await collectAndResolveAssets(project);
  let blob: Blob;
  let name: string;
  if (format === "docx") {
    blob = await (await import("./docx")).exportDocx(project, assets);
    name = `${safeFilename(project.title)}.docx`;
  } else if (format === "pdf") {
    blob = await (await import("./pdf")).exportPdf(project, undefined, assets);
    name = `${safeFilename(project.title)}.pdf`;
  } else if (format === "markdown-bundle") {
    const { exportMarkdownBundle } = await import("./markdownBundle");
    blob = await exportMarkdownBundle(project, assets);
    name = `${safeFilename(project.title || "Untitled")}-markdown.zip`;
  } else {
    const markdown = format === "markdown";
    blob = new Blob(
      [markdown ? projectMarkdown(project, assets) : projectPlainText(project, assets)],
      {
        type: markdown
          ? "text/markdown;charset=utf-8"
          : "text/plain;charset=utf-8",
      },
    );
    name = `${safeFilename(project.title)}.${markdown ? "md" : "txt"}`;
  }
  return (await saveExport(blob, name)) ? "saved" : "canceled";
}
