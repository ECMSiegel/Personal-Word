import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Editor } from "@tiptap/react";
import type { Transaction } from "@tiptap/pm/state";
import { invoke } from "@tauri-apps/api/core";
import {
  Plus,
  History,
  PanelLeftClose,
  X,
  Check,
  AlertCircle,
  Download,
  ArrowLeft,
  Trash2,
} from "lucide-react";
import {
  entry,
  isValidGoalDeadline,
  newProject,
  now,
  textOf,
  validateProject,
  words,
  type Project,
  type Entry,
  type Summary,
  type Version,
  type Annotation,
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
import { goalStatus, goalWords, goalDate, goalBaselineKey } from "./goals";
import { createProjectIndex } from "./derived/projectIndex";
import { applyRestorePatch, type RestorePatch } from "./organization/revisionDiff";
import { ProjectLibrary } from "./components/ProjectLibrary";
import { ProjectSidebar } from "./components/ProjectSidebar";
import { ReadDocument } from "./components/ReadDocument";
import { Dropdown } from "./components/Dropdown";
import { footnoteText } from "./research/citations";
import { resolveCitationContext, type SectionReferences } from "./research/noteForms";
import { buildQuoteInsertion, createCommentAnchor, migrateLegacyCommentAnchor, resolveCommentAnchor, withCommentRevisions } from "./editor/commentAnchors";
import { CslImportPreview, type SourceFieldUpdate } from "./research/CslImportPreview";
import type { CslImportResult } from "./research/cslImport";
import { mergeSourceFields, validateSourceMergeUpdates } from "./research/sourceMerge";
import { ProjectTabs } from "./components/ProjectTabs";
import { ResearchPanel } from "./research/ResearchPanel";
import { defaultDocumentSettings } from "./research/types";
import { writingTemplates, type WritingTemplate } from "./templates";
import { ExportPanel } from "./export/ExportPanel";
import { TemplatePicker } from "./research/TemplatePicker";
import { CommentsPanel } from "./organization/CommentsPanel";
import { FragmentLibrary } from "./organization/FragmentLibrary";
import { RevisionComparison } from "./organization/RevisionComparison";
import type { ManuscriptPreview } from "./import/manuscript";
import { ImportPreview, ImportBusy, type ImportDraft } from "./import/ImportPreview";
import { previewWriting } from "./import/docxImport";
import { ProjectDialogs, type NameDialog, type ChoiceDialog } from "./app/ProjectDialogs";
import "./organization/organization.css";
import {
  copyFragmentAssets,
  importFragment,
  mergeMissingResearch,
} from "./organization/operations";
import { setImageSourceResolver } from "./editor/media";
import { createPendingAsset } from "./assets/assets";
import type { PendingAsset } from "./assets/types";
import { createProjectArchive, readProjectArchive } from "./projectArchive";

function readPreference<T>(key: string, fallback: T): T {
  try {
    return JSON.parse(localStorage.getItem(key) ?? "null") ?? fallback;
  } catch {
    return fallback;
  }
}
const asideMin = 260;
const asideMax = 720;
function clampAside(width: number) {
  return Math.max(asideMin, Math.min(asideMax, Math.round(width)));
}
function AsideResizer({
  width,
  onWidth,
}: {
  width: number;
  onWidth: (width: number) => void;
}) {
  const drag = useRef<{ x: number; width: number } | null>(null);
  return (
    <div
      className="aside-resizer"
      role="separator"
      aria-label="Resize side panel"
      aria-orientation="vertical"
      aria-valuemin={asideMin}
      aria-valuemax={asideMax}
      aria-valuenow={width}
      tabIndex={0}
      onPointerDown={(event) => {
        event.currentTarget.setPointerCapture(event.pointerId);
        drag.current = { x: event.clientX, width };
      }}
      onPointerMove={(event) => {
        if (drag.current)
          onWidth(drag.current.width + drag.current.x - event.clientX);
      }}
      onPointerUp={() => {
        drag.current = null;
      }}
      onPointerCancel={() => {
        drag.current = null;
      }}
      onKeyDown={(event) => {
        if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
        event.preventDefault();
        onWidth(width + (event.key === "ArrowLeft" ? 16 : -16));
      }}
    />
  );
}
export default function App() {
  const [editorEpoch, setEditorEpoch] = useState(0);
  const [destination, setDestination] = useState("manuscript");
  const [researchEpoch, setResearchEpoch] = useState(0);
  const [researchTab, setResearchTab] = useState<
    "sources" | "notes" | "footnotes"
  >("sources");
  const [focusFootnote, setFocusFootnote] = useState<string>();
  const opening = useRef(false);
  const editorRef = useRef<Editor | null>(null);
  const pendingJump = useRef<string | null>(null);
  const pendingContentChange = useRef<{
    projectId: string;
    entryId: string;
    amend: (project: Project) => Project;
  } | null>(null);
  const [reattachment, setReattachment] = useState<{
    projectId: string;
    annotationId: string;
    entryId: string;
    entryRevision: number;
    selection: { from: number; to: number } | null;
  } | null>(null);
  const editorReady = useCallback((editor: Editor | null) => {
    editorRef.current = editor;
    if (editor && pendingJump.current) {
      const annotation = current.current?.annotations?.find((a) => a.id === pendingJump.current);
      pendingJump.current = null;
      const entry = current.current?.entries.find((e) => e.id === annotation?.entryId);
      if (!annotation || !entry || !editor.state.doc.eq(editor.schema.nodeFromJSON(entry.content))) return;
      if (!annotation.quote) {
        editor.commands.focus("start");
        return;
      }
      const migrated = migrateLegacyCommentAnchor(annotation, editor.state.doc, entry.contentRevision ?? 0);
      const range = migrated.anchor?.entryRevision === (entry.contentRevision ?? 0)
        ? resolveCommentAnchor(migrated, editor.state.doc) : null;
      if (!range) {
        setNotice("This comment needs a new passage selection. Use Reattach to selection in Comments.");
        return;
      }
      if (migrated !== annotation)
        mutate((p) => ({ ...p, annotations: p.annotations?.map((a) => a.id === annotation.id ? migrated : a) }));
      editor.chain().focus().setTextSelection(range).scrollIntoView().run();
    }
  }, []);
  const [tabs, setTabs] = useState<{ id: string; title: string }[]>(() =>
    readPreference("personal-word.restoreTabs", false)
      ? readPreference("personal-word.tabs", [])
      : [],
  );
  const [restoreTabs, setRestoreTabs] = useState(() =>
    readPreference("personal-word.restoreTabs", false),
  );
  const [customTemplates, setCustomTemplates] = useState<WritingTemplate[]>(
    () => readPreference("personal-word.templates", []),
  );
  const locations = useRef<
    Record<
      string,
      { active: string; mode: "write" | "read"; destination: string }
    >
  >({});
  const [reader, setReader] = useState(() =>
    readPreference("personal-word.reader", {
      font: "Futura, Avenir, sans-serif",
      size: 18,
      spacing: 1.6,
    }),
  );
  useEffect(() => {
    localStorage.setItem("personal-word.tabs", JSON.stringify(tabs));
  }, [tabs]);
  useEffect(() => {
    localStorage.setItem(
      "personal-word.templates",
      JSON.stringify(customTemplates),
    );
  }, [customTemplates]);
  useEffect(() => {
    localStorage.setItem("personal-word.reader", JSON.stringify(reader));
  }, [reader]);
  const [project, setProject] = useState<Project | null>(null);
  const projectIndex = useRef(createProjectIndex());
  const projectSummary = useMemo(() => project ? projectIndex.current.update(null, project) : null, [project]);
  const [focusMode, setFocusMode] = useState(() => readPreference("personal-word.focus-mode", false));
  const [proseCheck, setProseCheck] = useState(() => readPreference("personal-word.prose-check", false));
  useEffect(() => {
    localStorage.setItem("personal-word.focus-mode", JSON.stringify(focusMode));
  }, [focusMode]);
  useEffect(() => {
    localStorage.setItem("personal-word.prose-check", JSON.stringify(proseCheck));
  }, [proseCheck]);
  const goalMode = project?.goals?.dayMode ?? "local";
  const goalScope = project?.goals?.scope ?? "manuscript";
  const [goalClockTick, setGoalClockTick] = useState(0);
  const [goalZone, setGoalZone] = useState(() => Intl.DateTimeFormat().resolvedOptions().timeZone);
  // Resolve the loaded preference and its day together. A local-day state
  // initialized before an UTC project opens can overwrite its saved baseline.
  const goalDay = useMemo(() => goalDate(new Date(), goalMode, goalZone),
    [goalMode, goalScope, goalZone, goalClockTick, project?.id]);
  const goalContext = project ? `${project.id}:${goalScope}:${goalMode}:${goalMode === "local" ? goalZone : "UTC"}` : "";
  const previousGoalContext = useRef<{projectId: string; context: string} | null>(null);
  const [goalBaseline, setGoalBaseline] = useState<{ projectId: string; context: string; date: string; words: number } | null>(null);
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const refresh = () => {
      setGoalZone(Intl.DateTimeFormat().resolvedOptions().timeZone);
      setGoalClockTick((tick) => tick + 1);
    };
    const schedule = () => {
      refresh();
      const date = new Date();
      const midnight = goalMode === "utc"
        ? new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() + 1))
        : new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1);
      timer = setTimeout(schedule, Math.min(60_000, midnight.getTime() - date.getTime() + 50));
    };
    const onFocus = () => { clearTimeout(timer); schedule(); };
    schedule();
    window.addEventListener("focus", onFocus);
    return () => { clearTimeout(timer); window.removeEventListener("focus", onFocus); };
  }, [goalMode]);
  useEffect(() => {
    if (!project) { setGoalBaseline(null); previousGoalContext.current = null; return; }
    const key = goalBaselineKey(project);
    const saved = readPreference<{ date: string; words: number; timeZone?: string } | null>(key, null);
    const changedProfile = previousGoalContext.current?.projectId === project.id && previousGoalContext.current.context !== goalContext;
    const sameZone = goalMode === "utc" || saved?.timeZone === undefined || saved.timeZone === goalZone;
    const baseline = !changedProfile && sameZone && saved?.date === goalDay && Number.isSafeInteger(saved.words) && saved.words >= 0
      ? saved : { date: goalDay, words: goalWords(project) };
    try { localStorage.setItem(key, JSON.stringify({...baseline,timeZone: goalMode === "utc" ? "UTC" : goalZone})); } catch { /* Progress remains available for this session. */ }
    previousGoalContext.current = {projectId: project.id,context: goalContext};
    setGoalBaseline({ projectId: project.id, context: goalContext, ...baseline });
    // Capture only on opening/day/profile changes, never on each writing edit.
  }, [project?.id, goalDay, goalContext]);
  const current = useRef<Project | null>(null);
  const imageCache = useRef<Map<string, string>>(new Map());
  const createdBlobUrls = useRef<Set<string>>(new Set());
  const assetBytesCache = useRef<Map<string, PendingAsset>>(new Map());

  useEffect(() => {
    if (!project?.id) {
      setImageSourceResolver(null);
      return;
    }

    const projectId = project.id;
    const resolver = async (assetId: string): Promise<string | null> => {
      try {
        const asset =
          assetBytesCache.current.get(assetId) ??
          (await storage.readAsset(projectId, assetId));
        assetBytesCache.current.set(assetId, asset);
        const url = URL.createObjectURL(
          new Blob([asset.bytes as unknown as BlobPart], { type: asset.meta.mime }),
        );
        createdBlobUrls.current.add(url);
        imageCache.current.set(assetId, url);
        return url;
      } catch {
        return null;
      }
    };

    setImageSourceResolver(resolver);

    return () => {
      setImageSourceResolver(null);
      for (const url of createdBlobUrls.current) {
        try {
          URL.revokeObjectURL(url);
        } catch {
          // ignore
        }
      }
      createdBlobUrls.current.clear();
      imageCache.current.clear();
      assetBytesCache.current.clear();
    };
  }, [project?.id]);

  const resolveAsset = useCallback(
    async (assetId: string): Promise<string | null> => {
      if (!current.current?.id) return null;
      const projectId = current.current.id;
      try {
        const asset =
          assetBytesCache.current.get(assetId) ??
          (await storage.readAsset(projectId, assetId));
        assetBytesCache.current.set(assetId, asset);
        const url = URL.createObjectURL(
          new Blob([asset.bytes as unknown as BlobPart], { type: asset.meta.mime }),
        );
        createdBlobUrls.current.add(url);
        imageCache.current.set(assetId, url);
        return url;
      } catch {
        return null;
      }
    },
    [],
  );

  const onInsertImage = useCallback(async (file: File) => {
    if (!current.current?.id) return null;
    const projectId = current.current.id;
    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      const pendingAsset = await createPendingAsset(bytes);
      await storage.stageAssets(projectId, [pendingAsset]);
      assetBytesCache.current.set(pendingAsset.id, pendingAsset);
      return {
        assetId: pendingAsset.id,
        alt: "",
        width: pendingAsset.meta.width,
        height: pendingAsset.meta.height,
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
      throw err;
    }
  }, []);
  const [library, setLibrary] = useState<Summary[]>([]);
  const [damagedJournals, setDamagedJournals] = useState<DamagedJournal[]>([]);
  const [damagedFolders, setDamagedFolders] = useState<string[]>([]);
  const [importPreview, setImportPreview] = useState<ImportDraft | ManuscriptPreview | null>(null);
  const [importBusy, setImportBusy] = useState<{ filename: string } | null>(null);
  const importAbort = useRef<AbortController | null>(null);
  const [cslImportPreview, setCslImportPreview] = useState<(CslImportResult & { projectId: string }) | null>(null);
  const [choice, setChoice] = useState<ChoiceDialog | null>(null);
  const [active, setActive] = useState("");
  const [mode, setMode] = useState<"write" | "read">("write");
  const [status, setStatus] = useState<SaveStatus>({ state: "saved" });
  const [pageStatus, setPageStatus] = useState({ current: 1, total: 1 });
  const [asideWidth, setAsideWidth] = useState(() =>
    clampAside(
      Number(readPreference("personal-word.asidePanelWidth", 390)) || 390,
    ),
  );
  useEffect(() => {
    localStorage.setItem(
      "personal-word.asidePanelWidth",
      JSON.stringify(asideWidth),
    );
  }, [asideWidth]);
  const [error, setError] = useState("");
  const [mirrorError, setMirrorError] = useState("");
  const [notice, setNotice] = useState("");
  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(""), 6000);
    return () => window.clearTimeout(timer);
  }, [notice]);
  const [nameDialog, setNameDialog] = useState<NameDialog | null>(null);
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
      if (current.current?.id !== p.id) {
        pendingJump.current = null;
        pendingContentChange.current = null;
        setReattachment(null);
      }
      current.current = p;
      setProject(p);
      queue.enqueue(p);
    },
    [queue],
  );
  const mutate = useCallback(
    (change: (p: Project) => Project, edit?: { entryId: string; transaction: Transaction }) => {
      const p = current.current;
      if (p)
        apply({ ...withCommentRevisions(p, change(p), edit), revision: p.revision + 1, updatedAt: now() });
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
      pendingJump.current = null;
      pendingContentChange.current = null;
      setReattachment(null);
      current.current = p;
      setProject(p);
      const location = locations.current[p.id];
      setActive(
        location?.active && p.entries.some((e) => e.id === location.active)
          ? location.active
          : (p.order[0] ?? p.entries[0]?.id ?? ""),
      );
      setDestination(location?.destination ?? "manuscript");
      setTabs((tabs) =>
        tabs.some((t) => t.id === p.id)
          ? tabs.map((t) => (t.id === p.id ? { id: p.id, title: p.title } : t))
          : [...tabs, { id: p.id, title: p.title }],
      );
      setTarget(p.order[0] ?? "");
      setVersions(null);
      setPreview(null);
      setQuery("");
      setMode(location?.mode ?? "write");
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
      if (opening.current) return;
      opening.current = true;
      try {
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
      } finally {
        opening.current = false;
      }
    },
    [enter, queue],
  );
  useEffect(() => {
    void run(async () => {
      await refreshLibrary();
      setPath(await storage.path());
      const last = localStorage.getItem("folio.lastProject");
      if (last && readPreference("personal-word.restoreTabs", false))
        await open(last);
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
        setDestination(kind === "fragment" ? "fragment-editor" : "manuscript");
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
        window.dispatchEvent(new Event("personal-word:toggle-sidebar"));
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
  useEffect(() => {
    if (project) {
      locations.current[project.id] = { active, mode, destination };
      setTabs((tabs) =>
        tabs.some((t) => t.id === project.id)
          ? tabs.map((t) =>
              t.id === project.id && t.title !== project.title
                ? { ...t, title: project.title }
                : t,
            )
          : [...tabs, { id: project.id, title: project.title }],
      );
    }
  }, [project?.id, project?.title, active, mode, destination]);
  const item = project?.entries.find((e) => e.id === active);
  const writing =
    !!item &&
    mode !== "read" &&
    destination !== "settings" &&
    destination !== "comments";
  const asideResizer = (
    <AsideResizer
      width={asideWidth}
      onWidth={(width) => setAsideWidth(clampAside(width))}
    />
  );
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
            setTabs((tabs) => tabs.filter((t) => t.id !== s.id));
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
    let extractionTransaction: Transaction | undefined;
    const extracted = editor
      .chain()
      .setMeta("preventUpdate", true)
      .deleteRange({ from, to })
      .command(({ tr }) => { extractionTransaction = tr; return true; })
      .run();
    if (!extracted || !extractionTransaction) return;
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
    }), { entryId: source.id, transaction: extractionTransaction });
    setNotice(
      "Selection kept in Fragments. Its original section and position are remembered.",
    );
  };
  const restoreFragment = () => {
    if (!item || item.kind !== "fragment" || !target) return;
    appendFragment(item, target);
  };
  const appendFragment = (fragment: Entry, target: string, open = true) => {
    const editor = editorRef.current;
    if (!open && target === active && mode === "write" && editor) {
      // The open editor owns this section's content; append through it so its
      // next save cannot overwrite the appended text.
      editor.commands.insertContentAt(
        editor.state.doc.content.size,
        fragment.content.content ?? [],
      );
      mutate((p) => ({
        ...p,
        entries: p.entries.map((e) =>
          e.id === fragment.id
            ? {
                ...e,
                uses: [
                  ...(e.uses ?? []),
                  { projectId: p.id, sectionId: target, date: now() },
                ],
              }
            : e,
        ),
      }));
      setNotice(
        "Fragment appended to the section. The original remains in Fragments.",
      );
      return;
    }
    mutate((p) => ({
      ...p,
      entries: p.entries.map((e) => {
        if (e.id === fragment.id)
          return {
            ...e,
            uses: [
              ...(e.uses ?? []),
              { projectId: p.id, sectionId: target, date: now() },
            ],
          };
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
    if (open) setActive(target);
    setNotice(
      "Fragment appended to the section. The original remains in Fragments.",
    );
  };
  const insertFragment = (fragment: Entry) => {
    const editor = editorRef.current;
    const section = current.current?.entries.find((e) => e.id === active);
    if (!editor || !section || section.kind !== "section") {
      setNotice("Open a section and place the cursor to insert a fragment.");
      return;
    }
    editor
      .chain()
      .focus()
      .insertContent(fragment.content.content ?? [])
      .run();
    mutate((p) => ({
      ...p,
      entries: p.entries.map((e) =>
        e.id === fragment.id
          ? {
              ...e,
              uses: [
                ...(e.uses ?? []),
                { projectId: p.id, sectionId: section.id, date: now() },
              ],
            }
          : e,
      ),
    }));
    setNotice("Fragment inserted. The original remains in Fragments.");
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
      apply(withCommentRevisions(current.current, {
        ...preview,
        id: current.current.id,
        revision: current.current.revision + 1,
        updatedAt: now(),
      }));
      await queue.flush();
      setEditorEpoch((n) => n + 1);
      setActive(preview.order[0] ?? "");
      setDestination("manuscript");
      setMode("write");
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
  const create = (templateId = "blank") =>
    setNameDialog({
      title: "A new writing project",
      label: "Project title",
      value: "",
      action: async (title) => {
        await queue.flush();
        const template =
          [...writingTemplates, ...customTemplates].find(
            (t) => t.id === templateId,
          ) ?? writingTemplates[0];
        const p = newProject(title);
        p.templateId = template.id;
        p.documentSettings = { ...template.settings };
        p.entries = template.sections.map((section) => ({
          ...entry("section", section.title),
          content: structuredClone(section.content),
          text: textOf(section.content),
        }));
        p.order = p.entries.map((e) => e.id);
        if (template.id === "chicago") {
          p.entries[0].content = {
            type: "doc",
            content: [
              {
                type: "paragraph",
                attrs: {
                  textAlign: "center",
                  firstLineIndent: "0",
                  spaceBefore: "144pt",
                  spaceAfter: "48pt",
                },
                content: [{ type: "text", text: title }],
              },
              ...["[Your name]", "[Course]", "[Instructor]", "[Date]"].map(
                (text) => ({
                  type: "paragraph",
                  attrs: { textAlign: "center", firstLineIndent: "0" },
                  content: [{ type: "text", text }],
                }),
              ),
            ],
          };
          p.entries[0].text = textOf(p.entries[0].content);
        }
        p.pageLayout = {
          mode: template.id === "chicago" ? "pages" : "continuous",
          paper: "letter",
          margin: template.settings.marginInches * 96,
          zoom: 100,
        };
        setDestination("manuscript");
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
    const text = await file.text();
    const { project: p, assets } = await readProjectArchive(text);
    await queue.flush();
    const imported: Project = {
      ...p,
      id: crypto.randomUUID(),
      revision: 1,
      title: p.title + " (recovered)",
      updatedAt: now(),
    };
    await storage.createProjectWithAssets(imported, assets);
    queue.open(imported.id, imported);
    enter(imported, false);
  };
  const importWriting = async (file: File) => {
    // Mid-parse cancellation (Gate B F1 / T032): the preview may take a while
    // for large DOCX/HTML files, so show a cancellable "Importing writing"
    // dialog and pass an AbortSignal into previewWriting.
    const controller = new AbortController();
    importAbort.current?.abort();
    importAbort.current = controller;
    setImportBusy({ filename: file.name });
    try {
      const buffer = await file.arrayBuffer();
      if (controller.signal.aborted) return;
      const draft = await previewWriting(buffer, file.name, {
        signal: controller.signal,
      });
      if (controller.signal.aborted) return;
      setImportPreview(draft);
    } catch (e) {
      // A cancelled import is not an error: leave no dialog and no project.
      if (controller.signal.aborted || (e as { name?: string })?.name === "AbortError") return;
      throw e;
    } finally {
      if (importAbort.current === controller) importAbort.current = null;
      setImportBusy(null);
    }
  };
  const cancelImport = () => {
    importAbort.current?.abort();
    importAbort.current = null;
    setImportBusy(null);
  };
  const confirmImport = async (title: string) => {
    if (!importPreview) return;
    const imported = { ...importPreview.project, title };
    await queue.flush();
    const assets = ("assets" in importPreview && Array.isArray(importPreview.assets)) ? importPreview.assets : [];
    await storage.createProjectWithAssets(imported, assets);
    queue.open(imported.id, imported);
    enter(imported, false);
    setImportPreview(null);
  };
  const goLibrary = () =>
    void run(async () => {
      await saveAll();
      await refreshLibrary();
      current.current = null;
      setProject(null);
      setDestination("manuscript");
    });
  const addAnnotation = (kind: "comment" | "task" = "task") => {
    const editor = editorRef.current;
    const selectedEntry = current.current?.entries.find((e) => e.id === active);
    const projectId = current.current?.id;
    const quote =
      editor && !editor.state.selection.empty
        ? editor.state.doc.textBetween(
            editor.state.selection.from,
            editor.state.selection.to,
            "\n",
          )
        : "";
    const entryId = active;
    const capturedAnchor = editor && selectedEntry && !editor.state.selection.empty
      ? createCommentAnchor(editor.state.doc, editor.state.selection.from, editor.state.selection.to, selectedEntry.contentRevision ?? 0)
      : undefined;
    setNameDialog({
      title: kind === "comment" ? "Comment on selection" : "Add revision task",
      label: "Note",
      value: "",
      action: (text) =>
        mutate((p) => {
          const live = p.entries.find((e) => e.id === entryId);
          if (p.id !== projectId || (capturedAnchor && (!live || (live.contentRevision ?? 0) !== capturedAnchor.entryRevision)))
            throw new Error("The passage changed while this comment was open. Select it again before adding a comment.");
          return { ...p, annotations: [
            ...(p.annotations ?? []),
            {
              id: crypto.randomUUID(),
              entryId,
              quote,
              text,
              resolved: false,
              createdAt: now(),
              kind,
              ...(capturedAnchor ? { anchor: capturedAnchor } : {}),
            },
          ] };
        }),
    });
  };
  const startReattachment = (annotation: Annotation) => {
    const p = current.current;
    const entry = p?.entries.find((e) => e.id === annotation.entryId);
    if (!p || !entry) return;
    pendingJump.current = null;
    setReattachment({ projectId: p.id, annotationId: annotation.id, entryId: entry.id, entryRevision: entry.contentRevision ?? 0, selection: null });
    setActive(entry.id);
    setMode("write");
    setDestination("manuscript");
  };
  const finishReattachment = () => {
    const editor = editorRef.current;
    const p = current.current;
    const entry = p?.entries.find((e) => e.id === reattachment?.entryId);
    if (!editor || !p || !entry || !reattachment || editor.state.selection.empty) return;
    if (p.id !== reattachment.projectId || (entry.contentRevision ?? 0) !== reattachment.entryRevision || !editor.state.doc.eq(editor.schema.nodeFromJSON(entry.content))) {
      setReattachment(null);
      setError("The passage changed during reattachment. Start again from Comments.");
      return;
    }
    const { from, to } = editor.state.selection;
    const quote = editor.state.doc.textBetween(from, to, "\n");
    if (!quote) return;
    const anchor = createCommentAnchor(editor.state.doc, from, to, entry.contentRevision ?? 0);
    if (!anchor) return;
    mutate((project) => ({ ...project, annotations: project.annotations?.map((a) => a.id === reattachment.annotationId ? { ...a, quote, anchor } : a) }));
    setReattachment(null);
    setDestination("comments");
    setNotice("Comment attached to the selected passage.");
  };
  const restoreEntry = (old: Entry, patch?: RestorePatch) =>
    void run(async () => {
      const before = current.current;
      const historical = preview;
      if (!before || !historical || historical.id !== before.id || !historical.entries.some((e) => e.id === old.id))
        throw new Error("Open a snapshot of this project before restoring a passage.");
      // Compare complete JSON state without relying on Rust/JavaScript key order.
      const signature = (value: unknown) => JSON.stringify(value, (_key, item) =>
        item && typeof item === "object" && !Array.isArray(item)
          ? Object.fromEntries(Object.keys(item).sort().map((key) => [key, item[key]])) : item);
      const original = signature(before);
      const unchanged = () => {
        if (!current.current || signature(current.current) !== original)
          throw new Error("The project changed. Compare it again before restoring.");
      };
      const restored = (p: Project): Project => {
        const research = mergeMissingResearch(p.research, historical.research);
        if (patch) return applyRestorePatch({ ...p, research }, patch);
        const live = p.entries.find((e) => e.id === old.id);
        const replacement = { ...structuredClone(old), updatedAt: now() };
        return { ...p,
          entries: live ? p.entries.map((e) => e.id === old.id ? replacement : e) : [...p.entries, replacement],
          order: !live && old.kind === "section" ? [...p.order, old.id] : p.order,
          research,
        };
      };
      // Invalid/stale patches fail before creating a safety copy or changing prose.
      validateProject(restored(before));
      await queue.flush();
      unchanged();
      const safetyId = await storage.snapshot(before.id, "Before restoring passage");
      const safety = await storage.version(before.id, safetyId, false);
      validateProject(safety);
      if (signature(safety) !== original)
        throw new Error("The safety snapshot did not match the current writing. Nothing was restored.");
      unchanged();
      mutate((p) => {
        unchanged();
        const next = restored(p);
        validateProject(next);
        return next;
      });
      await queue.flush();
      setEditorEpoch((n) => n + 1);
      setActive(old.id);
      setDestination(old.kind === "fragment" ? "fragment-editor" : "manuscript");
      setMode("write");
      setVersions(null);
      setPreview(null);
      setNotice("Restored with a checked safety snapshot.");
    });
  const confirmSourceImport = async (selectedSources: CslImportResult["sources"], updates: SourceFieldUpdate[]) => {
    const before = current.current;
    const result = cslImportPreview;
    if (!before || !result || result.projectId !== before.id)
      throw new Error("The project changed. Review this source import again.");
    if (!selectedSources.length && !updates.length) return;
    if (selectedSources.some((source) => !result.sources.includes(source)))
      throw new Error("Choose only sources from this import preview.");
    const signature = (value: unknown) => JSON.stringify(value, (_key, item) =>
      item && typeof item === "object" && !Array.isArray(item)
        ? Object.fromEntries(Object.keys(item).sort().map((key) => [key, item[key]])) : item);
    const original = signature(before);
    const unchanged = () => {
      if (!current.current || signature(current.current) !== original)
        throw new Error("The project changed. Review this source import again.");
    };
    const research = before.research ?? { sources: [], notes: [], footnotes: [] };
    validateSourceMergeUpdates(research.sources, updates);
    const replacements = new Map<string, ReturnType<typeof mergeSourceFields>>();
    for (const update of updates) {
      const candidate = result.sources[update.candidateIndex];
      const targets = research.sources.filter((source) => source.id === update.existingSourceId);
      const source = targets[0];
      const shown = result.existingSources.find((source) => source.id === update.existingSourceId);
      const exact = result.review.exactDuplicates.find((row) => row.candidateIndex === update.candidateIndex);
      const possible = result.review.possibleMatches.find((row) => row.candidateIndex === update.candidateIndex);
      const allowed = exact?.existingSourceIds ?? possible?.matches.map((row) => row.existingSourceId) ?? [];
      if (!candidate || !source || !shown || !allowed.includes(source.id) || signature(source) !== signature(shown))
        throw new Error("A source changed or no longer matches this preview. Review the import again.");
      replacements.set(source.id, mergeSourceFields(source, candidate, update.fields));
    }
    const nextResearch = { ...research, sources: [
      ...research.sources.map((source) => replacements.get(source.id) ?? source),
      ...selectedSources.map((source) => ({ ...source, id: crypto.randomUUID() })),
    ] };
    validateProject({ ...before, research: nextResearch });
    await queue.flush();
    unchanged();
    if (updates.length) {
      const safetyId = await storage.snapshot(before.id, "Before updating research sources");
      const safety = await storage.version(before.id, safetyId, false);
      validateProject(safety);
      if (signature(safety) !== original)
        throw new Error("The safety snapshot did not match the current writing. No sources were updated.");
      unchanged();
    }
    mutate((project) => { unchanged(); return { ...project, research: nextResearch }; });
    // Once applied, close the review even if persistence fails: retrying the
    // save queue must not apply the source additions a second time.
    setCslImportPreview(null);
    await queue.flush();
    setNotice(updates.length ? "Source choices applied with a checked safety snapshot." : "Selected sources added.");
  };
  const insertFootnote = (id: string) => {
    const editor = editorRef.current;
    if (editor)
      editor
        .chain()
        .focus()
        .insertContent({ type: "footnoteReference", attrs: { id } })
        .run();
  };
  const saveTemplate = () =>
    setNameDialog({
      title: "Save reusable template",
      label: "Template name",
      value: "",
      action: (name) => {
        const p = current.current!;
        setCustomTemplates((items) => [
          ...items,
          {
            id: crypto.randomUUID(),
            name,
            description: "Your saved section structure and document settings.",
            custom: true,
            settings: p.documentSettings ?? defaultDocumentSettings,
            sections: p.order.map((id) => ({
              title: p.entries.find((e) => e.id === id)!.title,
              content: { type: "doc", content: [{ type: "paragraph" }] },
            })),
          },
        ]);
      },
    });
  const footnoteNumbers: Record<string, number> = useMemo(() => Object.fromEntries(
    (projectSummary?.referenceOrder ?? []).map((id, index) => [id, index + 1]),
  ), [projectSummary?.referenceOrder]);
  // Reuse the previous per-section reference list while it is unchanged, so
  // typing does not recompute the citation context.
  const sectionRefs = useRef<SectionReferences>([]);
  const citationSections = useMemo(() => {
    const next: SectionReferences = project && projectSummary
      ? project.order.flatMap((id) => project.entries.some((e) => e.id === id && e.kind === "section")
        ? [{ sectionId: id, ids: projectSummary.entries.get(id)?.referenceOrder ?? [] }]
        : [])
      : [];
    const previous = sectionRefs.current;
    if (next.length !== previous.length || next.some((s, i) => s.sectionId !== previous[i].sectionId ||
      s.ids.length !== previous[i].ids.length || s.ids.some((id, j) => id !== previous[i].ids[j])))
      sectionRefs.current = next;
    return sectionRefs.current;
  }, [project, projectSummary]);
  const citationContext = useMemo(() => project
    ? resolveCitationContext({ order: project.order, entries: project.entries, research: project.research }, citationSections)
    : {}, [citationSections, project?.research]);
  const insertResearchNote = (note: { kind: string; text: string; sourceId?: string; locator?: string }) => {
    const editor = editorRef.current;
    if (!editor) return;
    const id = crypto.randomUUID();
    const project = current.current;
    if (!project) return;
    const insertion = buildQuoteInsertion(note, note.sourceId ? id : undefined);
    const amendment = note.sourceId ? {
      projectId: project.id,
      entryId: active,
      amend: (p: Project): Project => {
        const research = p.research ?? { sources: [], notes: [], footnotes: [] };
        return {
          ...p,
          research: {
            ...research,
            footnotes: [...research.footnotes, {
              id, text: "", sourceId: note.sourceId, locator: note.locator, form: "auto",
            }],
          },
        };
      },
    } : null;
    pendingContentChange.current = amendment;
    try {
      editor.chain().focus().insertContent(insertion).run();
    } finally {
      if (pendingContentChange.current === amendment) pendingContentChange.current = null;
    }
  };
  const sections =
    project?.order
      .map((id) => project.entries.find((e) => e.id === id)!)
      .filter(Boolean) ?? [];
  const scopedWords = goalScope === "manuscript-and-fragments" ? projectSummary?.allWords ?? 0 : projectSummary?.manuscriptWords ?? 0;
  const goals = project ? goalStatus(project, goalDay,
    goalBaseline?.projectId === project.id && goalBaseline.context === goalContext && goalBaseline.date === goalDay
      ? goalBaseline.words : scopedWords, scopedWords) : {};
  const patchGoalPreference = (key: "scope" | "dayMode", value: string) => {
    if (key === "scope" && value !== "manuscript" && value !== "manuscript-and-fragments") return;
    if (key === "dayMode" && value !== "local" && value !== "utc") return;
    mutate((p) => ({ ...p, goals: { ...p.goals, [key]: value } }));
    setNotice("Goal settings changed -- daily progress starts from the current word count.");
  };
  const patchGoal = (key: "totalWords" | "dailyWords" | "deadline", value: string) => {
    if (key === "deadline" && value && !isValidGoalDeadline(value)) {
      setError("Enter a valid deadline date.");
      return;
    }
    if (key !== "deadline" && value && (!Number.isSafeInteger(Number(value)) || Number(value) <= 0)) {
      setError("Writing goals must be positive whole numbers.");
      return;
    }
    mutate((p) => {
      const next = { ...p.goals };
      if (!value) delete next[key];
      else if (key === "deadline") next.deadline = value;
      else next[key] = Number(value);
      return { ...p, goals: Object.keys(next).length ? next : undefined };
    });
  };
  return (
    <div className="app-shell">
      <ProjectTabs
        tabs={tabs}
        activeId={project?.id ?? ""}
        onSelect={(id) => void run(() => open(id))}
        onLibrary={goLibrary}
        onClose={(id) =>
          void run(async () => {
            await queue.flush();
            setTabs((t) => t.filter((x) => x.id !== id));
            if (project?.id === id) {
              await refreshLibrary();
              current.current = null;
              setProject(null);
            }
          })
        }
      />
      <div className="app">
        {!project ? (
          <ProjectLibrary
            projects={library}
            templates={[...writingTemplates, ...customTemplates].map((t) => ({
              id: t.id,
              name: t.name,
            }))}
            onCreate={create}
            onOpen={(id) => void run(() => open(id))}
            onDelete={removeProject}
            onImport={(file) => void run(() => importProject(file))}
            onImportWriting={(file) => void run(() => importWriting(file))}
            damagedJournals={damagedJournals}
            onExportJournal={(d) =>
              download(d.key + ".txt", d.raw, "text/plain")
            }
            onDiscardJournal={(d) =>
              void run(async () => {
                discardJournal(
                  localStorage,
                  d.key.slice(journalKey("").length),
                );
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
              key={project.id}
              project={project}
              activeDestination={destination}
              groupOrder={project.sidebarOrder}
              onGroupOrder={(sidebarOrder) =>
                mutate((p) => ({ ...p, sidebarOrder }))
              }
              onDestination={(id) => {
                setDestination(id);
                if (id === "read") setMode("read");
                else if (id !== "history") setMode("write");
              }}
              onEntryDetails={(id, patch) =>
                mutate((p) => ({
                  ...p,
                  entries: p.entries.map((e) =>
                    e.id === id ? { ...e, ...patch } : e,
                  ),
                }))
              }
              collectionItems={{
                research: (project.research?.notes ?? []).map((n) => ({
                  id: n.id,
                  title: n.text.slice(0, 70) || "Research note",
                  detail: n.kind,
                })),
                comments: (project.annotations ?? [])
                  .filter((a) => !a.resolved)
                  .map((a) => ({ id: a.id, title: a.text })),
                history: (versions ?? []).map((v) => ({
                  id: v.id,
                  title: v.name,
                })),
              }}
              onCollectionSelect={(group, id) => {
                setDestination(group);
                setMode("write");
                if (group === "history")
                  void run(async () => {
                    setPreview(await storage.version(project.id, id, history));
                    setPreviewName(
                      versions?.find((v) => v.id === id)?.name ?? "Snapshot",
                    );
                  });
                if (group === "research") {
                  setResearchTab("notes");
                  setFocusFootnote(undefined);
                  setResearchEpoch((n) => n + 1);
                }
              }}
              onCollectionAdd={(group) => {
                if (group === "comments") addAnnotation();
                else if (group === "history") snapshot();
                else {
                  setDestination(group);
                  setMode("write");
                  setResearchTab("notes");
                  setFocusFootnote(undefined);
                  setResearchEpoch((n) => n + 1);
                  mutate((p) => ({
                    ...p,
                    research: {
                      ...(p.research ?? {
                        sources: [],
                        notes: [],
                        footnotes: [],
                      }),
                      notes: [
                        ...(p.research?.notes ?? []),
                        { id: crypto.randomUUID(), kind: "personal", text: "" },
                      ],
                    },
                  }));
                }
              }}
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
                setDestination(
                  project.entries.find((e) => e.id === id)?.kind === "fragment"
                    ? "fragment-editor"
                    : "manuscript",
                );
                setMode("write");
              }}
              onRename={rename}
              onReorder={reorder}
              onRead={() => {
                setMode("read");
                setDestination("read");
              }}
              onVersions={() => showVersions()}
            />
            <main className="workspace" aria-busy={busy}>
              <header className="topbar">
                <div>
                  <button
                    aria-label="Toggle sidebar"
                    title="Toggle sidebar (⌘\\)"
                    onClick={() =>
                      window.dispatchEvent(
                        new Event("personal-word:reveal-sidebar"),
                      )
                    }
                  >
                    <PanelLeftClose size={18} />
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
                    {writing && item ? (
                      <>
                        <button
                          className="breadcrumb-title"
                          title={"Rename " + item.kind}
                          aria-label={"Rename " + item.kind}
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
                          <Trash2 size={13} />
                        </button>
                      </>
                    ) : (
                      "Manuscript"
                    )}
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
                      void run(async () => {
                        const p = current.current ?? project;
                        if (!p) return;
                        const archive = await createProjectArchive(p, (id) =>
                          storage.readAsset(p.id, id),
                        );
                        download(p.title + ".json", archive, "application/json");
                      })
                    }
                  >
                    <Download size={17} />
                  </button>
                </div>
              </header>
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
              {destination === "settings" ? (
                <div className="project-settings">
                  <h1>Project settings</h1>
                  <section className="settings-section">
                    <h2>General</h2>
                    <label className="settings-check">
                      <input
                        type="checkbox"
                        checked={restoreTabs}
                        onChange={(e) => {
                          setRestoreTabs(e.target.checked);
                          localStorage.setItem(
                            "personal-word.restoreTabs",
                            JSON.stringify(e.target.checked),
                          );
                        }}
                      />
                      Restore open project tabs at launch
                    </label>
                    <p className="settings-help">
                      Default startup opens Projects.
                    </p>
                    <div className="settings-form">
                      <div className="settings-field">
                        <span className="settings-label">Storage location</span>
                        <button
                          className="settings-button"
                          title={path}
                          onClick={() => setNotice(path)}
                        >
                          Show path
                        </button>
                      </div>
                    </div>
                  </section>
                  <section className="settings-section">
                    <h2>Goals</h2>
                    <div className="settings-form">
                      <label className="settings-field">Total word goal
                        <input type="number" min="1" step="1" value={project.goals?.totalWords ?? ""}
                          onChange={(event) => patchGoal("totalWords", event.target.value)} />
                      </label>
                      <label className="settings-field">Daily word goal
                        <input type="number" min="1" step="1" value={project.goals?.dailyWords ?? ""}
                          onChange={(event) => patchGoal("dailyWords", event.target.value)} />
                      </label>
                      <label className="settings-field">Goal scope
                        <select aria-label="Goal scope" value={goalScope} onChange={(event) => patchGoalPreference("scope", event.target.value)}>
                          <option value="manuscript">Manuscript</option>
                          <option value="manuscript-and-fragments">Manuscript and fragments</option>
                        </select>
                      </label>
                      <label className="settings-field">Goal day
                        <select aria-label="Goal day" value={goalMode} onChange={(event) => patchGoalPreference("dayMode", event.target.value)}>
                          <option value="local">Local day</option><option value="utc">UTC day</option>
                        </select>
                      </label>
                      <label className="settings-field">Deadline
                        <input type="date" value={project.goals?.deadline ?? ""}
                          onChange={(event) => patchGoal("deadline", event.target.value)} />
                      </label>
                    </div>
                    <p className="settings-help">Daily progress starts when you first open the project each selected day. Changing scope, day mode, or local time zone starts a fresh daily baseline. Current baseline: {goalBaseline?.words.toLocaleString() ?? scopedWords.toLocaleString()} words on {goalDay}.</p>
                  </section>
                  <ExportPanel
                    project={project}
                    onSettingsChange={(documentSettings) =>
                      mutate((p) => ({
                        ...p,
                        documentSettings,
                        pageLayout: p.pageLayout
                          ? {
                              ...p.pageLayout,
                              margin: documentSettings.marginInches * 96,
                            }
                          : p.pageLayout,
                      }))
                    }
                  />
                  <TemplatePicker
                    onChoose={(template) => create(template.id)}
                    customTemplates={customTemplates}
                    onSaveCurrent={saveTemplate}
                    onDeleteCustom={(id) =>
                      setCustomTemplates((items) =>
                        items.filter((t) => t.id !== id),
                      )
                    }
                  />
                </div>
              ) : destination === "comments" ? (
                <CommentsPanel
                  project={project}
                  onChange={(annotations) =>
                    mutate((p) => ({ ...p, annotations }))
                  }
                  onAdd={() => addAnnotation()}
                  onReattach={startReattachment}
                  onJump={(annotation) => {
                    pendingJump.current = annotation.id;
                    setActive(annotation.entryId);
                    setMode("write");
                    setDestination("manuscript");
                    setNotice(annotation.quote ? "Opened commented passage." : "Opened section.");
                  }}
                />
              ) : mode === "read" ? (
                <div className="manuscript-read">
                  <div
                    className="reader-options"
                    role="toolbar"
                    aria-label="Reading display"
                  >
                    <label>
                      Font
                      <Dropdown
                        label="Font"
                        value={reader.font}
                        onChange={(font) => setReader({ ...reader, font })}
                        options={[
                          {
                            value: "Futura, Avenir, sans-serif",
                            label: "Futura / Avenir",
                          },
                          {
                            value: "-apple-system, sans-serif",
                            label: "System sans",
                          },
                          { value: "Georgia, serif", label: "Georgia" },
                          { value: "monospace", label: "Monospace" },
                        ]}
                      />
                    </label>
                    <label>
                      Size
                      <input
                        aria-label="Reading font size"
                        type="number"
                        min="10"
                        max="48"
                        value={reader.size}
                        onChange={(e) =>
                          setReader({ ...reader, size: Number(e.target.value) })
                        }
                      />
                    </label>
                    <label>
                      Line spacing
                      <input
                        aria-label="Reading line spacing"
                        type="number"
                        min="1"
                        max="3"
                        step="0.1"
                        value={reader.spacing}
                        onChange={(e) =>
                          setReader({
                            ...reader,
                            spacing: Math.max(
                              1,
                              Math.min(3, Number(e.target.value) || 1.6),
                            ),
                          })
                        }
                      />
                    </label>
                  </div>
                  <div className="eyebrow">
                    CONTINUOUS MANUSCRIPT -- READ ONLY
                  </div>
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
                      <div
                        className="read-prose"
                        style={{
                          fontFamily: reader.font,
                          fontSize: reader.size,
                          lineHeight: reader.spacing,
                        }}
                      >
                        {e.text ? (
                          <ReadDocument
                            content={e.content}
                            numbers={footnoteNumbers}
                            resolveAsset={resolveAsset}
                          />
                        ) : (
                          "This section is waiting for words."
                        )}
                      </div>
                    </section>
                  ))}
                  {project.research &&
                    Object.keys(footnoteNumbers).length > 0 && (
                      <section className="reader-footnotes">
                        <h2>Notes</h2>
                        {Object.entries(footnoteNumbers).map(([id, number]) => {
                          const note = project.research!.footnotes.find(
                            (n) => n.id === id,
                          );
                          return (
                            <p key={id}>
                              <sup>{number}</sup>{" "}
                              {note
                                ? footnoteText(note, project.research!, citationContext[note.id]?.form, citationContext[note.id]?.locator)
                                : "Missing note"}
                            </p>
                          );
                        })}
                      </section>
                    )}
                </div>
              ) : item ? (
                <div className="editor-area">
                  {reattachment?.projectId === project.id && reattachment.entryId === item.id && (
                    <div className="restore-fragment" role="region" aria-label="Reattach comment">
                      <span>Select the passage to attach this comment.</span>
                      <button disabled={!reattachment.selection} onMouseDown={(event) => event.preventDefault()} onClick={finishReattachment}>
                        Attach comment to selection
                      </button>
                      <button onClick={() => { setReattachment(null); setDestination("comments"); }}>
                        Cancel reattachment
                      </button>
                    </div>
                  )}
                  <Writer
                    key={item.id + ":" + editorEpoch}
                    focusMode={focusMode}
                    proseCheck={proseCheck}
                    onToggleFocusMode={() => setFocusMode((value) => !value)}
                    onToggleProseCheck={() => setProseCheck((value) => !value)}
                    item={item}
                    resolveAsset={resolveAsset}
                    onInsertImage={onInsertImage}
                    documentSettings={project.documentSettings}
                    footnoteNumbers={footnoteNumbers}
                    footnotes={(project.research?.footnotes ?? [])
                      .filter((n) => footnoteNumbers[n.id])
                      .map((n) => ({
                        id: n.id,
                        number: footnoteNumbers[n.id],
                        text: n.text,
                        citation: footnoteText(n, project.research!, citationContext[n.id]?.form, citationContext[n.id]?.locator),
                        editable: true,
                      }))}
                    onFootnoteTextChange={(id, text) =>
                      mutate((p) => ({
                        ...p,
                        research: p.research && {
                          ...p.research,
                          footnotes: p.research.footnotes.map((n) =>
                            n.id === id ? { ...n, text } : n,
                          ),
                        },
                      }))
                    }
                    onFootnote={(id) => {
                      setFocusFootnote(id);
                      setResearchEpoch((n) => n + 1);
                      setResearchTab("sources");
                      setDestination("research");
                    }}
                    layout={project.pageLayout}
                    onLayoutChange={(pageLayout) =>
                      mutate((p) => ({
                        ...p,
                        pageLayout,
                        documentSettings: {
                          ...(p.documentSettings ?? defaultDocumentSettings),
                          marginInches: pageLayout.margin / 96,
                        },
                      }))
                    }
                    onEditorReady={editorReady}
                    onSelectionChange={reattachment ? (editor) => {
                      const { from, to, empty } = editor.state.selection;
                      const hasText = !empty && !!editor.state.doc.textBetween(from, to, "\n");
                      setReattachment((pending) => pending?.projectId === project.id && pending.entryId === item.id
                        ? { ...pending, selection: hasText ? { from, to } : null } : pending);
                    } : undefined}
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
                    onEdit={(content, text, transaction) => {
                      const amendment = pendingContentChange.current;
                      pendingContentChange.current = null;
                      mutate((p) => {
                        const next = { ...p, entries: p.entries.map((e) => e.id === item.id ? { ...e, content, text, updatedAt: now() } : e) };
                        return amendment?.projectId === p.id && amendment.entryId === item.id ? amendment.amend(next) : next;
                      }, { entryId: item.id, transaction });
                    }}
                    onComment={() => addAnnotation("comment")}
                    onPageStatus={(s) =>
                      setPageStatus((prev) =>
                        prev.current === s.current && prev.total === s.total
                          ? prev
                          : s,
                      )
                    }
                    header={
                      item.origin ? (
                        <p className="origin">
                          Kept from “{item.origin.sectionTitle}” --{" "}
                          {new Date(item.origin.removedAt).toLocaleDateString()}
                        </p>
                      ) : undefined
                    }
                    footer={
                      item.kind === "fragment" ? (
                        <div className="restore-fragment">
                          <span>Give these words a home</span>
                          <Dropdown
                            label="Restore fragment to section"
                            width={220}
                            value={target}
                            onChange={setTarget}
                            options={[
                              { value: "", label: "Choose a section" },
                              ...sections.map((e) => ({
                                value: e.id,
                                label: e.title,
                              })),
                            ]}
                          />
                          <button disabled={!target} onClick={restoreFragment}>
                            Append to section →
                          </button>
                        </div>
                      ) : undefined
                    }
                  />
                </div>
              ) : (
                <div className="empty-editor">
                  <h1>A little room to begin.</h1>
                  <button className="primary" onClick={() => add("section")}>
                    Create a section
                  </button>
                </div>
              )}
              <footer className="document-statistics">
                {writing && project.pageLayout?.mode === "pages" && (
                  <span aria-label="Page count" aria-live="polite">
                    Section page {pageStatus.current} of {pageStatus.total}
                  </span>
                )}
                <span title={`${item?.text.length ?? 0} characters`}>
                  {(mode === "read"
                    ? sections.reduce((n, e) => n + words(e.text), 0)
                    : words(item?.text ?? "")
                  ).toLocaleString()}{" "}
                  words
                </span>
                {(goals.daily || goals.total || goals.daysLeft !== undefined) && <span className="writing-goals" aria-label="Writing goals">
                  {goals.daily && <span className="goal-daily">{goals.daily.done.toLocaleString()} of {goals.daily.target.toLocaleString()} today</span>}
                  {goals.total && <span className="goal-total">{goals.total.done.toLocaleString()} of {goals.total.target.toLocaleString()}</span>}
                  {goals.daysLeft !== undefined && <span className="goal-deadline">{goals.daysLeft} {goals.daysLeft === 1 ? "day" : "days"} left{goals.perDayNeeded !== undefined ? `, ${goals.perDayNeeded.toLocaleString()} a day` : ""}</span>}
                </span>}
              </footer>
            </main>
            {(destination === "fragments" || destination === "research") &&
              asideResizer}
            {destination === "fragments" && (
              <aside
                className="research-aside fragment-aside"
                style={{ width: asideWidth }}
              >
                <header>
                  <strong>Fragment library</strong>
                  <button
                    aria-label="Close fragment library"
                    onClick={() => setDestination("manuscript")}
                  >
                    <X size={16} />
                  </button>
                </header>
                <FragmentLibrary
                  project={project}
                  onOpen={(id) => {
                    setActive(id);
                    setDestination("fragment-editor");
                    setMode("write");
                  }}
                  onTags={(id, tags) =>
                    mutate((p) => ({
                      ...p,
                      entries: p.entries.map((e) =>
                        e.id === id ? { ...e, tags } : e,
                      ),
                    }))
                  }
                  onCopy={(source, fragment) => {
                    void run(async () => {
                      const target = current.current;
                      if (!target) return;
                      await copyFragmentAssets(target.id, source.id, fragment, storage);
                      mutate((p) => importFragment(p, source, fragment));
                      setNotice("Fragment copied with its source references.");
                    });
                  }}
                  activeId={mode === "write" ? item?.id : undefined}
                  onEdit={(id, content, text) =>
                    mutate((p) => ({
                      ...p,
                      entries: p.entries.map((e) =>
                        e.id === id
                          ? { ...e, content, text, updatedAt: now() }
                          : e,
                      ),
                    }))
                  }
                  onInsert={insertFragment}
                  sections={sections.map((e) => ({ id: e.id, title: e.title }))}
                  onAppend={(fragment, sectionId) =>
                    appendFragment(fragment, sectionId, false)
                  }
                  onDelete={remove}
                />
              </aside>
            )}
            {destination === "research" && (
              <aside className="research-aside" style={{ width: asideWidth }}>
                <header>
                  <strong>Research</strong>
                  <button
                    aria-label="Close research"
                    onClick={() => setDestination("manuscript")}
                  >
                    <X size={16} />
                  </button>
                </header>
                <ResearchPanel
                  key={researchEpoch}
                  initialTab={researchTab}
                  focusFootnoteId={focusFootnote}
                  citationContext={citationContext}
                  onInsertNote={insertResearchNote}
                  onImportCsl={(result) => { if (current.current) setCslImportPreview({ ...result, projectId: current.current.id }); }}
                  onCaptureQuote={(note, insert) => { if (insert) insertResearchNote(note); }}
                  data={project.research}
                  onChange={(research) => mutate((p) => ({ ...p, research }))}
                  onInsertFootnote={
                    editorRef.current ? insertFootnote : undefined
                  }
                />
              </aside>
            )}
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
              {error ||
                (status.state === "error" ? status.message : mirrorError)}
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
        <ProjectDialogs name={nameDialog} choice={choice} busy={busy} setName={setNameDialog} setChoice={setChoice} setBusy={setBusy} run={run} />
        {importBusy && <ImportBusy filename={importBusy.filename} onCancel={cancelImport} />}
        {importPreview && <ImportPreview preview={importPreview} busy={busy} onCancel={() => setImportPreview(null)} onImport={(title) => {
          setBusy(true);
          void run(() => confirmImport(title)).finally(() => setBusy(false));
        }} />}
        {cslImportPreview && <CslImportPreview
          result={cslImportPreview}
          onCancel={() => setCslImportPreview(null)}
          busy={busy}
          onAdd={(selectedSources, updates) => {
            setBusy(true);
            void run(() => confirmSourceImport(selectedSources, updates)).finally(() => setBusy(false));
          }}
        />}
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
                {project && (
                  <RevisionComparison
                    before={preview}
                    current={project}
                    onRestore={restoreEntry}
                  />
                )}
                {[
                  ...preview.order.map((id) =>
                    preview.entries.find((e) => e.id === id)!,
                  ),
                  ...preview.entries.filter((e) => e.kind === "fragment"),
                ].map((e) => (
                  <section key={e.id} id={"read-" + e.id}>
                    <h3>
                      {e.title}{" "}
                      {e.kind === "fragment" && <small>-- Fragment</small>}
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
    </div>
  );
}
