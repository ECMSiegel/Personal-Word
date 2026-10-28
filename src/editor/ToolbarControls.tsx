import { useEffect, useRef, useState, type ReactNode, type Ref } from "react";
import type { LucideIcon } from "lucide-react";
import { Popover } from "../components/Popover";
import { visibleLabel } from "./shortcuts";

/** Number field that lets the user type partial values without the editor overwriting them. */
export function NumberInput({
  label,
  value,
  min,
  max,
  step,
  width,
  className,
  onCommit,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  width?: number;
  className?: string;
  onCommit: (n: number) => void;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  return (
    <input
      aria-label={label}
      type="number"
      inputMode="decimal"
      min={min}
      max={max}
      step={step}
      className={"toolbar-number" + (className ? " " + className : "")}
      style={width !== undefined ? { width } : undefined}
      value={draft ?? String(value)}
      onChange={(event) => {
        const text = event.target.value;
        setDraft(text);
        const n = Number(text);
        if (text.trim() !== "" && n >= min && n <= max) onCommit(n);
      }}
      onBlur={() => setDraft(null)}
      onKeyDown={(event) => {
        if (event.key === "Enter") event.currentTarget.blur();
      }}
    />
  );
}

/** Icon button that opens a small square popover. Escape and outside pointer closes it. */
export function PanelButton({
  label,
  icon: Icon,
  open,
  onToggle,
  onEscape,
  dialogLabel,
  align = "start",
  isMore,
  inMore,
  buttonRef,
  children,
}: {
  label: string;
  icon: LucideIcon;
  open: boolean;
  onToggle: () => void;
  onEscape: () => void;
  dialogLabel: string;
  align?: "start" | "end";
  isMore?: boolean;
  /** Rendered inside the More menu: the button is a highlighted menu row. */
  inMore?: boolean;
  buttonRef?: Ref<HTMLButtonElement>;
  children: ReactNode;
}) {
  const popover = useRef<HTMLDivElement>(null);
  const anchor = useRef<HTMLButtonElement | null>(null);
  useEffect(() => {
    if (open) popover.current?.focus();
  }, [open]);
  return (
    <span className="toolbar-anchor" data-toolbar-panel="">
      <button
        ref={(el) => {
          anchor.current = el;
          if (typeof buttonRef === "function") buttonRef(el);
          else if (buttonRef)
            (buttonRef as { current: HTMLButtonElement | null }).current = el;
        }}
        type="button"
        className="toolbar-icon"
        aria-label={label}
        title={label}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={onToggle}
        {...(inMore ? { "data-popover-item": "" } : {})}
      >
        <Icon size={16} aria-hidden="true" />
        <span className="toolbar-label" aria-hidden="true">
          {visibleLabel(label)}
        </span>
      </button>
      <Popover
        open={open}
        anchor={anchor}
        role="dialog"
        label={dialogLabel}
        tabIndex={-1}
        align={align}
        className={"toolbar-popover" + (isMore ? " is-more" : "")}
        highlight={isMore ? "follow" : null}
        ref={popover}
        onKeyDown={(event) => {
          if (event.key !== "Escape") return;
          event.preventDefault();
          event.stopPropagation();
          onEscape();
        }}
      >
        {children}
      </Popover>
    </span>
  );
}
