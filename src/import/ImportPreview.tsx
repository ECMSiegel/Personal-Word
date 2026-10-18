import { useState } from "react";
import { ModalFrame } from "../app/ProjectDialogs";
import type { ManuscriptPreview } from "./manuscript";
export function ImportPreview({ preview, busy, onCancel, onImport }: { preview: ManuscriptPreview; busy: boolean; onCancel: () => void; onImport: (title: string) => void }) {
  const [title, setTitle] = useState(preview.project.title);
  return <ModalFrame title="Import writing" busy={busy} onCancel={onCancel}>
    <form onSubmit={(e) => { e.preventDefault(); if (title.trim() && !busy) onImport(title.trim()); }}>
      <p>{preview.filename} -- {preview.format}. Creates a new project; the original file stays unchanged.</p>
      <label>Project title<input value={title} onChange={(e) => setTitle(e.target.value)} /></label>
      {preview.warnings.length > 0 && <ul className="import-warnings">{preview.warnings.map((w) => <li key={w}>{w}</li>)}</ul>}
      <pre className="import-preview-text" aria-label="Writing preview">{preview.project.entries[0].text.slice(0, 2400) || "Empty document"}{preview.project.entries[0].text.length > 2400 ? "\n[Preview shortened; all writing will be imported.]" : ""}</pre>
      <div className="dialog-actions"><button type="button" disabled={busy} onClick={onCancel}>Cancel</button><button type="submit" className="primary" disabled={!title.trim() || busy}>{busy ? "Importing…" : "Import"}</button></div>
    </form>
  </ModalFrame>;
}
