import { useState, type ClipboardEvent } from "react";
import { Dropdown } from "../components/Dropdown";
import { ModalFrame } from "../app/ProjectDialogs";
import { pasteIntoQuote, quoteTextForStorage } from "./quoteText";
import type { Source } from "./types";

export function CaptureQuote({ sources, initialSourceId, onCancel, onSave }: {
  sources: Source[];
  initialSourceId?: string;
  onCancel: () => void;
  onSave: (quote: { sourceId: string; text: string; locator?: string }, insert: boolean) => void;
}) {
  const [sourceId, setSourceId] = useState(initialSourceId ?? "");
  const [text, setText] = useState("");
  const [locator, setLocator] = useState("");
  const valid = Boolean(sourceId && text.trim());
  const save = (insert: boolean) => {
    if (valid) onSave({ sourceId, text: quoteTextForStorage(text), locator: locator.trim() || undefined }, insert);
  };
  const paste = (event: ClipboardEvent<HTMLTextAreaElement>) => {
    event.preventDefault();
    const input = event.currentTarget;
    const { text: updated, caret } = pasteIntoQuote(
      text,
      input.selectionStart,
      input.selectionEnd,
      event.clipboardData.getData("text"),
    );
    setText(updated);
    requestAnimationFrame(() => {
      if (input.isConnected) input.setSelectionRange(caret, caret);
    });
  };
  return <ModalFrame title="Capture quote" onCancel={onCancel}>
    <div className="field"><span className="field-label">Source</span><Dropdown<string> label="Source" value={sourceId} width="100%" options={[{ value: "", label: "Choose a source" }, ...sources.map((source) => ({ value: source.id, label: `${source.authors[0] ?? "No author"} -- ${source.title || "Untitled source"}` }))]} onChange={setSourceId} /></div>
    <div className="field"><label htmlFor="capture-quote-text">Quotation</label><textarea id="capture-quote-text" rows={5} value={text} onChange={(event) => setText(event.target.value)} onPaste={paste} /></div>
    <div className="field"><label htmlFor="capture-quote-page">Page</label><input id="capture-quote-page" value={locator} onChange={(event) => setLocator(event.target.value)} /></div>
    <div className="dialog-actions"><button type="button" onClick={onCancel}>Cancel</button><button type="button" disabled={!valid} onClick={() => save(false)}>Save to source</button><button type="button" className="primary" disabled={!valid} onClick={() => save(true)}>Save and insert</button></div>
  </ModalFrame>;
}
