import type { DocumentSettings } from "../research/types";

type Props = {
  settings: DocumentSettings;
  onChange: (patch: Partial<DocumentSettings>) => void;
};

/** Page setup rows: the running text drawn before the page number, and Different first page. */
export function PageHeaderRows({ settings, onChange }: Props) {
  return (
    <>
      <label className="row">
        <span className="row-label">Page header text</span>
        <span className="row-trail" style={{ width: 112 }}>
          <input
            type="text"
            className="toolbar-input"
            aria-label="Page header text"
            placeholder="Siegel"
            maxLength={60}
            value={settings.pageHeaderText ?? ""}
            onChange={(e) => onChange({ pageHeaderText: e.target.value })}
          />
        </span>
      </label>
      <label className="row">
        <span className="row-label">Different first page</span>
        <input
          type="checkbox"
          checked={!!settings.pageFirstDifferent}
          onChange={(e) => onChange({ pageFirstDifferent: e.target.checked })}
        />
      </label>
    </>
  );
}
