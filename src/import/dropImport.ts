import { invoke } from "@tauri-apps/api/core";

/** The file types the writing importer reads; mirrors DROPPED_EXTENSIONS in src-tauri/src/dropped.rs. */
export const DROP_EXTENSIONS = [".txt", ".md", ".markdown", ".docx", ".html", ".htm", ".zip"];

/** Why a drop cannot be imported, or null when it is exactly one importable file. */
export function dropProblem(names: string[]): string | null {
  if (names.length !== 1) return "Drop one file at a time.";
  const name = names[0].toLowerCase();
  if (DROP_EXTENSIONS.some((ext) => name.endsWith(ext))) return null;
  return "Personal Word can import .txt, .md, .docx, .html or .zip files.";
}

export const baseName = (path: string) => path.split(/[\\/]/).pop() ?? path;

/** Mac app: reads a path from the window's latest drop through the Rust side. */
export async function readDroppedPath(path: string): Promise<File> {
  const bytes = await invoke<ArrayBuffer | Uint8Array<ArrayBuffer>>("read_dropped_file", { path });
  return new File([bytes], baseName(path));
}

/** Mac app: Tauri takes file drags before WebKit, so listen to its drag-drop event. */
export async function listenForNativeDrops(handlers: {
  onHover: (over: boolean) => void;
  onDrop: (paths: string[]) => void;
}): Promise<() => void> {
  const { getCurrentWebview } = await import("@tauri-apps/api/webview");
  return getCurrentWebview().onDragDropEvent(({ payload }) => {
    if (payload.type === "enter") {
      if (payload.paths.length) handlers.onHover(true);
    } else if (payload.type === "leave") {
      handlers.onHover(false);
    } else if (payload.type === "drop") {
      handlers.onHover(false);
      handlers.onDrop(payload.paths);
    }
  });
}
