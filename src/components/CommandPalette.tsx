import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { MOTION_MS, prefersReducedMotion } from "../motion";
import "./command-palette.css";

// Shape follows the command palette pattern (search combobox driving a
// grouped listbox, active option named by aria-activedescendant) seen in the
// BoardUI catalogue's command-palette component (MIT), read for behaviour
// ideas only; no code, Tailwind or React Aria was copied or installed.

export type PaletteCommand = {
  id: string;
  label: string;
  group: string;
  /** Right-aligned chord text, already formatted by the caller (formatChord). */
  hint?: string;
  run: () => void;
};

export type CommandPaletteProps = {
  open: boolean;
  commands: PaletteCommand[];
  onClose: () => void;
  /** Fade/slide in and out. Default false (instant): the caller sets it only when a pointer opened the palette. */
  animateIn?: boolean;
};

/** Case-insensitive substring match on label or group; groups keep first-seen order. */
export function groupCommands(commands: PaletteCommand[], query: string): { group: string; items: PaletteCommand[] }[] {
  const q = query.trim().toLowerCase();
  const groups: { group: string; items: PaletteCommand[] }[] = [];
  for (const c of commands) {
    if (q && !c.label.toLowerCase().includes(q) && !c.group.toLowerCase().includes(q)) continue;
    let g = groups.find((x) => x.group === c.group);
    if (!g) groups.push((g = { group: c.group, items: [] }));
    g.items.push(c);
  }
  return groups;
}

export function CommandPalette({ open, commands, onClose, animateIn = false }: CommandPaletteProps) {
  const uid = useId();
  const listId = `${uid}-list`;
  const [mounted, setMounted] = useState(open);
  const [shown, setShown] = useState(open && !animateIn);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  const list = useRef<HTMLDivElement>(null);
  const opener = useRef<HTMLElement | null>(null);
  const root = useRef<HTMLDivElement>(null);
  const caret = useRef<Range | null>(null);

  const groups = useMemo(() => groupCommands(commands, query), [commands, query]);
  const flat = useMemo(() => groups.flatMap((g) => g.items), [groups]);
  const optionId = (i: number) => `${uid}-opt-${i}`;
  const activeIndex = flat.length ? Math.min(active, flat.length - 1) : -1;

  // Open: remember what had focus (before moving it), reset, focus the field.
  useLayoutEffect(() => {
    if (!open) return;
    const prev = document.activeElement;
    opener.current = prev instanceof HTMLElement && prev !== document.body ? prev : null;
    // Focusing the field drops the editor's selection; keep it to put the caret back.
    const sel = window.getSelection();
    caret.current = sel && sel.rangeCount && opener.current?.contains(sel.anchorNode) ? sel.getRangeAt(0).cloneRange() : null;
    setMounted(true);
    setQuery("");
    setActive(0);
    if (animateIn && !prefersReducedMotion()) {
      setShown(false);
      const frame = requestAnimationFrame(() => setShown(true));
      input.current?.focus();
      return () => cancelAnimationFrame(frame);
    }
    setShown(true);
    input.current?.focus();
  }, [open, animateIn]);

  // Close: focus goes back once (Enter/Escape already did it), then fade out if animated.
  useEffect(() => {
    if (open) return;
    restoreFocus();
    if (!mounted) return;
    if (!animateIn || prefersReducedMotion()) { setMounted(false); return; }
    setShown(false);
    const t = window.setTimeout(() => setMounted(false), MOTION_MS.base);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (activeIndex < 0) return;
    document.getElementById(optionId(activeIndex))?.scrollIntoView?.({ block: "nearest" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeIndex, uid]);

  function restoreFocus() {
    const el = opener.current;
    opener.current = null;
    // If focus already moved on (a dialog opened, or the user clicked elsewhere), leave it there.
    const now = document.activeElement;
    const moved = now && now !== document.body && !root.current?.contains(now);
    const range = caret.current;
    caret.current = null;
    if (el && el.isConnected && !moved) {
      el.focus();
      if (range && range.startContainer.isConnected) {
        const sel = window.getSelection();
        sel?.removeAllRanges();
        sel?.addRange(range);
      }
    }
  }

  // A press outside the panel closes it (the press itself still lands where it was aimed).
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (e.target instanceof Node && !root.current?.contains(e.target)) finish();
    };
    window.addEventListener("pointerdown", onDown, true);
    return () => window.removeEventListener("pointerdown", onDown, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Focus first, then close, then run: a command that moves focus itself wins.
  function finish(command?: PaletteCommand) {
    restoreFocus();
    onClose();
    command?.run();
  }

  function onKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); finish(); }
    else if (e.key === "Tab") e.preventDefault(); // the field is the only stop; options are reached by arrows
    else if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      if (!flat.length) return;
      setActive((activeIndex + (e.key === "ArrowDown" ? 1 : -1) + flat.length) % flat.length);
    } else if (e.key === "Enter" && !e.nativeEvent.isComposing) {
      e.preventDefault();
      if (activeIndex >= 0) finish(flat[activeIndex]);
    }
  }

  if (!mounted && !open) return null;

  let index = -1;
  return (
    <div
      ref={root}
      className="command-palette"
      role="dialog"
      aria-label="Command palette"
      data-animate={animateIn ? "" : undefined}
      data-shown={shown ? "" : undefined}
      onKeyDown={onKeyDown}
    >
      <input
        ref={input}
        className="command-palette-input"
        type="text"
        role="combobox"
        aria-label="Search commands"
        aria-expanded="true"
        aria-controls={listId}
        aria-activedescendant={activeIndex >= 0 ? optionId(activeIndex) : undefined}
        aria-autocomplete="list"
        autoComplete="off"
        spellCheck={false}
        placeholder="Type a command"
        value={query}
        onChange={(e) => { setQuery(e.target.value); setActive(0); }}
      />
      <div ref={list} id={listId} className="command-palette-list" role="listbox" aria-label="Commands">
        {groups.map((g, gi) => (
          <div key={g.group} role="group" aria-labelledby={`${uid}-g-${gi}`} className="command-palette-group">
            <div id={`${uid}-g-${gi}`} className="command-palette-heading">{g.group}</div>
            {g.items.map((c) => {
              const i = ++index;
              return (
                <div
                  key={c.id}
                  id={optionId(i)}
                  role="option"
                  aria-selected={i === activeIndex}
                  className={`command-palette-option${i === activeIndex ? " is-highlighted" : ""} emph-row`}
                  onMouseMove={() => { if (i !== activeIndex) setActive(i); }}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => finish(c)}
                >
                  <span className="command-palette-label emph-label">{c.label}</span>
                  {c.hint ? <span className="command-palette-hint">{c.hint}</span> : null}
                </div>
              );
            })}
          </div>
        ))}
        {!flat.length ? <div className="command-palette-empty" role="status">No matching commands</div> : null}
      </div>
    </div>
  );
}
