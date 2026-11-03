import { useEffect, useRef, useState, type CSSProperties, type KeyboardEvent } from "react";
import { useScrollFade } from "../components/scrollFade";
import { X } from "lucide-react";
import { Dropdown } from "../components/Dropdown";
import { Field, Preview, Cite } from "./Cite";
import { SourceForm } from "./SourceForm";
import { useLookup } from "./useLookup";
import { addCitation, addManualSource, patchFootnote, patchSource } from "./citationActions";
import { citationParts, footnoteParts } from "./citations";
import type { CitationContext } from "./noteForms";
import type { NoteForm, ResearchData } from "./types";
import "./citation-card.css";
import "../components/scroll-fade.css";

type Stage = "new" | "preview" | "cited";

/**
 * The floating citation card: one citation at a time. new (look up or enter
 * manually) -> preview (review, Cite here) -> cited (Page, Note form, Add another).
 * With footnoteId it opens straight in "cited" to edit that footnote. All citation
 * logic lives in citationActions / useLookup / SourceForm; this file only sequences it.
 */
export function CitationCard({
  data, onChange, onInsertFootnote, footnoteId, citationContext = {}, width, onOpenFullPanel, onClose, animateIn = false,
}: {
  data: ResearchData;
  onChange: (data: ResearchData) => void;
  onInsertFootnote?: (footnoteId: string) => void;
  footnoteId?: string;
  citationContext?: CitationContext;
  width: number;
  onOpenFullPanel: (target: { sourceId?: string; footnoteId?: string }) => void;
  onClose: () => void;
  /** Fade/slide in. Leave off when the card was opened from the keyboard (never animate a key action). */
  animateIn?: boolean;
}) {
  const latest = useRef(data);
  latest.current = data;
  const lookup = useLookup(latest, onChange);
  const [stage, setStage] = useState<Stage>(footnoteId ? "cited" : "new");
  const [sourceId, setSourceId] = useState<string | undefined>();
  const [citedId, setCitedId] = useState<string | undefined>(footnoteId);
  const [announce, setAnnounce] = useState("");
  const [shown, setShown] = useState(!animateIn);
  const root = useRef<HTMLDivElement>(null);
  const body = useRef<HTMLDivElement>(null);
  useScrollFade(body);
  const lookupInput = useRef<HTMLInputElement>(null);
  const focusAfter = useRef<"lookup" | "page" | "title" | null>(footnoteId ? "page" : "lookup");

  const footnote = citedId ? data.footnotes.find((f) => f.id === citedId) : undefined;
  const source = data.sources.find((s) => s.id === (stage === "cited" ? footnote?.sourceId : sourceId));

  // A different footnote opens (footnote click while the card is already up): show that one.
  useEffect(() => {
    if (!footnoteId) return;
    setCitedId(footnoteId); setStage("cited"); setAnnounce("Editing citation"); focusAfter.current = "page";
  }, [footnoteId]);

  useEffect(() => {
    if (shown) return;
    const frame = requestAnimationFrame(() => setShown(true));
    return () => cancelAnimationFrame(frame);
  }, [shown]);

  // Focus placement after each state change. Runs after render so the target exists.
  useEffect(() => {
    const target = focusAfter.current;
    if (!target) return;
    focusAfter.current = null;
    const scope = root.current;
    if (!scope) return;
    if (target === "lookup") lookupInput.current?.focus();
    else if (target === "page") scope.querySelector<HTMLElement>(`[id$="-locator"], textarea[aria-label="Footnote text"]`)?.focus();
    else scope.querySelector<HTMLElement>(`[id$="-authors"], [id$="-title"]`)?.focus();
  });

  const say = (text: string) => setAnnounce(text);
  const notify = (text: string, error = false) => { setAnnounce(""); lookup.notify(text, error); };

  const runLookup = async () => {
    setAnnounce("");
    const id = await lookup.run();
    if (!id) return;
    setSourceId(id); setStage("preview"); focusAfter.current = "title";
  };
  const enterManually = () => {
    const result = addManualSource(latest.current);
    onChange(result.data);
    setSourceId(result.id); setStage("preview"); focusAfter.current = "title";
    notify(""); say("Enter the details, then choose Cite here");
  };
  const citeHere = () => {
    if (!source || !onInsertFootnote) return;
    const result = addCitation(latest.current, source.id);
    onChange(result.data);
    onInsertFootnote(result.footnoteId);
    setCitedId(result.footnoteId); setStage("cited"); focusAfter.current = "page";
    say("Citation inserted. Add a page number if needed.");
  };
  const addAnother = () => {
    setStage("new"); setSourceId(undefined); setCitedId(undefined);
    lookup.setInput(""); notify(""); say("Ready for another citation"); focusAfter.current = "lookup";
  };

  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key !== "Escape" || event.defaultPrevented) return;
    // An open Dropdown menu takes Escape first (it also stops propagation; this guards the portal case).
    if ((event.target as Element).closest?.('[role="listbox"]') || root.current?.querySelector('[aria-expanded="true"]')) return;
    event.preventDefault(); event.stopPropagation(); onClose();
  };

  const context = citedId ? citationContext[citedId] : undefined;
  const citedParts = footnote ? footnoteParts(footnote, data, context?.form, context?.locator) : [];
  const status = announce || lookup.status.text;
  const cardStyle = { width } as CSSProperties;
  // The dialog's name follows its heading; after Add another an edit card is an add card again.
  const heading = footnoteId && citedId === footnoteId ? "Edit citation" : "Add a citation";

  return (
    <div
      ref={root}
      className="citation-card"
      role="dialog"
      aria-label={heading}
      data-stage={stage}
      data-animate={animateIn ? "" : undefined}
      data-shown={shown ? "" : undefined}
      style={cardStyle}
      onKeyDown={onKeyDown}
    >
      <header className="citation-card-head">
        <h2 className="citation-card-title">{heading}</h2>
        <button type="button" className="icon-button" aria-label="Close citation card" title="Close" onClick={onClose}><X size={16} aria-hidden="true" /></button>
      </header>
      <div className="citation-card-body" ref={body}>
        {stage === "new" && (
          <div className="citation-card-section">
            <div className="field">
              <label htmlFor="citation-card-lookup">DOI, ISBN or web address</label>
              <input
                id="citation-card-lookup" ref={lookupInput} type="text" value={lookup.input} disabled={lookup.busy}
                onChange={(e) => lookup.setInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); void runLookup(); } }}
              />
            </div>
          </div>
        )}
        {stage === "preview" && source && (
          <div className="citation-card-section">
            <SourceForm source={source} patch={(value) => onChange(patchSource(latest.current, source.id, value))} idPrefix={`card-${source.id}`} onError={notify} variant="card" />
            <div className="citation-card-previews">
              <Preview label="Note" parts={citationParts(source, "full")} />
              <Preview label="Bibliography" parts={citationParts(source, "bibliography")} />
            </div>
          </div>
        )}
        {stage === "cited" && footnote && (
          <div className="citation-card-section">
            {source && <p className="citation-card-source">{source.title.trim() || "Untitled source"}</p>}
            {footnote.sourceId ? (
              <>
                <Field id={`card-${footnote.id}-locator`} label="Page" value={footnote.locator ?? ""} onChange={(locator) => onChange(patchFootnote(latest.current, footnote.id, { locator }))} />
                <div className="field">
                  <span className="field-label">Note form</span>
                  <Dropdown<NoteForm>
                    label="Note form" width="100%" value={footnote.form ?? (footnote.shortened ? "short" : "auto")}
                    options={[
                      { value: "auto", label: `Automatic (${context?.form === "ibid" ? "Ibid." : context?.form ?? "full"})` },
                      { value: "full", label: "Always full" },
                      { value: "short", label: "Always short" },
                    ]}
                    onChange={(form) => onChange(patchFootnote(latest.current, footnote.id, { form, shortened: undefined }))}
                  />
                </div>
              </>
            ) : (
              <div className="field">
                <label htmlFor={`card-${footnote.id}-text`}>Footnote text</label>
                <textarea id={`card-${footnote.id}-text`} aria-label="Footnote text" rows={3} value={footnote.text} onChange={(e) => onChange(patchFootnote(latest.current, footnote.id, { text: e.target.value }))} />
              </div>
            )}
            {citedParts.length > 0 && (
              <div className="preview"><span className="field-label">Preview</span><p className="citation-preview"><Cite parts={citedParts} /></p></div>
            )}
          </div>
        )}
      </div>
      <footer className="citation-card-foot">
        {stage === "new" && (
          <div className="citation-card-actions">
            <button type="button" disabled={lookup.busy || !lookup.input.trim()} onClick={() => void runLookup()}>Look up</button>
            <button type="button" disabled={lookup.busy} onClick={enterManually}>Enter manually</button>
          </div>
        )}
        {stage === "preview" && source && (
          <div className="citation-card-actions">
            <button type="button" className="citation-card-primary" disabled={!onInsertFootnote} title={onInsertFootnote ? undefined : "Open a section to cite"} onClick={citeHere}>Cite here</button>
            <button type="button" onClick={addAnother}>Start over</button>
          </div>
        )}
        {stage === "cited" && footnote && (
          <div className="citation-card-actions">
            <button type="button" onClick={addAnother}>Add another</button>
            <button type="button" onClick={onClose}>Done</button>
          </div>
        )}
        <p role="status" className={"citation-card-status" + (lookup.status.error && !announce ? " is-error" : "")}>{status}</p>
        <button type="button" className="citation-card-link" onClick={() => onOpenFullPanel({ sourceId: source?.id, footnoteId: stage === "cited" ? citedId : undefined })}>Open full research panel</button>
      </footer>
    </div>
  );
}
