import { useState, useEffect } from "react";
import {
  defaultDocumentSettings,
  pageNumberPositionOptions,
  type DocumentSettings,
} from "../research/types";
import type { ExportProject } from "./document";
import {
  collectAndResolveAssets,
  exportProject,
  exportFormatLabel,
  type ExportFormat,
} from "./exportActions";
import { Dropdown } from "../components/Dropdown";
import "../research/research.css";

export function ExportPanel({
  project,
  onSettingsChange,
}: {
  project: ExportProject;
  onSettingsChange?: (s: DocumentSettings) => void;
}) {
  const [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  const [preview, setPreview] = useState("");
  useEffect(
    () => () => {
      if (preview) URL.revokeObjectURL(preview);
    },
    [preview],
  );
  const s = { ...defaultDocumentSettings, ...project.documentSettings };
  async function save(format: ExportFormat) {
    setBusy(true);
    setMessage("");
    try {
      const result = await exportProject(project, format);
      setMessage(
        result === "saved"
          ? `${exportFormatLabel[format]} exported.`
          : "Export canceled.",
      );
    } catch (e) {
      setMessage(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <section
      className="research-panel settings-section stack gap-4"
      aria-label="Export document"
    >
      <h2>Export document</h2>
      <p className="settings-help">
        Exports include writing sections in project order, footnotes, fragments,
        research notes, and the optional source bibliography.
      </p>
      <p className="settings-help">
        DOCX preserves editable Word footnotes. PDF uses its own pagination with
        notes at the bottom of each page. Export pagination is independent of
        editor page view, so page breaks and line wraps can differ. PDF embeds
        the document font when it is a single font file that allows embedding;
        collection, restricted or missing fonts (Futura is a collection), and
        all notes and the bibliography, use bundled Noto font subsets. PDF
        covers Latin, Latin Extended, Greek, and Cyrillic; other scripts are
        rejected and DOCX is the alternative. A footnote that cannot fit on one
        page is reported instead of truncated.
      </p>
      {onSettingsChange && (
        <>
          <div className="settings-form stack gap-3">
            <label className="settings-field row gap-3">
              <span className="settings-label">Export typeface</span>
              <Dropdown
                label="Export typeface"
                value={s.font}
                onChange={(font) => onSettingsChange({ ...s, font })}
                options={[
                  { value: "serif", label: "Times New Roman" },
                  { value: "sans", label: "Sans (Arial in Word, Noto Sans in PDF)" },
                  { value: "mono", label: "Courier New" },
                ]}
              />
            </label>
            <label className="settings-field row gap-3">
              <span className="settings-label">Font size</span>
              <input
                type="number"
                min="8"
                max="36"
                value={s.fontSize}
                onChange={(e) =>
                  onSettingsChange({
                    ...s,
                    fontSize: Math.min(
                      36,
                      Math.max(8, Number(e.target.value) || 12),
                    ),
                  })
                }
              />
            </label>
            <label className="settings-field row gap-3">
              <span className="settings-label">Line spacing</span>
              <Dropdown
                label="Line spacing"
                value={String(s.lineSpacing)}
                onChange={(value) =>
                  onSettingsChange({ ...s, lineSpacing: Number(value) })
                }
                options={[
                  { value: "1", label: "Single" },
                  { value: "1.5", label: "1.5" },
                  { value: "2", label: "Double" },
                ]}
              />
            </label>
            <label className="settings-field row gap-3">
              <span className="settings-label">Margins (inches)</span>
              <input
                type="number"
                min="0.5"
                max="2"
                step="0.25"
                value={s.marginInches}
                onChange={(e) =>
                  onSettingsChange({
                    ...s,
                    marginInches: Math.min(
                      2,
                      Math.max(0.5, Number(e.target.value) || 1),
                    ),
                  })
                }
              />
            </label>
          </div>
          <div className="settings-checks stack gap-2">
            {(["firstLineIndent", "bibliography", "pageNumbers"] as const).map(
              (key) => (
                <label className="settings-check cluster gap-2" key={key}>
                  <input
                    type="checkbox"
                    checked={s[key]}
                    onChange={(e) =>
                      onSettingsChange({ ...s, [key]: e.target.checked })
                    }
                  />
                  {key === "firstLineIndent"
                    ? "Half-inch paragraph indent"
                    : key === "bibliography"
                      ? "Include bibliography"
                      : "Page numbers"}
                </label>
              ),
            )}
          </div>
          <div className="settings-form stack gap-3">
            <label className="settings-field row gap-3">
              <span className="settings-label">Page header text</span>
              <input
                type="text"
                aria-label="Page header text"
                maxLength={60}
                value={s.pageHeaderText ?? ""}
                onChange={(e) =>
                  onSettingsChange({ ...s, pageHeaderText: e.target.value })
                }
              />
            </label>
          </div>
          <div className="settings-checks stack gap-2">
            <label className="settings-check cluster gap-2">
              <input
                type="checkbox"
                checked={!!s.pageFirstDifferent}
                onChange={(e) =>
                  onSettingsChange({ ...s, pageFirstDifferent: e.target.checked })
                }
              />
              Different first page
            </label>
          </div>
          {(s.pageNumbers || !!s.pageHeaderText?.trim()) && (
            <div className="settings-form stack gap-3">
              <label className="settings-field row gap-3">
                <span className="settings-label">Page number position</span>
                <Dropdown
                  label="Page number position"
                  value={s.pageNumberPosition ?? "bottom-right"}
                  onChange={(pageNumberPosition) =>
                    onSettingsChange({ ...s, pageNumberPosition })
                  }
                  options={pageNumberPositionOptions}
                />
              </label>
            </div>
          )}
        </>
      )}
      <div className="settings-actions cluster gap-2">
        <button
          className="settings-button"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            setMessage("");
            try {
              const assets = await collectAndResolveAssets(project);
              const blob = await (await import("./pdf")).exportPdf(
                project,
                undefined,
                assets,
              );
              setPreview(URL.createObjectURL(blob));
            } catch (e) {
              setMessage(e instanceof Error ? e.message : String(e));
            } finally {
              setBusy(false);
            }
          }}
        >
          Preview PDF
        </button>
        <button
          className="settings-button button-primary"
          disabled={busy}
          onClick={() => save("docx")}
        >
          Export DOCX
        </button>
        <button
          className="settings-button"
          disabled={busy}
          onClick={() => save("markdown")}
        >
          Export Markdown
        </button>
        <button
          className="settings-button"
          disabled={busy}
          onClick={() => save("markdown-bundle")}
        >
          Markdown with images (.zip)
        </button>
        <button
          className="settings-button"
          disabled={busy}
          onClick={() => save("plain")}
        >
          Export plain text
        </button>
        <button
          className="settings-button"
          disabled={busy}
          onClick={() => save("pdf")}
        >
          Export PDF
        </button>
        {preview && (
          <button
            className="settings-text-action"
            onClick={() => setPreview("")}
          >
            Close preview
          </button>
        )}
      </div>
      {preview && (
        <iframe
          className="export-preview"
          title="PDF export preview"
          src={preview}
        />
      )}
      <p className="settings-status" role="status">
        {busy ? "Preparing export…" : message}
      </p>
    </section>
  );
}
