import { writingTemplates, type WritingTemplate } from "../templates";
import "./research.css";
export function TemplatePicker({
  onChoose,
  customTemplates = [],
  onSaveCurrent,
  onDeleteCustom,
}: {
  onChoose: (template: WritingTemplate) => void;
  customTemplates?: WritingTemplate[];
  onSaveCurrent?: () => void;
  onDeleteCustom?: (id: string) => void;
}) {
  return (
    <section className="template-picker" aria-label="Writing templates">
      <p>Templates -- choose a starting structure</p>
      {[...writingTemplates, ...customTemplates].map((t) => (
        <div key={t.id}>
          <button onClick={() => onChoose(t)}>
            <strong>{t.name}</strong>
            <small>{t.description}</small>
          </button>
          {t.custom && onDeleteCustom && (
            <button
              aria-label={`Delete template ${t.name}`}
              onClick={() => onDeleteCustom(t.id)}
            >
              Delete
            </button>
          )}
        </div>
      ))}
      {onSaveCurrent && (
        <button onClick={onSaveCurrent}>
          Save current project as reusable template
        </button>
      )}
    </section>
  );
}
