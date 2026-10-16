import { useState } from "react";
import { ChevronDown, Layers, List, Trash2 } from "lucide-react";
import type { Summary } from "../model";
import type { DamagedJournal } from "../save-queue";
import { desktop } from "../storage";
export function ProjectLibrary({
  projects,
  onCreate,
  onOpen,
  onDelete,
  onImport,
  damagedJournals,
  onExportJournal,
  onDiscardJournal,
  damagedFolders,
  path,
  onSetAside,
  templates,
}: {
  projects: Summary[];
  templates?: { id: string; name: string }[];
  onCreate: (templateId?: string) => void;
  onOpen: (id: string) => void;
  onDelete: (project: Summary) => void;
  onImport: (file: File) => void;
  damagedJournals: DamagedJournal[];
  onExportJournal: (d: DamagedJournal) => void;
  onDiscardJournal: (d: DamagedJournal) => void;
  damagedFolders: string[];
  path: string;
  onSetAside: (id: string) => void;
}) {
  const [view, setView] = useState<"list" | "cards">("list");
  const [sort, setSort] = useState("edited");
  const [reverse, setReverse] = useState(false);
  const [creating, setCreating] = useState(false);
  const added = (p: Summary) =>
    (p as Summary & { createdAt?: string }).createdAt;
  const sorted = [...projects].sort((a, b) =>
    sort === "name"
      ? a.title.localeCompare(b.title)
      : (sort === "added" ? (added(b) ?? "") : b.updatedAt).localeCompare(
          sort === "added" ? (added(a) ?? "") : a.updatedAt,
        ),
  );
  if (reverse) sorted.reverse();
  const date = (value?: string) =>
    value
      ? new Date(value).toLocaleDateString(undefined, {
          month: "short",
          day: "numeric",
          year: "numeric",
        })
      : "Unknown";
  return (
    <main className="library">
      <div className="brand">Personal Word</div>
      <div className="library-toolbar">
        <h1>Projects</h1>
        <div className="create-project">
          <button
            className="primary"
            aria-expanded={creating}
            onClick={() => setCreating(!creating)}
          >
            Start new project <ChevronDown size={14} />
          </button>
          {creating && (
            <div
              className="create-menu"
              onKeyDown={(e) => {
                if (e.key === "Escape") setCreating(false);
              }}
            >
              {(
                templates?.map((t) => [t.id, t.name]) ?? [
                  ["blank", "Blank project"],
                  ["essay", "Essay"],
                  ["chicago", "Chicago essay"],
                  ["screenplay", "Screenplay"],
                  ["story", "Story"],
                ]
              ).map(([id, label]) => (
                <button
                  key={id}
                  onClick={() => {
                    setCreating(false);
                    onCreate(id);
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="library-display">
          <label>
            Sort{" "}
            <select
              aria-label="Sort projects"
              value={sort}
              onChange={(e) => setSort(e.target.value)}
            >
              <option value="name">Name</option>
              <option value="added">Added</option>
              <option value="edited">Last edited</option>
            </select>
          </label>
          <button
            aria-label="Reverse project sort order"
            onClick={() => setReverse((value) => !value)}
          >
            {reverse ? "↑" : "↓"}
          </button>
          <button
            aria-label={
              view === "list" ? "Show project cards" : "Show project list"
            }
            onClick={() => setView(view === "list" ? "cards" : "list")}
          >
            {view === "list" ? <Layers size={17} /> : <List size={17} />}
          </button>
        </div>
      </div>
      <div className={"project-list project-list--" + view}>
        {sorted.map((p) => (
          <div className="project-row" key={p.id}>
            <button onClick={() => onOpen(p.id)}>
              <strong className="project-name">-- {p.title}</strong>
              <span className="project-dates">
                <span>Added {date(added(p))}</span>
                <span>--</span>
                <span>Last Edited {date(p.updatedAt)}</span>
              </span>
            </button>
            <button
              className="delete-entry"
              aria-label={"Delete project " + p.title}
              title="Delete project"
              onClick={() => onDelete(p)}
            >
              <Trash2 size={14} />
            </button>
          </div>
        ))}
        {!projects.length && <p className="library-empty">No projects yet.</p>}
      </div>
      {(damagedJournals.length > 0 || damagedFolders.length > 0) && (
        <div className="damaged" role="region" aria-label="Needs attention">
          <div className="eyebrow">NEEDS ATTENTION</div>
          {damagedJournals.map((d) => (
            <div className="damaged-row" key={d.key}>
              <span>
                <strong>Damaged recovery journal</strong>
                <small>
                  {d.key.replace("folio.recovery.", "")} -- {d.message}
                </small>
              </span>
              <button onClick={() => onExportJournal(d)}>Export</button>
              <button onClick={() => onDiscardJournal(d)}>Discard</button>
            </div>
          ))}
          {damagedFolders.map((id) => (
            <div className="damaged-row" key={id}>
              <span>
                <strong>Project folder cannot be opened</strong>
                <small>
                  Keep a copy of {path}/{id}, then recover it from its
                  project.json or a snapshots/ file using the import below.
                </small>
              </span>
              <button onClick={() => onSetAside(id)}>Set aside</button>
            </div>
          ))}
        </div>
      )}
      <label className="import">
        Recover from a project.json file
        <input
          type="file"
          accept=".json"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) onImport(file);
          }}
        />
      </label>
      <p className="storage-note">
        {desktop
          ? "Your writing stays on this Mac."
          : "Browser preview -- writing is stored in this browser only."}
      </p>
    </main>
  );
}
