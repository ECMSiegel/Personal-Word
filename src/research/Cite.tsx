import type { ReactNode } from "react";
import type { CitationPart } from "./citations";

export function Cite({ parts }: { parts: CitationPart[] }) {
  return <>{parts.map((part, index) => part.italic ? <em key={index}>{part.text}</em> : <span key={index}>{part.text}</span>)}</>;
}

export function Preview({ label, parts }: { label: string; parts: CitationPart[] }) {
  return <div className="preview"><span className="field-label">{label}</span><p className="citation-preview"><Cite parts={parts} /></p></div>;
}

export function Field({ id, label, value, onChange, help, wide, multiline, placeholder }: {
  id: string; label: string; value: string; onChange: (value: string) => void;
  help?: string; wide?: boolean; multiline?: boolean; placeholder?: string;
}): ReactNode {
  const describedBy = help ? `${id}-help` : undefined;
  return <div className={"field" + (wide ? " is-wide" : "")}>
    <label htmlFor={id}>{label}</label>
    {multiline ? <textarea id={id} rows={3} value={value} placeholder={placeholder} aria-describedby={describedBy} onChange={(e) => onChange(e.target.value)} /> :
      <input id={id} type="text" value={value} placeholder={placeholder} aria-describedby={describedBy} onChange={(e) => onChange(e.target.value)} />}
    {help && <p id={describedBy} className="field-help">{help}</p>}
  </div>;
}
