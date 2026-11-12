import type {
  KeyboardEvent as ReactKeyboardEvent,
  PointerEvent as ReactPointerEvent,
} from "react";
import type { paperGeometry } from "./formatting";

/** Half the marker's height (side-ruler.css .side-ruler-marker), so its point sits on the margin. */
const MARKER_HALF = 6;

type Edge = "top" | "bottom";

type Props = {
  pageIndex: number;
  geometry: ReturnType<typeof paperGeometry>;
  margin: number;
  onDragStart(event: ReactPointerEvent<HTMLDivElement>, edge: Edge): void;
  onDragMove(event: ReactPointerEvent<HTMLDivElement>): void;
  onDragEnd(event: ReactPointerEvent<HTMLDivElement>): void;
  onDragCancel(): void;
  onKeyDown(event: ReactKeyboardEvent<HTMLDivElement>, edge: Edge): void;
};

/** A 16 px ruler left of one page: inches down the page, the top and bottom margins shaded. */
export function SideRuler({
  pageIndex,
  geometry,
  margin,
  onDragStart,
  onDragMove,
  onDragEnd,
  onDragCancel,
  onKeyDown,
}: Props) {
  const count = Math.floor((geometry.height - 1) / 12) + 1;
  const value = Math.round(margin);
  const marker = (edge: Edge) => (
    <div
      className={`side-ruler-marker side-ruler-marker--${edge}`}
      role="slider"
      aria-orientation="vertical"
      aria-label={`Adjust top and bottom margins from the ${edge}`}
      aria-valuemin={24}
      aria-valuemax={192}
      aria-valuenow={value}
      aria-valuetext={`${(margin / 96).toFixed(2)} inches`}
      tabIndex={0}
      style={
        edge === "top"
          ? { top: margin - MARKER_HALF }
          : { bottom: margin - MARKER_HALF }
      }
      onPointerDown={(event) => onDragStart(event, edge)}
      onPointerMove={onDragMove}
      onPointerUp={onDragEnd}
      onPointerCancel={onDragCancel}
      onKeyDown={(event) => onKeyDown(event, edge)}
    />
  );
  return (
    <div
      className="side-ruler"
      role="group"
      aria-label={`Page ${pageIndex + 1} margin ruler`}
      style={{ top: pageIndex * (geometry.height + geometry.gap) }}
    >
      <div className="side-ruler-band side-ruler-band--top" style={{ height: margin }} aria-hidden="true" />
      <div className="side-ruler-band side-ruler-band--bottom" style={{ height: margin }} aria-hidden="true" />
      <div className="side-ruler-ticks" aria-hidden="true">
        {Array.from({ length: count }, (_, i) => (
          <span
            key={i}
            className={`side-ruler-tick${i % 8 === 0 ? " is-inch" : ""}`}
            style={{ top: i * 12 }}
          >
            {i % 8 === 0 && i > 0 ? i / 8 : null}
          </span>
        ))}
      </div>
      {marker("top")}
      {marker("bottom")}
    </div>
  );
}
