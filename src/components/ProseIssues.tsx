import type { ProseIssue } from "../editor/proseCheck";
import type { ProseRules } from "../editor/writingAids";

const RULE_LABELS: Array<[keyof ProseRules, string]> = [
  ["repeat", "Repeated words"],
  ["passive", "Possible passive voice"],
  ["filler", "Filler words"],
  ["long", "Long sentences"],
];

export function ProseIssues({
  issues,
  rules,
  pending,
  unavailable,
  page,
  excerpt,
  onRuleChange,
  onPageChange,
  onSelect,
  onDismiss,
}: {
  issues: ProseIssue[];
  rules: ProseRules;
  pending: boolean;
  unavailable: boolean;
  page: number;
  excerpt: (issue: ProseIssue) => string;
  onRuleChange: (rule: keyof ProseRules, enabled: boolean) => void;
  onPageChange: (page: number) => void;
  onSelect: (issue: ProseIssue) => void;
  onDismiss: (issue: ProseIssue) => void;
}) {
  const visible = issues.filter(issue => rules[issue.kind]);
  const pageSize = 100;
  const pageCount = Math.max(1, Math.ceil(visible.length / pageSize));
  const currentPage = Math.min(page, pageCount - 1);
  const rows = visible.slice(currentPage * pageSize, (currentPage + 1) * pageSize);

  return <section className="prose-issues-panel stack" aria-label="Prose issues">
    {RULE_LABELS.map(([kind, label]) => <label className="row prose-rule" key={kind}>
      <span className="row-label">{label}</span>
      <span className="row-trail">
        <span className="prose-rule-count row-value">{issues.filter(issue => issue.kind === kind).length.toLocaleString()}</span>
      </span>
      <input type="checkbox" aria-label={label} checked={rules[kind]} onChange={event => onRuleChange(kind, event.currentTarget.checked)} />
    </label>)}
    <div className="toolbar-field-title row" aria-live="polite">
      {unavailable ? "Prose check is unavailable in this browser." : pending ? "Analyzing prose…" : visible.length === 1 ? "1 issue" : `${visible.length.toLocaleString()} issues`}
    </div>
    <div className="prose-issues stack gap-1" aria-busy={pending}>
      {!unavailable && !pending && rows.map(issue => <div className="row gap-1 prose-issue-row" key={issue.id ?? `${issue.from}-${issue.kind}`}>
        <button type="button" className="row prose-issue-select" title={issue.message} onClick={() => onSelect(issue)}>
          <span>{excerpt(issue)}</span><span>{issue.message}</span>
        </button>
        <button type="button" className="prose-issue-dismiss" aria-label="Dismiss this issue once" title="Dismiss this issue once" onClick={() => onDismiss(issue)}>Dismiss once</button>
      </div>)}
      {!unavailable && !pending && visible.length === 0 && <span className="toolbar-field-title">No issues found.</span>}
    </div>
    {!unavailable && pageCount > 1 && <div className="prose-issue-pagination">
      <button type="button" className="toolbar-text-button" aria-label="Previous issue page" disabled={currentPage === 0} onClick={() => onPageChange(currentPage - 1)}>Previous</button>
      <span aria-live="polite">Page {currentPage + 1} of {pageCount}</span>
      <button type="button" className="toolbar-text-button" aria-label="Next issue page" disabled={currentPage + 1 >= pageCount} onClick={() => onPageChange(currentPage + 1)}>Next</button>
    </div>}
  </section>;
}
