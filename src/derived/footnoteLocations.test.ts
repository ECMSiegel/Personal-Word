import { describe, expect, it } from "vitest";
import { entry, newProject } from "../model";
import { footnoteLocations } from "./footnoteLocations";

function fixture() {
  const p = newProject("Locations");
  const first = { ...entry("section", "Chapter one"), content: {type: "doc", content: [{type: "paragraph", content: [{type: "text", text: "plain"}]}]} };
  const second = { ...entry("section", "Chapter two"), content: {type: "doc", content: [{type: "paragraph", content: [{type: "footnoteReference", attrs: {id: "in-section"}}]}]} };
  const fragment = { ...entry("fragment", "Loose idea"), content: {type: "doc", content: [{type: "paragraph", content: [{type: "footnoteReference", attrs: {id: "in-fragment"}}]}]} };
  return { ...p, entries: [first, second, fragment], order: [first.id, second.id] };
}

describe("footnote locations", () => {
  it("maps a footnote to the manuscript section that holds its marker", () => {
    const p = fixture();
    expect(footnoteLocations(p).get("in-section")).toEqual({ entryId: p.entries[1].id, title: "Chapter two" });
  });

  it("maps a footnote in a fragment to the fragment", () => {
    const p = fixture();
    expect(footnoteLocations(p).get("in-fragment")).toEqual({ entryId: p.entries[2].id, title: "Loose idea" });
  });

  it("leaves out a footnote that no entry references", () => {
    expect(footnoteLocations(fixture()).has("orphan")).toBe(false);
  });

  it("returns the same map object for the same project object", () => {
    const p = fixture();
    expect(footnoteLocations(p)).toBe(footnoteLocations(p));
  });
});
