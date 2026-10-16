import {
  BookOpen,
  ChevronDown,
  Plus,
  FileText,
  Scissors,
  History,
  ArrowUp,
  ArrowDown,
  Feather,
  Search,
} from "lucide-react";
import { words, type Project, type Entry } from "../model";
import { desktop } from "../storage";
type Props = {
  project: Project;
  active: string;
  mode: "write" | "read";
  query: string;
  onQuery: (q: string) => void;
  onLibrary: () => void;
  onAdd: (kind: Entry["kind"]) => void;
  onSelect: (id: string) => void;
  onRename: (e: Entry) => void;
  onReorder: (id: string, to: number) => void;
  onRead: () => void;
  onVersions: () => void;
};
export function ProjectSidebar({
  project,
  active,
  mode,
  query,
  onQuery,
  onLibrary,
  onAdd,
  onSelect,
  onRename,
  onReorder,
  onRead,
  onVersions,
}: Props) {
  const sections = project.order
    .map((id) => project.entries.find((e) => e.id === id)!)
    .filter(Boolean);
  const total = sections.reduce((n, e) => n + words(e.text), 0);
  const matches = (e: Entry) =>
    !query ||
    (e.title + " " + e.text).toLowerCase().includes(query.toLowerCase());
  return (
    <aside className="sidebar">
      <div className="brand">
        <Feather size={19} /> Personal Word
      </div>
      <button
        className="project-switch"
        title="All projects"
        onClick={onLibrary}
      >
        <span>{project.title}</span>
        <ChevronDown size={16} />
      </button>
      <div className="local-label">
        <span /> {desktop ? "On this Mac" : "Browser preview"}
      </div>
      <div className="search">
        <Search size={14} />
        <input
          aria-label="Search project"
          placeholder="Find in project"
          value={query}
          onChange={(e) => onQuery(e.target.value)}
        />
        <kbd>⌘K</kbd>
      </div>
      <div className="group-heading">
        <span>MANUSCRIPT</span>
        <button
          title="New section (⌘⇧N)"
          aria-label="New section"
          onClick={() => onAdd("section")}
        >
          <Plus size={16} />
        </button>
      </div>
      <div className="entry-list">
        {sections.filter(matches).map((e) => (
          <div
            className={
              "entry-row " +
              (active === e.id && mode === "write" ? "selected" : "")
            }
            key={e.id}
            draggable
            onDragStart={(event) =>
              event.dataTransfer.setData("text/folio-section", e.id)
            }
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => {
              event.preventDefault();
              const id = event.dataTransfer.getData("text/folio-section");
              if (project.order.includes(id))
                onReorder(id, project.order.indexOf(e.id));
            }}
          >
            <button
              className="entry-main"
              onClick={() => {
                onSelect(e.id);
              }}
              onDoubleClick={() => onRename(e)}
            >
              <FileText size={15} />
              <span>{e.title}</span>
              <small>{words(e.text)}</small>
            </button>
            <div className="reorder">
              <button
                aria-label={"Move " + e.title + " up"}
                disabled={project.order[0] === e.id}
                onClick={() => onReorder(e.id, project.order.indexOf(e.id) - 1)}
              >
                <ArrowUp size={12} />
              </button>
              <button
                aria-label={"Move " + e.title + " down"}
                disabled={project.order.at(-1) === e.id}
                onClick={() => onReorder(e.id, project.order.indexOf(e.id) + 1)}
              >
                <ArrowDown size={12} />
              </button>
            </div>
          </div>
        ))}
      </div>
      <button
        className={"read-button " + (mode === "read" ? "selected" : "")}
        onClick={() => onRead()}
      >
        <BookOpen size={15} /> Read manuscript
      </button>
      <div className="group-heading fragment-heading">
        <span>FRAGMENTS</span>
        <button
          aria-label="New fragment"
          title="New fragment"
          onClick={() => onAdd("fragment")}
        >
          <Plus size={16} />
        </button>
      </div>
      <div className="entry-list fragments">
        {project.entries
          .filter((e) => e.kind === "fragment")
          .filter(matches)
          .map((e) => (
            <button
              key={e.id}
              className={
                "entry-main " +
                (active === e.id && mode === "write" ? "selected" : "")
              }
              onClick={() => {
                onSelect(e.id);
              }}
            >
              <Scissors size={14} />
              <span>{e.title}</span>
            </button>
          ))}
        {!project.entries.some((e) => e.kind === "fragment") && (
          <p className="empty-hint">
            Good words don't have to fit yet.
            <br />
            Keep them here for later.
          </p>
        )}
      </div>
      <div className="sidebar-bottom">
        <button onClick={() => onVersions()}>
          <History size={16} /> Snapshots & history
        </button>
        <div>
          <span>{sections.length} sections</span>
          <span>{total.toLocaleString()} words</span>
        </div>
      </div>
    </aside>
  );
}
