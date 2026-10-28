import { useLayoutEffect, useRef, type KeyboardEvent } from "react";
import { slideHighlight } from "../motion";
import "./segmented.css";

export function Segmented<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
}) {
  const group = useRef<HTMLDivElement>(null);
  const highlight = useRef<HTMLSpanElement>(null);
  useLayoutEffect(() => {
    const container = group.current;
    const indicator = highlight.current;
    if (!container || !indicator) return;
    slideHighlight(
      indicator,
      container.querySelector<HTMLButtonElement>(
        'button[aria-pressed="true"]',
      ),
      container,
    );
  }, [value]);

  // Arrow keys move the choice (and focus) to the neighbouring button.
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const step =
      event.key === "ArrowRight" || event.key === "ArrowDown"
        ? 1
        : event.key === "ArrowLeft" || event.key === "ArrowUp"
          ? -1
          : 0;
    if (!step) return;
    const buttons = Array.from(
      event.currentTarget.querySelectorAll<HTMLButtonElement>("button"),
    );
    const at = buttons.indexOf(document.activeElement as HTMLButtonElement);
    if (at < 0) return;
    event.preventDefault();
    const next = (at + step + buttons.length) % buttons.length;
    buttons[next].focus();
    onChange(options[next].value);
  };
  return (
    <div
      className="segmented"
      ref={group}
      role="group"
      aria-label={label}
      onKeyDown={onKeyDown}
    >
      <span ref={highlight} className="segmented-highlight" aria-hidden="true" />
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          aria-pressed={option.value === value}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
