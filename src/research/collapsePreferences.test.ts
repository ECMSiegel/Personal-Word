import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { Preview } from "./Cite";
import {
  readCollapsed,
  RESEARCH_COLLAPSE_KEY,
  writeCollapsed,
  type ResearchCollapseState,
} from "./collapsePreferences";

const defaults: ResearchCollapseState = {
  note: false,
  short: false,
  bibliography: false,
  usedIn: false,
};

function store(raw: string | null) {
  return { getItem: vi.fn(() => raw) };
}

describe("research collapse preferences", () => {
  it("defaults to expanded when no preference is stored", () => {
    expect(readCollapsed(store(null))).toEqual(defaults);
  });

  it("reads all four app-wide collapse preferences", () => {
    expect(readCollapsed(store('{"note":true,"short":false,"bibliography":true,"usedIn":true}'))).toEqual({
      note: true,
      short: false,
      bibliography: true,
      usedIn: true,
    });
  });

  it("defaults invalid or missing fields to expanded", () => {
    expect(readCollapsed(store("{nope"))).toEqual(defaults);
    expect(readCollapsed(store("null"))).toEqual(defaults);
    expect(readCollapsed(store('{"note":1,"usedIn":"yes"}'))).toEqual(defaults);
  });

  it("tolerates unavailable storage", () => {
    expect(readCollapsed({ getItem: () => { throw new Error("blocked"); } })).toEqual(defaults);
    expect(() => writeCollapsed({ setItem: () => { throw new Error("blocked"); } }, defaults)).not.toThrow();
  });

  it("writes the complete value under the app-wide key", () => {
    const setItem = vi.fn();
    const value = { ...defaults, short: true };
    writeCollapsed({ setItem }, value);
    expect(setItem).toHaveBeenCalledWith(RESEARCH_COLLAPSE_KEY, JSON.stringify(value));
  });

  it("keeps citation-card previews unchanged when collapse props are omitted", () => {
    const html = renderToStaticMarkup(createElement(Preview, { label: "Note", parts: [] }));
    expect(html).toBe('<div class="preview"><span class="field-label">Note</span><p class="citation-preview"></p></div>');
  });
});
