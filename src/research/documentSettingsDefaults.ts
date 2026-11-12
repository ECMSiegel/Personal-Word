import { defaultPageLayout } from "../editor/formatting";
import { defaultDocumentSettings, type DocumentSettings } from "./types";

/**
 * A project may store only some document settings (the ones the owner changed).
 * The editor and the export fill the rest in differently on purpose, so that
 * changing one setting never changes how anything else looks.
 */
export type StoredDocumentSettings = Partial<DocumentSettings>;

/** What the editor shows for any setting a project has not stored. */
export const editorFallbackSettings: DocumentSettings = {
  ...defaultDocumentSettings,
  font: "sans",
  fontSize: 14,
  lineSpacing: 1.5,
  marginInches: defaultPageLayout.margin / 96,
  firstLineIndent: false,
};

export const editorSettings = (stored?: StoredDocumentSettings): DocumentSettings => ({
  ...editorFallbackSettings,
  ...stored,
});

/** What the PDF/Word export and the Export panel use for unstored settings. */
export const exportSettings = (stored?: StoredDocumentSettings): DocumentSettings => ({
  ...defaultDocumentSettings,
  ...stored,
});

/** Only the keys of `next` whose value differs from `before`. */
export function changedSettings(
  before: DocumentSettings,
  next: DocumentSettings,
): StoredDocumentSettings {
  const out: Record<string, unknown> = {};
  for (const key of Object.keys(next) as (keyof DocumentSettings)[]) {
    if (next[key] !== before[key]) out[key] = next[key];
  }
  return out as StoredDocumentSettings;
}
