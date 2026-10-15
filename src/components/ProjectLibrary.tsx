import { BookOpen, Feather, Plus } from "lucide-react";
import type { Summary } from "../model";
import { desktop } from "../storage";
export function ProjectLibrary({
  projects,
  onCreate,
  onOpen,
  onImport,
}: {
  projects: Summary[];
  onCreate: () => void;
  onOpen: (id: string) => void;
  onImport: (file: File) => void;
}) {
  return (
    <main className="library">
      <div className="brand">
        <Feather size={24} /> folio<span>A place for your writing</span>
      </div>
      <div className="library-heading">
        <div className="eyebrow">YOUR WORKSPACE</div>
        <h1>Room for your next idea.</h1>
        <p>Every draft, every fragment, every possibility. All yours.</p>
      </div>
      <button className="primary" onClick={onCreate}>
        <Plus size={17} /> New writing project
      </button>
      <div className="project-list">
        {projects.map((p) => (
          <button key={p.id} onClick={() => onOpen(p.id)}>
            <BookOpen size={21} />
            <span>
              <strong>{p.title}</strong>
              <small>
                Last written {new Date(p.updatedAt).toLocaleDateString()}
              </small>
            </span>
            <span>→</span>
          </button>
        ))}
      </div>
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
