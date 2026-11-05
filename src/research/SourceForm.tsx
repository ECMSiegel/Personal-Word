import { Dropdown, type DropdownOption } from "../components/Dropdown";
import { DropTarget, type DropItem } from "../components/DropTarget";
import { readDroppedPdf } from "../import/dropImport";
import { Field } from "./Cite";
import { kindLabels } from "./citationActions";
import type { Source } from "./types";

const MAX_PDF_BYTES = 25 * 1024 * 1024;
export const acceptPdf = (file: DropItem) => {
  if (!file.name) return !file.type || file.type === "application/pdf" ? null : "Only PDF files can be attached.";
  if (!/\.pdf$/i.test(file.name)) return "Only PDF files can be attached.";
  return file.size > MAX_PDF_BYTES ? "PDFs must be 25 MB or smaller." : null;
};
const kindOptions: DropdownOption<Source["kind"]>[] = Object.entries(kindLabels).map(([value,label])=>({value:value as Source["kind"],label}));
export function SourceForm({ source, patch, idPrefix, onError, onAttachPdf, onOpenPdf, variant = "full" }: { source: Source; patch: (value: Partial<Source>) => void; idPrefix: string; onError: (text: string, error?: boolean) => void; onAttachPdf?: (id: string, file: File) => Promise<void>; onOpenPdf?: (id: string) => void; variant?: "full" | "card" }) {
 const fieldId=(key:string)=>`${idPrefix}-${key}`;
 const body = <>
      {variant === "full" && <>
      <div className="field source-pdf-field">
          <span className="field-label">PDF</span>
          {source.pdf ? (
            <>
              <span className="source-pdf-name">{source.pdf.name}</span>
              <span className="source-pdf-size">{source.pdf.byteLength < 1024
                ? `${source.pdf.byteLength} B`
                : `${(source.pdf.byteLength / 1024).toFixed(1)} KB`}</span>
              <div className="item-actions">
                <button type="button" onClick={() => onOpenPdf?.(source.id)}>Open beside</button>
                <button type="button" className="is-danger" onClick={() => patch({ pdf: undefined })}>Remove PDF</button>
              </div>
            </>
          ) : (
            <DropTarget
              accept={acceptPdf}
              label="Drop to attach"
              onReject={(reason) => onError(reason, true)}
              onFiles={(files) => {
                if (files.length !== 1) return onError("Attach one PDF at a time.", true);
                onError("");
                const [file] = files;
                if (typeof file !== "string") return void onAttachPdf?.(source.id, file);
                readDroppedPdf(file).then(
                  (read) => onAttachPdf?.(source.id, read),
                  (error) => onError(String(error), true),
                );
              }}
            />
          )}
        </div>
        {source.lookupNote && (
          <p className="research-hint">{source.lookupNote} -- review the details</p>
        )}
      </>}
        <div className="field">
          <span className="field-label">Source type</span>
          <Dropdown<Source["kind"]>
            label="Source type"
            value={source.kind}
            width="100%"
            options={kindOptions}
            onChange={(kind) => patch({ kind })}
          />
        </div>
        <div className="research-fields">
          {variant === "full" && source.creators?.map((creator, index) => (
            <div className="field-group" key={index}>
              <span>{creator.role} {index + 1}</span>
              {(creator.literal !== undefined ? ["literal"] : ["given", "family"]).map((key) => (
                <Field key={key} id={fieldId(`creator-${index}-${key}`)} label={`${creator.role} ${index + 1} ${key === "literal" ? "organization or literal name" : key + " name"}`}
                  value={creator[key as "given" | "family" | "literal"] ?? ""}
                  onChange={(value) => {
                    const creators = source.creators!.map((person, i) => i === index ? { ...person, [key]: value } : person);
                    patch({ creators, authors: creators.some((person) => person.role === "author") ? creators.filter((person) => person.role === "author").map((person) => person.literal || [person.given, person.family].filter(Boolean).join(" ")) : source.authors });
                  }} />
              ))}
            </div>
          ))}
          {(!source.creators?.some((creator) => creator.role === "author") || variant === "card") && <Field
            id={fieldId("authors")} label="Authors" multiline wide
            placeholder="One name per line, first name first" value={source.authors.join("\n")}
            onChange={(value) => patch({ authors: value.split("\n") })}
          />}
          <Field
            id={fieldId("title")}
            label="Title"
            wide
            value={source.title}
            onChange={(title) => patch({ title })}
          />
          {variant === "full" && <Field
            id={fieldId("shortTitle")}
            label="Short title"
            wide
            value={source.shortTitle ?? ""}
            placeholder="Used in shortened notes"
            onChange={(shortTitle) => patch({ shortTitle: shortTitle || undefined })}
          />}
          {source.kind === "book" && (
            <>
              <Field
                id={fieldId("publisher")}
                label="Publisher"
                wide
                value={source.publisher ?? ""}
                onChange={(publisher) => patch({ publisher })}
              />
              <Field
                id={fieldId("year")}
                label="Year"
                value={source.year ?? ""}
                onChange={(year) => patch({ year })}
              />
            </>
          )}
          {source.kind === "journal" && (
            <>
              <Field
                id={fieldId("journal")}
                label="Journal"
                wide
                value={source.journal ?? ""}
                onChange={(journal) => patch({ journal })}
              />
              <div className="field-group">
                <Field
                  id={fieldId("volume")}
                  label="Volume"
                  value={source.volume ?? ""}
                  onChange={(volume) => patch({ volume })}
                />
                <Field
                  id={fieldId("issue")}
                  label="Issue"
                  value={source.issue ?? ""}
                  onChange={(issue) => patch({ issue })}
                />
                <Field
                  id={fieldId("pages")}
                  label="Pages"
                  value={source.pages ?? ""}
                  onChange={(pages) => patch({ pages })}
                />
              </div>
              <Field
                id={fieldId("year")}
                label="Year"
                value={source.year ?? ""}
                onChange={(year) => patch({ year })}
              />
            </>
          )}
          {source.kind === "website" && (
            <>
              <Field
                id={fieldId("website")}
                label="Website name"
                wide
                value={source.website ?? ""}
                onChange={(website) => patch({ website })}
              />
              <Field
                id={fieldId("published")}
                label="Published"
                help="yyyy-mm-dd or a year"
                value={source.year ?? ""}
                onChange={(year) => patch({ year })}
              />
              <Field
                id={fieldId("accessed")}
                label="Accessed"
                help="yyyy-mm-dd"
                value={source.accessed ?? ""}
                onChange={(accessed) => patch({ accessed })}
              />
            </>
          )}
          {variant === "card" && !["book", "journal", "website"].includes(source.kind) && (["container", "publisher", "year"] as const).map((key) =>
            <Field key={key} id={fieldId(key)} label={{ container: "Container title", publisher: "Publisher", year: "Year" }[key]} value={source[key] ?? ""} onChange={(value) => patch({ [key]: value })} />)}
          {variant === "full" && !["book", "journal", "website"].includes(source.kind) && <>
            <p className="research-hint">This source type retains its imported fields. Automatic formatting is limited; review every preview and supply manual text wherever a form is requested.</p>
            {([ ["container", "Container title"], ["publisher", "Publisher"], ["year", "Year"], ["institution", "Institution"], ["event", "Event"], ["publishedDate", "Published date"] ] as const).map(([key, label]) =>
              <Field key={key} id={fieldId(key)} label={label} value={source[key] ?? ""} onChange={(value) => patch({ [key]: value })} />)}
          </>}
          {variant === "full" && source.kind === "chapter" && <button type="button" onClick={() => patch({ creators: [...(source.creators ?? []), { role: "editor", literal: "" }] })}>Add editor</button>}
          {variant === "full" && <Field id={fieldId("edition")} label="Edition" value={source.edition ?? ""} onChange={(edition) => patch({ edition })} />}
          {variant === "full" && ([ ["manualFull", "Manual full note"], ["manualShort", "Manual short note"], ["manualBibliography", "Manual bibliography entry"] ] as const).map(([key, label]) =>
            <Field key={key} id={fieldId(key)} label={label} wide multiline help="When supplied, this exact text overrides automatic formatting." value={source[key] ?? ""} onChange={(value) => patch({ [key]: value })} />)}
          {variant === "full" && <p className="research-hint">Review required details: {[
            !source.title.trim() && "title",
            !source.authors.some((name) => name.trim()) && !source.creators?.some((creator) => creator.role === "author" && [creator.literal, creator.given, creator.family].some((value) => value?.trim())) && "creator or intentional no-author entry",
            !source.year && !source.publishedDate && "publication date or intentional no-date entry",
          ].filter(Boolean).join("; ") || "core fields present -- verify names, dates and publication details"}.</p>}
          {variant === "full" && source.cslData && <details><summary>Original imported CSL fields</summary><pre style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{JSON.stringify(source.cslData, null, 2)}</pre></details>}
        <Field
            id={fieldId("doi")}
            label="DOI"
            wide
            value={source.doi ?? ""}
            onChange={(doi) => patch({ doi })}
          />
          {source.kind === "book" && (
            <Field
              id={fieldId("isbn")}
              label="ISBN"
              value={source.isbn ?? ""}
              onChange={(isbn) => patch({ isbn })}
            />
          )}
          <Field
            id={fieldId("url")}
            label="URL"
            wide
            value={source.url ?? ""}
            onChange={(url) => patch({ url })}
          />
        </div>
      </>;
 return variant === "card" ? <div className="research-fields-source">{body}</div> : body;
}
