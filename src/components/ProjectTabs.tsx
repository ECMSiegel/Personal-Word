import { useEffect, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import { X } from "lucide-react";
import { keyboardMove } from "./dragReorder";
import { useDragReorder } from "./useDragReorder";
import "./drag-reorder.css";
export type ProjectTab = { id: string; title: string };
export function ProjectTabs({
  tabs,
  activeId,
  onSelect,
  onClose,
  onLibrary,
  onReorder,
}: {
  tabs: ProjectTab[];
  activeId: string;
  onSelect: (id: string) => void;
  onClose: (id: string) => void;
  onLibrary: () => void;
  onReorder: (from: number, to: number) => void;
}) {
  const { rowProps } = useDragReorder({ items: tabs, onReorder, axis: "x" });
  const [announcement, setAnnouncement] = useState("");
  const navRef = useRef<HTMLElement | null>(null);
  const refocus = useRef<string | null>(null);
  // Moving a tab re-inserts its DOM node, which drops focus: put it back on the same tab's title.
  useEffect(() => {
    const id = refocus.current;
    if (!id) return;
    refocus.current = null;
    navRef.current?.querySelector<HTMLElement>(`[data-tab-id="${CSS.escape(id)}"] > button:first-child`)?.focus();
  }, [tabs]);
  return (
    <nav ref={navRef} className="project-tabs bar bar-compact" aria-label="Open projects" data-drag-axis="x">
      <button onClick={onLibrary} className="tabs-library">
        Projects
      </button>
      {tabs.map((tab, i) => {
        const row = rowProps(i);
        return (
          <div
            key={tab.id}
            className={"project-tab " + (tab.id === activeId ? "active" : "")}
            data-tab-id={tab.id}
            {...row}
            onPointerDown={(e: ReactPointerEvent<HTMLElement>) => {
              // A press on the close button is only a click, never a drag.
              if ((e.target as HTMLElement).closest('button[aria-label^="Close "]')) return;
              row.onPointerDown(e);
            }}
          >
            <button
              aria-current={tab.id === activeId ? "page" : undefined}
              onClick={() => onSelect(tab.id)}
              onKeyDown={(e) => {
                const dir = keyboardMove(e, "x");
                const to = i + dir;
                if (!dir || to < 0 || to >= tabs.length) return;
                e.preventDefault();
                refocus.current = tab.id;
                onReorder(i, to);
                setAnnouncement(`${tab.title} moved to position ${to + 1} of ${tabs.length}`);
              }}
            >
              {tab.title}
            </button>
            <button
              aria-label={"Close " + tab.title}
              onClick={() => onClose(tab.id)}
            >
              <X size={16} />
            </button>
          </div>
        );
      })}
      <div className="visually-hidden" role="status" aria-live="polite">
        {announcement}
      </div>
    </nav>
  );
}
