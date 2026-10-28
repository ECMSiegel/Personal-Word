import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { ChevronDown, Layers, List, Search, Trash2 } from "lucide-react";
import type { Summary } from "../model";
import type { DamagedJournal } from "../save-queue";
import { desktop } from "../storage";
import {
  baseName,
  dropProblem,
  listenForNativeDrops,
  readDroppedPath,
} from "../import/dropImport";
import { Dropdown } from "./Dropdown";
import { Popover, PopoverItem } from "./Popover";
import { play } from "../motion";
import "./library.css";
export function ProjectLibrary({
  projects,
  onCreate,
  onOpen,
  onDelete,
  onImport,
  onImportWriting,
  damagedJournals,
  onExportJournal,
  onDiscardJournal,
  damagedFolders,
  path,
  onSetAside,
  templates,
  dropEnabled,
  onDropError,
}: {
  projects: Summary[];
  templates?: { id: string; name: string }[];
  onCreate: (templateId?: string) => void;
  onOpen: (id: string) => void;
  onDelete: (project: Summary) => void;
  onImport: (file: File) => void;
  onImportWriting: (file: File) => void;
  damagedJournals: DamagedJournal[];
  onExportJournal: (d: DamagedJournal) => void;
  onDiscardJournal: (d: DamagedJournal) => void;
  damagedFolders: string[];
  path: string;
  onSetAside: (id: string) => void;
  dropEnabled: boolean;
  onDropError: (message: string) => void;
}) {
  const [view, setView] = useState<"list" | "cards">("list");
  const [sort, setSort] = useState("edited");
  const [reverse, setReverse] = useState(false);
  const [creating, setCreating] = useState(false);
  const [searching, setSearching] = useState(false);
  const [query, setQuery] = useState("");
  const createButton = useRef<HTMLButtonElement>(null);
  const createPanel = useRef<HTMLDivElement>(null);
  const writingInput = useRef<HTMLInputElement>(null);
  const projectInput = useRef<HTMLInputElement>(null);
  const createFade = useRef<Animation | null>(null);
  const searchButton = useRef<HTMLButtonElement>(null);
  const searchInput = useRef<HTMLInputElement>(null);
  const [dropping, setDropping] = useState(false);
  const dragDepth = useRef(0);
  // The native listener lives as long as the screen; it reads the latest props here.
  const latest = useRef({ dropEnabled, onDropError, onImportWriting });
  latest.current = { dropEnabled, onDropError, onImportWriting };
  const added = (p: Summary) =>
    (p as Summary & { createdAt?: string }).createdAt;
  const needle = query.trim().toLocaleLowerCase();
  const sorted = projects
    .filter((p) => p.title.toLocaleLowerCase().includes(needle))
    .sort((a, b) =>
    sort === "name"
      ? a.title.localeCompare(b.title)
      : (sort === "added" ? (added(b) ?? "") : b.updatedAt).localeCompare(
          sort === "added" ? (added(a) ?? "") : a.updatedAt,
        ),
  );
  if (reverse) sorted.reverse();
  useLayoutEffect(() => {
    if (!creating) return;
    createPanel.current?.querySelector<HTMLButtonElement>("button")?.focus();
  }, [creating]);
  const previousCreating = useRef(creating);
  useEffect(() => {
    if (previousCreating.current === creating) return;
    previousCreating.current = creating;
    const trigger = createButton.current;
    // The menu covers the trigger; fade it out on open and back in on close.
    // Under reduced motion the menu simply covers it with no animation.
    if (!trigger) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      createFade.current?.cancel();
      createFade.current = null;
      trigger.style.removeProperty("opacity");
      return;
    }
    if (createFade.current) {
      createFade.current.reverse();
      return;
    }
    createFade.current = play(trigger, [{ opacity: 1 }, { opacity: 0 }], {
      speed: "fast",
      easing: "out",
      fill: "both",
    });
  }, [creating]);
  useEffect(() => () => createFade.current?.cancel(), []);
  useEffect(() => {
    if (desktop) {
      let disposed = false;
      let unlisten: (() => void) | undefined;
      void listenForNativeDrops({
        onHover: (over) => setDropping(over && latest.current.dropEnabled),
        onDrop: (paths) => {
          const { dropEnabled, onDropError, onImportWriting } = latest.current;
          if (!dropEnabled || !paths.length) return;
          const problem = dropProblem(paths.map(baseName));
          if (problem) return onDropError(problem);
          readDroppedPath(paths[0]).then(onImportWriting, (error) =>
            onDropError(String(error)),
          );
        },
      }).then((off) => {
        if (disposed) off();
        else unlisten = off;
      });
      return () => {
        disposed = true;
        unlisten?.();
      };
    }
    // Browser preview: a file dropped outside the screen must not replace the page.
    const block = (e: DragEvent) => e.preventDefault();
    document.addEventListener("dragover", block);
    document.addEventListener("drop", block);
    return () => {
      document.removeEventListener("dragover", block);
      document.removeEventListener("drop", block);
    };
  }, []);
  const hasFiles = (e: React.DragEvent) =>
    e.dataTransfer.types.includes("Files");
  const onDragEnter = (e: React.DragEvent) => {
    if (!hasFiles(e)) return;
    dragDepth.current += 1;
    setDropping(dropEnabled);
  };
  const onDragLeave = (e: React.DragEvent) => {
    if (!hasFiles(e)) return;
    dragDepth.current = Math.max(0, dragDepth.current - 1);
    if (!dragDepth.current) setDropping(false);
  };
  const onDrop = (e: React.DragEvent) => {
    if (!hasFiles(e)) return;
    e.preventDefault();
    dragDepth.current = 0;
    setDropping(false);
    if (!dropEnabled) return;
    const files = [...e.dataTransfer.files];
    const problem = dropProblem(files.map((f) => f.name));
    if (problem) onDropError(problem);
    else onImportWriting(files[0]);
  };
  const closeCreate = (refocus: boolean) => {
    setCreating(false);
    if (refocus) createButton.current?.focus();
  };
  const onPanelKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      e.stopPropagation();
      return closeCreate(true);
    }
    const items = [
      ...(createPanel.current?.querySelectorAll<HTMLButtonElement>("button") ??
        []),
    ];
    const at = items.indexOf(document.activeElement as HTMLButtonElement);
    const target =
      e.key === "ArrowDown"
        ? items[(at + 1) % items.length]
        : e.key === "ArrowUp"
          ? items[(at - 1 + items.length) % items.length]
          : e.key === "Home"
            ? items[0]
            : e.key === "End"
              ? items[items.length - 1]
              : null;
    if (!target) return;
    e.preventDefault();
    target.focus();
  };
  const closeSearch = (refocus: boolean) => {
    setQuery("");
    setSearching(false);
    if (refocus) searchButton.current?.focus();
  };
  const date = (value?: string) =>
    value
      ? new Date(value).toLocaleDateString(undefined, {
          month: "short",
          day: "numeric",
          year: "numeric",
        })
      : "Unknown";
  return (
    <main
      className="library"
      data-dropping={dropping || undefined}
      onDragEnter={onDragEnter}
      onDragOver={(e) => {
        if (hasFiles(e)) e.preventDefault();
      }}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      <div className="brand">Personal Word</div>
      <div className="library-toolbar">
        <h1>Projects</h1>
        <div
          className="create-project"
          onKeyDown={(e) => {
            if (e.key === "Escape" && creating) {
              e.stopPropagation();
              closeCreate(true);
            }
          }}
          onBlur={(e) => {
            const next = e.relatedTarget as Node | null;
            if (creating && next && !e.currentTarget.contains(next))
              setCreating(false);
          }}
        >
          <button
            ref={createButton}
            type="button"
            className="primary"
            aria-expanded={creating}
            aria-controls="create-panel"
            onClick={() => setCreating((value) => !value)}
          >
            Start new project <ChevronDown size={14} />
          </button>
          <Popover
            open={creating}
            anchor={createButton}
            morph="anchor"
            highlight="follow"
            role="group"
            id="create-panel"
            label="Start new project"
            onDismiss={() => setCreating(false)}
            onKeyDown={onPanelKeyDown}
            ref={createPanel}
          >
            {(
              templates?.map((t) => [t.id, t.name]) ?? [
                ["blank", "Blank"],
                ["chicago", "Chicago"],
                ["screenplay", "Screenplay"],
              ]
            ).map(([id, label]) => (
              <PopoverItem
                key={id}
                onClick={() => {
                  setCreating(false);
                  onCreate(id);
                }}
              >
                {label}
              </PopoverItem>
            ))}
            <div className="create-rule" role="separator" />
            <PopoverItem
              onClick={() => {
                setCreating(false);
                writingInput.current?.click();
              }}
            >
              Import a file…
            </PopoverItem>
            <PopoverItem
              onClick={() => {
                setCreating(false);
                projectInput.current?.click();
              }}
            >
              Recover from a project.json file…
            </PopoverItem>
          </Popover>
        </div>
        <div className="library-display">
          <div className="library-search" data-open={searching || undefined}>
            <div className="library-search-field">
              <button
                ref={searchButton}
                type="button"
                aria-label="Search projects"
                aria-expanded={searching}
                aria-controls="library-search-input"
                onClick={() => {
                  if (searching && !query) return closeSearch(false);
                  setSearching(true);
                  requestAnimationFrame(() => searchInput.current?.focus());
                }}
              >
                <Search size={16} />
              </button>
              <input
                ref={searchInput}
                id="library-search-input"
                type="text"
                role="searchbox"
                aria-label="Filter projects by title"
                placeholder="Search projects"
                tabIndex={searching ? 0 : -1}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Escape") {
                    e.stopPropagation();
                    closeSearch(true);
                  }
                }}
                onBlur={(e) => {
                  if (!query && e.relatedTarget !== searchButton.current)
                    setSearching(false);
                }}
              />
            </div>
          </div>
          <label>
            Sort{" "}
            <Dropdown
              label="Sort projects"
              value={sort}
              onChange={setSort}
              options={[
                { value: "name", label: "Name" },
                { value: "added", label: "Added" },
                { value: "edited", label: "Last edited" },
              ]}
            />
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
            {view === "list" ? <Layers size={16} /> : <List size={16} />}
          </button>
        </div>
      </div>
      <div className={"project-list project-list--" + view}>
        {sorted.map((p) => (
          <div className="project-row" key={p.id}>
            <button onClick={() => onOpen(p.id)}>
              <strong className="project-name">{p.title}</strong>
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
              <Trash2 size={16} />
            </button>
          </div>
        ))}
        {!projects.length && <p className="library-empty">No projects yet.</p>}
        {projects.length > 0 && !sorted.length && (
          <p className="library-empty">No matching projects.</p>
        )}
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
                  project.json or a snapshots/ file using Recover from a project.json file in the Start new project panel.
                </small>
              </span>
              <button onClick={() => onSetAside(id)}>Set aside</button>
            </div>
          ))}
        </div>
      )}
      <span id="import-project-label" className="visually-hidden">
        Recover from a project.json file
      </span>
      <input
        ref={projectInput}
        id="import-project-json"
        className="visually-hidden"
        type="file"
        accept=".json"
        aria-labelledby="import-project-label"
        tabIndex={-1}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onImport(file);
        }}
      />
      <span id="import-writing-label" className="visually-hidden">
        Import writing -- text or Markdown (up to 5 MB), Word, HTML or Markdown bundle (.zip) (up to 20 MB)
      </span>
      <input
        ref={writingInput}
        id="import-writing-text"
        className="visually-hidden"
        type="file"
        accept=".txt,.md,.markdown,.zip,.docx,.html,.htm,text/plain,application/zip,text/markdown,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/html"
        aria-labelledby="import-writing-label"
        tabIndex={-1}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onImportWriting(file);
          e.currentTarget.value = "";
        }}
      />
      <p className="storage-note">
        {desktop
          ? "Your writing stays on this Mac."
          : "Browser preview -- writing is stored in this browser only."}
      </p>
    </main>
  );
}
