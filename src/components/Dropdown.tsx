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
import { Popover } from "./Popover";
import "./dropdown.css";

export type DropdownOption<T extends string> = {
  value: T;
  label: string;
  /** Optional rendering inside the open menu, e.g. a font preview. */
  render?: ReactNode;
  style?: CSSProperties;
  disabled?: boolean;
  /** Keyboard shortcut hint, shown right-aligned and muted. */
  shortcut?: string;
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
  const button = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const typed = useRef({ text: "", at: 0 });
  const id = useId();
  const current = options.find((o) => o.value === value);
  const enabled = options
    .map((o, i) => (o.disabled ? -1 : i))
    .filter((i) => i >= 0);

  useLayoutEffect(() => {
    if (open) menu.current?.focus();
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
  const onButtonKeyDown = (event: KeyboardEvent) => {
    // While the menu is open the trigger still owns the keyboard contract: the
    // same keys that work inside the listbox must work here, so an established
    // open-then-arrow-down-then-Enter sequence keeps working.
    if (open) {
      if (handleMenuKey(event)) {
        event.preventDefault();
        event.stopPropagation();
      }
      return;
    }
    if (["ArrowDown", "ArrowUp", "Enter", " "].includes(event.key)) {
      event.preventDefault();
      openMenu();
    }
  };
  const handleMenuKey = (event: KeyboardEvent): boolean => {
    if (event.key === "ArrowDown") step(1);
    else if (event.key === "ArrowUp") step(-1);
    else if (event.key === "Home") setHighlight(enabled[0] ?? 0);
    else if (event.key === "End") setHighlight(enabled.at(-1) ?? 0);
    else if (event.key === "Enter" || event.key === " ") choose(highlight);
    else if (event.key === "Escape") {
      setOpen(false);
      button.current?.focus();
    } else if (event.key === "Tab") {
      setOpen(false);
      return false;
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
    } else return false;
    return true;
  };
  const onMenuKeyDown = (event: KeyboardEvent) => {
    if (!handleMenuKey(event)) return;
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
        disabled={disabled}
        onClick={() => (open ? setOpen(false) : openMenu())}
        onKeyDown={onButtonKeyDown}
      >
        <span className="dropdown-value" style={current?.style}>
          {current?.label ?? placeholder ?? ""}
        </span>
        <ChevronDown size={14} aria-hidden="true" />
      </button>
      <Popover
        open={open}
        anchor={button}
        onDismiss={() => setOpen(false)}
        role="listbox"
        id={id}
        label={label}
        tabIndex={-1}
        activeDescendant={`${id}-${highlight}`}
        highlight={highlight}
        onKeyDown={onMenuKeyDown}
        ref={menu}
        className="dropdown-menu"
      >
        {options.map((option, index) => (
          <div
            key={option.value + index}
            id={`${id}-${index}`}
            data-index={index}
            data-popover-item=""
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
              {option.value === value && <Check size={16} />}
            </span>
            {option.render ?? option.label}
            {option.shortcut && (
              <span className="popover-shortcut" aria-hidden="true">
                {option.shortcut}
              </span>
            )}
          </div>
        ))}
      </Popover>
    </div>
  );
}
