import { describe, expect, it, vi } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ProjectLibrary } from "./components/ProjectLibrary";
import type { Summary } from "./model";

const noop = vi.fn();
function html(projects: Summary[]) {
  (globalThis as any).window = {
    localStorage: { getItem: () => null, setItem: () => {}, removeItem: () => {} },
  };
  return renderToStaticMarkup(
    React.createElement(ProjectLibrary, {
      projects,
      onCreate: noop,
      onOpen: noop,
      onDelete: noop,
      onImport: noop,
      onImportWriting: noop,
      damagedJournals: [],
      onExportJournal: noop,
      onDiscardJournal: noop,
      damagedFolders: [],
      path: "",
      onSetAside: noop,
      dropEnabled: false,
      onDropError: noop,
    }),
  );
}
const base = { title: "Essay", createdAt: "2026-11-01T00:00:00.000Z", updatedAt: "2026-11-04T00:00:00.000Z" };
const id = "11111111-1111-4111-8111-111111111111";

describe("project row counts", () => {
  it("shows words and sections between Edited and Added", () => {
    const out = html([{ ...base, id, wordCount: 12400, sectionCount: 6 }]);
    expect(out).toMatch(/Edited[^<]*<\/span><span class="project-words">12,400 words<\/span><span class="project-sections">6 sections<\/span><span>Added/);
  });
  it("uses singular forms", () => {
    const out = html([{ ...base, id, wordCount: 1, sectionCount: 1 }]);
    expect(out).toContain(">1 word<");
    expect(out).toContain(">1 section<");
  });
  it("renders neither span when the counts are missing", () => {
    const out = html([{ ...base, id }]);
    expect(out).not.toContain("project-words");
    expect(out).not.toContain("project-sections");
  });
});
