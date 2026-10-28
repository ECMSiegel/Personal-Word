import { Dropdown } from "../components/Dropdown";
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
}: {
  items: BibliographyItem[];
  settings?: Pick<DocumentSettings, "bibliographyOrder" | "bibliographyScope">;
  onChange: (patch: {
    bibliographyOrder?: BibliographyOrder;
    bibliographyScope?: BibliographyScope;
  }) => void;
}) {
  return (
    <section className="bibliography-page" aria-label="Bibliography">
      <h1>Bibliography</h1>
      <div className="bibliography-controls">
        <Dropdown
          label="Bibliography order"
          value={settings?.bibliographyOrder ?? "author"}
          options={ORDERS}
          onChange={(bibliographyOrder) => onChange({ bibliographyOrder })}
        />
        <label>
          <input
            type="checkbox"
            checked={(settings?.bibliographyScope ?? "cited") === "all"}
            onChange={(event) =>
              onChange({
                bibliographyScope: event.target.checked ? "all" : "cited",
              })
            }
          />
          Include uncited sources
        </label>
      </div>
      {items.length ? (
        <div className="bibliography-entries">
          {items.map((item) =>
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
          )}
        </div>
      ) : (
        <p className="research-hint">Sources cited in footnotes appear here.</p>
      )}
    </section>
  );
}
