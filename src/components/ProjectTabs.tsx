import { X } from "lucide-react";
export type ProjectTab = { id: string; title: string };
export function ProjectTabs({
  tabs,
  activeId,
  onSelect,
  onClose,
  onLibrary,
}: {
  tabs: ProjectTab[];
  activeId: string;
  onSelect: (id: string) => void;
  onClose: (id: string) => void;
  onLibrary: () => void;
}) {
  return (
    <nav className="project-tabs" aria-label="Open projects">
      <button onClick={onLibrary} className="tabs-library">
        Projects
      </button>
      {tabs.map((tab) => (
        <div
          key={tab.id}
          className={"project-tab " + (tab.id === activeId ? "active" : "")}
        >
          <button
            aria-current={tab.id === activeId ? "page" : undefined}
            onClick={() => onSelect(tab.id)}
          >
            {tab.title}
          </button>
          <button
            aria-label={"Close " + tab.title}
            onClick={() => onClose(tab.id)}
          >
            <X size={16} />
          </button>
        </div>
      ))}
    </nav>
  );
}
