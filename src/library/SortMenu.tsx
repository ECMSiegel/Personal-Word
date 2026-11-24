import { useId, useLayoutEffect, useRef, useState, type KeyboardEvent } from "react";
import { Check, ChevronDown } from "lucide-react";
import { Popover } from "../components/Popover";
import type { LibraryPreferences, LibrarySort } from "../libraryPreferences";
import "../components/dropdown.css";

const SORT_ROWS: { value: LibrarySort; label: string }[] = [
  { value: "name", label: "Name" },
  { value: "edited", label: "Edited" },
  { value: "added", label: "Added" },
  { value: "words", label: "Words" },
  { value: "sections", label: "Sections" },
  { value: "custom", label: "Custom" },
];

/** The two Direction rows for a sort: [reverse=false label, reverse=true label]. */
export function directionLabels(sort: LibrarySort): [string, string] {
  if (sort === "name") return ["A to Z", "Z to A"];
  if (sort === "words" || sort === "sections") return ["Most first", "Fewest first"];
  return ["Newest first", "Oldest first"];
}

type Row = {
  group: string;
  label: string;
  checked: boolean;
  disabled: boolean;
  change: Partial<LibraryPreferences>;
};

export function SortMenu({
  sort,
  reverse,
  foldersFirst,
  onChange,
}: {
  sort: LibrarySort;
  reverse: boolean;
  foldersFirst: boolean;
  onChange: (change: Partial<LibraryPreferences>) => void;
}) {
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const button = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const id = useId();

  const [forward, backward] = directionLabels(sort);
  const custom = sort === "custom";
  const rows: Row[] = [
    ...SORT_ROWS.map((r) => ({
      group: "Sort by",
      label: r.label,
      checked: r.value === sort,
      disabled: false,
      change: { sort: r.value } as Partial<LibraryPreferences>,
    })),
    { group: "Direction", label: forward, checked: !custom && !reverse, disabled: custom, change: { reverse: false } },
    { group: "Direction", label: backward, checked: !custom && reverse, disabled: custom, change: { reverse: true } },
    { group: "Folders", label: "On top", checked: foldersFirst, disabled: false, change: { foldersFirst: true } },
    { group: "Folders", label: "Mixed with projects", checked: !foldersFirst, disabled: false, change: { foldersFirst: false } },
  ];
  const enabled = rows.map((r, i) => (r.disabled ? -1 : i)).filter((i) => i >= 0);
  const firstRow = enabled[0];
  const lastRow = enabled[enabled.length - 1];
  const groups = ["Sort by", "Direction", "Folders"];

  useLayoutEffect(() => {
    if (open) menu.current?.focus();
  }, [open]);

  // Keep the keyboard highlight in view when a short window cuts the menu.
  useLayoutEffect(() => {
    if (!open) return;
    document.getElementById(`${id}-${highlight}`)?.scrollIntoView({ block: "nearest" });
    // The first and last rows also bring the heading above or the end below into view.
    const menuEl = menu.current;
    if (menuEl && highlight === firstRow) menuEl.scrollTop = 0;
    else if (menuEl && highlight === lastRow) menuEl.scrollTop = menuEl.scrollHeight;
  }, [open, highlight, id, firstRow, lastRow]);

  const openMenu = () => {
    const current = rows.findIndex((r, i) => i < SORT_ROWS.length && r.checked);
    setHighlight(current >= 0 ? current : 0);
    setOpen(true);
  };
  const close = () => {
    setOpen(false);
    button.current?.focus();
  };
  const choose = (index: number) => {
    const row = rows[index];
    if (!row || row.disabled) return;
    if (!row.checked) onChange(row.change);
  };
  const step = (delta: number) => {
    const at = enabled.indexOf(highlight);
    const next = at < 0 ? 0 : Math.max(0, Math.min(enabled.length - 1, at + delta));
    setHighlight(enabled[next]);
  };
  const onMenuKeyDown = (event: KeyboardEvent) => {
    if (event.key === "ArrowDown") step(1);
    else if (event.key === "ArrowUp") step(-1);
    else if (event.key === "Home") setHighlight(enabled[0]);
    else if (event.key === "End") setHighlight(enabled[enabled.length - 1]);
    else if (event.key === "Enter" || event.key === " ") choose(highlight);
    else if (event.key === "Escape") close();
    else if (event.key === "Tab") {
      setOpen(false);
      return;
    } else return;
    event.preventDefault();
    event.stopPropagation();
  };
  const onButtonKeyDown = (event: KeyboardEvent) => {
    if (open) return onMenuKeyDown(event);
    if (["ArrowDown", "ArrowUp", "Enter", " "].includes(event.key)) {
      event.preventDefault();
      openMenu();
    }
  };

  return (
    <div className="dropdown">
      <button
        ref={button}
        type="button"
        className="dropdown-button"
        aria-label="Sort projects"
        title="Sort projects"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        onClick={() => (open ? setOpen(false) : openMenu())}
        onKeyDown={onButtonKeyDown}
      >
        <span className="dropdown-value">{SORT_ROWS.find((r) => r.value === sort)?.label}</span>
        <ChevronDown size={14} aria-hidden="true" />
      </button>
      <Popover
        open={open}
        anchor={button}
        onDismiss={() => setOpen(false)}
        role="menu"
        id={id}
        label="Sort projects"
        tabIndex={-1}
        activeDescendant={`${id}-${highlight}`}
        highlight={highlight}
        onKeyDown={onMenuKeyDown}
        ref={menu}
        className="dropdown-menu menu"
      >
        {groups.map((group, g) => (
          <div key={group} role="group" aria-label={group}>
            {g > 0 && <div role="separator" className="dropdown-separator menu-rule" />}
            <div role="presentation" className="dropdown-heading">
              {group}
            </div>
            {rows.map((row, index) =>
              row.group !== group ? null : (
                <div
                  key={index}
                  id={`${id}-${index}`}
                  data-popover-item=""
                  role="menuitemradio"
                  aria-checked={row.checked}
                  aria-disabled={row.disabled || undefined}
                  className={
                    "dropdown-option row" +
                    (index === highlight ? " is-highlighted" : "") +
                    (row.checked ? " is-current" : "")
                  }
                  onPointerEnter={() => !row.disabled && setHighlight(index)}
                  onPointerDown={(event) => event.preventDefault()}
                  onClick={(event) => {
                    event.preventDefault();
                    choose(index);
                  }}
                >
                  <span className="dropdown-check" aria-hidden="true">
                    {row.checked && <Check size={16} />}
                  </span>
                  <span className="row-label">{row.label}</span>
                </div>
              ),
            )}
          </div>
        ))}
      </Popover>
    </div>
  );
}
