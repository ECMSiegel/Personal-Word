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
      listed: true,
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

// OB2: cells hold values only (the header labels them), in column order Edited, Words, Sections,
// Added; each keeps its full phrase as its label.
describe("project row counts", () => {
  it("renders edited, words, sections and added cells in that DOM order", () => {
    const out = html([{ ...base, id, wordCount: 12400, sectionCount: 6 }]);
    expect(out).toMatch(
      /<span class="outline-cell col-edited" aria-label="Edited [^"]*">[^<]*<\/span><span class="outline-cell col-words" aria-label="12,400 words">12,400<\/span><span class="outline-cell col-sections" aria-label="6 sections">6<\/span><span class="outline-cell col-added" aria-label="Added [^"]*">[^<]*<\/span>/,
    );
  });
  it("uses singular forms", () => {
    const out = html([{ ...base, id, wordCount: 1, sectionCount: 1 }]);
    expect(out).toContain('aria-label="1 word">1<');
    expect(out).toContain('aria-label="1 section">1<');
  });
  it("leaves the cells empty and unlabelled when the counts are missing", () => {
    const out = html([{ ...base, id }]);
    expect(out).toContain('<span class="outline-cell col-words"></span>');
    expect(out).toContain('<span class="outline-cell col-sections"></span>');
  });
});
