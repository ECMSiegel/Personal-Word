import type { KeyboardEvent } from "react";
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
  const hasChoice = options.some((option) => option.value === value);

  // Roving tabindex: Tab reaches the chosen segment, the arrow keys step through
  // the options, Home and End jump to the ends, and each move selects. The
  // chosen segment itself is shown by weight and colour, never by a fill.
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const buttons = Array.from(
      event.currentTarget.querySelectorAll<HTMLButtonElement>("button"),
    );
    const at = buttons.indexOf(document.activeElement as HTMLButtonElement);
    if (at < 0) return;
    const step =
      event.key === "ArrowRight" || event.key === "ArrowDown"
        ? 1
        : event.key === "ArrowLeft" || event.key === "ArrowUp"
          ? -1
          : 0;
    const next =
      event.key === "Home"
        ? 0
        : event.key === "End"
          ? buttons.length - 1
          : step
            ? (at + step + buttons.length) % buttons.length
            : -1;
    if (next < 0) return;
    event.preventDefault();
    buttons[next].focus();
    onChange(options[next].value);
  };

  return (
    <div
      className="segmented"
      role="group"
      aria-label={label}
      onKeyDown={onKeyDown}
    >
      {options.map((option, index) => (
        <button
          key={option.value}
          type="button"
          aria-pressed={option.value === value}
          tabIndex={option.value === value || (!hasChoice && index === 0) ? 0 : -1}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
