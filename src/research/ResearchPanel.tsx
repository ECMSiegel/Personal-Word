import { useEffect, useId, useRef, useState } from "react";
import { ChevronRight } from "lucide-react";
import { Dropdown, type DropdownOption } from "../components/Dropdown";
import {
  bibliography,
  citationGuidance,
  citationParts,
  footnoteParts,
  type CitationPart,
} from "./citations";
import type { BibliographyItem } from "./bibliography";
import { lookupIdentifier } from "./lookup";
import { parseCslJson, type CslImportResult } from "./cslImport";
import { parseBibtex } from "./bibtexImport";
import { fetchAllZoteroItems, previewZoteroChanges } from "./zotero";
import { CaptureQuote } from "./CaptureQuote";
import { MAX_MANUSCRIPT_BYTES } from "../import/manuscript";
import type { CitationPolicy, NoteForm } from "./types";
import type { CitationContext } from "./noteForms";
import {
  type Footnote,
  type ResearchData,
  type ResearchNote,
  type Source,
} from "./types";
import "./research.css";

export type ResearchTab = "sources" | "notes";
const emptyResearchData: ResearchData = { sources: [], notes: [], footnotes: [] };

const kindLabels: Record<Source["kind"], string> = {
  book: "Book", journal: "Journal article", website: "Website", chapter: "Book chapter",
  thesis: "Thesis or dissertation", report: "Report", conference: "Conference work",
  newspaper: "Newspaper article", interview: "Interview", media: "Media", other: "Other",
};
const kindOptions: DropdownOption<Source["kind"]>[] = Object.entries(kindLabels).map(([value, label]) => ({ value: value as Source["kind"], label }));
const quoteKindOptions: DropdownOption<ResearchNote["kind"]>[] = [
  { value: "quote", label: "Direct quote" },
  { value: "paraphrase", label: "Paraphrase" },
];

const plural = (count: number, word: string) =>
  `${count} ${word}${count === 1 ? "" : "s"}`;
const firstWords = (text: string) => {
  const words = text.trim().split(/\s+/);
  return words.slice(0, 6).join(" ") + (words.length > 6 ? "…" : "");
};
const leadName = (source: Source) => {
  const first = source.authors.find((name) => name.trim())?.trim();
  if (!first) return "";
  return first.includes(",")
    ? first.split(",")[0].trim()
    : (first.split(/\s+/).at(-1) ?? "");
};
export const sourceSummary = (source: Source) =>
  [leadName(source), source.title.trim() || "Untitled source"]
    .filter(Boolean)
    .join(" -- ") + (source.year ? ` (${source.year})` : "");

function Cite({ parts }: { parts: CitationPart[] }) {
  return (
    <>
      {parts.map((part, index) =>
        part.italic ? (
          <em key={index}>{part.text}</em>
        ) : (
          <span key={index}>{part.text}</span>
        ),
      )}
    </>
  );
}

const ZOTERO_HINT =
  "In Zotero, enable the local API in Settings > Advanced before refreshing.";

const LOOKUP_PRIVACY =
  "Look up sends only this identifier to Crossref, Open Library, or the website.";

function Field({
  id,
  label,
  value,
  onChange,
  help,
  wide,
  multiline,
  placeholder,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  help?: string;
  wide?: boolean;
  multiline?: boolean;
  placeholder?: string;
}) {
  const describedBy = help ? `${id}-help` : undefined;
  return (
    <div className={"field" + (wide ? " is-wide" : "")}>
      <label htmlFor={id}>{label}</label>
      {multiline ? (
        <textarea
          id={id}
          rows={3}
          value={value}
          placeholder={placeholder}
          aria-describedby={describedBy}
          onChange={(e) => onChange(e.target.value)}
        />
      ) : (
        <input
          id={id}
          type="text"
          value={value}
          placeholder={placeholder}
          aria-describedby={describedBy}
          onChange={(e) => onChange(e.target.value)}
        />
      )}
      {help && (
        <p id={describedBy} className="field-help">
          {help}
        </p>
      )}
    </div>
  );
}

function Preview({ label, parts }: { label: string; parts: CitationPart[] }) {
  return (
    <div className="preview">
      <span className="field-label">{label}</span>
      <p className="citation-preview">
        <Cite parts={parts} />
      </p>
    </div>
  );
}

