import { describe, expect, it } from "vitest";
import { drawnSpan, scrollDelta } from "./caretScroll";

// Scroller top 114 drawn px, ruler 24 layout px drawn at zoom z, caret line 20 layout px.
const SCROLLER = { start: 114, end: 900 };
const LINE = 20;

// The two rect models: Chromium reports drawn px; native WebKit reports zoomed space (drawn / z).
const models = [
  { name: "Chromium (drawn rects)", unzoomed: false, raw: (drawn: number, _z: number) => drawn },
  { name: "WebKit (zoomed-space rects)", unzoomed: true, raw: (drawn: number, z: number) => drawn / z },
];

describe("caret scroll geometry", () => {
  for (const m of models) {
    for (const z of [0.5, 0.75, 0.843, 1, 1.5]) {
      for (const ruler of [true, false]) {
        it(`${m.name}, zoom ${z}, ruler ${ruler ? "on" : "off"}: caret ends in view, clear of the ruler`, () => {
          const rulerDrawn = ruler ? 24 * z : 0;
          const top = ruler ? rulerDrawn + 5 : 0;
          const margin = { start: ruler ? rulerDrawn + 5 : 5, end: 5 };
          const threshold = { start: top, end: 0 };
          // Start a caret from above, inside, behind the ruler and below the window.
          for (let drawnTop = 0; drawnTop < 1000; drawnTop += 7) {
            const drawn = { start: drawnTop, end: drawnTop + LINE * z };
            const raw = { start: m.raw(drawn.start, z), end: m.raw(drawn.end, z) };
            const move = scrollDelta(drawnSpan(raw, z, m.unzoomed), SCROLLER, threshold, margin);
            const after = { start: drawn.start - move, end: drawn.end - move };
            expect(after.start).toBeGreaterThanOrEqual(SCROLLER.start + rulerDrawn - 0.001);
            expect(after.end).toBeLessThanOrEqual(SCROLLER.end + 0.001);
            if (drawn.start >= SCROLLER.start + top && drawn.end <= SCROLLER.end) expect(move).toBe(0);
          }
        });
      }
    }
  }
});
