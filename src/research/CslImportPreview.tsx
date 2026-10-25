import { useState } from "react";
import { Dropdown } from "../components/Dropdown";
import { SOURCE_IMPORT_FIELDS, type SourceImportField } from "./sourceMerge";
import { ModalFrame } from "../app/ProjectDialogs";
import type { CslImportResult } from "./cslImport";
import type { SourceDraft } from "./lookup";

export type SourceFieldUpdate = { candidateIndex: number; existingSourceId: string; fields: SourceImportField[] };
const fieldLabels: Record<SourceImportField, string> = {
  kind: "Source type", title: "Title", shortTitle: "Short title", cslId: "External CSL ID", edition: "Edition",
  authorsAndCreators: "Authors and creators", container: "Container title", institution: "Institution", event: "Event",
  publishedDate: "Published date", publisher: "Publisher", year: "Year", journal: "Journal", volume: "Volume", issue: "Issue",
  pages: "Pages", url: "URL", doi: "DOI", accessed: "Accessed date", website: "Website", isbn: "ISBN", cslData: "Original CSL fields (replace)",
};
const display = (value: unknown) => value === undefined ? "Not supplied" : typeof value === "string" ? value || "(empty)" : JSON.stringify(value);
const fieldValue = (source: SourceDraft, field: SourceImportField) => field === "authorsAndCreators" ? { authors: source.authors, creators: source.creators } : source[field];

