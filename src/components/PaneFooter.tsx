import type { ReactNode } from "react";

/** The strip under a writing pane: page status left, word count right. */
export function PaneFooter({
  status,
  words,
  characters,
  goals,
  side = "single",
}: {
  status?: { current: number; total: number };
  words: number;
  characters: number;
  goals?: ReactNode;
  side?: "left" | "right" | "single";
}) {
  return (
    <footer className="pane-footer" data-side={side}>
      {status && (
        <span aria-label="Page count" aria-live="polite">
          Section page {status.current} of {status.total}
        </span>
      )}
      {goals}
      <span className="pane-footer-words" title={`${characters} characters`}>
        {words.toLocaleString()} words
      </span>
    </footer>
  );
}
