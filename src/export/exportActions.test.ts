import { describe, expect, it, vi, beforeEach } from "vitest";

const saveExport = vi.fn<(blob: Blob, name: string) => Promise<boolean>>();
const mockedAssets = vi.hoisted(() => ({ missing: false }));
vi.mock("./document", async (original) => ({
  ...(await original<typeof import("./document")>()),
  saveExport: (blob: Blob, name: string) => saveExport(blob, name),
}));
vi.mock("../assets/assets", () => ({
  collectAssetIds: () =>
    mockedAssets.missing ? ["asset-123456789abc"] : [],
}));
vi.mock("../storage", () => ({
  storage: {
    readAsset: async () => {
      if (mockedAssets.missing) throw new Error("asset unavailable");
      throw new Error("Unexpected asset read");
    },
  },
}));

import { exportProject } from "./exportActions";
import type { ExportProject as Project } from "./document";

const project = {
  id: "p1",
  title: "My Project",
  entries: [],
  order: [],
} as unknown as Project;

describe("exportProject", () => {
  beforeEach(() => {
    saveExport.mockReset();
    mockedAssets.missing = false;
  });

  it("resolves canceled when the save dialog is dismissed", async () => {
    saveExport.mockResolvedValue(false);
    await expect(exportProject(project, "plain")).resolves.toBe("canceled");
  });

  it("resolves saved and names the file for the project", async () => {
    saveExport.mockResolvedValue(true);
    await expect(exportProject(project, "markdown")).resolves.toBe("saved");
    expect(saveExport.mock.calls[0][1]).toBe("My Project.md");
    await exportProject(project, "plain");
    expect(saveExport.mock.calls[1][1]).toBe("My Project.txt");
  });

  it("reports a readable missing-asset error before opening the save dialog", async () => {
    mockedAssets.missing = true;
    await expect(exportProject(project, "plain")).rejects.toThrow(
      /An image is missing from this export/,
    );
    expect(saveExport).not.toHaveBeenCalled();
  });
});
