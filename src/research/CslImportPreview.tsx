import { ModalFrame } from "../app/ProjectDialogs";
import type { CslImportResult } from "./cslImport";

export function CslImportPreview({ result, busy = false, onCancel, onAdd }: {
  result: CslImportResult;
  busy?: boolean;
  onCancel: () => void;
  onAdd: () => void;
}) {
  const skipped = Object.entries(result.skipped);
  return <ModalFrame title="Import Zotero sources" busy={busy} onCancel={onCancel}>
    <p>{result.sources.length} sources to add</p>
    {skipped.length > 0 && <div><p>Unsupported items skipped:</p><ul>{skipped.map(([type, count]) => <li key={type}>{count} {type}</li>)}</ul></div>}
    {result.duplicates > 0 && <p>{result.duplicates} duplicates skipped.</p>}
    {result.warnings.length > 0 && <ul>{result.warnings.map((warning, i) => <li key={i}>{warning}</li>)}</ul>}
    <ol aria-label="Source preview">{result.sources.slice(0, 10).map((source, i) => <li key={i}>{source.title}</li>)}</ol>
    <div className="dialog-actions"><button type="button" disabled={busy} onClick={onCancel}>Cancel</button><button type="button" className="primary" disabled={busy || result.sources.length === 0} onClick={onAdd}>{busy ? "Adding…" : "Add sources"}</button></div>
  </ModalFrame>;
}
