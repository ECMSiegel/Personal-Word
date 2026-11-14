import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { Download } from "lucide-react";
import { Popover, PopoverItem } from "../components/Popover";
import "./export-menu.css";
import type { ExportProject } from "./document";
import {
  exportProject,
  exportFormatLabel,
  type ExportFormat,
} from "./exportActions";

const FORMATS: { format: ExportFormat; label: string }[] = [
  { format: "docx", label: "Word (.docx)" },
  { format: "pdf", label: "PDF" },
  { format: "markdown", label: "Markdown" },
  { format: "markdown-bundle", label: "Markdown with images (.zip)" },
  { format: "plain", label: "Plain text" },
];

/** The header's Export menu. `open` is controlled so the Cmd+Shift+E shortcut
 * and the command palette (App.tsx) can open it. */
export function ExportMenu({
  project,
  open,
  onOpenChange,
  onNotice,
  onError,
  onExportSettings,
  onExportComplete,
}: {
  project: ExportProject;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onNotice: (message: string) => void;
  onError: (message: string) => void;
  onExportSettings: () => void;
  onExportComplete: () => Promise<void>;
}) {
  const button = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const [busy, setBusy] = useState(false);

  const items = () =>
    [...(menu.current?.querySelectorAll<HTMLElement>("[data-popover-item]") ?? [])];

  // Opening (click, shortcut or palette) puts focus on the first item.
  useEffect(() => {
    if (!open) return;
    const frame = requestAnimationFrame(() => items()[0]?.focus());
    return () => cancelAnimationFrame(frame);
  }, [open]);

  const close = (refocus: boolean) => {
    onOpenChange(false);
    if (refocus) button.current?.focus();
  };

  const choose = async (run: () => Promise<void> | void) => {
    close(true);
    if (busy) return;
    setBusy(true);
    try {
      await run();
    } catch (e) {
      onError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const list = items();
    const at = list.indexOf(document.activeElement as HTMLElement);
    let next: number | null = null;
    if (event.key === "ArrowDown") next = (at + 1) % list.length;
    else if (event.key === "ArrowUp") next = (at <= 0 ? list.length : at) - 1;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = list.length - 1;
    else if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      close(true);
      return;
    } else if (event.key === "Tab") {
      onOpenChange(false);
      return;
    }
    if (next === null) return;
    event.preventDefault();
    list[next]?.focus();
  };

  return (
    <span style={{ position: "relative", display: "inline-flex" }}>
      <button
        ref={button}
        type="button"
        className="export-menu-button"
        aria-haspopup="menu"
        aria-expanded={open}
        title="Export (⇧⌘E)"
        onClick={() => onOpenChange(!open)}
      >
        <Download size={16} aria-hidden="true" /> Export
      </button>
      <Popover
        open={open}
        anchor={button}
        align="end"
        className="export-menu menu"
        role="menu"
        label="Export"
        tabIndex={-1}
        ref={menu}
        onDismiss={() => onOpenChange(false)}
        onKeyDown={onKeyDown}
      >
          {FORMATS.map(({ format, label }) => (
            <PopoverItem
              key={format}
              role="menuitem"
              onClick={() =>
                void choose(async () => {
                  const result = await exportProject(project, format);
                  onNotice(
                    result === "saved"
                      ? `${exportFormatLabel[format]} exported.`
                      : "Export canceled.",
                  );
                })
              }
            >
              {label}
            </PopoverItem>
          ))}
          <div
            role="separator"
            className="menu-rule"
          />
          <PopoverItem
            role="menuitem"
            onClick={() => void choose(onExportSettings)}
          >
            Export settings...
          </PopoverItem>
          <PopoverItem
            role="menuitem"
            onClick={() => void choose(onExportComplete)}
          >
            Complete project (.json)
          </PopoverItem>
      </Popover>
    </span>
  );
}
