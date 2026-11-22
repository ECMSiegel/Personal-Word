import type { ReactNode } from "react";
import { ChevronRight } from "lucide-react";
import type { CitationPart } from "./citations";

export function Cite({ parts }: { parts: CitationPart[] }) {
  return <>{parts.map((part, index) => part.italic ? <em key={index}>{part.text}</em> : <span key={index}>{part.text}</span>)}</>;
}

export function Preview({ label, parts, collapsed = false, onToggle }: {
  label: string;
  parts: CitationPart[];
  collapsed?: boolean;
  onToggle?: () => void;
}) {
  return <div className="preview">
    {onToggle ? (
      <button
        type="button"
        className="research-collapse-toggle cluster gap-1"
        aria-expanded={!collapsed}
        onClick={onToggle}
      >
        <span>{label}</span>
        <ChevronRight size={14} aria-hidden="true" />
      </button>
    ) : (
      <span className="field-label">{label}</span>
    )}
    {!collapsed && <p className="citation-preview"><Cite parts={parts} /></p>}
  </div>;
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
