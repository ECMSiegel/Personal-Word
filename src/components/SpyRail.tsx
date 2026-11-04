// The sidebar line rail (UI wave 6, T7b; owner chose Variant B): one short line per item of a
// group, stacked evenly in the sidebar's right gutter. The open item's line is longer and accent;
// a click, Enter or Space jumps to the item.
import type { CSSProperties, MouseEvent } from "react";

export type RailItem = {
  id: string;
  title: string;
  state: "idle" | "open" | "active";
  /** 0..1 scroll progress, drawn on the active line only. */
  progress?: number;
  onActivate: (event: MouseEvent) => void;
};

export function SpyRail({ items, label }: { items: RailItem[]; label: string }) {
  return (
    <div
      className="spy-rail"
      role="group"
      aria-label={label + " lines"}
      style={{ "--spy-n": items.length, "--spy-gaps": Math.max(items.length - 1, 1) } as CSSProperties}
    >
      {items.map((item) => {
        const filled = item.state === "active" && item.progress !== undefined;
        return (
          <button
            key={item.id}
            type="button"
            className="spy-line"
            aria-label={"Go to " + item.title}
            data-row-id={item.id}
            data-state={item.state}
            data-progress={filled ? "" : undefined}
            style={filled ? ({ "--spy-progress": item.progress!.toFixed(3) } as CSSProperties) : undefined}
            onClick={item.onActivate}
          />
        );
      })}
    </div>
  );
}
