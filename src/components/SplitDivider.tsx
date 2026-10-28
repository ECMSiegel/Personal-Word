import { useRef } from "react";

/** The draggable line between the two split panes; ratio is the left pane's share. */
export function SplitDivider({
  ratio,
  onRatio,
}: {
  ratio: number;
  onRatio: (ratio: number) => void;
}) {
  const dragging = useRef(false);
  return (
    <div
      className="split-divider"
      role="separator"
      aria-label="Resize split view"
      aria-orientation="vertical"
      aria-valuemin={25}
      aria-valuemax={75}
      aria-valuenow={Math.round(ratio * 100)}
      tabIndex={0}
      onPointerDown={(event) => {
        event.preventDefault();
        event.currentTarget.setPointerCapture(event.pointerId);
        dragging.current = true;
      }}
      onPointerMove={(event) => {
        const panes = event.currentTarget.parentElement;
        if (!dragging.current || !panes) return;
        const box = panes.getBoundingClientRect();
        if (box.width > 0) onRatio((event.clientX - box.left) / box.width);
      }}
      onPointerUp={() => {
        dragging.current = false;
      }}
      onPointerCancel={() => {
        dragging.current = false;
      }}
      onKeyDown={(event) => {
        if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
        event.preventDefault();
        onRatio(ratio + (event.key === "ArrowLeft" ? -0.02 : 0.02));
      }}
    />
  );
}
