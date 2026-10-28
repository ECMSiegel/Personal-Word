import { useEffect, useState } from "react";
import { storage } from "../storage";
import type { Source } from "./types";

export function PdfPane({ projectId, source }: { projectId: string; source: Source }) {
  const [url, setUrl] = useState<string | null>(null);
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    let disposed = false;
    let objectUrl: string | null = null;
    setUrl(null);
    setMissing(false);
    if (!source.pdf) {
      setMissing(true);
      return;
    }
    void storage.readPdf(projectId, source.pdf.assetId).then((pdf) => {
      if (disposed) return;
      const bytes = new ArrayBuffer(pdf.bytes.byteLength);
      new Uint8Array(bytes).set(pdf.bytes);
      objectUrl = URL.createObjectURL(new Blob([bytes], { type: "application/pdf" }));
      setUrl(objectUrl);
    }).catch(() => {
      if (!disposed) setMissing(true);
    });
    return () => {
      disposed = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [projectId, source.pdf?.assetId]);

  if (missing) return <p role="alert">This PDF is not stored in this project.</p>;
  return url ? <iframe className="pdf-pane-frame" title={`PDF: ${source.pdf?.name ?? "source"}`} src={url} /> : <p className="pdf-pane-loading">Loading PDF…</p>;
}
