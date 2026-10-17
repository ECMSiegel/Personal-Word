import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
  type Ref,
} from "react";
import type { LucideIcon } from "lucide-react";

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
  buttonRef?: Ref<HTMLButtonElement>;
  children: ReactNode;
}) {
  const popover = useRef<HTMLDivElement>(null);
  const [flip, setFlip] = useState(false);
  useLayoutEffect(() => {
    if (!open) return setFlip(false);
    const rect = popover.current?.getBoundingClientRect();
    if (rect && rect.right > window.innerWidth - 8) setFlip(true);
  }, [open]);
  useEffect(() => {
    if (open) popover.current?.focus();
  }, [open]);
  return (
    <span className="toolbar-anchor" data-toolbar-panel="">
      <button
        ref={buttonRef}
        type="button"
        className="toolbar-icon"
        aria-label={label}
        title={label}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={onToggle}
      >
        <Icon size={16} aria-hidden="true" />
      </button>
      {open && (
        <div
          ref={popover}
          role="dialog"
          aria-label={dialogLabel}
          tabIndex={-1}
          className={
            "toolbar-popover" +
            (align === "end" || flip ? " align-end" : "") +
            (isMore ? " is-more" : "")
          }
          onKeyDown={(event) => {
            if (event.key !== "Escape") return;
            event.preventDefault();
            event.stopPropagation();
            onEscape();
          }}
        >
          {children}
        </div>
      )}
    </span>
  );
}
