import { useEffect, useState } from "react";
import { storage } from "../storage";
import type { Entry, Project } from "../model";
export function FragmentLibrary({
  project,
  onOpen,
  onCopy,
  onTags,
}: {
  project: Project;
  onOpen: (id: string) => void;
  onCopy: (source: Project, fragment: Entry) => void;
  onTags: (id: string, tags: string[]) => void;
}) {
  const [query, setQuery] = useState("");
  const [across, setAcross] = useState(false);
  const [others, setOthers] = useState<Project[]>([]);
  const [error, setError] = useState("");
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
  const rows = [project, ...(across ? others : [])]
    .flatMap((p) =>
      p.entries.filter((e) => e.kind === "fragment").map((e) => ({ p, e })),
    )
    .filter(({ e }) =>
      (e.title + " " + e.text + " " + (e.tags ?? []).join(" "))
        .toLowerCase()
        .includes(query.toLowerCase()),
    );
  return (
    <section className="feature-panel">
      <h1>Fragments</h1>
      <div className="feature-controls">
        <input
          aria-label="Search fragments"
          placeholder="Search words or tags"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <label>
          <input
            type="checkbox"
            checked={across}
            onChange={(e) => setAcross(e.target.checked)}
          />{" "}
          All projects
        </label>
      </div>
      {error && <p role="alert">{error}</p>}
      {rows.map(({ p, e }) => (
        <article className="feature-item" key={p.id + e.id}>
          <h2>{e.title}</h2>
          <small>
            {p.title} --{" "}
            {e.uses?.length ? `Used ${e.uses.length} times` : "Not yet placed"}
          </small>
          <p className="fragment-preview">{e.text}</p>
          {p.id === project.id ? (
            <>
              <label>
                Tags{" "}
                <input
                  aria-label={"Tags for " + e.title}
                  defaultValue={(e.tags ?? []).join(", ")}
                  onBlur={(event) =>
                    onTags(
                      e.id,
                      event.target.value
                        .split(",")
                        .map((s) => s.trim())
                        .filter(Boolean),
                    )
                  }
                />
              </label>
              <button onClick={() => onOpen(e.id)}>Open fragment</button>
            </>
          ) : (
            <button onClick={() => onCopy(p, e)}>Copy into this project</button>
          )}
        </article>
      ))}
      {!rows.length && <p>No matching fragments.</p>}
    </section>
  );
}
