import { describe, it, expect } from "vitest";
import {
  changedSettings,
  editorSettings,
  exportSettings,
} from "./documentSettingsDefaults";
import { defaultDocumentSettings } from "./types";

describe("document settings fallbacks", () => {
  it("keeps the two looks apart and merges per key", () => {
    expect(exportSettings(undefined)).toEqual(defaultDocumentSettings);
    expect(editorSettings(undefined)).toMatchObject({ font: "sans", fontSize: 14, lineSpacing: 1.5, firstLineIndent: false, marginInches: 1 });
    const stored = { pageNumbers: false };
    expect(exportSettings(stored).font).toBe("serif");
    expect(editorSettings(stored).font).toBe("sans");
    expect(exportSettings(stored).pageNumbers).toBe(false);
    expect(editorSettings(stored).pageNumbers).toBe(false);
  });
  it("changedSettings keeps only the differing keys", () => {
    expect(changedSettings(defaultDocumentSettings, { ...defaultDocumentSettings, fontSize: 11 })).toEqual({ fontSize: 11 });
  });
  it("survives a JSON round trip as a partial object", () => {
    expect(JSON.parse(JSON.stringify({ pageNumbers: true }))).toEqual({ pageNumbers: true });
  });
});

import { newProject, validateProject } from "../model";

it("a partial documentSettings survives project validation and JSON", () => {
  const p = newProject("Partial");
  p.documentSettings = { pageNumbers: false };
  validateProject(p);
  const copy = JSON.parse(JSON.stringify(p));
  validateProject(copy);
  expect(copy.documentSettings).toEqual({ pageNumbers: false });
});
