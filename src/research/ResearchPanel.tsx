import { useEffect, useRef, useState } from "react";
import { ChevronRight } from "lucide-react";
import { Dropdown, type DropdownOption } from "../components/Dropdown";
import {
  bibliography,
  citationGuidance,
  citationParts,
  footnoteParts,
  type CitationPart,
} from "./citations";
import { lookupIdentifier } from "./lookup";
import { parseCslJson, type CslImportResult } from "./cslImport";
import { CaptureQuote } from "./CaptureQuote";
import { MAX_MANUSCRIPT_BYTES } from "../import/manuscript";
import type { NoteForm } from "./types";
import {
  type Footnote,
  type ResearchData,
  type ResearchNote,
  type Source,
} from "./types";
import "./research.css";

export type ResearchTab = "sources" | "notes";
const emptyResearchData: ResearchData = { sources: [], notes: [], footnotes: [] };

const kindOptions: DropdownOption<Source["kind"]>[] = [
  { value: "book", label: "Book" },
  { value: "journal", label: "Journal article" },
  { value: "website", label: "Website" },
];
const kindLabels: Record<Source["kind"], string> = {
  book: "Book",
  journal: "Journal article",
  website: "Website",
};
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
const sourceSummary = (source: Source) =>
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
  noteForms = {},
  onImportCsl,
  onCaptureQuote,
}: {
  data?: ResearchData;
  onChange: (data: ResearchData) => void;
  onInsertFootnote?: (id: string) => void;
  onInsertNote?: (note: ResearchNote) => void;
  initialTab?: ResearchTab | "footnotes";
  /** Opens Sources at the footnote's source and focuses its text. */
  focusFootnoteId?: string;
  noteForms?: Record<string, "full" | "short">;
  onImportCsl?: (result: CslImportResult) => void;
  onCaptureQuote?: (note: ResearchNote, insert: boolean) => void;
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
    const parts = footnoteParts(note, data, noteForms[note.id]);
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
                  { value: "auto", label: `Automatic (${noteForms[note.id] ?? "full"})` },
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
        <div className="cite-preview">
          <span className="field-label">Preview</span>
          <p className="citation-preview">
            {parts.length ? (
              <Cite parts={parts} />
            ) : (
              "Write a note or choose a source."
            )}
          </p>
        </div>
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
          <Field
            id={fieldId("authors")}
            label="Authors"
            multiline
            wide
            help="One name per line, first name first"
            value={source.authors.join("\n")}
            onChange={(value) => patch({ authors: value.split("\n") })}
          />
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
  const entries = bibliography({ ...data, sources: cited });

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
          <label className="check">
            <input
              type="checkbox"
              checked={data.autoShortNotes ?? false}
              onChange={(event) => onChange({ ...data, autoShortNotes: event.target.checked })}
            />
            Shorten repeat citations automatically
          </label>
          <input
            ref={importFile}
            type="file"
            accept=".json,application/json"
            hidden
            aria-label="Zotero CSL JSON file"
            onChange={async (event) => {
              const file = event.currentTarget.files?.[0];
              event.currentTarget.value = "";
              if (!file) return;
              try {
                if (file.size > MAX_MANUSCRIPT_BYTES) throw new Error("Choose a file no larger than 5 MB.");
                const text = new TextDecoder("utf-8", { fatal: true }).decode(await file.arrayBuffer());
                const result = parseCslJson(text, latest.current.sources);
                if (onImportCsl) onImportCsl(result);
              } catch (error) {
                notify(error instanceof Error ? error.message : "Could not read this CSL JSON file.", true);
              }
            }}
          />
          <div className="research-add">
            <div className="research-lookup">
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
              >
                Look up
              </button>
            </div>
            <p className="research-privacy">
              Look up sends only this identifier to Crossref, Open Library, or
              the website.
            </p>
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
            <p className="research-hint">In Zotero, right-click a library or collection, choose Export, and pick CSL JSON.</p>
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
                {entries.map((entry) => (
                  <li key={entry.id}>
                    <Cite parts={entry.parts} />
                  </li>
                ))}
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
