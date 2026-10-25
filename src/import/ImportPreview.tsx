import { useState } from "react";
import { ModalFrame } from "../app/ProjectDialogs";
import type { ManuscriptPreview } from "./manuscript";
import type { ImportDraft, ImportDraftCounts } from "./importLimits";

export type { ImportDraft, ImportDraftCounts };

export function ImportPreview({
  preview,
  busy,
  onCancel,
  onImport,
}: {
  preview: ImportDraft | ManuscriptPreview;
  busy: boolean;
  onCancel: () => void;
  onImport: (title: string) => void;
}) {
  const [title, setTitle] = useState(preview.project.title);
  const counts = "counts" in preview ? preview.counts : undefined;

  return (
    <ModalFrame title="Import writing" busy={busy} onCancel={onCancel}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (title.trim() && !busy) onImport(title.trim());
        }}
      >
        <p>
          {preview.filename} -- {preview.format}. Creates a new project; the
          original file stays unchanged.
        </p>
        {"counts" in preview && counts && (
          <div className="import-counts-bar" aria-label="Document contents" style={{ display: "flex", gap: "8px", margin: "8px 0" }}>
            <span className="count-pill">{counts.paragraphs} paragraphs</span>
            {counts.images > 0 && (
              <span className="count-pill">
                {counts.images} {counts.images === 1 ? "image" : "images"}
              </span>
            )}
            {counts.tables > 0 && (
              <span className="count-pill">
                {counts.tables} {counts.tables === 1 ? "table" : "tables"}
              </span>
            )}
            {counts.notes > 0 && (
              <span className="count-pill">
                {counts.notes} {counts.notes === 1 ? "note" : "notes"}
              </span>
            )}
          </div>
        )}
        <label>
          Project title
          <input value={title} onChange={(e) => setTitle(e.target.value)} />
        </label>
        {preview.warnings.length > 0 && (
          <ul className="import-warnings">
            {preview.warnings.map((w) => (
              <li key={w}>{w}</li>
            ))}
          </ul>
        )}
        <pre className="import-preview-text" aria-label="Writing preview">
          {preview.project.entries[0]?.text.slice(0, 2400) || "Empty document"}
          {preview.project.entries[0]?.text.length > 2400
            ? "\n[Preview shortened; all writing will be imported.]"
            : ""}
        </pre>
        <div className="dialog-actions">
          <button type="button" disabled={busy} onClick={onCancel}>
            Cancel
          </button>
          <button
            type="submit"
            className="primary"
            disabled={!title.trim() || busy}
          >
            {busy ? "Importing…" : "Import"}
          </button>
        </div>
      </form>
    </ModalFrame>
  );
}

/**
 * Shown while a writing import is still reading/parsing. The import cannot be
 * previewed yet, so this dialog only offers cancellation; it aborts the parse
 * through the AbortSignal passed to previewWriting (Gate B finding F1 / T032).
 */
export function ImportBusy({
  filename,
  onCancel,
}: {
  filename: string;
  onCancel: () => void;
}) {
  return (
    <ModalFrame title="Importing writing" busy={false} onCancel={onCancel}>
      <p>
        {filename} -- reading and parsing the file. Nothing is saved until you
        review and confirm the import.
      </p>
      <div className="dialog-actions">
        <button type="button" onClick={onCancel} autoFocus>
          Cancel import
        </button>
      </div>
    </ModalFrame>
  );
}
