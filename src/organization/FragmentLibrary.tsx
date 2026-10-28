import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { ChevronDown, ChevronRight, Trash2 } from "lucide-react";
import type { JSONContent } from "@tiptap/react";
import { storage } from "../storage";
import { entryWords, type Entry, type Project } from "../model";
import { Dropdown } from "../components/Dropdown";
import { FragmentEditor } from "./FragmentEditor";
import "./fragments.css";

type Section = { id: string; title: string };

export function FragmentLibrary({
  project,
  onOpen,
  onCopy,
  onTags,
  activeIds,
  onEdit,
  onInsert,
  onAppend,
  sections,
  onDelete,
}: {
  project: Project;
  onOpen: (id: string) => void;
  onCopy: (source: Project, fragment: Entry) => void;
  onTags: (id: string, tags: string[]) => void;
  /** Entries currently open in an editor pane; shown read-only here. */
  activeIds?: string[];
  onEdit?: (id: string, content: JSONContent, text: string) => void;
  onInsert?: (fragment: Entry) => void;
  onAppend?: (fragment: Entry, sectionId: string) => void;
  sections?: Section[];
  onDelete?: (fragment: Entry) => void;
}) {
  const [query, setQuery] = useState("");
  const [across, setAcross] = useState(false);
  const [others, setOthers] = useState<Project[]>([]);
  const [error, setError] = useState("");
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  useEffect(() => {
    if (!across) return;
    let cancelled = false;
    void (async () => {
      try {
        const list = await storage.list();
        const results = await Promise.all(
          list.projects
            .filter((p) => p.id !== project.id)
            .map((p) => storage.load(p.id)),
        );
        if (!cancelled) setOthers(results);
      } catch (e) {
        if (!cancelled) setError(String(e));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [across, project.id]);
  const scope = [project, ...(across ? others : [])].flatMap((p) =>
    p.entries.filter((e) => e.kind === "fragment").map((e) => ({ p, e })),
  );
  const needle = query.trim().toLowerCase();
  const rows = scope.filter(({ e }) =>
    (e.title + " " + e.text + " " + (e.tags ?? []).join(" "))
      .toLowerCase()
      .includes(needle),
  );
  const count = `${rows.length} ${rows.length === 1 ? "fragment" : "fragments"}`;
  return (
    <section className="fragment-library">
      <div className="fragment-controls">
        <input
          className="fragment-search"
          aria-label="Search fragments"
          placeholder="Search words or tags"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <label className="fragment-across">
          <input
            type="checkbox"
            checked={across}
            onChange={(e) => setAcross(e.target.checked)}
          />
          All projects
        </label>
      </div>
      <p className="fragment-count">{count}</p>
      {error && <p role="alert">{error}</p>}
      {rows.map(({ p, e }) => (
        <FragmentItem
          key={p.id + e.id}
          source={p}
          entry={e}
          current={p.id === project.id}
          active={!!activeIds?.includes(e.id)}
          open={expanded[p.id + e.id] ?? scope.length <= 3}
          onToggle={() =>
            setExpanded((x) => ({
              ...x,
              [p.id + e.id]: !(x[p.id + e.id] ?? scope.length <= 3),
            }))
          }
          onOpen={onOpen}
          onCopy={onCopy}
          onTags={onTags}
          onEdit={onEdit}
          onInsert={onInsert}
          onAppend={onAppend}
          sections={sections}
          onDelete={onDelete}
        />
      ))}
      {!rows.length && (
        <p className="fragment-empty">
          {needle
            ? `No fragments match “${query.trim()}”.`
            : "No fragments yet. Select text in a section and choose Keep as fragment (⌘⇧X)."}
        </p>
      )}
    </section>
  );
}

function FragmentItem({
  source,
  entry,
  current,
  active,
  open,
  onToggle,
  onOpen,
  onCopy,
  onTags,
  onEdit,
  onInsert,
  onAppend,
  sections,
  onDelete,
}: {
  source: Project;
  entry: Entry;
  current: boolean;
  active: boolean;
  open: boolean;
  onToggle: () => void;
  onOpen: (id: string) => void;
  onCopy: (source: Project, fragment: Entry) => void;
  onTags: (id: string, tags: string[]) => void;
  onEdit?: (id: string, content: JSONContent, text: string) => void;
  onInsert?: (fragment: Entry) => void;
  onAppend?: (fragment: Entry, sectionId: string) => void;
  sections?: Section[];
  onDelete?: (fragment: Entry) => void;
}) {
  const bodyRef = useRef<HTMLDivElement>(null);
  const [clamped, setClamped] = useState(false);
  const [appendTo, setAppendTo] = useState("");
  useLayoutEffect(() => {
    const el = bodyRef.current;
    setClamped(!open && !!el && el.scrollHeight > el.clientHeight + 1);
  });
  const target = sections?.some((s) => s.id === appendTo)
    ? appendTo
    : (sections?.[0]?.id ?? "");
  const editable = current && !active && open;
  const commitTags = (value: string) => {
    const tags = value
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    if (tags.join(",") !== (entry.tags ?? []).join(",")) onTags(entry.id, tags);
  };
  return (
    <article className="fragment-item">
      <div className="fragment-head">
        <h2>{entry.title}</h2>
        <button
          type="button"
          className="fragment-icon"
          aria-expanded={open}
          aria-label={(open ? "Collapse " : "Expand ") + entry.title}
          onClick={onToggle}
        >
          {open ? (
            <ChevronDown size={14} aria-hidden="true" />
          ) : (
            <ChevronRight size={14} aria-hidden="true" />
          )}
        </button>
      </div>
      <small className="fragment-meta">
        {source.title} --{" "}
        {entry.uses?.length
          ? `Used ${entry.uses.length} times`
          : "Not yet placed"}{" "}
        -- {entryWords(entry).toLocaleString()} words
      </small>
      {active && (
        <p className="fragment-note">Open in the main editor. Edit it there.</p>
      )}
      <div
        ref={bodyRef}
        className={
          "fragment-body" +
          (open ? "" : " is-collapsed") +
          (!open && clamped ? " is-clamped" : "")
        }
      >
        <FragmentEditor
          title={entry.title}
          content={entry.content}
          editable={editable}
          onEdit={
            editable && onEdit
              ? (content, text) => onEdit(entry.id, content, text)
              : undefined
          }
        />
      </div>
      {!open && clamped && (
        <button type="button" className="fragment-link" onClick={onToggle}>
          Show all
        </button>
      )}
      {current ? (
        <>
          <div className="fragment-actions">
            {onInsert && (
              <button
                type="button"
                className="fragment-link"
                aria-label={`Insert ${entry.title} at cursor`}
                onClick={() => onInsert(entry)}
              >
                Insert at cursor
              </button>
            )}
            {onAppend && sections && sections.length > 0 && (
              <>
                <Dropdown
                  className="fragment-section"
                  label={"Section to append " + entry.title + " to"}
                  width={150}
                  value={target}
                  options={sections.map((s) => ({
                    value: s.id,
                    label: s.title,
                  }))}
                  onChange={setAppendTo}
                />
                <button
                  type="button"
                  className="fragment-link"
                  aria-label={`Append ${entry.title} to section`}
                  onClick={() => onAppend(entry, target)}
                >
                  Append
                </button>
              </>
            )}
            <button
              type="button"
              className="fragment-link"
              onClick={() => onOpen(entry.id)}
            >
              Open in editor
            </button>
            {onDelete && (
              <button
                type="button"
                className="fragment-icon fragment-danger"
                aria-label={`Delete ${entry.title}`}
                title="Delete fragment"
                onClick={() => onDelete(entry)}
              >
                <Trash2 size={16} aria-hidden="true" />
              </button>
            )}
          </div>
          <label className="fragment-tags">
            <span>Tags</span>
            <input
              key={(entry.tags ?? []).join(",")}
              aria-label={"Tags for " + entry.title}
              defaultValue={(entry.tags ?? []).join(", ")}
              onBlur={(event) => commitTags(event.target.value)}
            />
          </label>
        </>
      ) : (
        <div className="fragment-actions">
          <button
            type="button"
            className="fragment-link"
            onClick={() => onCopy(source, entry)}
          >
            Copy into this project
          </button>
        </div>
      )}
    </article>
  );
}
