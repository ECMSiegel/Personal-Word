import {
  useEffect,
  useLayoutEffect,
  useId,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import { Check, ChevronDown } from "lucide-react";
import "./dropdown.css";

export type DropdownOption<T extends string> = {
  value: T;
  label: string;
  /** Optional rendering inside the open menu, e.g. a font preview. */
  render?: ReactNode;
  style?: CSSProperties;
  disabled?: boolean;
};

/**
 * Flat, square replacement for the native select. WebKit draws native selects
 * as rounded capsules regardless of CSS, so every app dropdown uses this.
 */
export function Dropdown<T extends string>({
  value,
  options,
  onChange,
  label,
  placeholder,
  className,
  width,
  disabled,
  title,
}: {
  value: T;
  options: DropdownOption<T>[];
  onChange: (value: T) => void;
  /** Accessible name. */
  label: string;
  placeholder?: string;
  className?: string;
  width?: number | string;
  disabled?: boolean;
  title?: string;
}) {
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const [flip, setFlip] = useState(false);
  const button = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const typed = useRef({ text: "", at: 0 });
  const id = useId();
  const current = options.find((o) => o.value === value);
  const enabled = options
    .map((o, i) => (o.disabled ? -1 : i))
    .filter((i) => i >= 0);

  useEffect(() => {
    if (!open) return;
    const close = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!menu.current?.contains(target) && !button.current?.contains(target))
        setOpen(false);
    };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, [open]);

  useLayoutEffect(() => {
    if (!open) return setFlip(false);
    const rect = menu.current?.getBoundingClientRect();
    if (rect && rect.right > window.innerWidth - 8) setFlip(true);
  }, [open]);
  useEffect(() => {
    if (!open) return;
    menu.current
      ?.querySelector<HTMLElement>(`[data-index="${highlight}"]`)
      ?.scrollIntoView({ block: "nearest" });
  }, [open, highlight]);

  const openMenu = () => {
    if (disabled) return;
    const index = options.findIndex((o) => o.value === value);
    setHighlight(index >= 0 ? index : (enabled[0] ?? 0));
    setOpen(true);
  };
  const choose = (index: number) => {
    const option = options[index];
    if (!option || option.disabled) return;
    setOpen(false);
    button.current?.focus();
    if (option.value !== value) onChange(option.value);
  };
  const step = (delta: number) => {
    if (!enabled.length) return;
    const position = enabled.indexOf(highlight);
    const next =
      position < 0
        ? enabled[0]
        : enabled[Math.max(0, Math.min(enabled.length - 1, position + delta))];
    setHighlight(next);
  };
  const onKeyDown = (event: KeyboardEvent) => {
    if (!open) {
      if (["ArrowDown", "ArrowUp", "Enter", " "].includes(event.key)) {
        event.preventDefault();
        openMenu();
      }
      return;
    }
    if (event.key === "ArrowDown") step(1);
    else if (event.key === "ArrowUp") step(-1);
    else if (event.key === "Home") setHighlight(enabled[0] ?? 0);
    else if (event.key === "End") setHighlight(enabled.at(-1) ?? 0);
    else if (event.key === "Enter" || event.key === " ") choose(highlight);
    else if (event.key === "Escape") {
      setOpen(false);
    } else if (event.key === "Tab") {
      setOpen(false);
      return;
    } else if (event.key.length === 1) {
      const now = Date.now();
      typed.current = {
        text:
          (now - typed.current.at < 700 ? typed.current.text : "") +
          event.key.toLowerCase(),
        at: now,
      };
      const match = options.findIndex(
        (o) =>
          !o.disabled && o.label.toLowerCase().startsWith(typed.current.text),
      );
      if (match >= 0) setHighlight(match);
    } else return;
    event.preventDefault();
    event.stopPropagation();
  };

  return (
    <div
      className={"dropdown" + (className ? " " + className : "")}
      style={width !== undefined ? { width } : undefined}
    >
      <button
        ref={button}
        type="button"
        className="dropdown-button"
        aria-label={label}
        title={title ?? label}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        aria-activedescendant={open ? `${id}-${highlight}` : undefined}
        disabled={disabled}
        onClick={() => (open ? setOpen(false) : openMenu())}
        onKeyDown={onKeyDown}
      >
        <span className="dropdown-value" style={current?.style}>
          {current?.label ?? placeholder ?? ""}
        </span>
        <ChevronDown size={13} aria-hidden="true" />
      </button>
      {open && (
        <div
          ref={menu}
          id={id}
          className={"dropdown-menu" + (flip ? " is-flipped" : "")}
          role="listbox"
          aria-label={label}
        >
          {options.map((option, index) => (
            <div
              key={option.value + index}
              id={`${id}-${index}`}
              data-index={index}
              role="option"
              aria-selected={option.value === value}
              aria-disabled={option.disabled || undefined}
              className={
                "dropdown-option" +
                (index === highlight ? " is-highlighted" : "") +
                (option.value === value ? " is-current" : "")
              }
              style={option.style}
              onPointerEnter={() => !option.disabled && setHighlight(index)}
              onPointerDown={(event) => event.preventDefault()}
              onClick={() => choose(index)}
            >
              <span className="dropdown-check" aria-hidden="true">
                {option.value === value && <Check size={13} />}
              </span>
              {option.render ?? option.label}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
