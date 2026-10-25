import { useState, useEffect } from "react";
import {
  defaultDocumentSettings,
  type DocumentSettings,
} from "../research/types";
import { saveExport, safeFilename, type ExportProject } from "./document";
import { projectMarkdown, projectPlainText } from "./textExport";
import { Dropdown } from "../components/Dropdown";
import { storage } from "../storage";
import { collectAssetIds } from "../assets/assets";
import type { AssetId, PendingAsset } from "../assets/types";
import "../research/research.css";

async function collectAndResolveAssets(
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
      const assets = await collectAndResolveAssets(project);
      const blob =
        format === "docx"
          ? await (await import("./docx")).exportDocx(project, assets)
          : await (await import("./pdf")).exportPdf(project, undefined, assets);
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
  async function saveText(format: "markdown" | "plain") {
    setBusy(true);
    setMessage("");
    try {
      const assets = await collectAndResolveAssets(project);
      const markdown = format === "markdown";
      const blob = new Blob(
        [markdown ? projectMarkdown(project, assets) : projectPlainText(project, assets)],
        {
          type: markdown
            ? "text/markdown;charset=utf-8"
            : "text/plain;charset=utf-8",
        },
      );
      const saved = await saveExport(
        blob,
        `${safeFilename(project.title)}.${markdown ? "md" : "txt"}`,
      );
      setMessage(
        saved
          ? `${markdown ? "Markdown" : "Plain text"} exported.`
          : "Export canceled.",
      );
    } catch (e) {
      setMessage(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }
  async function saveMarkdownBundle() {
    setBusy(true);
    setMessage("");
    try {
      const assets = await collectAndResolveAssets(project);
      const { exportMarkdownBundle } = await import("./markdownBundle");
      const blob = await exportMarkdownBundle(project, assets);
      const saved = await saveExport(
        blob,
        `${safeFilename(project.title || "Untitled")}-markdown.zip`,
      );
      setMessage(
        saved
          ? "Markdown bundle exported."
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
      className="research-panel settings-section"
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
        editor page view, so page breaks and line wraps can differ. PDF draws
        with bundled Noto font subsets instead of the selected document font and
        covers Latin, Latin Extended, Greek, and Cyrillic; other scripts are
        rejected and DOCX is the alternative. A footnote that cannot fit on one
        page is reported instead of truncated.
      </p>
      {onSettingsChange && (
        <>
          <div className="settings-form">
            <label className="settings-field">
              <span className="settings-label">Export typeface</span>
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
            <label className="settings-field">
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
            <label className="settings-field">
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
            <label className="settings-field">
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
          <div className="settings-checks">
            {(["firstLineIndent", "bibliography", "pageNumbers"] as const).map(
              (key) => (
                <label className="settings-check" key={key}>
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
        </>
      )}
      <div className="settings-actions">
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
          onClick={() => saveText("markdown")}
        >
          Export Markdown
        </button>
        <button
          className="settings-button"
          disabled={busy}
          onClick={() => saveMarkdownBundle()}
        >
          Markdown with images (.zip)
        </button>
        <button
          className="settings-button"
          disabled={busy}
          onClick={() => saveText("plain")}
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
