import { useState } from "react";
import type { Entry, Project } from "../model";

export function RevisionComparison({
  before,
  current,
  onRestore,
}: {
  before: Project;
  current: Project;
  onRestore: (entry: Entry, blockIndex?: number) => void;
}) {
  const [selected, setSelected] = useState(
    before.order[0] ?? before.entries[0]?.id ?? "",
  );
  const old = before.entries.find((e) => e.id === selected);
  const live = current.entries.find((e) => e.id === selected);
  return (
    <div className="revision-comparison">
      <label>
        Compare section{" "}
        <select value={selected} onChange={(e) => setSelected(e.target.value)}>
          {before.entries.map((e) => (
            <option key={e.id} value={e.id}>
              {e.title}
            </option>
          ))}
        </select>
      </label>
      {old && (
        <>
          <div className="revision-columns">
            <section>
              <h3>Snapshot</h3>
              {old.content.content?.map((block, i) => (
                <div className="revision-block" key={i}>
                  <p
                    className={
                      JSON.stringify(block) !==
                      JSON.stringify(live?.content.content?.[i])
                        ? "revision-removed"
                        : ""
                    }
                  >
                    {blockText(block)}
                  </p>
                  <button onClick={() => onRestore(old, i)}>
                    Restore passage {i + 1}
                  </button>
                </div>
              ))}
            </section>
            <section>
              <h3>Current</h3>
              {live?.content.content?.map((block, i) => (
                <p
                  className={
                    JSON.stringify(block) !==
                    JSON.stringify(old.content.content?.[i])
                      ? "revision-added"
                      : ""
                  }
                  key={i}
                >
                  {blockText(block)}
                </p>
              )) ?? <p>This section has been removed.</p>}
            </section>
          </div>
          <button onClick={() => onRestore(old)}>Restore this section</button>
          <p className="panel-help">
            Changed paragraphs are highlighted. Restoring a passage replaces the
            paragraph at the same position; restoring a section includes its
            formatting. A safety snapshot is kept first.
          </p>
        </>
      )}
    </div>
  );
}
function blockText(node: { text?: string; content?: any[] }): string {
  return node.text ?? node.content?.map(blockText).join("") ?? "";
}
