import { useEffect, useId, useRef, useState } from "react";
import { useLookup } from "./useLookup";
import { Cite, Field, Preview } from "./Cite";
import { firstWords, kindLabels, sourceSummary, addCitation, addManualSource, patchResearchNote, patchSource as patchSourceData, patchFootnote as patchFootnoteData, removeSource } from "./citationActions";
export { sourceSummary } from "./citationActions";
import { ChevronRight } from "lucide-react";
import { Dropdown, type DropdownOption } from "../components/Dropdown";
import {
  bibliography,
  citationGuidance,
  citationParts,
  footnoteParts,
} from "./citations";
import type { BibliographyItem } from "./bibliography";
import { SourceForm } from "./SourceForm";
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
import "../components/scroll-fade.css";
import { watchScrollFade } from "../components/scrollFade";

export type ResearchTab = "sources" | "notes";
const emptyResearchData: ResearchData = { sources: [], notes: [], footnotes: [] };
const ZOTERO_HINT = "In Zotero, enable the local API in Settings > Advanced before refreshing.";

const quoteKindOptions: DropdownOption<ResearchNote["kind"]>[] = [
  { value: "quote", label: "Direct quote" },
  { value: "paraphrase", label: "Paraphrase" },
];

const plural = (count: number, word: string) =>
  `${count} ${word}${count === 1 ? "" : "s"}`;
const LOOKUP_PRIVACY =
  "Look up sends only this identifier to Crossref, Open Library, or the website.";

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
  // The panel scrolls inside its host `.research-aside` (App.tsx), so the fade goes on that.
  useEffect(() => {
    const scroller = panel.current?.closest<HTMLElement>(".research-aside");
    return scroller ? watchScrollFade(scroller) : undefined;
  }, []);
  const latest = useRef(data);
  latest.current = data;
  const lookup = useLookup(latest, onChange);
  const { input, setInput, busy, status, notify, run: runLookup } = lookup;

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


  const patchSource = (id: string, patch: Partial<Source>) => onChange(patchSourceData(data, id, patch));
  const patchNote = (id: string, patch: Partial<ResearchNote>) => onChange(patchResearchNote(data, id, patch));
  const patchFootnote = (id: string, patch: Partial<Footnote>) => onChange(patchFootnoteData(data, id, patch));
  const deleteNote = (id: string) => onChange({ ...data, notes: data.notes.filter((n) => n.id !== id) });

  const lookupSource = async () => {
    const id = await runLookup();
    if (id) setOpenId(id);
  };

  const addManual = () => {
    const { data: next, id } = addManualSource(data);
    onChange(next); setOpenId(id); notify("");
  };

  const deleteSource = (source: Source) => {
    const result = removeSource(data, source.id);
    if ("error" in result) { notify(result.error, true); return; }
    onChange(result.data); setOpenId(null); notify("");
  };

  const citeHere = (source: Source) => {
    const { data: next, footnoteId: id } = addCitation(data, source.id);
    onChange(next); onInsertFootnote?.(id); setPendingFocus(id);
  };

  const insertTextOnly = () => {
    const { data: next, footnoteId: id } = addCitation(data, undefined);
    onChange(next); onInsertFootnote?.(id); setPendingFocus(id);
  };

  const addNote = () => {
    const id = crypto.randomUUID();
    onChange({ ...data, notes: [...data.notes, { id, kind: "personal", text: "" }] });
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
      const footnotes = data.footnotes.filter((f) => f.sourceId === source.id);
    const quotes = data.notes.filter((n) => n.sourceId === source.id);
    return (
      <div className="source-body" id={`${source.id}-panel`}>
        <SourceForm source={source} patch={patch} idPrefix={source.id} onError={notify} onAttachPdf={onAttachPdf} onOpenPdf={onOpenPdf} />
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
            <div className="repeat-rules">
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
                    void lookupSource();
                  }
                }}
              />
              <button
                type="button"
                className="button-primary"
                disabled={busy || !input.trim()}
                onClick={() => void lookupSource()}
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
          <div className="research-actions note-actions">
            <button type="button" onClick={addNote}>
              Add note
            </button>
          </div>
          {looseNotes.length === 0 && (
            <p className="research-hint">No notes yet.</p>
          )}
          {looseNotes.length > 0 && (
            <div className="note-list">
              {looseNotes.map((note) => (
                <div className="note-item" key={note.id}>
                  <div className="field">
                    <label htmlFor={`note-${note.id}-text`}>Note</label>
                    <textarea
                      id={`note-${note.id}-text`}
                      data-research-id={note.id}
                      rows={3}
                      placeholder="Write a note"
                      value={note.text}
                      onChange={(e) => patchNote(note.id, { text: e.target.value })}
                    />
                  </div>
                  <div className="note-row">
                    <div className="field note-source-field">
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
                </div>
              ))}
            </div>
          )}
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
