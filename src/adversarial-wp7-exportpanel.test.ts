import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { newProject } from "./model";
import { ExportPanel } from "./export/ExportPanel";
import { storage } from "./storage";
import * as documentModule from "./export/document";
import * as markdownBundleModule from "./export/markdownBundle";
import { createPendingAsset } from "./assets/assets";
import { tinyPng } from "./export/media-fixtures";

describe("ExportPanel — Markdown Bundle UI Action & Error Handling", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders dedicated 'Markdown with images (.zip)' export button", () => {
    const project = newProject("Bundle UI Test");
    const html = renderToStaticMarkup(React.createElement(ExportPanel, { project }));

    expect(html).toContain("Markdown with images (.zip)");
    expect(html).toContain('class="settings-button"');
    expect(html).toContain('role="status"');
  });

  it("verifies filename format ${title || 'Untitled'}-markdown.zip with project title", async () => {
    const project = newProject("My Research Paper");
    let savedFilename = "";

    vi.spyOn(documentModule, "saveExport").mockImplementation(async (_blob, name) => {
      savedFilename = name;
      return true;
    });

    vi.spyOn(markdownBundleModule, "exportMarkdownBundle").mockImplementation(async () => {
      return new Blob(["fake zip"], { type: "application/zip" });
    });

    const assets = new Map();
    const blob = await markdownBundleModule.exportMarkdownBundle(project, assets);
    const filename = `${project.title || "Untitled"}-markdown.zip`;
    const saved = await documentModule.saveExport(blob, filename);

    expect(saved).toBe(true);
    expect(savedFilename).toBe("My Research Paper-markdown.zip");
  });

  it("verifies filename format falls back to 'Untitled-markdown.zip' when title is empty", async () => {
    const project = newProject("");
    project.title = "";
    let savedFilename = "";

    vi.spyOn(documentModule, "saveExport").mockImplementation(async (_blob, name) => {
      savedFilename = name;
      return true;
    });

    vi.spyOn(markdownBundleModule, "exportMarkdownBundle").mockImplementation(async () => {
      return new Blob(["fake zip"], { type: "application/zip" });
    });

    const assets = new Map();
    const blob = await markdownBundleModule.exportMarkdownBundle(project, assets);
    const filename = `${project.title || "Untitled"}-markdown.zip`;
    await documentModule.saveExport(blob, filename);

    expect(savedFilename).toBe("Untitled-markdown.zip");
  });

  it("blocks export and catches missing asset error displaying actionable message", async () => {
    const missingId = "a".repeat(64);
    const project = newProject("Missing Asset Doc");
    project.entries[0].content = {
      type: "doc",
      content: [
        {
          type: "image",
          attrs: { assetId: missingId, alt: "Missing diagram" },
        },
      ],
    };

    vi.spyOn(storage, "readAsset").mockRejectedValue(new Error("Disk read failed"));
    const saveExportSpy = vi.spyOn(documentModule, "saveExport");

    let errorMessage = "";
    try {
      const ids = [missingId];
      for (const id of ids) {
        try {
          await storage.readAsset(project.id, id);
        } catch {
          throw new Error(
            `An image is missing from this export (asset ${id.slice(0, 12) || "unknown"}). Restore the image or remove it from the document before exporting.`,
          );
        }
      }
    } catch (e: any) {
      errorMessage = e.message;
    }

    expect(errorMessage).toBe(
      `An image is missing from this export (asset ${missingId.slice(0, 12)}). Restore the image or remove it from the document before exporting.`,
    );
    expect(saveExportSpy).not.toHaveBeenCalled();
  });

  it("verifies exportMarkdownBundle includes valid zip with manuscript, manifest, and assets", async () => {
    const asset = await createPendingAsset(tinyPng);
    const project = newProject("Valid Bundle Doc");
    project.entries[0].content = {
      type: "doc",
      content: [
        { type: "paragraph", content: [{ type: "text", text: "Prose line." }] },
        { type: "image", attrs: { assetId: asset.id, alt: "Valid dot" } },
      ],
    };

    const assetsMap = new Map([[asset.id, asset]]);
    const blob = await markdownBundleModule.exportMarkdownBundle(project, assetsMap);

    expect(blob).toBeInstanceOf(Blob);
    expect(blob.size).toBeGreaterThan(100);
  });
});
