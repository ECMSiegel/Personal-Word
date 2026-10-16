import { useEffect, useState } from "react";

/** Track the app's nested document scroller, including edits and window resizing. */
export function ReadingProgress({ identity }: { identity: string }) {
  const [progress, setProgress] = useState(0);
  useEffect(() => {
    const scroller = document.querySelector<HTMLElement>(
      ".editor-scroll, .manuscript-read",
    );
    if (!scroller) {
      setProgress(0);
      return;
    }
    const update = () => {
      const range = scroller.scrollHeight - scroller.clientHeight;
      setProgress(
        range > 0 ? Math.min(1, Math.max(0, scroller.scrollTop / range)) : 0,
      );
    };
    scroller.scrollTop = 0;
    const resize = new ResizeObserver(update);
    resize.observe(scroller);
    const observeChildren = () => {
      resize.disconnect();
      resize.observe(scroller);
      Array.from(scroller.children).forEach((child) => resize.observe(child));
      update();
    };
    const mutation = new MutationObserver(observeChildren);
    mutation.observe(scroller, {
      childList: true,
      subtree: true,
      characterData: true,
    });
    observeChildren();
    scroller.addEventListener("scroll", update, { passive: true });
    return () => {
      resize.disconnect();
      mutation.disconnect();
      scroller.removeEventListener("scroll", update);
    };
  }, [identity]);
  return (
    <div
      className="scroll-progress"
      role="progressbar"
      aria-label="Document scroll progress"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(progress * 100)}
    >
      <span style={{ transform: `scaleX(${progress})` }} />
    </div>
  );
}
