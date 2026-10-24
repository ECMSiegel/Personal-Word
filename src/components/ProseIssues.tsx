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
  const counts = RULE_LABELS.map(([kind, label]) => [label, issues.filter(issue => issue.kind === kind).length] as const);

  return <section className="prose-issues-panel" aria-label="Prose issues">
    {RULE_LABELS.map(([kind, label]) => <label className="toolbar-field" key={kind}>
      <span>{label}</span>
      <input type="checkbox" checked={rules[kind]} onChange={event => onRuleChange(kind, event.currentTarget.checked)} />
    </label>)}
    <div className="toolbar-field-title" aria-live="polite" style={{ whiteSpace: "normal", overflowWrap: "anywhere" }}>
      {unavailable ? "Prose check is unavailable in this browser." : pending ? "Analyzing prose…" : `${rows.length.toLocaleString()} shown on this page -- ${visible.length.toLocaleString()} total issues`}
      {!unavailable && !pending && ` -- ${counts.map(([label, count]) => `${label} ${count}`).join(" -- ")}`}
    </div>
    <div className="prose-issues" aria-busy={pending}>
      {!unavailable && !pending && rows.map(issue => <div className="prose-issue-row" key={issue.id ?? `${issue.from}-${issue.kind}`}>
        <button type="button" className="toolbar-text-button prose-issue-select" title={issue.message} onClick={() => onSelect(issue)}>
          <span>{excerpt(issue)}</span><span>{issue.message}</span>
        </button>
        <button type="button" className="prose-issue-dismiss" aria-label="Dismiss this issue once" title="Dismiss this issue once" onClick={() => onDismiss(issue)}>Dismiss once</button>
      </div>)}
      {!unavailable && !pending && visible.length === 0 && <span className="toolbar-field-title">No issues found.</span>}
    </div>
    {!unavailable && <div className="prose-issue-pagination">
      <button type="button" className="toolbar-text-button" aria-label="Previous issue page" disabled={currentPage === 0} onClick={() => onPageChange(currentPage - 1)}>Previous</button>
      <span aria-live="polite">Page {currentPage + 1} of {pageCount}</span>
      <button type="button" className="toolbar-text-button" aria-label="Next issue page" disabled={currentPage + 1 >= pageCount} onClick={() => onPageChange(currentPage + 1)}>Next</button>
    </div>}
  </section>;
}
