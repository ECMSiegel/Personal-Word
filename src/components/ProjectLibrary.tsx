import { Feather, Plus, Trash2 } from "lucide-react";
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
}: {
  projects: Summary[];
  onCreate: () => void;
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
  return (
    <main className="library">
      <div className="brand">
        <Feather size={24} /> Personal Word<span>A place for your writing</span>
      </div>
      <div className="library-heading">
        <div className="eyebrow">YOUR WORKSPACE</div>
        <h1>Your writing.</h1>
        <p>A place for every draft and every idea.</p>
      </div>
      <button className="primary" onClick={onCreate}>
        <Plus size={17} /> New writing project
      </button>
      <div className="project-list">
        {projects.map((p) => (
          <div className="project-row" key={p.id}>
            <button onClick={() => onOpen(p.id)}>
              <span className="project-folder" aria-hidden="true">
                <i />
              </span>
              <span>
                <strong>{p.title}</strong>
                <small>
                  Last written {new Date(p.updatedAt).toLocaleDateString()}
                </small>
              </span>
              <span>→</span>
            </button>
            <button
              className="delete-entry"
              aria-label={"Delete project " + p.title}
              title="Delete project"
              onClick={() => onDelete(p)}
            >
              <Trash2 size={16} />
            </button>
          </div>
        ))}
      </div>
      {(damagedJournals.length > 0 || damagedFolders.length > 0) && (
        <div className="damaged" role="region" aria-label="Needs attention">
          <div className="eyebrow">NEEDS ATTENTION</div>
          {damagedJournals.map((d) => (
            <div className="damaged-row" key={d.key}>
              <span>
                <strong>Damaged recovery journal</strong>
                <small>
                  {d.key.replace("folio.recovery.", "")} · {d.message}
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
          : "Browser preview · writing is stored in this browser only."}
      </p>
    </main>
  );
}
