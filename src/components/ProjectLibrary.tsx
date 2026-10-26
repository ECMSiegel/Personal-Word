import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from "react";
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
  const [triggerSize, setTriggerSize] = useState({ w: 0, h: 0 });
  const [closing, setClosing] = useState(false);
  const closeTimer = useRef<number | null>(null);
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
    if (!creating || closing) return;
    createPanel.current?.querySelector<HTMLButtonElement>("button")?.focus();
  }, [creating, closing]);
  useEffect(() => {
    if (!creating) return;
    const close = (event: PointerEvent) => {
      if (!(event.target as Element).closest(".create-project"))
        dismissCreate();
    };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, [creating, closing]);
  useEffect(
    () => () => {
      if (closeTimer.current) window.clearTimeout(closeTimer.current);
    },
    [],
  );
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
  // Closing keeps the panel mounted for one morph so it collapses back into the button.
  const dismissCreate = () => {
    if (!creating || closing) return;
    setClosing(true);
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) {
      setClosing(false);
      setCreating(false);
      return;
    }
    const raw = getComputedStyle(document.documentElement).getPropertyValue("--duration-morph");
    const ms = Math.max(0, parseFloat(raw) * (raw.trim().endsWith("ms") ? 1 : 1000) || 0);
    closeTimer.current = window.setTimeout(() => {
      closeTimer.current = null;
      setClosing(false);
      setCreating(false);
    }, ms);
  };
  const closeCreate = (refocus: boolean) => {
    dismissCreate();
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
            if (creating && e.key === "Escape") onPanelKeyDown(e);
          }}
          onBlur={(e) => {
            const next = e.relatedTarget as Node | null;
            if (creating && next && !e.currentTarget.contains(next))
              dismissCreate();
          }}
        >
          <button
            ref={createButton}
            type="button"
            className="primary"
            aria-expanded={creating}
            aria-controls="create-panel"
            onClick={(e) => {
              // Measured before the panel exists so its opening shape starts at the button.
              const box = e.currentTarget;
              setTriggerSize({ w: box.offsetWidth, h: box.offsetHeight });
              if (closing) {
                if (closeTimer.current) window.clearTimeout(closeTimer.current);
                closeTimer.current = null;
                setClosing(false);
              } else if (creating) dismissCreate();
              else setCreating(true);
            }}
          >
            Start new project <ChevronDown size={14} />
          </button>
          {creating && (
            <div
              id="create-panel"
              ref={createPanel}
              className="create-panel"
              data-closing={closing ? "" : undefined}
              role="group"
              aria-label="Start new project"
              style={
                {
                  "--trigger-w": triggerSize.w + "px",
                  "--trigger-h": triggerSize.h + "px",
                } as CSSProperties
              }
              onKeyDown={onPanelKeyDown}
            >
              <div className="create-panel-body">
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
                    type="button"
                    onClick={() => {
                      dismissCreate();
                      onCreate(id);
                    }}
                  >
                    {label}
                  </button>
                ))}
                <div className="create-panel-rule" role="separator" />
                <button
                  type="button"
                  onClick={() => {
                    dismissCreate();
                    writingInput.current?.click();
                  }}
                >
                  Import a file…
                </button>
                <button
                  type="button"
                  onClick={() => {
                    dismissCreate();
                    projectInput.current?.click();
                  }}
                >
                  Recover from a project.json file…
                </button>
              </div>
            </div>
          )}
        </div>
        <div className="library-display">
          <div className="library-search" data-open={searching || undefined}>
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
              <Search size={15} />
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
            {view === "list" ? <Layers size={17} /> : <List size={17} />}
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
              <Trash2 size={14} />
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
