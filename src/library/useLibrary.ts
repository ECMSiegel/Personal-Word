import { useEffect, useRef, useState } from "react";
import { storage } from "../storage";
import { emptyLibrary, parseLibrary, type LibraryState } from "./folders";

/**
 * The Projects page's folders (FB4). Loads `library.json` (browser preview: `folio.preview.library`)
 * once; `update` applies a pure change from `folders.ts`, shows it and writes the whole file.
 *
 * Never writes over a file it could not read: until the first read succeeds `update` does nothing,
 * and if that read rejects (or the file is of an unknown version) it does nothing for the rest of the session (every project then shows at
 * the top level). `onError` receives "Folders could not be loaded." / "Folders could not be saved."
 */
export function useLibrary(onError?: (message: string) => void): {
  state: LibraryState;
  update(fn: (s: LibraryState) => LibraryState): void;
  /** True once the read succeeded; false while loading and after a failed read. */
  ready: boolean;
} {
  const [state, setState] = useState<LibraryState>(emptyLibrary);
  const [ready, setReady] = useState(false);
  const current = useRef<LibraryState>(emptyLibrary);
  const writable = useRef(false);
  const writes = useRef<Promise<void>>(Promise.resolve());
  const report = useRef(onError);
  report.current = onError;

  useEffect(() => {
    let live = true;
    // parseLibrary throws for a library of an unknown version: that is a read error too.
    storage.readLibrary().then(parseLibrary).then(
      (parsed) => {
        if (!live) return;
        current.current = parsed;
        writable.current = true;
        setState(current.current);
        setReady(true);
      },
      () => {
        if (live) report.current?.("Folders could not be loaded.");
      },
    );
    return () => {
      live = false;
    };
  }, []);

  const update = (fn: (s: LibraryState) => LibraryState) => {
    if (!writable.current) return;
    const next = fn(current.current);
    if (next === current.current) return;
    current.current = next;
    setState(next);
    // One write at a time, in order, so an older state never lands after a newer one.
    writes.current = writes.current
      .then(() => storage.writeLibrary(next))
      .catch(() => report.current?.("Folders could not be saved."));
  };

  return { state, update, ready };
}
