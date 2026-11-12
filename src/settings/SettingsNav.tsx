// Sticky strip of links to the sections of the Settings page.
import { useEffect, useRef, useState } from "react";
import type { JSX } from "react";
import "./settings-nav.css";

type Section = { id: string; title: string };

const SECTION_SELECTOR = ".settings-section";

function reducedMotion(): boolean {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function slug(text: string, taken: Set<string>): string {
  const base =
    "settings-" +
    (text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") ||
      "section");
  let id = base;
  for (let n = 2; taken.has(id); n += 1) id = base + "-" + n;
  taken.add(id);
  return id;
}

function readSections(container: Element): Section[] {
  const taken = new Set<string>();
  container
    .querySelectorAll<HTMLElement>(":scope > " + SECTION_SELECTOR + "[id]")
    .forEach((el) => taken.add(el.id));
  const out: Section[] = [];
  container
    .querySelectorAll<HTMLElement>(":scope > " + SECTION_SELECTOR)
    .forEach((section) => {
      const h2 = section.querySelector("h2");
      if (!h2) return;
      if (!section.id) section.id = slug(h2.textContent ?? "", taken);
      out.push({ id: section.id, title: (h2.textContent ?? "").trim() });
    });
  return out;
}

/** Puts the section's heading just under the sticky strip. */
function scrollSectionIntoView(section: HTMLElement, smooth: boolean): void {
  const container = section.closest<HTMLElement>(".project-settings");
  if (!container) return;
  const nav = container.querySelector<HTMLElement>(".settings-nav");
  const target = section.querySelector("h2") ?? section;
  // The strip's resting place once stuck (its natural spot is lower down).
  const under =
    container.getBoundingClientRect().top + (nav ? nav.offsetHeight : 0);
  const delta = target.getBoundingClientRect().top - under - 8;
  container.scrollBy({
    top: delta,
    behavior: smooth && !reducedMotion() ? "smooth" : "instant",
  });
}

function findSection(heading: string): HTMLElement | null {
  for (const h2 of document.querySelectorAll(
    ".project-settings " + SECTION_SELECTOR + " h2",
  )) {
    if ((h2.textContent ?? "").trim() === heading)
      return h2.closest<HTMLElement>(SECTION_SELECTOR);
  }
  return null;
}

/** Scrolls the Settings page to the section with this heading. Called before
 * the page has mounted, it waits up to two seconds for the section to exist. */
export function scrollToSettingsSection(heading: string): void {
  const go = (): boolean => {
    const section = findSection(heading);
    if (!section) return false;
    scrollSectionIntoView(section, false);
    return true;
  };
  if (go()) return;
  const observer = new MutationObserver(() => {
    if (go()) finish();
  });
  const timer = window.setTimeout(() => finish(), 2000);
  function finish() {
    observer.disconnect();
    window.clearTimeout(timer);
  }
  observer.observe(document.body, { childList: true, subtree: true });
}

export function SettingsNav(): JSX.Element | null {
  const nav = useRef<HTMLElement>(null);
  const [sections, setSections] = useState<Section[]>([]);
  const [current, setCurrent] = useState("");

  useEffect(() => {
    const container = nav.current?.closest(".project-settings");
    if (!container) return;
    const update = () => {
      const next = readSections(container);
      setSections((prev) =>
        prev.length === next.length &&
        prev.every((s, i) => s.id === next[i].id && s.title === next[i].title)
          ? prev
          : next,
      );
    };
    update();
    const mutations = new MutationObserver(update);
    mutations.observe(container, { childList: true });
    return () => mutations.disconnect();
  }, []);

  useEffect(() => {
    const container = nav.current?.closest<HTMLElement>(".project-settings");
    if (!container || !nav.current || sections.length === 0) return;
    // Band just under the strip, covering the upper third of the page.
    const top = nav.current.offsetHeight + nav.current.offsetTop;
    const observer = new IntersectionObserver(
      (entries) => {
        const hit = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
        if (hit) setCurrent(hit.target.id);
      },
      { root: container, rootMargin: `-${top}px 0px -66% 0px` },
    );
    sections.forEach((s) => {
      const el = document.getElementById(s.id);
      if (el) observer.observe(el);
    });
    return () => observer.disconnect();
  }, [sections]);

  if (sections.length === 0) return <nav ref={nav} className="settings-nav" hidden />;
  return (
    <nav ref={nav} className="settings-nav" aria-label="Settings sections">
      {sections.map((s) => (
        <a
          key={s.id}
          href={"#" + s.id}
          aria-current={current === s.id ? "true" : undefined}
          onClick={(event) => {
            event.preventDefault();
            const section = document.getElementById(s.id);
            if (!section) return;
            // detail is 0 for a keyboard-triggered click.
            scrollSectionIntoView(section, event.detail > 0);
            setCurrent(s.id);
          }}
        >
          {s.title}
        </a>
      ))}
    </nav>
  );
}
