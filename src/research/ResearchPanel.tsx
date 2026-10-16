import { useState } from "react";
import { citationGuidance, footnoteText, formatCitation } from "./citations";
import {
  emptyResearch,
  type ResearchData,
  type Source,
  type ResearchNote,
} from "./types";
import "./research.css";
export function ResearchPanel({
  data = emptyResearch(),
  onChange,
  onInsertFootnote,
  onInsertNote,
  initialTab = "sources",
}: {
  data?: ResearchData;
  onChange: (data: ResearchData) => void;
  onInsertFootnote?: (id: string) => void;
  onInsertNote?: (note: ResearchNote) => void;
  initialTab?: "sources" | "notes" | "footnotes";
}) {
  const [tab, setTab] = useState<"sources" | "notes" | "footnotes">(initialTab);
  const [selected, setSelected] = useState("");
  const [message, setMessage] = useState("");
  const updateSource = (source: Source) =>
    onChange({
      ...data,
      sources: data.sources.map((s) => (s.id === source.id ? source : s)),
    });
  const addNote = () =>
    onChange({
      ...data,
      notes: [
        ...data.notes,
        { id: crypto.randomUUID(), kind: "personal", text: "" },
      ],
    });
  const source = data.sources.find((s) => s.id === selected);
  return (
    <section className="research-panel" aria-label="Research workspace">
      <div className="research-tabs">
        {(["sources", "notes", "footnotes"] as const).map((t) => (
          <button key={t} aria-pressed={tab === t} onClick={() => setTab(t)}>
            {t}
          </button>
        ))}
      </div>
      {tab === "sources" && (
        <>
          <p>
            Chicago 18 notes and bibliography --{" "}
            <a
              href={citationGuidance.citation}
              target="_blank"
              rel="noreferrer"
            >
              Citation guide
            </a>
          </p>
          <button
            onClick={() => {
              const id = crypto.randomUUID();
              onChange({
                ...data,
                sources: [
                  ...data.sources,
                  { id, kind: "book", title: "", authors: [] },
                ],
              });
              setSelected(id);
            }}
          >
            Add source
          </button>
          <select
            aria-label="Source"
            value={selected}
            onChange={(e) => setSelected(e.target.value)}
          >
            <option value="">Choose a source</option>
            {data.sources.map((s) => (
              <option key={s.id} value={s.id}>
                {s.title || "Untitled source"}
              </option>
            ))}
          </select>
          {source && (
            <div className="research-form">
              <label>
                Type
                <select
                  value={source.kind}
                  onChange={(e) =>
                    updateSource({
                      ...source,
                      kind: e.target.value as Source["kind"],
                    })
                  }
                >
                  <option value="book">Book</option>
                  <option value="journal">Journal article</option>
                  <option value="website">Website</option>
                </select>
              </label>
              <label>
                Authors -- one natural-order name per line
                <textarea
                  value={source.authors.join("\n")}
                  onChange={(e) =>
                    updateSource({
                      ...source,
                      authors: e.target.value.split("\n"),
                    })
                  }
                />
              </label>
              {(
                [
                  "title",
                  ...(source.kind === "book"
                    ? ["publisher"]
                    : source.kind === "journal"
                      ? ["journal", "volume", "issue", "pages"]
                      : ["website"]),
                  "year",
                  "url",
                  "doi",
                  "accessed",
                ] as (keyof Source)[]
              ).map((key) => (
                <label key={key}>
                  {key === "pages"
                    ? "Article page range"
                    : key === "year"
                      ? "Publication date / year"
                      : key}
                  <input
                    value={String(source[key] ?? "")}
                    onChange={(e) =>
                      updateSource({ ...source, [key]: e.target.value })
                    }
                  />
                </label>
              ))}
              <p className="citation-preview">
                {formatCitation(source, "bibliography")}
              </p>
              <button
                onClick={() => {
                  if (
                    data.footnotes.some((n) => n.sourceId === source.id) ||
                    data.notes.some((n) => n.sourceId === source.id)
                  ) {
                    setMessage(
                      "Remove this source from linked notes before deleting it.",
                    );
                    return;
                  }
                  onChange({
                    ...data,
                    sources: data.sources.filter((s) => s.id !== source.id),
                  });
                  setSelected("");
                }}
              >
                Delete source
              </button>
            </div>
          )}
        </>
      )}
      {tab === "notes" && (
        <>
          <button onClick={addNote}>Add research note</button>
          {data.notes.map((n) => (
            <article key={n.id}>
              <label>
                Note type
                <select
                  value={n.kind}
                  onChange={(e) =>
                    onChange({
                      ...data,
                      notes: data.notes.map((x) =>
                        x.id === n.id
                          ? { ...x, kind: e.target.value as typeof n.kind }
                          : x,
                      ),
                    })
                  }
                >
                  <option value="quote">Direct quote</option>
                  <option value="paraphrase">Paraphrase</option>
                  <option value="personal">Personal note</option>
                </select>
              </label>
              <textarea
                aria-label="Research note text"
                value={n.text}
                onChange={(e) =>
                  onChange({
                    ...data,
                    notes: data.notes.map((x) =>
                      x.id === n.id ? { ...x, text: e.target.value } : x,
                    ),
                  })
                }
              />
              <label>
                Source
                <select
                  value={n.sourceId ?? ""}
                  onChange={(e) =>
                    onChange({
                      ...data,
                      notes: data.notes.map((x) =>
                        x.id === n.id
                          ? { ...x, sourceId: e.target.value || undefined }
                          : x,
                      ),
                    })
                  }
                >
                  <option value="">No source</option>
                  {data.sources.map((s) => (
                    <option value={s.id} key={s.id}>
                      {s.title}
                    </option>
                  ))}
                </select>
              </label>
              <input
                aria-label="Note page or locator"
                placeholder="Page / locator"
                value={n.locator ?? ""}
                onChange={(e) =>
                  onChange({
                    ...data,
                    notes: data.notes.map((x) =>
                      x.id === n.id ? { ...x, locator: e.target.value } : x,
                    ),
                  })
                }
              />
              <button
                disabled={!onInsertNote || !n.text.trim()}
                onClick={() => onInsertNote?.(n)}
              >
                Insert into writing
              </button>
              <button
                onClick={() =>
                  onChange({
                    ...data,
                    notes: data.notes.filter((x) => x.id !== n.id),
                  })
                }
              >
                Delete note
              </button>
            </article>
          ))}
        </>
      )}
      {tab === "footnotes" && (
        <>
          <p>
            References keep stable IDs. Export numbers them in document order.
            Place the cursor in your text before inserting.
          </p>
          <button
            disabled={!onInsertFootnote}
            onClick={() => {
              const id = crypto.randomUUID();
              onChange({
                ...data,
                footnotes: [...data.footnotes, { id, text: "" }],
              });
              onInsertFootnote?.(id);
            }}
          >
            Insert footnote at cursor
          </button>
          {data.footnotes.map((n) => (
            <article key={n.id}>
              <textarea
                aria-label="Footnote text"
                value={n.text}
                onChange={(e) =>
                  onChange({
                    ...data,
                    footnotes: data.footnotes.map((x) =>
                      x.id === n.id ? { ...x, text: e.target.value } : x,
                    ),
                  })
                }
              />
              <label>
                Cited source
                <select
                  value={n.sourceId ?? ""}
                  onChange={(e) =>
                    onChange({
                      ...data,
                      footnotes: data.footnotes.map((x) =>
                        x.id === n.id
                          ? { ...x, sourceId: e.target.value || undefined }
                          : x,
                      ),
                    })
                  }
                >
                  <option value="">Text only</option>
                  {data.sources.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.title}
                    </option>
                  ))}
                </select>
              </label>
              <input
                aria-label="Footnote page or locator"
                placeholder="Page / locator"
                value={n.locator ?? ""}
                onChange={(e) =>
                  onChange({
                    ...data,
                    footnotes: data.footnotes.map((x) =>
                      x.id === n.id ? { ...x, locator: e.target.value } : x,
                    ),
                  })
                }
              />
              <label>
                <input
                  type="checkbox"
                  checked={n.shortened ?? false}
                  onChange={(e) =>
                    onChange({
                      ...data,
                      footnotes: data.footnotes.map((x) =>
                        x.id === n.id
                          ? { ...x, shortened: e.target.checked }
                          : x,
                      ),
                    })
                  }
                />
                Shortened citation
              </label>
              <p className="citation-preview">
                {footnoteText(n, data) || "Write a note or choose a source."}
              </p>
            </article>
          ))}
        </>
      )}
      {message && <p role="status">{message}</p>}
      <p className="research-help">
        Citation assistance covers common books, journal articles, and websites.
        Review names, dates, titles, and special cases against the guide.{" "}
        <a href={citationGuidance.layout} target="_blank" rel="noreferrer">
          Student paper layout
        </a>
      </p>
    </section>
  );
}