export function ResearchPanel({
  data = emptyResearchData,
  onChange,
  onInsertFootnote,
  onInsertNote,
  initialTab = "sources",
  focusFootnoteId,
  focusSourceId,
  citationContext = {},
  onImportCsl,
  onCaptureQuote,
  bibliography: bibliographyProp,
  onAttachPdf,
  onOpenPdf,
}: {
  data?: ResearchData;
  onChange: (data: ResearchData) => void;
  onInsertFootnote?: (id: string) => void;
  onInsertNote?: (note: ResearchNote) => void;
  initialTab?: ResearchTab | "footnotes";
  /** Opens Sources at the footnote's source and focuses its text. */
  focusFootnoteId?: string;
  /** Opens Sources with this source expanded and scrolled into view. */
  focusSourceId?: string;
  citationContext?: CitationContext;
  onImportCsl?: (result: CslImportResult) => void;
  onCaptureQuote?: (note: ResearchNote, insert: boolean) => void;
  bibliography?: BibliographyItem[];
  onAttachPdf?: (sourceId: string, file: File) => Promise<void>;
  onOpenPdf?: (sourceId: string) => void;
}) {
  const [tab, setTab] = useState<ResearchTab>(
    initialTab === "notes" ? "notes" : "sources",
  );
  const [openId, setOpenId] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState({ text: "", error: false });
  const [pendingFocus, setPendingFocus] = useState<string | null>(null);
  const [captureSourceId, setCaptureSourceId] = useState<string | undefined>();
  const [capturingQuote, setCapturingQuote] = useState(false);
  const lookupTipId = useId();
  const zoteroTipId = useId();
  const [zoteroTipShown, setZoteroTipShown] = useState(false);
  const [lookupTipShown, setLookupTipShown] = useState(false);
  const [zoteroConnected, setZoteroConnected] = useState(false);
  const [zoteroLoading, setZoteroLoading] = useState(false);
  const [zoteroMessage, setZoteroMessage] = useState<string>("");
  const importFile = useRef<HTMLInputElement>(null);
  const panel = useRef<HTMLElement>(null);
  const latest = useRef(data);
  latest.current = data;

  useEffect(() => {
    if (!focusFootnoteId) return;
    const note = latest.current.footnotes.find((f) => f.id === focusFootnoteId);
    setTab("sources");
    setOpenId(note?.sourceId ?? null);
    setPendingFocus(focusFootnoteId);
  }, [focusFootnoteId]);

  useEffect(() => {
    if (!focusSourceId) return;
    setTab("sources");
    setOpenId(focusSourceId);
  }, [focusSourceId]);

  useEffect(() => {
    if (!focusSourceId || openId !== focusSourceId || tab !== "sources") return;
    panel.current
      ?.querySelector(`#${CSS.escape(focusSourceId + "-panel")}`)
      ?.scrollIntoView({ block: "nearest" });
  }, [focusSourceId, openId, tab]);

  useEffect(() => {
    if (!pendingFocus) return;
    const field = panel.current?.querySelector<HTMLTextAreaElement>(
      `[data-research-id="${CSS.escape(pendingFocus)}"]`,
    );
    if (!field) return;
    field.scrollIntoView({ block: "nearest" });
    field.focus();
    setPendingFocus(null);
  }, [pendingFocus, tab, openId, data]);

  const notify = (text: string, error = false) => setStatus({ text, error });

  const patchSource = (id: string, patch: Partial<Source>) =>
    onChange({
      ...data,
      sources: data.sources.map((s) => (s.id === id ? { ...s, ...patch } : s)),
    });
  const patchNote = (id: string, patch: Partial<ResearchNote>) =>
    onChange({
      ...data,
      notes: data.notes.map((n) => (n.id === id ? { ...n, ...patch } : n)),
    });
  const patchFootnote = (id: string, patch: Partial<Footnote>) =>
    onChange({
      ...data,
      footnotes: data.footnotes.map((f) =>
        f.id === id ? { ...f, ...patch } : f,
      ),
    });
  const deleteNote = (id: string) =>
    onChange({ ...data, notes: data.notes.filter((n) => n.id !== id) });

  const runLookup = async () => {
    const value = input.trim();
    if (!value || busy) return;
    setBusy(true);
    notify("Looking up...");
    try {
      const result = await lookupIdentifier(value);
      const id = crypto.randomUUID();
      const current = latest.current;
      onChange({
        ...current,
        sources: [...current.sources, { id, ...result.source }],
      });
      setInput("");
      setOpenId(id);
      notify(`Found on ${result.provider} -- review the details`);
    } catch (error) {
      notify(error instanceof Error ? error.message : "Lookup failed", true);
    } finally {
      setBusy(false);
    }
  };

  const addManual = () => {
    const id = crypto.randomUUID();
    onChange({
      ...data,
      sources: [...data.sources, { id, kind: "book", title: "", authors: [] }],
    });
    setOpenId(id);
    notify("");
  };

  const deleteSource = (source: Source) => {
    if (
      data.footnotes.some((f) => f.sourceId === source.id) ||
      data.notes.some((n) => n.sourceId === source.id)
    ) {
      notify(
        "Remove the quotes and footnotes linked to this source before deleting it. Footnotes can be unlinked.",
        true,
      );
      return;
    }
    onChange({
      ...data,
      sources: data.sources.filter((s) => s.id !== source.id),
    });
    setOpenId(null);
    notify("");
  };

  const citeHere = (source: Source) => {
    const id = crypto.randomUUID();
    onChange({
      ...data,
      footnotes: [...data.footnotes, { id, text: "", sourceId: source.id }],
    });
    onInsertFootnote?.(id);
    setPendingFocus(id);
  };

  const insertTextOnly = () => {
    const id = crypto.randomUUID();
    onChange({ ...data, footnotes: [...data.footnotes, { id, text: "" }] });
    onInsertFootnote?.(id);
    setPendingFocus(id);
  };

  const addNote = () => {
    const id = crypto.randomUUID();
    onChange({
      ...data,
      notes: [...data.notes, { id, kind: "personal", text: "" }],
    });
    setPendingFocus(id);
  };

  const renderFootnote = (note: Footnote) => {
    const linked = Boolean(note.sourceId);
    const context = citationContext[note.id];
    const parts = footnoteParts(note, data, context?.form, context?.locator);
    return (
      <div className="footnote-item" key={note.id}>
        <span className="field-label">
          Footnote
          {note.text.trim() ? ` -- ${firstWords(note.text)}` : ""}
        </span>
        <textarea
          aria-label="Footnote text"
          data-research-id={note.id}
          rows={2}
          value={note.text}
          onChange={(e) => patchFootnote(note.id, { text: e.target.value })}
        />
        {linked && (
          <div className="footnote-options">
            <Field
              id={`${note.id}-locator`}
              label="Page"
              value={note.locator ?? ""}
              onChange={(locator) => patchFootnote(note.id, { locator })}
            />
            <div className="field">
              <span className="field-label">Note form</span>
              <Dropdown<NoteForm>
                label="Note form"
                value={note.form ?? (note.shortened ? "short" : "auto")}
                width="100%"
                options={[
                  { value: "auto", label: `Automatic (${context?.form === "ibid" ? "Ibid." : context?.form ?? "full"})` },
                  { value: "full", label: "Always full" },
                  { value: "short", label: "Always short" },
                ]}
                onChange={(form) => {
                  patchFootnote(note.id, { form, shortened: undefined });
                }}
              />
            </div>
          </div>
        )}
        {parts.length > 0 && (
          <div className="cite-preview">
            <span className="field-label">Preview</span>
            <p className="citation-preview">
              <Cite parts={parts} />
            </p>
          </div>
        )}
        {linked && (
          <div className="item-actions">
            <button
              type="button"
              onClick={() => patchFootnote(note.id, { sourceId: undefined })}
            >
              Unlink source
            </button>
          </div>
        )}
      </div>
    );
  };

  const renderQuote = (note: ResearchNote) => (
    <div className="linked-item" key={note.id}>
      <div className="field">
        <span className="field-label">Kind</span>
        <Dropdown<ResearchNote["kind"]>
          label="Quote or paraphrase"
          value={note.kind}
          width="100%"
          options={quoteKindOptions}
          onChange={(kind) => patchNote(note.id, { kind })}
        />
      </div>
      <textarea
        aria-label="Quote text"
        data-research-id={note.id}
        rows={3}
        placeholder="Quoted or paraphrased text"
        value={note.text}
        onChange={(e) => patchNote(note.id, { text: e.target.value })}
      />
      <Field
        id={`${note.id}-locator`}
        label="Page"
        value={note.locator ?? ""}
        onChange={(locator) => patchNote(note.id, { locator })}
      />
      <div className="item-actions">
        <button
          type="button"
          disabled={!onInsertNote || !note.text.trim()}
          onClick={() => onInsertNote?.(note)}
        >
          Insert quote + cite
        </button>
        <button
          type="button"
          className="is-danger"
          onClick={() => deleteNote(note.id)}
        >
          Delete quote
        </button>
      </div>
    </div>
  );

  const renderSource = (source: Source) => {
    const patch = (value: Partial<Source>) => patchSource(source.id, value);
    const fieldId = (key: string) => `${source.id}-${key}`;
    const footnotes = data.footnotes.filter((f) => f.sourceId === source.id);
    const quotes = data.notes.filter((n) => n.sourceId === source.id);
    return (
      <div className="source-body" id={`${source.id}-panel`}>
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
            <label className="source-pdf-attach">
              <span>Attach PDF…</span>
              <input type="file" accept="application/pdf,.pdf" aria-label="Attach PDF" onChange={(event) => {
                const file = event.currentTarget.files?.[0];
                event.currentTarget.value = "";
                if (file) void onAttachPdf?.(source.id, file);
              }} />
            </label>
          )}
        </div>
        {source.lookupNote && (
          <p className="research-hint">
            {source.lookupNote} -- review the details
          </p>
        )}
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
          {source.creators?.map((creator, index) => (
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
          {!source.creators?.some((creator) => creator.role === "author") && <Field
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
          <Field
            id={fieldId("shortTitle")}
            label="Short title"
            wide
            value={source.shortTitle ?? ""}
            placeholder="Used in shortened notes"
            onChange={(shortTitle) => patch({ shortTitle: shortTitle || undefined })}
          />
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
          {! ["book", "journal", "website"].includes(source.kind) && <>
            <p className="research-hint">This source type retains its imported fields. Automatic formatting is limited; review every preview and supply manual text wherever a form is requested.</p>
            {([ ["container", "Container title"], ["publisher", "Publisher"], ["year", "Year"], ["institution", "Institution"], ["event", "Event"], ["publishedDate", "Published date"] ] as const).map(([key, label]) =>
              <Field key={key} id={fieldId(key)} label={label} value={source[key] ?? ""} onChange={(value) => patch({ [key]: value })} />)}
          </>}
          {source.kind === "chapter" && <button type="button" onClick={() => patch({ creators: [...(source.creators ?? []), { role: "editor", literal: "" }] })}>Add editor</button>}
          <Field id={fieldId("edition")} label="Edition" value={source.edition ?? ""} onChange={(edition) => patch({ edition })} />
          {([ ["manualFull", "Manual full note"], ["manualShort", "Manual short note"], ["manualBibliography", "Manual bibliography entry"] ] as const).map(([key, label]) =>
            <Field key={key} id={fieldId(key)} label={label} wide multiline help="When supplied, this exact text overrides automatic formatting." value={source[key] ?? ""} onChange={(value) => patch({ [key]: value })} />)}
          <p className="research-hint">Review required details: {[
            !source.title.trim() && "title",
            !source.authors.some((name) => name.trim()) && !source.creators?.some((creator) => creator.role === "author" && [creator.literal, creator.given, creator.family].some((value) => value?.trim())) && "creator or intentional no-author entry",
            !source.year && !source.publishedDate && "publication date or intentional no-date entry",
          ].filter(Boolean).join("; ") || "core fields present -- verify names, dates and publication details"}.</p>
          {source.cslData && <details><summary>Original imported CSL fields</summary><pre style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{JSON.stringify(source.cslData, null, 2)}</pre></details>}
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
        <div className="citation-previews">
          <Preview label="Note" parts={citationParts(source, "full")} />
          <Preview
            label="Shortened note"
            parts={citationParts(source, "short")}
          />
          <Preview
            label="Bibliography"
            parts={citationParts(source, "bibliography")}
          />
        </div>
        <div className="source-actions">
          <button
            type="button"
            disabled={!onInsertFootnote}
            title={onInsertFootnote ? undefined : "Open a section to cite"}
            onClick={() => citeHere(source)}
          >
            Cite here
          </button>
          <button type="button" onClick={() => { setCaptureSourceId(source.id); setCapturingQuote(true); }}>
            Add quote
          </button>
          <button
            type="button"
            className="is-danger"
            onClick={() => deleteSource(source)}
          >
            Delete source
          </button>
        </div>
        {quotes.length > 0 && (
          <section className="linked" aria-label="Quotes from this source">
            <h4 className="research-subhead">Quotes and paraphrases</h4>
            {quotes.map(renderQuote)}
          </section>
        )}
        <section className="linked" aria-label="Footnotes from this source">
          <h4 className="research-subhead">
            {plural(footnotes.length, "footnote")}
          </h4>
          {footnotes.length === 0 && (
            <p className="research-hint">
              No footnotes cite this source yet. Use Cite here.
            </p>
          )}
          {footnotes.map(renderFootnote)}
        </section>
      </div>
    );
  };

  const sourceNotes = (source: Source) => ({
    footnotes: data.footnotes.filter((f) => f.sourceId === source.id).length,
    quotes: data.notes.filter((n) => n.sourceId === source.id).length,
  });
  const textOnly = data.footnotes.filter((f) => !f.sourceId);
  const looseNotes = data.notes.filter((n) => !n.sourceId);
  const cited = data.sources.filter((s) =>
    data.footnotes.some((f) => f.sourceId === s.id),
  );
  const entries: BibliographyItem[] =
    bibliographyProp ?? bibliography({ ...data, sources: cited });

  return (
    <section
      className="research-panel"
      aria-label="Research workspace"
      ref={panel}
    >
      <nav className="research-tabs" aria-label="Research sections">
        {(
          [
            ["sources", "Sources"],
            ["notes", "Notes"],
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            type="button"
            aria-pressed={tab === value}
            onClick={() => setTab(value)}
          >
            {label}
          </button>
        ))}
      </nav>
      {tab === "sources" ? (
        <>
          {!data.citationPolicy && (
            <label className="check">
              <input
                type="checkbox"
                checked={data.autoShortNotes ?? false}
                onChange={(event) => onChange({ ...data, autoShortNotes: event.target.checked })}
              />
              Shorten repeat citations automatically
            </label>
          )}
          <label className="check">
            <input
              type="checkbox"
              checked={Boolean(data.citationPolicy)}
              onChange={(event) => {
                const { citationPolicy: _removed, ...rest } = data;
                onChange(event.target.checked ? { ...rest, citationPolicy: { scope: "manuscript", repeats: "short" } } : rest);
              }}
            />
            Use repeat citation rules
          </label>
          {data.citationPolicy && (
            <div>
              <div className="field">
                <span className="field-label">Full citation again</span>
                <Dropdown<CitationPolicy["scope"]>
                  label="Full citation again"
                  value={data.citationPolicy.scope}
                  width="100%"
                  options={[
                    { value: "manuscript", label: "Never -- once per manuscript" },
                    { value: "section", label: "In each section (one manuscript entry)" },
                  ]}
                  onChange={(scope) => onChange({ ...data, citationPolicy: { ...data.citationPolicy!, scope } })}
                />
              </div>
              <div className="field">
                <span className="field-label">Back-to-back repeat</span>
                <Dropdown<CitationPolicy["repeats"]>
                  label="Back-to-back repeat"
                  value={data.citationPolicy.repeats}
                  width="100%"
                  options={[
                    { value: "short", label: "Short note" },
                    { value: "ibid", label: "Ibid." },
                  ]}
                  onChange={(repeats) => onChange({ ...data, citationPolicy: { ...data.citationPolicy!, repeats } })}
                />
              </div>
            </div>
          )}
          <input
            ref={importFile}
            type="file"
            accept=".json,application/json,.bib,.bibtex,text/x-bibtex"
            hidden
            aria-label="Zotero CSL JSON file or BibTeX"
            onChange={async (event) => {
              const file = event.currentTarget.files?.[0];
              event.currentTarget.value = "";
              if (!file) return;
              try {
                if (file.size > MAX_MANUSCRIPT_BYTES) throw new Error("Choose a file no larger than 5 MB.");
                const text = new TextDecoder("utf-8", { fatal: true }).decode(await file.arrayBuffer());
                const lowerName = file.name.toLowerCase();
                const isBib = lowerName.endsWith(".bib") || lowerName.endsWith(".bibtex");
                const isJson = lowerName.endsWith(".json");
                if (isBib) {
                  const result = parseBibtex(text, latest.current.sources);
                  Object.assign(result, { format: "bibtex" });
                  if (onImportCsl) onImportCsl(result);
                } else if (isJson) {
                  const result = parseCslJson(text, latest.current.sources);
                  Object.assign(result, { format: "csl" });
                  if (onImportCsl) onImportCsl(result);
                } else {
                  notify("Choose a .json, .bib, or .bibtex file.", true);
                }
              } catch (error) {
                const lowerName = file.name.toLowerCase();
                const isBib = lowerName.endsWith(".bib") || lowerName.endsWith(".bibtex");
                notify(
                  error instanceof Error
                    ? error.message
                    : isBib
                      ? "Could not read this BibTeX file."
                      : "Could not read this CSL JSON file.",
                  true,
                );
              }
            }}
          />
          <div className="research-add">
            <div className="research-lookup" style={{ position: "relative" }}>
              <input
                type="text"
                aria-label="DOI, ISBN, or web address"
                placeholder="Paste a DOI, ISBN, or web address"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    void runLookup();
                  }
                }}
              />
              <button
                type="button"
                className="button-primary"
                disabled={busy || !input.trim()}
                onClick={() => void runLookup()}
                title={LOOKUP_PRIVACY}
                aria-describedby={lookupTipId}
                onFocus={() => setLookupTipShown(true)}
                onBlur={() => setLookupTipShown(false)}
              >
                Look up
              </button>
              <span
                id={lookupTipId}
                role="tooltip"
                className="lookup-tip"
                data-shown={lookupTipShown ? "true" : undefined}
              >
                {LOOKUP_PRIVACY}
              </span>
            </div>
            <div className="research-actions">
              <button type="button" onClick={() => { setCaptureSourceId(undefined); setCapturingQuote(true); }}>
                Capture quote
              </button>
              <button type="button" onClick={addManual}>
                Enter manually
              </button>
              <button type="button" onClick={() => importFile.current?.click()}>
                Import from Zotero…
              </button>
            </div>
            <div className="zotero-refresh-section" style={{ marginTop: 8, position: "relative" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                {!zoteroConnected ? (
                  <button
                    type="button"
                    title={ZOTERO_HINT}
                    aria-describedby={zoteroTipId}
                    onFocus={() => setZoteroTipShown(true)}
                    onBlur={() => setZoteroTipShown(false)}
                    onClick={() => {
                      setZoteroConnected(true);
                      setZoteroMessage("Local Zotero refresh enabled -- not yet contacted.");
                    }}
                  >
                    Connect local Zotero
                  </button>
                ) : (
                  <>
                    <button
                      type="button"
                      disabled={zoteroLoading}
                      onClick={async () => {
                        setZoteroLoading(true);
                        setZoteroMessage("Connecting to local Zotero…");
                        try {
                          const res = await fetchAllZoteroItems({ resource: "users/0/items" });
                          setZoteroLoading(false);
                          if (res.notModified) {
                            setZoteroMessage("Connected to local Zotero -- library is up to date.");
                          } else if (res.items.length === 0) {
                            setZoteroMessage("Connected to local Zotero -- no items found.");
                          } else {
                            const result = previewZoteroChanges(latest.current.sources, res.items, res.version);
                            setZoteroMessage(`Connected to local Zotero -- received ${res.items.length} ${res.items.length === 1 ? "item" : "items"}.`);
                            if (onImportCsl) {
                              onImportCsl(result);
                            }
                          }
                        } catch (err) {
                          setZoteroLoading(false);
                          setZoteroMessage(err instanceof Error ? err.message : "Failed to refresh from Zotero.");
                        }
                      }}
                    >
                      {zoteroLoading ? "Refreshing…" : "Refresh from Zotero"}
                    </button>
                    <button
                      type="button"
                      disabled={zoteroLoading}
                      onClick={() => {
                        setZoteroConnected(false);
                        setZoteroMessage("Disconnected from local Zotero.");
                      }}
                    >
                      Disconnect
                    </button>
                  </>
                )}
                <span
                  role="status"
                  className="zotero-status"
                  style={{ fontSize: "var(--type-small)", color: "var(--muted)" }}
                >
                  {zoteroMessage || (!zoteroConnected ? "Zotero refresh: disabled" : "Local Zotero refresh enabled -- not yet contacted.")}
                </span>
              </div>
              <span
                id={zoteroTipId}
                role="tooltip"
                className="lookup-tip"
                data-shown={zoteroTipShown ? "true" : undefined}
              >
                {ZOTERO_HINT}
              </span>
            </div>
          </div>
          <p
            role="status"
            className={"research-status" + (status.error ? " is-error" : "")}
          >
            {status.text}
          </p>
          {data.sources.length === 0 && (
            <p className="research-hint">
              No sources yet. Look one up or enter it manually.
            </p>
          )}
          <ul className="source-list">
            {data.sources.map((source) => {
              const open = openId === source.id;
              const counts = sourceNotes(source);
              return (
                <li className="source-item" key={source.id}>
                  <button
                    type="button"
                    className="source-toggle"
                    aria-expanded={open}
                    aria-controls={`${source.id}-panel`}
                    onClick={() => setOpenId(open ? null : source.id)}
                  >
                    <span className="source-text">
                      <span className="source-title">
                        {sourceSummary(source)}
                      </span>
                      <small>
                        {kindLabels[source.kind]} --{" "}
                        {plural(counts.footnotes, "footnote")},{" "}
                        {plural(counts.quotes, "quote")}
                      </small>
                    </span>
                    <ChevronRight size={14} aria-hidden="true" />
                  </button>
                  {open && renderSource(source)}
                </li>
              );
            })}
          </ul>
          {capturingQuote && <CaptureQuote
            sources={data.sources}
            initialSourceId={captureSourceId}
            onCancel={() => setCapturingQuote(false)}
            onSave={(quote, insert) => {
              const note: ResearchNote = { id: crypto.randomUUID(), kind: "quote", text: quote.text, sourceId: quote.sourceId, locator: quote.locator };
              onChange({ ...data, notes: [...data.notes, note] });
              setCapturingQuote(false);
              if (insert) onCaptureQuote?.(note, true);
            }}
          />}
          <section className="research-group">
            <h3 className="research-subhead">Text-only notes</h3>
            <p className="research-hint">
              Footnotes that cite no source. Place the cursor in your text
              before inserting.
            </p>
            <div className="research-actions">
              <button
                type="button"
                disabled={!onInsertFootnote}
                title={onInsertFootnote ? undefined : "Open a section to cite"}
                onClick={insertTextOnly}
              >
                Insert footnote at cursor
              </button>
            </div>
            {textOnly.map(renderFootnote)}
          </section>
          <details className="research-bibliography">
            <summary>Bibliography</summary>
            {entries.length ? (
              <ol>
                {entries.map((entry) =>
                  entry.heading ? (
                    <li key={entry.id} className="bibliography-heading">
                      {entry.text}
                    </li>
                  ) : (
                    <li key={entry.id}>
                      <Cite parts={entry.parts} />
                    </li>
                  ),
                )}
              </ol>
            ) : (
              <p className="research-hint">
                Sources cited in footnotes appear here.
              </p>
            )}
          </details>
        </>
      ) : (
        <>
          <p className="research-hint">
            Ideas and reminders. Quotes from a source live under that source.
          </p>
          <div className="research-actions">
            <button type="button" onClick={addNote}>
              Add note
            </button>
          </div>
          {looseNotes.length === 0 && (
            <p className="research-hint">No notes yet.</p>
          )}
          {looseNotes.map((note) => (
            <div className="note-item" key={note.id}>
              <textarea
                aria-label="Note text"
                data-research-id={note.id}
                rows={3}
                value={note.text}
                onChange={(e) => patchNote(note.id, { text: e.target.value })}
              />
              <div className="field">
                <span className="field-label">Attach to source</span>
                <Dropdown<string>
                  label="Attach to source"
                  value={note.sourceId ?? ""}
                  width="100%"
                  options={[
                    { value: "", label: "No source" },
                    ...data.sources.map((s) => ({
                      value: s.id,
                      label: sourceSummary(s),
                    })),
                  ]}
                  onChange={(value) =>
                    patchNote(note.id, { sourceId: value || undefined })
                  }
                />
              </div>
              <div className="item-actions">
                <button
                  type="button"
                  className="is-danger"
                  onClick={() => deleteNote(note.id)}
                >
                  Delete note
                </button>
              </div>
            </div>
          ))}
        </>
      )}
      <p className="research-help">
        Chicago 18 notes and bibliography for common books, journal articles,
        and websites. Review names, dates, and special cases against the{" "}
        <a href={citationGuidance.citation} target="_blank" rel="noreferrer">
          citation guide
        </a>
        .{" "}
        <a href={citationGuidance.layout} target="_blank" rel="noreferrer">
          Student paper layout
        </a>
      </p>
    </section>
  );
}
