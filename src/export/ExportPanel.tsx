import { useState, useEffect } from "react";
import {
  defaultDocumentSettings,
  type DocumentSettings,
} from "../research/types";
import { saveExport, safeFilename, type ExportProject } from "./document";
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
  async function save(format: "docx" | "pdf") {
    setBusy(true);
    setMessage("");
    try {
      const blob =
        format === "docx"
          ? await (await import("./docx")).exportDocx(project)
          : await (await import("./pdf")).exportPdf(project);
      const saved = await saveExport(
        blob,
        `${safeFilename(project.title)}.${format}`,
      );
      if (!saved) {
        setMessage("Export canceled.");
        return;
      }
      setMessage(`${format.toUpperCase()} exported.`);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="research-panel" aria-label="Export document">
      <h2>Export document</h2>
      <p>
        Exports include writing sections in project order, footnotes, and the
        source bibliography. Fragments and research notes stay in the project.
      </p>
      <p>
        DOCX preserves editable Word footnotes. PDF uses its own pagination with
        notes at the bottom of each page. Page breaks and line wraps can differ
        from the editor and Word. PDF currently supports Latin text; DOCX
        supports Unicode.
      </p>
      {onSettingsChange && (
        <div className="research-form">
          <label>
            Export typeface
            <Dropdown
              label="Export typeface"
              value={s.font}
              onChange={(font) => onSettingsChange({ ...s, font })}
              options={[
                { value: "serif", label: "Times New Roman" },
                { value: "sans", label: "Arial" },
                { value: "mono", label: "Courier New" },
              ]}
            />
          </label>
          <label>
            Font size
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
          <label>
            Line spacing
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
          <label>
            Margins (inches)
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
          {(["firstLineIndent", "bibliography", "pageNumbers"] as const).map(
            (key) => (
              <label key={key}>
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
      )}
      <button
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          try {
            const blob = await (await import("./pdf")).exportPdf(project);
            setPreview(URL.createObjectURL(blob));
          } catch (e) {
            setMessage(String(e));
          } finally {
            setBusy(false);
          }
        }}
      >
        Preview PDF
      </button>
      {preview && (
        <>
          <button onClick={() => setPreview("")}>Close preview</button>
          <iframe
            className="export-preview"
            title="PDF export preview"
            src={preview}
          />
        </>
      )}
      <button disabled={busy} onClick={() => save("docx")}>
        Export DOCX
      </button>{" "}
      <button disabled={busy} onClick={() => save("pdf")}>
        Export PDF
      </button>
      <p role="status">{busy ? "Preparing export…" : message}</p>
    </section>
  );
}
