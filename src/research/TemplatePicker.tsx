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
    <section
      className="template-picker settings-section"
      aria-label="Writing templates"
    >
      <h2>Templates</h2>
      <p className="settings-help">Choose a starting structure for a new project.</p>
      <div className="template-list">
        {[...writingTemplates.filter((t) => !t.hidden), ...customTemplates].map((t) => (
          <div className="template-row" key={t.id}>
            <button className="template-choice" onClick={() => onChoose(t)}>
              <strong>{t.name}</strong>
              <small>{t.description}</small>
            </button>
            {t.custom && onDeleteCustom && (
              <button
                className="text-button template-delete"
                aria-label={`Delete template ${t.name}`}
                onClick={() => onDeleteCustom(t.id)}
              >
                Delete
              </button>
            )}
          </div>
        ))}
      </div>
      {onSaveCurrent && (
        <button className="settings-text-action" onClick={onSaveCurrent}>
          Save current project as reusable template
        </button>
      )}
    </section>
  );
}
