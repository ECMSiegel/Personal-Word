import { describe, expect, it } from "vitest";
import { columnMenuItems, toggleColumn } from "./columnMenu";
import type { LibraryColumn } from "../libraryPreferences";

const labels = (items: ReturnType<typeof columnMenuItems>) =>
  items.map((i) => i.label);
const ticks = (items: ReturnType<typeof columnMenuItems>) =>
  items.map((i) => (i.kind === undefined ? i.checked : undefined));

describe("columnMenuItems", () => {
  it("has four rows in library order, ticked only for shown columns", () => {
    const items = columnMenuItems(["words", "edited"], () => {});
    expect(labels(items)).toEqual(["Edited", "Words", "Sections", "Added"]);
    expect(ticks(items)).toEqual([true, true, false, false]);
  });

  it("an empty list ticks nothing", () => {
    const items = columnMenuItems([], () => {});
    expect(labels(items)).toEqual(["Edited", "Words", "Sections", "Added"]);
    expect(ticks(items)).toEqual([false, false, false, false]);
  });

  it("running a row toggles that column", () => {
    const seen: LibraryColumn[] = [];
    const items = columnMenuItems(["edited"], (c) => seen.push(c));
    for (const item of items) if (item.kind === undefined) item.run();
    expect(seen).toEqual(["edited", "words", "sections", "added"]);
  });

  it("toggling twice adds then removes, and order always follows LIBRARY_COLUMNS", () => {
    let columns: LibraryColumn[] = ["words"];
    const toggle = (c: LibraryColumn) => {
      columns = toggleColumn(columns, c);
    };
    const run = (n: number) => {
      const item = columnMenuItems(columns, toggle)[n];
      if (item.kind === undefined) item.run();
    };
    run(3); // Added
    run(0); // Edited
    expect(columns).toEqual(["edited", "words", "added"]);
    run(1); // Words off
    expect(columns).toEqual(["edited", "added"]);
  });
});
