import { useState } from "react";
import type { Annotation, Project } from "../model";
export function CommentsPanel({
  project,
  onChange,
  onJump,
  onAdd,
}: {
  project: Project;
  onChange: (items: Annotation[]) => void;
  onJump: (id: string, quote: string) => void;
  onAdd: () => void;
}) {
  const [all, setAll] = useState(false);
  const items = project.annotations ?? [];
  return (
    <section className="feature-panel">
      <header>
        <h1>Comments & tasks</h1>
        <button onClick={onAdd}>Add task</button>
      </header>
      <label>
        <input
          type="checkbox"
          checked={all}
          onChange={(e) => setAll(e.target.checked)}
        />{" "}
        Show resolved
      </label>
      {items
        .filter((a) => all || !a.resolved)
        .map((a) => {
          const entry = project.entries.find((e) => e.id === a.entryId);
          const detached =
            !entry || (!!a.quote && !entry.text.includes(a.quote));
          return (
            <article className="feature-item" key={a.id}>
              <label>
                <input
                  type="checkbox"
                  checked={a.resolved}
                  onChange={(e) =>
                    onChange(
                      items.map((x) =>
                        x.id === a.id
                          ? { ...x, resolved: e.target.checked }
                          : x,
                      ),
                    )
                  }
                />
                {a.text}
              </label>
              <small>
                {a.kind} -- {entry?.title ?? "Removed section"}
                {detached ? " -- Detached from text" : ""}
              </small>
              {a.quote && <blockquote>{a.quote}</blockquote>}
              <button
                disabled={!entry}
                onClick={() => onJump(a.entryId, a.quote)}
              >
                Go to passage
              </button>
              <button
                onClick={() => onChange(items.filter((x) => x.id !== a.id))}
              >
                Delete
              </button>
            </article>
          );
        })}
      {!items.some((a) => all || !a.resolved) && (
        <p>No unresolved comments or tasks.</p>
      )}
    </section>
  );
}