export function CslImportPreview({ result, busy = false, onCancel, onAdd }: {
  result: CslImportResult;
  busy?: boolean;
  onCancel: () => void;
  onAdd: (sources: SourceDraft[], updates: SourceFieldUpdate[]) => void;
}) {
  const isBibtex =
    (result as { format?: string }).format === "bibtex" ||
    (result.sources.length > 0 &&
      result.sources.every((s) => s.lookupNote === "Imported from BibTeX"));

  const getFieldLabel = (field: SourceImportField) =>
    field === "cslData" && isBibtex
      ? "Original BibTeX fields (replace)"
      : fieldLabels[field];

  const sourceName = (id: string) => {
    const index = result.existingSources.findIndex((source) => source.id === id);
    const source = result.existingSources[index];
    if (!source) return "Unavailable source";
    const names = source.creators?.filter((creator) => creator.role === "author").map((creator) => creator.literal || [creator.given, creator.family].filter(Boolean).join(" ")).filter(Boolean);
    return [`Record ${index + 1}`, source.title || "Untitled source", (names?.length ? names : source.authors).join("; "), source.year || source.publishedDate, source.container || source.journal || source.website].filter(Boolean).join(" -- ");
  };
  const reasonLabels: Record<string, string> = {
    title: "title",
    creators: "creators",
    year: "year",
    kind: "source type",
    isbn: "ISBN",
    "external-id": isBibtex ? "citation key" : "Zotero item",
    "unverified-csl-id": "CSL ID (not globally unique)",
    "conflicting-doi": "different DOIs",
  };
  const exact = new Map(result.review.exactDuplicates.map((row) => [row.candidateIndex, row]));
  const possible = new Map(result.review.possibleMatches.map((row) => [row.candidateIndex, row]));
  const [selected, setSelected] = useState(() => result.sources.map((_, index) => !exact.has(index)));
  const [updates, setUpdates] = useState<Record<number, { existingSourceId: string; fields: SourceImportField[] }>>({});
  const [page, setPage] = useState(0);
  const count = selected.filter(Boolean).length;
  const chosenUpdates: SourceFieldUpdate[] = Object.entries(updates).flatMap(([index, choice]) => choice.existingSourceId && choice.fields.length ? [{ candidateIndex: Number(index), ...choice }] : []);
  const pages = Math.max(1, Math.ceil(result.sources.length / 50));
  return <ModalFrame title={isBibtex ? "Import sources" : "Import Zotero sources"} busy={busy} onCancel={onCancel}>
    <p>{count} sources to add</p>
    <p>Review each record before adding. Identifier matches start unchecked; select one to keep both records. Field updates change only the fields you choose and keep existing notes linked to the same source.</p>
    {Object.keys(updates).length > 0 && <p>{chosenUpdates.length} existing sources to update. Manual citation text and unselected fields stay unchanged. A checked safety snapshot is kept first.</p>}
    {Object.entries(result.skipped).length > 0 && <div><p>Invalid items skipped:</p><ul>{Object.entries(result.skipped).map(([type, n]) => <li key={type}>{n} {type === "invalid" ? (isBibtex ? "sources" : "CSL items") : type}</li>)}</ul></div>}
    {result.warnings.length > 0 && <details><summary>Import warnings ({result.warnings.length})</summary><ul>{result.warnings.map((warning, i) => <li key={i}>{warning}</li>)}</ul></details>}
    <ol aria-label="Source preview" start={page * 50 + 1}>{result.sources.slice(page * 50, (page + 1) * 50).map((source, offset) => {
      const index = page * 50 + offset;
      const duplicate = exact.get(index), match = possible.get(index);
      const targets = duplicate?.existingSourceIds ?? match?.matches.map((candidate) => candidate.existingSourceId) ?? [];
      const update = updates[index];
      const target = result.existingSources.find((candidate) => candidate.id === update?.existingSourceId);
      return <li key={index}>
        <label style={{ display: "inline-flex", alignItems: "center", gap: 8 }}><input style={{ display: "inline-block", width: "auto", margin: 0, padding: 0 }} type="checkbox" checked={selected[index]} disabled={busy} onChange={(event) => {
          setSelected((values) => values.map((value, i) => i === index ? event.target.checked : value));
          if (event.target.checked) setUpdates((values) => { const next = { ...values }; delete next[index]; return next; });
        }} />Add {source.title}</label>
        <p>{source.authors.join("; ") || "No author"} -- {source.kind}{source.year ? ` -- ${source.year}` : ""}{source.edition ? ` -- edition ${source.edition}` : ""}</p>
        {source.doi && <p>DOI: {source.doi}</p>}
        {duplicate && <p>Identifier match with {duplicate.existingSourceIds.map(sourceName).join("; ")} ({duplicate.matchedBy.map((method) => method === "doi" ? "DOI" : method === "external-id" ? (isBibtex ? "citation key" : "Zotero item") : "ISBN, edition and source type").join(", ")}). Unchecked keeps the existing record; checking adds a separate copy.</p>}
        {match && <p>Possible match: {match.matches.map((candidate) => `${sourceName(candidate.existingSourceId)} (${candidate.reasons.map((reason) => reasonLabels[reason] ?? reason).join(", ")})`).join("; ")}. Retained for your review.</p>}
        {targets.length > 0 && <>
          <button type="button" disabled={busy} aria-expanded={Boolean(update)} onClick={() => {
            setSelected((values) => values.map((value, i) => i === index ? false : value));
            setUpdates((values) => { const next = { ...values }; if (next[index]) delete next[index]; else next[index] = { existingSourceId: "", fields: [] }; return next; });
          }}>Review field updates for {source.title}</button>
          {update && <div>
            <p>Record numbers follow the order of your existing source list.</p>
            <Dropdown label={`Update target for ${source.title}`} value={update.existingSourceId} disabled={busy} width="100%"
              options={[{ value: "", label: "Choose an existing source" }, ...targets.map((id) => ({ value: id, label: sourceName(id) }))]}
              onChange={(existingSourceId) => setUpdates((values) => ({ ...values, [index]: { existingSourceId, fields: [] } }))} />
            {target && <fieldset disabled={busy}><legend>Choose fields to replace</legend>
              <p>No fields are selected automatically. {isBibtex ? "Original BibTeX fields" : "Original CSL fields"} is a whole-field replacement; its old raw fields are retained only in the safety snapshot.</p>
              {SOURCE_IMPORT_FIELDS.filter((field) => field === "authorsAndCreators" || source[field] !== undefined).map((field) => <div key={field}>
                <label style={{ display: "inline-flex", alignItems: "center", gap: 8 }}><input style={{ display: "inline-block", width: "auto", margin: 0, padding: 0 }} type="checkbox" checked={update.fields.includes(field)}
                  onChange={(event) => setUpdates((values) => ({ ...values, [index]: { ...values[index], fields: event.target.checked ? [...values[index].fields, field] : values[index].fields.filter((value) => value !== field) } }))} />Update {getFieldLabel(field)} for {source.title}</label>
                <details><summary>Compare {getFieldLabel(field)}</summary><p style={{ overflowWrap: "anywhere" }}>Current: {display(fieldValue(target, field))}</p><p style={{ overflowWrap: "anywhere" }}>Imported: {display(fieldValue(source, field))}</p></details>
              </div>)}
            </fieldset>}
          </div>}
        </>}

      </li>;
    })}</ol>
    {pages > 1 && <nav aria-label="Source preview pages"><button disabled={busy || page === 0} onClick={() => setPage((n) => n - 1)}>Previous sources</button><span>Page {page + 1} of {pages}</span><button disabled={busy || page + 1 === pages} onClick={() => setPage((n) => n + 1)}>Next sources</button></nav>}
    <div className="dialog-actions"><button type="button" disabled={busy} onClick={onCancel}>Cancel</button><button type="button" className="primary" disabled={busy || (count === 0 && chosenUpdates.length === 0)} onClick={() => onAdd(result.sources.filter((_, index) => selected[index]), chosenUpdates)}>{busy ? "Applying…" : Object.keys(updates).length ? "Apply source choices" : "Add sources"}</button></div>
  </ModalFrame>;
}
