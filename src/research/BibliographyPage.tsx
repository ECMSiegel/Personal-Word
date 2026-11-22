import { Dropdown } from "../components/Dropdown";
import { PagedSheet } from "../components/PagedSheet";
import type { PageLayout } from "../editor/formatting";
import type {
  BibliographyItem,
  BibliographyOrder,
  BibliographyScope,
} from "./bibliography";
import type { DocumentSettings } from "./types";

const ORDERS: { value: BibliographyOrder; label: string }[] = [
  { value: "author", label: "Alphabetical by author" },
  { value: "cited", label: "Order first cited" },
  { value: "type", label: "By source type" },
];

/** Read-only bibliography of the project, in the same order as every export. */
export function BibliographyPage({
  items,
  settings,
  onChange,
  paged,
  onPagedChange,
  layout,
  pageSettings,
  templateId,
  revision,
}: {
  items: BibliographyItem[];
  settings?: Pick<DocumentSettings, "bibliographyOrder" | "bibliographyScope">;
  onChange: (patch: {
    bibliographyOrder?: BibliographyOrder;
    bibliographyScope?: BibliographyScope;
  }) => void;
  /** Page view (shared with Read): the heading and entries on real pages. */
  paged: boolean;
  onPagedChange: (paged: boolean) => void;
  layout: PageLayout;
  /** Page header text and numbers drawn on the sheets. */
  pageSettings: DocumentSettings;
  templateId: string | undefined;
  /** Changes whenever the content can: project id and revision. */
  revision: string;
}) {
  const order = settings?.bibliographyOrder ?? "author";
  const scope = settings?.bibliographyScope ?? "cited";
  const entries = items.map((item) =>
    item.heading ? (
      <h2 key={item.id}>{item.text}</h2>
    ) : (
      <p key={item.id}>
        {item.parts.map((part, index) =>
          part.italic ? (
            <em key={index}>{part.text}</em>
          ) : (
            <span key={index}>{part.text}</span>
          ),
        )}
      </p>
    ),
  );
  const hint = <p className="research-hint">Sources cited in footnotes appear here.</p>;
  const controls = (
    <div className={"bibliography-controls cluster gap-4" + (paged ? " bar bar-main" : "")}>
      <Dropdown
        label="Bibliography order"
        value={order}
        options={ORDERS}
        onChange={(bibliographyOrder) => onChange({ bibliographyOrder })}
      />
      <label className="cluster gap-2">
        <input
          type="checkbox"
          checked={scope === "all"}
          onChange={(event) =>
            onChange({
              bibliographyScope: event.target.checked ? "all" : "cited",
            })
          }
        />
        Include uncited sources
      </label>
      <button type="button" aria-pressed={paged} onClick={() => onPagedChange(!paged)}>
        Page view
      </button>
    </div>
  );
  if (paged)
    return (
      <section className="bibliography-page is-page-view" aria-label="Bibliography">
        {controls}
        <PagedSheet
          layout={layout}
          settings={pageSettings}
          templateId={templateId}
          contentKey={`${revision}|${order}|${scope}`}
          className="bibliography-entries"
        >
          <h1>Bibliography</h1>
          {items.length ? entries : hint}
        </PagedSheet>
      </section>
    );
  return (
    <section className="bibliography-page" aria-label="Bibliography">
      <h1>Bibliography</h1>
      {controls}
      {items.length ? <div className="bibliography-entries">{entries}</div> : hint}
    </section>
  );
}
