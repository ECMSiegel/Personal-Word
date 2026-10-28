import { useEffect, useReducer, useRef } from "react";
import type { DragEvent, ReactNode } from "react";
import "./drop-target.css";

export type DropItem = { name: string; size: number; type: string };
/** A reason the item cannot be taken, or null when it can. */
export type Accept = (file: DropItem) => string | null;

export type DragState = {
  /** dragenter minus dragleave on the window; above 0 means a drag is over the window. */
  depth: number;
  items: DropItem[];
};
export type DragAction =
  | { type: "enter"; items: DropItem[] }
  | { type: "leave" }
  | { type: "end" };

export const idleDrag: DragState = { depth: 0, items: [] };

export function dragReducer(state: DragState, action: DragAction): DragState {
  if (action.type === "enter")
    return { depth: state.depth + 1, items: action.items.length ? action.items : state.items };
  if (action.type === "leave") {
    const depth = Math.max(0, state.depth - 1);
    return depth ? { ...state, depth } : idleDrag;
  }
  return idleDrag;
}

export type Verdict = { state: "idle" | "accept" | "reject"; reason: string | null };

/** idle with no drag; reject (with the first reason) when any item fails accept; accept otherwise. */
export function verdict(drag: DragState, accept: Accept): Verdict {
  if (!drag.depth) return { state: "idle", reason: null };
  for (const item of drag.items) {
    const reason = accept(item);
    if (reason) return { state: "reject", reason };
  }
  return { state: "accept", reason: null };
}

/** The first reason any of these items is refused, or null. */
export function firstRejection(items: DropItem[], accept: Accept): string | null {
  for (const item of items) {
    const reason = accept(item);
    if (reason) return reason;
  }
  return null;
}

/**
 * Browsers hide file names and sizes until the drop: during the drag only the MIME type is known,
 * so name is "" and size 0 there. An accept function must therefore allow an empty name (judge by
 * type or let it through) and decide properly on the drop, when real names and sizes arrive.
 */
export function itemsFromTransfer(data: DataTransfer | null): DropItem[] {
  if (!data) return [];
  if (data.files && data.files.length)
    return [...data.files].map((f) => ({ name: f.name, size: f.size, type: f.type }));
  return [...(data.items ?? [])]
    .filter((item) => item.kind === "file")
    .map((item) => ({ name: "", size: 0, type: item.type }));
}

export const hasFiles = (data: DataTransfer | null) => !!data && [...(data.types ?? [])].includes("Files");

/** Native (Tauri) drags deliver paths only: size is unknown, so size checks must be skipped there. */
export const itemsFromPaths = (paths: string[]): DropItem[] =>
  paths.map((path) => ({ name: path.split(/[\\/]/).pop() ?? path, size: 0, type: "" }));

const isNative = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

/**
 * Wraps the region that will take a file. While a file drag is over the window the region gets a
 * 1 px outline (accent when accepted, danger when refused, with the reason as its one-line label);
 * the rest of the page is untouched. The Select files button is the keyboard path. In the browser
 * onFiles gets File objects; in the Mac app it gets file paths (read them with readDroppedPath),
 * and a drop only counts when it lands inside this region.
 */
export function DropTarget(props: {
  accept: Accept;
  onFiles: (files: File[] | string[]) => void;
  /** Shown as the label while a drag that can be accepted is over the window. */
  label: string;
  /** Called with the reason when a drop or a picked file is refused. */
  onReject?: (reason: string) => void;
  /** The in-region picker button's text and accessible name (default "Select files"). */
  selectLabel?: string;
  selectAriaLabel?: string;
  /**
   * Hide the in-region button and expose the picker through openPicker instead, for a screen that
   * places its own labelled control (the Projects toolbar).
   */
  openPicker?: { current: (() => void) | null };
  children?: ReactNode;
}) {
  const [drag, dispatch] = useReducer(dragReducer, idleDrag);
  const region = useRef<HTMLDivElement>(null);
  const picker = useRef<HTMLInputElement>(null);
  const latest = useRef(props);
  latest.current = props;
  if (props.openPicker) props.openPicker.current = () => picker.current?.click();

  useEffect(() => {
    if (isNative) {
      let disposed = false;
      let unlisten: (() => void) | undefined;
      void import("@tauri-apps/api/webview").then(({ getCurrentWebview }) =>
        getCurrentWebview().onDragDropEvent(({ payload }) => {
          if (payload.type === "enter") {
            dispatch({ type: "end" });
            if (payload.paths.length) dispatch({ type: "enter", items: itemsFromPaths(payload.paths) });
          } else if (payload.type === "leave") {
            dispatch({ type: "end" });
          } else if (payload.type === "drop") {
            dispatch({ type: "end" });
            const box = region.current?.getBoundingClientRect();
            const x = payload.position.x / window.devicePixelRatio;
            const y = payload.position.y / window.devicePixelRatio;
            if (!box || x < box.left || x > box.right || y < box.top || y > box.bottom) return;
            const reason = firstRejection(itemsFromPaths(payload.paths), latest.current.accept);
            if (reason) latest.current.onReject?.(reason);
            else latest.current.onFiles(payload.paths);
          }
        }),
      ).then((off) => {
        if (disposed) off();
        else unlisten = off;
      });
      return () => {
        disposed = true;
        unlisten?.();
      };
    }
    const enter = (e: globalThis.DragEvent) => {
      if (hasFiles(e.dataTransfer)) dispatch({ type: "enter", items: itemsFromTransfer(e.dataTransfer) });
    };
    const leave = (e: globalThis.DragEvent) => {
      if (hasFiles(e.dataTransfer)) dispatch({ type: "leave" });
    };
    const end = () => dispatch({ type: "end" });
    window.addEventListener("dragenter", enter);
    window.addEventListener("dragleave", leave);
    window.addEventListener("drop", end);
    window.addEventListener("dragend", end);
    return () => {
      window.removeEventListener("dragenter", enter);
      window.removeEventListener("dragleave", leave);
      window.removeEventListener("drop", end);
      window.removeEventListener("dragend", end);
    };
  }, []);

  const take = (files: File[]) => {
    if (!files.length) return;
    const reason = firstRejection(
      files.map((f) => ({ name: f.name, size: f.size, type: f.type })),
      props.accept,
    );
    if (reason) props.onReject?.(reason);
    else props.onFiles(files);
  };
  const onDragOver = (e: DragEvent) => {
    if (!hasFiles(e.dataTransfer)) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = verdict(drag, props.accept).state === "reject" ? "none" : "copy";
  };
  const onDrop = (e: DragEvent) => {
    if (!hasFiles(e.dataTransfer)) return;
    e.preventDefault();
    dispatch({ type: "end" });
    take([...e.dataTransfer.files]);
  };

  const { state, reason } = verdict(drag, props.accept);
  return (
    <div
      ref={region}
      className="drop-target"
      data-state={state === "idle" ? undefined : state}
      onDragOver={onDragOver}
      onDrop={onDrop}
    >
      {props.children}
      {!props.openPicker && (
        <button
          type="button"
          className="select-files"
          aria-label={props.selectAriaLabel}
          onClick={() => picker.current?.click()}
        >
          {props.selectLabel ?? "Select files"}
        </button>
      )}
      <input
        ref={picker}
        type="file"
        multiple
        hidden
        tabIndex={-1}
        onChange={(e) => {
          take([...(e.target.files ?? [])]);
          e.target.value = "";
        }}
      />
      {state !== "idle" && (
        <span className="drop-target-label" role="status">
          {state === "reject" ? reason : props.label}
        </span>
      )}
    </div>
  );
}
