import { useCallback, useEffect, useRef, useState } from "react";
import type { Editor } from "@tiptap/react";
import { invoke } from "@tauri-apps/api/core";
import {
  Plus,
  History,
  PanelLeftClose,
  PanelLeftOpen,
  X,
  Check,
  AlertCircle,
  Download,
  ArrowLeft,
  Trash2,
} from "lucide-react";
import {
  entry,
  newProject,
  now,
  textOf,
  validateProject,
  words,
  type Project,
  type Entry,
  type Summary,
  type Version,
} from "./model";
import { desktop, storage } from "./storage";
import {
  DamagedJournal,
  discardJournal,
  journalKey,
  RecoveryConflict,
  SaveQueue,
  scanJournals,
  type SaveStatus,
} from "./save-queue";
import { Writer } from "./Writer";
import { ProjectLibrary } from "./components/ProjectLibrary";
import { ProjectSidebar } from "./components/ProjectSidebar";

import { ReadingProgress } from "./components/ReadingProgress";

type NameDialog = {
  title: string;
  label: string;
  value: string;
  action: (name: string) => Promise<void> | void;
};
type ChoiceDialog = {
  title: string;
  body: string;
  actions: {
    label: string;
    run: () => Promise<void> | void;
    primary?: boolean;
    keep?: boolean;
  }[];
};
export default function App() {
  const [editorEpoch, setEditorEpoch] = useState(0);
  const [project, setProject] = useState<Project | null>(null);
  const current = useRef<Project | null>(null);
  const [library, setLibrary] = useState<Summary[]>([]);
  const [damagedJournals, setDamagedJournals] = useState<DamagedJournal[]>([]);
  const [damagedFolders, setDamagedFolders] = useState<string[]>([]);
  const [choice, setChoice] = useState<ChoiceDialog | null>(null);
  const [active, setActive] = useState("");
  const [mode, setMode] = useState<"write" | "read">("write");
  const [status, setStatus] = useState<SaveStatus>({ state: "saved" });
  const [error, setError] = useState("");
  const [mirrorError, setMirrorError] = useState("");
  const [notice, setNotice] = useState("");
  const [nameDialog, setNameDialog] = useState<NameDialog | null>(null);
  const [focus, setFocus] = useState(false);
  const [query, setQuery] = useState("");
  const [versions, setVersions] = useState<Version[] | null>(null);
  const [history, setHistory] = useState(false);
  const [preview, setPreview] = useState<Project | null>(null);
  const [previewName, setPreviewName] = useState("");
  const [target, setTarget] = useState("");
  const [path, setPath] = useState("");
  const [busy, setBusy] = useState(false);
  const [queue] = useState(
    () => new SaveQueue((p) => storage.save(p), localStorage, setStatus),
  );
  const apply = useCallback(
    (p: Project) => {
      current.current = p;
      setProject(p);
      queue.enqueue(p);
    },
    [queue],
  );
  const mutate = useCallback(
    (change: (p: Project) => Project) => {
      const p = current.current;
      if (p)
        apply({ ...change(p), revision: p.revision + 1, updatedAt: now() });
    },
    [apply],
  );
  const run = useCallback(async (action: () => Promise<void>) => {
    setError("");
    try {
      await action();
    } catch (e) {
      setError(String(e));
    }
  }, []);
  // Commits pending edits, then writes project.json and the text copies immediately.
  const saveAll = useCallback(async () => {
    await queue.flush();
    if (current.current) await storage.flushMirrors(current.current.id);
    setMirrorError("");
  }, [queue]);
  const refreshLibrary = useCallback(async () => {
    const { projects, damaged } = await storage.list();
    const scan = scanJournals(
      Object.keys(localStorage)
        .filter((k) => k.startsWith("folio.recovery."))
        .map((k) => [k, localStorage.getItem(k)!]),
    );
    for (const p of scan.recovered)
      if (!projects.some((s) => s.id === p.id))
        projects.unshift({ id: p.id, title: p.title, updatedAt: p.updatedAt });
    setLibrary(projects);
    setDamagedJournals(scan.damaged);
    setDamagedFolders(damaged);
  }, []);
  const enter = useCallback(
    (p: Project, pending: boolean) => {
      current.current = p;
      setProject(p);
      setActive(p.order[0] ?? p.entries[0]?.id ?? "");
      setTarget(p.order[0] ?? "");
      setVersions(null);
      setPreview(null);
      setQuery("");
      setMode("write");
      localStorage.setItem("folio.lastProject", p.id);
      if (pending) {
        queue.enqueue(p);
        setNotice("Recovered pending edits from the local journal.");
      }
    },
    [queue],
  );
  const open = useCallback(
    async (id: string) => {
      await queue.flush();
      let saved: Project | null = null;
      let failure: unknown;
      try {
        saved = await storage.load(id);
      } catch (e) {
        failure = e;
      }
      let p: Project | null;
      try {
        p = queue.open(id, saved);
      } catch (e) {
        if (e instanceof RecoveryConflict) {
          setChoice({
            title: "Two copies of this project disagree.",
            body:
              "The saved copy and the recovery journal are both at revision " +
              e.disk.revision +
              " but hold different writing. Choose which to keep. Exporting the journal first saves it as a file you can import later.",
            actions: [
              {
                label: "Export journal first",
                keep: true,
                run: () =>
                  download(
                    e.journal.title + " (recovery journal).json",
                    JSON.stringify(e.journal, null, 2),
                    "application/json",
                  ),
              },
              {
                label: "Keep disk copy",
                run: () => {
                  discardJournal(localStorage, id);
                  queue.open(id, e.disk);
                  enter(e.disk, false);
                },
              },
              {
                label: "Keep journal copy",
                primary: true,
                run: () => {
                  discardJournal(localStorage, id);
                  queue.open(id, e.disk);
                  enter(
                    {
                      ...e.journal,
                      revision: e.disk.revision + 1,
                      updatedAt: now(),
                    },
                    true,
                  );
                },
              },
            ],
          });
          return;
        }
        if (e instanceof DamagedJournal && saved) {
          const disk = saved;
          setChoice({
            title: "The recovery journal for this project is damaged.",
            body: "The saved copy opens fine. Export the journal's raw text if you want to look at it, or discard it and open the saved copy.",
            actions: [
              {
                label: "Export journal",
                keep: true,
                run: () => download(e.key + ".txt", e.raw, "text/plain"),
              },
              {
                label: "Discard and open",
                primary: true,
                run: () => {
                  discardJournal(localStorage, id);
                  queue.open(id, disk);
                  enter(disk, false);
                },
              },
            ],
          });
          return;
        }
        throw saved ? e : failure;
      }
      if (!p) throw failure;
      enter(p, p !== saved || !!localStorage.getItem(journalKey(id)));
      if (!saved)
        setNotice(
          "Opened a local recovery copy. Review your writing, then retry saving.",
        );
    },
    [enter, queue],
  );
  useEffect(() => {
    void run(async () => {
      await refreshLibrary();
      setPath(await storage.path());
      const last = localStorage.getItem("folio.lastProject");
      if (last) await open(last);
    });
  }, [open, refreshLibrary, run]);
  useEffect(() => {
    const before = () => {
      void queue.flush().catch(() => {});
    };
    window.addEventListener("blur", before);
    const unload = (e: BeforeUnloadEvent) => {
      if (status.state !== "saved") {
        e.preventDefault();
      }
    };
    window.addEventListener("beforeunload", unload);
    return () => {
      window.removeEventListener("blur", before);
      window.removeEventListener("beforeunload", unload);
    };
  }, [queue, status.state]);
  useEffect(() => {
    if (!desktop) return;
    let disposed = false;
    let unlisten: (() => void) | undefined;
    void import("@tauri-apps/api/window").then(async ({ getCurrentWindow }) => {
      const window = getCurrentWindow();
      const off = await window.onCloseRequested(async (event) => {
        event.preventDefault();
        setBusy(true);
        try {
          await queue.flush();

          await invoke("finish_quit");
        } catch (e) {
          setError("Close stopped because saving failed. " + String(e));
          setBusy(false);
        }
      });
      if (disposed) off();
      else unlisten = off;
    });
    return () => {
      disposed = true;
      unlisten?.();
    };
  }, [queue]);
  useEffect(() => {
    if (!desktop) return;
    let disposed = false;
    let off: (() => void) | undefined;
    void import("@tauri-apps/api/event").then(async ({ listen }) => {
      const unlisten = await listen("folio:quit-requested", () => {
        setBusy(true);
        void run(async () => {
          await queue.flush();

          await invoke("finish_quit");
        }).finally(() => setBusy(false));
      });
      if (disposed) unlisten();
      else off = unlisten;
    });
    return () => {
      disposed = true;
      off?.();
    };
  }, [queue, run]);
  useEffect(() => {
    if (!desktop) return;
    let disposed = false;
    let off: (() => void) | undefined;
    void import("@tauri-apps/api/event").then(async ({ listen }) => {
      const unlisten = await listen<{ id: string; error: string | null }>(
        "folio:mirror-status",
        ({ payload }) => {
          if (payload.id === current.current?.id)
            setMirrorError(payload.error ?? "");
        },
      );
      if (disposed) unlisten();
      else off = unlisten;
    });
    return () => {
      disposed = true;
      off?.();
    };
  }, []);
  const add = (kind: Entry["kind"]) =>
    setNameDialog({
      title: kind === "section" ? "New section" : "New fragment",
      label: "Title",
      value: "",
      action: (title) => {
        const item = entry(kind, title);
        mutate((p) => ({
          ...p,
          entries: [...p.entries, item],
          order: kind === "section" ? [...p.order, item.id] : p.order,
        }));
        setActive(item.id);
        setMode("write");
      },
    });
  const snapshot = () =>
    setNameDialog({
      title: "Keep a named snapshot",
      label: "Snapshot name",
      value: "",
      action: async (name) => {
        await queue.flush();
        await storage.snapshot(current.current!.id, name);
        setNotice(`Snapshot “${name}” saved.`);
        if (versions)
          setVersions(await storage.versions(current.current!.id, history));
      },
    });
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (!(event.metaKey || event.ctrlKey)) return;
      const key = event.key.toLowerCase();
      if (key === "s") {
        event.preventDefault();
        void run(saveAll);
      }
      if (key === "\\") {
        event.preventDefault();
        setFocus((f) => !f);
      }
      if (key === "k") {
        event.preventDefault();
        document
          .querySelector<HTMLInputElement>('[aria-label="Search project"]')
          ?.focus();
      }
      if (event.shiftKey && key === "n" && current.current) {
        event.preventDefault();
        add("section");
      }
      if (event.shiftKey && key === "s" && current.current) {
        event.preventDefault();
        snapshot();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  });
  const item = project?.entries.find((e) => e.id === active);
  const rename = (e: Entry) =>
    setNameDialog({
      title: "Rename " + e.kind,
      label: "Title",
      value: e.title,
      action: (title) =>
        mutate((p) => ({
          ...p,
          entries: p.entries.map((x) =>
            x.id === e.id ? { ...x, title, updatedAt: now() } : x,
          ),
        })),
    });
  const renameProject = () =>
    setNameDialog({
      title: "Rename project",
      label: "Project title",
      value: current.current?.title ?? "",
      action: (title) => mutate((p) => ({ ...p, title })),
    });
  const remove = (e: Entry) =>
    setChoice({
      title: `Delete ${e.kind} “${e.title}”?`,
      body: "A safety snapshot is kept first, so you can bring it back from Snapshots & history.",
      actions: [
        {
          label: "Delete " + e.kind,
          primary: true,
          run: async () => {
            await queue.flush();
            await storage.snapshot(
              current.current!.id,
              `Before deleting “${e.title}”`,
            );
            mutate((p) => ({
              ...p,
              entries: p.entries.filter((x) => x.id !== e.id),
              order: p.order.filter((x) => x !== e.id),
            }));
            const p = current.current!;
            if (active === e.id)
              setActive(p.order[0] ?? p.entries[0]?.id ?? "");
            if (target === e.id) setTarget("");
            setNotice(`“${e.title}” deleted. A safety snapshot keeps it.`);
          },
        },
      ],
    });
  const removeProject = (s: Summary) =>
    setChoice({
      title: `Delete project “${s.title}”?`,
      body: desktop
        ? "Its folder is set aside as " +
          s.id +
          ".deleted inside Local storage, so nothing is erased."
        : "Its browser preview storage is removed.",
      actions: [
        {
          label: "Delete project",
          primary: true,
          run: async () => {
            await queue.flush();
            try {
              await storage.delete(s.id);
            } catch (e) {
              if (!localStorage.getItem(journalKey(s.id))) throw e;
            }
            discardJournal(localStorage, s.id);
            if (localStorage.getItem("folio.lastProject") === s.id)
              localStorage.removeItem("folio.lastProject");
            await refreshLibrary();
          },
        },
      ],
    });
  const reorder = (id: string, to: number) =>
    mutate((p) => {
      const order = p.order.filter((x) => x !== id);
      order.splice(Math.max(0, Math.min(to, order.length)), 0, id);
      return { ...p, order };
    });
  const extract = (editor: Editor) => {
    const p = current.current;
    const source = p?.entries.find((e) => e.id === active);
    const { from, to, empty } = editor.state.selection;
    if (!p || !source || source.kind !== "section" || empty) return;
    const content = editor.state.doc.cut(from, to).toJSON();
    const selected = editor.state.doc.textBetween(from, to, "\n");
    const fragment: Entry = {
      ...entry(
        "fragment",
        selected.trim().split(/\s+/).slice(0, 7).join(" ") ||
          "Untitled fragment",
      ),
      content,
      text: selected,
      origin: {
        sectionId: source.id,
        sectionTitle: source.title,
        from,
        to,
        context: source.text.slice(0, 160),
        removedAt: now(),
      },
    };
    editor
      .chain()
      .setMeta("preventUpdate", true)
      .deleteRange({ from, to })
      .run();
    mutate((p) => ({
      ...p,
      entries: [
        ...p.entries.map((e) =>
          e.id === source.id
            ? {
                ...e,
                content: editor.getJSON(),
                text: editor.getText(),
                updatedAt: now(),
              }
            : e,
        ),
        fragment,
      ],
    }));
    setNotice(
      "Selection kept in Fragments. Its original section and position are remembered.",
    );
  };
  const restoreFragment = () => {
    if (!item || item.kind !== "fragment" || !target) return;
    const fragment = item;
    mutate((p) => ({
      ...p,
      entries: p.entries.map((e) => {
        if (e.id !== target) return e;
        const content = {
          type: "doc",
          content: [
            ...(e.content.content ?? []),
            ...(fragment.content.content ?? []),
          ],
        };
        return { ...e, content, text: textOf(content), updatedAt: now() };
      }),
    }));
    setActive(target);
    setNotice(
      "Fragment appended to the section. The original remains in Fragments.",
    );
  };
  const showVersions = (automatic = false) =>
    void run(async () => {
      await queue.flush();
      setHistory(automatic);
      setPreview(null);
      setVersions(await storage.versions(current.current!.id, automatic));
    });
  const restoreVersion = () =>
    void run(async () => {
      if (!preview || !current.current) return;
      await queue.flush();
      await storage.snapshot(
        current.current.id,
        "Before restoring " + previewName,
      );
      apply({
        ...preview,
        id: current.current.id,
        revision: current.current.revision + 1,
        updatedAt: now(),
      });
      await queue.flush();
      setEditorEpoch((n) => n + 1);
      setActive(preview.order[0] ?? "");
      setPreview(null);
      setVersions(null);
      setNotice(
        "Version restored. Your previous writing is kept in a safety snapshot.",
      );
    });
  const download = (filename: string, data: string, type: string) => {
    if (desktop) {
      void run(async () => {
        const { save } = await import("@tauri-apps/plugin-dialog");
        const path = await save({ defaultPath: filename });
        if (path) {
          await invoke("export_file", { path, data });
          setNotice("Export saved.");
        }
      });
      return;
    }
    const url = URL.createObjectURL(new Blob([data], { type }));
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  const create = () =>
    setNameDialog({
      title: "A new writing project",
      label: "Project title",
      value: "",
      action: async (title) => {
        await queue.flush();
        const p = newProject(title);
        setVersions(null);
        setPreview(null);
        setQuery("");
        apply(p);
        setActive(p.order[0]);
        setTarget(p.order[0]);
        setMode("write");
        localStorage.setItem("folio.lastProject", p.id);
        await queue.flush();
      },
    });
  const importProject = async (file: File) => {
    const p: unknown = JSON.parse(await file.text());
    validateProject(p);
    await queue.flush();
    const imported = {
      ...p,
      id: crypto.randomUUID(),
      revision: 1,
      title: p.title + " (recovered)",
      updatedAt: now(),
    };
    setVersions(null);
    setPreview(null);
    setQuery("");
    setMode("write");
    apply(imported);
    setActive(imported.order[0] ?? "");
    setTarget(imported.order[0] ?? "");
    localStorage.setItem("folio.lastProject", imported.id);
    await queue.flush();
  };
  const sections =
    project?.order
      .map((id) => project.entries.find((e) => e.id === id)!)
      .filter(Boolean) ?? [];
  return (
    <div className={"app " + (focus ? "focus" : "")}>
      {!project ? (
        <ProjectLibrary
          projects={library}
          onCreate={create}
          onOpen={(id) => void run(() => open(id))}
          onDelete={removeProject}
          onImport={(file) => void run(() => importProject(file))}
          damagedJournals={damagedJournals}
          onExportJournal={(d) => download(d.key + ".txt", d.raw, "text/plain")}
          onDiscardJournal={(d) =>
            void run(async () => {
              discardJournal(localStorage, d.key.slice(journalKey("").length));
              await refreshLibrary();
            })
          }
          damagedFolders={damagedFolders}
          path={path}
          onSetAside={(id) =>
            void run(async () => {
              await storage.delete(id);
              await refreshLibrary();
            })
          }
        />
      ) : (
        <>
          <ProjectSidebar
            project={project}
            active={active}
            mode={mode}
            query={query}
            onQuery={setQuery}
            onLibrary={() =>
              void run(async () => {
                await saveAll();
                await refreshLibrary();
                current.current = null;
                setProject(null);
                localStorage.removeItem("folio.lastProject");
              })
            }
            onAdd={add}
            onSelect={(id) => {
              setActive(id);
              setMode("write");
            }}
            onRename={rename}
            onReorder={reorder}
            onRead={() => setMode("read")}
            onVersions={() => showVersions()}
          />
          <main className="workspace" aria-busy={busy}>
            <header className="topbar">
              <div>
                <button
                  aria-label="Toggle focus mode"
                  title="Focus mode (⌘\\)"
                  onClick={() => setFocus(!focus)}
                >
                  {focus ? (
                    <PanelLeftOpen size={18} />
                  ) : (
                    <PanelLeftClose size={18} />
                  )}
                </button>
                <span className="breadcrumb">
                  <button
                    className="breadcrumb-title"
                    title="Rename project"
                    aria-label="Rename project"
                    onClick={renameProject}
                  >
                    {project.title}
                  </button>
                  <span>/</span>
                  {mode === "read"
                    ? "Manuscript"
                    : item?.kind === "fragment"
                      ? "Fragments"
                      : "Manuscript"}
                </span>
              </div>
              <div>
                <span className={"save-status " + status.state}>
                  {status.state === "saved" ? (
                    <Check size={13} />
                  ) : status.state === "error" ? (
                    <AlertCircle size={13} />
                  ) : (
                    <span className="save-dot" />
                  )}
                  {status.state === "saved"
                    ? "Saved"
                    : status.state === "pending"
                      ? "Unsaved edits"
                      : status.state === "saving"
                        ? "Saving…"
                        : "Save failed"}
                </span>
                <button className="snapshot-button" onClick={snapshot}>
                  <History size={15} /> Snapshot
                </button>
                <button
                  aria-label="Export portable project"
                  title="Export complete project JSON"
                  onClick={() =>
                    download(
                      project.title + ".json",
                      JSON.stringify(current.current, null, 2),
                      "application/json",
                    )
                  }
                >
                  <Download size={17} />
                </button>
              </div>
            </header>
            <ReadingProgress identity={project.id + mode + active} />
            {mode === "read" && sections.length > 1 && (
              <nav className="proximity-nav" aria-label="Manuscript sections">
                {sections.map((section) => (
                  <button
                    key={section.id}
                    aria-label={"Jump to " + section.title}
                    onClick={() =>
                      document
                        .getElementById("read-" + section.id)
                        ?.scrollIntoView({
                          behavior: window.matchMedia(
                            "(prefers-reduced-motion: reduce)",
                          ).matches
                            ? "instant"
                            : "smooth",
                          block: "start",
                        })
                    }
                  >
                    <span>{section.title}</span>
                    <i aria-hidden="true" />
                  </button>
                ))}
              </nav>
            )}
            {mode === "read" ? (
              <div className="manuscript-read">
                <div className="eyebrow">CONTINUOUS MANUSCRIPT · READ ONLY</div>
                <h1>{project.title}</h1>
                <button
                  className="text-button"
                  onClick={() =>
                    download(
                      project.title + ".txt",
                      sections
                        .map((e) => e.title + "\n\n" + e.text)
                        .join("\n\n"),
                      "text/plain",
                    )
                  }
                >
                  Export plain text <Download size={13} />
                </button>
                {sections.map((e) => (
                  <section key={e.id} id={"read-" + e.id}>
                    <button
                      className="read-title"
                      onClick={() => {
                        setActive(e.id);
                        setMode("write");
                      }}
                    >
                      {e.title} <span>↗</span>
                    </button>
                    <div className="read-prose">
                      {e.text || "This section is waiting for words."}
                    </div>
                  </section>
                ))}
              </div>
            ) : item ? (
              <div className="editor-scroll">
                <div className="document-heading">
                  <div className="eyebrow">
                    {item.kind === "fragment"
                      ? "FRAGMENT"
                      : `SECTION ${project.order.indexOf(item.id) + 1} OF ${sections.length}`}
                  </div>
                  <div className="document-title-row">
                    <button
                      className="document-title"
                      title="Rename"
                      onClick={() => rename(item)}
                    >
                      {item.title}
                    </button>
                    <button
                      className="delete-entry"
                      title={"Delete " + item.kind}
                      aria-label={"Delete " + item.kind}
                      onClick={() => remove(item)}
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                  {item.origin && (
                    <p className="origin">
                      Kept from “{item.origin.sectionTitle}” ·{" "}
                      {new Date(item.origin.removedAt).toLocaleDateString()}
                    </p>
                  )}
                </div>
                <Writer
                  key={item.id + ":" + editorEpoch}
                  item={item}
                  onExtract={extract}
                  onLink={(value, apply) =>
                    setNameDialog({
                      title: value ? "Edit link" : "Add link",
                      label: "Link address",
                      value: value || "https://",
                      action: (url) => {
                        if (!/^https?:\/\//i.test(url))
                          throw new Error(
                            "Links must start with http:// or https://",
                          );
                        apply(url);
                      },
                    })
                  }
                  onEdit={(content, text) =>
                    mutate((p) => ({
                      ...p,
                      entries: p.entries.map((e) =>
                        e.id === item.id
                          ? { ...e, content, text, updatedAt: now() }
                          : e,
                      ),
                    }))
                  }
                />
                {item.kind === "fragment" && (
                  <div className="restore-fragment">
                    <span>Give these words a home</span>
                    <select
                      aria-label="Restore fragment to section"
                      value={target}
                      onChange={(e) => setTarget(e.target.value)}
                    >
                      <option value="">Choose a section</option>
                      {sections.map((e) => (
                        <option key={e.id} value={e.id}>
                          {e.title}
                        </option>
                      ))}
                    </select>
                    <button disabled={!target} onClick={restoreFragment}>
                      Append to section →
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div className="empty-editor">
                <h1>A little room to begin.</h1>
                <button className="primary" onClick={() => add("section")}>
                  Create a section
                </button>
              </div>
            )}
            <footer className="statusbar">
              <span>
                {mode === "read"
                  ? "Read manuscript"
                  : item?.kind === "fragment"
                    ? "A fragment is a possibility."
                    : "One section at a time."}
              </span>
              <div>
                <span>{words(item?.text ?? "").toLocaleString()} words</span>
                <span>
                  {(item?.text.length ?? 0).toLocaleString()} characters
                </span>
                <button title={path} onClick={() => setNotice(path)}>
                  Local storage
                </button>
              </div>
            </footer>
          </main>
          {versions && (
            <aside className="versions">
              <div className="panel-heading">
                <h2>Versions</h2>
                <button
                  aria-label="Close versions"
                  onClick={() => {
                    setVersions(null);
                    setPreview(null);
                  }}
                >
                  <X size={18} />
                </button>
              </div>
              <div className="version-tabs">
                <button
                  className={!history ? "selected" : ""}
                  onClick={() => showVersions(false)}
                >
                  Snapshots
                </button>
                <button
                  className={history ? "selected" : ""}
                  onClick={() => showVersions(true)}
                >
                  Recovery history
                </button>
              </div>
              <p className="panel-help">
                {history
                  ? "Previous saved states, kept automatically."
                  : "Milestones you chose to keep."}
              </p>
              {!history && (
                <button className="primary" onClick={snapshot}>
                  <Plus size={15} /> Create snapshot
                </button>
              )}
              {versions.length === 0 && (
                <p className="empty-hint">
                  {history
                    ? "History appears after your next save."
                    : "Keep a version before taking a new direction."}
                </p>
              )}
              {versions.map((v) => (
                <button
                  className="version-item"
                  key={v.id}
                  onClick={() =>
                    void run(async () => {
                      setPreview(
                        await storage.version(project.id, v.id, history),
                      );
                      setPreviewName(v.name);
                    })
                  }
                >
                  <History size={15} />
                  <span>
                    <strong>{v.name}</strong>
                    <small>{new Date(v.createdAt).toLocaleString()}</small>
                  </span>
                </button>
              ))}
            </aside>
          )}
        </>
      )}
      {(error || status.state === "error" || mirrorError) && (
        <div className="error-banner" role="alert">
          <AlertCircle size={17} />
          <span>
            {error || (status.state === "error" ? status.message : mirrorError)}
          </span>
          <button
            onClick={() =>
              void run(async () => {
                await saveAll();
                await refreshLibrary();
              })
            }
          >
            Retry
          </button>
          <button aria-label="Dismiss error" onClick={() => setError("")}>
            <X size={16} />
          </button>
        </div>
      )}
      {notice && (
        <div className="notice" role="status">
          <span>{notice}</span>
          <button
            aria-label="Dismiss notification"
            onClick={() => setNotice("")}
          >
            <X size={15} />
          </button>
        </div>
      )}
      {nameDialog && (
        <div className="modal-backdrop">
          <form
            className="dialog"
            role="dialog"
            aria-modal="true"
            onSubmit={(event) => {
              event.preventDefault();
              const dialog = nameDialog;
              if (!dialog.value.trim() || busy) return;
              setBusy(true);
              void run(async () => {
                await dialog.action(dialog.value.trim());
                setNameDialog(null);
              }).finally(() => setBusy(false));
            }}
          >
            <div className="eyebrow">FOLIO</div>
            <h2>{nameDialog.title}</h2>
            <label>
              {nameDialog.label}
              <input
                autoFocus
                value={nameDialog.value}
                onChange={(e) =>
                  setNameDialog({ ...nameDialog, value: e.target.value })
                }
                onKeyDown={(e) => {
                  if (e.key === "Escape") setNameDialog(null);
                }}
              />
            </label>
            <div className="dialog-actions">
              <button
                type="button"
                disabled={busy}
                onClick={() => setNameDialog(null)}
              >
                Cancel
              </button>
              <button
                className="primary"
                disabled={!nameDialog.value.trim() || busy}
                type="submit"
              >
                {busy ? "Saving…" : "Save"}
              </button>
            </div>
          </form>
        </div>
      )}
      {choice && (
        <div className="modal-backdrop">
          <div className="dialog" role="dialog" aria-modal="true">
            <div className="eyebrow">FOLIO</div>
            <h2>{choice.title}</h2>
            <p className="dialog-body">{choice.body}</p>
            <div className="dialog-actions">
              <button
                type="button"
                disabled={busy}
                onClick={() => setChoice(null)}
              >
                Cancel
              </button>
              {choice.actions.map((a) => (
                <button
                  key={a.label}
                  type="button"
                  className={a.primary ? "primary" : ""}
                  disabled={busy}
                  onClick={() => {
                    setBusy(true);
                    void run(async () => {
                      await a.run();
                      if (!a.keep) setChoice(null);
                    }).finally(() => setBusy(false));
                  }}
                >
                  {a.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
      {preview && (
        <div className="modal-backdrop">
          <div className="preview-dialog">
            <div className="panel-heading">
              <button onClick={() => setPreview(null)}>
                <ArrowLeft size={16} /> Back
              </button>
              <span>READ-ONLY VERSION</span>
            </div>
            <h2>{previewName}</h2>
            <p>Restoring keeps a safety snapshot of your current writing.</p>
            <div className="preview-content">
              {[
                ...preview.order.map((id) =>
                  preview.entries.find((e) => e.id === id)!,
                ),
                ...preview.entries.filter((e) => e.kind === "fragment"),
              ].map((e) => (
                <section key={e.id} id={"read-" + e.id}>
                  <h3>
                    {e.title}{" "}
                    {e.kind === "fragment" && <small>· Fragment</small>}
                  </h3>
                  <div className="read-prose">{e.text}</div>
                </section>
              ))}
            </div>
            <button className="primary" onClick={restoreVersion}>
              Restore this version
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
